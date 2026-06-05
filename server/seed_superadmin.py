import asyncio
from database import async_session_maker
from models import User, School, school_users, UserRole
from auth import get_password_hash
from sqlalchemy import select, insert

async def create_superadmin():
    async with async_session_maker() as db:
        # 1. Create Platform School if it doesn't exist
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
            print("Created Platform Administration school")
        
        # 2. Create SuperAdmin User
        username = "superadmin"
        email = "superadmin@eduke.com"
        password = "superadmin123"
        
        result = await db.execute(select(User).where(User.username == username))
        user = result.scalar_one_or_none()
        
        if not user:
            user = User(
                username=username,
                email=email,
                full_name="System Super Admin",
                hashed_password=get_password_hash(password),
                is_super_admin=True
            )
            db.add(user)
            await db.flush()
            print(f"Created user {username}")
        else:
            user.is_super_admin = True
            print(f"Updated user {username} to SuperAdmin")
        
        # 3. Link User to School
        membership_query = select(school_users).where(
            school_users.c.user_id == user.id,
            school_users.c.school_id == platform_school.id
        )
        membership = (await db.execute(membership_query)).first()
        
        if not membership:
            await db.execute(
                insert(school_users).values(
                    school_id=platform_school.id,
                    user_id=user.id,
                    role=UserRole.ADMIN,
                    is_active=True
                )
            )
            print("Linked SuperAdmin to Platform school")
        
        await db.commit()
        print("\n" + "="*40)
        print("SUPERADMIN CREDENTIALS")
        print(f"Email: {email}")
        print(f"Username: {username}")
        print(f"Password: {password}")
        print("="*40)

if __name__ == "__main__":
    asyncio.run(create_superadmin())
