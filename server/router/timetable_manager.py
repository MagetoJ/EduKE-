import random
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User, School, school_users, UserRole
from courses import Course
from auth import get_current_user, get_current_school

router = APIRouter(prefix="/api", tags=["Timetable Manager"])

MASTER_SLOTS_STORE = []

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

class SlotPayload(BaseModel):
    id: Optional[int] = None
    day_of_week: str
    period_number: int
    class_name: str
    subject_name: str
    teacher_name: str
    room_number: Optional[str] = "Room 101"

async def get_optional_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    try:
        token = auth_header.split(" ")[1]
        return await get_current_user(token=token, db=db)
    except Exception:
        return None

# 1. GET /api/teachers
@router.get("/teachers")
async def get_school_teachers(db: AsyncSession = Depends(get_db)):
    query = (
        select(
            User.id,
            User.full_name.label("name"),
            User.email,
            school_users.c.role
        )
        .join(school_users, User.id == school_users.c.user_id)
        .where(
            school_users.c.is_active == True,
            school_users.c.role.in_([UserRole.TEACHER, "teacher", "class_teacher", "hod"])
        )
    )
    result = await db.execute(query)
    teachers = [
        {
            "id": str(row[0]),
            "name": row[1] or row[2],
            "full_name": row[1] or row[2],
            "email": row[2],
            "role": str(row[3])
        }
        for row in result.all()
    ]
    return {"success": True, "data": teachers}

# 2. GET /api/timetables/master
@router.get("/timetables/master")
async def get_master_timetable():
    global MASTER_SLOTS_STORE
    return {"success": True, "data": MASTER_SLOTS_STORE}

# 3. GET /api/timetables/my-schedule
@router.get("/timetables/my-schedule")
async def get_teacher_personal_schedule(
    db: AsyncSession = Depends(get_db),
    user: tuple = Depends(get_current_user)
):
    global MASTER_SLOTS_STORE
    current_user = user[0] if isinstance(user, tuple) else user
    teacher_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", "")

    teacher_slots = [
        slot for slot in MASTER_SLOTS_STORE
        if slot.get("teacher_name", "").lower().strip() == teacher_name.lower().strip()
    ]
    teacher_classes = list(set(slot["class_name"] for slot in teacher_slots if "class_name" in slot))

    return {
        "success": True,
        "teacher_name": teacher_name,
        "classes_taught": teacher_classes,
        "total_periods_assigned": len(teacher_slots),
        "data": teacher_slots
    }

