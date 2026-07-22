from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from typing import Optional
from pydantic import BaseModel

from database import get_db
from models import TimetableSlot, School, Course, User, school_users
from models_roles import ClassSubjectAssignment
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
    stream_section: Optional[str] = ""

class TimetableSlotUpdate(BaseModel):
    subject_id: Optional[int] = None
    teacher_id: Optional[int] = None
    day_of_week: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    room: Optional[str] = None
    grade_level: Optional[str] = None
    stream_section: Optional[str] = None

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


async def _find_class_assignment(
    db: AsyncSession, school_id: int, course_id: int, grade_level: str, stream_section: str
) -> Optional[ClassSubjectAssignment]:
    """Looks up the HOD-approved (subject, class, teacher) assignment for this
    exact course + grade + stream, if one exists."""
    result = await db.execute(
        select(ClassSubjectAssignment)
        .join(Course, ClassSubjectAssignment.course_id == Course.id)
        .where(
            Course.school_id == school_id,
            ClassSubjectAssignment.course_id == course_id,
            ClassSubjectAssignment.grade_level == grade_level,
            ClassSubjectAssignment.stream_section == (stream_section or ""),
        )
    )
    return result.scalar_one_or_none()


async def _course_has_any_class_assignments(db: AsyncSession, school_id: int, course_id: int) -> bool:
    """Whether this subject has been routed through the HOD class-assignment
    workflow at all, anywhere in the school. Used to decide whether to
    enforce a match (subject is "on the system") or fall back to the old,
    free-pick behavior (subject predates/skips that workflow)."""
    result = await db.execute(
        select(ClassSubjectAssignment.id)
        .join(Course, ClassSubjectAssignment.course_id == Course.id)
        .where(Course.school_id == school_id, ClassSubjectAssignment.course_id == course_id)
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _resolve_teacher_against_assignment(
    db: AsyncSession, school_id: int, course_id: int, grade_level: str,
    stream_section: str, teacher_id: Optional[int]
) -> Optional[int]:
    """
    Enforces that a timetable slot's (subject, teacher) can't drift from what
    the HOD already assigned for that class. Returns the teacher_id to save
    (auto-filled from the assignment when the caller didn't supply one), or
    raises a 400 if the caller supplied a teacher that contradicts it.

    If the subject has never been through the class-assignment workflow at
    all (no HOD has assigned it to any class), this is a no-op that returns
    teacher_id unchanged -- so schools/subjects not yet using that workflow
    keep working exactly as before.
    """
    assignment = await _find_class_assignment(db, school_id, course_id, grade_level, stream_section)

    if assignment is None:
        if await _course_has_any_class_assignments(db, school_id, course_id):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"This subject has no HOD-approved teacher assignment for "
                    f"{grade_level}{(' ' + stream_section) if stream_section else ''}. "
                    f"Ask the department HOD to assign a teacher to this class first."
                ),
            )
        return teacher_id  # subject isn't on the class-assignment workflow at all -- allow freely

    if teacher_id is not None and teacher_id != assignment.teacher_id:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Teacher mismatch: the HOD assigned this subject for "
                f"{grade_level}{(' ' + stream_section) if stream_section else ''} to a different "
                f"teacher. Pick that assignment instead of a different teacher."
            ),
        )

    return assignment.teacher_id

async def _check_schedule_conflicts(
    db: AsyncSession, school_id: int, day_of_week: str, start_time: str, end_time: str,
    grade_level: str, stream_section: str, teacher_id: Optional[int], room: Optional[str],
    exclude_slot_id: Optional[int] = None,
):
    """
    Checks every kind of double-booking a single slot can cause, all at once:
      1. Class conflict  -- this grade+stream already has something else at this time.
      2. Teacher conflict -- this teacher is already teaching a DIFFERENT class at this time.
      3. Room conflict    -- this room is already in use by a DIFFERENT class at this time
                             (only checked when a room was actually specified).

    Previously only #1 was checked, which meant a teacher (or room) could be
    double-booked across two different grades/streams and nothing would catch it.
    Raises a 400 with a specific, actionable message for whichever check fails first.
    """
    overlap = (
        TimetableSlot.school_id == school_id,
        TimetableSlot.day_of_week == day_of_week,
        TimetableSlot.start_time < end_time,
        TimetableSlot.end_time > start_time,
    )

    def _exclude(q):
        if exclude_slot_id is not None:
            q = q.where(TimetableSlot.id != exclude_slot_id)
        return q

    # 1. Class conflict (same grade + stream)
    class_q = _exclude(select(TimetableSlot).where(
        *overlap,
        TimetableSlot.grade_level == grade_level,
        TimetableSlot.stream_section == stream_section,
    ))
    if (await db.execute(class_q)).scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Schedule conflict: another subject is already at this time for this class.",
        )

    # 2. Teacher conflict (same teacher, any other class)
    if teacher_id:
        teacher_q = _exclude(select(TimetableSlot).where(*overlap, TimetableSlot.teacher_id == teacher_id))
        clash = (await db.execute(teacher_q)).scalar_one_or_none()
        if clash:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Teacher conflict: this teacher is already scheduled to teach "
                    f"{clash.grade_level}{(' ' + clash.stream_section) if clash.stream_section else ''} "
                    f"at this time."
                ),
            )

    # 3. Room conflict (same room, any other class) -- skip if no room given
    if room and room.strip():
        room_q = _exclude(select(TimetableSlot).where(*overlap, TimetableSlot.room == room))
        clash = (await db.execute(room_q)).scalar_one_or_none()
        if clash:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Room conflict: {room} is already booked for "
                    f"{clash.grade_level}{(' ' + clash.stream_section) if clash.stream_section else ''} "
                    f"at this time."
                ),
            )

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

