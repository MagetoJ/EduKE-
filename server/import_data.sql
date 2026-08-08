DO $$
DECLARE
    v_school_id INT;
    v_admin_user_id INT;
    v_user_id INT;
    v_student_id INT;
BEGIN

    -- Insert default school if it doesn't exist
    INSERT INTO schools (name, email, status, created_at)
    VALUES ('Statbricks Academy', 'jmageto@statbricks.com', 'Active', NOW())
    ON CONFLICT DO NOTHING;
    
    SELECT id INTO v_school_id FROM schools WHERE email = 'jmageto@statbricks.com' LIMIT 1;

    -- Insert Admin
    INSERT INTO users (username, email, hashed_password, full_name, is_active, is_super_admin, created_at)
    VALUES ('admin_jmageto', 'jmageto@statbricks.com', 'Lokeshen', 'J. Mageto', true, true, NOW())
    RETURNING id INTO v_admin_user_id;
    
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at)
    VALUES (v_school_id, v_admin_user_id, 'admin', true, NOW());

    -- ================= STUDENTS =================

    -- ================= TEACHERS =================
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('margaret.wambui', 'margaret.wambui@school.ac.ke', 'Lokeshen', 'Margaret Wambui', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('john.kipkorir', 'john.kipkorir@school.ac.ke', 'Lokeshen', 'John Kipkorir', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('faith.kawira', 'faith.kawira@school.ac.ke', 'Lokeshen', 'Faith Kawira', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('peter.ochieng', 'peter.ochieng@school.ac.ke', 'Lokeshen', 'Peter Ochieng', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('sarah.lekaldero', 'sarah.lekaldero@school.ac.ke', 'Lokeshen', 'Sarah Lekaldero', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('mohamed.hassan', 'mohamed.hassan@school.ac.ke', 'Lokeshen', 'Mohamed Hassan', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('beatrice.nyaboke', 'beatrice.nyaboke@school.ac.ke', 'Lokeshen', 'Beatrice Nyaboke', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('evans.wafula', 'evans.wafula@school.ac.ke', 'Lokeshen', 'Evans Wafula', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('mercy.chebet', 'mercy.chebet@school.ac.ke', 'Lokeshen', 'Mercy Chebet', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('david.mutua', 'david.mutua@school.ac.ke', 'Lokeshen', 'David Mutua', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('cynthia.awuor', 'cynthia.awuor@school.ac.ke', 'Lokeshen', 'Cynthia Awuor', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('josphat.kipkemboi', 'josphat.kipkemboi@school.ac.ke', 'Lokeshen', 'Josphat Kipkemboi', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('emmanuel.awuor', 'emmanuel.awuor@school.ac.ke', 'Lokeshen', 'Emmanuel Awuor', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('moses.musa', 'moses.musa@school.ac.ke', 'Lokeshen', 'Moses Musa', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('grace.kipkemboi', 'grace.kipkemboi@school.ac.ke', 'Lokeshen', 'Grace Kipkemboi', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('faith.odhiambo', 'faith.odhiambo@school.ac.ke', 'Lokeshen', 'Faith Odhiambo', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('chebet.lokor', 'chebet.lokor@school.ac.ke', 'Lokeshen', 'Chebet Lokor', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('beatrice.nduku', 'beatrice.nduku@school.ac.ke', 'Lokeshen', 'Beatrice Nduku', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('patrick.maina', 'patrick.maina@school.ac.ke', 'Lokeshen', 'Patrick Maina', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('chemutai.nduku', 'chemutai.nduku@school.ac.ke', 'Lokeshen', 'Chemutai Nduku', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'teacher', true, NOW());

    -- ================= SUPPORT STAFF =================
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('staff_0_agnesmutho', 'staff_0_agnesmutho@school.local', 'Lokeshen', 'Agnes Muthoni', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'staff', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('staff_1_josphatkam', 'staff_1_josphatkam@school.local', 'Lokeshen', 'Josphat Kamau', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'staff', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('staff_2_maryatieno', 'staff_2_maryatieno@school.local', 'Lokeshen', 'Mary Atieno', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'staff', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('staff_3_charleskip', 'staff_3_charleskip@school.local', 'Lokeshen', 'Charles Kiprop', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'staff', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('staff_4_gracechemu', 'staff_4_gracechemu@school.local', 'Lokeshen', 'Grace Chemutai', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'staff', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('staff_5_samuelmwan', 'staff_5_samuelmwan@school.local', 'Lokeshen', 'Samuel Mwangi', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'staff', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('staff_6_lucywanjal', 'staff_6_lucywanjal@school.local', 'Lokeshen', 'Lucy Wanjala', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'staff', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('staff_7_paulekuru', 'staff_7_paulekuru@school.local', 'Lokeshen', 'Paul Ekuru', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'staff', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('staff_8_rosekwambo', 'staff_8_rosekwambo@school.local', 'Lokeshen', 'Rose Kwamboka', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'staff', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('staff_9_tituslokor', 'staff_9_tituslokor@school.local', 'Lokeshen', 'Titus Lokor', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'staff', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('staff_10_janenduku', 'staff_10_janenduku@school.local', 'Lokeshen', 'Jane Nduku', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'staff', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('staff_11_francisony', 'staff_11_francisony@school.local', 'Lokeshen', 'Francis Onyango', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'staff', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('staff_12_beatriceaw', 'staff_12_beatriceaw@school.local', 'Lokeshen', 'Beatrice Awuor', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'staff', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('staff_13_harrisonom', 'staff_13_harrisonom@school.local', 'Lokeshen', 'Harrison Omwamba', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'staff', true, NOW());
    INSERT INTO users (username, email, hashed_password, full_name, is_active, created_at) VALUES ('staff_14_patricknji', 'staff_14_patricknji@school.local', 'Lokeshen', 'Patrick Njiru', true, NOW()) RETURNING id INTO v_user_id;
    INSERT INTO school_users (school_id, user_id, role, is_active, joined_at) VALUES (v_school_id, v_user_id, 'staff', true, NOW());
END $$;
