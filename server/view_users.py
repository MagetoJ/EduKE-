import asyncio
from sqlalchemy import select
from database import get_db
from models import User, school_users

async def check_database():
    print("🔄 Connecting to Render PostgreSQL database...")
    async for session in get_db():
        # 1. Fetch Users
        user_query = await session.execute(select(User))
        users = user_query.scalars().all()

        print(f"\n================ SYSTEM USERS ({len(users)}) ================")
        for u in users:
            print(f"ID: {u.id} | Name: {u.full_name} | Email: {u.email} | Active: {u.is_active}")

        # 2. Fetch School Mapping
        mapping_query = await session.execute(select(school_users))
        mappings = mapping_query.all()

        print(f"\n============ SCHOOL TENANT MAPPINGS ({len(mappings)}) ============")
        for row in mappings:
            print(f"School ID: {row.school_id} | User ID: {row.user_id} | Role: {row.role} | Active: {row.is_active}")
        break

if __name__ == "__main__":
    asyncio.run(check_database())