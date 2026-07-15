import os
import sys
import psycopg2
from dotenv import load_dotenv

# Load the live DATABASE_URL from your .env file
load_dotenv()

def get_dsn() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        print("❌ ERROR: DATABASE_URL is not set in your .env file.")
        sys.exit(1)
    # psycopg2 needs standard postgresql:// instead of postgresql+asyncpg://
    if "postgresql+asyncpg://" in url:
        url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    elif "postgres://" in url:
        url = url.replace("postgres://", "postgresql://", 1)
    return url

def main():
    dsn = get_dsn()
    print(f"Connecting to live database: {dsn.split('@')[-1]}")

    try:
        conn = psycopg2.connect(dsn)
        conn.autocommit = True  # Instantly commit changes
        cur = conn.cursor()

        print("Executing migration...")
        cur.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS stream_section VARCHAR(20);")
        print("✅ SUCCESS: The 'stream_section' column has been successfully added to your 'students' table!")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()