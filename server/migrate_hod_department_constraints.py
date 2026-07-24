"""
Adds DB-level constraints so the "two HODs in one department" bug can't come
back, even from a future code path or a direct SQL script that forgets to
check application-level rules.

    1. One HOD per school: a user can be hod_id on at most one
       academic_departments row per school (partial unique index --
       NULLs are unrestricted, so departments with no HOD yet are fine).
    2. No duplicate department names (case-insensitive) within a school.

IMPORTANT: run audit_and_fix_hod_integrity.py --apply FIRST. If any existing
duplicate HOD assignments or duplicate department names are still in the
data, these constraints will fail to apply (Postgres will refuse to create
a unique index over data that violates it) -- that failure is intentional,
it's telling you the cleanup script needs to run first.

Usage:
    python migrate_hod_department_constraints.py
"""

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

        print("Adding unique index: one HOD per department, per school "
              "(academic_departments.hod_id)...")
        cur.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_one_department_per_hod
            ON academic_departments (school_id, hod_id)
            WHERE hod_id IS NOT NULL;
        """)

        print("Adding unique index: no duplicate department names per school "
              "(case-insensitive)...")
        cur.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_department_name_per_school_ci
            ON academic_departments (school_id, lower(name));
        """)

        print("✅ SUCCESS: HOD/department integrity constraints are live.")
        cur.close()
        conn.close()
    except psycopg2.errors.UniqueViolation as e:
        print(f"❌ Migration failed: existing data still violates one of these constraints: {e}")
        print("   Run: python audit_and_fix_hod_integrity.py --apply")
        print("   Then re-run this migration. For duplicate department names (section C of "
              "that script), you'll need to manually merge the duplicate rows first --")
        print("   that part can't be auto-fixed since it may involve moving courses, "
              "memberships, or assets between department rows.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()