from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import date
from database import get_db
from models import User, Course, ClassProgressReport, ProgressReportComment, Notification
from auth import get_current_user

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
    current_user: User = Depends(get_current_user)
):
    """Fetches classes/subjects explicitly assigned to this teacher"""
    res = await db.execute(select(Course).where(Course.teacher_id == current_user.id))
    courses = res.scalars().all()
    return {
        "success": True,
        "data": [{"id": c.id, "name": c.name, "code": c.code, "grade": c.grade} for c in courses]
    }

@router.post("/reports")
async def file_progress_report(
    payload: CreateProgressReportPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify course belongs to them
    course_res = await db.execute(select(Course).where(Course.id == payload.course_id, Course.teacher_id == current_user.id))
    course = course_res.scalar_one_or_none()
    if not course:
         raise HTTPException(status_code=403, detail="Unassigned: You are not authorized to file progress reports for this class.")
         
    report = ClassProgressReport(
        school_id=current_user.school_id,
        course_id=payload.course_id,
        teacher_id=current_user.id,
        week_start_date=payload.week_start_date,
        topics_covered=payload.topics_covered,
        syllabus_coverage_percent=payload.syllabus_coverage_percent,
        challenges=payload.challenges,
        blockers=payload.blockers
    )
    db.add(report)
    
    # Notify the department's HOD
    if course.department_id:
        dept_hod_res = await db.execute(select(AcademicDepartment.hod_id).where(AcademicDepartment.id == course.department_id))
        hod_id = dept_hod_res.scalar()
        if hod_id:
            db.add(Notification(
                school_id=current_user.school_id,
                user_id=hod_id,
                title="Syllabus Progress Filed",
                message=f"{current_user.full_name} filed a progress report for {course.name}.",
                notification_type="success",
                link_url="/dashboard/hod"
            ))
            
    await db.commit()
    return {"success": True, "message": "Progress report filed."}