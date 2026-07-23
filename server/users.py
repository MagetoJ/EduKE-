from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert
from typing import List, Optional
from pydantic import BaseModel, EmailStr, model_validator

from database import get_db
from models import User, School, school_users, UserRole
from auth import get_current_school, get_current_user, get_password_hash
from models_roles import ClassTeacherAssignment, AcademicDepartment

router = APIRouter(prefix="/users", tags=["User Management"])

# --- Helper to map frontend roles to database UserRoles ---
def map_frontend_role_to_db_role(raw_role: str) -> UserRole:
    raw_role = raw_role.lower()
    if raw_role == "class_teacher":
        return UserRole.CLASS_TEACHER  # Retain the correct class teacher role
    elif raw_role in ["teacher", "hod", "cbc_coordinator", "exam_officer"]:
        return UserRole.TEACHER
    elif raw_role in ["administrator"]:
        return UserRole.ADMIN
    elif raw_role in ["student"]:
        return UserRole.STUDENT
    elif raw_role in ["parent"]:
        return UserRole.PARENT
    else:
        return UserRole.STAFF


# --- Schemas ---
class UserCreate(BaseModel):
    username: Optional[str] = None
    email: EmailStr
    full_name: Optional[str] = None
    name: Optional[str] = None  # Added to capture parameter variations sent by frontend forms
    password: str
    role: str  # Changed to str to accept frontend values like "class_teacher"
    
    # Accept extra fields sent by frontend to prevent Pydantic validation errors
    phone: Optional[str] = None
    school_id: Optional[int] = None
    class_assigned: Optional[str] = None
    subject: Optional[str] = None

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

    # 2. Map the frontend role (e.g. 'class_teacher') to standard DB enum (e.g. UserRole.TEACHER)
    mapped_role = map_frontend_role_to_db_role(data.role)

    # 3. Create the User with fallback resolution for fields
    hashed_password = get_password_hash(data.password)
    new_user = User(
        username=data.username or str(data.email),
        email=data.email,
        full_name=data.full_name or data.name or "",
        hashed_password=hashed_password
        # Note: If you add `phone` to your models.py User class in the future, 
        # you can pass `phone=data.phone` here.
    )
    db.add(new_user)
    await db.flush()  # Get user ID

    # 4. Link User to School (Correctly nested within async function)
    await db.execute(
        insert(school_users).values(
            school_id=current_school.id,
            user_id=new_user.id,
            role=mapped_role,
            is_active=True
        )
    )

    # 5. Automatically create Class Teacher Assignment if role matches
    if mapped_role == UserRole.CLASS_TEACHER and data.class_assigned:
        parts = data.class_assigned.split(" - Section ")
        grade_level = parts[0] if len(parts) > 0 else "Grade 10"
        stream_section = parts[1] if len(parts) > 1 else "A"

        assignment = ClassTeacherAssignment(
            school_id=current_school.id,
            teacher_id=new_user.id,
            grade_level=grade_level,
            stream_section=stream_section
        )
        db.add(assignment)
    
    await db.commit()
    await db.refresh(new_user)
    return new_user

class AssignHODPayload(BaseModel):
    user_id: int
    department_id: int

@router.post("/assign-hod")
async def assign_department_hod(
    payload: AssignHODPayload,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school),
    token_data: tuple = Depends(get_current_user)
):
    """Bind a staff member as HOD of an academic department.

    NOTE on auth: `get_current_user` returns a (User, jwt_payload) tuple, not a
    bare User (see hod.py's get_current_hod_user for the same gotcha). We also
    pull in get_current_school for tenant scoping, matching every other route
    in this file. Neither User nor the JWT payload carries a `role` we can
    trust here, so the admin check below queries `school_users` directly --
    if you already have a dedicated `get_current_admin` dependency elsewhere
    in auth.py, swap it in instead of this inline check.
    """
    admin_user, _payload = token_data

    # 1. Confirm the caller is an admin *of this school* (role lives in the
    #    school_users join table, not on User or the token payload)
    admin_membership = await db.execute(
        select(school_users).where(
            school_users.c.school_id == current_school.id,
            school_users.c.user_id == admin_user.id,
            school_users.c.role == UserRole.ADMIN
        )
    )
    if not admin_membership.first():
        raise HTTPException(status_code=403, detail="Unauthorized: Administrators only.")

    # 2. Verify the target user exists AND belongs to this school (via
    #    school_users -- User itself has no school_id column)
    user_res = await db.execute(
        select(User)
        .join(school_users, school_users.c.user_id == User.id)
        .where(User.id == payload.user_id, school_users.c.school_id == current_school.id)
    )
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Selected staff member not found in this school.")

    # 3. Verify the department exists AND belongs to this school
    dept_res = await db.execute(
        select(AcademicDepartment).where(
            AcademicDepartment.id == payload.department_id,
            AcademicDepartment.school_id == current_school.id
        )
    )
    dept = dept_res.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Selected department not found.")

    # 4. PREVENT MULTIPLE DEPARTMENTS (THE FIX)
    # Clear this user from ANY existing department assignments within this school
    # to prevent the split-brain / duplicate HOD bug.
    await db.execute(
        update(AcademicDepartment)
        .where(
            AcademicDepartment.hod_id == payload.user_id,
            AcademicDepartment.school_id == current_school.id,
            AcademicDepartment.id != payload.department_id
        )
        .values(hod_id=None)
    )

    # 5. Bind the user as HOD. This is the single source of truth hod.py's
    #    get_managed_department() reads from -- there's no separate "hod"
    #    role flag to flip on school_users, since map_frontend_role_to_db_role
    #    already collapses "hod" into UserRole.TEACHER there.
    dept.hod_id = payload.user_id

    await db.commit()
    return {"success": True, "message": f"{user.full_name} is now the official HOD for {dept.name}."}

@router.get("/teachers", response_model=List[UserResponse])
async def get_teachers(db: AsyncSession = Depends(get_db), current_school: School = Depends(get_current_school)):
    """Shortcut to get all teachers"""
    return await get_school_users(role=UserRole.TEACHER, db=db, current_school=current_school)

@router.get("/parents", response_model=List[UserResponse])
async def get_parents(db: AsyncSession = Depends(get_db), current_school: School = Depends(get_current_school)):
    """Shortcut to get all parents"""
    return await get_school_users(role=UserRole.PARENT, db=db, current_school=current_school)