const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { query } = require('../db/connection');
const { authorizeRole } = require('../middleware/auth');

// ===================
// SCHOOLS MANAGEMENT (Super Admin)
// ===================

// Get all schools with subscription and metrics
router.get('/schools', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        s.id, s.name, s.email, s.phone, s.address, s.principal, s.status, s.created_at,
        COALESCE(COUNT(DISTINCT st.id), 0) as students,
        COALESCE(COUNT(DISTINCT u.id), 0) as staff,
        COALESCE(SUM(CAST(sf.amount_paid AS NUMERIC)), 0) as revenue,
        sp.name as plan_name,
        sub.status as subscription_status,
        sub.trial_ends_at
      FROM schools s
      LEFT JOIN students st ON s.id = st.school_id
      LEFT JOIN users u ON s.id = u.school_id AND u.role IN ('teacher', 'admin')
      LEFT JOIN student_fees sf ON st.id = sf.student_id
      LEFT JOIN subscriptions sub ON s.id = sub.school_id
      LEFT JOIN subscription_plans sp ON sub.plan_id = sp.id
      GROUP BY s.id, s.name, s.email, s.phone, s.address, s.principal, s.status, s.created_at, sp.name, sub.status, sub.trial_ends_at
      ORDER BY s.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching schools:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch schools' });
  }
});

// Get single school
router.get('/schools/:id', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT 
        s.*,
        COALESCE(COUNT(DISTINCT st.id), 0) as students,
        COALESCE(COUNT(DISTINCT u.id), 0) as staff,
        sp.name as plan_name,
        sub.status as subscription_status
      FROM schools s
      LEFT JOIN students st ON s.id = st.school_id
      LEFT JOIN users u ON s.id = u.school_id AND u.role IN ('teacher', 'admin')
      LEFT JOIN subscriptions sub ON s.id = sub.school_id
      LEFT JOIN subscription_plans sp ON sub.plan_id = sp.id
      WHERE s.id = $1
      GROUP BY s.id, sp.name, sub.status`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch school' });
  }
});

// Create school
router.post('/schools', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const { name, email, phone, address, principal, status } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'School name is required' });
    }
    
    const result = await query(
      `INSERT INTO schools (name, email, phone, address, principal, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, email, phone, address, principal, status || 'active']
    );
    
    res.status(201).json({ 
      success: true, 
      data: result.rows[0],
      message: 'School created successfully'
    });
  } catch (err) {
    console.error('Error creating school:', err);
    res.status(500).json({ success: false, error: 'Failed to create school' });
  }
});

// Update school
router.put('/schools/:id', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, principal, status } = req.body;
    
    const result = await query(
      `UPDATE schools 
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           address = COALESCE($4, address),
           principal = COALESCE($5, principal),
           status = COALESCE($6, status)
       WHERE id = $7
       RETURNING *`,
      [name, email, phone, address, principal, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }
    
    res.json({ 
      success: true, 
      data: result.rows[0],
      message: 'School updated successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update school' });
  }
});

// Delete/Deactivate school
router.delete('/schools/:id', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'UPDATE schools SET status = $1 WHERE id = $2 RETURNING *',
      ['inactive', id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }
    
    res.json({ success: true, message: 'School deactivated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to deactivate school' });
  }
});

// Create school admin
router.post('/schools/:id/admin', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const { id: schoolId } = req.params;
    const { name, email, phone, password, role } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    
    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Email already in use' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ') || '';
    
    const result = await query(
      `INSERT INTO users (school_id, email, password_hash, first_name, last_name, name, phone, role, status, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', true)
       RETURNING id, email, name, role, status`,
      [schoolId, email, passwordHash, firstName, lastName, name, phone, role || 'admin']
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'School administrator created successfully'
    });
  } catch (err) {
    console.error('Error creating admin:', err);
    res.status(500).json({ success: false, error: 'Failed to create school administrator' });
  }
});

// Get all school admins (Super Admin only)
router.get('/school-admins', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.name, u.phone, u.role, u.status, u.school_id, s.name as schoolName
       FROM users u
       LEFT JOIN schools s ON u.school_id = s.id
       WHERE u.role = 'admin' AND u.school_id IS NOT NULL
       ORDER BY u.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch school administrators' });
  }
});

// Delete/deactivate school admin (Super Admin only)
router.delete('/school-admins/:id', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, email, name',
      ['inactive', id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Administrator not found' });
    }
    
    res.json({ success: true, message: 'Administrator deactivated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete administrator' });
  }
});

