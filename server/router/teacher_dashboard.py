from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional

from database import get_db
from auth import get_current_user, get_current_school, require_roles
from models import (
    User, 
    School, 
    SchoolClass, 
    Subject, 
    ClassSubjectAssignment, 
    ClassTeacherAssignment,
    Student
)
from pydantic import BaseModel

router = APIRouter(prefix="/api/teacher-dashboard", tags=["Teacher Dashboard"])

# --- PYDANTIC SCHEMAS ---

class SubjectAssignmentResponse(BaseModel):
    class_name: str
    subject_name: str
    subject_code: Optional[str]

class HomeroomResponse(BaseModel):
    class_name: str
    grade_level: str
    stream_section: Optional[str]
    total_students: int

class TeacherDashboardOverview(BaseModel):
    is_class_teacher: bool
    homeroom: Optional[HomeroomResponse]
    teaching_subjects: List[SubjectAssignmentResponse]

# --- API ROUTES ---

@router.get("/overview", response_model=TeacherDashboardOverview)
async def get_teacher_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("teacher", "class_teacher")),
    current_school: School = Depends(get_current_school)
):
    """
    Fetches the dashboard overview for the logged-in teacher.
    Separates their role as a subject teacher from their role as a class teacher.
    """
    
    # 1. Fetch Subject Teaching Assignments (Regular Teacher Role)
    # What subjects do they teach, and in which classes?
    subjects_query = await db.execute(
        select(SchoolClass, Subject)
        .join(ClassSubjectAssignment, SchoolClass.id == ClassSubjectAssignment.class_id)
        .join(Subject, Subject.id == ClassSubjectAssignment.subject_id)
        .where(
            ClassSubjectAssignment.teacher_id == current_user.id,
            SchoolClass.school_id == current_school.id
        )
    )
    
    teaching_subjects = []
    for school_class, subject in subjects_query.all():
        teaching_subjects.append({
            "class_name": f"{school_class.grade_level} {school_class.stream_section or ''}".strip(),
            "subject_name": subject.name,
            "subject_code": subject.code
        })

    # 2. Fetch Class Teacher Assignment (Homeroom Role)
    # Are they the official class teacher for any specific class?
    homeroom_query = await db.execute(
        select(SchoolClass)
        .join(ClassTeacherAssignment, SchoolClass.id == ClassTeacherAssignment.class_id)
        .where(
            ClassTeacherAssignment.teacher_id == current_user.id,
            SchoolClass.school_id == current_school.id
        )
    )
    homeroom_class = homeroom_query.scalar_one_or_none()

    homeroom_data = None
    is_class_teacher = False

    if homeroom_class:
        is_class_teacher = True
        
        # Count how many students are in this homeroom
        students_query = await db.execute(
            select(Student).where(
                Student.grade == homeroom_class.grade_level,
                Student.stream_section == homeroom_class.stream_section,
                Student.school_id == current_school.id,
                Student.status == "active"
            )
        )
        total_students = len(students_query.scalars().all())

        homeroom_data = {
            "class_name": f"{homeroom_class.grade_level} {homeroom_class.stream_section or ''}".strip(),
            "grade_level": homeroom_class.grade_level,
            "stream_section": homeroom_class.stream_section,
            "total_students": total_students
        }

    # 3. Return the combined dashboard payload
    return {
        "is_class_teacher": is_class_teacher,
        "homeroom": homeroom_data,
        "teaching_subjects": teaching_subjects
    }