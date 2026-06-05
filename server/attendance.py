from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel
from datetime import date, datetime

from database import get_db
from models import Attendance, Student, School
from auth import get_current_school

router = APIRouter(prefix="/attendance", tags=["Attendance"])

# --- Schemas ---
class AttendanceCreate(BaseModel):
    student_id: int
    status: str # PRESENT, ABSENT, LATE, EXCUSED
    notes: Optional[str] = None
    date: Optional[date] = None

class AttendanceResponse(BaseModel):
    id: int
    student_id: int
    date: date
    status: str
    notes: Optional[str]
    class Config:
        from_attributes = True

# --- Routes ---

@router.post("/")
async def record_attendance(
    records: List[AttendanceCreate],
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """Batch record student attendance"""
    today = datetime.utcnow().date()
    
    for entry in records:
        # Verify student belongs to school
        stud_result = await db.execute(select(Student).where(Student.id == entry.student_id, Student.school_id == current_school.id))
        if not stud_result.scalar_one_or_none():
            continue
            
        new_record = Attendance(
            school_id=current_school.id,
            student_id=entry.student_id,
            status=entry.status,
            notes=entry.notes,
            date=entry.date or today
        )
        db.add(new_record)
        
    await db.commit()
    return {"message": f"Recorded {len(records)} attendance entries"}

@router.get("/student/{student_id}", response_model=List[AttendanceResponse])
async def get_student_attendance(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """View attendance history for a specific student"""
    # Verify student
    stud_result = await db.execute(select(Student).where(Student.id == student_id, Student.school_id == current_school.id))
    if not stud_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Student not found")

    result = await db.execute(
        select(Attendance).where(Attendance.student_id == student_id).order_by(Attendance.date.desc())
    )
    return result.scalars().all()
