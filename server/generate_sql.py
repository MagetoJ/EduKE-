import pandas as pd
import re

FILE_PATH = "Comprehensive_Kenyan_CBE_Day_School_Data.xlsx"
SQL_OUTPUT_FILE = "import_data.sql"

# Default Credentials & Setup
ADMIN_EMAIL = "jmageto@statbricks.com"
DEFAULT_PASSWORD = "Lokeshen" 
DEFAULT_SCHOOL_NAME = "Statbricks Academy"
DEFAULT_SCHOOL_SLUG = "statbricks-academy"

def clean_name(name):
    return re.sub(r'[^a-zA-Z0-9]', '', str(name)).lower()

def clean_str(val):
    return str(val).replace("'", "''").strip() if pd.notna(val) else ""

def safe_float(val):
    try:
        return float(val) if pd.notna(val) and str(val).strip() != "" else 0.0
    except ValueError:
        return 0.0

def main():
    print("Reading Excel sheets...")
    xls = pd.ExcelFile(FILE_PATH)
    df_students = pd.read_excel(xls, sheet_name='Comprehensive_Students')
    df_teachers = pd.read_excel(xls, sheet_name='Comprehensive_Teachers', skiprows=3)
    df_support = pd.read_excel(xls, sheet_name='Comprehensive_Support_Staff', skiprows=3)

    # Clean headers
    df_students.columns = [str(c).strip() for c in df_students.columns]
    df_teachers.columns = [str(c).strip() for c in df_teachers.columns]
    df_support.columns = [str(c).strip() for c in df_support.columns]

    print("Generating SQL file...")
    with open(SQL_OUTPUT_FILE, "w", encoding="utf-8") as f:
        # WIPE THE OLD DATA FIRST SO IT DOESN'T CRASH
        f.write("TRUNCATE schools CASCADE;\n")
        f.write("TRUNCATE users CASCADE;\n\n")

        f.write("DO $$\nDECLARE\n")
        f.write("    v_school_id INT;\n")
        f.write("    v_admin_user_id INT;\n")
        f.write("    v_user_id INT;\n")
        f.write("    v_student_id INT;\n")
        f.write("BEGIN\n")
        
        # 1. Setup School
        f.write(f"""
    INSERT INTO schools (name, slug, email, status, is_special_needs, disability_category, created_at)
    VALUES ('{DEFAULT_SCHOOL_NAME}', '{DEFAULT_SCHOOL_SLUG}', '{ADMIN_EMAIL}', 'Active', false, 'None', NOW())
    ON CONFLICT DO NOTHING;
    
    SELECT id INTO v_school_id FROM schools WHERE email = '{ADMIN_EMAIL}' LIMIT 1;
""")

        # 2. Setup Admin User
        f.write(f"""
    INSERT INTO users (username, email, hashed_password, full_name, is_active, is_super_admin, created_at)
    VALUES ('admin_jmageto', '{ADMIN_EMAIL}', '{DEFAULT_PASSWORD}', 'J. Mageto', true, true, NOW())
    ON CONFLICT DO NOTHING;
    
    SELECT id INTO v_admin_user_id FROM users WHERE email = '{ADMIN_EMAIL}' LIMIT 1;

    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at)
    VALUES (v_school_id, v_admin_user_id, 'ADMIN', true, NOW())
    ON CONFLICT DO NOTHING;
""")

        # 3. Insert Students
        f.write("\n    -- ================= STUDENTS =================\n")
        student_count = 0
        for idx, row in df_students.iterrows():
            raw_name = row.iloc[0] 
            full_name = clean_str(raw_name)
            
            # Skip rows that are obviously headers/titles disguised as data
            if not full_name or "Comprehensive" in full_name or "Registry" in full_name or "Profile" in full_name: 
                continue
                
            student_count += 1
            
            parts = full_name.split(" ", 1)
            f_name = clean_name(parts[0])
            l_name = clean_name(parts[1]) if len(parts) > 1 else ""
            
            # TRUNCATE USERNAME TO PREVENT VARCHAR(50) CRASH
            base_username = f"{f_name}_{l_name}"
            max_len = 50 - len(str(idx)) - 1
            username = f"{base_username[:max_len]}_{idx}".strip('_')
            
            email = f"{username}@student.school.local"
            grade = clean_str(row.get('grade', ''))
            stream = clean_str(row.get('Stream/Class', ''))
            status = clean_str(row.get('Nemis Status', 'Active'))
            adm = f"ADM-{idx+1000}"
            
            fee_total = safe_float(row.get('Term 1 Fees Due (KES)'))
            fee_paid = safe_float(row.get('Amount Paid (KES)'))
            bal = fee_total - fee_paid
            f_status = clean_str(row.get('Fee Status', 'Pending'))
            
            g_name = clean_str(row.get('Parent/Guardian Name', ''))
            g_phone = clean_str(row.get('Primary Contact Phone', ''))
            g_rel = clean_str(row.get('Emergency Contact Person', 'Guardian'))

            f.write(f"    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('{username}', '{email}', '{DEFAULT_PASSWORD}', '{full_name}', true, NOW()) RETURNING id INTO v_user_id;\n")
            f.write(f"    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'STUDENT', true, NOW());\n")
            
            f_name_sql = clean_str(parts[0])
            l_name_sql = clean_str(parts[1]) if len(parts) > 1 else ""
            f.write(f"    INSERT INTO students (school_id, user_id, first_name, last_name, grade, stream_section, admission_number, status, current_balance, created_at) VALUES (v_school_id, v_user_id, '{f_name_sql}', '{l_name_sql}', '{grade}', '{stream}', '{adm}', '{status}', {bal}, NOW()) RETURNING id INTO v_student_id;\n")
            
            if g_name:
                f.write(f"    INSERT INTO guardian_contacts (school_id, student_id, name, relationship_label, phone, is_primary, created_at) VALUES (v_school_id, v_student_id, '{g_name}', '{g_rel}', '{g_phone}', true, NOW());\n")
                
            f.write(f"    INSERT INTO fee_invoices (school_id, student_id, title, total_amount, paid_amount, status, created_at) VALUES (v_school_id, v_student_id, 'Term 1 Fees', {fee_total}, {fee_paid}, '{f_status}', NOW());\n")

        # 4. Insert Teachers
        f.write("\n    -- ================= TEACHERS =================\n")
        teacher_count = 0
        for idx, row in df_teachers.iterrows():
            full_name = clean_str(row.iloc[2] if len(row) > 2 else '')
            if not full_name or "Teaching Staff" in full_name: continue
            teacher_count += 1
            email = clean_str(row.get('Email Address', '')) or f"teacher_{idx}@school.local"
            
            # TRUNCATE USERNAME
            username = email.split('@')[0][:45]
            
            f.write(f"    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('{username}', '{email}', '{DEFAULT_PASSWORD}', '{full_name}', true, NOW()) RETURNING id INTO v_user_id;\n")
            f.write(f"    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'TEACHER', true, NOW());\n")

        # 5. Insert Staff
        f.write("\n    -- ================= SUPPORT STAFF =================\n")
        staff_count = 0
        for idx, row in df_support.iterrows():
            full_name = clean_str(row.iloc[2] if len(row) > 2 else '')
            if not full_name or "Non-Teaching" in full_name: continue
            staff_count += 1
            
            # TRUNCATE USERNAME
            base_username = clean_name(full_name)[:30]
            username = f"staff_{idx}_{base_username}"
            email = f"{username}@school.local"
            
            f.write(f"    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('{username}', '{email}', '{DEFAULT_PASSWORD}', '{full_name}', true, NOW()) RETURNING id INTO v_user_id;\n")
            f.write(f"    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'STAFF', true, NOW());\n")

        f.write("END $$;\n")
    print(f"✅ Success! Generated file with {student_count} students, {teacher_count} teachers, and {staff_count} staff.")

if __name__ == "__main__":
    main()