from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional, Dict
from pydantic import BaseModel

from database import get_db
# NOTE: CourseRequirement, SchoolCourse, Pathway, and StudentCourseEnrollment
# do not exist in models.py yet. They need to be added (per the CBC curriculum
# roadmap) before this endpoint will run. Everything else below matches the
# existing async/tenant-scoped conventions already used in this file.
from models import Student, School, CourseRequirement, SchoolCourse, Pathway, StudentCourseEnrollment
from auth import get_current_school, require_roles

router = APIRouter(prefix="/students", tags=["Students"])

# --- Updated Schemas to accommodate full enrollment data ---
class StudentCreate(BaseModel):
    first_name: str
    last_name: str
    grade: str
    email: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = "male"
    address: Optional[str] = None
    admission_number: Optional[str] = None

class StudentResponse(BaseModel):
    id: int
    school_id: int
    first_name: str
    last_name: str
    grade: str
    current_balance: float
    status: str = "active"
    email: Optional[str] = None
    phone: Optional[str] = None

    class Config:
        from_attributes = True

# --- Unified Response Envelopes ---
class StudentListEnvelope(BaseModel):
    success: bool
    data: List[StudentResponse]

class StudentSingleEnvelope(BaseModel):
    success: bool
    data: StudentResponse

# --- Routes ---

@router.get("", response_model=StudentListEnvelope)
@router.get("/", response_model=StudentListEnvelope)
async def get_students(
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """List students wrapped inside a response envelope matching frontend expectations"""
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
    current_school: School = Depends(get_current_school)
):
    """Add a student record securely assigned to the active multi-tenant node"""
    # Filter keys dynamically depending on what your SQLAlchemy columns support
    insert_kwargs = {
        "first_name": student_data.first_name,
        "last_name": student_data.last_name,
        "grade": student_data.grade,
        "school_id": current_school.id
    }

    # Optional safeguards for alternative model structures
    for field in ["email", "phone", "gender", "address", "admission_number"]:
        if hasattr(Student, field):
            insert_kwargs[field] = getattr(student_data, field)

    new_student = Student(**insert_kwargs)
    db.add(new_student)
    await db.commit()
    await db.refresh(new_student)

    return {"success": True, "data": new_student}


# --- Senior Secondary Pathway Transition (CBC Grade 9 -> Grade 10) ---

# TODO: replace this magic number with a lookup once a GradeBand table exists
# (e.g. select(GradeBand).where(GradeBand.name == "Senior Secondary")), so the
# grade-band id isn't hardcoded here.
SENIOR_SECONDARY_GRADE_BAND_ID = 2


class PathwaySelectionPayload(BaseModel):
    pathway_id: int
    elective_course_ids: List[int]  # SchoolCourse IDs the student is choosing as electives


class PathwayTransitionEnvelope(BaseModel):
    success: bool
    message: str


@router.post("/{student_id}/pathway-transition", response_model=PathwayTransitionEnvelope)
async def transition_student_to_senior_pathway(
    student_id: int,
    payload: PathwaySelectionPayload,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    current_user=Depends(require_roles("admin", "registrar")),
):
    """
    Transitions a Grade 9 student into a Senior Secondary pathway (Grade 10),
    auto-enrolling compulsory subjects and validating elective-pool selections
    against CourseRequirement rules for the chosen pathway.

    Requires admin or registrar role -- adjust the require_roles(...) call if
    a different role (e.g. "exam_officer") should own this action instead.
    """

    # 1. Fetch the student, scoped to this tenant -- never trust student_id alone
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.school_id == current_school.id,
        )
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")

    # 2. Validate the requested pathway actually exists
    pathway_result = await db.execute(
        select(Pathway).where(Pathway.id == payload.pathway_id)
    )
    pathway = pathway_result.scalar_one_or_none()
    if not pathway:
        raise HTTPException(status_code=400, detail="Selected pathway does not exist")

    # 3. Pull every rule for Senior Secondary: compulsory core (pathway_id is
    #    NULL) plus rules specific to the chosen pathway
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

    # 4. Resolve compulsory course offerings actually active at this school
    compulsory_result = await db.execute(
        select(SchoolCourse).where(
            SchoolCourse.school_id == current_school.id,
            SchoolCourse.grade_level == "Grade 10",
            SchoolCourse.master_learning_area_id.in_(compulsory_areas),
        )
    )
    compulsory_courses = compulsory_result.scalars().all()

    # 5. Resolve the student's chosen electives, scoped to this tenant
    elective_result = await db.execute(
        select(SchoolCourse).where(
            SchoolCourse.id.in_(payload.elective_course_ids),
            SchoolCourse.school_id == current_school.id,
        )
    )
    selected_electives = elective_result.scalars().all()

    # 6. Validate each chosen elective is actually approved for this pathway,
    #    and tally selections per elective pool
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

    # 7. Enforce minimum-per-pool rules (e.g. "at least 2 from the Sciences pool")
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

    # 8. Update the student's grade band and persist enrollments.
    # Clear any prior Senior Secondary enrollments first so this endpoint is
    # safe to call again (e.g. if the student changes their elective choices).
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