from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional, Dict
from datetime import date
from pydantic import BaseModel, ConfigDict

from database import get_db
from models import Student, School, CourseRequirement, SchoolCourse, Pathway, StudentCourseEnrollment
from auth import get_current_school, require_roles

router = APIRouter(prefix="/students", tags=["Students"])

# --- Updated Schemas for Full Registrar Biodata ---
class StudentCreate(BaseModel):
    first_name: str
    last_name: str
    grade: str
    gender: Optional[str] = "male"
    dob: Optional[date] = None
    upi_number: Optional[str] = None  # NEMIS UPI Number
    nationality: Optional[str] = "Kenyan"
    religion: Optional[str] = None
    previous_school: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    admission_number: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_relation: Optional[str] = "Parent"

class StudentUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    grade: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[date] = None
    upi_number: Optional[str] = None
    nationality: Optional[str] = None
    religion: Optional[str] = None
    previous_school: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class StudentStatusUpdate(BaseModel):
    status: str  # Active, Transferred, Graduated, Suspended, Withdrawn
    status_reason: Optional[str] = None
    status_date: Optional[date] = None

class StudentResponse(BaseModel):
    id: int
    school_id: int
    first_name: str
    last_name: str
    grade: str
    current_balance: float = 0.0
    status: str = "Active"
    status_reason: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[date] = None
    upi_number: Optional[str] = None
    admission_number: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# --- Unified Response Envelopes ---
class StudentListEnvelope(BaseModel):
    success: bool
    data: List[StudentResponse]

class StudentSingleEnvelope(BaseModel):
    success: bool
    data: StudentResponse

class GenericMessageEnvelope(BaseModel):
    success: bool
    message: str

# --- Routes ---

@router.get("", response_model=StudentListEnvelope)
@router.get("/", response_model=StudentListEnvelope)
async def get_students(
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    current_user = Depends(require_roles("admin", "registrar", "teacher", "exam_officer", "hod"))
):
    """List students scoped to active multi-tenant school node"""
    result = await db.execute(
        select(Student).where(Student.school_id == current_school.id)
    )
    students_list = result.scalars().all()
    return {"success": True, "data": students_list}

@router.post("", response_model=StudentSingleEnvelope)
@router.post("/", response_model=StudentSingleEnvelope)
async def create_student(
    student_data: StudentCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    current_user = Depends(require_roles("admin", "registrar"))
):
    """Admit a student record securely assigned to the active multi-tenant node"""
    insert_kwargs = {
        "first_name": student_data.first_name,
        "last_name": student_data.last_name,
        "grade": student_data.grade,
        "school_id": current_school.id,
        "status": "Active"
    }

    # Dynamically bind supported attributes
    supported_fields = [
        "email", "phone", "gender", "dob", "address", 
        "admission_number", "upi_number", "nationality", 
        "religion", "previous_school"
    ]
    for field in supported_fields:
        if hasattr(Student, field) and getattr(student_data, field) is not None:
            insert_kwargs[field] = getattr(student_data, field)

    new_student = Student(**insert_kwargs)
    db.add(new_student)
    await db.commit()
    await db.refresh(new_student)

    return {"success": True, "data": new_student}

@router.put("/{student_id}", response_model=StudentSingleEnvelope)
async def update_student(
    student_id: int,
    student_data: StudentUpdate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    current_user = Depends(require_roles("admin", "registrar"))
):
    """Update student record details within active tenant node"""
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == current_school.id
        )
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")

    for key, value in student_data.model_dump(exclude_unset=True).items():
        if hasattr(student, key):
            setattr(student, key, value)

    await db.commit()
    await db.refresh(student)

    return {"success": True, "data": student}

