from sqlalchemy.ext.asyncio import AsyncSession
from models import AuditLog
from typing import Any, Optional

async def log_activity(
    db: AsyncSession,
    school_id: int,
    user_id: int,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    details: Optional[dict] = None
):
    """Utility to record administrative actions in the Audit Log"""
    new_log = AuditLog(
        school_id=school_id,
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details
    )
    db.add(new_log)
    # We don't commit here to allow the calling route to commit everything at once
