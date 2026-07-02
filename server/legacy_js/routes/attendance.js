const express = require('express');
const attendanceRouter = express.Router();
const { authorizeRole } = require('../middleware/auth');
const attendanceService = require('../services/attendanceService');
const { dbGet, dbAll, dbRun } = require('../database');

/**
 * POST /api/attendance/record
 * Records or updates daily attendance for a specific course.
 * Accessible by school administrators, teachers, registrars, and HODs.
 */
attendanceRouter.post(
  '/record',
  authorizeRole(['admin', 'teacher', 'super_admin', 'registrar', 'hod', 'class_teacher']),
  async (req, res) => {
    try {
      const { schoolId, user } = req;
      const { course_id, attendance_date, attendance_records } = req.body;

      // 1. Mandatory Fields Presence Validation
      if (!course_id || !attendance_date || !Array.isArray(attendance_records)) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: course_id, attendance_date, attendance_records'
        });
      }

      if (attendance_records.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Attendance records array cannot be empty'
        });
      }

      // 2. Fetch all valid enrollments for the course to avoid unauthorized recording
      const courseEnrollments = await dbAll(
        'SELECT student_id FROM course_enrollments WHERE course_id = ?',
        [course_id]
      );
      const enrolledStudentIds = new Set(courseEnrollments.map(e => e.student_id));

      // 3. Sandbox Verification Check
      for (const record of attendance_records) {
        if (!enrolledStudentIds.has(record.student_id)) {
          return res.status(400).json({
            success: false,
            error: `Student ID ${record.student_id} is not actively enrolled in this course context`
          });
        }
      }

      // 4. Delegate transactional processing to Service layer
      const result = await attendanceService.recordDailyAttendance(
        schoolId,
        course_id,
        attendance_date,
        attendance_records,
        user.id
      );

      // 5. Append Activity Log Entry for auditing
      await dbRun(
        `INSERT INTO activity_logs (school_id, user_id, action, entity_type, entity_id, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          schoolId, 
          user.id, 
          'attendance_recorded', 
          'course_attendance', 
          course_id, 
          `Attendance recorded for ${attendance_records.length} students on ${attendance_date}`
        ]
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error recording attendance:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/attendance/course/:courseId
 * Retrieves detailed attendance journals for a classroom within a date range.
 */
attendanceRouter.get(
  '/course/:courseId',
  authorizeRole(['admin', 'teacher', 'super_admin', 'registrar', 'hod', 'class_teacher']),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const { schoolId } = req;
      const { start_date, end_date } = req.query;

      if (!start_date) {
        return res.status(400).json({ success: false, error: 'start_date query parameter is required' });
      }

      const attendance = await attendanceService.getClassAttendance(
        schoolId,
        courseId,
        start_date,
        end_date
      );

      res.json({
        success: true,
        data: attendance
      });
    } catch (error) {
      console.error('Error fetching class attendance:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/attendance/student/:studentId
 * Retrieves historical attendance records for an individual student.
 */
attendanceRouter.get(
  '/student/:studentId',
  authorizeRole(['admin', 'teacher', 'parent', 'student', 'super_admin', 'registrar', 'hod', 'class_teacher']),
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const { schoolId, user } = req;
      const { start_date, end_date } = req.query;

      // Restrict access so students can only inspect their own attendance timeline
      if (user.role === 'student' && String(user.id) !== String(studentId)) {
        return res.status(403).json({ success: false, error: 'Unauthorized resource access restriction' });
      }

      const attendance = await attendanceService.getStudentAttendance(
        schoolId,
        studentId,
        start_date,
        end_date
      );

      res.json({
        success: true,
        data: attendance
      });
    } catch (error) {
      console.error('Error fetching student attendance:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/attendance/student/:studentId/term/:termId
 * Generates an analytical breakdown summary of student parameters for report card processing.
 */
attendanceRouter.get(
  '/student/:studentId/term/:termId',
  authorizeRole(['admin', 'teacher', 'parent', 'student', 'super_admin', 'registrar', 'hod', 'class_teacher']),
  async (req, res) => {
    try {
      const { studentId, termId } = req.params;
      const { schoolId, user } = req;

      if (user.role === 'student' && String(user.id) !== String(studentId)) {
        return res.status(403).json({ success: false, error: 'Unauthorized resource access restriction' });
      }

      const summary = await attendanceService.getTermAttendanceSummary(
        schoolId,
        studentId,
        termId
      );

      res.json({
        success: true,
        data: {
          student_id: studentId,
          term_id: termId,
          summary: summary
        }
      });
    } catch (error) {
      console.error('Error fetching term attendance:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/attendance/course/:courseId/summary
 * Provides full performance overview metrics sorted by descending attendance rates.
 */
attendanceRouter.get(
  '/course/:courseId/summary',
  authorizeRole(['admin', 'teacher', 'super_admin', 'registrar', 'hod', 'class_teacher']),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const { schoolId } = req;

      const enrollments = await dbAll(
        `SELECT student_id FROM course_enrollments WHERE course_id = ?`,
        [courseId]
      );

      const summary = [];

      for (const enrollment of enrollments) {
        const stats = await attendanceService.getTermAttendanceSummary(
          schoolId,
          enrollment.student_id,
          null
        );

        const student = await dbGet(
          'SELECT first_name, last_name FROM students WHERE id = ?',
          [enrollment.student_id]
        );

        summary.push({
          student_id: enrollment.student_id,
          student_name: student ? `${student.first_name} ${student.last_name}` : `Student #${enrollment.student_id}`,
          ...stats
        });
      }

      // Sort students showing critical attendance vulnerabilities first
      summary.sort((a, b) => (a.attendance_rate || 0) - (b.attendance_rate || 0));

      res.json({
        success: true,
        data: {
          course_id: courseId,
          student_attendance_summary: summary
        }
      });
    } catch (error) {
      console.error('Error fetching course attendance summary:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

module.exports = attendanceRouter;