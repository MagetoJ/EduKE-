from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from pydantic import BaseModel
from auth import get_current_user # Follow existing authentication dependency patterns
from database import get_db_connection

router = APIRouter(prefix="/api/special-education", tags=["Special Education Module"])

class DeafProfileSchema(BaseModel):
    student_id: str
    ksl_proficiency_level: str
    hearing_loss_degree_left: Optional[str] = None
    hearing_loss_degree_right: Optional[str] = None
    assistive_device_used: Optional[str] = None
    preferred_communication_mode: str

class IEPSchema(BaseModel):
    student_id: str
    academic_year: str
    term: str
    current_performance_summary: str
    annual_goals: List[str]
    accommodations_provided: List[str]
    iep_coordinator_id: str

@router.post("/profile/deaf", status_code=status.HTTP_201_CREATED)
async def save_deaf_profile(profile: DeafProfileSchema, current_user=Depends(get_current_user)):
    # Protect endpoint to authorized users (Super Admin, Admins, Teachers)
    if current_user.role not in ['super_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to alter special needs records.")
        
    async with get_db_connection() as conn:
        await conn.execute(
            """
            INSERT INTO student_deaf_profiles (id, student_id, ksl_proficiency_level, hearing_loss_degree_left, hearing_loss_degree_right, assistive_device_used, preferred_communication_mode)
            VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_id) DO UPDATE SET
                ksl_proficiency_level=excluded.ksl_proficiency_level,
                hearing_loss_degree_left=excluded.hearing_loss_degree_left,
                hearing_loss_degree_right=excluded.hearing_loss_degree_right,
                assistive_device_used=excluded.assistive_device_used,
                preferred_communication_mode=excluded.preferred_communication_mode
            """,
            (profile.student_id, profile.ksl_proficiency_level, profile.hearing_loss_degree_left, 
             profile.hearing_loss_degree_right, profile.assistive_device_used, profile.preferred_communication_mode)
        )
        await conn.commit()
    return {"success": True, "message": "Deaf educational profile saved securely."}

@router.get("/profile/deaf/{student_id}")
async def get_deaf_profile(student_id: str, current_user=Depends(get_current_user)):
    async with get_db_connection() as conn:
        cursor = await conn.execute(
            "SELECT * FROM student_deaf_profiles WHERE student_id = ?", (student_id,)
        )
        row = await cursor.fetchone()
        if not row:
            return {"success": False, "data": None}
        return {"success": True, "data": dict(row)}