from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import pandas as pd
import io

from database import get_db
from models import User, SchoolUser, Student, SchoolClass, UserRole
from utils.header_mapper import map_dataframe_headers
from utils import get_password_hash

router = APIRouter(prefix="/api/bulk-onboard", tags=["Bulk Onboarding"])

DEFAULT_PASSWORD = "EduKeTempPassword123!"

@router.post("/{school_id}/{entity_type}")
async def bulk_onboard_entities(
    school_id: int,
    entity_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    contents = await file.read()
    
    # Read CSV/Excel
    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith((".xls", ".xlsx")):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Upload .csv or .xlsx files only.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid file format: {str(e)}")

    # Step 1: Dynamically rename columns based on alias mapping
    column_mapping = map_dataframe_headers(df.columns.tolist())
    df = df.rename(columns=column_mapping)

    # Validate that essential fields exist after mapping
    if "full_name" not in df.columns:
        raise HTTPException(
            status_code=400, 
            detail="Could not detect a 'Name' or 'Full Name' column in your file. Please check column headers."
        )

    # Step 2: Cache existing classes in school for instant lookup
    classes = db.query(SchoolClass).filter_by(school_id=school_id).all()
    # Map both 'form 1-east' and 'form 1' without stream to class IDs
    class_map = {}
    for c in classes:
        full_key = f"{c.name.strip().lower()}-{c.stream.strip().lower()}" if c.stream else c.name.strip().lower()
        class_map[full_key] = c.id
        class_map[c.name.strip().lower()] = c.id  # fallback to class name alone

    created_records = 0
    errors = []
    hashed_default = get_password_hash(DEFAULT_PASSWORD)

    # Step 3: Process Rows
    for index, row in df.iterrows():
        row_num = index + 2
        try:
            full_name = str(row.get("full_name", "")).strip()
            if not full_name or full_name.lower() == "nan":
                continue  # Skip blank rows

            # Auto-generate fallback email if email column is absent in school file
            raw_email = row.get("email")
            if pd.isna(raw_email) or not str(raw_email).strip():
                clean_name = re.sub(r'[^a-zA-Z0-9]', '', full_name.lower())
                email = f"{clean_name}{index}@school.internal"
            else:
                email = str(raw_email).strip().lower()

            # Find or Create User
            user = db.query(User).filter_by(email=email).first()
            if not user:
                username = email.split("@")[0]
                user = User(
                    email=email,
                    username=username,
                    full_name=full_name,
                    hashed_password=hashed_default,
                    is_active=True,
                    is_super_admin=False
                )
                db.add(user)
                db.flush()

            # Map Role
            role_dict = {"teachers": UserRole.TEACHER, "staff": UserRole.STAFF, "students": UserRole.STUDENT}
            target_role = role_dict[entity_type]

            # Attach User to School
            school_user = db.query(SchoolUser).filter_by(school_id=school_id, user_id=user.id).first()
            if not school_user:
                school_user = SchoolUser(school_id=school_id, user_id=user.id, role=target_role, is_active=True)
                db.add(school_user)

            # Extra Student Mapping (Admission No. & Class linkage)
            if entity_type == "students":
                adm_no = str(row.get("admission_number", f"ADM-{user.id}")).strip()
                class_name = str(row.get("class_name", "")).strip().lower()
                stream = str(row.get("stream", "")).strip().lower()

                # Resolution order: exact 'Class-Stream' -> Class alone
                target_key = f"{class_name}-{stream}" if stream else class_name
                class_id = class_map.get(target_key) or class_map.get(class_name)

                student = db.query(Student).filter_by(user_id=user.id).first()
                if not student:
                    student = Student(
                        user_id=user.id,
                        school_id=school_id,
                        admission_number=adm_no,
                        class_id=class_id,
                        is_active=True
                    )
                    db.add(student)
                else:
                    student.class_id = class_id

            created_records += 1

        except Exception as e:
            db.rollback()
            errors.append(f"Row {row_num} ({full_name if 'full_name' in locals() else 'Unknown'}): {str(e)}")
            continue

    db.commit()

    return {
        "status": "success",
        "processed": len(df),
        "created": created_records,
        "failed": len(errors),
        "errors": errors
    }