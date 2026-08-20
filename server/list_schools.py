"""
Lists all schools so you can pick the right school_id to link a user to.

Usage (run from server/ folder, same env as your app):
    python list_schools.py
"""
import asyncio
from sqlalchemy import select
from database import async_session_maker
from models import School


async def main():
    async with async_session_maker() as db:
        result = await db.execute(select(School.id, School.name, School.slug, School.status))
        schools = result.all()
        if not schools:
            print("❌ No schools found in the database.")
            return
        print(f"Found {len(schools)} school(s):\n")
        for s in schools:
            print(f"  id={s.id:<5} name={s.name:<35} slug={s.slug:<25} status={s.status}")


if __name__ == "__main__":
    asyncio.run(main())