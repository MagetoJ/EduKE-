const { query } = require('../db/connection');

/**
 * Get all teachers
 */
const getAllTeachers = async (req, res) => {
  try {
    const { schoolId, user, isSuperAdmin } = req;
    let sql = 'SELECT id, name FROM users WHERE role = $1';
    const params = ['teacher'];

    // Filter by school if schoolId is provided
    if (schoolId) {
      sql += ' AND school_id = $2';
      params.push(schoolId);
    }

    sql += ' ORDER BY name';

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching teachers:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch teachers' });
  }
};

// Get attendance roster for a teacher's class
const getAttendanceRoster = async (req, res) => {
  try {
    const { date, courseId } = req.query;
    const { schoolId } = req;
    const teacherId = req.user.id;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date is required'
      });
    }

    let studentsQuery, params;

    if (courseId) {
      // Get students enrolled in a specific course
      studentsQuery = `
        SELECT DISTINCT s.id, s.first_name, s.last_name, s.admission_number,
               COALESCE(a.status, 'absent') as status
        FROM students s
        JOIN course_enrollments ce ON s.id = ce.student_id
        LEFT JOIN attendance a ON s.id = a.student_id
          AND a.date = $3
          AND a.course_id = $1
        WHERE ce.course_id = $1
        AND s.school_id = $2
        ORDER BY s.first_name, s.last_name
      `;
      params = [courseId, schoolId, date];
    } else {
      // Get students in teacher's assigned courses
      studentsQuery = `
        SELECT DISTINCT s.id, s.first_name, s.last_name, s.admission_number,
               COALESCE(a.status, 'absent') as status
        FROM students s
        JOIN course_enrollments ce ON s.id = ce.student_id
        JOIN courses c ON ce.course_id = c.id
        LEFT JOIN attendance a ON s.id = a.student_id
          AND a.date = $3
          AND a.course_id = c.id
        WHERE c.teacher_id = $1
        AND s.school_id = $2
        ORDER BY s.first_name, s.last_name
      `;
      params = [teacherId, schoolId, date];
    }

    const studentsResult = await query(studentsQuery, params);

    res.json({
      success: true,
      data: studentsResult.rows
    });
  } catch (error) {
    console.error('Error fetching attendance roster:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch attendance roster'
    });
  }
};

// Mark attendance for students
const markAttendance = async (req, res) => {
  try {
    const { date, attendance, courseId } = req.body;
    const { schoolId } = req;
    const teacherId = req.user.id;

    if (!date || !Array.isArray(attendance) || !courseId) {
      return res.status(400).json({
        success: false,
        error: 'Date, courseId, and attendance array are required'
      });
    }

    // Verify teacher teaches this course
    const courseCheck = await query('SELECT id FROM courses WHERE id = $1 AND teacher_id = $2 AND school_id = $3', [courseId, teacherId, schoolId]);
    
    if (courseCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'You do not teach this course'
      });
    }

    // Begin manual transaction
    await query('BEGIN');

    try {
      // Delete existing attendance for this date/course
      await query('DELETE FROM attendance WHERE date = $1 AND course_id = $2', [date, courseId]);

      // Insert new attendance records
      for (const record of attendance) {
        await query(
          'INSERT INTO attendance (school_id, student_id, date, course_id, status, recorded_by) VALUES ($1, $2, $3, $4, $5, $6)',
          [schoolId, record.studentId, date, courseId, record.status.toLowerCase(), teacherId]
        );
      }

      await query('COMMIT');

      res.json({
        success: true,
        message: 'Attendance marked successfully'
      });
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark attendance'
    });
  }
};

// Submit a grade for a student
const submitGrade = async (req, res) => {
  try {
    const { studentId, subject, grade, courseId, assessmentType, remarks } = req.body;
    const teacherId = req.user.id;

    if (!studentId || !subject || grade === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Student ID, subject, and grade are required'
      });
    }

    const { schoolId } = req;

    // Insert performance record
    const sql = `
      INSERT INTO performance (school_id, student_id, course_id, subject, grade, assessment_type, remarks, recorded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    await query(sql, [schoolId, studentId, courseId || null, subject, grade, assessmentType || 'continuous', remarks || null, teacherId]);

    res.json({
      success: true,
      message: 'Grade submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting grade:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit grade'
    });
  }
};

module.exports = {
  getAllTeachers,
  getAttendanceRoster,
  markAttendance,
  submitGrade
};