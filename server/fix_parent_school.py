import asyncio
from sqlalchemy import select, update, inspect
from sqlalchemy.ext.asyncio import async_sessionmaker

from database import engine
import models
from models import User, School, Student

AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)

async def fix_parent_school():
    async with AsyncSessionLocal() as db:
        # 1. Fetch an active school
        school_stmt = select(School).limit(1)
        res = await db.execute(school_stmt)
        active_school = res.scalar_one_or_none()

        if not active_school:
            print("❌ No active school record found in the database.")
            return

        school_id = active_school.id
        print(f"✔️ Found Active School ID: {school_id} ({getattr(active_school, 'name', 'Active School')})")

        # 2. Inspect User columns and update if supported
        user_cols = {col.name for col in inspect(User).columns}
        if "school_id" in user_cols:
            await db.execute(
                update(User)
                .where(User.email == "parent.test@example.com")
                .values(school_id=school_id)
            )
            print("✔️ Assigned school_id to Parent User record.")
        else:
            print("ℹ️ User model does not use school_id directly (Tenant isolated via Student linkage).")

        # 3. Update Student 403 school_id
        student_cols = {col.name for col in inspect(Student).columns}
        if "school_id" in student_cols:
            await db.execute(
                update(Student)
                .where(Student.id == 403)
                .values(school_id=school_id)
            )
            print(f"✔️ Assigned School ID {school_id} to Student ID 403.")

        await db.commit()

        print("--------------------------------------------------")
        print("✅ SUCCESS: School assignment updated!")
        print(f"   • Account: parent.test@example.com")
        print(f"   • Active School ID: {school_id}")
        print("--------------------------------------------------")

if __name__ == "__main__":
    asyncio.run(fix_parent_school())