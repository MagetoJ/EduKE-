import io
import re
from typing import Optional

import pandas as pd
from auth import get_current_school, get_effective_roles, get_password_hash, require_roles
from database import get_db
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from models import SchoolClass, Student, User, UserRole, school_users
from models_roles import ClassTeacherAssignment
from sqlalchemy import insert as sa_insert
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from utils.header_mapper import map_dataframe_headers

router = APIRouter(prefix="/api/bulk-onboard", tags=["Bulk Onboarding"])

DEFAULT_PASSWORD = "EduKeTempPassword123!"

ENTITY_ROLE_MAP = {
    "teachers": UserRole.TEACHER,
    "staff": UserRole.STAFF,
    "students": UserRole.STUDENT,
}


async def _resolve_class_lock(db: AsyncSession, user: User, school_id: int):
    """Admins onboard unrestricted. A class teacher (with no admin role) gets
    locked to their own assigned grade+stream."""
    effective_roles = await get_effective_roles(db, user.id, school_id)
    if "admin" in effective_roles or getattr(user, "is_super_admin", False):
        return None, None

    result = await db.execute(
        select(ClassTeacherAssignment).where(ClassTeacherAssignment.teacher_id == user.id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(
            status_code=403,
            detail="You are not assigned as a class teacher to any class, so you can't onboard students.",
        )
    return assignment.grade_level, assignment.stream_section


@router.post("/{entity_type}")
async def bulk_onboard_entities(
    entity_type: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_school=Depends(get_current_school),
    current_user: User = Depends(require_roles("admin", "class_teacher")),
):
    if entity_type not in ENTITY_ROLE_MAP:
        raise HTTPException(status_code=400, detail="entity_type must be one of: teachers, staff, students")

    locked_grade: Optional[str] = None
    locked_stream: Optional[str] = None

    if entity_type == "students":
        locked_grade, locked_stream = await _resolve_class_lock(db, current_user, current_school.id)
    else:
        effective_roles = await get_effective_roles(db, current_user.id, current_school.id)
        if "admin" not in effective_roles and not getattr(current_user, "is_super_admin", False):
            raise HTTPException(status_code=403, detail="Only admins can onboard teachers or staff")

    contents = await file.read()
    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith((".xls", ".xlsx")):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Upload .csv or .xlsx files only.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid file format: {str(e)}")

    # Step 1: Dynamically rename columns based on alias mapping
    column_mapping = map_dataframe_headers(df.columns.tolist())
    df = df.rename(columns=column_mapping)

    if "full_name" not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="Could not detect a 'Name' or 'Full Name' column in your file. Please check column headers.",
        )

    # Step 2: Cache this school's existing classes for instant lookup
    classes_result = await db.execute(select(SchoolClass).where(SchoolClass.school_id == current_school.id))
    class_map = {}
    for c in classes_result.scalars().all():
        grade_key = (c.grade_level or "").strip().lower()
        stream_key = (c.stream_section or "").strip().lower()
        if stream_key:
            class_map[f"{grade_key}-{stream_key}"] = c
        class_map.setdefault(grade_key, c)

    created_records = 0
    errors = []
    hashed_default = get_password_hash(DEFAULT_PASSWORD)
    target_role = ENTITY_ROLE_MAP[entity_type]

    # Step 3: Process rows with individual savepoint management
    for index, row in df.iterrows():
        row_num = index + 2  # 1-indexed header offset
        full_name = "Unknown"
        
        try:
            # Begin an isolated savepoint for each row
            async with db.begin_nested():
                full_name = str(row.get("full_name", "")).strip()
                if not full_name or full_name.lower() in ("nan", "none", ""):
                    continue  # Skip blank row

                raw_email = row.get("email")
                if pd.isna(raw_email) or not str(raw_email).strip():
                    clean_name = re.sub(r"[^a-zA-Z0-9]", "", full_name.lower())
                    email = f"{clean_name}{index}@school.internal"
                else:
                    email = str(raw_email).strip().lower()

                existing_user_result = await db.execute(select(User).where(User.email == email))
                user = existing_user_result.scalar_one_or_none()
                
                if not user:
                    username = email.split("@")[0]
                    user = User(
                        email=email,
                        username=username,
                        full_name=full_name,
                        hashed_password=hashed_default,
                        is_active=True,
                        is_super_admin=False,
                    )
                    db.add(user)
                    await db.flush()

                membership_result = await db.execute(
                    select(school_users.c.id).where(
                        school_users.c.school_id == current_school.id,
                        school_users.c.user_id == user.id,
                    )
                )
                if not membership_result.scalar_one_or_none():
                    await db.execute(
                        sa_insert(school_users).values(
                            school_id=current_school.id,
                            user_id=user.id,
                            role=target_role,
                            is_active=True,
                        )
                    )

                if entity_type == "students":
                    name_parts = full_name.split(" ", 1)
                    first_name = name_parts[0]
                    last_name = name_parts[1] if len(name_parts) > 1 else "Learner"

                    grade = locked_grade or str(row.get("class_name", "")).strip()
                    stream_section = (
                        locked_stream if locked_grade is not None
                        else (str(row.get("stream", "")).strip() or None)
                    )
                    if not grade or grade.lower() == "nan":
                        raise ValueError("No class/grade found for this row")

                    admission_number = str(row.get("admission_number", "")).strip() or None
                    if admission_number and admission_number.lower() == "nan":
                        admission_number = None

                    if admission_number:
                        dup_result = await db.execute(
                            select(Student).where(
                                Student.school_id == current_school.id,
                                Student.admission_number == admission_number,
                            )
                        )
                        if dup_result.scalar_one_or_none():
                            raise ValueError(f"Student with admission number '{admission_number}' already exists")

                    existing_student_result = await db.execute(
                        select(Student).where(Student.user_id == user.id, Student.school_id == current_school.id)
                    )
                    student = existing_student_result.scalar_one_or_none()
                    if not student:
                        student = Student(
                            school_id=current_school.id,
                            user_id=user.id,
                            first_name=first_name,
                            last_name=last_name,
                            grade=grade,
                            stream_section=stream_section,
                            admission_number=admission_number,
                            status="active",
                        )
                        db.add(student)
                    else:
                        student.grade = grade
                        student.stream_section = stream_section
                        if admission_number:
                            student.admission_number = admission_number

                created_records += 1

        except ValueError as e:
            errors.append({"row_number": row_num, "name": full_name, "reason": str(e)})
        except Exception as e:
            errors.append({"row_number": row_num, "name": full_name, "reason": f"Unexpected error: {e}"})

    # Final batch commit after row-level savepoint resolutions
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to commit bulk batch to database: {str(e)}"
        )

    return {
        "status": "success",
        "processed": len(df),
        "created": created_records,
        "failed": len(errors),
        "errors": errors,
    }