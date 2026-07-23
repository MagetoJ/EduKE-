from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import date
from database import get_db
from models import User, School, Course, ClassProgressReport, ProgressReportComment, Notification
from models_roles import ClassSubjectAssignment
from auth import get_current_user, get_current_school
from reporting import get_teacher_hods

router = APIRouter(prefix="/api/teacher/progress", tags=["Teacher progress tracking"])

class CreateProgressReportPayload(BaseModel):
    course_id: int
    week_start_date: date
    topics_covered: str
    syllabus_coverage_percent: int
    challenges: Optional[str] = None
    blockers: Optional[str] = None

@router.get("/my-classes")
async def get_my_assigned_classes(
    db: AsyncSession = Depends(get_db),
    token_data: tuple = Depends(get_current_user),
    current_school: School = Depends(get_current_school),
):
    """
    Fetches subjects this teacher is assigned to teach, from EITHER
    assignment path in use across the app:
      - Course.teacher_id (older, one-teacher-per-course model)
      - ClassSubjectAssignment (newer, per grade+stream model driven by the
        HOD's "assign subject to class" screen)
    A teacher assigned only through the HOD screen would otherwise show up
    with zero classes here and be unable to file a report at all.
    """
    current_user, _ = token_data

    direct_res = await db.execute(
        select(Course).where(
            Course.teacher_id == current_user.id,
            Course.school_id == current_school.id,
        )
    )
    direct_courses = {c.id: c for c in direct_res.scalars().all()}

    assigned_res = await db.execute(
        select(Course)
        .join(ClassSubjectAssignment, ClassSubjectAssignment.course_id == Course.id)
        .where(
            ClassSubjectAssignment.teacher_id == current_user.id,
            ClassSubjectAssignment.school_id == current_school.id,
        )
    )
    for c in assigned_res.scalars().all():
        direct_courses.setdefault(c.id, c)

    return {
        "success": True,
        "data": [
            {"id": c.id, "name": c.name, "code": c.code, "grade": c.grade}
            for c in direct_courses.values()
        ]
    }

@router.post("/reports")
async def file_progress_report(
    payload: CreateProgressReportPayload,
    db: AsyncSession = Depends(get_db),
    token_data: tuple = Depends(get_current_user),
    current_school: School = Depends(get_current_school),
):
    current_user, _ = token_data

    # Verify the course belongs to them via either assignment path
    course_res = await db.execute(
        select(Course).where(Course.id == payload.course_id, Course.school_id == current_school.id)
    )
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    is_direct_teacher = course.teacher_id == current_user.id
    is_class_assigned = False
    if not is_direct_teacher:
        assignment_res = await db.execute(
            select(ClassSubjectAssignment).where(
                ClassSubjectAssignment.course_id == payload.course_id,
                ClassSubjectAssignment.teacher_id == current_user.id,
            )
        )
        is_class_assigned = assignment_res.scalar_one_or_none() is not None

    if not (is_direct_teacher or is_class_assigned):
        raise HTTPException(status_code=403, detail="Unassigned: You are not authorized to file progress reports for this class.")

    report = ClassProgressReport(
        school_id=current_school.id,
        course_id=payload.course_id,
        teacher_id=current_user.id,
        week_start_date=payload.week_start_date,
        topics_covered=payload.topics_covered,
        syllabus_coverage_percent=payload.syllabus_coverage_percent,
        challenges=payload.challenges,
        blockers=payload.blockers
    )
    db.add(report)

    # Notify the HOD(s) this teacher reports to (falls back to every HOD in
    # the school if this teacher isn't linked to a specific department yet).
    hods, _ = await get_teacher_hods(db, current_user.id, current_school.id)
    for hod in hods:
        db.add(Notification(
            school_id=current_school.id,
            user_id=hod["id"],
            title="Syllabus Progress Filed",
            message=f"{current_user.full_name} filed a progress report for {course.name}.",
            notification_type="success",
            link_url="/dashboard/hod"
        ))

    await db.commit()
    return {"success": True, "message": "Progress report filed."}