// Update school admin (Super Admin only)
router.put('/school-admins/:id', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, status } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    
    values.push(id);
    const query_str = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, email, name, phone, role, status`;
    
    const result = await query(query_str, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Administrator not found' });
    }
    
    res.json({ 
      success: true, 
      data: result.rows[0],
      message: 'Administrator updated successfully' 
    });
  } catch (err) {
    console.error('Error updating admin:', err);
    res.status(500).json({ success: false, error: 'Failed to update administrator' });
  }
});

// Create a new admin for a school (Super Admin only)
router.post('/admins', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const bcrypt = require('bcrypt');
    const { email, password, name, first_name, last_name, phone, school_id, status } = req.body;

    if (!email || !password || !school_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, password, and school_id are required' 
      });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'User with this email already exists' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const displayName = name || `${first_name || ''} ${last_name || ''}`.trim();
    
    const result = await query(
      `INSERT INTO users (
        email, password_hash, name, first_name, last_name, phone, 
        school_id, role, status, is_verified, email_verified_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW()) 
      RETURNING id, email, name, first_name, last_name, phone, role, school_id, status`,
      [
        email, 
        hashedPassword, 
        displayName, 
        first_name || '', 
        last_name || '', 
        phone || null,
        school_id,
        'admin',
        status || 'active'
      ]
    );

    res.status(201).json({ 
      success: true, 
      data: result.rows[0], 
      message: 'Admin user created successfully' 
    });
  } catch (err) {
    console.error('Error creating admin user:', err);
    res.status(500).json({ success: false, error: 'Failed to create admin user' });
  }
});

// Get schools analytics
router.get('/schools/analytics', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        COUNT(DISTINCT s.id) as total_schools,
        COUNT(DISTINCT CASE WHEN s.status = 'active' THEN s.id END) as active_schools,
        COUNT(DISTINCT st.id) as total_students,
        COUNT(DISTINCT u.id) as total_staff,
        COUNT(DISTINCT sub.id) as active_subscriptions,
        COALESCE(SUM(CAST(sf.amount_paid AS NUMERIC)), 0) as total_revenue
      FROM schools s
      LEFT JOIN students st ON s.id = st.school_id
      LEFT JOIN users u ON s.id = u.school_id AND u.role IN ('teacher', 'admin')
      LEFT JOIN student_fees sf ON st.id = sf.student_id
      LEFT JOIN subscriptions sub ON s.id = sub.school_id AND sub.status IN ('active', 'trial')`
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

// Get subscription plans (for frontend)
router.get('/subscription/plans', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const result = await query('SELECT * FROM subscription_plans ORDER BY id ASC');
    res.json({ plans: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch subscription plans' });
  }
});

// Update school subscription (for frontend)
router.put('/schools/:id/subscription', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const { id: schoolId } = req.params;
    const { planSlug, status } = req.body;
    
    if (!planSlug) {
      return res.status(400).json({ success: false, error: 'Plan slug is required' });
    }
    
    // Get plan by slug
    const planResult = await query('SELECT id, name, slug FROM subscription_plans WHERE slug = $1', [planSlug]);
    if (planResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }
    
    const plan = planResult.rows[0];
    
    // Check if subscription exists
    const existing = await query('SELECT id FROM subscriptions WHERE school_id = $1', [schoolId]);
    
    if (existing.rows.length > 0) {
      // Update existing subscription
      const result = await query(
        `UPDATE subscriptions 
         SET plan_id = $1, status = $2, updated_at = NOW()
         WHERE school_id = $3
         RETURNING *`,
        [plan.id, status || 'active', schoolId]
      );
      res.json({ 
        success: true, 
        data: result.rows[0],
        planName: plan.name,
        planSlug: plan.slug,
        status: status || 'active'
      });
    } else {
      // Create new subscription
      const result = await query(
        `INSERT INTO subscriptions (school_id, plan_id, status, start_date)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [schoolId, plan.id, status || 'active']
      );
      res.status(201).json({ 
        success: true, 
        data: result.rows[0],
        planName: plan.name,
        planSlug: plan.slug,
        status: status || 'active'
      });
    }
  } catch (err) {
    console.error('Error updating subscription:', err);
    res.status(500).json({ success: false, error: 'Failed to update subscription' });
  }
});

// ===================
// REPORTS ROUTES (Super Admin)
// ===================

// Get subscription status report
router.get('/reports/subscription-status', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        sp.name as plan,
        sub.status,
        COUNT(DISTINCT sub.school_id) as subscribers,
        COALESCE(SUM(CAST(sf.amount_paid AS NUMERIC)), 0) as revenue
      FROM subscriptions sub
      LEFT JOIN subscription_plans sp ON sub.plan_id = sp.id
      LEFT JOIN schools s ON sub.school_id = s.id
      LEFT JOIN students st ON s.id = st.school_id
      LEFT JOIN student_fees sf ON st.id = sf.student_id
      WHERE sp.name IS NOT NULL
      GROUP BY sp.name, sub.status
      ORDER BY sp.name, sub.status`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching subscription report:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch subscription report' });
  }
});

