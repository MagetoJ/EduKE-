from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Notification
from auth import get_current_user, get_current_school

# Mounted with prefix="/api" in main.py → routes live at /api/notifications/...
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# ─── Helper — call from any route to push a notification ─────────────────────

async def create_notification(
    db: AsyncSession,
    school_id: int,
    user_id: int,
    title: str,
    message: str,
    type: str = "info",
    link_url: str = None,
):
    """
    Utility function — import and call from other route handlers to trigger
    notifications (e.g. after grading an assignment or approving leave).
    """
    notif = Notification(
        school_id=school_id,
        user_id=user_id,
        title=title,
        message=message,
        notification_type=type,
        link_url=link_url,
    )
    db.add(notif)
    await db.commit()


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("")
@router.get("/")
async def get_my_notifications(
    db: AsyncSession = Depends(get_db),
    token_data=Depends(get_current_user),   # returns (user, payload) tuple
):
    """
    GET /api/notifications
    Returns the 20 most recent notifications for the logged-in user.
    """
    user, _ = token_data   # unpack — get_current_user returns (User, payload)

    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(20)
    )
    notifications = result.scalars().all()

    return {
        "success": True,
        "data": [
            {
                "id":                n.id,
                "title":             n.title,
                "message":           n.message,
                "notification_type": n.notification_type,
                "link_url":          n.link_url,
                "is_read":           n.is_read,
                "created_at":        n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifications
        ],
    }


@router.put("/{notif_id}/read")
async def mark_notification_read(
    notif_id: int,
    db: AsyncSession = Depends(get_db),
    token_data=Depends(get_current_user),
):
    """Mark a single notification as read"""
    user, _ = token_data

    result = await db.execute(
        select(Notification).where(
            Notification.id == notif_id,
            Notification.user_id == user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    await db.commit()
    return {"success": True}


@router.put("/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    token_data=Depends(get_current_user),
):
    """Mark all unread notifications as read for the current user"""
    user, _ = token_data

    result = await db.execute(
        select(Notification).where(
            Notification.user_id == user.id,
            Notification.is_read == False,
        )
    )
    unread = result.scalars().all()
    for n in unread:
        n.is_read = True

    await db.commit()
    return {"success": True, "marked_read": len(unread)}