"""
Links a user to a school in school_users (fixes "User is not assigned to an
active school" 403 on login).

Usage (run from server/ folder, same env as your app):
    python link_user_to_school.py <email> <school_id> <role>

Example:
    python link_user_to_school.py parent.test@example.com 11 parent

Valid roles: admin, teacher, staff, student, parent, class_teacher,
registrar, exam_officer, hod, timetable_manager, transport_manager,
boarding_master, cbc_coordinator, hr_manager, admission_officer, nurse,
counselor, librarian
"""
import asyncio
import sys
from sqlalchemy import select, insert, update
from database import async_session_maker
from models import User, School, school_users, UserRole


async def link(email: str, school_id: int, role: str):
    try:
        role_enum = UserRole(role)
    except ValueError:
        valid = ", ".join(r.value for r in UserRole)
        print(f"❌ Invalid role '{role}'. Valid roles: {valid}")
        return

    async with async_session_maker() as db:
        user_result = await db.execute(select(User).where(User.email == email))
        user = user_result.scalar_one_or_none()
        if not user:
            print(f"❌ No user found with email '{email}'.")
            return

        school_result = await db.execute(select(School).where(School.id == school_id))
        school = school_result.scalar_one_or_none()
        if not school:
            print(f"❌ No school found with id={school_id}.")
            return

        existing = await db.execute(
            select(school_users.c.id, school_users.c.is_active, school_users.c.role)
            .where(school_users.c.user_id == user.id, school_users.c.school_id == school_id)
        )
        row = existing.first()

        if row:
            if row.is_active:
                print(f"ℹ️  User is already actively linked to '{school.name}' with role "
                      f"'{row.role.value if hasattr(row.role, 'value') else row.role}'. Nothing to do.")
                return
            print(f"Found an inactive row — reactivating it (and updating role to '{role}')...")
            await db.execute(
                update(school_users)
                .where(school_users.c.id == row.id)
                .values(is_active=True, role=role_enum)
            )
        else:
            print(f"Inserting new school_users row: user={email} (id={user.id}), "
                  f"school='{school.name}' (id={school_id}), role={role}...")
            await db.execute(
                insert(school_users).values(
                    school_id=school_id,
                    user_id=user.id,
                    role=role_enum,
                    is_active=True,
                )
            )

        await db.commit()
        print(f"✅ Done. '{email}' can now log in as '{role}' at '{school.name}'.")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python link_user_to_school.py <email> <school_id> <role>")
        sys.exit(1)
    email_arg = sys.argv[1]
    school_id_arg = int(sys.argv[2])
    role_arg = sys.argv[3]
    asyncio.run(link(email_arg, school_id_arg, role_arg))