// Get school analytics report
router.get('/reports/school-analytics', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        'All Time' as month,
        COUNT(DISTINCT s.id) as totalSchools,
        COUNT(DISTINCT CASE WHEN s.status = 'active' THEN s.id END) as activeSchools,
        COUNT(DISTINCT CASE WHEN s.created_at >= NOW() - INTERVAL '30 days' THEN s.id END) as newSchools
      FROM schools s`
    );
    
    if (result.rows.length === 0) {
      return res.json([{ month: 'No Data', totalSchools: 0, activeSchools: 0, newSchools: 0 }]);
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching school analytics:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch school analytics' });
  }
});

// ===================
// EXAMS ROUTES
// ===================

// Get all exams
router.get('/exams', authorizeRole(['admin', 'teacher', 'student']), async (req, res) => {
  try {
    const { schoolId } = req;
    const result = await query(
      'SELECT e.*, c.name as course_name, c.grade FROM exams e JOIN courses c ON e.course_id = c.id WHERE c.school_id = $1 ORDER BY e.exam_date DESC',
      [schoolId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch exams' });
  }
});

// Create exam
router.post('/exams', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { course_id, name, exam_date, total_marks, duration_minutes, description } = req.body;
    
    const result = await query(
      'INSERT INTO exams (school_id, course_id, name, exam_date, total_marks, duration_minutes, description) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [schoolId, course_id, name, exam_date, total_marks, duration_minutes, description]
    );
    
    res.status(201).json({ success: true, data: result.rows[0], message: 'Exam created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create exam' });
  }
});

// Update exam
router.put('/exams/:id', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    const { name, exam_date, total_marks, duration_minutes, description } = req.body;
    
    const result = await query(
      'UPDATE exams SET name = $1, exam_date = $2, total_marks = $3, duration_minutes = $4, description = $5, updated_at = NOW() WHERE id = $6 AND school_id = $7 RETURNING *',
      [name, exam_date, total_marks, duration_minutes, description, id, schoolId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }
    
    res.json({ success: true, data: result.rows[0], message: 'Exam updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update exam' });
  }
});

// Delete exam
router.delete('/exams/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    
    await query('DELETE FROM exams WHERE id = $1 AND school_id = $2', [id, schoolId]);
    res.json({ success: true, message: 'Exam deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete exam' });
  }
});

// Post exam results
router.post('/exams/:id/results', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { id } = req.params;
    const { results } = req.body; // Array of {student_id, score, percentage, grade, remarks}
    
    const insertedResults = [];
    for (const result of results) {
      const inserted = await query(
        `INSERT INTO exam_results (exam_id, student_id, score, percentage, grade, remarks)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (exam_id, student_id)
         DO UPDATE SET score = $3, percentage = $4, grade = $5, remarks = $6, updated_at = NOW()
         RETURNING *`,
        [id, result.student_id, result.score, result.percentage, result.grade, result.remarks]
      );
      insertedResults.push(inserted.rows[0]);
    }
    
    res.status(201).json({ success: true, data: insertedResults, message: 'Results posted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to post results' });
  }
});

// ===================
// STAFF ROUTES
// ===================

// Get all staff
router.get('/staff', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const result = await query(
      "SELECT id, email, first_name, last_name, name, phone, role, status, avatar_url, department, employee_id, hire_date, subject, class_assigned FROM users WHERE school_id = $1 AND role IN ('admin', 'teacher') ORDER BY name",
      [schoolId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch staff' });
  }
});

// Create staff member
router.post('/staff', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { email, first_name, last_name, phone, role, department, subject, class_assigned } = req.body;
    
    const tempPassword = `staff${Math.random().toString(36).slice(-8)}`;
    const password_hash = await bcrypt.hash(tempPassword, 10);
    const name = `${first_name} ${last_name}`;
    
    const result = await query(
      `INSERT INTO users (school_id, email, password_hash, first_name, last_name, name, phone, role, department, subject, class_assigned, status, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', false)
       RETURNING id, email, first_name, last_name, name, phone, role, status, department`,
      [schoolId, email, password_hash, first_name, last_name, name, phone, role, department, subject, class_assigned]
    );
    
    res.status(201).json({ success: true, data: result.rows[0], message: 'Staff member created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create staff member' });
  }
});

// Update staff member
router.put('/staff/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    const { first_name, last_name, phone, department, subject, class_assigned, status } = req.body;
    
    const result = await query(
      `UPDATE users SET first_name = $1, last_name = $2, name = $3, phone = $4, department = $5, subject = $6, class_assigned = $7, status = $8, updated_at = NOW()
       WHERE id = $9 AND school_id = $10 RETURNING *`,
      [first_name, last_name, `${first_name} ${last_name}`, phone, department, subject, class_assigned, status, id, schoolId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }
    
    res.json({ success: true, data: result.rows[0], message: 'Staff member updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update staff member' });
  }
});

// Get staff member by ID
router.get('/staff/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    const result = await query(
      "SELECT id, email, first_name, last_name, name, phone, role, status, avatar_url, department, employee_id, hire_date, subject, class_assigned FROM users WHERE id = $1 AND school_id = $2 AND role IN ('admin', 'teacher')",
      [id, schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching staff member:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch staff member' });
  }
});

// Delete staff member
router.delete('/staff/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    await query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3', ['inactive', id, schoolId]);
    res.json({ success: true, message: 'Staff member deactivated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete staff member' });
  }
});

// ===================
// FEE STRUCTURES
// ===================

// Get fee structures
router.get('/fee-structures', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const result = await query('SELECT * FROM fee_structures WHERE school_id = $1 ORDER BY created_at DESC', [schoolId]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch fee structures' });
  }
});

// Create fee structure
// This is the corrected function
// This is the corrected function
router.post('/fee-structures', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    
    const { fee_type, amount, grade, term, academic_year, description } = req.body;

    // Map form fields to database columns
    const name_column = fee_type;      // The form's "fee_type" is the database's "name"
    const frequency_column = term; // The form's "term" is the database's "frequency"
    const fee_type_enum = 'other'; // Defaulting this enum, as the form doesn't provide it

    // Note: We are now IGNORING 'academic_year' from the form,
    // because the database expects 'academic_year_id' (an integer)
    
    const result = await query(
      'INSERT INTO fee_structures (school_id, name, fee_type, amount, applicable_to, frequency, description) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [schoolId, name_column, fee_type_enum, amount, grade, frequency_column, description]
    );
    
    res.status(201).json({ success: true, data: result.rows[0], message: 'Fee structure created successfully' });
  } catch (err) {
    console.error('Error creating fee structure:', err); 
    res.status(500).json({ success: false, error: err.message || 'Failed to create fee structure' });
  }
});

// Assign fees to students
router.post('/assign-fees', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { fee_structure_id, student_ids, due_date } = req.body;
    
    const assigned = [];
    for (const student_id of student_ids) {
      const result = await query(
        'INSERT INTO student_fees (school_id, student_id, fee_structure_id, amount_due, due_date, payment_status) SELECT $1, $2, $3, amount, $4, \'pending\' FROM fee_structures WHERE id = $3 RETURNING *',
        [schoolId, student_id, fee_structure_id, due_date]
      );
      assigned.push(result.rows[0]);
    }
    
    res.status(201).json({ success: true, data: assigned, message: 'Fees assigned successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to assign fees' });
  }
});

// Add this new function to server/routes/complete.js

// Update fee structure
router.put('/fee-structures/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    // 1. Get 'fee_type' (the name) and 'term' (the frequency) from the form
    const { fee_type, amount, grade, term, description } = req.body;

    // 2. Map them to your database column names
    const name_column = fee_type;
    const frequency_column = term;
    const fee_type_enum = 'other'; // You can enhance this later

    const result = await query(
      `UPDATE fee_structures 
       SET name = $1, fee_type = $2, amount = $3, applicable_to = $4, frequency = $5, description = $6, updated_at = NOW()
       WHERE id = $7 AND school_id = $8
       RETURNING *`,
      [name_column, fee_type_enum, amount, grade, frequency_column, description, id, schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Fee structure not found' });
    }
    
    res.json({ success: true, data: result.rows[0], message: 'Fee structure updated successfully' });
  } catch (err) {
    console.error('Error updating fee structure:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to update fee structure' });
  }
});

// ===================
// PARENT PORTAL
// ===================

// Get children for a parent
router.get('/parent/children', authorizeRole(['parent']), async (req, res) => {
  try {
    const { schoolId, user } = req;

    const result = await query(`
      SELECT
        s.id,
        s.first_name,
        s.last_name,
        s.email,
        s.phone,
        s.date_of_birth,
        s.gender,
        s.grade,
        s.class_section as class_assigned,
        s.student_id_number as admission_number,
        s.status
      FROM students s
      JOIN parent_student_relations psr ON s.id = psr.student_id
      WHERE psr.parent_id = $1 AND s.school_id = $2 AND s.status = 'active'
      ORDER BY s.first_name, s.last_name
    `, [user.id, schoolId]);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching parent children:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch children' });
  }
});

// Get dashboard metrics for a parent
router.get('/parent/dashboard', authorizeRole(['parent']), async (req, res) => {
  try {
    const { schoolId, user } = req;

    // Get children count using parent_student_relations table
    const childrenResult = await query(`
      SELECT COUNT(*) as count
      FROM students s
      JOIN parent_student_relations psr ON s.id = psr.student_id
      WHERE psr.parent_id = $1 AND s.school_id = $2 AND s.status = 'active'
    `, [user.id, schoolId]);

    const childrenCount = parseInt(childrenResult.rows[0].count);

    if (childrenCount === 0) {
      return res.json({
        success: true,
        data: {
          childrenCount: 0,
          totalAssignments: 0,
          upcomingAssignments: 0,
          totalFeesDue: 0,
          totalFeesPaid: 0,
          averageAttendance: 0,
          averagePerformance: 0
        }
      });
    }

    // Get assignments metrics - assignments for courses that the parent's children are enrolled in
    const assignmentsResult = await query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN a.due_date > CURRENT_DATE THEN 1 END) as upcoming
      FROM assignments a
      JOIN courses c ON a.course_id = c.id
      WHERE c.school_id = $1
      AND c.id IN (
        SELECT DISTINCT ce.course_id
        FROM course_enrollments ce
        JOIN students s ON ce.student_id = s.id
        JOIN parent_student_relations psr ON s.id = psr.student_id
        WHERE psr.parent_id = $2 AND s.school_id = $1 AND s.status = 'active'
      )
    `, [schoolId, user.id]);

    // Get fees metrics using parent_student_relations
    const feesResult = await query(`
      SELECT
        COALESCE(SUM(sf.amount_due), 0) as total_due,
        COALESCE(SUM(sf.amount_paid), 0) as total_paid
      FROM student_fees sf
      JOIN students s ON sf.student_id = s.id
      JOIN parent_student_relations psr ON s.id = psr.student_id
      WHERE psr.parent_id = $1 AND sf.school_id = $2 AND s.status = 'active'
    `, [user.id, schoolId]);

    // Get attendance metrics (average across all children)
    const attendanceResult = await query(`
      SELECT
        AVG(CASE
          WHEN total_days > 0 THEN (present_days * 100.0 / total_days)
          ELSE 0
        END) as avg_attendance
      FROM (
        SELECT
          s.id,
          COUNT(a.id) as total_days,
          COUNT(CASE WHEN LOWER(a.status) = 'present' THEN 1 END) as present_days
        FROM students s
        JOIN parent_student_relations psr ON s.id = psr.student_id
        LEFT JOIN attendance a ON s.id = a.student_id
        WHERE psr.parent_id = $1 AND s.school_id = $2 AND s.status = 'active'
        GROUP BY s.id
      ) attendance_stats
    `, [user.id, schoolId]);

    // Get performance metrics (average grade across all children)
    const performanceResult = await query(`
      SELECT AVG(CAST(p.grade AS DECIMAL)) as avg_score
      FROM performance p
      JOIN students s ON p.student_id = s.id
      JOIN parent_student_relations psr ON s.id = psr.student_id
      WHERE psr.parent_id = $1 AND s.school_id = $2 AND s.status = 'active'
      AND p.grade IS NOT NULL AND p.grade != ''
    `, [user.id, schoolId]);

    const metrics = {
      childrenCount,
      totalAssignments: parseInt(assignmentsResult.rows[0].total) || 0,
      upcomingAssignments: parseInt(assignmentsResult.rows[0].upcoming) || 0,
      totalFeesDue: parseFloat(feesResult.rows[0].total_due) || 0,
      totalFeesPaid: parseFloat(feesResult.rows[0].total_paid) || 0,
      averageAttendance: Math.round(parseFloat(attendanceResult.rows[0].avg_attendance) || 0),
      averagePerformance: Math.round(parseFloat(performanceResult.rows[0].avg_score) || 0)
    };

    res.json({ success: true, data: metrics });
  } catch (err) {
    console.error('Error fetching parent dashboard metrics:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard metrics' });
  }
});

