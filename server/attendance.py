from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from pydantic import BaseModel
from datetime import date as date_type, datetime

from database import get_db
from models import Attendance, Student, School
from auth import get_current_school, get_current_user

router = APIRouter(prefix="/attendance", tags=["Attendance"])

# ─── Schemas ────────────────────────────────────────────────────────────────────

class AttendanceCreate(BaseModel):
    student_id: int
    status: str          # PRESENT, ABSENT, LATE, EXCUSED
    notes: Optional[str] = None
    date: Optional[date_type] = None

class AttendanceResponse(BaseModel):
    id: int
    student_id: int
    date: date_type
    status: str
    notes: Optional[str]
    class Config:
        from_attributes = True

# The shape the TeacherDashboard's loadRoster() expects inside the envelope
class RosterStudent(BaseModel):
    id: str
    name: str
    grade: Optional[str] = None
    classSection: Optional[str] = None
    status: str
    recordedAt: Optional[str] = None

# The shape saveAttendance() POSTs
class AttendanceEntry(BaseModel):
    studentId: int       # camelCase — matches what the frontend sends
    status: str

class SaveAttendancePayload(BaseModel):
    date: str
    attendance: List[AttendanceEntry]

# ─── Routes ─────────────────────────────────────────────────────────────────────

VALID_STATUSES = ["Present", "Absent", "Late", "Excused", "Not Marked"]


@router.get("/roster")
async def get_attendance_roster(
    date: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    token_data: tuple = Depends(get_current_user),
):
    """
    GET /api/attendance/teacher/attendance/roster?date=YYYY-MM-DD
    Returns every student in the school with their attendance status for that date.
    Frontend (TeacherDashboard) consumes: { students: RosterStudent[], statuses: str[] }
    """
    # Parse the requested date (default today)
    try:
        roster_date = date_type.fromisoformat(date) if date else datetime.utcnow().date()
    except (ValueError, TypeError):
        roster_date = datetime.utcnow().date()

    # All students for this school
    students_result = await db.execute(
        select(Student).where(Student.school_id == current_school.id).order_by(Student.last_name)
    )
    students = students_result.scalars().all()

    # Existing attendance records for that date
    att_result = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.school_id == current_school.id,
                Attendance.date == roster_date
            )
        )
    )
    # keyed by student_id string for easy lookup
    existing = {str(a.student_id): a for a in att_result.scalars().all()}

    roster = []
    for s in students:
        sid = str(s.id)
        att = existing.get(sid)
        roster.append({
            "id": sid,
            "name": f"{s.first_name} {s.last_name}",
            "grade": getattr(s, "grade", None) or "",
            # Student model has no class_section column — leave blank for now
            "classSection": "",
            "status": att.status.capitalize() if att else "Not Marked",
            "recordedAt": att.date.isoformat() if att else None,
        })

    return {
        "students": roster,
        "statuses": VALID_STATUSES,
        "date": roster_date.isoformat(),
    }


@router.post("/save")
async def save_teacher_attendance(
    payload: SaveAttendancePayload,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
):
    """
    POST /api/attendance/teacher/attendance
    Body: { date: 'YYYY-MM-DD', attendance: [{ studentId, status }] }
    Upserts one Attendance row per student per date — re-submitting the same date
    updates the existing record rather than duplicating.
    """
    try:
        record_date = date_type.fromisoformat(payload.date)
    except ValueError:
        record_date = datetime.utcnow().date()

    # Build set of valid student ids for this school (security check)
    valid_result = await db.execute(
        select(Student.id).where(Student.school_id == current_school.id)
    )
    valid_ids = {row[0] for row in valid_result.all()}

    saved = 0
    for entry in payload.attendance:
        if entry.studentId not in valid_ids:
            continue  # silently skip students not belonging to this school

        status = entry.status.capitalize()
        if status not in VALID_STATUSES:
            status = "Present"

        # Upsert: update if exists, otherwise insert
        existing_result = await db.execute(
            select(Attendance).where(
                and_(
                    Attendance.student_id == entry.studentId,
                    Attendance.date == record_date,
                    Attendance.school_id == current_school.id,
                )
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            existing.status = status
        else:
            db.add(Attendance(
                school_id=current_school.id,
                student_id=entry.studentId,
                status=status,
                date=record_date,
            ))
        saved += 1

    await db.commit()

    # Return the refreshed roster so the UI updates immediately after saving
    att_result = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.school_id == current_school.id,
                Attendance.date == record_date,
            )
        )
    )
    refreshed = {str(a.student_id): a for a in att_result.scalars().all()}

    students_result = await db.execute(
        select(Student).where(Student.school_id == current_school.id).order_by(Student.last_name)
    )
    roster = []
    for s in students_result.scalars().all():
        sid = str(s.id)
        att = refreshed.get(sid)
        roster.append({
            "id": sid,
            "name": f"{s.first_name} {s.last_name}",
            "grade": getattr(s, "grade", None) or "",
            "classSection": "",
            "status": att.status.capitalize() if att else "Not Marked",
            "recordedAt": att.date.isoformat() if att else None,
        })

    return {
        "success": True,
        "message": f"Saved {saved} attendance records",
        "students": roster,
        "statuses": VALID_STATUSES,
    }


# ─── Legacy batch route (kept for backwards compat) ─────────────────────────────

@router.post("")
@router.post("/")
async def record_attendance_batch(
    records: List[AttendanceCreate],
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
):
    """Batch record attendance (original route kept for compatibility)"""
    today = datetime.utcnow().date()
    for entry in records:
        stud = await db.execute(
            select(Student).where(Student.id == entry.student_id, Student.school_id == current_school.id)
        )
        if not stud.scalar_one_or_none():
            continue
        db.add(Attendance(
            school_id=current_school.id,
            student_id=entry.student_id,
            status=entry.status,
            notes=entry.notes,
            date=entry.date or today,
        ))
    await db.commit()
    return {"message": f"Recorded {len(records)} attendance entries"}


@router.get("/student/{student_id}", response_model=List[AttendanceResponse])
async def get_student_attendance(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
):
    """Attendance history for one student"""
    stud = await db.execute(
        select(Student).where(Student.id == student_id, Student.school_id == current_school.id)
    )
    if not stud.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Student not found")

    result = await db.execute(
        select(Attendance)
        .where(Attendance.student_id == student_id)
        .order_by(Attendance.date.desc())
    )
    return result.scalars().all()