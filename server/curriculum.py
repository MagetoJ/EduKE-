# server/curriculum.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from database import get_db
from models import LearningArea, CourseRequirement, GradeBand, Pathway

router = APIRouter(prefix="/api/curriculum", tags=["Curriculum"])

# Response Schemas
class LearningAreaOut(BaseModel):
    id: int
    name: str
    code: str
    class Config: orm_mode = True

class RequirementOut(BaseModel):
    id: int
    learning_area_id: int
    requirement_type: str
    pool_group_name: str | None
    min_required_from_pool: int
    class Config: orm_mode = True

@router.get("/learning-areas", response_model=List[LearningAreaOut])
def get_learning_areas(grade_band_id: int, db: Session = Depends(get_db)):
    return db.query(LearningArea).filter(LearningArea.grade_band_id == grade_band_id).all()

@router.get("/requirements", response_model=List[RequirementOut])
def get_requirements(grade_band_id: int, pathway_id: int = None, db: Session = Depends(get_db)):
    query = db.query(CourseRequirement).filter(CourseRequirement.grade_band_id == grade_band_id)
    if pathway_id:
        query = query.filter((CourseRequirement.pathway_id == pathway_id) | (CourseRequirement.pathway_id == None))
    else:
        query = query.filter(CourseRequirement.pathway_id == None)
    return query.all()