// ===================
// FEES
// ===================

// Get student fees (for students/parents to view their own fees)
router.get('/fees', authorizeRole(['student', 'parent']), async (req, res) => {
  try {
    const { schoolId, user } = req;

    // For students, get their own fees. For parents, get their child's fees
    let studentId;
    if (user.role === 'student') {
      // Find the student record for this user
      const studentResult = await query('SELECT id FROM students WHERE user_id = $1 AND school_id = $2', [user.id, schoolId]);
      if (studentResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Student record not found' });
      }
      studentId = studentResult.rows[0].id;
    } else if (user.role === 'parent') {
      // Parents can see fees for all their children
      const result = await query(`
        SELECT
          sf.*,
          fs.name as fee_name,
          fs.fee_type,
          fs.frequency,
          s.first_name,
          s.last_name,
          s.grade
        FROM student_fees sf
        JOIN fee_structures fs ON sf.fee_structure_id = fs.id
        JOIN students s ON sf.student_id = s.id
        JOIN parent_student_relations psr ON s.id = psr.student_id
        WHERE psr.parent_id = $1 AND sf.school_id = $2 AND s.status = 'active'
        ORDER BY sf.due_date DESC
      `, [user.id, schoolId]);

      return res.json({ success: true, data: result.rows });
    }

    const result = await query(
      `SELECT
        sf.*,
        fs.name as fee_name,
        fs.fee_type,
        fs.frequency
      FROM student_fees sf
      JOIN fee_structures fs ON sf.fee_structure_id = fs.id
      WHERE sf.student_id = $1 AND sf.school_id = $2
      ORDER BY sf.due_date DESC`,
      [studentId, schoolId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching fees:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch fees' });
  }
});

// ===================
// MESSAGES
// ===================

// Mark message as read
router.put('/messages/:id/read', authorizeRole(['admin', 'teacher', 'parent', 'student']), async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    
    await query(
      'UPDATE message_recipients SET is_read = true, read_at = NOW() WHERE message_id = $1 AND recipient_id = $2',
      [id, user.id]
    );
    
    res.json({ success: true, message: 'Message marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to mark message as read' });
  }
});

