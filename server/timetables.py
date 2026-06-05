from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel

from database import get_db
from models import TimetableSlot, School, Subject, User, school_users, UserRole
from auth import get_current_school

router = APIRouter(prefix="/timetables", tags=["Timetables"])

# --- Schemas ---
class TimetableSlotCreate(BaseModel):
    subject_id: int
    teacher_id: Optional[int] = None
    day_of_week: str
    start_time: str
    end_time: str
    room: Optional[str] = None
    grade_level: str

class TimetableSlotResponse(BaseModel):
    id: int
    subject_id: int
    teacher_id: Optional[int]
    day_of_week: str
    start_time: str
    end_time: str
    room: Optional[str]
    grade_level: str
    class Config:
        from_attributes = True

# --- Routes ---

@router.post("/", response_model=TimetableSlotResponse)
async def create_timetable_slot(
    data: TimetableSlotCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """Add a lesson to the weekly timetable"""
    # 1. Verify subject belongs to school
    subj_result = await db.execute(select(Subject).where(Subject.id == data.subject_id, Subject.school_id == current_school.id))
    if not subj_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Subject not found")

    # 2. Verify teacher belongs to school and has teacher role
    if data.teacher_id:
        teacher_query = select(User).join(school_users).where(
            User.id == data.teacher_id,
            school_users.c.school_id == current_school.id,
            school_users.c.role == UserRole.TEACHER
        )
        teacher_result = await db.execute(teacher_query)
        if not teacher_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Invalid teacher for this school")

    new_slot = TimetableSlot(**data.dict(), school_id=current_school.id)
    db.add(new_slot)
    await db.commit()
    await db.refresh(new_slot)
    return new_slot

@router.get("/{grade_level}", response_model=List[TimetableSlotResponse])
async def get_grade_timetable(
    grade_level: str,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """View weekly timetable for a specific class/grade"""
    result = await db.execute(
        select(TimetableSlot).where(
            TimetableSlot.school_id == current_school.id,
            TimetableSlot.grade_level == grade_level
        ).order_by(TimetableSlot.day_of_week, TimetableSlot.start_time)
    )
    return result.scalars().all()
