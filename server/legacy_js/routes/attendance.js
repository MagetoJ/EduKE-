const express = require('express');
const attendanceRouter = express.Router();
const { authorizeRole } = require('../middleware/auth');
const attendanceService = require('../services/attendanceService');
const { dbGet, dbAll, dbRun } = require('../database');

attendanceRouter.post(
  '/record',
  authorizeRole(['admin', 'teacher', 'super_admin', 'registrar', 'hod', 'class_teacher']),
  async (req, res) => {
    try {
      const { schoolId, user } = req;
      const { course_id, attendance_date, attendance_records } = req.body;

      if (!course_id || !attendance_date || !Array.isArray(attendance_records)) {
        return res.status(400).json({
          error: 'Missing required fields: course_id, attendance_date, attendance_records'
        });
      }

      if (attendance_records.length === 0) {
        return res.status(400).json({
          error: 'Attendance records cannot be empty'
        });
      }

      const courseEnrollments = await dbAll(
        'SELECT student_id FROM course_enrollments WHERE course_id = ?',
        [course_id]
      );

      const enrolledStudentIds = new Set(courseEnrollments.map(e => e.student_id));

      for (const record of attendance_records) {
        if (!enrolledStudentIds.has(record.student_id)) {
          return res.status(400).json({
            error: `Student ${record.student_id} is not enrolled in this course`
          });
        }
      }

      const result = await attendanceService.recordDailyAttendance(
        schoolId,
        course_id,
        attendance_date,
        attendance_records,
        user.id
      );

      await dbRun(
        `INSERT INTO activity_logs (school_id, user_id, action, entity_type, entity_id, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [schoolId, user.id, 'attendance_recorded', 'course_attendance', course_id, 
         `Attendance recorded for ${attendance_records.length} students on ${attendance_date}`]
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

attendanceRouter.get(
  '/course/:courseId',
  authorizeRole(['admin', 'teacher', 'super_admin', 'registrar', 'hod', 'class_teacher']),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const { schoolId } = req;
      const { start_date, end_date } = req.query;

      if (!start_date) {
        return res.status(400).json({ error: 'start_date parameter is required' });
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

attendanceRouter.get(
  '/student/:studentId',
  authorizeRole(['admin', 'teacher', 'parent', 'student', 'super_admin', 'registrar', 'hod', 'class_teacher']),
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const { schoolId, user } = req;
      const { start_date, end_date } = req.query;

      if (user.role === 'student' && user.id !== studentId) {
        return res.status(403).json({ error: 'Unauthorized' });
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

attendanceRouter.get(
  '/student/:studentId/term/:termId',
  authorizeRole(['admin', 'teacher', 'parent', 'student', 'super_admin', 'registrar', 'hod', 'class_teacher']),
  async (req, res) => {
    try {
      const { studentId, termId } = req.params;
      const { schoolId, user } = req;

      if (user.role === 'student' && user.id !== studentId) {
        return res.status(403).json({ error: 'Unauthorized' });
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
          student_name: `${student.first_name} ${student.last_name}`,
          ...stats
        });
      }

      summary.sort((a, b) => a.attendance_rate - b.attendance_rate);

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