// Delete message
router.delete('/messages/:id', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    
    await query('DELETE FROM messages WHERE id = $1 AND school_id = $2', [id, schoolId]);
    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});

// ===================
// ACADEMIC YEARS
// ===================

// Get academic years
router.get('/academic-years', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { schoolId } = req;
    const result = await query('SELECT * FROM academic_years WHERE school_id = $1 ORDER BY start_date DESC', [schoolId]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch academic years' });
  }
});

// Create academic year
router.post('/academic-years', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { name, start_date, end_date } = req.body;
    
    const result = await query(
      'INSERT INTO academic_years (school_id, name, start_date, end_date, status) VALUES ($1, $2, $3, $4, \'active\') RETURNING *',
      [schoolId, name, start_date, end_date]
    );
    
    res.status(201).json({ success: true, data: result.rows[0], message: 'Academic year created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create academic year' });
  }
});

// End academic year
router.post('/academic-years/:id/end', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    
    await query('UPDATE academic_years SET status = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3', ['completed', id, schoolId]);
    res.json({ success: true, message: 'Academic year ended successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to end academic year' });
  }
});

// ===================
// DISCIPLINE
// ===================

// Get discipline records
router.get('/discipline', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { schoolId } = req;
    const result = await query(
      'SELECT d.*, s.first_name, s.last_name FROM discipline d JOIN students s ON d.student_id = s.id WHERE s.school_id = $1 ORDER BY d.date DESC',
      [schoolId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch discipline records' });
  }
});

