from fastapi import APIRouter, Depends
from typing import Dict, Any
from .dependencies import verify_report_access

router = APIRouter(prefix="/api/reports/cbc", tags=["Reports - CBC"])

def calculate_competency_level(formative_score: float, summative_score: float) -> str:
    """Computes the 70% Formative / 30% Summative weight and returns the CBC level."""
    weighted_score = (formative_score * 0.70) + (summative_score * 0.30)
    if weighted_score >= 80.0:
        return "Exceeding Expectations (EE)"
    elif weighted_score >= 65.0:
        return "Meeting Expectations (ME)"
    elif weighted_score >= 50.0:
        return "Approaching Expectations (AE)"
    return "Below Expectations (BE)"

@router.get("/summary")
def get_cbc_summary(term_id: int = None, user = Depends(verify_report_access("cbc"))):
    # Standardized response shape for the React generic view
    return {
        "kpis": [
            {"label": "Exceeding (EE)", "value": "18%", "trend": "+2%", "status": "positive"},
            {"label": "Meeting (ME)", "value": "62%", "trend": "+5%", "status": "positive"},
            {"label": "Approaching (AE)", "value": "15%", "trend": "-4%", "status": "negative"},
            {"label": "Below (BE)", "value": "5%", "trend": "-3%", "status": "positive"}
        ],
        "chart_data": [
            {"subject": "Mathematics", "EE": 15, "ME": 60, "AE": 20, "BE": 5},
            {"subject": "English", "EE": 20, "ME": 65, "AE": 10, "BE": 5},
            {"subject": "Science & Tech", "EE": 10, "ME": 50, "AE": 30, "BE": 10}
        ],
        "table_data": [
            {"subject": "Mathematics", "strand": "Numbers", "formative_mean": "ME", "summative_mean": "ME"},
            {"subject": "English", "strand": "Reading", "formative_mean": "EE", "summative_mean": "ME"},
        ]
    }
    
    
@router.get("/summary")
def get_cbc_summary():
    return {
        "kpis": [
            {"label": "Exceeding (EE)", "value": "18%", "trend": "+2%", "status": "positive"},
            {"label": "Meeting (ME)", "value": "62%", "trend": "+5%", "status": "positive"},
            {"label": "Approaching (AE)", "value": "15%", "trend": "-4%", "status": "positive"},
            {"label": "Below (BE)", "value": "5%", "trend": "-3%", "status": "positive"}
        ],
        "table_data": [
            {"subject": "Mathematics", "strand": "Numbers", "formative_mean": "ME", "summative_mean": "ME"},
            {"subject": "English", "strand": "Reading", "formative_mean": "EE", "summative_mean": "ME"},
            {"subject": "Science & Tech", "strand": "Living Things", "formative_mean": "ME", "summative_mean": "AE"}
        ]
    }    