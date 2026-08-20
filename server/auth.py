import os
from datetime import datetime, timedelta
from typing import Optional, Tuple, Set

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError, jwt
import bcrypt

from database import get_db

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# --- Native Bcrypt Password Hashing ---

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain text password against its hashed counterpart."""
    try:
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """Generates a secure bcrypt hash string from a plain text password."""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(rounds=12)
    hashed_bytes = bcrypt.hashpw(password_bytes, salt)
    return hashed_bytes.decode('utf-8')

# --- Token Creation & User Extraction ---

def create_access_token(data: dict, school_id: Optional[int] = None, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token with optional school_id scoping"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    
    if school_id is not None:
        to_encode.update({"school_id": school_id})
    
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> Tuple[any, dict]:
    """Dependency to validate JWT and return the user model instance and token payload."""
    from models import User
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user, payload

async def get_current_super_admin(token_data: Tuple = Depends(get_current_user)):
    """Verifies user has platform-wide superadmin privileges."""
    user, payload = token_data
    if not getattr(user, "is_super_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Super Admin privileges required"
        )
    return user

# --- Tenant & Role Resolution ---

async def get_current_school(token_data: Tuple = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """
    Dependency to resolve and verify the school/tenant context for the authenticated request.
    Handles SuperAdmins, standard school_users membership, and Parent child linkages.
    """
    from models import school_users, School, Student, ParentStudentLink
    
    user, payload = token_data
    
    # 1. Super Admin Bypass
    if getattr(user, "is_super_admin", False):
        school_id = payload.get("school_id")
        if school_id:
            res = await db.execute(select(School).where(School.id == school_id))
            return res.scalar_one_or_none()
        res = await db.execute(select(School).limit(1))
        return res.scalar_one_or_none()

    school_id = payload.get("school_id")
    
    # 2. Check if user is linked as a parent via ParentStudentLink (handles cases where token isn't pre-scoped)
    parent_school_stmt = (
        select(School)
        .join(Student, Student.school_id == School.id)
        .join(ParentStudentLink, ParentStudentLink.student_id == Student.id)
        .where(ParentStudentLink.parent_id == user.id)
    )
    res_parent = await db.execute(parent_school_stmt)
    parent_school = res_parent.scalar_one_or_none()
    if parent_school:
        return parent_school

    if not school_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Access token is not scoped to a specific school"
        )
    
    # 3. Verify school exists and is active
    school_result = await db.execute(select(School).where(School.id == school_id))
    school = school_result.scalar_one_or_none()
       if not school or (getattr(school, "status", "active") or "").strip().lower() != 'active':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="School is inactive or does not exist"
        )

    # 4. Verify user-school membership in school_users table
    membership_query = select(school_users).where(
        school_users.c.user_id == user.id,
        school_users.c.school_id == school_id,
        school_users.c.is_active == True
    )
    result = await db.execute(membership_query)
    membership = result.first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="User is not authorized for this school"
        )
    
    return school

async def get_effective_roles(db: AsyncSession, user_id: int, school_id: int) -> Set[str]:
    """Retrieves all active roles for a user within a school context, including parent fallbacks."""
    from models import school_users, user_additional_roles, ParentStudentLink
    
    roles = set()

    # Check parent status via ParentStudentLink
    parent_check = await db.execute(
        select(ParentStudentLink.id).where(ParentStudentLink.parent_id == user_id).limit(1)
    )
    if parent_check.scalar_one_or_none():
        roles.add("parent")

    # Primary role check from school_users
    primary_result = await db.execute(
        select(school_users.c.role).where(
            school_users.c.user_id == user_id,
            school_users.c.school_id == school_id,
            school_users.c.is_active == True,
        )
    )
    primary_row = primary_result.first()
    if primary_row:
        roles.add(primary_row.role.value if hasattr(primary_row.role, "value") else str(primary_row.role))

    # Secondary additional roles
    extra_result = await db.execute(
        select(user_additional_roles.c.role).where(
            user_additional_roles.c.user_id == user_id,
            user_additional_roles.c.school_id == school_id,
        )
    )
    for row in extra_result:
        roles.add(row.role.value if hasattr(row.role, "value") else str(row.role))

    return roles

def require_roles(*allowed_roles: str):
    """Role-based authorization dependency factory."""
    normalized_allowed = {r.lower() for r in allowed_roles}

    async def role_dependency(
        token_data: Tuple = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        user, payload = token_data

        if getattr(user, "is_super_admin", False):
            return user

        # Resolve school ID from token or parent link
        school_id = payload.get("school_id")
        if not school_id:
            current_school = await get_current_school(token_data, db)
            if current_school:
                school_id = current_school.id

        if not school_id:
            raise HTTPException(status_code=403, detail="Access token is not scoped to a specific school")

        effective_roles = await get_effective_roles(db, user.id, school_id)

        if not effective_roles:
            raise HTTPException(status_code=403, detail="Not authorized for this school")

        if not (effective_roles & normalized_allowed):
            raise HTTPException(
                status_code=403,
                detail=f"This action requires one of the following roles: {', '.join(sorted(normalized_allowed))}",
            )

        return user

    return role_dependency

def check_permissions(required_role: Optional[any] = None, required_permission: Optional[any] = None):
    """Dependency factory for checking fine-grained role/permission access."""
    async def permission_dependency(
        token_data: Tuple = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ):
        from models import school_users, UserRole, Permission
        user, payload = token_data
        school_id = payload.get("school_id")

        # Parent bypass permission check if parent role exists
        parent_roles = await get_effective_roles(db, user.id, school_id or 0)
        if "parent" in parent_roles:
            return True
        
        membership_query = select(school_users).where(
            school_users.c.user_id == user.id,
            school_users.c.school_id == school_id
        )
        result = await db.execute(membership_query)
        membership = result.first()
        
        if not membership:
            raise HTTPException(status_code=403, detail="Not authorized for this school")
            
        user_role = membership.role
        
        if hasattr(UserRole, "ADMIN") and user_role == UserRole.ADMIN:
            return True
            
        if required_role and user_role != required_role:
            raise HTTPException(status_code=403, detail=f"Requires {required_role} role")
            
        return True

    return permission_dependency