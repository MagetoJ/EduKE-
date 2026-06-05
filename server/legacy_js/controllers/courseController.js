const { query } = require('../db/connection');

/**
 * Get all courses
 */
const getAllCourses = async (req, res) => {
  try {
    const { schoolId, user, isSuperAdmin } = req;
    let sql = 'SELECT c.*, u.name as teacher_name FROM courses c LEFT JOIN users u ON c.teacher_id = u.id';
    const params = [];
    let paramIndex = 1;

    // Filter by school if schoolId is provided
    if (schoolId) {
      sql += ` WHERE c.school_id = $${paramIndex}`;
      params.push(schoolId);
      paramIndex++;
    }

    // For teachers, only show courses they teach
    if (user.role === 'teacher') {
      sql += ` AND c.teacher_id = $${paramIndex}`;
      params.push(user.id);
      paramIndex++;
    }

    sql += ' ORDER BY c.name';
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching courses:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch courses' });
  }
};

/**
 * Get single course
 */
const getCourseById = async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    const result = await query('SELECT c.*, u.name as teacher_name FROM courses c LEFT JOIN users u ON c.teacher_id = u.id WHERE c.id = $1 AND c.school_id = $2', [id, schoolId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching course:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch course' });
  }
};

/**
 * Create course
 */
const createCourse = async (req, res) => {
  try {
    const { schoolId } = req;
    const { name, code, grade, subject_area, teacher_id, description } = req.body;

    const yearRes = await query('SELECT id FROM academic_years WHERE school_id = $1 AND status = $2', [schoolId, 'active']);
    const academic_year_id = yearRes.rows[0]?.id || null;

    const result = await query(
      `INSERT INTO courses (school_id, name, code, grade, subject_area, teacher_id, academic_year_id, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *`,
      [schoolId, name, code, grade, subject_area, teacher_id, academic_year_id, description]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: 'Course created successfully' });
  } catch (err) {
    console.error('Error creating course:', err);
    res.status(500).json({ success: false, error: 'Failed to create course' });
  }
};

/**
 * Update course
 */
const updateCourse = async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    const { name, code, grade, subject_area, teacher_id, description, is_active } = req.body;

    const result = await query(
      `UPDATE courses SET name = $1, code = $2, grade = $3, subject_area = $4, teacher_id = $5, description = $6, is_active = $7, updated_at = NOW()
       WHERE id = $8 AND school_id = $9 RETURNING *`,
      [name, code, grade, subject_area, teacher_id, description, is_active, id, schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }

    res.json({ success: true, data: result.rows[0], message: 'Course updated successfully' });
  } catch (err) {
    console.error('Error updating course:', err);
    res.status(500).json({ success: false, error: 'Failed to update course' });
  }
};

/**
 * Delete course (soft delete)
 */
const deleteCourse = async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    await query('UPDATE courses SET is_active = false, updated_at = NOW() WHERE id = $1 AND school_id = $2', [id, schoolId]);
    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (err) {
    console.error('Error deleting course:', err);
    res.status(500).json({ success: false, error: 'Failed to delete course' });
  }
};

/**
 * Get course students
 */
const getCourseStudents = async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    const result = await query(
      `SELECT DISTINCT s.id, s.first_name, s.last_name,
              CONCAT(s.first_name, ' ', s.last_name) as name,
              s.grade, s.class_section, s.status, s.email
       FROM course_enrollments ce
       JOIN students s ON ce.student_id = s.id
       WHERE ce.course_id = $1 AND s.school_id = $2
       ORDER BY s.first_name, s.last_name`,
      [id, schoolId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching course students:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch course students' });
  }
};

/**
 * Get course resources
 */
const getCourseResources = async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    const result = await query(
      `SELECT cr.id, cr.title, cr.description, cr.resource_type as type,
              cr.url, cr.file_path, cr.created_at as createdAt,
              u.name as createdByName
       FROM course_resources cr
       JOIN courses c ON cr.course_id = c.id
       LEFT JOIN users u ON cr.created_by = u.id
       WHERE cr.course_id = $1 AND c.school_id = $2
       ORDER BY cr.created_at DESC`,
      [id, schoolId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching course resources:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch course resources' });
  }
};

/**
 * Add course resource
 */
const addCourseResource = async (req, res) => {
  try {
    const { schoolId, user } = req;
    const { id } = req.params;
    const { title, description, type, url, file_path, file_size, mime_type } = req.body;

    const result = await query(
      `INSERT INTO course_resources (course_id, title, description, resource_type, url, file_path, file_size, mime_type, created_by)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
       FROM courses WHERE id = $1 AND school_id = $10
       RETURNING id, title, description, resource_type as type, url, created_at as createdAt`,
      [id, title, description, type || 'document', url, file_path, file_size, mime_type, user.id, schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }

    res.status(201).json({ success: true, data: result.rows[0], message: 'Resource added successfully' });
  } catch (err) {
    console.error('Error adding course resource:', err);
    res.status(500).json({ success: false, error: 'Failed to add course resource' });
  }
};

/**
 * Delete course resource
 */
const deleteCourseResource = async (req, res) => {
  try {
    const { schoolId } = req;
    const { id, resourceId } = req.params;

    await query(
      `DELETE FROM course_resources
       WHERE id = $1 AND course_id = $2
       AND course_id IN (SELECT id FROM courses WHERE school_id = $3)`,
      [resourceId, id, schoolId]
    );

    res.json({ success: true, message: 'Resource deleted successfully' });
  } catch (err) {
    console.error('Error deleting course resource:', err);
    res.status(500).json({ success: false, error: 'Failed to delete course resource' });
  }
};

module.exports = {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseStudents,
  getCourseResources,
  addCourseResource,
  deleteCourseResource
};