from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from typing import List, Optional, Dict
from pydantic import BaseModel
from datetime import datetime

from database import get_db
from models import User, Course, Student, GradeEntry, Exam, TimetableSlot, LeaveRequest, Asset, AssetMovement, Notification, school_users, UserRole
from models_roles import AcademicDepartment, DepartmentMembership, ClassSubjectAssignment
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

class CourseCreatePayload(BaseModel):
    name: str
    code: str
    grade: str
    description: Optional[str] = None

class ClassSubjectAssignPayload(BaseModel):
    course_id: int
    teacher_id: int
    grade_level: str
    stream_section: Optional[str] = None

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
        user_dept_str = ""

        # A. Check if user is registered in any department membership already
        member_dept_query = select(AcademicDepartment).join(
            DepartmentMembership, DepartmentMembership.department_id == AcademicDepartment.id
        ).where(
            DepartmentMembership.teacher_id == user.id,
            AcademicDepartment.school_id == school_id
        )
        member_dept_res = await db.execute(member_dept_query)
        member_dept = member_dept_res.scalars().first()
        if member_dept:
            user_dept_str = member_dept.name

        # B. Fallback to heuristic keywords in email/username/full_name
        # NOTE: the User model has no `department` column, so a plain
        # getattr(user, 'department', '') always returned '' here, which
        # meant every un-provisioned HOD fell through to the first
        # unassigned department (or a hardcoded "Sciences" default). This
        # keyword pass gives a much better guess before we fall back.
        if not user_dept_str:
            for keyword, dept_name in [
                ("lang", "Languages"), ("english", "Languages"), ("kiswahili", "Languages"), ("french", "Languages"), ("german", "Languages"),
                ("math", "Mathematics"), ("computer", "Mathematics"),
                ("sci", "Sciences"), ("chem", "Sciences"), ("phys", "Sciences"), ("biol", "Sciences"),
                ("hum", "Humanities"), ("hist", "Humanities"), ("geog", "Humanities"), ("cre", "Humanities"),
                ("tech", "Technical"), ("agri", "Technical"), ("business", "Technical"), ("music", "Technical")
            ]:
                if keyword in user.email.lower() or keyword in user.username.lower() or keyword in user.full_name.lower():
                    user_dept_str = dept_name
                    break

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
            # Provision a new localized department slot for this school tenant instantly.
            # Default to Languages (rather than Sciences) when no keyword match is found,
            # since silently defaulting to a specific subject department is itself a guess --
            # this at least avoids overloading Sciences for every unmatched HOD.
            target_name = f"{user_dept_str or 'Languages'} Department"
            target_code = "LANG"
            if "sci" in target_name.lower() or "chem" in target_name.lower() or "phys" in target_name.lower() or "biol" in target_name.lower():
                target_code = "SCI"
            elif "math" in target_name.lower():
                target_code = "MATH"
            elif "hum" in target_name.lower():
                target_code = "HUM"
            elif "tech" in target_name.lower() or "app" in target_name.lower():
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

    # Auto-link this school's courses to their correct department rows.
    # LINK_KEYWORDS is intentionally broader (includes generic names like
    # "Science"/"Languages") so any loosely-named pre-existing course still
    # gets swept into the right department.
    link_keywords_by_code = {
        "MATH": ["Mathematics", "Computer Studies", "Computer"],
        "LANG": ["English", "Kiswahili", "Literature", "French", "German", "Arabic", "Sign Language", "Languages"],
        "SCI": ["Chemistry", "Physics", "Biology", "Integrated Science", "Science"],
        "HUM": ["History", "Geography", "CRE", "IRE", "HRE", "Social Studies", "Humanities"],
        "TECH": ["Agriculture", "Business", "Home Science", "Music", "Art", "Woodwork", "Metalwork",
                 "Building Construction", "Physical Education", "Technical"]
    }

    # CANONICAL_SUBJECTS is the authoritative subject list per department --
    # these are the actual subjects that must exist (and be visible on the
    # HOD's dashboard) for that department, regardless of whether the school
    # ever got around to creating them. If a subject in this list has no
    # matching Course row in the department yet, we provision a starter one.
    # This list mirrors the standard Kenyan CBC / 8-4-4 subject spread per
    # department so a newly-provisioned department shows up fully stocked
    # instead of empty.
    canonical_subjects_by_code = {
        "MATH": ["Mathematics", "Computer Studies"],
        "LANG": ["English", "Kiswahili", "Literature in English", "French", "German", "Arabic", "Kenyan Sign Language"],
        "SCI": ["Biology", "Chemistry", "Physics", "Integrated Science"],
        "HUM": ["History and Government", "Geography", "CRE", "IRE", "HRE", "Social Studies"],
        "TECH": ["Agriculture", "Business Studies", "Home Science", "Music", "Art and Design",
                 "Woodwork", "Metalwork", "Building Construction", "Physical Education"]
    }

    if dept.code in link_keywords_by_code:
        for keyword in link_keywords_by_code[dept.code]:
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

    if dept.code in canonical_subjects_by_code:
        for subject_name in canonical_subjects_by_code[dept.code]:
            # Skip if this department already has a course covering this subject
            existing_subject_res = await db.execute(
                select(Course.id).where(
                    Course.school_id == school_id,
                    Course.department_id == dept.id,
                    Course.name.ilike(f"%{subject_name}%")
                ).limit(1)
            )
            if existing_subject_res.scalar_one_or_none():
                continue

            # Generate a school-unique code for the new subject
            base_code = f"{dept.code}-{subject_name[:3].upper()}"
            candidate_code = base_code
            suffix = 1
            while True:
                code_res = await db.execute(
                    select(Course.id).where(Course.school_id == school_id, Course.code == candidate_code)
                )
                if not code_res.scalar_one_or_none():
                    break
                suffix += 1
                candidate_code = f"{base_code}{suffix}"

            db.add(Course(
                school_id=school_id,
                department_id=dept.id,
                name=subject_name,
                code=candidate_code,
                grade="All Grades",
                is_active=True
            ))
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