@router.put("/{student_id}/status", response_model=StudentSingleEnvelope)
async def update_student_status(
    student_id: int,
    status_payload: StudentStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    current_user = Depends(require_roles("admin", "registrar"))
):
    """Process student status changes (transfers, withdrawals, graduations)"""
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == current_school.id
        )
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")

    student.status = status_payload.status
    if hasattr(student, "status_reason"):
        student.status_reason = status_payload.status_reason
    if hasattr(student, "status_date"):
        student.status_date = status_payload.status_date or date.today()

    await db.commit()
    await db.refresh(student)

    return {"success": True, "data": student}

# --- Senior Secondary Pathway Transition (CBC Grade 9 -> Grade 10) ---

SENIOR_SECONDARY_GRADE_BAND_ID = 2

class PathwaySelectionPayload(BaseModel):
    pathway_id: int
    elective_course_ids: List[int]

class PathwayTransitionEnvelope(BaseModel):
    success: bool
    message: str

@router.post("/{student_id}/pathway-transition", response_model=PathwayTransitionEnvelope)
async def transition_student_to_senior_pathway(
    student_id: int,
    payload: PathwaySelectionPayload,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    current_user = Depends(require_roles("admin", "registrar")),
):
    """
    Transitions a Grade 9 student into a Senior Secondary pathway (Grade 10),
    auto-enrolling compulsory subjects and validating elective-pool selections
    against CourseRequirement rules for the chosen pathway.
    """
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == current_school.id,
        )
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")

    pathway_result = await db.execute(
        select(Pathway).where(Pathway.id == payload.pathway_id)
    )
    pathway = pathway_result.scalar_one_or_none()
    if not pathway:
        raise HTTPException(status_code=400, detail="Selected pathway does not exist")

    rules_result = await db.execute(
        select(CourseRequirement).where(
            CourseRequirement.grade_band_id == SENIOR_SECONDARY_GRADE_BAND_ID,
            (CourseRequirement.pathway_id == payload.pathway_id)
            | (CourseRequirement.pathway_id.is_(None)),
        )
    )
    rules = rules_result.scalars().all()

    compulsory_areas = [r.learning_area_id for r in rules if r.requirement_type == "compulsory"]
    elective_rules = {r.learning_area_id: r for r in rules if r.requirement_type == "elective_pool"}

    compulsory_result = await db.execute(
        select(SchoolCourse).where(
            SchoolCourse.school_id == current_school.id,
            SchoolCourse.grade_level == "Grade 10",
            SchoolCourse.master_learning_area_id.in_(compulsory_areas),
        )
    )
    compulsory_courses = compulsory_result.scalars().all()

    elective_result = await db.execute(
        select(SchoolCourse).where(
            SchoolCourse.id.in_(payload.elective_course_ids),
            SchoolCourse.school_id == current_school.id,
        )
    )
    selected_electives = elective_result.scalars().all()

    pool_counts: Dict[str, int] = {}
    for sc in selected_electives:
        rule = elective_rules.get(sc.master_learning_area_id)
        if not rule:
            raise HTTPException(
                status_code=400,
                detail=f"Course '{sc.local_name}' is not an approved elective for this pathway.",
            )
        if rule.pool_group_name:
            pool_counts[rule.pool_group_name] = pool_counts.get(rule.pool_group_name, 0) + 1

    for rule in rules:
        if rule.requirement_type == "elective_pool" and rule.pool_group_name:
            count = pool_counts.get(rule.pool_group_name, 0)
            if count < rule.min_required_from_pool:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Pathway rule violation: must select at least "
                        f"{rule.min_required_from_pool} subjects from {rule.pool_group_name}."
                    ),
                )

    student.grade = "Grade 10"

    await db.execute(
        delete(StudentCourseEnrollment).where(
            StudentCourseEnrollment.student_id == student.id,
            StudentCourseEnrollment.school_id == current_school.id,
        )
    )

    for course in [*compulsory_courses, *selected_electives]:
        db.add(
            StudentCourseEnrollment(
                student_id=student.id,
                school_course_id=course.id,
                school_id=current_school.id,
            )
        )

    await db.commit()

    return {
        "success": True,
        "message": "Student successfully transitioned to Senior Secondary pathway.",
    }