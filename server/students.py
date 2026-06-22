from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel

from database import get_db
from models import Student, School
from auth import get_current_school

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