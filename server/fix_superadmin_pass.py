import os
import sys
import asyncio
import models                  # Initializes core models (User, Course, Student)
import models_roles            # Initializes AcademicDepartment, etc.
import models_class_teacher
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from dotenv import load_dotenv

# Ensure local modules can be found safely
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models import User

# Dynamic Hashing Fallback Layer
try:
    # 1. Attempt to import a native password hashing function directly
    from auth import get_password_hash
    def hash_password(plain_text: str) -> str:
        return get_password_hash(plain_text)
except ImportError:
    try:
        # 2. Attempt to use a password context if it exists under a different variable name
        import auth
        context_attr = next((getattr(auth, name) for name in dir(auth) if "context" in name.lower()), None)
        if context_attr and hasattr(context_attr, "hash"):
            def hash_password(plain_text: str) -> str:
                return context_attr.hash(plain_text)
        else:
            raise AttributeError()
    except (ImportError, AttributeError, StopIteration):
        # 3. Fallback directly to passlib standard bcrypt configurations if imports are obscured
        from passlib.context import CryptContext
        fallback_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        def hash_password(plain_text: str) -> str:
            return fallback_context.hash(plain_text)

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL not detected in your .env file.")
    sys.exit(1)

# Format the asynchronous driver connection string if needed
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def main():
    async with AsyncSessionLocal() as db:
        email = "superadmin@eduke.com"
        new_password = "password123" # This plaintext password will log you in successfully
        
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if not user:
            print("❌ Superadmin row not found. Ensure you executed the INSERT SQL command first!")
            return
            
        print("Applying localized cryptographic hash...")
        user.hashed_password = hash_password(new_password)
        await db.commit()
        print(f"✅ SUCCESS: Password for {email} has been accurately synchronized!")
        print(f"👉 You can now log into your application with the password: {new_password}")

if __name__ == "__main__":
    asyncio.run(main())