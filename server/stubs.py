from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["Temporary Stubs"])

# Map all missing GET requests here so they return an empty array {"data": []}
@router.get("/staff")
@router.get("/courses")
@router.get("/assignments")
@router.get("/exams")
@router.get("/timetable")
@router.get("/timetable/periods")
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