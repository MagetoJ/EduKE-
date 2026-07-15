from stubs import router as stubs_router
from fastapi import FastAPI, Depends, HTTPException, status, Request
from courses import router as courses_router
from fastapi.exceptions import RequestValidationError
from assignments import router as assignments_router
from library import router as library_router
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import select, insert, update, delete  # Added update here
from datetime import timedelta
from typing import Optional
from models_roles import ClassTeacherAssignment  
import logging
import traceback
import os

from database import get_db, init_db
from models import User, School, school_users, UserRole
from auth import (
    get_password_hash, 
    verify_password, 
    create_access_token, 
    get_current_user,
    get_current_school,
    get_current_super_admin,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    SECRET_KEY,
    ALGORITHM
)
from jose import jwt
from pydantic import BaseModel
from students import router as students_router
from payments import router as payments_router
from assets import router as assets_router
from users import router as users_router
from exams import router as academic_router, exams_router
from timetables import router as timetables_router
from attendance import router as attendance_router
from discipline import router as discipline_router
from platform_admin import router as platform_router
from dashboard import router as dashboard_router
from leave_requests import router as leave_router
from notifications import router as notifications_router
from transport_boarding import router as transport_router
from curriculum import router as curriculum_router
from class_teacher import router as class_teacher_router
from sqlalchemy import delete
from hod import router as hod_router

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="EduKE API", version="1.0.0", redirect_slashes=False)

# FIX: CORS middleware must be added BEFORE routers so it runs on every request
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://eduke.netlify.app",
        "http://localhost:5173", 
        "https://eduke.app",
        "https://www.eduke.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(students_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(payments_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(assets_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(users_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(exams_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(academic_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(timetables_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(attendance_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(discipline_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(platform_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(dashboard_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(stubs_router, dependencies=[Depends(get_current_user)])
