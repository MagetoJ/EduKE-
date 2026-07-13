"""
One-off migration: repoint exams.subject_id's foreign key from subjects(id)
to courses(id).

Same root cause as migrate_timetable_fk.py: models.py's Exam.subject_id was
updated to reference courses.id (matching what the frontend actually sends --
course ids from /api/courses, not the old /api/academic/subjects records),
but SQLAlchemy's create_all() never alters an existing table's constraints.
The live database still enforces the OLD constraint against `subjects`,
which will reject every real POST /api/exams with a foreign-key violation
(surfaced as a 503) once the payload itself is valid.

What this script does, safely, in order:
  1. Connects using DATABASE_URL from your .env (same DB your app uses).
  2. Reports how many rows exist in exams, and how many of those have a
     subject_id that does NOT exist in courses(id) -- these would violate
     the new constraint and must be dealt with first.
  3. Finds the real name of the existing FK constraint on exams.subject_id.
  4. Drops that old constraint and adds a new one pointing at courses(id),
     inside a single transaction (rolls back on any error).

Usage:
    cd server
    python migrate_exams_fk.py            # dry run: report only
    python migrate_exams_fk.py --apply     # actually perform the migration
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
    print(f"Connecting to: {dsn.split('@')[-1]}")

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        cur.execute("SELECT COUNT(*) FROM exams")
        total_rows = cur.fetchone()[0]
        print(f"\nexams has {total_rows} row(s) total.")

        cur.execute("""
            SELECT e.id, e.subject_id
            FROM exams e
            LEFT JOIN courses c ON c.id = e.subject_id
            WHERE c.id IS NULL
        """)
        orphans = cur.fetchall()
        if orphans:
            print(f"\n⚠️  {len(orphans)} row(s) in exams reference a subject_id "
                  f"that does NOT exist in courses. These will violate the new constraint:")
            for exam_id, subject_id in orphans[:20]:
                print(f"   - exams.id={exam_id}  subject_id={subject_id}")
            if len(orphans) > 20:
                print(f"   ... and {len(orphans) - 20} more")
            print("\nThese rows must be fixed or deleted before the new constraint can be added.")
        else:
            print("✅ No orphaned rows found -- every existing subject_id already matches a course.")

        cur.execute("""
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'exams'
              AND tc.constraint_type = 'FOREIGN KEY'
              AND kcu.column_name = 'subject_id'
        """)
        row = cur.fetchone()
        if not row:
            print("\nNo existing foreign key constraint found on exams.subject_id "
                  "(maybe it was already fixed, or the table is fresh). Nothing to drop.")
            constraint_name = None
        else:
            constraint_name = row[0]
            print(f"\nExisting FK constraint name: {constraint_name}")

        if not args.apply:
            print("\nDry run only -- no changes made. Re-run with --apply to perform the migration.")
            conn.rollback()
            return

        if constraint_name:
            print(f"Dropping constraint {constraint_name} ...")
            cur.execute(f'ALTER TABLE exams DROP CONSTRAINT "{constraint_name}"')

        print("Adding new constraint referencing courses(id) ...")
        cur.execute("""
            ALTER TABLE exams
            ADD CONSTRAINT exams_subject_id_fkey
            FOREIGN KEY (subject_id) REFERENCES courses(id)
        """)

        conn.commit()
        print("\n✅ Migration applied successfully. exams.subject_id now references courses(id).")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed and was rolled back (no changes made): {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()