const express = require('express');
const router = express.Router();
const { transaction, query } = require('../db/connection');

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// ============================================
// TRANSPORT ROUTES
// ============================================

// GET all transport routes for school
router.get('/routes', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM transport_routes WHERE school_id = $1 ORDER BY route_name',
      [req.schoolId]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

// GET single transport route
router.get('/routes/:id', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM transport_routes WHERE id = $1 AND school_id = $2',
      [req.params.id, req.schoolId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Route not found' });
    }
    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching route:', error);
    res.status(500).json({ error: 'Failed to fetch route' });
  }
});

// CREATE transport route
router.post('/routes', requireAuth, requireRole(['admin', 'super_admin', 'transport_manager']), async (req, res) => {
  try {
    const { route_name, route_code, start_location, end_location, pickup_time, dropoff_time, vehicle_type, capacity, fare_amount } = req.body;
    
    if (!route_name || !route_code) {
      return res.status(400).json({ error: 'Route name and code are required' });
    }

    const result = await query(
      `INSERT INTO transport_routes (school_id, route_name, route_code, start_location, end_location, pickup_time, dropoff_time, vehicle_type, capacity, fare_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [req.schoolId, route_name, route_code, start_location, end_location, pickup_time, dropoff_time, vehicle_type, capacity, fare_amount]
    );
    
    res.status(201).json({ data: result.rows[0], message: 'Route created successfully' });
  } catch (error) {
    console.error('Error creating route:', error);
    if (error.message.includes('duplicate key')) {
      return res.status(400).json({ error: 'Route code already exists' });
    }
    res.status(500).json({ error: 'Failed to create route' });
  }
});

// UPDATE transport route
router.put('/routes/:id', requireAuth, requireRole(['admin', 'super_admin', 'transport_manager']), async (req, res) => {
  try {
    const { route_name, start_location, end_location, pickup_time, dropoff_time, vehicle_type, capacity, fare_amount, status } = req.body;
    
    const result = await query(
      `UPDATE transport_routes 
       SET route_name = COALESCE($1, route_name),
           start_location = COALESCE($2, start_location),
           end_location = COALESCE($3, end_location),
           pickup_time = COALESCE($4, pickup_time),
           dropoff_time = COALESCE($5, dropoff_time),
           vehicle_type = COALESCE($6, vehicle_type),
           capacity = COALESCE($7, capacity),
           fare_amount = COALESCE($8, fare_amount),
           status = COALESCE($9, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 AND school_id = $11
       RETURNING *`,
      [route_name, start_location, end_location, pickup_time, dropoff_time, vehicle_type, capacity, fare_amount, status, req.params.id, req.schoolId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Route not found' });
    }
    
    res.json({ data: result.rows[0], message: 'Route updated successfully' });
  } catch (error) {
    console.error('Error updating route:', error);
    res.status(500).json({ error: 'Failed to update route' });
  }
});

// DELETE transport route
router.delete('/routes/:id', requireAuth, requireRole(['admin', 'super_admin', 'transport_manager']), async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM transport_routes WHERE id = $1 AND school_id = $2 RETURNING id',
      [req.params.id, req.schoolId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Route not found' });
    }
    
    res.json({ message: 'Route deleted successfully' });
  } catch (error) {
    console.error('Error deleting route:', error);
    res.status(500).json({ error: 'Failed to delete route' });
  }
});

// ============================================
// TRANSPORT ENROLLMENTS
// ============================================

// GET student's transport enrollments
router.get('/enrollments', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*, tr.route_name, s.first_name, s.last_name 
       FROM transport_enrollments e
       JOIN transport_routes tr ON e.route_id = tr.id
       LEFT JOIN students s ON e.student_id = s.id
       WHERE e.school_id = $1
       ORDER BY e.created_at DESC`,
      [req.schoolId]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// CREATE transport enrollment
router.post('/enrollments', requireAuth, requireRole(['admin', 'super_admin', 'transport_manager', 'registrar']), async (req, res) => {
  try {
    const { student_id, route_id, amount_due, start_date, end_date } = req.body;
    
    if (!student_id || !route_id) {
      return res.status(400).json({ error: 'Student and route are required' });
    }

    const result = await query(
      `INSERT INTO transport_enrollments (school_id, student_id, route_id, amount_due, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.schoolId, student_id, route_id, amount_due, start_date, end_date]
    );
    
    res.status(201).json({ data: result.rows[0], message: 'Enrollment created successfully' });
  } catch (error) {
    console.error('Error creating enrollment:', error);
    if (error.message.includes('duplicate key')) {
      return res.status(400).json({ error: 'Student already enrolled in this route' });
    }
    res.status(500).json({ error: 'Failed to create enrollment' });
  }
});

// ============================================
// BOARDING HOUSES
// ============================================

// GET all boarding houses
router.get('/boarding-houses', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT bh.*, 
              u1.name as house_master_name,
              u2.name as deputy_master_name
       FROM boarding_houses bh
       LEFT JOIN users u1 ON bh.house_master_id = u1.id
       LEFT JOIN users u2 ON bh.deputy_master_id = u2.id
       WHERE bh.school_id = $1
       ORDER BY bh.house_name`,
      [req.schoolId]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching boarding houses:', error);
    res.status(500).json({ error: 'Failed to fetch boarding houses' });
  }
});

// CREATE boarding house
router.post('/boarding-houses', requireAuth, requireRole(['admin', 'super_admin', 'registrar']), async (req, res) => {
  try {
    const { house_name, house_code, capacity, gender_type, fee_amount } = req.body;
    
    if (!house_name || !house_code) {
      return res.status(400).json({ error: 'House name and code are required' });
    }

    const result = await query(
      `INSERT INTO boarding_houses (school_id, house_name, house_code, capacity, gender_type, fee_amount)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.schoolId, house_name, house_code, capacity, gender_type, fee_amount]
    );
    
    res.status(201).json({ data: result.rows[0], message: 'Boarding house created successfully' });
  } catch (error) {
    console.error('Error creating boarding house:', error);
    if (error.message.includes('duplicate key')) {
      return res.status(400).json({ error: 'House code already exists' });
    }
    res.status(500).json({ error: 'Failed to create boarding house' });
  }
});

// ============================================
// BOARDING ENROLLMENTS
// ============================================

// GET boarding enrollments
router.get('/boarding-enrollments', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT be.*, 
              s.first_name, s.last_name, s.admission_number,
              bh.house_name
       FROM boarding_enrollments be
       JOIN students s ON be.student_id = s.id
       JOIN boarding_houses bh ON be.boarding_house_id = bh.id
       WHERE be.school_id = $1
       ORDER BY be.created_at DESC`,
      [req.schoolId]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching boarding enrollments:', error);
    res.status(500).json({ error: 'Failed to fetch boarding enrollments' });
  }
});

// CREATE boarding enrollment
router.post('/boarding-enrollments', requireAuth, requireRole(['admin', 'super_admin', 'registrar']), async (req, res) => {
  try {
    const { student_id, boarding_house_id, room_id, amount_due, academic_year_id } = req.body;
    
    if (!student_id || !boarding_house_id) {
      return res.status(400).json({ error: 'Student and boarding house are required' });
    }

    const result = await query(
      `INSERT INTO boarding_enrollments (school_id, student_id, boarding_house_id, room_id, amount_due, academic_year_id, check_in_date)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
       RETURNING *`,
      [req.schoolId, student_id, boarding_house_id, room_id, amount_due, academic_year_id]
    );
    
    res.status(201).json({ data: result.rows[0], message: 'Boarding enrollment created successfully' });
  } catch (error) {
    console.error('Error creating boarding enrollment:', error);
    if (error.message.includes('duplicate key')) {
      return res.status(400).json({ error: 'Student already has boarding enrollment for this academic year' });
    }
    res.status(500).json({ error: 'Failed to create boarding enrollment' });
  }
});

module.exports = router;
