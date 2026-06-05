from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import Student, User, school_users, UserRole, Subject, FeeInvoice, School
from auth import get_current_school, get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
async def get_dashboard_stats(
    token_data = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch metrics for the dashboard (School or Platform-wide)"""
    user, payload = token_data
    school_id = payload.get("school_id")
    
    if not school_id and user.is_super_admin:
        # Platform-wide stats for SuperAdmin
        total_schools = (await db.execute(select(func.count(School.id)))).scalar()
        total_students = (await db.execute(select(func.count(Student.id)))).scalar()
        total_users = (await db.execute(select(func.count(User.id)))).scalar()
        
        return {
            "success": True,
            "data": {
                "totalSchools": total_schools,
                "totalStudents": total_students,
                "totalUsers": total_users,
                "systemStatus": "Healthy",
                "isSuperAdmin": True
            }
        }

    if not school_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="School ID missing in token")

    # Fetch school-specific metrics (Existing logic)
    school_result = await db.execute(select(School).where(School.id == school_id))
    school = school_result.scalar_one_or_none()
    
    if not school:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="School not found")
    
    # 1. Total Students
    students_query = select(func.count(Student.id)).where(Student.school_id == school.id)
    total_students = (await db.execute(students_query)).scalar()
    
    # 2. Total Staff (Users with TEACHER or STAFF role in this school)
    staff_query = select(func.count(school_users.c.user_id)).where(
        school_users.c.school_id == school.id,
        school_users.c.role.in_([UserRole.TEACHER, UserRole.STAFF])
    )
    total_staff = (await db.execute(staff_query)).scalar()
    
    # 3. Unique Courses (Subject grades)
    subjects_query = select(func.count(Subject.id)).where(Subject.school_id == school.id)
    unique_courses = (await db.execute(subjects_query)).scalar()
    
    # 4. Outstanding Fees
    fees_query = select(func.sum(FeeInvoice.total_amount - FeeInvoice.paid_amount)).where(
        FeeInvoice.school_id == school.id,
        FeeInvoice.status != 'paid'
    )
    outstanding_fees = (await db.execute(fees_query)).scalar() or 0
    
    return {
        "success": True,
        "data": {
            "totalStudents": total_students,
            "activeStudents": total_students, # Placeholder
            "totalStaff": total_staff,
            "uniqueCourses": unique_courses,
            "outstandingFees": float(outstanding_fees)
        }
    }
