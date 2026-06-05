from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import LeaveRequest, User
from auth import get_current_school

router = APIRouter(prefix="/leave-requests", tags=["Leave Management"])

@router.get("/")
async def get_leave_requests(
    school = Depends(get_current_school),
    db: AsyncSession = Depends(get_db)
):
    """Fetch leave requests for the current school"""
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
            "created_at": leave.created_at.isoformat()
        })
    
    return {"success": True, "data": data}
