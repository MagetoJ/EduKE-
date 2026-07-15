from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from database import get_db
from models import User, Course, Student, GradeEntry, Exam, TimetableSlot, LeaveRequest, Asset, AssetMovement
from models_roles import AcademicDepartment, DepartmentMembership
from models_class_teacher import StudentWelfareEscalation
from auth import get_current_user

router = APIRouter(prefix="/api/hod", tags=["Production HOD Command Center"])

# --- Schemas ---
class TeacherAssignPayload(BaseModel):
    teacher_id: int

class ResolutionPayload(BaseModel):
    resolution_details: str

class LeaveReviewPayload(BaseModel):
    action: str # "approve_hod" | "reject_hod"

class AssetMovementPayload(BaseModel):
    asset_id: int
    quantity: int
    movement_type: str # "IN" | "OUT"
    notes: Optional[str] = None

# --- Dependency Helper ---
async def get_managed_department(db: AsyncSession, user_id: int, school_id: int) -> AcademicDepartment:
    result = await db.execute(
        select(AcademicDepartment).where(
            AcademicDepartment.hod_id == user_id,
            AcademicDepartment.school_id == school_id
        )
    )
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Current user is not the active HOD of any department."
        )
    return dept

# ==================== 1 & 2. ACADEMIC OVERSIGHT & ROSTER ====================

@router.get("/my-department")
async def get_department_details(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns basic directory info alongside course codes and syllabus mock coverage integers"""
    dept = await get_managed_department(db, current_user.id, current_user.school_id)
    
    # Load Member Faculty
    members_result = await db.execute(
        select(User)
        .join(DepartmentMembership, User.id == DepartmentMembership.teacher_id)
        .where(DepartmentMembership.department_id == dept.id)
    )
    teachers = members_result.scalars().all()

    # Load Overseen Courses
    courses_result = await db.execute(select(Course).where(Course.department_id == dept.id))
    courses = courses_result.scalars().all()

    # Calculate mock workload hours based on timetable slots for each teacher
    teacher_data = []
    for t in teachers:
        slots_res = await db.execute(select(func.count(TimetableSlot.id)).where(TimetableSlot.teacher_id == t.id))
        assigned_periods = slots_res.scalar() or 0
        teacher_data.append({
            "id": t.id,
            "name": t.full_name,
            "email": t.email,
            "weekly_periods": assigned_periods
        })

    return {
        "success": True,
        "data": {
            "id": dept.id,
            "name": dept.name,
            "code": dept.code,
            "teachers": teacher_data,
            "courses": [
                {
                    "id": c.id, 
                    "name": c.name, 
                    "code": c.code, 
                    "grade": c.grade,
                    "syllabus_coverage": (c.id * 17) % 31 + 45 # Deterministic mock syllabus coverage percent
                } for c in courses
            ]
        }
    }

@router.post("/staff/assign")
async def assign_teacher(payload: TeacherAssignPayload, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    dept = await get_managed_department(db, current_user.id, current_user.school_id)
    exists = await db.execute(select(DepartmentMembership).where(DepartmentMembership.department_id == dept.id, DepartmentMembership.teacher_id == payload.teacher_id))
    if exists.scalar_one_or_none():
        return {"success": True, "message": "Teacher already on roster."}
    
    db.add(DepartmentMembership(school_id=current_user.school_id, department_id=dept.id, teacher_id=payload.teacher_id))
    await db.commit()
    return {"success": True, "message": "Teacher appended to department."}

@router.delete("/staff/unassign/{teacher_id}")
async def unassign_teacher(teacher_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    dept = await get_managed_department(db, current_user.id, current_user.school_id)
    await db.execute(delete(DepartmentMembership).where(DepartmentMembership.department_id == dept.id, DepartmentMembership.teacher_id == teacher_id))
    await db.commit()
    return {"success": True, "message": "Teacher unassigned."}

# ==================== 3. ANALYTICS & MONITORING ====================

@router.get("/subject-overview")
async def get_subject_performance(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Computes comparative academic distributions across courses overseen by this department"""
    dept = await get_managed_department(db, current_user.id, current_user.school_id)
    
    query = (
        select(Course.id, Course.name, Course.grade, func.avg(GradeEntry.score))
        .join(Exam, Course.id == Exam.subject_id)
        .join(GradeEntry, Exam.id == GradeEntry.exam_id)
        .where(Course.department_id == dept.id)
        .group_by(Course.id, Course.name, Course.grade)
    )
    result = await db.execute(query)
    rows = result.all()
    
    return {
        "success": True,
        "data": [
            {
                "course_id": r[0],
                "course_name": f"{r[1]} ({r[2]})",
                "average_score": round(r[3], 2) if r[3] is not None else 0.0
            } for r in rows
        ]
    }

# ==================== 4. FIRST-TIER LEAVE APPROVALS ====================

@router.get("/leave-requests")
async def get_departmental_leave(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Lists leave metrics submitted by instructors inside this HOD's department"""
    dept = await get_managed_department(db, current_user.id, current_user.school_id)
    
    query = (
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.user))
        .join(DepartmentMembership, LeaveRequest.user_id == DepartmentMembership.teacher_id)
        .where(
            DepartmentMembership.department_id == dept.id,
            LeaveRequest.status == "pending"
        )
    )
    result = await db.execute(query)
    requests = result.scalars().all()
    
    return {
        "success": True,
        "data": [
            {
                "id": r.id,
                "staff_name": r.user.full_name if r.user else "Unknown",
                "leave_type": r.leave_type,
                "start_date": r.start_date.strftime("%Y-%m-%d"),
                "end_date": r.end_date.strftime("%Y-%m-%d"),
                "reason": r.reason,
                "status": r.status
            } for r in requests
        ]
    }

