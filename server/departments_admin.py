from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from typing import Optional
from sqlalchemy import select, func
from pydantic import BaseModel

from database import get_db
from models import User, UserRole, school_users, School
from models_roles import AcademicDepartment
from auth import get_current_user, get_current_school, require_roles
from hod_shared import ensure_hod_not_already_assigned, set_user_role_in_school, reassign_department_hod

router = APIRouter(prefix="/api/admin/departments", tags=["Admin: Departments & HOD"])

# Only school admins / super admins may manage departments and appoint HODs
require_admin = require_roles("admin", "super_admin")


class DepartmentPayload(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    hod_id: Optional[int] = None


async def _serialize(db: AsyncSession, dept: AcademicDepartment) -> dict:
    hod_name = None
    if dept.hod_id:
        result = await db.execute(select(User.full_name).where(User.id == dept.hod_id))
        hod_name = result.scalar_one_or_none()

    return {
        "id": dept.id,
        "name": dept.name,
        "code": dept.code,
        "description": dept.description,
        "hod_id": dept.hod_id,
        "hod_name": hod_name,
    }


def _resolve_school_id(current_school: Optional[School], current_user: User, fallback: Optional[int]) -> int:
    if current_school:
        return current_school.id
    if current_user.is_super_admin and fallback:
        return fallback
    raise HTTPException(status_code=400, detail="Unable to determine target school")


@router.get("")
@router.get("/")
async def list_departments(
    school_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
    current_school: Optional[School] = Depends(get_current_school),
):
    target_school_id = _resolve_school_id(current_school, current_user, school_id)

    result = await db.execute(
        select(AcademicDepartment).where(AcademicDepartment.school_id == target_school_id)
    )
    departments = result.scalars().all()
    return [await _serialize(db, dept) for dept in departments]


@router.post("")
@router.post("/")
async def create_department(
    payload: DepartmentPayload,
    school_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
    current_school: Optional[School] = Depends(get_current_school),
):
    target_school_id = _resolve_school_id(current_school, current_user, school_id)

    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Department name is required")

    # --- NEW: Duplicate Department Check ---
    existing_check = await db.execute(
        select(AcademicDepartment).where(
            AcademicDepartment.school_id == target_school_id,
            func.lower(AcademicDepartment.name) == clean_name.lower()
        )
    )
    if existing_check.scalar_one_or_none():
        raise HTTPException(
            status_code=400, 
            detail=f"A department named '{clean_name}' already exists in this school."
        )
    # ---------------------------------------

    dept = AcademicDepartment(
        school_id=target_school_id,
        name=clean_name,
        code=(payload.code or "").strip() or clean_name[:6].upper(),
        description=payload.description,
        hod_id=None,
    )
    db.add(dept)
    await db.flush()

    if payload.hod_id:
        hod_result = await db.execute(
            select(User).where(User.id == payload.hod_id)
        )
        hod_user = hod_result.scalar_one_or_none()
        if not hod_user:
            raise HTTPException(status_code=404, detail="Selected HOD staff member was not found")

        # Prevent the same staff member from being HOD of two departments at once
        await ensure_hod_not_already_assigned(db, payload.hod_id, target_school_id)

        dept.hod_id = payload.hod_id
        await set_user_role_in_school(db, payload.hod_id, target_school_id, UserRole.HOD)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="This department name or HOD assignment conflicts with an existing one "
                    "(likely a duplicate request submitted at the same time). Please refresh and try again.",
        )
    await db.refresh(dept)
    return await _serialize(db, dept)


@router.put("/{department_id}")
async def update_department(
    department_id: int,
    payload: DepartmentPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
    current_school: Optional[School] = Depends(get_current_school),
):
    result = await db.execute(select(AcademicDepartment).where(AcademicDepartment.id == department_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    if current_school and dept.school_id != current_school.id:
        raise HTTPException(status_code=403, detail="Department does not belong to this school")

    dept.name = payload.name.strip() or dept.name
    if payload.code is not None:
        dept.code = payload.code.strip() or dept.code
    dept.description = payload.description

    new_hod_id = payload.hod_id

    if new_hod_id != dept.hod_id:
        if new_hod_id:
            hod_result = await db.execute(select(User).where(User.id == new_hod_id))
            hod_user = hod_result.scalar_one_or_none()
            if not hod_user:
                raise HTTPException(status_code=404, detail="Selected HOD staff member was not found")

        # reassign_department_hod rejects (400) if new_hod_id is already HOD of
        # another department, demotes the outgoing HOD to TEACHER, promotes the
        # incoming HOD, and updates dept.hod_id -- all in one consistent place.
        await reassign_department_hod(db, dept, new_hod_id)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="This department name or HOD assignment conflicts with an existing one "
                    "(likely a duplicate request submitted at the same time). Please refresh and try again.",
        )
    await db.refresh(dept)
    return await _serialize(db, dept)


@router.delete("/{department_id}")
async def delete_department(
    department_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
    current_school: Optional[School] = Depends(get_current_school),
):
    result = await db.execute(select(AcademicDepartment).where(AcademicDepartment.id == department_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    if current_school and dept.school_id != current_school.id:
        raise HTTPException(status_code=403, detail="Department does not belong to this school")

    # Demote the assigned HOD back to a regular teacher before removing the department
    if dept.hod_id:
        await set_user_role_in_school(db, dept.hod_id, dept.school_id, UserRole.TEACHER)

    await db.delete(dept)
    await db.commit()
    return {"success": True}