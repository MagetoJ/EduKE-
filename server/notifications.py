from fastapi import APIRouter, Depends
from auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("/")
async def get_notifications(current_user = Depends(get_current_user)):
    """Fetch notifications for the current user (Placeholder)"""
    # Return empty list for now to stop the 404 errors and match user request
    return {
        "success": True,
        "data": []
    }
