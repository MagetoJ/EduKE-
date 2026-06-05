const express = require('express');
const router = express.Router();
const { authorizeRole } = require('../middleware/auth');
const {
  getAllTeachers,
  getAttendanceRoster,
  markAttendance,
  submitGrade
} = require('../controllers/teacherController');

// ===================
// TEACHER ROUTES
// ===================

// Get all teachers for the school
router.get('/', authorizeRole(['super_admin', 'admin', 'teacher', 'student', 'parent', 'registrar', 'hod', 'class_teacher']), getAllTeachers);

// Get attendance roster for a teacher's class
router.get('/attendance/roster', authorizeRole(['teacher', 'admin', 'super_admin', 'registrar', 'hod', 'class_teacher']), getAttendanceRoster);

// Mark attendance for students
router.post('/attendance', authorizeRole(['teacher', 'admin', 'super_admin', 'registrar', 'hod', 'class_teacher']), markAttendance);

// Submit a grade for a student
router.post('/performance', authorizeRole(['teacher', 'admin', 'super_admin', 'exam_officer', 'hod', 'class_teacher']), submitGrade);

module.exports = router;