from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from typing import List
from database import get_db
from models import School, User, school_users, AdminActivityLog, Student
from auth import get_current_super_admin, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from pydantic import BaseModel
from datetime import datetime, timedelta

router = APIRouter(prefix="/platform", tags=["Super Admin"])

@router.post("/schools/{school_id}/impersonate")
async def impersonate_school(
    school_id: int,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_super_admin)
):
    """Generate a token for a specific school (SmartBiz Impersonation)"""
    school = await db.get(School, school_id)
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
        
    # Generate token scoped to this school but for the superadmin user
    access_token = create_access_token(
        data={"sub": admin.username, "is_impersonating": True},
        school_id=school_id,
        expires_delta=timedelta(minutes=60) # Short lived
    )
    
    return {
        "access_token": access_token,
        "school_name": school.name
    }

class PlanUpdate(BaseModel):
    plan: str
    expires_at: datetime = None

@router.get("/stats")
async def get_platform_stats(
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_current_super_admin)
):
    """Platform-wide analytics (SmartBiz Pattern)"""
    total_schools = await db.execute(select(func.count(School.id)))
    active_schools = await db.execute(select(func.count(School.id)).where(School.status == 'active'))
    trial_schools = await db.execute(select(func.count(School.id)).where(School.subscription_plan == 'trial'))
    blocked_schools = await db.execute(select(func.count(School.id)).where(School.is_manually_blocked == True))
    total_users = await db.execute(select(func.count(User.id)))
    total_students = await db.execute(select(func.count(Student.id)))
    
    # Staff count (where role is teacher, hod, etc. - anything not student/parent)
    total_staff = await db.execute(
        select(func.count(school_users.c.user_id))
        .where(school_users.c.role.notin_(['student', 'parent']))
    )

    return {
        "total_schools": total_schools.scalar(),
        "active_schools": active_schools.scalar(),
        "trial_schools": trial_schools.scalar(),
        "blocked_schools": blocked_schools.scalar(),
        "total_users": total_users.scalar(),
        "total_students": total_students.scalar(),
        "total_staff": total_staff.scalar(),
        "revenue": 0.0, # Placeholder for billing integration
        "health": "healthy"
    }

@router.get("/schools")
async def list_all_schools(
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_current_super_admin)
):
    """View all registered schools across the platform"""
    result = await db.execute(select(School))
    return result.scalars().all()

@router.patch("/schools/{school_id}/status")
async def toggle_school_block(
    school_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_super_admin)
):
    """Block or unblock a school tenant"""
    school = await db.get(School, school_id)
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    
    school.is_manually_blocked = not school.is_manually_blocked
    school.status = 'suspended' if school.is_manually_blocked else 'active'
    
    # Log the action
    log = AdminActivityLog(
        admin_id=admin.id,
        action="toggle_block_school",
        target_school_id=school_id,
        details={"new_blocked_status": school.is_manually_blocked},
        ip_address=request.client.host
    )
    db.add(log)
    
    await db.commit()
    return {"message": f"School status updated", "is_blocked": school.is_manually_blocked}

@router.delete("/schools/{school_id}")
async def remove_school(
    school_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_super_admin)
):
    """SmartBiz logic: Cascade delete school and its data"""
    school = await db.get(School, school_id)
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    
    # Log the action before deletion
    log = AdminActivityLog(
        admin_id=admin.id,
        action="delete_school",
        target_school_id=None, # School will be gone
        details={"deleted_school_name": school.name, "deleted_school_id": school_id},
        ip_address=request.client.host
    )
    db.add(log)
    
    await db.delete(school)
    await db.commit()
    return {"message": f"School {school_id} removed successfully"}

@router.get("/audit-logs")
async def get_admin_audit_logs(
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_current_super_admin)
):
    """Fetch global administrative activity logs"""
    result = await db.execute(select(AdminActivityLog).order_by(AdminActivityLog.created_at.desc()).limit(100))
    return result.scalars().all()