app.include_router(assignments_router, dependencies=[Depends(get_current_user)])
app.include_router(transport_router, dependencies=[Depends(get_current_user)])
app.include_router(library_router, dependencies=[Depends(get_current_user)])
app.include_router(leave_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(notifications_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(courses_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(curriculum_router, dependencies=[Depends(get_current_user)])
app.include_router(class_teacher_router, dependencies=[Depends(get_current_user)])
app.include_router(hod_router, dependencies=[Depends(get_current_user)])

# ==================== EXCEPTION HANDLERS ====================

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    """Handles explicit client/server actions raised within routes"""
    logger.warning(f"HTTP {exc.status_code} on {request.method} {request.url.path}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "detail": exc.detail},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Catches and sanitizes Pydantic input/validation errors (HTTP 422)"""
    errors = exc.errors()
    error_messages = []
    for err in errors:
        loc = " -> ".join(str(x) for x in err.get("loc", []))
        msg = err.get("msg", "Invalid value")
        error_messages.append(f"Field '{loc}': {msg}")
    
    friendly_detail = "; ".join(error_messages)
    logger.error(f"Validation failed on {request.method} {request.url.path}: {friendly_detail}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False, 
            "detail": "Input validation failed", 
            "errors": friendly_detail
        },
    )

@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(request: Request, exc: SQLAlchemyError):
    """Catches database level problems gracefully without revealing connection strings or schemas"""
    logger.critical(f"Database error on {request.method} {request.url.path}: {str(exc)}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "success": False, 
            "detail": "Database service is temporarily unavailable or query failed."
        },
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all handler for unexpected system failures (HTTP 500)"""
    logger.critical(f"Unhandled system error on {request.method} {request.url.path}: {str(exc)}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "detail": "An internal server error occurred"},
    )

# ==================== STARTUP EVENTS ====================

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup - SmartBiz pattern"""
    try:
        await init_db()
        logger.info("EduKE Backend Started and Database Initialized Successfully")
    except Exception as e:
        logger.critical(f"Failed to initialize database during startup: {str(e)}")
        raise e

# ============= SCHEMAS =============
class SchoolRegister(BaseModel):
    schoolName: str
    is_special_needs: bool
    disability_category: Optional[str] = "none"
    curriculum: Optional[str] = "CBC"
    adminName: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

# Added StaffUpdate Schema properly placed here
class StaffUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None
    class_assigned: Optional[str] = None  # 🌟 Added field
    subject: Optional[str] = None

# ==================== AUTH ROUTES ====================

@app.post("/api/auth/register-school")
@app.post("/api/auth/register-school/")
@app.post("/api/register-school")
@app.post("/api/register-school/")
async def register_school(data: SchoolRegister, db: AsyncSession = Depends(get_db)):
    """Registers a new School and its first Admin user with special needs parameters"""
    slug = data.schoolName.lower().replace(" ", "-")
    existing_school = await db.execute(select(School).where(School.slug == slug))
    if existing_school.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="School name already registered")

    existing_user = await db.execute(select(User).where(User.email == data.email))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    school_kwargs = {
        "name": data.schoolName, 
        "slug": slug, 
        "email": data.email,
        "is_special_needs": data.is_special_needs,
        "disability_category": data.disability_category if data.is_special_needs else "none"
    }
    
    if hasattr(School, 'curriculum'):
        school_kwargs["curriculum"] = data.curriculum

    new_school = School(**school_kwargs)
    db.add(new_school)
    await db.flush()

    hashed_password = get_password_hash(data.password)
    new_user = User(username=data.email, email=data.email, full_name=data.adminName, hashed_password=hashed_password)
    db.add(new_user)
    await db.flush()

    await db.execute(
        insert(school_users).values(
            school_id=new_school.id,
            user_id=new_user.id,
            role=UserRole.ADMIN,
            is_active=True
        )
    )
    
    await db.commit()
    return {"success": True, "message": f"School {data.schoolName} registered successfully", "school_id": new_school.id}

@app.post("/api/auth/login")
@app.post("/api/auth/login/")
@app.post("/api/login")
@app.post("/api/login/")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login and return a token scoped to the user's school and special needs track parameters"""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    membership_query = select(school_users.c.school_id, school_users.c.role).where(
        school_users.c.user_id == user.id,
        school_users.c.is_active == True
    )
    membership_result = await db.execute(membership_query)
    membership = membership_result.first()

    if not membership and not user.is_super_admin:
        raise HTTPException(status_code=403, detail="User is not assigned to an active school")

    school_id = membership[0] if membership else None
    role = membership[1] if membership else "super_admin"
    school_name = None
    school_is_special_needs = False
    school_disability_category = "none"

    if school_id:
        school_result = await db.execute(select(School).where(School.id == school_id))
        school = school_result.scalar_one_or_none()
        if school:
            school_name = school.name
            school_is_special_needs = getattr(school, 'is_special_needs', False)
            school_disability_category = getattr(school, 'disability_category', 'none')

    access_token = create_access_token(
        data={
            "sub": user.username, 
            "is_super_admin": user.is_super_admin,
            "school_is_special_needs": school_is_special_needs,
            "school_disability_category": school_disability_category
        },
        school_id=school_id,
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return {
        "success": True,
        "data": {
            "accessToken": access_token,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "name": user.full_name,
                "role": role,
                "is_super_admin": user.is_super_admin,
                "school_id": str(school_id) if school_id else None,
                "school_name": school_name,
                "school_is_special_needs": school_is_special_needs,
                "school_disability_category": school_disability_category,
                "must_change_password": False
            }
        }
    }

class RefreshRequest(BaseModel):
    refreshToken: str

@app.post("/api/auth/refresh-token")
@app.post("/api/auth/refresh-token/")
@app.post("/api/refresh-token")
async def refresh_token(data: RefreshRequest, request: Request):
    """Stub to prevent 404/401 in frontend background refresh"""
    auth_header = request.headers.get("Authorization")
    token = auth_header.split(" ")[1] if auth_header and auth_header.startswith("Bearer ") else None

    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
            username = payload.get("sub")
            school_id = payload.get("school_id")
            is_super_admin = payload.get("is_super_admin", False)
            school_is_special_needs = payload.get("school_is_special_needs", False)
            school_disability_category = payload.get("school_disability_category", "none")
            
            if username:
                new_token = create_access_token(
                    data={
                        "sub": username, 
                        "is_super_admin": is_super_admin,
                        "school_is_special_needs": school_is_special_needs,
                        "school_disability_category": school_disability_category
                    },
                    school_id=school_id
                )
                return {
                    "success": True,
                    "data": {
                        "accessToken": new_token
                    }
                }
        except Exception as e:
            logger.error(f"Refresh failed: {e}")

    raise HTTPException(status_code=401, detail="Session expired - please login again")

# ==================== STAFF DIRECTORY ROUTES ====================

@app.get("/api/staff")
@app.get("/api/staff/")
async def list_school_staff(
    db: AsyncSession = Depends(get_db),
    token_data: tuple = Depends(get_current_user),  
    current_school: Optional[School] = Depends(get_current_school)
):
    """
    Fetches all staff members belonging to the current school tenant.
    """
    if not current_school:
        return {"success": True, "data": []}

    query = select(
        User.id,
        User.full_name.label("name"),
        User.email,
        school_users.c.role,
        school_users.c.is_active
    ).join(
        school_users, User.id == school_users.c.user_id
    ).where(
        school_users.c.school_id == current_school.id
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    staff_list = []
    for row in rows:
        raw_role = row[3]
        raw_active = row[4] if row[4] is not None else True

        if raw_role is None:
            role_str = "staff"
        elif hasattr(raw_role, 'value'):
            role_str = str(raw_role.value).lower().strip()
        else:
            role_str = str(raw_role).lower().strip()
            if "userrole." in role_str:
                role_str = role_str.split("userrole.")[-1].strip()

        if role_str in ["student", "parent"]:
            continue
            
        staff_list.append({
            "id": str(row[0]),   
            "name": row[1] or "",  
            "email": row[2] or "", 
            "phone": "",
            "role": role_str,
            "department": "Administration" if role_str in ["admin", "hr_manager", "registrar"] else "Academics",
            "status": "Active" if raw_active else "Inactive",
            "hire_date": None,
            "class_assigned": None,
            "subject": None
        })
        
    return {"success": True, "data": staff_list}


@app.put("/api/staff/{staff_id}")
async def update_staff_member(
    staff_id: int,
    data: StaffUpdate,
    db: AsyncSession = Depends(get_db),
    current_school: School = Depends(get_current_school)
):
    """Updates an existing staff member's details and synchronizes role assignments"""
    
    # 1. Fetch user and membership details
    user_result = await db.execute(select(User).where(User.id == staff_id))
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="Staff member not found")

    membership_result = await db.execute(
        select(school_users.c.role).where(
            school_users.c.user_id == staff_id,
            school_users.c.school_id == current_school.id
        )
    )
    membership = membership_result.first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Staff member does not belong to this school")

    old_role = str(membership[0]).lower() if membership[0] else ""

    # 2. Process personal profile updates
    if data.name is not None:
        user.full_name = data.name
    if data.email is not None:
        user.email = data.email

    # 3. Process role and activity updates
    update_values = {}
    if data.role is not None:
        update_values["role"] = data.role 
    if data.is_active is not None:
        update_values["is_active"] = data.is_active

    if update_values:
        await db.execute(
            update(school_users).where(
                school_users.c.user_id == staff_id,
                school_users.c.school_id == current_school.id
            ).values(**update_values)
        )

    # 4. Fixed Bug #3: Manage ClassTeacherAssignment rows
    new_role = data.role.lower() if data.role else old_role

    if new_role == "class_teacher":
        if data.class_assigned:
            # Parse something like "Grade 10 - Section A"
            parts = data.class_assigned.split(" - Section ")
            grade_level = parts[0] if len(parts) > 0 else "Grade 10"
            stream_section = parts[1] if len(parts) > 1 else "A"

            # Check if assignment already exists
            existing_assign = await db.execute(
                select(ClassTeacherAssignment).where(ClassTeacherAssignment.teacher_id == staff_id)
            )
            assignment = existing_assign.scalar_one_or_none()

            if assignment:
                assignment.grade_level = grade_level
                assignment.stream_section = stream_section
            else:
                new_assignment = ClassTeacherAssignment(
                    school_id=current_school.id,
                    teacher_id=staff_id,
                    grade_level=grade_level,
                    stream_section=stream_section
                )
                db.add(new_assignment)
    else:
        # If their role was changed away from class teacher, purge old active assignment row
        await db.execute(
            delete(ClassTeacherAssignment).where(ClassTeacherAssignment.teacher_id == staff_id)
        )

    await db.commit()
    return {"success": True, "message": "Staff member and assignments updated successfully"}

# ==================== SYSTEM ROUTES ====================

@app.get("/api/health")
async def health_check():
    """Platform health check"""
    return {"status": "healthy", "service": "EduKE API"}


@app.get("/api/schools")
async def list_schools_compatibility(
    db: AsyncSession = Depends(get_db), 
    _ = Depends(get_current_super_admin)
):
    """Compatibility for Dashboard.tsx which calls /api/schools"""
    result = await db.execute(select(School))
    schools = result.scalars().all()
    return [{
        "id": str(s.id),
        "name": s.name,
        "students": 0,
        "staff": 0,
        "revenue": "0",
        "status": s.status,
        "is_special_needs": getattr(s, 'is_special_needs', False),
        "disability_category": getattr(s, 'disability_category', 'none')
    } for s in schools]

@app.get("/")
async def root():
    return {"message": "Welcome to EduKE."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))