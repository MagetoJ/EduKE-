const { query } = require('../db/connection');
const bcrypt = require('bcrypt');

/**
 * Get all schools with subscription and metrics
 */
const getAllSchools = async (req, res) => {
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
};

/**
 * Get single school
 */
const getSchoolById = async (req, res) => {
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
};

/**
 * Create school
 */
const createSchool = async (req, res) => {
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
};

/**
 * Update school
 */
const updateSchool = async (req, res) => {
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
};

/**
 * Delete/Deactivate school
 */
const deleteSchool = async (req, res) => {
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
};

/**
 * Create school admin
 */
const createSchoolAdmin = async (req, res) => {
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
};

/**
 * Get all school admins
 */
const getSchoolAdmins = async (req, res) => {
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
};

/**
 * Delete/deactivate school admin
 */
const deleteSchoolAdmin = async (req, res) => {
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
};

/**
 * Update school admin
 */
const updateSchoolAdmin = async (req, res) => {
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
};

/**
 * Create a new admin for a school
 */
const createAdmin = async (req, res) => {
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
};

/**
 * Get schools analytics
 */
const getSchoolsAnalytics = async (req, res) => {
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
};

module.exports = {
  getAllSchools,
  getSchoolById,
  createSchool,
  updateSchool,
  deleteSchool,
  createSchoolAdmin,
  getSchoolAdmins,
  deleteSchoolAdmin,
  updateSchoolAdmin,
  createAdmin,
  getSchoolsAnalytics
};