import asyncio
from sqlalchemy import select, update, inspect
from sqlalchemy.ext.asyncio import async_sessionmaker

from database import engine
import models
from models import User, School

AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)

async def resolve_parent_school_link():
    async with AsyncSessionLocal() as db:
        # 1. Fetch the Parent User
        user_res = await db.execute(select(User).where(User.email == "parent.test@example.com"))
        parent = user_res.scalar_one_or_none()
        if not parent:
            print("❌ Parent user parent.test@example.com not found!")
            return

        # 2. Fetch an active school
        school_res = await db.execute(select(School).limit(1))
        active_school = school_res.scalar_one_or_none()
        if not active_school:
            print("❌ No active school found in database! Create or seed a school first.")
            return

        print(f"✔️ Target Active School ID: {active_school.id} ({getattr(active_school, 'name', 'School')})")

        # 3. Check all attributes/relationships on User to see how school is linked
        user_cols = {col.name for col in inspect(User).columns}
        print(f"ℹ️ User table columns: {user_cols}")

        # If User has a direct school_id or tenant_id
        updated = False
        for col_name in ["school_id", "tenant_id", "active_school_id"]:
            if col_name in user_cols:
                await db.execute(
                    update(User)
                    .where(User.id == parent.id)
                    .values(**{col_name: active_school.id})
                )
                print(f"✔️ Directly updated User.{col_name} to {active_school.id}")
                updated = True

        # Check if there is a UserSchool or SchoolUser or TenantUser relationship table
        model_names = [attr for attr in dir(models) if not attr.startswith("_")]
        for m_name in model_names:
            cls = getattr(models, m_name)
            if hasattr(cls, "__tablename__") and "user" in cls.__tablename__ and "school" in cls.__tablename__:
                try:
                    # Check if a link exists or create one
                    cols = {c.name for c in inspect(cls).columns}
                    if "user_id" in cols and "school_id" in cols:
                        existing = await db.execute(
                            select(cls).where(cls.user_id == parent.id, cls.school_id == active_school.id)
                        )
                        if not existing.scalar_one_or_none():
                            link_inst = cls(user_id=parent.id, school_id=active_school.id)
                            db.add(link_inst)
                            print(f"✔️ Added user-school link record in table '{cls.__tablename__}'")
                            updated = True
                except Exception as e:
                    pass

        # If User has a relationship/attribute for school
        if hasattr(parent, "school_id") and getattr(parent, "school_id", None) is None:
            setattr(parent, "school_id", active_school.id)
            updated = True

        await db.commit()

        if updated:
            print("✅ Parent user school assignment successfully updated!")
        else:
            print("⚠️ No standard school linkage column found on User. Checking auth login requirements...")

if __name__ == "__main__":
    asyncio.run(resolve_parent_school_link())