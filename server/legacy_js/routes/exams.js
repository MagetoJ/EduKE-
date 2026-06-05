const express = require('express');
const router = express.Router();
const { authorizeRole } = require('../middleware/auth');
const {
  getAllExams,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
  postExamResults
} = require('../controllers/examController');

// ===================
// EXAMS ROUTES
// ===================

// Get all exams
router.get('/exams', authorizeRole(['admin', 'teacher', 'student', 'super_admin', 'exam_officer', 'hod']), getAllExams);

// Get single exam
router.get('/exams/:id', authorizeRole(['admin', 'teacher', 'student', 'super_admin', 'exam_officer', 'hod']), getExamById);

// Create exam
router.post('/exams', authorizeRole(['admin', 'teacher', 'super_admin', 'exam_officer', 'hod']), createExam);

// Update exam
router.put('/exams/:id', authorizeRole(['admin', 'teacher', 'super_admin', 'exam_officer', 'hod']), updateExam);

// Delete exam
router.delete('/exams/:id', authorizeRole(['admin', 'super_admin', 'exam_officer']), deleteExam);

// Post exam results
router.post('/exams/:id/results', authorizeRole(['admin', 'teacher', 'super_admin', 'exam_officer', 'hod']), postExamResults);

module.exports = router;