"""
Single source of truth for HOD (Head of Department) assignment rules.

Three different endpoints used to each implement their own version of
"one HOD per department" (departments_admin.py, users.py's /assign-hod,
and main.py's staff editor). They drifted out of sync with each other,
which is what allowed a department to end up with two different people
both flagged as "HOD" -- one correctly set via `academic_departments.hod_id`,
another set only via `school_users.role = HOD` with no department link at
all (the Staff directory edit form).

Every code path that assigns/revokes a HOD MUST go through the helpers
below so the invariant actually holds:

    A staff member can be hod_id on at most ONE academic_departments row
    per school, and school_users.role == HOD if and only if that user is
    currently someone's hod_id.
"""

from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models import UserRole, school_users
from models_roles import AcademicDepartment


async def ensure_hod_not_already_assigned(
    db: AsyncSession,
    hod_id: int,
    school_id: int,
    exclude_department_id: Optional[int] = None,
) -> None:
    """
    Enforces: a staff member can only be HOD of ONE department at a time.
    Raises 400 if `hod_id` is already HOD of a different department in the
    same school. We reject instead of silently clearing/overwriting --
    silent clearing is what caused departments to show stale/wrong HODs
    before.
    """
    query = select(AcademicDepartment).where(
        AcademicDepartment.hod_id == hod_id,
        AcademicDepartment.school_id == school_id,
    )
    if exclude_department_id is not None:
        query = query.where(AcademicDepartment.id != exclude_department_id)

    result = await db.execute(query)
    conflicting_dept = result.scalar_one_or_none()
    if conflicting_dept:
        raise HTTPException(
            status_code=400,
            detail=(
                f"This staff member is already HOD of '{conflicting_dept.name}'. "
                f"Revoke that assignment first before assigning them to another department."
            ),
        )


async def set_user_role_in_school(
    db: AsyncSession, user_id: int, school_id: int, role: UserRole
) -> None:
    """Sets a user's primary role within a school (used to appoint/demote HODs)."""
    await db.execute(
        update(school_users)
        .where(school_users.c.user_id == user_id, school_users.c.school_id == school_id)
        .values(role=role)
    )


async def reassign_department_hod(
    db: AsyncSession,
    dept: AcademicDepartment,
    new_hod_id: Optional[int],
) -> None:
    """
    Full, consistent HOD reassignment for a single department:
      1. Rejects if `new_hod_id` is already HOD elsewhere in this school.
      2. Demotes the department's outgoing HOD (if any) back to TEACHER.
      3. Promotes the incoming HOD (if any) to HOD.
      4. Updates `dept.hod_id`.

    Callers still need to `db.commit()` themselves.
    """
    old_hod_id = dept.hod_id
    if new_hod_id == old_hod_id:
        return

    if new_hod_id:
        await ensure_hod_not_already_assigned(
            db, new_hod_id, dept.school_id, exclude_department_id=dept.id
        )

    if old_hod_id:
        await set_user_role_in_school(db, old_hod_id, dept.school_id, UserRole.TEACHER)

    if new_hod_id:
        await set_user_role_in_school(db, new_hod_id, dept.school_id, UserRole.HOD)

    dept.hod_id = new_hod_id