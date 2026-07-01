import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import bcrypt

# Import the correct names from your live files
from database import async_session_maker as SessionLocal
from models import School, User, Student, Subject, TimetableSlot, school_users, UserRole

async def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def seed_data_for_existing_admin():
    async with SessionLocal() as db:
        print("Locating Kaptain Kiddo (kaptainkiddo01@gmail.com)...")

        # ---------------------------------------------------------
        # 1. FIND THE EXISTING ADMIN USER
        # ---------------------------------------------------------
        admin_query = await db.execute(select(User).where(User.email == "kaptainkiddo01@gmail.com"))
        admin = admin_query.scalar_one_or_none()
        
        if not admin:
            print("❌ Could not find admin kaptainkiddo01@gmail.com! Please ensure the user exists.")
            return

        print(f"✅ Found Admin: {admin.full_name} (ID: {admin.id})")

        # ---------------------------------------------------------
        # 2. FIND OR CREATE THEIR SCHOOL
        # ---------------------------------------------------------
        # Check if they are linked to a school in the school_users table
        link_query = await db.execute(select(school_users.c.school_id).where(school_users.c.user_id == admin.id))
        school_id = link_query.scalar()

        if school_id:
            school_query = await db.execute(select(School).where(School.id == school_id))
            school = school_query.scalar_one_or_none()
            print(f"✅ Admin is already linked to school: {school.name} (ID: {school.id})")
        else:
            print("⚡ Admin has no school. Creating 'Machakos' and linking them...")
            school = School(
                name="Machakos", 
                slug="machakos",
                email="info@machakos.edu",
                status="active"
            )
            db.add(school)
            await db.flush()
            # Link them as Admin
            await db.execute(school_users.insert().values(school_id=school.id, user_id=admin.id, role=UserRole.ADMIN))
            print(f"✅ Created and linked new school: {school.name}")

        # ---------------------------------------------------------
        # 3. CREATE 4 TEACHERS
        # ---------------------------------------------------------
        teachers = []
        for i in range(1, 5):
            email = f"teacher{i}@machakos.edu"
            teacher_query = await db.execute(select(User).where(User.email == email))
            teacher = teacher_query.scalar_one_or_none()
            
            if not teacher:
                teacher = User(
                    username=f"teacher{i}_machakos",
                    email=email,
                    hashed_password=await get_password_hash("teacher123"),
                    full_name=f"Teacher Num{i}",
                    is_active=True
                )
                db.add(teacher)
                await db.flush()
                # Link teacher to the admin's school
                await db.execute(school_users.insert().values(school_id=school.id, user_id=teacher.id, role=UserRole.TEACHER))
            teachers.append(teacher)
        print(f"✅ Ensured {len(teachers)} Teachers exist for {school.name}.")

        # ---------------------------------------------------------
        # 4. CREATE 6 STUDENTS
        # ---------------------------------------------------------
        students = []
        for i in range(1, 7):
            last_name = f"Alpha{i}"
            student_query = await db.execute(select(Student).where(Student.last_name == last_name, Student.school_id == school.id))
            student = student_query.scalar_one_or_none()
            
            if not student:
                student = Student(
                    school_id=school.id,
                    first_name="Student",
                    last_name=last_name,
                    grade="Grade 10"
                )
                db.add(student)
                await db.flush()
            students.append(student)
        print(f"✅ Ensured {len(students)} Students exist for {school.name}.")

        # ---------------------------------------------------------
        # 5. CREATE SUBJECTS
        # ---------------------------------------------------------
        subject_names = ["Mathematics", "English Literature", "Physics", "History"]
        subjects = []
        for name in subject_names:
            code = name[:3].upper() + "101"
            subject_query = await db.execute(select(Subject).where(Subject.code == code, Subject.school_id == school.id))
            subject = subject_query.scalar_one_or_none()
            
            if not subject:
                subject = Subject(
                    school_id=school.id,
                    name=name,
                    code=code
                )
                db.add(subject)
                await db.flush()
            subjects.append(subject)
        print(f"✅ Ensured {len(subjects)} Subjects exist for {school.name}.")

        # ---------------------------------------------------------
        # 6. POPULATE THE TIMETABLE SLOTS
        # ---------------------------------------------------------
        slots_data = [
            {"day": "Monday", "start": "08:00", "end": "09:00", "room": "Room 101", "subject": subjects[0], "teacher": teachers[0]},
            {"day": "Monday", "start": "09:00", "end": "10:00", "room": "Room 102", "subject": subjects[1], "teacher": teachers[1]},
            {"day": "Tuesday", "start": "08:00", "end": "09:00", "room": "Room 103", "subject": subjects[2], "teacher": teachers[2]},
            {"day": "Tuesday", "start": "09:00", "end": "10:00", "room": "Room 104", "subject": subjects[3], "teacher": teachers[3]},
        ]
        
        slots_added = 0
        for sd in slots_data:
            slot_query = await db.execute(select(TimetableSlot).where(
                TimetableSlot.school_id == school.id,
                TimetableSlot.day_of_week == sd["day"],
                TimetableSlot.start_time == sd["start"]
            ))
            slot = slot_query.scalar_one_or_none()
            
            if not slot:
                slot = TimetableSlot(
                    school_id=school.id,
                    subject_id=sd["subject"].id,
                    teacher_id=sd["teacher"].id,
                    day_of_week=sd["day"],
                    start_time=sd["start"],
                    end_time=sd["end"],
                    room=sd["room"],
                    grade_level="Grade 10"
                )
                db.add(slot)
                slots_added += 1

        print(f"✅ Added {slots_added} new classes to the Timetable.")

        # ---------------------------------------------------------
        # 7. FINALIZE & COMMIT
        # ---------------------------------------------------------
        await db.commit()
        print(f"\n🎉 Success! The test data has been populated for {school.name}.")

if __name__ == "__main__":
    asyncio.run(seed_data_for_existing_admin())