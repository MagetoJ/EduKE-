"""
Diagnostic script for "User is not assigned to an active school" 403 errors.

Usage (run from the server/ directory, same env as your app):
    python diagnose_login_403.py you@example.com

It reuses your existing DATABASE_URL / .env, so no credentials needed here.
"""
import asyncio
import sys
from sqlalchemy import select
from database import async_session_maker
from models import User, School, school_users


async def diagnose(email: str):
    async with async_session_maker() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            print(f"❌ No user found with email '{email}'.")
            # Show close matches in case of typo/case mismatch
            all_users = await db.execute(select(User.id, User.email, User.username))
            candidates = [r for r in all_users.all() if email.lower() in (r.email or "").lower()]
            if candidates:
                print("   Possible matches:")
                for c in candidates:
                    print(f"   - id={c.id} email={c.email} username={c.username}")
            return

        print(f"✅ User found: id={user.id}, email={user.email}, username={user.username}, "
              f"is_super_admin={getattr(user, 'is_super_admin', False)}")

        if getattr(user, "is_super_admin", False):
            print("ℹ️  User is a super_admin — school membership is not required to log in.")
            return

        # ALL school_users rows for this user, active or not
        all_rows = await db.execute(
            select(school_users.c.school_id, school_users.c.role, school_users.c.is_active)
            .where(school_users.c.user_id == user.id)
        )
        rows = all_rows.all()

        if not rows:
            print("❌ No rows in school_users for this user at all.")
            print("   Fix: insert a row into school_users linking this user to a school, e.g.:")
            print(f"   INSERT INTO school_users (school_id, user_id, role, is_active) "
                  f"VALUES (<school_id>, {user.id}, 'admin', true);")
            return

        print(f"Found {len(rows)} school_users row(s):")
        for r in rows:
            school_res = await db.execute(select(School.name).where(School.id == r.school_id))
            school_name = school_res.scalar_one_or_none()
            flag = "✅ ACTIVE" if r.is_active else "🚫 INACTIVE"
            print(f"   - school_id={r.school_id} ({school_name}), role={r.role}, {flag}")

        active_rows = [r for r in rows if r.is_active]
        if not active_rows:
            print("\n❌ This is your problem: user has school_users row(s), but none are is_active=True.")
            print("   Fix: UPDATE school_users SET is_active = true WHERE user_id = "
                  f"{user.id} AND school_id = <school_id>;")
        else:
            print("\n✅ User has at least one active school membership — login should not 403 for this reason.")
            print("   If it's still failing, double check you're hitting the same DATABASE_URL as this script.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python diagnose_login_403.py <email>")
        sys.exit(1)
    asyncio.run(diagnose(sys.argv[1]))