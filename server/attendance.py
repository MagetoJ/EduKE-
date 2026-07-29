from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from pydantic import BaseModel
from datetime import date as date_type, datetime

from database import get_db
from models import Attendance, Student, School, User
from models_roles import ClassTeacherAssignment
from auth import get_current_school, get_current_user, require_roles

# Prefix aligns with frontend fetch calls to /api/teacher/attendance
router = APIRouter(prefix="/teacher/attendance", tags=["Attendance"])

# _get_scoped_student_query already restricts results to the calling
# teacher's own homeroom/subject classes, so a parent/student account
# hitting these routes wouldn't see anyone else's data — but they
# shouldn't be able to call a teacher-facing endpoint at all. This guard
# is defense-in-depth, not a fix for a data leak.
ATTENDANCE_STAFF_ROLES = ("teacher", "class_teacher", "hod", "admin", "super_admin")

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

# ─── Helpers ────────────────────────────────────────────────────────────────────

async def _get_scoped_student_query(db: AsyncSession, teacher: User, school_id: int):
    """
    Attendance is taken per-homeroom, so scope the roster to the teacher's own
    managed stream instead of the whole school. Falls back to every class the
    teacher teaches a subject in if they aren't a class teacher, so the page
    still works (rather than silently showing nothing) for subject teachers.
    """
    from models_roles import ClassSubjectAssignment

    homeroom_res = await db.execute(
        select(ClassTeacherAssignment).where(
            ClassTeacherAssignment.teacher_id == teacher.id,
            ClassTeacherAssignment.school_id == school_id,
        )
    )
    homeroom = homeroom_res.scalar_one_or_none()
    if homeroom:
        return select(Student).where(
            Student.school_id == school_id,
            Student.grade == homeroom.grade_level,
            Student.stream_section == homeroom.stream_section,
            Student.status == "active",
        ).order_by(Student.last_name)

    subject_res = await db.execute(
        select(ClassSubjectAssignment.grade_level, ClassSubjectAssignment.stream_section).where(
            ClassSubjectAssignment.teacher_id == teacher.id,
            ClassSubjectAssignment.school_id == school_id,
        )
    )
    scopes = subject_res.all()
    if not scopes:
        # No known classes for this teacher -- return an impossible filter
        # rather than the whole school's roster.
        return select(Student).where(Student.id == -1)

    conditions = [
        and_(Student.grade == grade, Student.stream_section == stream)
        for grade, stream in scopes
    ]
    from sqlalchemy import or_
    return select(Student).where(
        Student.school_id == school_id,
        Student.status == "active",
        or_(*conditions),
    ).order_by(Student.last_name)


# ─── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/roster")
async def get_attendance_roster(
    date: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    token_data: tuple = Depends(get_current_user),
    _: User = Depends(require_roles(*ATTENDANCE_STAFF_ROLES)),
):
    """
    GET /api/teacher/attendance/roster?date=YYYY-MM-DD
    Returns the students in the current teacher's own homeroom/classes, with
    their attendance status for the given date.
    """
    teacher, _ = token_data
    try:
        roster_date = date_type.fromisoformat(date) if date else datetime.utcnow().date()
    except (ValueError, TypeError):
        roster_date = datetime.utcnow().date()

    students_result = await db.execute(await _get_scoped_student_query(db, teacher, current_school.id))
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
            "classSection": getattr(s, "stream_section", None) or "",
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
    token_data: tuple = Depends(get_current_user),
    _: User = Depends(require_roles(*ATTENDANCE_STAFF_ROLES)),
):
    """
    POST /api/teacher/attendance
    Upserts one Attendance record per student per date to avoid duplicates on re-submission.
    """
    teacher, _ = token_data
    try:
        record_date = date_type.fromisoformat(payload.date)
    except ValueError:
        record_date = datetime.utcnow().date()

    # Tenant + roster sandbox check: only allow marking students in this
    # teacher's own scope, not arbitrary student IDs from elsewhere.
    scoped_result = await db.execute(await _get_scoped_student_query(db, teacher, current_school.id))
    valid_ids = {s.id for s in scoped_result.scalars().all()}

    saved = 0
    for entry in payload.attendance:
        if entry.studentId not in valid_ids:
            continue  # Silently drop data pollution across sub-tenants / other classes

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

    students_result = await db.execute(await _get_scoped_student_query(db, teacher, current_school.id))

    roster = []
    for s in students_result.scalars().all():
        sid = str(s.id)
        att = refreshed.get(sid)
        roster.append({
            "id": sid,
            "name": f"{s.first_name} {s.last_name}",
            "grade": getattr(s, "grade", None) or "",
            "classSection": getattr(s, "stream_section", None) or "",
            "status": att.status.capitalize() if att else "Not Marked",
            "recordedAt": att.date.isoformat() if att else None,
        })

    return {
        "success": True,
        "message": f"Saved {saved} attendance records successfully",
        "students": roster,
        "statuses": VALID_STATUSES,
    }