// Get student's own discipline records
router.get('/my-discipline', authorizeRole(['student']), async (req, res) => {
  try {
    const { schoolId, user } = req;

    // Find the student record for this user
    const studentResult = await query('SELECT id FROM students WHERE user_id = $1 AND school_id = $2', [user.id, schoolId]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Student record not found' });
    }
    const studentId = studentResult.rows[0].id;

    const result = await query(
      'SELECT * FROM discipline WHERE student_id = $1 ORDER BY date DESC',
      [studentId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching student discipline:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch discipline records' });
  }
});

// Create discipline record
router.post('/discipline', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { schoolId, user } = req;
    const { student_id, type, severity, description, date } = req.body;
    
    const result = await query(
      'INSERT INTO discipline (student_id, teacher_id, type, severity, description, date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [student_id, user.id, type, severity, description, date]
    );
    
    res.status(201).json({ success: true, data: result.rows[0], message: 'Discipline record created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create discipline record' });
  }
});

// ===================
// LEAVE
// ===================

// Get leave types
router.get('/leave-types', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { schoolId } = req;
    const result = await query('SELECT * FROM leave_types WHERE school_id = $1', [schoolId]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch leave types' });
  }
});

router.post('/leave-types', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { name, description, max_days_per_year, requires_approval } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Leave type name is required' });
    }
    
    const result = await query(
      'INSERT INTO leave_types (school_id, name, description, max_days_per_year, requires_approval, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING *',
      [schoolId, name, description || null, max_days_per_year || null, requires_approval ?? true]
    );
    
    res.status(201).json({ success: true, data: result.rows[0], message: 'Leave type created successfully' });
  } catch (err) {
    console.error('Error creating leave type:', err);
    res.status(500).json({ success: false, error: 'Failed to create leave type' });
  }
});

router.post('/leave-types/initialize', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    
    const defaultLeaveTypes = [
      { name: 'Annual Leave', description: 'Paid annual leave', max_days_per_year: 30, requires_approval: true },
      { name: 'Sick Leave', description: 'Paid sick leave', max_days_per_year: 10, requires_approval: false },
      { name: 'Maternity', description: 'Maternity leave', max_days_per_year: 120, requires_approval: true },
      { name: 'Paternity', description: 'Paternity leave', max_days_per_year: 14, requires_approval: true },
      { name: 'Compassionate Leave', description: 'Leave due to family emergencies', max_days_per_year: 5, requires_approval: true },
      { name: 'Study Leave', description: 'Leave for professional development', max_days_per_year: 10, requires_approval: true }
    ];
    
    const insertedTypes = [];
    
    for (const leaveType of defaultLeaveTypes) {
      const result = await query(
        'INSERT INTO leave_types (school_id, name, description, max_days_per_year, requires_approval, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING *',
        [schoolId, leaveType.name, leaveType.description, leaveType.max_days_per_year, leaveType.requires_approval]
      );
      insertedTypes.push(result.rows[0]);
    }
    
    res.status(201).json({ success: true, data: insertedTypes, message: `${insertedTypes.length} default leave types created successfully` });
  } catch (err) {
    console.error('Error initializing leave types:', err);
    res.status(500).json({ success: false, error: 'Failed to initialize leave types' });
  }
});

