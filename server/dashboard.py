from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import Student, Payment, FeeInvoice, User, School, school_users, UserRole, Subject
from auth import get_current_school, get_current_user

# Mounted with prefix="/api" in main.py → routes live at /api/dashboard/...
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    token_data=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    GET /api/dashboard/stats
    Returns key school metrics for the admin dashboard cards.
    """
    user, payload = token_data
    school_id = payload.get("school_id")

    if not school_id and getattr(user, "is_super_admin", False):
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
                "isSuperAdmin": True,
            },
        }

    if not school_id:
        raise HTTPException(status_code=403, detail="School ID missing in token")

    school_result = await db.execute(select(School).where(School.id == school_id))
    school = school_result.scalar_one_or_none()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    # Total students
    total_students = (
        await db.execute(select(func.count(Student.id)).where(Student.school_id == school.id))
    ).scalar() or 0

    # Total staff (teacher + staff roles)
    total_staff = (
        await db.execute(
            select(func.count(school_users.c.user_id)).where(
                school_users.c.school_id == school.id,
                school_users.c.role.in_([UserRole.TEACHER, UserRole.STAFF]),
            )
        )
    ).scalar() or 0

    # Unique courses/subjects
    unique_courses = (
        await db.execute(
            select(func.count(Subject.id)).where(Subject.school_id == school.id)
        )
    ).scalar() or 0

    # Outstanding fees: sum of (total_amount - paid_amount) for unpaid invoices
    outstanding_fees = (
        await db.execute(
            select(func.sum(FeeInvoice.total_amount - FeeInvoice.paid_amount)).where(
                FeeInvoice.school_id == school.id,
                FeeInvoice.status != "paid",
            )
        )
    ).scalar() or 0

    return {
        "success": True,
        "data": {
            "totalStudents": total_students,
            "activeStudents": total_students,
            "totalStaff": total_staff,
            "uniqueCourses": unique_courses,
            "outstandingFees": float(outstanding_fees),
        },
    }


# ─── Reports sub-routes (mounted at /api/dashboard/reports/...) ──────────────

@router.get("/reports/financial-summary")
async def get_financial_summary(
    db: AsyncSession = Depends(get_db),
    current_school=Depends(get_current_school),
):
    """Total collected and outstanding fee amounts for the school"""
    total_collected = (
        await db.execute(
            select(func.sum(Payment.amount)).where(Payment.school_id == current_school.id)
        )
    ).scalar() or 0

    total_outstanding = (
        await db.execute(
            select(func.sum(FeeInvoice.total_amount - FeeInvoice.paid_amount)).where(
                FeeInvoice.school_id == current_school.id,
                FeeInvoice.status != "paid",
            )
        )
    ).scalar() or 0

    return {
        "success": True,
        "data": {
            "collected": float(total_collected),
            "outstanding": float(total_outstanding),
        },
    }


@router.get("/reports/school-analytics")
async def get_school_analytics(
    db: AsyncSession = Depends(get_db),
    current_school=Depends(get_current_school),
    token_data=Depends(get_current_user),
):
    """High-level school analytics for admin reporting"""
    total_students = (
        await db.execute(
            select(func.count(Student.id)).where(Student.school_id == current_school.id)
        )
    ).scalar() or 0

    total_staff = (
        await db.execute(
            select(func.count(school_users.c.user_id)).where(
                school_users.c.school_id == current_school.id,
                school_users.c.role.in_([UserRole.TEACHER, UserRole.STAFF]),
            )
        )
    ).scalar() or 0

    total_courses = (
        await db.execute(
            select(func.count(Subject.id)).where(Subject.school_id == current_school.id)
        )
    ).scalar() or 0

    return {
        "success": True,
        "data": {
            "total_students": total_students,
            "total_staff": total_staff,
            "total_courses": total_courses,
        },
    }