from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional
from pydantic import BaseModel

from database import get_db
from models import TimetableSlot, School, Subject, User, UserRole
from auth import get_current_school

router = APIRouter(prefix="/timetables", tags=["Timetable Management"])

# --- Schemas ---
class TimetableSlotCreate(BaseModel):
    subject_id: int
    teacher_id: Optional[int] = None
    day_of_week: str      # Monday, Tuesday, etc.
    start_time: str       # HH:MM format
    end_time: str         # HH:MM format
    room: Optional[str] = None
    grade_level: str      # e.g., "Grade 1", "Grade 2"

class TimetableSlotResponse(BaseModel):
    id: int
    school_id: int
    subject_id: int
    subject_name: str
    teacher_id: Optional[int]
    teacher_name: Optional[str]
    day_of_week: str
    start_time: str
    end_time: str
    room: Optional[str]
    grade_level: str

    class Config:
        from_attributes = True

# --- Routes ---

@router.get("", response_model=dict)
@router.get("/", response_model=dict)
async def get_timetable_slots(
    grade_level: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """Retrieve all timetable slots for the school node, optionally filtered by grade level"""
    query = select(
        TimetableSlot, 
        Subject.name.label("subject_name"), 
        User.full_name.label("teacher_name")
    ).join(
        Subject, TimetableSlot.subject_id == Subject.id
    ).join(
        User, TimetableSlot.teacher_id == User.id, isouter=True
    ).where(
        TimetableSlot.school_id == current_school.id
    )

    if grade_level:
        query = query.where(TimetableSlot.grade_level == grade_level)

    result = await db.execute(query)
    rows = result.all()

    slots_data = []
    for slot, sub_name, teacher_name in rows:
        slots_data.append({
            "id": slot.id,
            "school_id": slot.school_id,
            "subject_id": slot.subject_id,
            "subject_name": sub_name,
            "teacher_id": slot.teacher_id,
            "teacher_name": teacher_name or "Unassigned",
            "day_of_week": slot.day_of_week,
            "start_time": slot.start_time,
            "end_time": slot.end_time,
            "room": slot.room or "N/A",
            "grade_level": slot.grade_level
        })

    return {"success": True, "data": slots_data}

@router.post("", response_model=dict)
@router.post("/", response_model=dict)
async def create_timetable_slot(
    data: TimetableSlotCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """Create a new slot block checked for overlapping scheduling conflicts"""
    
    # 1. Schedule Overlap Detection Safety Check
    conflict_query = select(TimetableSlot).where(
        TimetableSlot.school_id == current_school.id,
        TimetableSlot.day_of_week == data.day_of_week,
        TimetableSlot.grade_level == data.grade_level,
        TimetableSlot.start_time < data.end_time,
        TimetableSlot.end_time > data.start_time
    )
    conflict_result = await db.execute(conflict_query)
    if conflict_result.scalar_one_or_none():
        raise HTTPException(
            status_code=400, 
            detail="Schedule conflict detected! Another subject is already scheduled at this time for this grade."
        )

    # 2. Persist to DB
    new_slot = TimetableSlot(
        school_id=current_school.id,
        subject_id=data.subject_id,
        teacher_id=data.teacher_id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
        room=data.room,
        grade_level=data.grade_level
    )
    
    db.add(new_slot)
    await db.commit()
    await db.refresh(new_slot)
    
    return {"success": True, "message": "Timetable slot allocated successfully"}

@router.delete("/{slot_id}")
@router.delete("/{slot_id}/")
async def delete_timetable_slot(
    slot_id: int,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """Delete a configured schedule slot block block"""
    query = delete(TimetableSlot).where(
        TimetableSlot.id == slot_id,
        TimetableSlot.school_id == current_school.id
    )
    result = await db.execute(query)
    await db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Timetable slot not found")
        
    return {"success": True, "message": "Slot successfully removed from timetable"}