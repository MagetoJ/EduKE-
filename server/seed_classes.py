import asyncio
from database import engine
from sqlalchemy import text

async def seed_classes():
    print("🌱 Populating school_classes from existing student records...")
    async with engine.begin() as conn:
        await conn.execute(text("""
            INSERT INTO school_classes (school_id, grade_level, stream_section, academic_year)
            SELECT DISTINCT school_id, grade, stream_section, '2026'
            FROM students
            WHERE grade IS NOT NULL AND stream_section IS NOT NULL
            ON CONFLICT (school_id, grade_level, stream_section, academic_year) DO NOTHING;
        """))
    print("✅ Classes populated successfully!")

if __name__ == "__main__":
    asyncio.run(seed_classes())