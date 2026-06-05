import asyncio
from database import async_session_maker, init_db
from models import User
from auth import get_password_hash
from sqlalchemy import select

async def create_admin():
    # Initialize DB tables first
    await init_db()
    
    async with async_session_maker() as db:
        # Check if the admin already exists
        result = await db.execute(select(User).where(User.email == 'admin@eduke.com'))
        if result.scalar_one_or_none():
            print("Admin already exists!")
            return

        new_admin = User(
            username='admin@eduke.com',
            email='admin@eduke.com',
            full_name='System Admin',
            hashed_password=get_password_hash('admin123'),
            is_super_admin=True,
            is_active=True
        )
        db.add(new_admin)
        await db.commit()
        print('SuperAdmin created successfully!')

if __name__ == "__main__":
    asyncio.run(create_admin())
