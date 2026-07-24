"""
Audit + repair script for the "two HODs in one department" class of bugs.

This checks for every way the data could currently be inconsistent as a
result of the three previously-unsynchronized HOD write paths
(departments_admin.py, users.py's /assign-hod, and main.py's staff editor):

  A. A user flagged as HOD (school_users.role == 'hod') who is NOT actually
     the hod_id of any academic_departments row in that school. This is the
     exact bug from the Staff-page editor: someone shows up with the "HOD"
     badge/role but isn't wired to a real department. Fix: demote to TEACHER.

  B. A user set as hod_id on MORE THAN ONE academic_departments row in the
     same school (the reverse problem -- one person, two departments).
     Fix: keep the most-recently-assigned row, clear hod_id on the rest.

  C. Two (or more) academic_departments rows with the same name (case
     insensitive) in the same school. This is how "one department has two
     HODs" shows up visually even though each row only has one hod_id --
     admins see what looks like one department because of the duplicate
     name, but it's really two rows, each with its own HOD. This can't be
     safely auto-merged (courses/memberships/assets may point at either
     row), so it's reported only, for manual review/merge.

Run with --apply to actually write fixes; without it, this only reports
what it *would* do (dry run, default). Safe to run repeatedly.

Usage:
    python audit_and_fix_hod_integrity.py            # dry run, report only
    python audit_and_fix_hod_integrity.py --apply     # apply fixes for A and B
"""

import argparse
import asyncio

from sqlalchemy import text

from database import get_db


async def audit_and_fix(apply: bool):
    async for db in get_db():
        try:
            print("=" * 70)
            print("HOD / Department integrity audit" + (" (APPLYING FIXES)" if apply else " (dry run)"))
            print("=" * 70)

            # ---------------------------------------------------------------
            # A. Orphaned HOD role: school_users.role = 'hod' but the user is
            #    not any department's hod_id in that school.
            # ---------------------------------------------------------------
            print("\n[A] Checking for staff flagged HOD with no real department link...")
            orphan_rows = await db.execute(text("""
                SELECT su.school_id, su.user_id, u.full_name
                FROM school_users su
                JOIN users u ON u.id = su.user_id
                WHERE su.role = 'hod'
                  AND NOT EXISTS (
                        SELECT 1 FROM academic_departments ad
                        WHERE ad.hod_id = su.user_id
                          AND ad.school_id = su.school_id
                  )
            """))
            orphans = orphan_rows.all()

            if not orphans:
                print("    None found. Clean.")
            else:
                print(f"    Found {len(orphans)} orphaned 'hod' role assignment(s):")
                for school_id, user_id, full_name in orphans:
                    print(f"      - school {school_id}: {full_name} (user_id={user_id}) has role='hod' "
                          f"but isn't hod_id on any department")
                if apply:
                    await db.execute(text("""
                        UPDATE school_users
                        SET role = 'teacher'
                        WHERE role = 'hod'
                          AND NOT EXISTS (
                                SELECT 1 FROM academic_departments ad
                                WHERE ad.hod_id = school_users.user_id
                                  AND ad.school_id = school_users.school_id
                          )
                    """))
                    print(f"    -> Demoted {len(orphans)} orphaned HOD(s) to 'teacher'.")
                else:
                    print("    -> Re-run with --apply to demote these to 'teacher'.")

            # ---------------------------------------------------------------
            # B. Same user is hod_id on more than one department in a school.
            # ---------------------------------------------------------------
            print("\n[B] Checking for one person set as HOD of multiple departments...")
            dup_hod_rows = await db.execute(text("""
                SELECT hod_id, school_id
                FROM academic_departments
                WHERE hod_id IS NOT NULL
                GROUP BY hod_id, school_id
                HAVING count(id) > 1
            """))
            dup_hods = dup_hod_rows.all()

            if not dup_hods:
                print("    None found. Clean.")
            else:
                print(f"    Found {len(dup_hods)} user(s) assigned HOD of multiple departments:")
                for hod_id, school_id in dup_hods:
                    depts_res = await db.execute(text("""
                        SELECT id, name FROM academic_departments
                        WHERE hod_id = :hod_id AND school_id = :school_id
                        ORDER BY id DESC
                    """), {"hod_id": hod_id, "school_id": school_id})
                    depts = depts_res.all()
                    keep, clear = depts[0], depts[1:]
                    print(f"      - user_id={hod_id} (school {school_id}): keeping dept "
                          f"'{keep[1]}' (id={keep[0]}), " +
                          (", ".join(f"clearing '{d[1]}' (id={d[0]})" for d in clear)))
                    if apply:
                        for dept_id, _name in clear:
                            await db.execute(text("""
                                UPDATE academic_departments SET hod_id = NULL WHERE id = :dept_id
                            """), {"dept_id": dept_id})
                if not apply:
                    print("    -> Re-run with --apply to keep the most recent assignment "
                          "and clear the rest.")
                else:
                    print(f"    -> Fixed {len(dup_hods)} user(s).")

            # ---------------------------------------------------------------
            # C. Duplicate department names within the same school (report
            #    only -- needs a human to decide how to merge).
            # ---------------------------------------------------------------
            print("\n[C] Checking for duplicate-named departments (same school)...")
            dup_name_rows = await db.execute(text("""
                SELECT school_id, lower(name) AS lname, array_agg(id) AS ids, array_agg(name) AS names
                FROM academic_departments
                GROUP BY school_id, lower(name)
                HAVING count(id) > 1
            """))
            dup_names = dup_name_rows.all()

            if not dup_names:
                print("    None found. Clean.")
            else:
                print(f"    Found {len(dup_names)} duplicate department name group(s) -- "
                      f"NOT auto-fixed, needs manual review:")
                for school_id, lname, ids, names in dup_names:
                    hods_res = await db.execute(text("""
                        SELECT ad.id, ad.name, ad.hod_id, u.full_name
                        FROM academic_departments ad
                        LEFT JOIN users u ON u.id = ad.hod_id
                        WHERE ad.id = ANY(:ids)
                    """), {"ids": ids})
                    print(f"      - school {school_id}, name '{lname}':")
                    for dept_id, name, hod_id, hod_name in hods_res.all():
                        hod_desc = f"HOD: {hod_name} (id={hod_id})" if hod_id else "no HOD"
                        print(f"          dept id={dept_id} name='{name}' -> {hod_desc}")
                print("    -> These need a human decision: pick which row to keep, move any "
                      "courses/memberships/assets pointing at the others onto it, then delete "
                      "the duplicate rows. Not safe to automate.")

            if apply:
                await db.commit()
                print("\nChanges committed.")
            else:
                print("\nDry run only -- nothing was changed. Re-run with --apply to fix A and B.")

        except Exception as e:
            print(f"\nAn error occurred: {e}")
            print("Note: if this is SQLite (not Postgres), array_agg()/ANY() in section C "
                  "aren't supported -- run section C's checks manually or point DATABASE_URL "
                  "at your Postgres instance.")
            raise
        finally:
            break


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply fixes instead of just reporting them")
    args = parser.parse_args()
    asyncio.run(audit_and_fix(apply=args.apply))