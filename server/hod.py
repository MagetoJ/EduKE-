from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from database import get_db
from models import User, Course, Student, GradeEntry, Exam, TimetableSlot, LeaveRequest, Asset, AssetMovement, Notification, school_users, UserRole
from models_roles import AcademicDepartment, DepartmentMembership
from models_class_teacher import StudentWelfareEscalation, ClassProgressReport, ProgressReportComment
from auth import get_current_user

router = APIRouter(prefix="/api/hod", tags=["Production HOD Command Center"])

# --- Schemas ---
class TeacherAssignPayload(BaseModel):
    teacher_id: int

class ResolutionPayload(BaseModel):
    resolution_details: str

class LeaveReviewPayload(BaseModel):
    action: str # "approve_hod" | "reject_hod"

class AssetMovementPayload(BaseModel):
    asset_id: int
    quantity: int
    movement_type: str # "IN" | "OUT"
    notes: Optional[str] = None

class CourseAssignPayload(BaseModel):
    teacher_id: int

class HODProgressCommentPayload(BaseModel):
    comment: str

class AddRosterTeacherPayload(BaseModel):
    teacher_id: int

# --- Auth Dependency Helper ---
# NOTE: auth.get_current_user returns a (User, jwt_payload) TUPLE, not a bare
# User object -- and the User model itself has no `school_id`/`role` columns
# (those live only in the `school_users` join table). Every endpoint in this
# file previously did `current_user: User = Depends(get_current_user)` and
# then read `current_user.school_id`, which would raise AttributeError on a
# tuple at runtime. This wrapper unpacks the tuple once and attaches the
# school_id pulled from the JWT payload, so the rest of the file below can
# keep using the simple `current_user.id` / `current_user.school_id` pattern
# safely.
async def get_current_hod_user(token_data: tuple = Depends(get_current_user)) -> User:
    user, payload = token_data
    school_id = payload.get("school_id")
    if not school_id:
        raise HTTPException(status_code=403, detail="Access token is not scoped to a specific school")
    user.school_id = school_id  # transient attribute, not a mapped column -- never persisted
    return user

# --- Department Dependency Helper ---
async def get_managed_department(db: AsyncSession, user_id: int, school_id: int) -> AcademicDepartment:
    result = await db.execute(
        select(AcademicDepartment).where(
            AcademicDepartment.hod_id == user_id,
            AcademicDepartment.school_id == school_id
        )
    )
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Current user is not the active HOD of any department."
        )
    return dept

# ==================== 1 & 2. ACADEMIC OVERSIGHT & ROSTER ====================

