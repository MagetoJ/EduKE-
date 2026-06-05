from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert
from datetime import timedelta
import logging

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
from exams import router as exams_router
from timetables import router as timetables_router
from attendance import router as attendance_router
from platform_admin import router as platform_router
from dashboard import router as dashboard_router
from leave_requests import router as leave_router
from notifications import router as notifications_router

# Setup logging
logger = logging.getLogger(__name__)

app = FastAPI(title="EduKE API", version="1.0.0")

app.include_router(students_router)
app.include_router(payments_router)
app.include_router(assets_router)
app.include_router(users_router)
app.include_router(exams_router)
app.include_router(timetables_router)
app.include_router(attendance_router)
app.include_router(platform_router)
app.include_router(dashboard_router)
app.include_router(leave_router)
app.include_router(notifications_router)

# CORS configuration - Borrowed from SmartBiz main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Your Vite frontend port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== EXCEPTION HANDLERS (SmartBiz Pattern) ====================

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error occurred"},
    )

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup - SmartBiz pattern"""
    await init_db()
    logger.info("EduKE Backend Started Successfully")

# ============= SCHEMAS (Aligned with Frontend) =============
class SchoolRegister(BaseModel):
    schoolName: str
    curriculum: str
    adminName: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

# ==================== AUTH ROUTES ====================

@app.post("/auth/register-school")
@app.post("/register-school") # Compatibility with frontend
async def register_school(data: SchoolRegister, db: AsyncSession = Depends(get_db)):
    """Registers a new School and its first Admin user (Aligned with Frontend)"""
    
    # 1. Check if user or school slug already exists
    slug = data.schoolName.lower().replace(" ", "-")
    existing_school = await db.execute(select(School).where(School.slug == slug))
    if existing_school.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="School name already registered")

    # Check if email exists
    existing_user = await db.execute(select(User).where(User.email == data.email))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # 2. Create the School
    new_school = School(
        name=data.schoolName,
        slug=slug,
        email=data.email
    )
    db.add(new_school)
    await db.flush() # Get school ID

    # 3. Create the Admin User
    hashed_password = get_password_hash(data.password)
    new_user = User(
        username=data.email, # Using email as username for simplicity
        email=data.email,
        full_name=data.adminName,
        hashed_password=hashed_password
    )
    db.add(new_user)
    await db.flush() # Get user ID

    # 4. Link User to School as ADMIN
    await db.execute(
        insert(school_users).values(
            school_id=new_school.id,
            user_id=new_user.id,
            role=UserRole.ADMIN,
            is_active=True
        )
    )
    
    await db.commit()
    return {"message": f"School {data.schoolName} registered successfully", "school_id": new_school.id}

@app.post("/auth/login")
@app.post("/login") # Compatibility with frontend
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login and return a token scoped to the user's school (Aligned with Frontend)"""
    
    # 1. Find user by email
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    # 2. Get user's school assignment (SmartBiz Multi-tenancy)
    membership_query = select(school_users.c.school_id, school_users.c.role).where(
        school_users.c.user_id == user.id,
        school_users.c.is_active == True
    )
    membership_result = await db.execute(membership_query)
    membership = membership_result.first()

    if not membership and not user.is_super_admin:
        raise HTTPException(status_code=403, detail="User is not assigned to an active school")

    school_id = membership[0] if membership else None
    role = membership[1] if membership else "superadmin"
    school_name = None

    if school_id:
        # Fetch school name for the response
        school_result = await db.execute(select(School.name).where(School.id == school_id))
        school_name = school_result.scalar()

    # 3. Create Scoped Access Token
    access_token = create_access_token(
        data={"sub": user.username, "is_super_admin": user.is_super_admin},
        school_id=school_id,
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    # 4. Return response in format expected by Frontend AuthContext
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
                "must_change_password": False
            }
        }
    }

class RefreshRequest(BaseModel):
    refreshToken: str

@app.post("/auth/refresh-token")
async def refresh_token(request: Request):
    """Stub to prevent 404/401 in frontend background refresh"""
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    
    if token:
        try:
            # Decode without expiration check to identify user for refresh
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
            username = payload.get("sub")
            school_id = payload.get("school_id")
            is_super_admin = payload.get("is_super_admin", False)
            
            if username:
                new_token = create_access_token(
                    data={"sub": username, "is_super_admin": is_super_admin},
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

    return JSONResponse(
        status_code=401,
        content={"success": False, "detail": "Invalid or missing token"}
    )

# ==================== BASIC ROUTES ====================

@app.get("/health")
async def health_check():
    """Platform health check"""
    return {"status": "healthy", "service": "EduKE API"}

@app.get("/schools")
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
        "status": s.status
    } for s in schools]

@app.get("/notifications")
async def get_notifications_stub():
    """Stub to prevent 404 in frontend background refresh"""
    return {"success": True, "data": []}

@app.get("/leave-requests")
async def get_leave_requests_stub():
    """Stub to prevent 404 in dashboard"""
    return {"success": True, "data": []}

@app.get("/")
async def root():
    return {"message": "Welcome to EduKE API. Borrowing logic from SmartBiz."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)