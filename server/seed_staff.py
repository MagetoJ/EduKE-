import asyncio
from sqlalchemy import select, insert
from database import get_db
from models import User, school_users, UserRole, School
from auth import get_password_hash

async def seed_school_staff():
    print("🔄 Connecting to Render PostgreSQL to seed staff records...")
    
    async for session in get_db():
        # 1. Identify your target school (Change slug to match your registered school name if needed)
        school_result = await session.execute(select(School).limit(1))
        school = school_result.scalar_one_or_none()
        
        if not school:
            print("🚨 CRITICAL: No schools found in the database. Please register a school first via the UI.")
            return

        print(f"📌 Found Target School: '{school.name}' (ID: {school.id})")

        # 2. Define sample staff data with proper system role definitions
        sample_staff = [
            {"email": "jane.doe@school.edu", "name": "Jane Doe", "role": UserRole.TEACHER},
            {"email": "john.registrar@school.edu", "name": "John Omwamba", "role": UserRole.STAFF},
            {"email": "alice.nurse@school.edu", "name": "Alice Wanjiku", "role": UserRole.STAFF}
        ]

        for staff_data in sample_staff:
            # Check if user already exists
            existing = await session.execute(select(User).where(User.email == staff_data["email"]))
            user = existing.scalar_one_or_none()

            if not user:
                # Create the User record
                user = User(
                    username=staff_data["email"],
                    email=staff_data["email"],
                    full_name=staff_data["name"],
                    hashed_password=get_password_hash("Temporary123!"),
                    is_active=True
                )
                session.add(user)
                await session.flush() # Flushes state to generate the user.id
                print(f"➕ Created User account: {staff_data['name']}")

            # Check if tenant mapping link exists
            link_exists = await session.execute(
                select(school_users).where(
                    school_users.c.school_id == school.id,
                    school_users.c.user_id == user.id
                )
            )
            
            if not link_exists.first():
                # Establish the essential multi-tenant association entry
                await session.execute(
                    insert(school_users).values(
                        school_id=school.id,
                        user_id=user.id,
                        role=staff_data["role"],
                        is_active=True
                    )
                )
                print(f"🔗 Linked {staff_data['name']} to school '{school.name}' as {staff_data['role'].value}")
        
        await session.commit()
        print("✅ Seeding completed successfully!")
        break

if __name__ == "__main__":
    asyncio.run(seed_school_staff())