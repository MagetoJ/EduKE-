# server/seed_cbc_curriculum.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
# Import Base to access table metadata
from models import Base, GradeBand, Pathway, LearningArea, Strand, SubStrand, CourseRequirement

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/eduke")

def seed_cbc_data():
    # 1. Initialize the engine
    engine = create_engine(DATABASE_URL)
    
    print("[+] Checking and issuing missing database table migrations...")
    # This automatically detects and generates any tables (like cbc_grade_bands) that don't exist yet
    Base.metadata.create_all(engine)
    
    # 2. Configure the session
    Session = sessionmaker(bind=engine)
    session = Session()

    print("[+] Seeding Grade Bands...")
    bands_data = [
        {"name": "Junior School (Grade 7-9)", "code": "JSS"},
        {"name": "Senior School (Grade 10-12)", "code": "SSS"}
    ]
    bands = {}
    for b in bands_data:
        band = session.query(GradeBand).filter_by(code=b["code"]).first()
        if not band:
            band = GradeBand(name=b["name"], code=b["code"])
            session.add(band)
            session.flush()
        bands[b["code"]] = band

    print("[+] Seeding Senior School Pathways...")
    pathways_data = [
        {"name": "STEM Pathway", "code": "PATH_STEM", "desc": "Focus on Science, Tech, Engineering, and Mathematics"},
        {"name": "Social Sciences", "code": "PATH_SOC", "desc": "Focus on Humanities, Languages, and Business"},
        {"name": "Arts & Sports Science", "code": "PATH_ART", "desc": "Focus on Creative Performing Arts and Sports"}
    ]
    pathways = {}
    for p in pathways_data:
        path = session.query(Pathway).filter_by(code=p["code"]).first()
        if not path:
            path = Pathway(name=p["name"], code=p["code"], description=p["desc"])
            session.add(path)
            session.flush()
        pathways[p["code"]] = path

    print("[+] Seeding Junior School KICD Learning Areas...")
    jss_areas = [
        {"name": "Integrated Science", "code": "KICD-JSS-INTSCI", "strands": ["Matter", "Force and Energy"]},
        {"name": "Pre-Technical Studies", "code": "KICD-JSS-PRETECH", "strands": ["Materials", "Technical Drawing"]},
        {"name": "Mathematics", "code": "KICD-JSS-MATH", "strands": ["Numbers", "Algebra"]}
    ]
    for area in jss_areas:
        la = session.query(LearningArea).filter_by(code=area["code"]).first()
        if not la:
            la = LearningArea(name=area["name"], code=area["code"], grade_band_id=bands["JSS"].id)
            session.add(la)
            session.flush()
            
            req = CourseRequirement(grade_band_id=bands["JSS"].id, learning_area_id=la.id, requirement_type="compulsory")
            session.add(req)

            for idx, s_name in enumerate(area["strands"]):
                strand = Strand(learning_area_id=la.id, name=s_name, code=f"{area['code']}-STR{idx+1}")
                session.add(strand)
                session.flush()
                
                sub = SubStrand(strand_id=strand.id, name=f"Introduction to {s_name}", code=f"{strand.code}-SUB1", specific_learning_outcome="Demonstrate initial concept application mastery.")
                session.add(sub)

    print("[+] Seeding Senior School Core Rules (Common across pathways)...")
    sss_cores = ["English", "Kiswahili", "Mathematics", "Community Service Learning"]
    for core in sss_cores:
        code = f"KICD-SSS-{core[:4].upper()}"
        la = session.query(LearningArea).filter_by(code=code).first()
        if not la:
            la = LearningArea(name=core, code=code, grade_band_id=bands["SSS"].id)
            session.add(la)
            session.flush()
            
            req = CourseRequirement(grade_band_id=bands["SSS"].id, pathway_id=None, learning_area_id=la.id, requirement_type="compulsory")
            session.add(req)

    session.commit()
    session.close()
    print("[*] CBC Seed complete!")

if __name__ == "__main__":
    seed_cbc_data()