"""
One-off migration: add timetable_slots.stream_section.

Why this is needed:
  models.py now defines TimetableSlot.stream_section, but create_all()
  never alters existing tables -- it only creates missing ones. So a
  live database that already has a timetable_slots table won't get the
  new column automatically, and every read/write that touches it will
  fail with an UndefinedColumn error.

This is required for the timetable builder to be able to match a slot
against ClassSubjectAssignment (which is scoped by grade + stream), so
that the same subject taught to different streams of a grade by
different teachers can each get their own, non-colliding timetable.

What this script does, safely, in order:
  1. Connects using DATABASE_URL from your .env (same DB your app uses).
  2. Checks whether timetable_slots.stream_section already exists.
  3. If missing, adds it as NOT NULL DEFAULT '' (matches the model),
     which is safe to run against a table that already has rows --
     existing rows are backfilled with '' (meaning "whole grade / no
     stream"), preserving today's actual behavior exactly.

Usage:
    cd server
    python migrate_timetable_stream.py            # dry run: report only
    python migrate_timetable_stream.py --apply     # actually perform the migration
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
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'timetable_slots' AND column_name = 'stream_section'
        """)
        already_exists = cur.fetchone() is not None

        cur.execute("SELECT COUNT(*) FROM timetable_slots")
        total_rows = cur.fetchone()[0]
        print(f"\ntimetable_slots has {total_rows} row(s) total.")

        if already_exists:
            print("✅ stream_section already exists on timetable_slots. Nothing to do.")
            conn.rollback()
            return

        print("stream_section column is missing and will be added as NOT NULL DEFAULT ''.")

        if not args.apply:
            print("\nDry run only -- no changes made. Re-run with --apply to perform the migration.")
            conn.rollback()
            return

        print("Adding column stream_section ...")
        cur.execute("""
            ALTER TABLE timetable_slots
            ADD COLUMN stream_section VARCHAR(20) NOT NULL DEFAULT ''
        """)

        conn.commit()
        print("\n✅ Migration applied successfully. timetable_slots.stream_section now exists "
              "(existing rows backfilled with '').")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed and was rolled back (no changes made): {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()