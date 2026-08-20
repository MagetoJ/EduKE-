import random
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

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

class GenerateTimetableRequest(BaseModel):
    clear_existing: bool = True

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
    workflow at all, anywhere in the school."""
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
    the HOD already assigned for that class.
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
        return teacher_id

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
    Checks every kind of double-booking a single slot can cause:
      1. Class conflict
      2. Teacher conflict
      3. Room conflict
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

    # 1. Class conflict
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

    # 2. Teacher conflict
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

    # 3. Room conflict
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

# ────────────────────── Automatic Generation ──────────────────────

@router.post("/generate", response_model=dict)
@router.post("/generate/", response_model=dict)
async def generate_automatic_timetable(
    payload: Optional[GenerateTimetableRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    token_data=Depends(get_current_user),
):
    user = token_data[0]
    await verify_timetable_manager(db, user, current_school.id)

    should_clear = payload.clear_existing if payload else True

    # Step 1: Wipe existing timetable slots if requested
    if should_clear:
        await db.execute(
            delete(TimetableSlot).where(TimetableSlot.school_id == current_school.id)
        )
        await db.commit()

    # Step 2: Fetch HOD-approved class assignments for this school
    assignment_q = (
        select(ClassSubjectAssignment)
        .join(Course, ClassSubjectAssignment.course_id == Course.id)
        .where(Course.school_id == current_school.id)
    )
    assignments = (await db.execute(assignment_q)).scalars().all()

    if not assignments:
        raise HTTPException(
            status_code=400,
            detail="Cannot auto-generate timetable: No HOD-approved class subject assignments found. Please assign subjects to teachers first.",
        )

    # Step 3: Retrieve or establish time periods
    period_resp = await get_periods(db=db, current_school=current_school)
    time_periods = [p for p in period_resp.get("data", []) if not p.get("is_break")]

    if not time_periods:
        raise HTTPException(
            status_code=400,
            detail="Cannot auto-generate timetable: No valid non-break time periods found.",
        )

    days = ["monday", "tuesday", "wednesday", "thursday", "friday"]

    # Group assignments by class key (grade_level, stream_section)
    classes_map = {}
    for assign in assignments:
        key = (assign.grade_level, assign.stream_section or "")
        if key not in classes_map:
            classes_map[key] = []
        classes_map[key].append(assign)

    created_slots_count = 0
    failed_assignments_count = 0

    # Local conflict trackers: (day, start, end, identifier)
    busy_classes = set()
    busy_teachers = set()
    busy_rooms = set()

    # Step 4: Run allocation algorithm
    for (grade_level, stream_section), class_assigns in classes_map.items():
        # Distribute classes evenly across weekdays
        for day in days:
            daily_pool = list(class_assigns)
            random.shuffle(daily_pool)

            for period in time_periods:
                start = period["start_time"]
                end = period["end_time"]
                class_key = (day, start, end, grade_level, stream_section)

                if class_key in busy_classes:
                    continue  # Class already scheduled for this period

                # Find an assignment whose teacher and class are free
                selected = None
                for assign in daily_pool:
                    teacher_key = (day, start, end, assign.teacher_id) if assign.teacher_id else None
                    if teacher_key and teacher_key in busy_teachers:
                        continue  # Teacher is busy elsewhere

                    selected = assign
                    break

                if selected:
                    room_name = f"Room {grade_level} {stream_section}".strip()
                    room_key = (day, start, end, room_name)

                    if room_key in busy_rooms:
                        room_name = None  # Clear room if occupied

                    slot = TimetableSlot(
                        school_id=current_school.id,
                        subject_id=selected.course_id,
                        teacher_id=selected.teacher_id,
                        day_of_week=day,
                        start_time=start,
                        end_time=end,
                        room=room_name,
                        grade_level=grade_level,
                        stream_section=stream_section,
                    )
                    db.add(slot)
                    created_slots_count += 1

                    # Update trackers
                    busy_classes.add(class_key)
                    if selected.teacher_id:
                        busy_teachers.add((day, start, end, selected.teacher_id))
                    if room_name:
                        busy_rooms.add(room_key)
                else:
                    failed_assignments_count += 1

    await db.commit()

    return {
        "success": True,
        "message": f"Auto-generated {created_slots_count} timetable slots successfully.",
        "slots_created": created_slots_count,
        "unresolvable_slots": failed_assignments_count,
    }

# ──────────────────────── Clear timetable ──────────────────────────

@router.delete("/clear", response_model=dict)
@router.delete("/clear/", response_model=dict)
async def clear_timetable(
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    token_data=Depends(get_current_user),
):
    user = token_data[0]
    await verify_timetable_manager(db, user, current_school.id)

    result = await db.execute(
        delete(TimetableSlot).where(TimetableSlot.school_id == current_school.id)
    )
    await db.commit()

    return {
        "success": True,
        "message": "Entire timetable schedule cleared successfully.",
        "deleted_count": result.rowcount,
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

# /{slot_id} routes — registered LAST so static routes are not swallowed as params

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

    if {"subject_id", "teacher_id", "grade_level", "stream_section"} & updates.keys():
        slot.teacher_id = await _resolve_teacher_against_assignment(
            db, slot.school_id, slot.subject_id, slot.grade_level,
            slot.stream_section or "", slot.teacher_id
        )

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