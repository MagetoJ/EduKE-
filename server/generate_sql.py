import pandas as pd
import re

FILE_PATH = "Comprehensive_Kenyan_CBE_Day_School_Data.xlsx"
SQL_OUTPUT_FILE = "import_data.sql"

# Default Credentials & Setup
ADMIN_EMAIL = "jmageto@statbricks.com"
DEFAULT_PASSWORD = "Lokeshen" 
DEFAULT_SCHOOL_NAME = "Statbricks Academy"

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

    print("Generating SQL file...")
    with open(SQL_OUTPUT_FILE, "w", encoding="utf-8") as f:
        # 1. Initialize the PL/pgSQL block
        f.write("DO $$\nDECLARE\n")
        f.write("    v_school_id INT;\n")
        f.write("    v_admin_user_id INT;\n")
        f.write("    v_user_id INT;\n")
        f.write("    v_student_id INT;\n")
        f.write("BEGIN\n")
        
        # 2. Setup School
        f.write(f"""
    -- Insert default school if it doesn't exist
    INSERT INTO schools (name, email, status, created_at)
    VALUES ('{DEFAULT_SCHOOL_NAME}', '{ADMIN_EMAIL}', 'Active', NOW())
    ON CONFLICT DO NOTHING;
    
    SELECT id INTO v_school_id FROM schools WHERE email = '{ADMIN_EMAIL}' LIMIT 1;
""")

        # 3. Setup Admin User
        f.write(f"""
    -- Insert Admin
    INSERT INTO users (username, email, hashed_password, full_name, is_active, is_super_admin, created_at)
    VALUES ('admin_jmageto', '{ADMIN_EMAIL}', '{DEFAULT_PASSWORD}', 'J. Mageto', true, true, NOW())
    RETURNING id INTO v_admin_user_id;
    
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at)
    VALUES (v_school_id, v_admin_user_id, 'admin', true, NOW());
""")

        # 4. Insert Students
        f.write("\n    -- ================= STUDENTS =================\n")
        for idx, row in df_students.iterrows():
            full_name = clean_str(row.get(' Full Name'))
            if not full_name: continue
            
            parts = full_name.split(" ", 1)
            f_name = parts[0]
            l_name = parts[1] if len(parts) > 1 else ""
            username = f"{clean_name(f_name)}_{clean_name(l_name)}_{idx}".strip('_')
            email = f"{username}@student.school.local"
            grade = clean_str(row.get('grade'))
            stream = clean_str(row.get('Stream/Class'))
            status = clean_str(row.get('Nemis Status', 'Active'))
            adm = f"ADM-{idx+1000}"
            
            fee_total = safe_float(row.get('Term 1 Fees Due (KES)'))
            fee_paid = safe_float(row.get('Amount Paid (KES)'))
            bal = fee_total - fee_paid
            f_status = clean_str(row.get('Fee Status', 'Pending'))
            
            g_name = clean_str(row.get('Parent/Guardian Name'))
            g_phone = clean_str(row.get('Primary Contact Phone'))
            g_rel = clean_str(row.get('Emergency Contact Person', 'Guardian'))

            # Insert User & School Link
            f.write(f"    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('{username}', '{email}', '{DEFAULT_PASSWORD}', '{full_name}', true, NOW()) RETURNING id INTO v_user_id;\n")
            f.write(f"    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'student', true, NOW());\n")
            
            # Insert Student Profile
            f.write(f"    INSERT INTO students (school_id, user_id, first_name, last_name, grade, stream_section, admission_number, status, current_balance, created_at) VALUES (v_school_id, v_user_id, '{f_name}', '{l_name}', '{grade}', '{stream}', '{adm}', '{status}', {bal}, NOW()) RETURNING id INTO v_student_id;\n")
            
            # Insert Guardian
            if g_name:
                f.write(f"    INSERT INTO guardian_contacts (school_id, student_id, name, relationship_label, phone, is_primary, created_at) VALUES (v_school_id, v_student_id, '{g_name}', '{g_rel}', '{g_phone}', true, NOW());\n")
                
            # Insert Invoice
            f.write(f"    INSERT INTO fee_invoices (school_id, student_id, title, total_amount, paid_amount, status, created_at) VALUES (v_school_id, v_student_id, 'Term 1 Fees', {fee_total}, {fee_paid}, '{f_status}', NOW());\n")

        # 5. Insert Teachers
        f.write("\n    -- ================= TEACHERS =================\n")
        for idx, row in df_teachers.iterrows():
            full_name = clean_str(row.get('Teacher Name'))
            if not full_name: continue
            email = clean_str(row.get('Email Address')) or f"teacher_{idx}@school.local"
            username = email.split('@')[0]
            
            f.write(f"    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('{username}', '{email}', '{DEFAULT_PASSWORD}', '{full_name}', true, NOW()) RETURNING id INTO v_user_id;\n")
            f.write(f"    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());\n")

        # 6. Insert Staff
        f.write("\n    -- ================= SUPPORT STAFF =================\n")
        for idx, row in df_support.iterrows():
            full_name = clean_str(row.get('Full Name'))
            if not full_name: continue
            username = f"staff_{idx}_{clean_name(full_name)[:10]}"
            email = f"{username}@school.local"
            
            f.write(f"    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('{username}', '{email}', '{DEFAULT_PASSWORD}', '{full_name}', true, NOW()) RETURNING id INTO v_user_id;\n")
            f.write(f"    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'staff', true, NOW());\n")

        f.write("END $$;\n")
    print(f"✅ Success! Run '{SQL_OUTPUT_FILE}' in your database.")

if __name__ == "__main__":
    main()