@router.get("/my-department")
async def get_department_details(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_hod_user)
):
    """
    Returns department parameters, auto-healing unassigned HOD profiles 
    safely on execution.
    """
    user = current_user
    school_id = user.school_id  # transient attribute set by get_current_hod_user

    # 1. Attempt to find a department where this user is explicitly registered as HOD
    dept_res = await db.execute(
        select(AcademicDepartment)
        .where(AcademicDepartment.hod_id == user.id) # Use unpacked 'user.id'
    )
    dept = dept_res.scalar_one_or_none()
    
    # DYNAMIC SELF-HEALING ENHANCEMENT:
    if not dept:
        user_dept_str = getattr(user, 'department', '') or ''
        
        fallback_query = select(AcademicDepartment).where(
            AcademicDepartment.school_id == school_id,
            AcademicDepartment.hod_id.is_(None)
        )
        
        if user_dept_str:
            fallback_query = fallback_query.where(
                AcademicDepartment.name.ilike(f"%{user_dept_str}%")
            )
            
        fallback_res = await db.execute(fallback_query)
        dept = fallback_res.scalars().first()
        
        if dept:
            # Found an unassigned department cluster slot! Claim it for this user
            dept.hod_id = user.id
            await db.flush()
        else:
            # Provision a new localized department slot for this school tenant instantly
            target_name = f"{user_dept_str or 'Sciences'} Department"
            target_code = "SCI"
            if "lang" in user_dept_str.lower() or "eng" in user_dept_str.lower():
                target_code = "LANG"
            elif "math" in user_dept_str.lower():
                target_code = "MATH"
            elif "hum" in user_dept_str.lower():
                target_code = "HUM"
            elif "tech" in user_dept_str.lower() or "app" in user_dept_str.lower():
                target_code = "TECH"

            dept = AcademicDepartment(
                name=target_name,
                code=target_code,
                school_id=school_id,
                hod_id=user.id
            )
            db.add(dept)
            await db.flush()

    # Ensure the department row possesses the correct multi-tenant school ID
    if not dept.school_id or dept.school_id != school_id:
        dept.school_id = school_id
        await db.flush()

    # Auto-link this school's courses to their correct department rows
    subject_keywords_by_code = {
        "MATH": ["Mathematics", "Computer Studies"],
        "LANG": ["English", "Kiswahili", "French", "German", "Languages"],
        "SCI": ["Chemistry", "Physics", "Biology", "Science"],
        "HUM": ["History", "Geography", "CRE", "IRE"],
        "TECH": ["Agriculture", "Business", "Home Science", "Music"]
    }

    if dept.code in subject_keywords_by_code:
        for keyword in subject_keywords_by_code[dept.code]:
            await db.execute(
                update(Course)
                .where(
                    Course.school_id == school_id,
                    Course.name.ilike(f"%{keyword}%"),
                    Course.department_id.is_(None)
                )
                .values(department_id=dept.id)
            )
        await db.flush()

    # Query registered teachers on this department's roster
    members_result = await db.execute(
        select(User)
        .join(DepartmentMembership, User.id == DepartmentMembership.teacher_id)
        .where(DepartmentMembership.department_id == dept.id)
    )
    teachers = members_result.scalars().all()

    # Query overseen courses matching this school and department scope
    courses_result = await db.execute(
        select(Course)
        .where(Course.department_id == dept.id, Course.school_id == school_id)
    )
    courses = courses_result.scalars().all()

    # Calculate workload per teacher within this department
    teacher_data = []
    for t in teachers:
        slots_res = await db.execute(
            select(func.count(TimetableSlot.id))
            .where(TimetableSlot.teacher_id == t.id, TimetableSlot.school_id == school_id)
        )
        assigned_periods = slots_res.scalar() or 0
        teacher_data.append({
            "id": t.id,
            "name": t.full_name,
            "email": t.email,
            "weekly_periods": assigned_periods
        })

    # Assemble course metrics with real tracking percentages
    course_data = []
    for c in courses:
        report_res = await db.execute(
            select(ClassProgressReport)
            .where(ClassProgressReport.course_id == c.id)
            .order_by(ClassProgressReport.created_at.desc())
            .limit(1)
        )
        latest_report = report_res.scalar_one_or_none()
        coverage = latest_report.syllabus_coverage_percent if latest_report else 0

        assigned_teacher = None
        if c.teacher_id:
            teacher_res = await db.execute(select(User).where(User.id == c.teacher_id))
            t_user = teacher_res.scalar_one_or_none()
            assigned_teacher = {"id": t_user.id, "name": t_user.full_name} if t_user else None

        course_data.append({
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "grade": c.grade,
            "syllabus_coverage": coverage,
            "assigned_teacher": assigned_teacher
        })

    await db.commit()

    return {
        "success": True,
        "data": {
            "id": dept.id,
            "name": dept.name,
            "code": dept.code,
            "teachers": teacher_data,
            "courses": course_data
        }
    }

@router.post("/courses/{course_id}/assign")
async def assign_course_teacher(
    course_id: int,
    payload: CourseAssignPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_hod_user)
):
    """Binds a teacher from the HOD's roster to teach a specific Course"""
    dept = await get_managed_department(db, current_user.id, current_user.school_id)

    # Verify course belongs to HOD department
    course_res = await db.execute(select(Course).where(Course.id == course_id, Course.department_id == dept.id))
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found in this department.")

    # Verify teacher is a registered member of this department
    member_res = await db.execute(
        select(DepartmentMembership)
        .where(DepartmentMembership.department_id == dept.id, DepartmentMembership.teacher_id == payload.teacher_id)
    )
    if not member_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Teacher is not a member of this department.")

    course.teacher_id = payload.teacher_id

    # Automatic Sync: Update matching Weekly Timetable Slots with the assigned teacher ID
    await db.execute(
        update(TimetableSlot)
        .where(TimetableSlot.subject_id == course_id)
        .values(teacher_id=payload.teacher_id)
    )

    # Notify Teacher
    db.add(Notification(
        school_id=current_user.school_id,
        user_id=payload.teacher_id,
        title="New Class Assignment",
        message=f"You have been assigned to teach {course.name} ({course.code}) by the HOD.",
        notification_type="info",
        link_url="/dashboard/teacher"
    ))

    await db.commit()
    return {"success": True, "message": "Successfully assigned class to teacher."}


