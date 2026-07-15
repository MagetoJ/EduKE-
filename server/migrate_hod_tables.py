import os
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def get_dsn() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        print("❌ ERROR: DATABASE_URL is not set in your .env file.")
        sys.exit(1)
    if "postgresql+asyncpg://" in url:
        url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    return url

def main():
    dsn = get_dsn()
    print(f"Connecting to live database: {dsn.split('@')[-1]}")

    try:
        conn = psycopg2.connect(dsn)
        conn.autocommit = True
        cur = conn.cursor()

        print("Altering courses table to add department_id...")
        cur.execute("ALTER TABLE courses ADD COLUMN IF NOT EXISTS department_id INT REFERENCES academic_departments(id) ON DELETE SET NULL;")
        
        print("Creating department_memberships table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS department_memberships (
                id SERIAL PRIMARY KEY,
                school_id INT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
                department_id INT NOT NULL REFERENCES academic_departments(id) ON DELETE CASCADE,
                teacher_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (department_id, teacher_id)
            );
        """)
        
        print("✅ SUCCESS: HOD Database tables and columns are successfully configured!")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()