from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, date

from database import get_db
from models import Subject, Exam, GradeEntry, School, Student
from auth import get_current_school

router = APIRouter(prefix="/academic", tags=["Exams & Grading"])

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
    subject_id: int
    title: str
    exam_date: Optional[date] = None
    max_score: float = 100.0
    term: Optional[str] = None

class ExamResponse(BaseModel):
    id: int
    subject_id: int
    title: str
    max_score: float
    term: Optional[str]
    class Config:
        from_attributes = True

class GradeCreate(BaseModel):
    student_id: int
    score: float
    remarks: Optional[str] = None

# --- Routes ---

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
@router.post("/exams", response_model=ExamResponse)
async def create_exam(
    data: ExamCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    # Verify subject belongs to school
    subj_result = await db.execute(select(Subject).where(Subject.id == data.subject_id, Subject.school_id == current_school.id))
    if not subj_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Subject not found")

    new_exam = Exam(**data.dict(), school_id=current_school.id)
    db.add(new_exam)
    await db.commit()
    await db.refresh(new_exam)
    return new_exam

@router.get("/exams", response_model=List[ExamResponse])
async def get_exams(
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    result = await db.execute(select(Exam).where(Exam.school_id == current_school.id))
    return result.scalars().all()

# Grading
@router.post("/exams/{exam_id}/grades")
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
