from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel

from database import get_db
from models import Course, School
from auth import get_current_school, get_current_user

router = APIRouter(prefix="/courses", tags=["Academic Courses"])

# Pydantic schemas for request validation
class CourseCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    grade: Optional[str] = None

class CourseResponse(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    grade: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True

@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    data: CourseCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    token_data: tuple = Depends(get_current_user)
):
    """Handles POST /api/courses to create a new school course shell"""
    user, _ = token_data
    
    # Optional code uniqueness check within the same school tenant
    if data.code:
        existing = await db.execute(
            select(Course).where(Course.school_id == current_school.id, Course.code == data.code)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="A course with this code already exists.")

    new_course = Course(
        school_id=current_school.id,
        teacher_id=user.id, # Automatically links the course to the creator profile
        name=data.name,
        code=data.code,
        description=data.description,
        grade=data.grade,
        is_active=True
    )
    
    db.add(new_course)
    await db.commit()
    await db.refresh(new_course)
    return new_course

@router.get("", response_model=List[CourseResponse])
@router.get("/", response_model=List[CourseResponse])
async def list_courses(
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """Handles GET /api/staff to list school tenant scoped courses"""
    result = await db.execute(
        select(Course).where(Course.school_id == current_school.id)
    )
    return result.scalars().all()