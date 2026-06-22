from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert
from typing import List, Optional
from pydantic import BaseModel, EmailStr, model_validator

from database import get_db
from models import User, School, school_users, UserRole
from auth import get_current_school, get_password_hash

router = APIRouter(prefix="/users", tags=["User Management"])

# --- Schemas ---
class UserCreate(BaseModel):
    username: Optional[str] = None
    email: EmailStr
    full_name: Optional[str] = None
    name: Optional[str] = None  # Added to capture parameter variations sent by frontend forms
    password: str
    role: UserRole

    @model_validator(mode="before")
    @classmethod
    def reconcile_name_and_username(cls, data: dict) -> dict:
        """
        Normalizes inbound JSON keys. Ensures 'full_name' is populated from 'name',
        and generates a fallback 'username' from the 'email' if omitted.
        """
        if isinstance(data, dict):
            # 1. Map 'name' from frontend payload to 'full_name'
            if "name" in data and not data.get("full_name"):
                data["full_name"] = data["name"]
            elif "full_name" in data and not data.get("name"):
                data["name"] = data["full_name"]
                
            # 2. Automatically default 'username' to 'email' if not passed
            if not data.get("username") and "email" in data:
                data["username"] = data["email"]
        return data

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    is_active: bool
    class Config:
        from_attributes = True

# --- Routes ---

@router.get("", response_model=List[UserResponse])
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

@router.post("", response_model=UserResponse)
@router.post("/", response_model=UserResponse)
async def create_school_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """Create a new user (Teacher, Parent, etc.) and link to the school"""
    
    # 1. Check if user already exists (using the validated, resolved username)
    existing_user = await db.execute(select(User).where(User.username == data.username))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already registered")

    existing_email = await db.execute(select(User).where(User.email == data.email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # 2. Create the User with fallback resolution for fields
    hashed_password = get_password_hash(data.password)
    new_user = User(
        username=data.username or str(data.email),
        email=data.email,
        full_name=data.full_name or data.name or "",
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