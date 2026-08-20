"""
Normalizes school.status values so they exactly match 'active' where they
should (fixes case-sensitivity bugs like status="Active" being rejected by
strict == 'active' checks).

Usage (run from server/ folder, same env as your app):
    python fix_school_status.py
"""
import asyncio
from sqlalchemy import select, update
from database import async_session_maker
from models import School


async def main():
    async with async_session_maker() as db:
        result = await db.execute(select(School.id, School.name, School.status))
        schools = result.all()

        to_fix = [s for s in schools if s.status and s.status.strip().lower() == "active" and s.status != "active"]

        if not to_fix:
            print("✅ All schools already have exact lowercase status='active' (or are non-active). Nothing to fix.")
            return

        print(f"Found {len(to_fix)} school(s) with a case/whitespace mismatch:")
        for s in to_fix:
            print(f"  id={s.id} name={s.name!r} status={s.status!r} -> 'active'")

        for s in to_fix:
            await db.execute(update(School).where(School.id == s.id).values(status="active"))
        await db.commit()
        print("\n✅ Normalized. All listed schools now have status='active'.")


if __name__ == "__main__":
    asyncio.run(main())