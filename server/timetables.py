from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import Optional
from pydantic import BaseModel

from database import get_db
from models import TimetableSlot, School, Course, User, school_users
from auth import get_current_school, get_current_user

router = APIRouter(prefix="/timetable", tags=["Timetable Management"])

# ─────────────────────────── Schemas ────────────────────────────

class TimetableSlotCreate(BaseModel):
    subject_id: int
    teacher_id: Optional[int] = None
    day_of_week: str        
    start_time: str         
    end_time: str           
    room: Optional[str] = None
    grade_level: str        

class TimetableSlotUpdate(BaseModel):
    subject_id: Optional[int] = None
    teacher_id: Optional[int] = None
    day_of_week: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    room: Optional[str] = None
    grade_level: Optional[str] = None

class PeriodCreate(BaseModel):
    period_name: str
    start_time: str
    end_time: str
    is_break: bool = False

# ─────────────────────── Helpers ──────────────────────────────────

def _extract_role(raw_role) -> str:
    if raw_role is None:
        return "staff"
    if hasattr(raw_role, "value"):
        return str(raw_role.value).lower().strip()
    role_str = str(raw_role).lower().strip()
    if "userrole." in role_str:
        role_str = role_str.split("userrole.")[-1].strip()
    return role_str

async def verify_timetable_manager(db: AsyncSession, user: User, school_id: int):
    if user.is_super_admin:
        return True
    membership_result = await db.execute(
        select(school_users.c.role).where(
            school_users.c.user_id == user.id,
            school_users.c.school_id == school_id,
        )
    )
    role = _extract_role(membership_result.scalar_one_or_none())
    if role not in ["admin", "timetable_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized to modify timetables")

# ──────────────────────── Period routes ──────────────────────────

@router.get("/periods", response_model=dict)
@router.get("/periods/", response_model=dict)
async def get_periods(
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
):
    result = await db.execute(
        select(TimetableSlot.start_time, TimetableSlot.end_time)
        .where(TimetableSlot.school_id == current_school.id)
        .distinct()
        .order_by(TimetableSlot.start_time)
    )
    rows = result.all()

    periods = []
    for idx, (start, end) in enumerate(rows, start=1):
        periods.append({
            "id": idx,
            "name": f"Period {idx}",
            "start_time": start,
            "end_time": end,
            "is_break": False,
        })

    if not periods:
        defaults = [
            ("08:00", "09:00", False),
            ("09:00", "10:00", False),
            ("10:00", "10:15", True),
            ("10:15", "11:15", False),
            ("11:15", "12:15", False),
            ("12:15", "12:45", True),
            ("12:45", "13:45", False),
            ("13:45", "14:45", False),
        ]
        for idx, (start, end, is_break) in enumerate(defaults, start=1):
            periods.append({
                "id": idx,
                "name": "Break" if is_break else f"Period {idx}",
                "start_time": start,
                "end_time": end,
                "is_break": is_break,
            })

    return {"success": True, "data": periods}

@router.post("/periods", response_model=dict)
@router.post("/periods/", response_model=dict)
async def create_period(data: PeriodCreate):
    return {
        "success": True,
        "data": {
            "id": 0,
            "name": data.period_name,
            "start_time": data.start_time,
            "end_time": data.end_time,
            "is_break": data.is_break,
        },
    }

# ──────────────────────── Slot routes ────────────────────────────

