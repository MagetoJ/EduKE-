# seed_roles.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import User, School, CbcGradeBand
from models_roles import AcademicDepartment, ClassTeacherAssignment, CbcCoordinatorAssignment

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/eduke")

def initialize_school_roles():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    # 1. Grab target school and JSS Grade Band
    school = session.query(School).first()
    jss_band = session.query(CbcGradeBand).filter_by(code="JSS").first()

    if not school or not jss_band:
        print("[-] Please run core seeds (seed_machakos.py and seed_cbc_curriculum.py) first!")
        return

    print(f"[+] Setting up roles for school: {school.name}")

    # 2. Create the HOD Account
    hod_user = session.query(User).filter_by(email="hod.sciences@school.ac.ke").first()
    if not hod_user:
        hod_user = User(
            email="hod.sciences@school.ac.ke",
            role="hod",  # Gated in your Phase 6 accessControl.ts
            school_id=school.id,
            tsc_number="TSC-990011",
            major_subject_code="INTSCI"
        )
        hod_user.set_password("SecureHodPassword123")
        session.add(hod_user)
        session.flush()

    # Link HOD to Department
    science_dept = session.query(AcademicDepartment).filter_by(code="DEPT-SCI", school_id=school.id).first()
    if not science_dept:
        science_dept = AcademicDepartment(
            school_id=school.id,
            name="Science and Mathematics Department",
            code="DEPT-SCI",
            hod_id=hod_user.id
        )
        session.add(science_dept)

    # 3. Create the Registrar Account
    registrar_user = session.query(User).filter_by(email="registrar@school.ac.ke").first()
    if not registrar_user:
        registrar_user = User(
            email="registrar@school.ac.ke",
            role="registrar",
            school_id=school.id,
            tsc_number="TSC-990022"
        )
        registrar_user.set_password("SecureRegPassword123")
        session.add(registrar_user)

    # 4. Create the Class Teacher Account
    class_teacher = session.query(User).filter_by(email="g7east.teacher@school.ac.ke").first()
    if not class_teacher:
        class_teacher = User(
            email="g7east.teacher@school.ac.ke",
            role="class_teacher",
            school_id=school.id,
            tsc_number="TSC-990033"
        )
        class_teacher.set_password("SecureClassTeacher123")
        session.add(class_teacher)
        session.flush()

    # Link Class Teacher to Grade 7 East stream
    class_assign = session.query(ClassTeacherAssignment).filter_by(
        school_id=school.id, grade_level="Grade 7", stream_section="East"
    ).first()
    if not class_assign:
        class_assign = ClassTeacherAssignment(
            school_id=school.id,
            teacher_id=class_teacher.id,
            grade_level="Grade 7",
            stream_section="East"
        )
        session.add(class_assign)

    # 5. Create the CBC Coordinator Account
    coordinator = session.query(User).filter_by(email="jss.coordinator@school.ac.ke").first()
    if not coordinator:
        coordinator = User(
            email="jss.coordinator@school.ac.ke",
            role="cbc_coordinator",
            school_id=school.id,
            tsc_number="TSC-990044"
        )
        coordinator.set_password("SecureCoord123")
        session.add(coordinator)
        session.flush()

    # Assign CBC Coordinator to JSS Grade Band (Grade 7-9)
    coord_assign = session.query(CbcCoordinatorAssignment).filter_by(
        school_id=school.id, coordinator_id=coordinator.id, grade_band_id=jss_band.id
    ).first()
    if not coord_assign:
        coord_assign = CbcCoordinatorAssignment(
            school_id=school.id,
            coordinator_id=coordinator.id,
            grade_band_id=jss_band.id
        )
        session.add(coord_assign)

    session.commit()
    session.close()
    print("[*] Academic roles initialized and configured successfully!")

if __name__ == "__main__":
    initialize_school_roles()