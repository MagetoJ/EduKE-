import asyncio
from sqlalchemy import update, inspect
from sqlalchemy.ext.asyncio import async_sessionmaker

from database import engine
import models
from models import User

# Try importing passlib or werkzeug depending on what your backend uses
try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_pwd = pwd_context.hash("Password123!")
except ImportError:
    from werkzeug.security import generate_password_hash
    hashed_pwd = generate_password_hash("Password123!")

AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)

async def reset_password():
    async with AsyncSessionLocal() as db:
        # Inspect columns on User table to find the exact password field name
        user_columns = {col.name for col in inspect(User).columns}
        
        target_field = None
        if "hashed_password" in user_columns:
            target_field = "hashed_password"
        elif "password_hash" in user_columns:
            target_field = "password_hash"
        elif "password" in user_columns:
            target_field = "password"

        if not target_field:
            print("❌ Could not identify password column on User model.")
            return

        # Perform update query
        stmt = (
            update(User)
            .where(User.email == "parent.test@example.com")
            .values(**{target_field: hashed_pwd})
        )
        
        result = await db.execute(stmt)
        await db.commit()

        if result.rowcount > 0:
            print("--------------------------------------------------")
            print("✅ SUCCESS: Password updated!")
            print("   • Account: parent.test@example.com")
            print("   • New Password: Password123!")
            print("--------------------------------------------------")
        else:
            print("❌ Account 'parent.test@example.com' not found in database.")

if __name__ == "__main__":
    asyncio.run(reset_password())