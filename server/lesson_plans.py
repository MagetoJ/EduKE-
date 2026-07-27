from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_school, require_roles
from database import get_db
from models import Course, School, User
from models_lesson_plan import LessonPlan

router = APIRouter(prefix="/api/teacher/lesson-plans", tags=["Teacher Lesson Planning"])

ALLOWED_UPLOAD_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

TEACHER_ROLES = ("teacher", "class_teacher")


class LessonPlanCreate(BaseModel):
    title: str
    course_id: Optional[int] = None
    week_start_date: Optional[date] = None
    term: Optional[str] = None
    objectives: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = "draft"


class LessonPlanUpdate(BaseModel):
    title: Optional[str] = None
    course_id: Optional[int] = None
    week_start_date: Optional[date] = None
    term: Optional[str] = None
    objectives: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None


class LessonPlanResponse(BaseModel):
    id: int
    title: str
    course_id: Optional[int] = None
    course_name: Optional[str] = None
    week_start_date: Optional[str] = None
    term: Optional[str] = None
    objectives: Optional[str] = None
    content: Optional[str] = None
    status: str
    has_file: bool
    file_name: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class LessonPlanEnvelope(BaseModel):
    success: bool
    data: LessonPlanResponse


class LessonPlanListEnvelope(BaseModel):
    success: bool
    data: List[LessonPlanResponse]


def _serialize(plan: LessonPlan, course_name: Optional[str] = None) -> dict:
    return {
        "id": plan.id,
        "title": plan.title,
        "course_id": plan.course_id,
        "course_name": course_name,
        "week_start_date": plan.week_start_date.strftime("%Y-%m-%d") if plan.week_start_date else None,
        "term": plan.term,
        "objectives": plan.objectives,
        "content": plan.content,
        "status": plan.status,
        "has_file": bool(plan.file_data),
        "file_name": plan.file_name,
        "created_at": plan.created_at.strftime("%Y-%m-%d %H:%M") if plan.created_at else None,
        "updated_at": plan.updated_at.strftime("%Y-%m-%d %H:%M") if plan.updated_at else None,
    }


async def _get_course_name_map(db: AsyncSession, school_id: int) -> dict:
    result = await db.execute(select(Course.id, Course.name).where(Course.school_id == school_id))
    return {row[0]: row[1] for row in result.all()}


async def _validate_course(db: AsyncSession, course_id: Optional[int], school_id: int) -> Optional[Course]:
    if course_id is None:
        return None
    result = await db.execute(
        select(Course).where(Course.id == course_id, Course.school_id == school_id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Selected subject/course was not found.")
    return course


async def _get_own_plan(db: AsyncSession, plan_id: int, teacher_id: int, school_id: int) -> LessonPlan:
    result = await db.execute(
        select(LessonPlan).where(
            LessonPlan.id == plan_id,
            LessonPlan.teacher_id == teacher_id,
            LessonPlan.school_id == school_id,
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Lesson plan not found.")
    return plan


@router.get("", response_model=LessonPlanListEnvelope)
@router.get("/", response_model=LessonPlanListEnvelope)
async def list_lesson_plans(
    course_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    current_school: School = Depends(get_current_school),
):
    """List this teacher's own lesson plans / schemes of work, newest first."""
    query = select(LessonPlan).where(
        LessonPlan.teacher_id == current_user.id,
        LessonPlan.school_id == current_school.id,
    )
    if course_id is not None:
        query = query.where(LessonPlan.course_id == course_id)
    query = query.order_by(LessonPlan.created_at.desc())

    result = await db.execute(query)
    plans = result.scalars().all()
    course_names = await _get_course_name_map(db, current_school.id)

    return {
        "success": True,
        "data": [_serialize(p, course_names.get(p.course_id)) for p in plans],
    }


@router.post("", response_model=LessonPlanEnvelope)
@router.post("/", response_model=LessonPlanEnvelope)
async def create_lesson_plan(
    payload: LessonPlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    current_school: School = Depends(get_current_school),
):
    """Create a new scheme of work / lesson plan entry (text-based, no file)."""
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Title is required.")

    course = await _validate_course(db, payload.course_id, current_school.id)

    plan = LessonPlan(
        school_id=current_school.id,
        teacher_id=current_user.id,
        course_id=course.id if course else None,
        title=payload.title.strip(),
        week_start_date=payload.week_start_date,
        term=payload.term,
        objectives=payload.objectives,
        content=payload.content,
        status=payload.status or "draft",
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)

    return {"success": True, "data": _serialize(plan, course.name if course else None)}


@router.post("/upload", response_model=LessonPlanEnvelope)
async def upload_lesson_plan(
    title: str = Form(...),
    course_id: Optional[int] = Form(None),
    week_start_date: Optional[date] = Form(None),
    term: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    current_school: School = Depends(get_current_school),
):
    """Create a lesson plan by uploading a PDF/Word document."""
    if not title.strip():
        raise HTTPException(status_code=400, detail="Title is required.")

    if file.content_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only PDF or Word documents are accepted for lesson plan uploads.",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File is too large (max 10MB).")

    course = await _validate_course(db, course_id, current_school.id)

    plan = LessonPlan(
        school_id=current_school.id,
        teacher_id=current_user.id,
        course_id=course.id if course else None,
        title=title.strip(),
        week_start_date=week_start_date,
        term=term,
        status="submitted",
        file_name=file.filename,
        file_type=file.content_type,
        file_data=file_bytes,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)

    return {"success": True, "data": _serialize(plan, course.name if course else None)}


@router.patch("/{plan_id}", response_model=LessonPlanEnvelope)
async def update_lesson_plan(
    plan_id: int,
    payload: LessonPlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    current_school: School = Depends(get_current_school),
):
    """Edit a lesson plan you own, e.g. to mark it submitted or tweak content."""
    plan = await _get_own_plan(db, plan_id, current_user.id, current_school.id)

    updates = payload.dict(exclude_unset=True)
    if "course_id" in updates:
        course = await _validate_course(db, updates["course_id"], current_school.id)
        plan.course_id = course.id if course else None
        updates.pop("course_id")

    for field, value in updates.items():
        setattr(plan, field, value)

    plan.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(plan)

    course_names = await _get_course_name_map(db, current_school.id)
    return {"success": True, "data": _serialize(plan, course_names.get(plan.course_id))}


@router.delete("/{plan_id}")
async def delete_lesson_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    current_school: School = Depends(get_current_school),
):
    plan = await _get_own_plan(db, plan_id, current_user.id, current_school.id)
    await db.delete(plan)
    await db.commit()
    return {"success": True, "message": "Lesson plan deleted."}


@router.get("/{plan_id}/file")
async def download_lesson_plan_file(
    plan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    current_school: School = Depends(get_current_school),
):
    plan = await _get_own_plan(db, plan_id, current_user.id, current_school.id)
    if not plan.file_data:
        raise HTTPException(status_code=404, detail="This lesson plan has no attached file.")

    def _stream():
        yield plan.file_data

    filename = plan.file_name or f"lesson-plan-{plan.id}"
    return StreamingResponse(
        _stream(),
        media_type=plan.file_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
