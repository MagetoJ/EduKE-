from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["Temporary Stubs"])

# ─────────────────────────────────────────────────────────────────────────────
# IMPORTANT: Do NOT add /timetable or /timetable/periods here.
# Those routes are handled by timetables.py (prefix="/timetable") and get
# registered at /api/timetable by main.py.  Stubs here would shadow the real
# router and always return {"data": []}, silently breaking the timetable page.
# ─────────────────────────────────────────────────────────────────────────────



# ─────────────────────────────────────────────────────────────────────────────
# IMPORTANT: Do NOT add /exams here either. Those routes are handled by
# exams.py (exams_router) and get registered at /api/exams by main.py.
# A stub here would shadow the real router and always return {"data": []},
# silently breaking exam creation/listing.
# ─────────────────────────────────────────────────────────────────────────────



@router.get("/messages")
@router.get("/academic-years")
@router.get("/fee-structures")
@router.get("/fees")
@router.get("/leave-types")
@router.get("/reports/financial-summary")
@router.get("/reports/performance-summary")
@router.get("/kenya-features/cbc/strands")
@router.get("/curriculum/merit-lists")
@router.get("/school/settings")
def generic_stub():
    return {"data": []}