# ─────────────────── Class-assignment lookup route ───────────────
# Powers the timetable builder's subject/teacher picker: instead of letting
# whoever builds the timetable re-pick a teacher freely (which can silently
# drift from what the HOD already assigned), the frontend fetches the real
# (subject, teacher) pairs the HOD approved for the grade/stream being
# scheduled, scoped to the WHOLE school (unlike /api/hod/class-assignments,
# which is scoped to one HOD's own department).

@router.get("/class-assignments", response_model=dict)
@router.get("/class-assignments/", response_model=dict)
async def get_timetable_class_assignments(
    grade_level: Optional[str] = None,
    stream_section: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    token_data=Depends(get_current_user),
):
    query = (
        select(ClassSubjectAssignment)
        .options(
            selectinload(ClassSubjectAssignment.course),
            selectinload(ClassSubjectAssignment.teacher),
        )
        .join(Course, ClassSubjectAssignment.course_id == Course.id)
        .where(Course.school_id == current_school.id)
    )
    if grade_level:
        query = query.where(ClassSubjectAssignment.grade_level == grade_level)
    if stream_section is not None:
        query = query.where(ClassSubjectAssignment.stream_section == stream_section)

    result = await db.execute(query.order_by(ClassSubjectAssignment.grade_level, ClassSubjectAssignment.stream_section))
    rows = result.scalars().all()

    return {
        "success": True,
        "data": [
            {
                "id": r.id,
                "course_id": r.course_id,
                "course_name": r.course.name if r.course else "Unknown",
                "course_code": r.course.code if r.course else None,
                "teacher_id": r.teacher_id,
                "teacher_name": r.teacher.full_name if r.teacher else "Unknown",
                "grade_level": r.grade_level,
                "stream_section": r.stream_section,
            }
            for r in rows
        ],
    }

# ──────────────────────── Slot routes ────────────────────────────

@router.get("", response_model=dict)
@router.get("/", response_model=dict)
async def get_timetable_slots(
    grade_level: Optional[str] = None,
    class_section: Optional[str] = None,
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
    if class_section:
        query = query.where(TimetableSlot.stream_section == class_section)

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
            "class_section": slot.stream_section or "",
            "period_id": slot.id,
            "period_name": f"{slot.start_time}–{slot.end_time}",
            "is_break": False,
        }
        for slot, sub_name, teacher_name in rows
    ]

    return {"success": True, "data": slots_data}

@router.post("", response_model=dict)
@router.post("/", response_model=dict)
@router.post("/slots")
async def create_timetable_slot(
    data: TimetableSlotCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    token_data=Depends(get_current_user),
):
    user = token_data[0]
    await verify_timetable_manager(db, user, current_school.id)

    stream_section = data.stream_section or ""

    # Resolve the teacher against the HOD's class assignment FIRST, so that if
    # teacher_id was omitted and auto-filled from the assignment, the conflict
    # check below checks the real teacher who will end up on this slot.
    resolved_teacher_id = await _resolve_teacher_against_assignment(
        db, current_school.id, data.subject_id, data.grade_level, stream_section, data.teacher_id
    )

    await _check_schedule_conflicts(
        db, current_school.id, data.day_of_week, data.start_time, data.end_time,
        data.grade_level, stream_section, resolved_teacher_id, data.room,
    )

    slot = TimetableSlot(
        school_id=current_school.id,
        subject_id=data.subject_id,
        teacher_id=resolved_teacher_id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
        room=data.room,
        grade_level=data.grade_level,
        stream_section=stream_section,
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

    updates = data.dict(exclude_unset=True)
    for field, value in updates.items():
        setattr(slot, field, value)

    # Re-validate against the class assignment whenever any field that
    # affects the (subject, class, teacher) match changed, using the slot's
    # now-updated values so a partial update (e.g. only teacher_id) is
    # checked against the correct subject/grade/stream too.
    if {"subject_id", "teacher_id", "grade_level", "stream_section"} & updates.keys():
        slot.teacher_id = await _resolve_teacher_against_assignment(
            db, slot.school_id, slot.subject_id, slot.grade_level,
            slot.stream_section or "", slot.teacher_id
        )

    # Re-run the full conflict check (class/teacher/room) whenever any field
    # that could introduce a new clash changed, using the slot's merged,
    # post-update values -- excluding itself so it doesn't "conflict" with
    # its own pre-update row.
    if {"day_of_week", "start_time", "end_time", "grade_level", "stream_section",
        "teacher_id", "room"} & updates.keys():
        await _check_schedule_conflicts(
            db, slot.school_id, slot.day_of_week, slot.start_time, slot.end_time,
            slot.grade_level, slot.stream_section or "", slot.teacher_id, slot.room,
            exclude_slot_id=slot.id,
        )

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