@router.post("/leave-requests/{request_id}/review")
async def review_leave_request(
    request_id: int,
    payload: LeaveReviewPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Allows HOD to flag a leave row before central administration handles closing out the processing loop"""
    dept = await get_managed_department(db, current_user.id, current_user.school_id)
    
    req_res = await db.execute(select(LeaveRequest).where(LeaveRequest.id == request_id))
    leave_req = req_res.scalar_one_or_none()
    if not leave_req:
        raise HTTPException(status_code=404, detail="Leave record not found.")
        
    if payload.action == "approve_hod":
        leave_req.status = "approved_by_hod" # Pushes up to the HR/Admin visibility dashboard tier
    else:
        leave_req.status = "rejected"
        
    await db.commit()
    return {"success": True, "message": f"Leave request status updated to {leave_req.status}."}

# ==================== 5. QUALITY ASSURANCE (ESCALATIONS) ====================

@router.get("/escalations")
async def get_departmental_escalations(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    dept = await get_managed_department(db, current_user.id, current_user.school_id)
    from models import StudentCourseEnrollment

    courses_res = await db.execute(select(Course.id).where(Course.department_id == dept.id))
    course_ids = [c[0] for c in courses_res.all()]
    if not course_ids:
        return {"success": True, "data": []}

    query = (
        select(StudentWelfareEscalation)
        .options(selectinload(StudentWelfareEscalation.student))
        .join(Student, StudentWelfareEscalation.student_id == Student.id)
        .join(StudentCourseEnrollment, Student.id == StudentCourseEnrollment.student_id)
        .where(StudentCourseEnrollment.course_id.in_(course_ids), StudentWelfareEscalation.status == "pending")
        .distinct()
    )
    result = await db.execute(query)
    return {
        "success": True,
        "data": [
            {
                "id": e.id,
                "student_name": f"{e.student.first_name} {e.student.last_name}" if e.student else "Unknown",
                "reason": e.reason,
                "details": e.details,
                "status": e.status,
                "created_at": e.created_at.strftime("%Y-%m-%d")
            } for e in result.scalars().all()
        ]
    }

@router.post("/escalations/{escalation_id}/resolve")
async def resolve_escalation(escalation_id: int, payload: ResolutionPayload, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await get_managed_department(db, current_user.id, current_user.school_id)
    esc_res = await db.execute(select(StudentWelfareEscalation).where(StudentWelfareEscalation.id == escalation_id))
    esc = esc_res.scalar_one_or_none()
    if not esc: raise HTTPException(status_code=404, detail="Escalation not found.")
    
    esc.status = "resolved"
    esc.details = (esc.details or "") + f"\n[HOD Resolution]: {payload.resolution_details}"
    await db.commit()
    return {"success": True, "message": "Escalation closed."}

# ==================== 6. RESOURCE MANAGEMENT (INVENTORY) ====================

@router.get("/inventory")
async def get_departmental_inventory(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetches physical asset allocations assigned to this specific department"""
    dept = await get_managed_department(db, current_user.id, current_user.school_id)
    
    result = await db.execute(select(Asset).where(Asset.department_id == dept.id))
    assets = result.scalars().all()
    
    return {
        "success": True,
        "data": [
            {
                "id": a.id,
                "name": a.name,
                "sku": a.sku,
                "quantity": a.quantity,
                "asset_type": a.asset_type
            } for a in assets
        ]
    }

@router.post("/inventory/movement")
async def log_asset_movement(payload: AssetMovementPayload, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Logs check-outs or allocations of lab equipment/textbooks inside the department"""
    await get_managed_department(db, current_user.id, current_user.school_id)
    
    asset_res = await db.execute(select(Asset).where(Asset.id == payload.asset_id))
    asset = asset_res.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset structure not found.")
        
    if payload.movement_type == "OUT":
        if asset.quantity < payload.quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock item quantities.")
        asset.quantity -= payload.quantity
    else:
        asset.quantity += payload.quantity
        
    movement = AssetMovement(
        asset_id=payload.asset_id,
        user_id=current_user.id,
        quantity=payload.quantity,
        movement_type=payload.movement_type,
        notes=payload.notes
    )
    db.add(movement)
    await db.commit()
    return {"success": True, "message": "Asset ledger tracked successfully."}