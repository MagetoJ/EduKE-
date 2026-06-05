const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authorizeRole } = require('../middleware/auth');

// Get all timetable entries for a school
router.get('/', authorizeRole(['super_admin', 'admin', 'teacher', 'student', 'parent', 'timetable_manager', 'registrar', 'hod']), async (req, res) => {
  try {
    const { schoolId, user, isSuperAdmin } = req;
    const { grade, class_section, teacher_id, day_of_week } = req.query;

    let sql = `
      SELECT
        te.*,
        c.name as course_name,
        c.code as course_code,
        u.name as teacher_name,
        tp.start_time,
        tp.end_time,
        tp.name as period_name,
        tp.is_break
      FROM timetable_entries te
      LEFT JOIN courses c ON te.course_id = c.id
      LEFT JOIN users u ON te.teacher_id = u.id
      LEFT JOIN timetable_periods tp ON te.period_id = tp.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Filter by school if schoolId is provided
    if (schoolId) {
      sql += ` AND te.school_id = $${paramIndex}`;
      params.push(schoolId);
      paramIndex++;
    }

    // Apply role-based filtering
    if (user.role === 'student') {
      // For students, fetch their grade and class_section from the students table
      const studentResult = await query(
        'SELECT grade, class_section FROM students WHERE user_id = $1 AND school_id = $2',
        [user.id, schoolId]
      );
      
      if (studentResult.rows.length > 0) {
        const student = studentResult.rows[0];
        sql += ` AND te.grade = $${paramIndex}`;
        params.push(student.grade);
        paramIndex++;
        
        if (student.class_section) {
          sql += ` AND te.class_section = $${paramIndex}`;
          params.push(student.class_section);
          paramIndex++;
        }
      }
    } else if (user.role === 'parent') {
      const childrenResult = await query(
        'SELECT DISTINCT grade, class_section FROM students WHERE parent_id = $1 AND school_id = $2',
        [user.id, schoolId]
      );
      
      if (childrenResult.rows.length > 0) {
        const conditions = [];
        for (const child of childrenResult.rows) {
          conditions.push(`(te.grade = $${paramIndex} AND COALESCE(te.class_section, '') = COALESCE($${paramIndex + 1}, ''))`);
          params.push(child.grade);
          params.push(child.class_section);
          paramIndex += 2;
        }
        sql += ` AND (${conditions.join(' OR ')})`;
      }
    } else if (user.role === 'teacher') {
      // For teachers, optionally filter by their courses
      if (teacher_id) {
        sql += ` AND te.teacher_id = $${paramIndex}`;
        params.push(teacher_id);
        paramIndex++;
      }
    }

    // Allow manual filtering for admin/super_admin
    if ((user.role === 'admin' || user.role === 'super_admin') && grade) {
      sql += ` AND te.grade = $${paramIndex}`;
      params.push(grade);
      paramIndex++;
    }

    if ((user.role === 'admin' || user.role === 'super_admin') && class_section) {
      sql += ` AND te.class_section = $${paramIndex}`;
      params.push(class_section);
      paramIndex++;
    }

    if ((user.role === 'admin' || user.role === 'super_admin' || user.role === 'teacher') && teacher_id) {
      sql += ` AND te.teacher_id = $${paramIndex}`;
      params.push(teacher_id);
      paramIndex++;
    }

    if (day_of_week) {
      sql += ` AND te.day_of_week = $${paramIndex}`;
      params.push(day_of_week);
      paramIndex++;
    }

    sql += ` ORDER BY te.day_of_week, tp.start_time`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching timetable:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch timetable' });
  }
});

// Get timetable periods for a school
router.get('/periods', authorizeRole(['super_admin', 'admin', 'teacher', 'student', 'parent', 'timetable_manager', 'registrar', 'hod']), async (req, res) => {
  try {
    const { schoolId, user } = req;
    let sql = `SELECT * FROM timetable_periods`;
    const params = [];

    if (schoolId) {
      sql += ` WHERE school_id = $1`;
      params.push(schoolId);
    }

    sql += ` ORDER BY start_time`;

    let result = await query(sql, params);

    // If user is admin/super_admin and we have a school context, ensure default periods exist
    if ((user.role === 'admin' || user.role === 'super_admin') && schoolId) {
      const defaultPeriods = [
        { name: 'Period 1', start_time: '08:00', end_time: '09:00', is_break: false },
        { name: 'Period 2', start_time: '09:00', end_time: '10:00', is_break: false },
        { name: 'Break (15 min)', start_time: '10:00', end_time: '10:15', is_break: true },
        { name: 'Period 3', start_time: '10:15', end_time: '11:15', is_break: false },
        { name: 'Period 4', start_time: '11:15', end_time: '12:15', is_break: false },
        { name: 'Break (30 min)', start_time: '12:15', end_time: '12:45', is_break: true },
        { name: 'Period 5', start_time: '12:45', end_time: '13:45', is_break: false },
        { name: 'Period 6', start_time: '13:45', end_time: '14:45', is_break: false },
        { name: 'Break (1 hr)', start_time: '14:45', end_time: '15:45', is_break: true }
      ];

      for (const period of defaultPeriods) {
        // Check if period already exists
        const existing = await query(
          `SELECT id FROM timetable_periods WHERE COALESCE(school_id, 0) = COALESCE($1, 0) AND name = $2`,
          [schoolId, period.name]
        );

        if (existing.rows.length === 0) {
          await query(
            `INSERT INTO timetable_periods (school_id, name, start_time, end_time, is_break)
             VALUES ($1, $2, $3, $4, $5)`,
            [schoolId, period.name, period.start_time, period.end_time, period.is_break]
          );
        }
      }

      // Fetch again
      result = await query(sql, params);
    }

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching timetable periods:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch timetable periods' });
  }
});

router.post('/', authorizeRole(['admin', 'super_admin', 'timetable_manager', 'registrar', 'hod']), async (req, res) => {
  try {
    const {
      course_id,
      teacher_id,
      day_of_week,
      period_id,
      grade,
      class_section,
      classroom,
      academic_year_id,
      term_id
    } = req.body;

    if (!course_id || !teacher_id || !day_of_week || !period_id || !grade) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: course_id, teacher_id, day_of_week, period_id, grade' 
      });
    }

    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (!validDays.includes(day_of_week.toLowerCase())) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid day_of_week. Must be one of: ' + validDays.join(', ')
      });
    }

    const result = await query(
      `INSERT INTO timetable_entries
       (school_id, course_id, teacher_id, day_of_week, period_id, grade, class_section, classroom, academic_year_id, term_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [req.schoolId, course_id, teacher_id, day_of_week.toLowerCase(), period_id, grade, class_section, classroom, academic_year_id, term_id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating timetable entry:', err);
    if (err.code === '23503') {
      return res.status(400).json({ success: false, error: 'Invalid course_id, teacher_id, or period_id' });
    }
    res.status(500).json({ success: false, error: 'Failed to create timetable entry' });
  }
});

router.put('/:id', authorizeRole(['admin', 'super_admin', 'timetable_manager', 'registrar', 'hod']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      course_id,
      teacher_id,
      day_of_week,
      period_id,
      grade,
      class_section,
      classroom,
      academic_year_id,
      term_id
    } = req.body;

    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (day_of_week && !validDays.includes(day_of_week.toLowerCase())) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid day_of_week. Must be one of: ' + validDays.join(', ')
      });
    }

    const result = await query(
      `UPDATE timetable_entries
       SET course_id = $1, teacher_id = $2, day_of_week = $3, period_id = $4,
           grade = $5, class_section = $6, classroom = $7, academic_year_id = $8, term_id = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 AND school_id = $11
       RETURNING *`,
      [course_id, teacher_id, day_of_week ? day_of_week.toLowerCase() : day_of_week, period_id, grade, class_section, classroom, academic_year_id, term_id, id, req.schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Timetable entry not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating timetable entry:', err);
    if (err.code === '23503') {
      return res.status(400).json({ success: false, error: 'Invalid course_id, teacher_id, or period_id' });
    }
    res.status(500).json({ success: false, error: 'Failed to update timetable entry' });
  }
});