@router.post("/courses/create")
async def create_department_course(
    payload: CourseCreatePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_hod_user)
):
    """Creates a new course/subject within the HOD's managed department"""
    dept = await get_managed_department(db, current_user.id, current_user.school_id)

    # Check if a course with the same code already exists in this school
    existing_course_res = await db.execute(
        select(Course).where(
            Course.school_id == current_user.school_id,
            Course.code == payload.code
        )
    )
    if existing_course_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Course with code '{payload.code}' already exists in this school."
        )

    new_course = Course(
        school_id=current_user.school_id,
        department_id=dept.id,
        name=payload.name,
        code=payload.code,
        description=payload.description,
        grade=payload.grade,
        is_active=True
    )
    db.add(new_course)
    await db.commit()
    await db.refresh(new_course)

    return {
        "success": True,
        "message": f"Successfully created subject '{payload.name}' within {dept.name}.",
        "data": {
            "id": new_course.id,
            "name": new_course.name,
            "code": new_course.code,
            "grade": new_course.grade
        }
    }


# ==================== CLASS-LEVEL SUBJECT ASSIGNMENTS ====================
# The plain /courses/{id}/assign endpoint below only supports ONE teacher per
# Course row, which can't express "the same subject taught to different
# classes by different teachers". These endpoints are the real mechanism for
# that: they operate on (subject, grade, stream) triples rather than on the
# Course row alone, and enforce:
#   1. A class (grade + stream) can't be double-booked with two different
#      teachers for the same subject.
#   2. A teacher can be attached to many classes, but never more than
#      MAX_SUBJECTS_PER_TEACHER distinct subjects.

MAX_SUBJECTS_PER_TEACHER = 2

@router.get("/available-grades")
async def get_available_grades(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_hod_user)
):
    """
    Returns the distinct grade/stream combinations actually in use by
    students at this school, so the HOD's assignment form can offer a real
    picklist instead of free text.
    """
    result = await db.execute(
        select(Student.grade, Student.stream_section)
        .where(Student.school_id == current_user.school_id)
        .distinct()
        .order_by(Student.grade)
    )
    rows = result.all()
    return {
        "success": True,
        "data": [{"grade": g, "stream_section": s or ""} for g, s in rows]
    }


@router.get("/class-assignments")
async def list_class_assignments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_hod_user)
):
    """Lists every (subject, class, teacher) assignment inside this HOD's department."""
    dept = await get_managed_department(db, current_user.id, current_user.school_id)

    result = await db.execute(
        select(ClassSubjectAssignment)
        .options(
            selectinload(ClassSubjectAssignment.course),
            selectinload(ClassSubjectAssignment.teacher)
        )
        .join(Course, ClassSubjectAssignment.course_id == Course.id)
        .where(Course.department_id == dept.id)
        .order_by(ClassSubjectAssignment.grade_level, ClassSubjectAssignment.stream_section)
    )
    rows = result.scalars().all()

    # Also surface, per teacher, how many distinct subjects they already hold
    # school-wide -- lets the frontend grey out the option before the user
    # even tries and gets a 400.
    teacher_subject_counts: Dict[int, int] = {}
    if rows:
        teacher_ids = {r.teacher_id for r in rows}
        for tid in teacher_ids:
            count_res = await db.execute(
                select(func.count(func.distinct(ClassSubjectAssignment.course_id)))
                .where(ClassSubjectAssignment.teacher_id == tid)
            )
            teacher_subject_counts[tid] = count_res.scalar() or 0

    return {
        "success": True,
        "data": [
            {
                "id": r.id,
                "course_id": r.course_id,
                "course_name": r.course.name,
                "course_code": r.course.code,
                "grade_level": r.grade_level,
                "stream_section": r.stream_section,
                "teacher_id": r.teacher_id,
                "teacher_name": r.teacher.full_name if r.teacher else "Unknown",
                "assigned_at": r.assigned_at.strftime("%Y-%m-%d") if r.assigned_at else None
            } for r in rows
        ],
        "teacher_subject_counts": teacher_subject_counts
    }


