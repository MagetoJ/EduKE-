"""
Shared helper for figuring out which HOD(s) a given teacher reports to.

A teacher can end up linked to a department in three different ways in this
schema, so we check all of them:
  1. Explicit DepartmentMembership row (the normal case - HOD added them to
     the roster).
  2. A ClassSubjectAssignment (grade+stream level teaching assignment) for a
     Course that belongs to a department, even if nobody ever added them to
     the roster explicitly.
  3. Course.teacher_id pointing straight at them (the older, single-teacher-
     per-course assignment path).

Class teachers are the tricky case the caller needs to handle: they're
assigned their homeroom by the Admin (ClassTeacherAssignment), which has
NO department link at all. If that's the *only* thing tying them to the
school, none of the three checks above will find anything. Rather than
silently drop their reports/escalations/leave requests into a void, we fall
back to surfacing every HOD in the school, and tell the caller we did that
(`is_fallback=True`) so the UI can be honest about it ("Not yet assigned to
a specific department - showing all HODs" instead of pretending there's a
single clear reporting line).
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import User, Course
from models_roles import AcademicDepartment, DepartmentMembership, ClassSubjectAssignment


async def get_teacher_hods(db: AsyncSession, teacher_id: int, school_id: int):
    """
    Returns (hods, is_fallback) where hods is a list of
    {"id", "name", "email", "department", "department_id"} dicts.
    """
    dept_ids = set()

    membership_res = await db.execute(
        select(DepartmentMembership.department_id).where(
            DepartmentMembership.teacher_id == teacher_id,
            DepartmentMembership.school_id == school_id,
        )
    )
    dept_ids.update(membership_res.scalars().all())

    assignment_res = await db.execute(
        select(Course.department_id)
        .join(ClassSubjectAssignment, ClassSubjectAssignment.course_id == Course.id)
        .where(
            ClassSubjectAssignment.teacher_id == teacher_id,
            ClassSubjectAssignment.school_id == school_id,
            Course.department_id.isnot(None),
        )
    )
    dept_ids.update(d for d in assignment_res.scalars().all() if d)

    direct_res = await db.execute(
        select(Course.department_id).where(
            Course.teacher_id == teacher_id,
            Course.school_id == school_id,
            Course.department_id.isnot(None),
        )
    )
    dept_ids.update(d for d in direct_res.scalars().all() if d)

    hods = []
    if dept_ids:
        hod_res = await db.execute(
            select(User, AcademicDepartment.name, AcademicDepartment.id)
            .join(AcademicDepartment, AcademicDepartment.hod_id == User.id)
            .where(AcademicDepartment.id.in_(dept_ids))
        )
        for user, dept_name, dept_id in hod_res.all():
            hods.append({
                "id": user.id,
                "name": user.full_name,
                "email": user.email,
                "department": dept_name,
                "department_id": dept_id,
            })

    if hods:
        return hods, False

    # Fallback: nothing links this teacher to a specific department (typical
    # for a class-teacher-only account) - surface every HOD in the school so
    # reports/escalations/leave requests are never sent into a void.
    fallback_res = await db.execute(
        select(User, AcademicDepartment.name, AcademicDepartment.id)
        .join(AcademicDepartment, AcademicDepartment.hod_id == User.id)
        .where(AcademicDepartment.school_id == school_id)
    )
    for user, dept_name, dept_id in fallback_res.all():
        hods.append({
            "id": user.id,
            "name": user.full_name,
            "email": user.email,
            "department": dept_name,
            "department_id": dept_id,
        })

    return hods, True