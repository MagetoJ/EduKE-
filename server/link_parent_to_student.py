import asyncio
import sys
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy import select, inspect

from database import engine
import models
from models import User, Student, ParentStudentLink

AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)

async def link_parent_and_student(parent_email: str, student_identifier: str, relationship_type: str = "Parent"):
    """
    Links a parent user (by email) to a student (by ID, admission_number, or UPI).
    """
    async with AsyncSessionLocal() as db:
        # 1. Look up Parent User
        parent_query = select(User).where(User.email == parent_email)
        parent_res = await db.execute(parent_query)
        parent = parent_res.scalar_one_or_none()

        if not parent:
            print(f"❌ Parent user with email '{parent_email}' not found.")
            return False

        # 2. Look up Student by ID, Admission Number, or UPI
        student_columns = {col.name for col in inspect(Student).columns}
        student_query = select(Student)

        if student_identifier.isdigit():
            # Match by numeric primary key ID
            student_query = student_query.where(Student.id == int(student_identifier))
        elif "admission_number" in student_columns:
            # Match by admission number
            student_query = student_query.where(Student.admission_number == student_identifier)
        elif "upi" in student_columns:
            # Match by UPI
            student_query = student_query.where(Student.upi == student_identifier)
        else:
            print(f"❌ Cannot search student by string '{student_identifier}'. Provide a numeric student ID.")
            return False

        student_res = await db.execute(student_query)
        student = student_res.scalar_one_or_none()

        if not student:
            print(f"❌ Student with identifier '{student_identifier}' not found.")
            return False

        student_name = f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip() or f"Student #{student.id}"

        # 3. Check if link already exists
        link_query = select(ParentStudentLink).where(
            ParentStudentLink.parent_id == parent.id,
            ParentStudentLink.student_id == student.id
        )
        link_res = await db.execute(link_query)
        existing_link = link_res.scalar_one_or_none()

        if existing_link:
            print(f"ℹ️ Link already exists: Parent User ID {parent.id} ({parent_email}) is already linked to Student ID {student.id} ({student_name}).")
            return True

        # 4. Create new link
        new_link = ParentStudentLink(
            parent_id=parent.id,
            student_id=student.id,
            relationship_type=relationship_type
        )
        db.add(new_link)
        await db.commit()

        print("--------------------------------------------------")
        print("✅ SUCCESS: Parent-Student Link Created!")
        print(f"   • Parent User: {parent_email} (User ID: {parent.id})")
        print(f"   • Linked Child: {student_name} (Student ID: {student.id})")
        print(f"   • Relationship: {relationship_type}")
        print("--------------------------------------------------")
        return True

async def main():
    if len(sys.argv) >= 3:
        # CLI usage: python link_parent_to_student.py <parent_email> <student_id_or_adm> [relationship]
        email = sys.argv[1]
        identifier = sys.argv[2]
        rel = sys.argv[3] if len(sys.argv) > 3 else "Parent"
        await link_parent_and_student(email, identifier, rel)
    else:
        # Interactive mode if run without CLI flags
        print("=== EduKE Parent-Student Link Utility ===")
        email = input("Enter Parent User Email: ").strip()
        identifier = input("Enter Student ID or Admission Number: ").strip()
        rel = input("Enter Relationship (e.g. Father, Mother, Guardian) [Default: Parent]: ").strip() or "Parent"
        
        if email and identifier:
            await link_parent_and_student(email, identifier, rel)
        else:
            print("❌ Both Parent Email and Student Identifier are required.")

if __name__ == "__main__":
    asyncio.run(main())