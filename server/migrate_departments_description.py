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

        print("Altering academic_departments to add description...")
        cur.execute(
            "ALTER TABLE academic_departments ADD COLUMN IF NOT EXISTS description VARCHAR(500);"
        )

        print("✅ Migration complete.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()