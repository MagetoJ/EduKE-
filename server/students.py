from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from pydantic import BaseModel

from database import get_db
from models import Student, School
from auth import get_current_school  # The dependency we built earlier

router = APIRouter(prefix="/students", tags=["Students"])

# --- Schemas ---
class StudentCreate(BaseModel):
    first_name: str
    last_name: str
    grade: str

class StudentResponse(StudentCreate):
    id: int
    school_id: int
    current_balance: float

    class Config:
        from_attributes = True

# --- Routes ---

@router.get("/", response_model=List[StudentResponse])
async def get_students(
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """List students only for the logged-in school (Multi-tenant pattern)"""
    result = await db.execute(
        select(Student).where(Student.school_id == current_school.id)
    )
    return result.scalars().all()

@router.post("/", response_model=StudentResponse)
async def create_student(
    student_data: StudentCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """Add a student to the current school"""
    new_student = Student(
        **student_data.dict(),
        school_id=current_school.id
    )
    db.add(new_student)
    await db.commit()
    await db.refresh(new_student)
    return new_student
