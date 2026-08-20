from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from database import get_db
from models import User, Student, ParentStudentLink, School
from auth import get_current_user, get_current_school

router = APIRouter(prefix="/api/parent", tags=["Parent Portal"])

@router.get("/children")
async def get_parent_children(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_school: School = Depends(get_current_school)
):
    """Fetch all student profiles linked to the logged-in parent user."""
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
                "id": str(c.id),
                "first_name": c.first_name,
                "last_name": c.last_name,
                "grade": c.grade,
                "admission_number": getattr(c, "admission_number", None)
            } for c in children
        ]
    }