@router.get("/progress-reports")
async def get_department_progress_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_hod_user)
):
    """Aggregates all filed progress reports across department courses with comments"""
    dept = await get_managed_department(db, current_user.id, current_user.school_id)

    result = await db.execute(
        select(ClassProgressReport)
        .options(
            selectinload(ClassProgressReport.comments).selectinload(ProgressReportComment.author),
            selectinload(ClassProgressReport.course)
        )
        .join(Course, ClassProgressReport.course_id == Course.id)
        .where(Course.department_id == dept.id)
        .order_by(ClassProgressReport.created_at.desc())
    )
    reports = result.scalars().all()

    return {
        "success": True,
        "data": [
            {
                "id": r.id,
                "course_name": r.course.name,
                "course_code": r.course.code,
                "week_start": r.week_start_date.strftime("%Y-%m-%d"),
                "topics_covered": r.topics_covered,
                "coverage_percent": r.syllabus_coverage_percent,
                "challenges": r.challenges,
                "blockers": r.blockers,
                "comments": [
                    {
                        "id": c.id,
                        "author_name": c.author.full_name,
                        "comment": c.comment,
                        "created_at": c.created_at.strftime("%Y-%m-%d %H:%M")
                    } for c in r.comments
                ]
            } for r in reports
        ]
    }


@router.post("/progress-reports/{report_id}/comment")
async def add_report_comment(
    report_id: int,
    payload: HODProgressCommentPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_hod_user)
):
    """Provides a multi-directional dialogue channel on teacher progress updates"""
    dept = await get_managed_department(db, current_user.id, current_user.school_id)
    report_res = await db.execute(
        select(ClassProgressReport)
        .options(selectinload(ClassProgressReport.course))
        .join(Course, ClassProgressReport.course_id == Course.id)
        .where(ClassProgressReport.id == report_id, Course.department_id == dept.id)
    )
    report = report_res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Progress report target scope invalid.")

    comment = ProgressReportComment(
        school_id=current_user.school_id,
        report_id=report_id,
        author_id=current_user.id,
        comment=payload.comment
    )
    db.add(comment)

    # Notify Teacher of HOD feedback
    db.add(Notification(
        school_id=current_user.school_id,
        user_id=report.teacher_id,
        title="New HOD Syllabus Feedback",
        message=f"The HOD left feedback on your progress report for {report.course.name}.",
        notification_type="warning",
        link_url="/dashboard/teacher"
    ))

    await db.commit()
    return {"success": True, "message": "Feedback submitted successfully."}


# ==================== ROSTER: LIMITED-SCOPE STAFF MANAGEMENT ====================
# The HOD is intentionally NOT a School Admin. These endpoints only let the
# HOD (a) see teachers already on their own department roster together with
# ONLY the subjects those teachers teach inside this department, (b) pick
# existing school teachers to add to that roster, and (c) add them. They
# cannot create accounts, edit salaries, or touch anything outside their
# own department_id.

@router.get("/staff-roster")
async def get_department_staff_roster(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_hod_user)
):
    """
    Returns only teachers assigned to this HOD's department, including ONLY
    the courses they teach within this department (not their subjects in
    other departments, if any).
    """
    dept = await get_managed_department(db, current_user.id, current_user.school_id)

    teachers_query = (
        select(User)
        .join(DepartmentMembership, User.id == DepartmentMembership.teacher_id)
        .where(DepartmentMembership.department_id == dept.id)
    )
    teachers_res = await db.execute(teachers_query)
    teachers = teachers_res.scalars().all()

    roster_data = []
    for t in teachers:
        courses_query = (
            select(Course)
            .where(Course.teacher_id == t.id, Course.department_id == dept.id)
        )
        courses_res = await db.execute(courses_query)
        department_courses = courses_res.scalars().all()

        course_ids = [c.id for c in department_courses]
        periods_count = 0
        if course_ids:
            periods_query = (
                select(func.count(TimetableSlot.id))
                .where(TimetableSlot.teacher_id == t.id, TimetableSlot.subject_id.in_(course_ids))
            )
            periods_res = await db.execute(periods_query)
            periods_count = periods_res.scalar() or 0

        roster_data.append({
            "id": t.id,
            "name": t.full_name,
            "email": t.email,
            "department_courses": [
                {"id": c.id, "name": c.name, "code": c.code, "grade": c.grade}
                for c in department_courses
            ],
            "department_periods": periods_count
        })

    return {
        "success": True,
        "data": roster_data
    }