@router.post("/class-assignments/assign")
async def assign_class_subject(
    payload: ClassSubjectAssignPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_hod_user)
):
    """
    Assigns a teacher to teach one subject to one specific class (grade +
    stream). Enforces: one teacher per class-subject, and a hard cap of
    MAX_SUBJECTS_PER_TEACHER distinct subjects per teacher.
    """
    dept = await get_managed_department(db, current_user.id, current_user.school_id)

    grade_level = (payload.grade_level or "").strip()
    stream_section = (payload.stream_section or "").strip()
    if not grade_level:
        raise HTTPException(status_code=400, detail="A grade/class is required.")

    # 1. Subject must belong to this HOD's department
    course_res = await db.execute(
        select(Course).where(Course.id == payload.course_id, Course.department_id == dept.id)
    )
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Subject not found in this department.")

    # 2. Teacher must already be on this department's roster
    member_res = await db.execute(
        select(DepartmentMembership)
        .where(DepartmentMembership.department_id == dept.id, DepartmentMembership.teacher_id == payload.teacher_id)
    )
    if not member_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Teacher is not a member of this department. Add them to the roster first.")

    # 3. RULE: this class can't already be assigned a (different) teacher for this subject
    existing_res = await db.execute(
        select(ClassSubjectAssignment).where(
            ClassSubjectAssignment.course_id == payload.course_id,
            ClassSubjectAssignment.grade_level == grade_level,
            ClassSubjectAssignment.stream_section == stream_section
        )
    )
    existing = existing_res.scalar_one_or_none()
    class_label = f"{grade_level} {stream_section}".strip()
    if existing:
        if existing.teacher_id == payload.teacher_id:
            return {"success": True, "message": f"{course.name} is already assigned to this teacher for {class_label}."}
        raise HTTPException(
            status_code=400,
            detail=f"{class_label} already has a teacher assigned for {course.name}. Unassign it first to reassign."
        )

    # 4. RULE: teacher may hold at most MAX_SUBJECTS_PER_TEACHER distinct subjects
    distinct_res = await db.execute(
        select(ClassSubjectAssignment.course_id)
        .where(ClassSubjectAssignment.teacher_id == payload.teacher_id)
        .distinct()
    )
    distinct_subject_ids = set(distinct_res.scalars().all())
    distinct_subject_ids.add(payload.course_id)
    if len(distinct_subject_ids) > MAX_SUBJECTS_PER_TEACHER:
        raise HTTPException(
            status_code=400,
            detail=f"This teacher already teaches {MAX_SUBJECTS_PER_TEACHER} subjects. A teacher cannot be assigned more than {MAX_SUBJECTS_PER_TEACHER} subjects."
        )

    assignment = ClassSubjectAssignment(
        school_id=current_user.school_id,
        course_id=payload.course_id,
        teacher_id=payload.teacher_id,
        grade_level=grade_level,
        stream_section=stream_section
    )
    db.add(assignment)

    db.add(Notification(
        school_id=current_user.school_id,
        user_id=payload.teacher_id,
        title="New Class Assignment",
        message=f"You have been assigned to teach {course.name} to {class_label}.",
        notification_type="info",
        link_url="/dashboard/teacher"
    ))

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"{class_label} already has a teacher assigned for {course.name}.")

    return {"success": True, "message": f"Assigned {course.name} for {class_label} to teacher."}


@router.delete("/class-assignments/{assignment_id}")
async def unassign_class_subject(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_hod_user)
):
    """Frees up a class-subject slot so it can be reassigned to a different teacher."""
    dept = await get_managed_department(db, current_user.id, current_user.school_id)

    result = await db.execute(
        select(ClassSubjectAssignment)
        .join(Course, ClassSubjectAssignment.course_id == Course.id)
        .where(ClassSubjectAssignment.id == assignment_id, Course.department_id == dept.id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found in this department.")

    await db.delete(assignment)
    await db.commit()
    return {"success": True, "message": "Class assignment removed."}


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
            school_users.c.role.in_([UserRole.TEACHER, UserRole.CLASS_TEACHER, UserRole.HOD]),
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