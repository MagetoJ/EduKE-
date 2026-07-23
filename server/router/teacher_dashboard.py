from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional

from database import get_db
from auth import get_current_user, get_current_school, require_roles
from models import (
    User, School, Course, Student, LeaveRequest,
    ClassProgressReport, ProgressReportComment,
)
from models_roles import ClassSubjectAssignment, ClassTeacherAssignment
from models_class_teacher import StudentWelfareEscalation
from reporting import get_teacher_hods
from pydantic import BaseModel

router = APIRouter(prefix="/api/teacher-dashboard", tags=["Teacher Dashboard"])

# --- PYDANTIC SCHEMAS ---

class SubjectAssignmentResponse(BaseModel):
    class_name: str
    subject_name: str
    subject_code: Optional[str]

class HomeroomResponse(BaseModel):
    class_name: str
    grade_level: str
    stream_section: Optional[str]
    total_students: int

class HODContact(BaseModel):
    id: int
    name: str
    email: str
    department: str

class ProgressReportSummary(BaseModel):
    id: int
    course_name: str
    week_start_date: str
    coverage_percent: int
    comment_count: int

class EscalationSummary(BaseModel):
    id: int
    student_name: str
    reason: str
    status: str
    created_at: str

class LeaveRequestSummary(BaseModel):
    id: int
    leave_type: str
    start_date: str
    end_date: str
    status: str

class TeacherDashboardOverview(BaseModel):
    is_class_teacher: bool
    homeroom: Optional[HomeroomResponse]
    teaching_subjects: List[SubjectAssignmentResponse]
    reports_to: List[HODContact]
    reports_to_is_fallback: bool
    recent_progress_reports: List[ProgressReportSummary]
    recent_escalations: List[EscalationSummary]
    recent_leave_requests: List[LeaveRequestSummary]

# --- API ROUTES ---

@router.get("/overview", response_model=TeacherDashboardOverview)
async def get_teacher_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("teacher", "class_teacher")),
    current_school: School = Depends(get_current_school)
):
    """
    Fetches the dashboard overview for the logged-in teacher.
    Separates their role as a subject teacher from their role as a class teacher.
    """

    # 1. Fetch Subject Teaching Assignments (Regular Teacher Role)
    # ClassSubjectAssignment already carries grade_level/stream_section directly
    # (it's scoped to a class, not linked through a separate SchoolClass row),
    # and links to the subject via Course, not a standalone Subject table.
    subjects_query = await db.execute(
        select(ClassSubjectAssignment, Course)
        .join(Course, Course.id == ClassSubjectAssignment.course_id)
        .where(
            ClassSubjectAssignment.teacher_id == current_user.id,
            ClassSubjectAssignment.school_id == current_school.id
        )
    )

    teaching_subjects = []
    for assignment, course in subjects_query.all():
        teaching_subjects.append({
            "class_name": f"{assignment.grade_level} {assignment.stream_section or ''}".strip(),
            "subject_name": course.name,
            "subject_code": course.code
        })

    # 2. Fetch Class Teacher Assignment (Homeroom Role)
    # Same story: ClassTeacherAssignment stores grade_level/stream_section
    # directly, there's no class_id FK to join through.
    homeroom_query = await db.execute(
        select(ClassTeacherAssignment).where(
            ClassTeacherAssignment.teacher_id == current_user.id,
            ClassTeacherAssignment.school_id == current_school.id
        )
    )
    homeroom = homeroom_query.scalar_one_or_none()

    homeroom_data = None
    is_class_teacher = False

    if homeroom:
        is_class_teacher = True

        # Count how many active students are in this homeroom
        count_query = await db.execute(
            select(func.count(Student.id)).where(
                Student.grade == homeroom.grade_level,
                Student.stream_section == homeroom.stream_section,
                Student.school_id == current_school.id,
                Student.status == "active"
            )
        )
        total_students = count_query.scalar() or 0

        homeroom_data = {
            "class_name": f"{homeroom.grade_level} {homeroom.stream_section or ''}".strip(),
            "grade_level": homeroom.grade_level,
            "stream_section": homeroom.stream_section,
            "total_students": total_students
        }

    # 3. Who does this teacher report to?
    # Every teacher - subject teacher or class teacher - reports to an HOD.
    # Class teachers are assigned their homeroom by the Admin (no department
    # link on that assignment at all), so get_teacher_hods() falls back to
    # every HOD in the school if it can't find a specific department for
    # them. reports_to_is_fallback tells the frontend which case it's in.
    hods, is_fallback = await get_teacher_hods(db, current_user.id, current_school.id)

    # 4. Recent activity - what this teacher has filed, and how it's going.
    reports_res = await db.execute(
        select(ClassProgressReport, Course.name)
        .join(Course, Course.id == ClassProgressReport.course_id)
        .where(ClassProgressReport.teacher_id == current_user.id)
        .order_by(ClassProgressReport.created_at.desc())
        .limit(5)
    )
    recent_progress_reports = []
    for report, course_name in reports_res.all():
        comment_count_res = await db.execute(
            select(func.count(ProgressReportComment.id)).where(
                ProgressReportComment.report_id == report.id
            )
        )
        recent_progress_reports.append({
            "id": report.id,
            "course_name": course_name,
            "week_start_date": report.week_start_date.strftime("%Y-%m-%d"),
            "coverage_percent": report.syllabus_coverage_percent,
            "comment_count": comment_count_res.scalar() or 0,
        })

    recent_escalations = []
    if is_class_teacher:
        escalations_res = await db.execute(
            select(StudentWelfareEscalation, Student)
            .join(Student, Student.id == StudentWelfareEscalation.student_id)
            .where(StudentWelfareEscalation.escalated_by == current_user.id)
            .order_by(StudentWelfareEscalation.created_at.desc())
            .limit(5)
        )
        for esc, student in escalations_res.all():
            recent_escalations.append({
                "id": esc.id,
                "student_name": f"{student.first_name} {student.last_name}",
                "reason": esc.reason,
                "status": esc.status,
                "created_at": esc.created_at.strftime("%Y-%m-%d"),
            })

    leave_res = await db.execute(
        select(LeaveRequest)
        .where(LeaveRequest.user_id == current_user.id)
        .order_by(LeaveRequest.created_at.desc())
        .limit(5)
    )
    recent_leave_requests = [
        {
            "id": lr.id,
            "leave_type": lr.leave_type,
            "start_date": lr.start_date.strftime("%Y-%m-%d"),
            "end_date": lr.end_date.strftime("%Y-%m-%d"),
            "status": lr.status,
        }
        for lr in leave_res.scalars().all()
    ]

    # 5. Return the combined dashboard payload
    return {
        "is_class_teacher": is_class_teacher,
        "homeroom": homeroom_data,
        "teaching_subjects": teaching_subjects,
        "reports_to": hods,
        "reports_to_is_fallback": is_fallback,
        "recent_progress_reports": recent_progress_reports,
        "recent_escalations": recent_escalations,
        "recent_leave_requests": recent_leave_requests,
    }