from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert
from typing import List, Optional
from pydantic import BaseModel, EmailStr

from database import get_db
from models import User, School, school_users, UserRole
from auth import get_current_school, get_password_hash

router = APIRouter(prefix="/users", tags=["User Management"])

# --- Schemas ---
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    password: str
    role: UserRole

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    is_active: bool
    class Config:
        from_attributes = True

# --- Routes ---

@router.get("/", response_model=List[UserResponse])
async def get_school_users(
    role: Optional[UserRole] = None,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """List users belonging to the current school, optionally filtered by role"""
    query = select(User).join(school_users).where(
        school_users.c.school_id == current_school.id,
        school_users.c.is_active == True
    )
    
    if role:
        query = query.where(school_users.c.role == role)
        
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=UserResponse)
async def create_school_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """Create a new user (Teacher, Parent, etc.) and link to the school"""
    
    # 1. Check if user already exists
    existing_user = await db.execute(select(User).where(User.username == data.username))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")

    # 2. Create the User
    hashed_password = get_password_hash(data.password)
    new_user = User(
        username=data.username,
        email=data.email,
        full_name=data.full_name,
        hashed_password=hashed_password
    )
    db.add(new_user)
    await db.flush() # Get user ID

    # 3. Link User to School
    await db.execute(
        insert(school_users).values(
            school_id=current_school.id,
            user_id=new_user.id,
            role=data.role,
            is_active=True
        )
    )
    
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.get("/teachers", response_model=List[UserResponse])
async def get_teachers(db: AsyncSession = Depends(get_db), current_school: School = Depends(get_current_school)):
    """Shortcut to get all teachers"""
    return await get_school_users(role=UserRole.TEACHER, db=db, current_school=current_school)

@router.get("/parents", response_model=List[UserResponse])
async def get_parents(db: AsyncSession = Depends(get_db), current_school: School = Depends(get_current_school)):
    """Shortcut to get all parents"""
    return await get_school_users(role=UserRole.PARENT, db=db, current_school=current_school)
