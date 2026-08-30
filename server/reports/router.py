# server/reporting/router.py
from fastapi import APIRouter
from .cbc import router as cbc_router

reporting_router = APIRouter(prefix="/api/reports", tags=["Reporting Module"])

# CBC Domain
reporting_router.include_router(cbc_router)

# Placeholders for remaining domains until specific query modules are built
@reporting_router.get("/academic/summary")
def get_academic_summary():
    return {
        "kpis": [
            {"label": "Mean Grade", "value": "B-", "trend": "+0.3", "status": "positive"},
            {"label": "Pass Rate", "value": "88%", "trend": "+4%", "status": "positive"},
            {"label": "Assessments Graded", "value": "94%", "trend": "+2%", "status": "positive"},
            {"label": "Top Subject", "value": "Kiswahili", "trend": "A- avg", "status": "positive"}
        ],
        "table_data": [
            {"subject": "Mathematics", "teacher": "Mr. Omondi", "formative_mean": "72%", "summative_mean": "68%"},
            {"subject": "English", "teacher": "Mrs. Wanjiku", "formative_mean": "81%", "summative_mean": "79%"},
            {"subject": "Kiswahili", "teacher": "Mr. Juma", "formative_mean": "85%", "summative_mean": "82%"}
        ]
    }

@reporting_router.get("/financial/summary")
def get_financial_summary():
    return {
        "kpis": [
            {"label": "Collection Rate", "value": "76%", "trend": "+5%", "status": "positive"},
            {"label": "Total Revenue", "value": "KES 4.2M", "trend": "+12%", "status": "positive"},
            {"label": "Outstanding Balances", "value": "KES 1.1M", "trend": "-8%", "status": "positive"},
            {"label": "Waivers Issued", "value": "KES 150K", "trend": "0%", "status": "positive"}
        ],
        "table_data": []
    }

@reporting_router.get("/attendance/summary")
def get_attendance_summary():
    return {
        "kpis": [
            {"label": "Daily Average", "value": "95.2%", "trend": "+1.1%", "status": "positive"},
            {"label": "Chronic Absenteeism", "value": "3.1%", "trend": "-0.5%", "status": "positive"},
            {"label": "Staff Attendance", "value": "98.0%", "trend": "0%", "status": "positive"},
            {"label": "Unexcused Absence", "value": "12", "trend": "-3", "status": "positive"}
        ],
        "table_data": [
            {"subject": "Grade 7 East", "teacher": "Attendance Rate: 96%", "formative_mean": "Present: 42", "summative_mean": "Absent: 2"},
            {"subject": "Grade 8 West", "teacher": "Attendance Rate: 94%", "formative_mean": "Present: 39", "summative_mean": "Absent: 3"}
        ]
    }

@reporting_router.get("/operations/summary")
def get_operations_summary():
    return {
        "kpis": [
            {"label": "Library Books Issued", "value": "342", "trend": "+15", "status": "positive"},
            {"label": "Clinic Visits (Term)", "value": "89", "trend": "-12", "status": "positive"},
            {"label": "Transport Occupancy", "value": "91%", "trend": "+3%", "status": "positive"},
            {"label": "Boarding Capacity", "value": "84%", "trend": "0%", "status": "positive"}
        ],
        "table_data": [
            {"subject": "Library", "teacher": "Overdue Books: 14", "formative_mean": "Active Loans: 120", "summative_mean": "Returned: 208"},
            {"subject": "Clinic", "teacher": "Common: First Aid", "formative_mean": "Treated: 85", "summative_mean": "Referred: 4"}
        ]
    }