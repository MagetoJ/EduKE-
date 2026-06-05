/**
 * Multi-Tenant Middleware
 * Handles school-based tenant isolation for the application
 * Extracts school_id from JWT token and injects it into requests
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Tenant Context Middleware
 * Extracts and validates school context for multi-tenant isolation
 * Sets req.schoolId for use in subsequent route handlers
 */
const tenantContext = async (req, res, next) => {
  try {
    // Check if user is authenticated (token should be set by auth middleware)
    if (!req.user) {
      // If no user context, try to extract from token header
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          req.user = decoded;
        } catch (error) {
          // Token invalid or expired - continue without user context
          // Some routes might be public
        }
      }
    }

    // Super admins can operate across all tenants
    if (req.user && req.user.role === 'super_admin') {
      // Allow super admins to specify school_id in query params
      if (req.query.schoolId) {
        req.schoolId = parseInt(req.query.schoolId);
        req.isSuperAdmin = true;
      } else {
        // Super admin without specified school_id
        req.isSuperAdmin = true;
        req.schoolId = null;
      }
      return next();
    }

    // For regular users, extract school_id from user context
    if (req.user && req.user.schoolId) {
      req.schoolId = req.user.schoolId;
      return next();
    }

    // For public routes (registration, etc.), school_id might not be needed
    // Let the route handler decide if school context is required
    req.schoolId = null;
    next();
    
  } catch (error) {
    console.error('Tenant context error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error establishing tenant context'
    });
  }
};

/**
 * Require School Context Middleware
 * Ensures that a valid school context exists for the request
 * Use this for routes that absolutely need school_id
 */
const requireSchoolContext = (req, res, next) => {
  if (!req.schoolId && !req.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      error: 'School context required for this operation',
      code: 'NO_SCHOOL_CONTEXT'
    });
  }
  next();
};

/**
 * Validate School Access Middleware
 * Ensures user can only access data from their own school
 * unless they are a super admin
 */
const validateSchoolAccess = (resourceSchoolId) => {
  return (req, res, next) => {
    // Super admins can access any school
    if (req.isSuperAdmin) {
      return next();
    }

    // Regular users can only access their own school's data
    if (!req.schoolId) {
      return res.status(403).json({
        success: false,
        error: 'No school context available',
        code: 'NO_SCHOOL_CONTEXT'
      });
    }

    // If resource school ID is provided, validate it matches user's school
    if (resourceSchoolId && resourceSchoolId !== req.schoolId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this school\'s data',
        code: 'SCHOOL_ACCESS_DENIED'
      });
    }

    next();
  };
};

module.exports = {
  tenantContext,
  requireSchoolContext,
  validateSchoolAccess
};
