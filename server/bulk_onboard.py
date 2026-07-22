"""
Bulk onboarding of teachers/staff/students from a CSV or XLSX file, with
flexible column-header detection (see utils/header_mapper.py).

Rewritten from scratch against the REAL schema -- the original version of
this file assumed things that don't exist in this codebase:
  - sync `Session` / `db.query(...)` -- this app is async SQLAlchemy throughout.
  - a `SchoolUser` class -- role membership actually lives in the `school_users`
    Table (an association table, not a mapped class).
  - `SchoolClass.name` / `.stream` -- the real columns are `grade_level` and
    `stream_section`.
  - `Student.class_id` / `Student.is_active` -- Student doesn't have either;
    it has `grade` + `stream_section` directly, and `status` instead of
    `is_active`.
  - no authentication or tenant scoping at all -- `school_id` was a raw path
    parameter, so anyone who could reach the URL could onboard fake users
    into ANY school by just changing the number in the path. Fixed by using
    get_current_school (derived from the caller's own token) instead.

Permissions: admins can onboard any entity type, unrestricted. Class teachers
may only onboard students, and only into their own assigned class -- the
grade/stream from the file is ignored and overridden by their assignment, so
they can't (accidentally or otherwise) onboard a student into a class that
isn't theirs.
"""

import re
import io
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert as sa_insert

from database import get_db
from models import User, Student, SchoolClass, UserRole, school_users
from utils.header_mapper import map_dataframe_headers
from auth import get_current_school, require_roles, get_effective_roles, get_password_hash

# NOTE: this import assumes models_roles.py / ClassTeacherAssignment exist in
# your project (they do in the reference version of this codebase). If they
# don't, delete this import and the `_resolve_class_lock` function's body
# will need a different way to find "this teacher's own class" -- tell me
# and I'll adjust.
from models_roles import ClassTeacherAssignment

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
        # Onboarding teachers/staff is admin-only -- a class teacher has no
        # business creating other staff accounts.
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
        class_map.setdefault(grade_key, c)  # fallback: grade alone, first match wins

    created_records = 0
    errors = []
    hashed_default = get_password_hash(DEFAULT_PASSWORD)
    target_role = ENTITY_ROLE_MAP[entity_type]

    # Step 3: Process rows -- each row is independent (a savepoint), so one
    # bad row is recorded as an error without losing the rows around it.
    for index, row in df.iterrows():
        row_num = index + 2  # +1 for header row, +1 for 1-indexing
        full_name = "Unknown"
        try:
            async with db.begin_nested():
                full_name = str(row.get("full_name", "")).strip()
                if not full_name or full_name.lower() == "nan":
                    continue  # blank row -- not an error, just skip silently

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
                    if not grade:
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
        except Exception as e:  # noqa: BLE001 -- one bad row must not sink the whole batch
            errors.append({"row_number": row_num, "name": full_name, "reason": f"Unexpected error: {e}"})

    await db.commit()

    return {
        "status": "success",
        "processed": len(df),
        "created": created_records,
        "failed": len(errors),
        "errors": errors,
    }