// Get leave requests
router.get('/leave-requests', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { schoolId, user } = req;
    let sql = 'SELECT lr.*, u.name as staff_name, lt.name as leave_type_name FROM leave_requests lr JOIN users u ON lr.user_id = u.id JOIN leave_types lt ON lr.leave_type_id = lt.id WHERE lr.school_id = $1';
    const params = [schoolId];
    
    if (user.role === 'teacher') {
      sql += ' AND lr.user_id = $2';
      params.push(user.id);
    }
    
    sql += ' ORDER BY lr.created_at DESC';
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch leave requests' });
  }
});

// Create leave request
router.post('/leave-requests', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { schoolId, user } = req;
    const { leave_type_id, start_date, end_date, reason } = req.body;
    
    if (!leave_type_id || !start_date || !end_date || !reason) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }
    
    const leaveTypeCheck = await query(
      'SELECT id FROM leave_types WHERE id = $1 AND school_id = $2',
      [leave_type_id, schoolId]
    );
    
    if (leaveTypeCheck.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid leave type for this school' });
    }
    
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const total_days = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    const result = await query(
      'INSERT INTO leave_requests (school_id, user_id, leave_type_id, start_date, end_date, total_days, reason, status) VALUES ($1, $2, $3, $4, $5, $6, $7, \'pending\') RETURNING *',
      [schoolId, user.id, leave_type_id, start_date, end_date, total_days, reason]
    );
    
    res.status(201).json({ success: true, data: result.rows[0], message: 'Leave request submitted successfully' });
  } catch (err) {
    console.error('Leave request error:', err);
    res.status(500).json({ success: false, error: 'Failed to create leave request' });
  }
});

// Approve/Reject leave
router.put('/leave-requests/:id/status', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId, user } = req;
    const { id } = req.params;
    const { status, rejection_reason } = req.body;
    
    const result = await query(
      'UPDATE leave_requests SET status = $1, rejection_reason = $2, approved_by = $3, approved_at = NOW(), updated_at = NOW() WHERE id = $4 AND school_id = $5 RETURNING *',
      [status, rejection_reason, user.id, id, schoolId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Leave request not found' });
    }
    
    res.json({ success: true, data: result.rows[0], message: `Leave request ${status}` });
  } catch (err) {
    console.error('Leave request update error:', err);
    res.status(500).json({ success: false, error: 'Failed to update leave request' });
  }
});

// ===================
// SUBSCRIPTIONS (Super Admin)
// ===================

// Get all subscriptions
router.get('/subscriptions', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, sch.name as school_name, sp.name as plan_name, sp.price
       FROM subscriptions s
       JOIN schools sch ON s.school_id = sch.id
       JOIN subscription_plans sp ON s.plan_id = sp.id
       ORDER BY s.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch subscriptions' });
  }
});

// Get subscription plans
router.get('/subscription-plans', authorizeRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const result = await query('SELECT * FROM subscription_plans ORDER BY price ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch subscription plans' });
  }
});

// Change school subscription (Super Admin)
router.put('/subscriptions/:schoolId/change-plan', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { plan_id } = req.body;
    
    // Get plan details
    const plan = await query('SELECT * FROM subscription_plans WHERE id = $1', [plan_id]);
    if (plan.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }
    
    // Check if subscription exists
    const existing = await query('SELECT id FROM subscriptions WHERE school_id = $1', [schoolId]);
    
    if (existing.rows.length > 0) {
      // Update existing subscription
      const result = await query(
        `UPDATE subscriptions 
         SET plan_id = $1, status = 'active', updated_at = NOW()
         WHERE school_id = $2
         RETURNING *`,
        [plan_id, schoolId]
      );
      res.json({ success: true, data: result.rows[0], message: 'Subscription updated successfully' });
    } else {
      // Create new subscription
      const result = await query(
        `INSERT INTO subscriptions (school_id, plan_id, status, start_date)
         VALUES ($1, $2, 'active', NOW())
         RETURNING *`,
        [schoolId, plan_id]
      );
      res.status(201).json({ success: true, data: result.rows[0], message: 'Subscription created successfully' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to change subscription' });
  }
});

// Cancel subscription (Super Admin)
router.put('/subscriptions/:schoolId/cancel', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const { schoolId } = req.params;
    
    await query(
      `UPDATE subscriptions 
       SET status = 'cancelled', end_date = NOW(), updated_at = NOW()
       WHERE school_id = $1`,
      [schoolId]
    );
    
    res.json({ success: true, message: 'Subscription cancelled successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to cancel subscription' });
  }
});

// Renew subscription (Super Admin)
router.post('/subscriptions/:schoolId/renew', authorizeRole(['super_admin']), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { plan_id, duration_months } = req.body;
    
    const newEndDate = new Date();
    newEndDate.setMonth(newEndDate.getMonth() + (duration_months || 12));
    
    const result = await query(
      `UPDATE subscriptions 
       SET plan_id = $1, status = 'active', end_date = $2, updated_at = NOW()
       WHERE school_id = $3
       RETURNING *`,
      [plan_id, newEndDate.toISOString(), schoolId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }
    
    res.json({ success: true, data: result.rows[0], message: 'Subscription renewed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to renew subscription' });
  }
});

