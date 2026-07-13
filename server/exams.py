from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, date

from database import get_db
from models import Subject, Course, Exam, GradeEntry, School, Student
from auth import get_current_school, get_current_user
from sqlalchemy import delete, update

# Subject-management routes are mounted at /api/academic/... (see main.py).
router = APIRouter(prefix="/academic", tags=["Academic Subjects"])

# Exam routes are mounted directly at /api/exams/... (see main.py) -- the
# frontend (Academics.tsx, ExamDetail.tsx, TeacherDashboard.tsx, CourseDetail.tsx)
# always calls /api/exams, never /api/academic/exams. Keeping this as a
# separate router (instead of nesting it under the /academic-prefixed
# `router` above) avoids that mismatch.
exams_router = APIRouter(prefix="/exams", tags=["Exams & Grading"])

# --- Schemas ---
class SubjectCreate(BaseModel):
    name: str
    code: Optional[str] = None

class SubjectResponse(BaseModel):
    id: int
    name: str
    code: Optional[str]
    class Config:
        from_attributes = True

class ExamCreate(BaseModel):
    name: str                              # frontend calls it "name"; stored as Exam.title
    course_id: int                         # frontend calls it "course_id"; stored as Exam.subject_id (references courses.id)
    exam_date: Optional[str] = None        # comes from a <input type="datetime-local">, e.g. "2026-07-20T14:30"
    total_marks: Optional[float] = 100.0   # stored as Exam.max_score
    duration_minutes: Optional[int] = None # not currently persisted -- Exam has no matching column yet
    term: Optional[str] = None

class ExamResponse(BaseModel):
    id: int
    title: str
    course_id: int
    exam_date: Optional[str] = None
    total_marks: float
    duration_minutes: Optional[int] = None
    status: str = "Scheduled"
    term: Optional[str] = None

class GradeCreate(BaseModel):
    student_id: int
    score: float
    remarks: Optional[str] = None

# --- Routes ---
@router.put("/subjects/{subject_id}")
async def update_subject(
    subject_id: int, 
    data: dict, # Expecting {"name": "Math", "code": "MAT"}
    db: AsyncSession = Depends(get_db), 
    current_school: School = Depends(get_current_school),
    token_data = Depends(get_current_user)
):
    # Optional: Verify role here using require_roles("admin", "hod", "registrar")
    
    result = await db.execute(
        select(Subject).where(Subject.id == subject_id, Subject.school_id == current_school.id)
    )
    subject = result.scalar_one_or_none()
    
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    if "name" in data:
        subject.name = data["name"]
    if "code" in data:
        subject.code = data["code"]
        
    await db.commit()
    return {"success": True, "message": "Subject updated successfully"}

@router.delete("/subjects/{subject_id}")
async def delete_subject(
    subject_id: int, 
    db: AsyncSession = Depends(get_db), 
    current_school: School = Depends(get_current_school),
    token_data = Depends(get_current_user)
):
    result = await db.execute(
        delete(Subject).where(Subject.id == subject_id, Subject.school_id == current_school.id)
    )
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    return {"success": True, "message": "Subject deleted successfully"}
# Subjects
@router.post("/subjects", response_model=SubjectResponse)
async def create_subject(
    data: SubjectCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    new_subject = Subject(**data.dict(), school_id=current_school.id)
    db.add(new_subject)
    await db.commit()
    await db.refresh(new_subject)
    return new_subject

@router.get("/subjects", response_model=List[SubjectResponse])
async def get_subjects(
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    result = await db.execute(select(Subject).where(Subject.school_id == current_school.id))
    return result.scalars().all()

# Exams
@exams_router.post("", response_model=ExamResponse)
@exams_router.post("/", response_model=ExamResponse)
async def create_exam(
    data: ExamCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    # Verify the course belongs to this school (exams now reference courses, not the old subjects table)
    course_result = await db.execute(
        select(Course).where(Course.id == data.course_id, Course.school_id == current_school.id)
    )
    if not course_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Course not found")

    exam_date_value = None
    if data.exam_date:
        try:
            # exam_date column is a plain Date; strip any time component from the
            # datetime-local string the frontend sends (e.g. "2026-07-20T14:30")
            exam_date_value = date.fromisoformat(data.exam_date.split("T")[0])
        except ValueError:
            raise HTTPException(status_code=422, detail="exam_date must be a valid date")

    new_exam = Exam(
        school_id=current_school.id,
        subject_id=data.course_id,
        title=data.name,
        exam_date=exam_date_value,
        max_score=data.total_marks or 100.0,
        term=data.term,
    )
    db.add(new_exam)
    await db.commit()
    await db.refresh(new_exam)

    return {
        "id": new_exam.id,
        "title": new_exam.title,
        "course_id": new_exam.subject_id,
        "exam_date": new_exam.exam_date.isoformat() if new_exam.exam_date else None,
        "total_marks": new_exam.max_score,
        "duration_minutes": data.duration_minutes,  # not persisted yet -- echoed back so the UI shows what was entered
        "status": "Scheduled",
        "term": new_exam.term,
    }

@exams_router.get("", response_model=List[ExamResponse])
@exams_router.get("/", response_model=List[ExamResponse])
async def get_exams(
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    result = await db.execute(select(Exam).where(Exam.school_id == current_school.id))
    exams = result.scalars().all()
    return [
        {
            "id": e.id,
            "title": e.title,
            "course_id": e.subject_id,
            "exam_date": e.exam_date.isoformat() if e.exam_date else None,
            "total_marks": e.max_score,
            "duration_minutes": None,  # not persisted yet
            "status": "Scheduled",
            "term": e.term,
        }
        for e in exams
    ]

# Grading
@exams_router.post("/{exam_id}/grades")
async def record_grades(
    exam_id: int,
    grades: List[GradeCreate],
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """Batch record marks for an exam"""
    # 1. Verify exam belongs to school
    exam_result = await db.execute(select(Exam).where(Exam.id == exam_id, Exam.school_id == current_school.id))
    if not exam_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Exam not found")

    for entry in grades:
        # Verify student belongs to school
        stud_result = await db.execute(select(Student).where(Student.id == entry.student_id, Student.school_id == current_school.id))
        if not stud_result.scalar_one_or_none():
            continue # Skip invalid student IDs
        
        new_grade = GradeEntry(
            exam_id=exam_id,
            student_id=entry.student_id,
            score=entry.score,
            remarks=entry.remarks
        )
        db.add(new_grade)
    
    await db.commit()
    return {"message": f"Recorded {len(grades)} grades successfully"}