@router.get("/eligible-teachers")
async def get_eligible_school_teachers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_hod_user)
):
    """
    Returns all teaching faculty in the school who are NOT currently in this department roster.
    Includes both standard teachers and class teachers.
    """
    user = current_user
    school_id = user.school_id  # transient attribute set by get_current_hod_user

    dept = await get_managed_department(db, user.id, school_id)
    
    # Get IDs of teachers already in this department to avoid duplicates
    existing_members_query = select(DepartmentMembership.teacher_id).where(DepartmentMembership.department_id == dept.id)
    existing_members_res = await db.execute(existing_members_query)
    existing_ids = existing_members_res.scalars().all()
    
    # Query all eligible instructors (Supports both generic teacher and class_teacher roles).
    # NOTE: User has no school_id/role columns of its own -- both live on the
    # school_users association table, so we must join through it (see users.py
    # get_school_users for the same pattern).
    eligible_query = (
        select(User)
        .join(school_users, school_users.c.user_id == User.id)
        .where(
            school_users.c.school_id == school_id,
            school_users.c.role.in_([UserRole.TEACHER, UserRole.CLASS_TEACHER]),
            User.id.not_in(existing_ids) if existing_ids else True
        )
    )
    eligible_res = await db.execute(eligible_query)
    eligible_teachers = eligible_res.scalars().all()
    
    return {
        "success": True,
        "data": [{"id": t.id, "name": t.full_name, "email": t.email} for t in eligible_teachers]
    }


@router.post("/staff-roster/add")
async def add_teacher_to_roster(
    payload: AddRosterTeacherPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_hod_user)
):
    """Adds a teacher to the HOD's department roster with multi-tenant safety parameters"""
    user = current_user
    school_id = user.school_id  # transient attribute set by get_current_hod_user

    dept = await get_managed_department(db, user.id, school_id)
    
    # Verify the target teacher belongs to this school. User has no school_id
    # column of its own -- membership lives on the school_users join table.
    teacher_res = await db.execute(
        select(User)
        .join(school_users, school_users.c.user_id == User.id)
        .where(User.id == payload.teacher_id, school_users.c.school_id == school_id)
    )
    teacher = teacher_res.scalar_one_or_none()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found in your school.")
        
    # Check if the membership record already exists
    existing_res = await db.execute(
        select(DepartmentMembership)
        .where(DepartmentMembership.department_id == dept.id, DepartmentMembership.teacher_id == payload.teacher_id)
    )
    if existing_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Teacher is already on your roster.")
        
    new_membership = DepartmentMembership(
        school_id=school_id,
        department_id=dept.id,
        teacher_id=payload.teacher_id
    )
    db.add(new_membership)
    
    # Send interactive in-app notification to the teacher
    db.add(Notification(
        school_id=school_id,
        user_id=payload.teacher_id,
        title="Department Registration",
        message=f"You have been added to the {dept.name} department roster.",
        notification_type="info",
        link_url="/dashboard/teacher"
    ))
    
    await db.commit()
    return {"success": True, "message": "Teacher added to department roster successfully."}


