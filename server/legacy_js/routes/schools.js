const express = require('express');
const router = express.Router();
const { authorizeRole } = require('../middleware/auth');
const {
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
} = require('../controllers/schoolController');

// ===================
// SCHOOLS MANAGEMENT (Super Admin)
// ===================

// Get all schools with subscription and metrics
router.get('/schools', authorizeRole(['super_admin']), getAllSchools);

// Get single school
router.get('/schools/:id', authorizeRole(['super_admin']), getSchoolById);

// Create school
router.post('/schools', authorizeRole(['super_admin']), createSchool);

// Update school
router.put('/schools/:id', authorizeRole(['super_admin']), updateSchool);

// Delete/Deactivate school
router.delete('/schools/:id', authorizeRole(['super_admin']), deleteSchool);

// Create school admin
router.post('/schools/:id/admin', authorizeRole(['super_admin']), createSchoolAdmin);

// Get all school admins (Super Admin only)
router.get('/school-admins', authorizeRole(['super_admin']), getSchoolAdmins);

// Delete/deactivate school admin (Super Admin only)
router.delete('/school-admins/:id', authorizeRole(['super_admin']), deleteSchoolAdmin);

// Update school admin (Super Admin only)
router.put('/school-admins/:id', authorizeRole(['super_admin']), updateSchoolAdmin);

// Create a new admin for a school (Super Admin only)
router.post('/admins', authorizeRole(['super_admin']), createAdmin);

// Get schools analytics
router.get('/schools/analytics', authorizeRole(['super_admin']), getSchoolsAnalytics);

module.exports = router;