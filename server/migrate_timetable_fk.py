"""
One-off migration: repoint timetable_slots.subject_id's foreign key
from subjects(id) to courses(id).

Why this is needed:
  models.py was updated so TimetableSlot.subject_id references
  courses.id instead of subjects.id, but SQLAlchemy's create_all()
  never alters existing tables/constraints -- only creates missing
  ones. So the live database still enforces the OLD constraint,
  which causes every POST /api/timetable to fail with a foreign-key
  violation (surfaced to the frontend as a 503).

What this script does, safely, in order:
  1. Connects using DATABASE_URL from your .env (same DB your app uses).
  2. Reports how many rows exist in timetable_slots, and how many of
     those have a subject_id that does NOT exist in courses (id) --
     these would violate the new constraint and must be dealt with
     before we can add it.
  3. Finds the real name of the existing FK constraint on
     timetable_slots.subject_id (Postgres auto-generates a name; we
     don't hardcode it).
  4. Drops that old constraint and adds a new one pointing at
     courses(id), inside a single transaction (rolls back on any
     error, so it's all-or-nothing).

Usage:
    cd server
    python migrate_timetable_fk.py            # dry run: report only
    python migrate_timetable_fk.py --apply     # actually perform the migration
"""

import os
import sys
import argparse
import psycopg2
from dotenv import load_dotenv

load_dotenv()


def get_dsn() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        print("ERROR: DATABASE_URL is not set in your .env file.")
        sys.exit(1)
    # psycopg2 wants plain postgresql://, not the +asyncpg variant used elsewhere in the app
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Actually perform the migration (default is dry-run/report only)")
    args = parser.parse_args()

    dsn = get_dsn()
    print(f"Connecting to: {dsn.split('@')[-1]}")  # never print credentials

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # --- 1. Basic counts -------------------------------------------------
        cur.execute("SELECT COUNT(*) FROM timetable_slots")
        total_rows = cur.fetchone()[0]
        print(f"\ntimetable_slots has {total_rows} row(s) total.")

        # --- 2. Orphan check: subject_id values that don't exist in courses --
        cur.execute("""
            SELECT ts.id, ts.subject_id
            FROM timetable_slots ts
            LEFT JOIN courses c ON c.id = ts.subject_id
            WHERE c.id IS NULL
        """)
        orphans = cur.fetchall()
        if orphans:
            print(f"\n⚠️  {len(orphans)} row(s) in timetable_slots reference a subject_id "
                  f"that does NOT exist in courses. These will violate the new constraint:")
            for slot_id, subject_id in orphans[:20]:
                print(f"   - timetable_slots.id={slot_id}  subject_id={subject_id}")
            if len(orphans) > 20:
                print(f"   ... and {len(orphans) - 20} more")
            print("\nThese rows must be fixed or deleted before the new constraint can be added.")
            print("This script will NOT delete data automatically. Re-run after cleaning them up,")
            print("or pass --apply anyway if you're OK with the migration failing safely (it will")
            print("roll back and change nothing).")
        else:
            print("✅ No orphaned rows found -- every existing subject_id already matches a course.")

        # --- 3. Find the real constraint name ---------------------------------
        cur.execute("""
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'timetable_slots'
              AND tc.constraint_type = 'FOREIGN KEY'
              AND kcu.column_name = 'subject_id'
        """)
        row = cur.fetchone()
        if not row:
            print("\nNo existing foreign key constraint found on timetable_slots.subject_id "
                  "(maybe it was already fixed, or the table is fresh). Nothing to drop.")
            constraint_name = None
        else:
            constraint_name = row[0]
            print(f"\nExisting FK constraint name: {constraint_name}")

        if not args.apply:
            print("\nDry run only -- no changes made. Re-run with --apply to perform the migration.")
            conn.rollback()
            return

        # --- 4. Apply the migration --------------------------------------------
        if constraint_name:
            print(f"Dropping constraint {constraint_name} ...")
            cur.execute(f'ALTER TABLE timetable_slots DROP CONSTRAINT "{constraint_name}"')

        print("Adding new constraint referencing courses(id) ...")
        cur.execute("""
            ALTER TABLE timetable_slots
            ADD CONSTRAINT timetable_slots_subject_id_fkey
            FOREIGN KEY (subject_id) REFERENCES courses(id)
        """)

        conn.commit()
        print("\n✅ Migration applied successfully. timetable_slots.subject_id now references courses(id).")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed and was rolled back (no changes made): {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()