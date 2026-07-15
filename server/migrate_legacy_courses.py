import os
import sys
import asyncio
from sqlalchemy import select, text

# Ensure the parent server directory is in the Python path if executed directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import async_session_maker
from models import Course, LearningArea, GradeBand

async def schema_self_heal(db):
    """Checks for missing CBC columns on the existing courses table and patches them dynamically."""
    print("[+] Checking database table schema for missing columns...")
    try:
        # Check if learning_area_id exists in the columns of the courses table
        await db.execute(text("SELECT learning_area_id FROM courses LIMIT 1;"))
    except Exception:
        # If it fails, the columns do not exist. Rollback the failed check transaction block first
        await db.rollback()
        print("[!] Missing CBC taxonomy columns detected. Altering 'courses' table...")
        
        # Execute ALTER TABLE statements to add the missing foreign key columns safely
        await db.execute(text("""
            ALTER TABLE courses 
            ADD COLUMN IF NOT EXISTS learning_area_id INT REFERENCES master_learning_areas(id) ON DELETE RESTRICT,
            ADD COLUMN IF NOT EXISTS grade_band_id INT REFERENCES cbc_grade_bands(id) ON DELETE RESTRICT;
        """))
        await db.commit()
        print("[+] Schema self-heal completed successfully!")

async def migrate_loose_grades_to_bands():
    async with async_session_maker() as db:
        # 1. Run the schema self-heal migration before doing any data selections
        await schema_self_heal(db)
        
        try:
            # 2. Fetch only courses that haven't been linked to a normalized CBC grade band yet
            result = await db.execute(select(Course).filter(Course.grade_band_id == None))
            legacy_courses = result.scalars().all()
            
            if not legacy_courses:
                print("[*] No legacy courses found requiring grade band migration.")
                return

            # 3. Fetch the target JSS Grade Band from the seeded master reference data
            band_result = await db.execute(select(GradeBand).filter_by(code="JSS"))
            jss_band = band_result.scalar_one_or_none()
            
            if not jss_band:
                print("[-] Error: 'JSS' Grade Band not found in database.")
                print("    Please run 'python server/seed_cbc_curriculum.py' before executing migrations!")
                return

            print(f"[+] Found {len(legacy_courses)} legacy courses. Commencing migration mapping...")
            migrated_count = 0

            # 4. Iterate and match loose string values
            for course in legacy_courses:
                grade_str = str(course.grade) if course.grade else ""
                
                if "Grade 7" in grade_str or "Grade 8" in grade_str or "Grade 9" in grade_str:
                    course.grade_band_id = jss_band.id
                    migrated_count += 1
                    
                    # Try to automatically match KICD learning area codes based on course name
                    la_result = await db.execute(
                        select(LearningArea).filter(LearningArea.name.ilike(f"%{course.name}%"))
                    )
                    matched_la = la_result.scalar_one_or_none()
                    
                    if matched_la:
                        course.learning_area_id = matched_la.id
                        print(f"    -> Linked '{course.name}' to Learning Area: '{matched_la.name}'")
                    else:
                        print(f"    -> Linked '{course.name}' to JSS Grade Band (No direct Learning Area match found)")

            # 5. Flush and commit updates asynchronously 
            await db.commit()
            print(f"\n[*] Successfully migrated {migrated_count} legacy free-text items to matching CBC taxonomy structures.")

        except Exception as e:
            await db.rollback()
            print(f"[-] Migration failed! Database rolled back. Error details: {e}")

if __name__ == "__main__":
    asyncio.run(migrate_loose_grades_to_bands())