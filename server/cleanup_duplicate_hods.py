import asyncio
from sqlalchemy import text
from database import get_db

async def cleanup_duplicate_hods():
    print("Starting HOD duplicate cleanup...")
    
    # Grab the database session
    async for db in get_db():
        try:
            # 1. Find users who are assigned to more than 1 department using raw SQL
            find_duplicates_sql = text("""
                SELECT hod_id 
                FROM academic_departments 
                WHERE hod_id IS NOT NULL 
                GROUP BY hod_id 
                HAVING count(id) > 1
            """)
            
            result = await db.execute(find_duplicates_sql)
            rows = result.all()
            duplicate_hod_ids = [row[0] for row in rows]

            if not duplicate_hod_ids:
                print("No duplicate HOD assignments found. The database is clean!")
                break

            print(f"Found {len(duplicate_hod_ids)} users with multiple departments. Fixing now...")

            # 2. Iterate through corrupted users and fix them
            for user_id in duplicate_hod_ids:
                # Fetch all departments for this user, ordered by ID descending (newest first)
                get_depts_sql = text("""
                    SELECT id, name 
                    FROM academic_departments 
                    WHERE hod_id = :user_id 
                    ORDER BY id DESC
                """)
                dept_res = await db.execute(get_depts_sql, {"user_id": user_id})
                depts = dept_res.all()

                # Keep the newest one, nullify the rest
                dept_to_keep = depts[0]
                depts_to_clear = depts[1:]

                print(f"User {user_id}: Keeping Dept ID {dept_to_keep[0]} ('{dept_to_keep[1]}')")
                
                for dept in depts_to_clear:
                    print(f"  -> Nullifying HOD for Dept ID {dept[0]} ('{dept[1]}')")
                    clear_sql = text("""
                        UPDATE academic_departments 
                        SET hod_id = NULL 
                        WHERE id = :dept_id
                    """)
                    await db.execute(clear_sql, {"dept_id": dept[0]})

            # 3. Commit the fixes
            await db.commit()
            print("Cleanup complete! You can now safely run the SQL migration.")
            
        except Exception as e:
            print(f"An error occurred: {e}")
            print("Note: If it says 'relation does not exist', your table might be named 'departments' instead of 'academic_departments'.")
        finally:
            break # Exit the generator loop cleanly

if __name__ == "__main__":
    asyncio.run(cleanup_duplicate_hods())