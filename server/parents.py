from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Dict, Any, Optional

from database import get_db
from models import (
    User, Student, Attendance, DisciplineRecord, 
    GradeEntry, ClassProgressReport, Assignment, 
    AssignmentSubmission, FeeInvoice, Payment, ParentStudentLink, School
)
from auth import get_current_user, get_current_school

router = APIRouter(prefix="/api/parent", tags=["Parent Portal"])

async def verify_parent_child_access(
    parent_id: int, 
    student_id: int, 
    school_id: int, 
    db: AsyncSession
) -> Student:
    """Ensure parent is linked to the student and student belongs to current school tenant."""
    query = (
        select(Student)
        .join(ParentStudentLink, ParentStudentLink.student_id == Student.id)
        .where(
            ParentStudentLink.parent_id == parent_id,
            Student.id == student_id,
            Student.school_id == school_id
        )
    )
    result = await db.execute(query)
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied or student not linked to your account."
        )
    return student


@router.get("/children")
async def get_parent_children(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_school: School = Depends(get_current_school)
):
    """List all children linked to the logged-in parent."""
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parent accounts can access this resource.")

    query = (
        select(Student)
        .join(ParentStudentLink, ParentStudentLink.student_id == Student.id)
        .where(
            ParentStudentLink.parent_id == current_user.id,
            Student.school_id == current_school.id
        )
    )
    result = await db.execute(query)
    children = result.scalars().all()
    
    return {
        "success": True,
        "data": [
            {
                "id": c.id,
                "first_name": c.first_name,
                "last_name": c.last_name,
                "grade": c.grade,
                "admission_number": getattr(c, "admission_number", None)
            } for c in children
        ]
    }