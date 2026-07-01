from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Student, ParentStudentRelation, ExamResult, Attendance
from auth import get_current_user, get_current_school

router = APIRouter(prefix="/api/parents", tags=["Parent Portal"])

@router.get("/dashboard")
async def get_parent_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
    current_school = Depends(get_current_school)
):
    # 1. Find all students linked to this parent
    relations_query = await db.execute(
        select(Student)
        .join(ParentStudentRelation, Student.id == ParentStudentRelation.student_id)
        .where(ParentStudentRelation.parent_id == current_user.id, Student.school_id == current_school.id)
    )
    children = relations_query.scalars().all()
    
    dashboard_data = []
    
    for child in children:
        # Fetch recent grades for the child
        grades_query = await db.execute(
            select(ExamResult).where(ExamResult.student_id == child.id).order_by(ExamResult.created_at.desc()).limit(5)
        )
        recent_grades = grades_query.scalars().all()
        
        # Fetch attendance summary for the child
        # (This is simplified; you could aggregate this using func.count)
        attendance_query = await db.execute(
            select(Attendance).where(Attendance.student_id == child.id).order_by(Attendance.date.desc()).limit(5)
        )
        recent_attendance = attendance_query.scalars().all()

        dashboard_data.append({
            "student_id": child.id,
            "name": f"{child.first_name} {child.last_name}",
            "grade": child.grade,
            "recent_grades": recent_grades,
            "recent_attendance": recent_attendance
        })
        
    return {"success": True, "data": dashboard_data}