# 4. POST /api/timetables/generate-auto (Incremental & Non-Destructive)
@router.post("/timetables/generate-auto")
async def auto_generate_timetable(
    db: AsyncSession = Depends(get_db),
    user: Optional[tuple] = Depends(get_optional_current_user)
):
    global MASTER_SLOTS_STORE

    # Pull assigned courses from DB
    query = select(Course)
    result = await db.execute(query)
    assigned_courses = result.scalars().all()

    if not assigned_courses:
        assignments = [
            {"class_name": "Grade 10 - A", "subject_name": "Mathematics", "teacher_name": "Mr. Omondi", "periods_per_week": 5, "room": "Room 101"},
            {"class_name": "Grade 10 - A", "subject_name": "English", "teacher_name": "Ms. Wanjiku", "periods_per_week": 5, "room": "Room 102"},
            {"class_name": "Grade 10 - B", "subject_name": "Physics", "teacher_name": "Dr. Kamau", "periods_per_week": 4, "room": "Lab 1"},
            {"class_name": "Grade 11 - A", "subject_name": "Chemistry", "teacher_name": "Mrs. Otieno", "periods_per_week": 4, "room": "Lab 2"},
        ]
    else:
        assignments = []
        for course in assigned_courses:
            assignments.append({
                "class_name": getattr(course, "class_name", "Grade 10"),
                "subject_name": getattr(course, "name", "General Subject"),
                "teacher_name": getattr(course, "teacher_name", "Assigned Teacher"),
                "periods_per_week": getattr(course, "lessons_per_week", 4),
                "room": getattr(course, "room", f"Room {random.randint(101, 110)}")
            })

    # Track existing slot occupancy to PRESERVE current timetable layout
    teacher_occ = set((s["day_of_week"], s["period_number"], s["teacher_name"].lower()) for s in MASTER_SLOTS_STORE)
    class_occ = set((s["day_of_week"], s["period_number"], s["class_name"].lower()) for s in MASTER_SLOTS_STORE)
    room_occ = set((s["day_of_week"], s["period_number"], s["room_number"].lower()) for s in MASTER_SLOTS_STORE if s.get("room_number"))

    slot_id = max([s["id"] for s in MASTER_SLOTS_STORE], default=0) + 1
    added_count = 0

    for item in assignments:
        # Check how many lessons are already scheduled for this class + subject + teacher
        existing = [
            s for s in MASTER_SLOTS_STORE
            if s["class_name"].lower() == item["class_name"].lower()
            and s["subject_name"].lower() == item["subject_name"].lower()
            and s["teacher_name"].lower() == item["teacher_name"].lower()
        ]

        periods_needed = max(0, item["periods_per_week"] - len(existing))
        if periods_needed == 0:
            continue

        scheduled = 0
        possible_cells = [(day, period) for day in DAYS for period in PERIODS]
        random.shuffle(possible_cells)

        for day, period in possible_cells:
            if scheduled >= periods_needed:
                break
            
            t_key = (day, period, item["teacher_name"].lower())
            c_key = (day, period, item["class_name"].lower())
            r_key = (day, period, item["room"].lower())

            if t_key not in teacher_occ and c_key not in class_occ and r_key not in room_occ:
                teacher_occ.add(t_key)
                class_occ.add(c_key)
                room_occ.add(r_key)

                new_slot = {
                    "id": slot_id,
                    "day_of_week": day,
                    "period_number": period,
                    "class_name": item["class_name"],
                    "subject_name": item["subject_name"],
                    "teacher_name": item["teacher_name"],
                    "room_number": item["room"],
                    "has_conflict": False
                }
                MASTER_SLOTS_STORE.append(new_slot)
                slot_id += 1
                scheduled += 1
                added_count += 1

    return {
        "success": True, 
        "message": f"Successfully integrated new teacher/course allocations ({added_count} new slots added) without altering existing schedule.", 
        "data": MASTER_SLOTS_STORE
    }

# 5. POST /api/timetables/publish
@router.post("/timetables/publish")
async def publish_timetable():
    return {"success": True, "message": "Master timetable successfully published!"}

# 6. POST /api/timetables/slots (Manual Add)
@router.post("/timetables/slots")
async def create_slot(payload: SlotPayload):
    global MASTER_SLOTS_STORE
    slot = payload.dict()
    
    # Check manual editing conflict
    conflict = any(
        s["day_of_week"].lower() == slot["day_of_week"].lower() and
        s["period_number"] == slot["period_number"] and
        (s["teacher_name"].lower() == slot["teacher_name"].lower() or s["class_name"].lower() == slot["class_name"].lower())
        for s in MASTER_SLOTS_STORE
    )
    
    new_id = max([s["id"] for s in MASTER_SLOTS_STORE], default=0) + 1
    slot["id"] = new_id
    slot["has_conflict"] = conflict
    MASTER_SLOTS_STORE.append(slot)
    return {"success": True, "data": slot}

# 7. PUT /api/timetables/slots/{slot_id} (Manual Edit)
@router.put("/timetables/slots/{slot_id}")
async def update_slot(slot_id: int, payload: SlotPayload):
    global MASTER_SLOTS_STORE
    for i, s in enumerate(MASTER_SLOTS_STORE):
        if s["id"] == slot_id:
            updated_slot = payload.dict()
            updated_slot["id"] = slot_id
            
            # Re-evaluate conflicts
            conflict = any(
                other["id"] != slot_id and
                other["day_of_week"].lower() == updated_slot["day_of_week"].lower() and
                other["period_number"] == updated_slot["period_number"] and
                (other["teacher_name"].lower() == updated_slot["teacher_name"].lower() or other["class_name"].lower() == updated_slot["class_name"].lower())
                for other in MASTER_SLOTS_STORE
            )
            updated_slot["has_conflict"] = conflict
            MASTER_SLOTS_STORE[i] = updated_slot
            return {"success": True, "data": updated_slot}
            
    raise HTTPException(status_code=404, detail="Slot not found")