import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from database import get_db, engine
from models import AcademicDepartment, Course

async def seed_kenyan_departments_and_subjects():
    async with AsyncSession(engine) as db:
        # Standard Kenyan Academic Departments
        departments_data = [
            {"name": "Mathematics Department", "code": "MATH"},
            {"name": "Languages Department", "code": "LANG"},
            {"name": "Sciences Department", "code": "SCI"},
            {"name": "Humanities Department", "code": "HUM"},
            {"name": "Technical & Applied Sciences", "code": "TECH"}
        ]

        # 1. Seed Departments if they do not exist
        dept_mapping = {}
        for dept in departments_data:
            res = await db.execute(select(AcademicDepartment).where(AcademicDepartment.code == dept["code"]))
            existing_dept = res.scalar_one_or_none()
            if not existing_dept:
                new_dept = AcademicDepartment(name=dept["name"], code=dept["code"])
                db.add(new_dept)
                await db.flush() # obtain the generated ID
                dept_mapping[dept["code"]] = new_dept.id
            else:
                dept_mapping[dept["code"]] = existing_dept.id

        # 2. Map Kenyan curriculum subjects to their designated Department ID
        subject_mapping = {
            "MATH": ["Mathematics", "Computer Studies"],
            "LANG": ["English", "Kiswahili", "French", "German"],
            "SCI": ["Chemistry", "Physics", "Biology"],
            "HUM": ["History & Government", "Geography", "CRE", "IRE", "HRE"],
            "TECH": ["Agriculture", "Business Studies", "Home Science", "Art & Design", "Music"]
        }

        for dept_code, subjects in subject_mapping.items():
            dept_id = dept_mapping.get(dept_code)
            if not dept_id:
                continue
            
            for subject_name in subjects:
                # Update all courses matching this name (across any grade or stream)
                await db.execute(
                    update(Course)
                    .where(Course.name.ilike(f"%{subject_name}%"))
                    .values(department_id=dept_id)
                )
        
        await db.commit()
        print("✅ SUCCESS: Kenyan departments seeded and curriculum subjects mapped successfully!")

if __name__ == "__main__":
    asyncio.run(seed_kenyan_departments_and_subjects())