// Get school's current subscription
router.get('/school/subscription', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const result = await query(
      `SELECT s.*, sp.name as plan_name, sp.slug, sp.price, sp.max_students, sp.max_staff
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.school_id = $1 AND s.status IN ('active', 'trial')
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [schoolId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No active subscription found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch subscription' });
  }
});

// ===================
// USER MANAGEMENT (Admin creating staff/teachers)
// ===================

// Create user/staff member by admin
router.post('/users', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { email, first_name, last_name, phone, role, department, subject, class_assigned } = req.body;
    
    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Email already in use' });
    }
    
    const tempPassword = `temp${Math.random().toString(36).slice(-8)}`;
    const password_hash = await bcrypt.hash(tempPassword, 10);
    const name = `${first_name} ${last_name}`;
    
    const result = await query(
      `INSERT INTO users (school_id, email, password_hash, first_name, last_name, name, phone, role, department, subject, class_assigned, status, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', false)
       RETURNING id, email, first_name, last_name, name, phone, role, status`,
      [schoolId, email, password_hash, first_name, last_name, name, phone, role, department, subject, class_assigned]
    );
    
    res.status(201).json({ 
      success: true, 
      data: result.rows[0], 
      message: 'User created successfully. Credentials sent via email.',
      tempPassword: tempPassword // In production, send via email instead
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

// Update user by admin
router.put('/users/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    const { first_name, last_name, phone, department, subject, class_assigned, status } = req.body;
    
    const result = await query(
      `UPDATE users 
       SET first_name = $1, last_name = $2, name = $3, phone = $4, department = $5, subject = $6, class_assigned = $7, status = $8, updated_at = NOW()
       WHERE id = $9 AND school_id = $10
       RETURNING *`,
      [first_name, last_name, `${first_name} ${last_name}`, phone, department, subject, class_assigned, status, id, schoolId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({ success: true, data: result.rows[0], message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// Delete user by admin
router.delete('/users/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    
    await query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3', ['inactive', id, schoolId]);
    res.json({ success: true, message: 'User deactivated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

// Get all users for school admin
router.get('/users', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { role } = req.query;
    
    let sql = "SELECT id, email, first_name, last_name, name, phone, role, status, avatar_url, department, subject, class_assigned FROM users WHERE school_id = $1";
    const params = [schoolId];
    
    if (role) {
      sql += " AND role = $2";
      params.push(role);
    }
    
    sql += " ORDER BY name";
    
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// ===================
// TIMETABLE
// ===================

// Get timetable
router.get('/timetable', authorizeRole(['admin', 'teacher', 'student']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { grade, day } = req.query;
    
    let sql = 'SELECT t.*, u.name as teacher_name FROM timetables t LEFT JOIN users u ON t.teacher_id = u.id WHERE t.school_id = $1';
    const params = [schoolId];
    let paramIndex = 2;
    
    if (grade) {
      sql += ` AND t.grade = $${paramIndex}`;
      params.push(grade);
      paramIndex++;
    }
    
    if (day) {
      sql += ` AND t.day_of_week = $${paramIndex}`;
      params.push(day);
    }
    
    sql += ' ORDER BY t.day_of_week, t.start_time';
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch timetable' });
  }
});

// Get timetable periods
router.get('/timetable-periods', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const result = await query('SELECT * FROM timetable_periods WHERE school_id = $1 ORDER BY start_time', [schoolId]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch timetable periods' });
  }
});

// Create timetable entry
router.post('/timetable', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { course_id, period_id, day_of_week, grade, room } = req.body;
    
    const result = await query(
      'INSERT INTO timetable_entries (school_id, course_id, period_id, day_of_week, grade, room) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [schoolId, course_id, period_id, day_of_week, grade, room]
    );
    
    res.status(201).json({ success: true, data: result.rows[0], message: 'Timetable entry created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create timetable entry' });
  }
});

// Update timetable entry
router.put('/timetable/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    const { course_id, period_id, day_of_week, grade, room } = req.body;

    const result = await query(
      `UPDATE timetable_entries
       SET course_id = $1, period_id = $2, day_of_week = $3, grade = $4, room = $5, updated_at = NOW()
       WHERE id = $6 AND school_id = $7
       RETURNING *`,
      [course_id, period_id, day_of_week, grade, room, id, schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Timetable entry not found' });
    }

    res.json({ success: true, data: result.rows[0], message: 'Timetable entry updated' });
  } catch (err) {
    console.error('Error updating timetable entry:', err);
    res.status(500).json({ success: false, error: 'Failed to update entry' });
  }
});

// Delete timetable entry
router.delete('/timetable/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    
    await query('DELETE FROM timetable_entries WHERE id = $1 AND school_id = $2', [id, schoolId]);
    res.json({ success: true, message: 'Timetable entry deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete timetable entry' });
  }
});

module.exports = router;
