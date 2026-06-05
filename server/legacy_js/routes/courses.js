const express = require('express');
const router = express.Router();
const { authorizeRole } = require('../middleware/auth');
const {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseStudents,
  getCourseResources,
  addCourseResource,
  deleteCourseResource
} = require('../controllers/courseController');

// --- Courses ---
router.get('/courses', authorizeRole(['super_admin', 'admin', 'teacher', 'student', 'parent']), getAllCourses);

router.get('/courses/:id', authorizeRole(['super_admin', 'admin', 'teacher', 'student']), getCourseById);

router.post('/courses', authorizeRole(['super_admin', 'admin']), createCourse);

router.put('/courses/:id', authorizeRole(['super_admin', 'admin']), updateCourse);

router.delete('/courses/:id', authorizeRole(['super_admin', 'admin']), deleteCourse);

router.get('/courses/:id/students', authorizeRole(['admin', 'teacher', 'super_admin']), getCourseStudents);

router.get('/courses/:id/resources', authorizeRole(['admin', 'teacher', 'student', 'super_admin']), getCourseResources);

router.post('/courses/:id/resources', authorizeRole(['admin', 'teacher', 'super_admin']), addCourseResource);

router.delete('/courses/:id/resources/:resourceId', authorizeRole(['admin', 'teacher', 'super_admin']), deleteCourseResource);

module.exports = router;