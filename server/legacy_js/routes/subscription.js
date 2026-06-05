const express = require('express');
const router = express.Router();
const { authorizeRole } = require('../middleware/auth');
const {
  getSubscriptionPlans,
  updateSchoolSubscription,
  getSubscriptionStatusReport,
  getSchoolAnalyticsReport
} = require('../controllers/subscriptionController');

// ===================
// SUBSCRIPTION MANAGEMENT (Super Admin)
// ===================

// Get subscription plans (for frontend)
router.get('/subscription/plans', authorizeRole(['super_admin']), getSubscriptionPlans);

// Update school subscription (for frontend)
router.put('/schools/:id/subscription', authorizeRole(['super_admin']), updateSchoolSubscription);

// ===================
// REPORTS ROUTES (Super Admin)
// ===================

// Get subscription status report
router.get('/reports/subscription-status', authorizeRole(['super_admin']), getSubscriptionStatusReport);

// Get school analytics report
router.get('/reports/school-analytics', authorizeRole(['super_admin']), getSchoolAnalyticsReport);

module.exports = router;