@router.post("/courses/{course_id}/assign")
async def assign_course_teacher(
    course_id: int,
    payload: CourseAssignPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_hod_user)
):
    """Binds a teacher from the HOD's roster to teach a specific Course"""
    user = current_user
    school_id = user.school_id  # transient attribute set by get_current_hod_user

    dept = await get_managed_department(db, user.id, school_id)
    
    # Verify course belongs to HOD department
    course_res = await db.execute(select(Course).where(Course.id == course_id, Course.department_id == dept.id))
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found in this department.")
        
    # Verify teacher is a registered member of this department
    member_res = await db.execute(
        select(DepartmentMembership)
        .where(DepartmentMembership.department_id == dept.id, DepartmentMembership.teacher_id == payload.teacher_id)
    )
    if not member_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Teacher is not a member of this department.")
        
    course.teacher_id = payload.teacher_id
    
    # Automatic Sync: Update matching Weekly Timetable Slots with the assigned teacher ID
    await db.execute(
        update(TimetableSlot)
        .where(TimetableSlot.subject_id == course_id, TimetableSlot.school_id == school_id)
        .values(teacher_id=payload.teacher_id)
    )
    
    # Notify Teacher
    db.add(Notification(
        school_id=school_id,
        user_id=payload.teacher_id,
        title="New Class Assignment",
        message=f"You have been assigned to teach {course.name} ({course.code}) by the HOD.",
        notification_type="info",
        link_url="/dashboard/teacher"
    ))
    
    await db.commit()
    return {"success": True, "message": "Successfully assigned class to teacher."}

@router.post("/staff/assign")
async def assign_teacher(payload: TeacherAssignPayload, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_hod_user)):
    """Deprecated in favor of /staff-roster/add (kept for backward compatibility)."""
    dept = await get_managed_department(db, current_user.id, current_user.school_id)
    exists = await db.execute(select(DepartmentMembership).where(DepartmentMembership.department_id == dept.id, DepartmentMembership.teacher_id == payload.teacher_id))
    if exists.scalar_one_or_none():
        return {"success": True, "message": "Teacher already on roster."}

    db.add(DepartmentMembership(school_id=current_user.school_id, department_id=dept.id, teacher_id=payload.teacher_id))
    await db.commit()
    return {"success": True, "message": "Teacher appended to department."}

@router.delete("/staff/unassign/{teacher_id}")
async def unassign_teacher(teacher_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_hod_user)):
    dept = await get_managed_department(db, current_user.id, current_user.school_id)
    await db.execute(delete(DepartmentMembership).where(DepartmentMembership.department_id == dept.id, DepartmentMembership.teacher_id == teacher_id))
    await db.commit()
    return {"success": True, "message": "Teacher unassigned."}

# ==================== 3. ANALYTICS & MONITORING ====================

@router.get("/subject-overview")
async def get_subject_performance(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_hod_user)):
    """Computes comparative academic distributions across courses overseen by this department"""
    dept = await get_managed_department(db, current_user.id, current_user.school_id)

    query = (
        select(Course.id, Course.name, Course.grade, func.avg(GradeEntry.score))
        .join(Exam, Course.id == Exam.subject_id)
        .join(GradeEntry, Exam.id == GradeEntry.exam_id)
        .where(Course.department_id == dept.id)
        .group_by(Course.id, Course.name, Course.grade)
    )
    result = await db.execute(query)
    rows = result.all()

    return {
        "success": True,
        "data": [
            {
                "course_id": r[0],
                "course_name": f"{r[1]} ({r[2]})",
                "average_score": round(r[3], 2) if r[3] is not None else 0.0
            } for r in rows
        ]
    }

# ==================== 4. FIRST-TIER LEAVE APPROVALS ====================

@router.get("/leave-requests")
async def get_departmental_leave(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_hod_user)):
    """Lists leave metrics submitted by instructors inside this HOD's department"""
    dept = await get_managed_department(db, current_user.id, current_user.school_id)

    query = (
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.user))
        .join(DepartmentMembership, LeaveRequest.user_id == DepartmentMembership.teacher_id)
        .where(
            DepartmentMembership.department_id == dept.id,
            LeaveRequest.status == "pending"
        )
    )
    result = await db.execute(query)
    requests = result.scalars().all()

    return {
        "success": True,
        "data": [
            {
                "id": r.id,
                "staff_name": r.user.full_name if r.user else "Unknown",
                "leave_type": r.leave_type,
                "start_date": r.start_date.strftime("%Y-%m-%d"),
                "end_date": r.end_date.strftime("%Y-%m-%d"),
                "reason": r.reason,
                "status": r.status
            } for r in requests
        ]
    }

