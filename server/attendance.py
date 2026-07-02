from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from pydantic import BaseModel
from datetime import date as date_type, datetime

from database import get_db
from models import Attendance, Student, School
from auth import get_current_school, get_current_user

# Prefix aligns with frontend fetch calls to /api/teacher/attendance
router = APIRouter(prefix="/teacher/attendance", tags=["Attendance"])

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

# Matches shape expected inside the React TeacherDashboard roster payload
class RosterStudent(BaseModel):
    id: str
    name: str
    grade: Optional[str] = None
    classSection: Optional[str] = None
    status: str
    recordedAt: Optional[str] = None

# Matches shape POSTed by saveAttendance() on frontend
class AttendanceEntry(BaseModel):
    studentId: int       # camelCase matching frontend state serialization
    status: str

class SaveAttendancePayload(BaseModel):
    date: str
    attendance: List[AttendanceEntry]

# ─── Configuration ─────────────────────────────────────────────────────────────

VALID_STATUSES = ["Present", "Absent", "Late", "Excused", "Not Marked"]

# ─── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/roster")
async def get_attendance_roster(
    date: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    token_data: tuple = Depends(get_current_user),
):
    """
    GET /api/teacher/attendance/roster?date=YYYY-MM-DD
    Returns all students tied to the current school tenant with their attendance statuses.
    """
    try:
        roster_date = date_type.fromisoformat(date) if date else datetime.utcnow().date()
    except (ValueError, TypeError):
        roster_date = datetime.utcnow().date()

    # Get all students for this school ordered alphabetically
    students_result = await db.execute(
        select(Student).where(Student.school_id == current_school.id).order_by(Student.last_name)
    )
    students = students_result.scalars().all()

    # Get existing logs for the selected date
    att_result = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.school_id == current_school.id,
                Attendance.date == roster_date
            )
        )
    )
    existing = {str(a.student_id): a for a in att_result.scalars().all()}

    roster = []
    for s in students:
        sid = str(s.id)
        att = existing.get(sid)
        roster.append({
            "id": sid,
            "name": f"{s.first_name} {s.last_name}",
            "grade": getattr(s, "grade", None) or "",
            "classSection": getattr(s, "class_section", None) or "",
            "status": att.status.capitalize() if att else "Not Marked",
            "recordedAt": att.date.isoformat() if att else None,
        })

    return {
        "students": roster,
        "statuses": VALID_STATUSES,
        "date": roster_date.isoformat(),
    }


@router.post("")
@router.post("/")
@router.post("/save")
async def save_teacher_attendance(
    payload: SaveAttendancePayload,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
):
    """
    POST /api/teacher/attendance
    Upserts one Attendance record per student per date to avoid duplicates on re-submission.
    """
    try:
        record_date = date_type.fromisoformat(payload.date)
    except ValueError:
        record_date = datetime.utcnow().date()

    # Tenant sandbox check: ensure student IDs belong to this school
    valid_result = await db.execute(
        select(Student.id).where(Student.school_id == current_school.id)
    )
    valid_ids = {row[0] for row in valid_result.all()}

    saved = 0
    for entry in payload.attendance:
        if entry.studentId not in valid_ids:
            continue  # Silently drop data pollution across sub-tenants

        status = entry.status.capitalize()
        if status not in VALID_STATUSES:
            status = "Present"

        # Lookup existing entry for safe atomic mutations
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

    # Re-fetch the layout roster snapshot to provide instant UI hydration after updates
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
            "classSection": getattr(s, "class_section", None) or "",
            "status": att.status.capitalize() if att else "Not Marked",
            "recordedAt": att.date.isoformat() if att else None,
        })

    return {
        "success": True,
        "message": f"Saved {saved} attendance records successfully",
        "students": roster,
        "statuses": VALID_STATUSES,
    }