// Delete timetable entry
router.delete('/:id', authorizeRole(['admin', 'super_admin', 'timetable_manager', 'registrar', 'hod']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM timetable_entries WHERE id = $1 AND school_id = $2 RETURNING *',
      [id, req.schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Timetable entry not found' });
    }

    res.json({ success: true, message: 'Timetable entry deleted successfully' });
  } catch (err) {
    console.error('Error deleting timetable entry:', err);
    res.status(500).json({ success: false, error: 'Failed to delete timetable entry' });
  }
});

router.post('/periods', authorizeRole(['super_admin', 'admin', 'teacher', 'timetable_manager', 'registrar', 'hod']), async (req, res) => {
  try {
    const { period_name, start_time, end_time, is_break } = req.body;

    if (!period_name || !start_time || !end_time) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: period_name, start_time, end_time' 
      });
    }

    const result = await query(
      `INSERT INTO timetable_periods (school_id, name, start_time, end_time, is_break)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.schoolId, period_name, start_time, end_time, is_break || false]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating timetable period:', err);
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Period name already exists for this school' });
    }
    res.status(500).json({ success: false, error: 'Failed to create timetable period' });
  }
});

router.put('/periods/:id', authorizeRole(['admin', 'super_admin', 'timetable_manager', 'registrar', 'hod']), async (req, res) => {
  try {
    const { id } = req.params;
    const { period_name, start_time, end_time, is_break } = req.body;

    const result = await query(
      `UPDATE timetable_periods
       SET name = $1, start_time = $2, end_time = $3, is_break = $4
       WHERE id = $5 AND school_id = $6
       RETURNING *`,
      [period_name, start_time, end_time, is_break, id, req.schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Timetable period not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating timetable period:', err);
    res.status(500).json({ success: false, error: 'Failed to update timetable period' });
  }
});

// Delete timetable period
router.delete('/periods/:id', authorizeRole(['admin', 'super_admin', 'timetable_manager', 'registrar', 'hod']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM timetable_periods WHERE id = $1 AND school_id = $2 RETURNING *',
      [id, req.schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Timetable period not found' });
    }

    res.json({ success: true, message: 'Timetable period deleted successfully' });
  } catch (err) {
    console.error('Error deleting timetable period:', err);
    res.status(500).json({ success: false, error: 'Failed to delete timetable period' });
  }
});

module.exports = router;