@router.post("/leave-requests/{request_id}/review")
async def review_leave_request(
    request_id: int,
    payload: LeaveReviewPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_hod_user)
):
    """Allows HOD to flag a leave row before central administration handles closing out the processing loop"""
    dept = await get_managed_department(db, current_user.id, current_user.school_id)

    req_res = await db.execute(select(LeaveRequest).where(LeaveRequest.id == request_id))
    leave_req = req_res.scalar_one_or_none()
    if not leave_req:
        raise HTTPException(status_code=404, detail="Leave record not found.")

    if payload.action == "approve_hod":
        leave_req.status = "approved_by_hod" # Pushes up to the HR/Admin visibility dashboard tier
    else:
        leave_req.status = "rejected"

    await db.commit()
    return {"success": True, "message": f"Leave request status updated to {leave_req.status}."}

# ==================== 5. QUALITY ASSURANCE (ESCALATIONS) ====================

@router.get("/escalations")
async def get_departmental_escalations(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_hod_user)):
    dept = await get_managed_department(db, current_user.id, current_user.school_id)
    from models import StudentCourseEnrollment

    courses_res = await db.execute(select(Course.id).where(Course.department_id == dept.id))
    course_ids = [c[0] for c in courses_res.all()]
    if not course_ids:
        return {"success": True, "data": []}

    query = (
        select(StudentWelfareEscalation)
        .options(selectinload(StudentWelfareEscalation.student))
        .join(Student, StudentWelfareEscalation.student_id == Student.id)
        .join(StudentCourseEnrollment, Student.id == StudentCourseEnrollment.student_id)
        .where(StudentCourseEnrollment.course_id.in_(course_ids), StudentWelfareEscalation.status == "pending")
        .distinct()
    )
    result = await db.execute(query)
    return {
        "success": True,
        "data": [
            {
                "id": e.id,
                "student_name": f"{e.student.first_name} {e.student.last_name}" if e.student else "Unknown",
                "reason": e.reason,
                "details": e.details,
                "status": e.status,
                "created_at": e.created_at.strftime("%Y-%m-%d")
            } for e in result.scalars().all()
        ]
    }

@router.post("/escalations/{escalation_id}/resolve")
async def resolve_escalation(escalation_id: int, payload: ResolutionPayload, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_hod_user)):
    await get_managed_department(db, current_user.id, current_user.school_id)
    esc_res = await db.execute(select(StudentWelfareEscalation).where(StudentWelfareEscalation.id == escalation_id))
    esc = esc_res.scalar_one_or_none()
    if not esc: raise HTTPException(status_code=404, detail="Escalation not found.")

    esc.status = "resolved"
    esc.details = (esc.details or "") + f"\n[HOD Resolution]: {payload.resolution_details}"
    await db.commit()
    return {"success": True, "message": "Escalation closed."}

# ==================== 6. RESOURCE MANAGEMENT (INVENTORY) ====================

@router.get("/inventory")
async def get_departmental_inventory(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_hod_user)):
    """Fetches physical asset allocations assigned to this specific department"""
    dept = await get_managed_department(db, current_user.id, current_user.school_id)

    result = await db.execute(select(Asset).where(Asset.department_id == dept.id))
    assets = result.scalars().all()

    return {
        "success": True,
        "data": [
            {
                "id": a.id,
                "name": a.name,
                "sku": a.sku,
                "quantity": a.quantity,
                "asset_type": a.asset_type
            } for a in assets
        ]
    }

@router.post("/inventory/movement")
async def log_asset_movement(payload: AssetMovementPayload, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_hod_user)):
    """Logs check-outs or allocations of lab equipment/textbooks inside the department"""
    await get_managed_department(db, current_user.id, current_user.school_id)

    asset_res = await db.execute(select(Asset).where(Asset.id == payload.asset_id))
    asset = asset_res.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset structure not found.")

    if payload.movement_type == "OUT":
        if asset.quantity < payload.quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock item quantities.")
        asset.quantity -= payload.quantity
    else:
        asset.quantity += payload.quantity

    movement = AssetMovement(
        asset_id=payload.asset_id,
        user_id=current_user.id,
        quantity=payload.quantity,
        movement_type=payload.movement_type,
        notes=payload.notes
    )
    db.add(movement)
    await db.commit()
    return {"success": True, "message": "Asset ledger tracked successfully."}