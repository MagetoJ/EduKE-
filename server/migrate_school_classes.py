import asyncio
from database import engine
from sqlalchemy import text

async def run_migration():
    print("🚀 Starting migration for SchoolClass table and FK references...")
    
    async with engine.begin() as conn:
        # 1. Create school_classes table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS school_classes (
                id SERIAL PRIMARY KEY,
                school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
                grade_level VARCHAR(50) NOT NULL,
                stream_section VARCHAR(50) NOT NULL,
                academic_year VARCHAR(20) DEFAULT '2026',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_school_grade_stream UNIQUE (school_id, grade_level, stream_section, academic_year)
            );
        """))
        
        # 2. Add class_id to related tables if not existing
        tables = ["students", "class_teacher_assignments", "class_subject_assignments", "timetable_slots"]
        for table in tables:
            await conn.execute(text(f"""
                ALTER TABLE {table} 
                ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES school_classes(id) ON DELETE SET NULL;
            """))

        # 3. Add stream_section to timetable_slots if missing
        await conn.execute(text("""
            ALTER TABLE timetable_slots 
            ADD COLUMN IF NOT EXISTS stream_section VARCHAR(50);
        """))

    print("✅ Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(run_migration())