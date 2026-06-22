from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from typing import List, Optional
from database import get_db
from models import School, User, school_users, AdminActivityLog, Student
from auth import get_current_super_admin, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from pydantic import BaseModel
from datetime import datetime, timedelta

router = APIRouter(prefix="/platform", tags=["Super Admin"])

class SchoolRegistrationSchema(BaseModel):
    name: str
    is_special_needs: bool
    disability_category: Optional[str] = "none" # 'hearing_impaired', 'visual_impaired', 'physical_mobility', 'none'

@router.post("/schools/register", status_code=status.HTTP_201_CREATED)
async def register_institution(
    payload: SchoolRegistrationSchema,
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_current_super_admin)
):
    """Platform Onboarding: Registers a new school tenant with specific accessibility tracks"""
    try:
        new_school = School(
            name=payload.name,
            is_special_needs=payload.is_special_needs,
            disability_category=payload.disability_category if payload.is_special_needs else "none",
            status="active",
            is_manually_blocked=False
        )
        db.add(new_school)
        await db.commit()
        await db.refresh(new_school)
        return {"success": True, "school_id": new_school.id, "message": "School registered successfully."}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to onboard institution: {str(e)}"
        )

@router.post("/schools/{school_id}/impersonate")
async def impersonate_school(
    school_id: int,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_super_admin)
):
    """Generate a token for a specific school (SmartBiz Impersonation with dynamic configuration mapping)"""
    school = await db.get(School, school_id)
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
        
    # Generate token scoped to this school passing special education contexts globally
    access_token = create_access_token(
        data={
            "sub": admin.username, 
            "is_impersonating": True,
            "school_is_special_needs": school.is_special_needs,
            "school_disability_category": school.disability_category
        },
        school_id=school_id,
        expires_delta=timedelta(minutes=60) # Short lived
    )
    
    return {
        "success": True,
        "access_token": access_token,
        "school_name": school.name
    }

@router.get("/stats")
async def get_platform_stats(
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_current_super_admin)
):
    """Platform-wide analytics capturing special needs sub-distributions (SmartBiz Pattern)"""
    try:
        total_schools = await db.execute(select(func.count(School.id)))
        active_schools = await db.execute(select(func.count(School.id)).where(School.status == 'active'))
        trial_schools = await db.execute(select(func.count(School.id)).where(School.subscription_plan == 'trial'))
        blocked_schools = await db.execute(select(func.count(School.id)).where(School.is_manually_blocked == True))
        total_users = await db.execute(select(func.count(User.id)))
        total_students = await db.execute(select(func.count(Student.id)))
        
        # Accessibility breakdown metrics tracking
        special_schools = await db.execute(select(func.count(School.id)).where(School.is_special_needs == True))

        total_staff = await db.execute(
            select(func.count(school_users.c.user_id))
            .where(school_users.c.role.notin_(['student', 'parent']))
        )

        return {
            "success": True,
            "data": {
                "total_schools": total_schools.scalar(),
                "active_schools": active_schools.scalar(),
                "trial_schools": trial_schools.scalar(),
                "blocked_schools": blocked_schools.scalar(),
                "special_needs_schools": special_schools.scalar(),
                "total_users": total_users.scalar(),
                "total_students": total_students.scalar(),
                "total_staff": total_staff.scalar(),
                "revenue": 0.0,
                "health": "healthy"
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile analytics telemetry: {str(e)}"
        )

@router.get("/schools")
async def list_all_schools(
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_current_super_admin)
):
    """View all registered schools across the platform"""
    try:
        result = await db.execute(select(School))
        schools = result.scalars().all()
        return {"success": True, "data": schools}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch institutions array: {str(e)}"
        )

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
    
    try:
        school.is_manually_blocked = not school.is_manually_blocked
        school.status = 'suspended' if school.is_manually_blocked else 'active'
        
        log = AdminActivityLog(
            admin_id=admin.id,
            action="toggle_block_school",
            target_school_id=school_id,
            details={"new_blocked_status": school.is_manually_blocked},
            ip_address=request.client.host
        )
        db.add(log)
        await db.commit()
        return {"success": True, "message": "School status updated successfully", "is_blocked": school.is_manually_blocked}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Status mutation failed: {str(e)}"
        )

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
    
    try:
        log = AdminActivityLog(
            admin_id=admin.id,
            action="delete_school",
            target_school_id=None,
            details={"deleted_school_name": school.name, "deleted_school_id": school_id},
            ip_address=request.client.host
        )
        db.add(log)
        
        await db.delete(school)
        await db.commit()
        return {"success": True, "message": f"School institutional tenant removed successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cascade lifecycle elimination failed: {str(e)}"
        )

@router.get("/audit-logs")
async def get_admin_audit_logs(
    db: AsyncSession = Depends(get_db),
    _ = Depends(get_current_super_admin)
):
    """Fetch global administrative activity logs"""
    try:
        result = await db.execute(select(AdminActivityLog).order_by(AdminActivityLog.created_at.desc()).limit(100))
        return {"success": True, "data": result.scalars().all()}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query compliance audit registry: {str(e)}"
        )