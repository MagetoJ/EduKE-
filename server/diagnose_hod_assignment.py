"""
One-off diagnostic for the "You are not assigned as HOD to any department"
404 on GET /api/hod/my-department.

That endpoint (server/hod.py::get_department_details) does exactly one
check: SELECT * FROM academic_departments WHERE hod_id = <logged-in user's
User.id>. If nothing comes back, it 404s -- by design, it will NOT fall
back to guessing a department (that's the old "self-healing" bug).

This script prints every department + its hod_id/hod name/hod email, and
every user whose school_users.role = HOD, side by side, so you can see at
a glance whether:
  (a) the assignment never actually landed on academic_departments.hod_id
      (e.g. the save request failed silently, or hit a different dept row)
  (b) it landed on the right row but you're testing while logged in as a
      different account than the one you assigned
  (c) role says HOD but hod_id is NULL (or vice versa) -- the exact
      split-brain hod_shared.py was written to prevent

Run with:  python diagnose_hod_assignment.py
"""
import asyncio
from sqlalchemy import text
from database import get_db


async def diagnose():
    async for db in get_db():
        print("=" * 70)
        print("ACADEMIC DEPARTMENTS (source of truth for /api/hod/my-department)")
        print("=" * 70)
        depts = await db.execute(text("""
            SELECT ad.id, ad.school_id, ad.name, ad.code, ad.hod_id,
                   u.full_name, u.email
            FROM academic_departments ad
            LEFT JOIN users u ON u.id = ad.hod_id
            ORDER BY ad.school_id, ad.id
        """))
        rows = depts.all()
        if not rows:
            print("  (no departments exist at all)")
        for r in rows:
            hod_desc = f"hod_id={r.hod_id} ({r.full_name} <{r.email}>)" if r.hod_id else "hod_id=NULL (no HOD)"
            print(f"  dept #{r.id} school={r.school_id:<3} '{r.name}' [{r.code}] -> {hod_desc}")

        print()
        print("=" * 70)
        print("USERS WHOSE school_users.role = 'hod'")
        print("=" * 70)
        role_hods = await db.execute(text("""
            SELECT su.school_id, su.user_id, u.full_name, u.email
            FROM school_users su
            JOIN users u ON u.id = su.user_id
            WHERE LOWER(su.role::text) = 'hod'
            ORDER BY su.school_id, su.user_id
        """))
        rrows = role_hods.all()
        if not rrows:
            print("  (no one currently has role='hod')")
        for r in rrows:
            print(f"  user_id={r.user_id} school={r.school_id:<3} {r.full_name} <{r.email}>")

        print()
        print("=" * 70)
        print("MISMATCHES (role says HOD but no department row points at them, or vice versa)")
        print("=" * 70)
        mismatches = await db.execute(text("""
            SELECT su.user_id, u.full_name, u.email, su.school_id
            FROM school_users su
            JOIN users u ON u.id = su.user_id
            WHERE LOWER(su.role::text) = 'hod'
              AND NOT EXISTS (
                  SELECT 1 FROM academic_departments ad
                  WHERE ad.hod_id = su.user_id AND ad.school_id = su.school_id
              )
        """))
        mrows = mismatches.all()
        if not mrows:
            print("  none found -- role/department data is consistent")
        for r in mrows:
            print(f"  user_id={r.user_id} {r.full_name} <{r.email}> has role=hod in school "
                  f"{r.school_id} but is NOT hod_id on any department row -> "
                  f"THIS is who gets the 404")
        print()
        print("=" * 70)
        print("SCHOOL_USERS ROWS FOR USER_ID=2 (Jabez Mageto, assigned Humanities HOD)")
        print("=" * 70)
        target = await db.execute(text("""
            SELECT su.school_id, su.role::text, su.is_active, u.email
            FROM school_users su
            JOIN users u ON u.id = su.user_id
            WHERE su.user_id = 2
        """))
        for r in target.all():
            print(f"  school={r.school_id} role={r.role} is_active={r.is_active} email={r.email}")
        print()
        print("  If this user_id=2 IS who you log in as when you hit /api/hod/my-department")
        print("  and still get a 404, the mismatch is almost certainly that your JWT's")
        print("  'sub' (username) or session doesn't resolve to user.id == 2 -- e.g. you")
        print("  logged in with a different account/tab that happens to render the same")
        print("  HOD dashboard UI. Log out fully, log back in with kaptainkiddo01@gmail.com,")
        print("  and hit the endpoint again.")

        break


if __name__ == "__main__":
    asyncio.run(diagnose())