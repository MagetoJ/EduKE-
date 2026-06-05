const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    console.log('Auth middleware: No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Auth middleware: Token verification failed', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission for this resource' });
    }

    next();
  };
};

const requireFeature = (feature) => {
  return async (req, res, next) => {
    try {
      if (!req.schoolId) {
        return res.status(400).json({ error: 'School context required' });
      }

      const { dbGet } = require('../database');

      const subscription = await dbGet(
        `SELECT sp.* FROM subscriptions s
         JOIN subscription_plans sp ON s.plan_id = sp.id
         WHERE s.school_id = ? AND s.status = 'active'`,
        [req.schoolId]
      );

      if (!subscription) {
        return res.status(403).json({
          error: 'No active subscription',
          feature_required: feature
        });
      }

      const featureMap = {
        'parent_portal': 'include_parent_portal',
        'student_portal': 'include_student_portal',
        'messaging': 'include_messaging',
        'finance': 'include_finance',
        'advanced_reports': 'include_advanced_reports',
        'leave_management': 'include_leave_management',
        'ai_analytics': 'include_ai_analytics'
      };

      const dbFeature = featureMap[feature];
      if (!dbFeature) {
        return res.status(400).json({ error: 'Unknown feature' });
      }

      if (!subscription[dbFeature]) {
        return res.status(403).json({
          error: 'Feature not available in current plan',
          feature: feature,
          required_plan: 'Pro'
        });
      }

      next();
    } catch (error) {
      console.error('Feature check error:', error);
      res.status(500).json({ error: 'Feature verification failed' });
    }
  };
};

module.exports = { authenticateToken, authorizeRole, requireFeature };