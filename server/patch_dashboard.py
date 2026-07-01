import asyncio
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import async_session_maker as SessionLocal
from models import School, User, Subject, Course, AcademicYear

async def fix_missing_dashboard_data():
    async with SessionLocal() as db:
        print("Patching data for Homabay Boys (ID: 2)...")
        school_id = 2 # Based on your previous output
        
        # 1. Create an Active Academic Year (Dashboards filter by this)
        year_query = await db.execute(select(AcademicYear).where(AcademicYear.school_id == school_id))
        year = year_query.scalar_one_or_none()
        
        if not year:
            year = AcademicYear(school_id=school_id, name="2026/2027", start_date=date.today(), status="active")
            db.add(year)
            await db.flush()
            print("✅ Created active Academic Year.")
            
        # 2. Convert Subjects into Courses for the Academics UI
        subjects = (await db.execute(select(Subject).where(Subject.school_id == school_id))).scalars().all()
        teachers = (await db.execute(select(User).where(User.username.like("teacher%")))).scalars().all()

        courses_added = 0
        for i, subj in enumerate(subjects):
            course_query = await db.execute(select(Course).where(Course.code == subj.code, Course.school_id == school_id))
            if not course_query.scalar_one_or_none():
                # Assign a teacher round-robin style
                teacher_id = teachers[i % len(teachers)].id if teachers else None
                
                course = Course(
                    school_id=school_id,
                    teacher_id=teacher_id,
                    academic_year_id=year.id,
                    name=subj.name,
                    code=subj.code,
                    grade="Grade 10",
                    is_active=True
                )
                db.add(course)
                courses_added += 1
        
        print(f"✅ Converted {courses_added} Subjects into Courses for the UI.")
        
        await db.commit()
        print("🎉 Patch complete! Refresh your dashboard.")

if __name__ == "__main__":
    asyncio.run(fix_missing_dashboard_data())
    