@router.get("", response_model=dict)
@router.get("/", response_model=dict)
async def get_timetable_slots(
    grade_level: Optional[str] = None,
    teacher_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    token_data=Depends(get_current_user),
    current_school: School = Depends(get_current_school),
):
    user: User = token_data[0]

    membership_result = await db.execute(
        select(school_users.c.role).where(
            school_users.c.user_id == user.id,
            school_users.c.school_id == current_school.id,
        )
    )
    membership = membership_result.first()
    role = _extract_role(membership[0] if membership else None)
    
    if user.is_super_admin:
        role = "super_admin"

    query = (
        select(
            TimetableSlot,
            Course.name.label("subject_name"),
            User.full_name.label("teacher_name"),
        )
        .join(Course, TimetableSlot.subject_id == Course.id)
        .join(User, TimetableSlot.teacher_id == User.id, isouter=True)
        .where(TimetableSlot.school_id == current_school.id)
    )

    if role == "teacher":
        query = query.where(TimetableSlot.teacher_id == user.id)
    elif role in ("admin", "super_admin", "timetable_manager", "registrar", "hod"):
        if teacher_id:
            query = query.where(TimetableSlot.teacher_id == teacher_id)

    if grade_level:
        query = query.where(TimetableSlot.grade_level == grade_level)

    result = await db.execute(query)
    rows = result.all()

    slots_data = [
        {
            "id": slot.id,
            "school_id": slot.school_id,
            "course_id": slot.subject_id,
            "course_name": sub_name,
            "teacher_id": slot.teacher_id,
            "teacher_name": teacher_name or "Unassigned",
            "day_of_week": (slot.day_of_week or "").lower(),
            "start_time": slot.start_time,
            "end_time": slot.end_time,
            "classroom": slot.room or "",
            "grade": slot.grade_level,
            "period_id": slot.id,
            "period_name": f"{slot.start_time}–{slot.end_time}",
            "is_break": False,
        }
        for slot, sub_name, teacher_name in rows
    ]

    return {"success": True, "data": slots_data}

@router.post("", response_model=dict)
@router.post("/", response_model=dict)
async def create_timetable_slot(
    data: TimetableSlotCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    token_data=Depends(get_current_user),
):
    user = token_data[0]
    await verify_timetable_manager(db, user, current_school.id)

    conflict_q = select(TimetableSlot).where(
        TimetableSlot.school_id == current_school.id,
        TimetableSlot.day_of_week == data.day_of_week,
        TimetableSlot.grade_level == data.grade_level,
        TimetableSlot.start_time < data.end_time,
        TimetableSlot.end_time > data.start_time,
    )
    if (await db.execute(conflict_q)).scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Schedule conflict: another subject is already at this time for this grade.",
        )

    slot = TimetableSlot(
        school_id=current_school.id,
        subject_id=data.subject_id,
        teacher_id=data.teacher_id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
        room=data.room,
        grade_level=data.grade_level,
    )
    db.add(slot)
    await db.commit()
    await db.refresh(slot)
    return {"success": True, "data": {"id": slot.id}, "message": "Timetable slot created"}

# /{slot_id} routes — registered LAST so "periods" isn't swallowed as a param

@router.put("/{slot_id}", response_model=dict)
@router.put("/{slot_id}/", response_model=dict)
async def update_timetable_slot(
    slot_id: int,
    data: TimetableSlotUpdate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    token_data=Depends(get_current_user),
):
    user = token_data[0]
    await verify_timetable_manager(db, user, current_school.id)

    result = await db.execute(
        select(TimetableSlot).where(
            TimetableSlot.id == slot_id,
            TimetableSlot.school_id == current_school.id,
        )
    )
    slot = result.scalar_one_or_none()
    if not slot:
        raise HTTPException(status_code=404, detail="Timetable slot not found")

    for field, value in data.dict(exclude_unset=True).items():
        setattr(slot, field, value)

    await db.commit()
    await db.refresh(slot)
    return {"success": True, "message": "Timetable slot updated"}

@router.delete("/{slot_id}", response_model=dict)
@router.delete("/{slot_id}/", response_model=dict)
async def delete_timetable_slot(
    slot_id: int,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    token_data=Depends(get_current_user),
):
    user = token_data[0]
    await verify_timetable_manager(db, user, current_school.id)
    
    result = await db.execute(
        delete(TimetableSlot).where(
            TimetableSlot.id == slot_id,
            TimetableSlot.school_id == current_school.id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Timetable slot not found")
    return {"success": True, "message": "Slot removed from timetable"}