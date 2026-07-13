import sys
import asyncio
import ssl
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, insert

# 1. FORCE THE WINDOWS EVENT LOOP BEFORE ANYTHING ELSE HAPPENS
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# 2. Import your models and auth ONLY after the event loop is fixed
from models import User, School, school_users, UserRole
from auth import get_password_hash

# 3. Clean Render URL (Removed ?ssl=require because we inject it manually below)
DB_URL = "postgresql+asyncpg://eduke_396b_user:t3CHVYbXLR9IRSo6uMooVMXZJQuZA6e7@dpg-d8gsheernols73c3k420-a.oregon-postgres.render.com/eduke_396b"

async def run_force_seed():
    print("🚀 Forcing connection to Render...")
    
    # 4. Create an un-droppable SSL Context
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    # 5. Build a dedicated engine just for this script
    engine = create_async_engine(DB_URL, connect_args={"ssl": ctx})
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    async with session_maker() as db:
        print("✅ Connected! Creating Super Admin...")
        
        # --- Create Platform School ---
        result = await db.execute(select(School).where(School.slug == "platform-admin"))
        platform_school = result.scalar_one_or_none()
        
        if not platform_school:
            platform_school = School(
                name="Platform Administration",
                slug="platform-admin",
                email="admin@eduke.com",
                status="active"
            )
            db.add(platform_school)
            await db.flush()
            print("🏫 Created Platform Administration school")
        
        # --- Create User ---
        result = await db.execute(select(User).where(User.username == "superadmin"))
        user = result.scalar_one_or_none()
        
        if not user:
            user = User(
                username="superadmin",
                email="superadmin@eduke.com",
                full_name="System Super Admin",
                hashed_password=get_password_hash("superadmin123"),
                is_super_admin=True
            )
            db.add(user)
            await db.flush()
            print("👤 Created Super Admin user")
        
        # --- Link User to School ---
        membership = (await db.execute(select(school_users).where(
            school_users.c.user_id == user.id,
            school_users.c.school_id == platform_school.id
        ))).first()
        
        if not membership:
            await db.execute(insert(school_users).values(
                school_id=platform_school.id,
                user_id=user.id,
                role=UserRole.ADMIN,
                is_active=True
            ))
            print("🔗 Linked Super Admin to Platform School")
        
        await db.commit()
        print("\n🎉 SUCCESS! You can now log in with:")
        print("Email: superadmin@eduke.com")
        print("Password: superadmin123")

if __name__ == "__main__":
    asyncio.run(run_force_seed())