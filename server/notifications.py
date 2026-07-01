from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Notification
from auth import get_current_user, get_current_school

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

# --- Helper Function to trigger across the app ---
async def create_notification(db: AsyncSession, school_id: int, user_id: int, title: str, message: str, type: str = "info", link_url: str = None):
    """Call this from other routes (e.g., after grading an assignment)"""
    new_notif = Notification(
        school_id=school_id, 
        user_id=user_id, 
        title=title, 
        message=message, 
        notification_type=type,
        link_url=link_url
    )
    db.add(new_notif)
    await db.commit()

# --- Routes for the UI Dropdown ---
@router.get("")
async def get_my_notifications(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(20)
    )
    return {"success": True, "data": result.scalars().all()}

@router.put("/{notif_id}/read")
async def mark_notification_read(
    notif_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(
        select(Notification).where(Notification.id == notif_id, Notification.user_id == current_user.id)
    )
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()
    return {"success": True}