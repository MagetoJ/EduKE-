import asyncio
from datetime import date
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy import select, inspect

from database import engine
import models
from models import (
    User, Student, ParentStudentLink, Attendance,
    GradeEntry, ClassProgressReport, FeeInvoice, Payment
)

AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)

async def seed_data():
    async with AsyncSessionLocal() as db:
        # 1. Fetch a target student
        result = await db.execute(select(Student).limit(1))
        student = result.scalar_one_or_none()

        if not student:
            print("❌ No student record found in database.")
            return

        school_id = getattr(student, "school_id", 1)
        student_name = f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip() or f"Student #{student.id}"
        print(f"✔️ Target Student: {student_name} (ID: {student.id})")

        # 2. Fetch or create Parent User
        parent_email = "parent.test@example.com"
        result = await db.execute(select(User).where(User.email == parent_email))
        parent = result.scalar_one_or_none()

        if not parent:
            # Inspect actual valid column names on the User model
            user_columns = {col.name for col in inspect(User).columns}
            print(f"ℹ️ User table valid columns: {user_columns}")

            user_kwargs = {}
            
            # Map email
            if "email" in user_columns:
                user_kwargs["email"] = parent_email
            if "username" in user_columns:
                user_kwargs["username"] = parent_email

            # Map names according to what exists on User
            if "first_name" in user_columns:
                user_kwargs["first_name"] = "Jane"
            if "last_name" in user_columns:
                user_kwargs["last_name"] = "Doe"
            if "name" in user_columns:
                user_kwargs["name"] = "Jane Doe"
            if "full_name" in user_columns:
                user_kwargs["full_name"] = "Jane Doe"

            # Map tenant/school
            if "school_id" in user_columns:
                user_kwargs["school_id"] = school_id

            # Map role
            if "role" in user_columns:
                user_kwargs["role"] = "parent"
            elif "user_type" in user_columns:
                user_kwargs["user_type"] = "parent"

            # Map password
            if "password_hash" in user_columns:
                user_kwargs["password_hash"] = "pbkdf2:sha256:fakehashforlocaltesting"
            elif "hashed_password" in user_columns:
                user_kwargs["hashed_password"] = "pbkdf2:sha256:fakehashforlocaltesting"
            elif "password" in user_columns:
                user_kwargs["password"] = "pbkdf2:sha256:fakehashforlocaltesting"

            # Map active status
            if "is_active" in user_columns:
                user_kwargs["is_active"] = True

            parent = User(**user_kwargs)
            db.add(parent)
            await db.flush()
            print(f"✔️ Created Test Parent Account (ID: {parent.id})")
        else:
            print(f"✔️ Found Existing Parent Account (ID: {parent.id})")

        # 3. Establish Parent-Student Link
        result = await db.execute(
            select(ParentStudentLink).where(
                ParentStudentLink.parent_id == parent.id,
                ParentStudentLink.student_id == student.id
            )
        )
        link = result.scalar_one_or_none()

        if not link:
            link = ParentStudentLink(
                parent_id=parent.id,
                student_id=student.id,
                relationship_type="Mother"
            )
            db.add(link)
            print("✔️ Created ParentStudentLink relationship.")

        await db.commit()
        print("🚀 Successfully seeded test portal data!")

if __name__ == "__main__":
    asyncio.run(seed_data())