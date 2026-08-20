import asyncio
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker

from database import engine, Base
from models import User, School, school_users
from auth import get_password_hash

AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)

ALL_ROLES = [
    "teacher", "class_teacher", "registrar", "exam_officer", 
    "hod", "timetable_manager", "transport_manager", "boarding_master", 
    "cbc_coordinator", "hr_manager", "admission_officer", "nurse", 
    "administrator", "counselor", "librarian", "parent", "student"
]

async def seed_roles():
    async with AsyncSessionLocal() as db:
        print("⏳ Ensuring database tables exist...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # 1. Fetch default active school
        res_school = await db.execute(select(School).limit(1))
        school = res_school.scalar_one_or_none()
        if not school:
            print("❌ No active school found. Please run seed_db.py first.")
            return
        
        print(f"✔️ Active School ID: {school.id}")

        # 2. Seed test accounts for each role
        hashed_pwd = get_password_hash("Password123!")

        for r_name in ALL_ROLES:
            email = f"{r_name}@eduke.app"
            username = f"user_{r_name}"

            res_u = await db.execute(select(User).where(User.email == email))
            user = res_u.scalar_one_or_none()

            if not user:
                user = User(
                    username=username,
                    email=email,
                    full_name=f"Test {r_name.replace('_', ' ').title()}",
                    hashed_password=hashed_pwd,
                    is_active=True,
                    is_super_admin=(r_name == "administrator")
                )
                db.add(user)
                await db.flush()
                print(f"✔️ Created User: {email}")

            # Assign membership row in school_users
            mem_stmt = select(school_users).where(
                school_users.c.user_id == user.id,
                school_users.c.school_id == school.id
            )
            existing_mem = (await db.execute(mem_stmt)).first()

            if not existing_mem:
                stmt_insert = school_users.insert().values(
                    user_id=user.id,
                    school_id=school.id,
                    role=r_name,
                    is_active=True
                )
                await db.execute(stmt_insert)
                print(f"   ↳ Linked as {r_name} in school_users.")

        await db.commit()
        print("🚀 Successfully seeded all 17 system roles and test accounts!")

if __name__ == "__main__":
    asyncio.run(seed_roles())