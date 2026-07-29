from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import LeaveRequest, User, School, Notification
from auth import get_current_school, get_current_user, require_roles
from pydantic import BaseModel, model_validator
from typing import Optional
from datetime import date as datetime_date
from reporting import get_teacher_hods

router = APIRouter(prefix="/leave-requests", tags=["Leave Management"])

# Anyone who can actually hold a job at the school and therefore request
# leave. Deliberately excludes "student" and "parent".
STAFF_ROLES = (
    "admin", "teacher", "class_teacher", "hod", "staff", "registrar",
    "exam_officer", "timetable_manager", "transport_manager",
    "boarding_master", "cbc_coordinator", "hr_manager",
    "admission_officer", "nurse", "counselor", "librarian", "super_admin",
)

# Who's allowed to see the full leave-request list. Matches the role set
# Dashboard.tsx already relies on when it calls this endpoint alongside
# /api/dashboard/stats — widening this beyond "admin" is intentional, not
# a security relaxation, since these are all school-management roles.
LEAVE_VIEW_ROLES = (
    "admin", "registrar", "exam_officer", "hod", "transport_manager",
    "boarding_master", "cbc_coordinator", "hr_manager",
    "admission_officer", "nurse", "super_admin",
)

# Who can actually approve/reject a leave request. Deliberately narrower
# than LEAVE_VIEW_ROLES — being able to see the list isn't the same as
# being an approver. NOTE: the frontend's accessControl.ts currently lets
# 'teacher' load the /dashboard/leave page too; if Leave.tsx shows an
# approve/reject button to teachers, that button will now 403 against
# this guard. Worth checking Leave.tsx's conditional rendering — a
# teacher being able to approve leave requests (including their own)
# would be its own bug independent of this fix.
APPROVER_ROLES = ("admin", "hod", "hr_manager", "super_admin")

# --- Schemas ---
class LeaveRequestCreate(BaseModel):
    leave_type: Optional[str] = None
    leave_type_id: Optional[int] = None  # Added to accept frontend parameter IDs
    start_date: datetime_date
    end_date: datetime_date
    reason: str

    @model_validator(mode="before")
    @classmethod
    def resolve_leave_type_name(cls, data: dict) -> dict:
        """
        Maps numerical leave_type_ids from the UI select options 
        to their respective descriptive database string titles.
        """
        if isinstance(data, dict):
            # If the frontend sent leave_type_id but leave_type string is missing
            if "leave_type_id" in data and not data.get("leave_type"):
                mapping = {
                    1: "Annual Leave",
                    2: "Sick Leave",
                    3: "Maternity Leave",
                    4: "Paternity Leave",
                    5: "Emergency Leave"
                }
                # Fallback to the ID string if it's outside the standard select list
                data["leave_type"] = mapping.get(int(data["leave_type_id"]), f"Leave Type #{data['leave_type_id']}")
        return data

class LeaveStatusUpdate(BaseModel):
    status: str  # approved, rejected, cancelled
    rejection_reason: Optional[str] = None

# --- Routes ---

@router.get("")
@router.get("/")
async def get_leave_requests(
    school: School = Depends(get_current_school),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*LEAVE_VIEW_ROLES)),
):
    """Fetch leave requests for the current school (management view only)"""
    query = select(LeaveRequest, User.full_name).join(User, LeaveRequest.user_id == User.id).where(
        LeaveRequest.school_id == school.id
    ).order_by(LeaveRequest.created_at.desc())
    
    result = await db.execute(query)
    rows = result.all()
    
    data = []
    for leave, full_name in rows:
        data.append({
            "id": str(leave.id),
            "staff_name": full_name,
            "leave_type_name": leave.leave_type,
            "start_date": leave.start_date.isoformat(),
            "end_date": leave.end_date.isoformat(),
            "reason": leave.reason,
            "status": leave.status,
            "created_at": leave.created_at.isoformat() if hasattr(leave, 'created_at') and leave.created_at else None
        })
    
    return {"success": True, "data": data}

@router.post("")
@router.post("/")
async def create_leave_request(
    data: LeaveRequestCreate,
    token_data: tuple = Depends(get_current_user),  # Receives authentication dependency data tuple safely
    current_school: School = Depends(get_current_school),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*STAFF_ROLES)),
):
    """Submit a new leave request for a staff member belonging to the school node"""
    # Safely unpack the unified User model from the authorization dependency payload tuple
    current_user, payload = token_data

    if data.start_date > data.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Start date cannot occur after end date"
        )

    new_leave = LeaveRequest(
        school_id=current_school.id,
        user_id=current_user.id,
        leave_type=data.leave_type or "General Leave",
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason,
        status="pending"
    )
    
    db.add(new_leave)

    # First-tier review is the HOD (see /api/hod/leave-requests): make sure
    # they actually find out a request is waiting instead of only seeing it
    # if they happen to check that page.
    hods, _ = await get_teacher_hods(db, current_user.id, current_school.id)
    for hod in hods:
        db.add(Notification(
            school_id=current_school.id,
            user_id=hod["id"],
            title="New Leave Request",
            message=f"{current_user.full_name} requested {new_leave.leave_type} from {data.start_date} to {data.end_date}.",
            notification_type="info",
            link_url="/dashboard/hod"
        ))

    await db.commit()
    await db.refresh(new_leave)
    
    return {
        "success": True, 
        "message": "Leave request submitted successfully",
        "data": {
            "id": str(new_leave.id),
            "staff_name": current_user.full_name,
            "leave_type_name": new_leave.leave_type,
            "start_date": new_leave.start_date.isoformat(),
            "end_date": new_leave.end_date.isoformat(),
            "reason": new_leave.reason,
            "status": new_leave.status
        }
    }

@router.put("/{request_id}/status")
@router.put("/{request_id}/status/")
async def update_leave_status(
    request_id: int,
    data: LeaveStatusUpdate,
    school: School = Depends(get_current_school),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*APPROVER_ROLES)),
):
    """Approve or Deny a leave request (Admin/HOD workflow)"""
    query = select(LeaveRequest).where(
        LeaveRequest.id == request_id,
        LeaveRequest.school_id == school.id
    )
    result = await db.execute(query)
    leave = result.scalar_one_or_none()
    
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
        
    leave.status = data.status.lower()
    await db.commit()
    
    return {"success": True, "message": f"Leave request status changed to {data.status}"}