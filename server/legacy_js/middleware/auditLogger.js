const { logActivity } = require('../services/auditService');

/**
 * Middleware to automatically log mutating API requests
 */
const auditLogger = async (req, res, next) => {
  // Only log mutating methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    // Intercept res.json to log after the request is processed successfully
    const originalJson = res.json;
    
    res.json = function(data) {
      // Log successful requests and critical security failures (401, 403, 429)
      const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
      const isSecurityFailure = [401, 403, 429].includes(res.statusCode);

      if (isSuccess || isSecurityFailure) {
        // Avoid logging sensitive authentication data
        const isAuthRoute = req.path.includes('/auth/');
        const safeBody = isAuthRoute ? { ...req.body } : req.body;
        
        if (isAuthRoute) {
          if (safeBody.password) safeBody.password = '********';
          if (safeBody.current_password) safeBody.current_password = '********';
          if (safeBody.new_password) safeBody.new_password = '********';
          if (safeBody.password_hash) safeBody.password_hash = '********';
        }

        // Determine entity type and ID from path
        // e.g., /api/students/123 -> entityType: students, entityId: 123
        const pathParts = req.path.split('/').filter(p => p && p !== 'api');
        const entityType = pathParts[0] || 'general';
        const entityId = req.params.id || (data && (data.id || (data.data && data.data.id)));

        const actionPrefix = isSecurityFailure ? 'failed_' : '';

        logActivity({
          schoolId: req.schoolId || (data && (data.school_id || (data.data && data.data.school_id))),
          userId: req.user?.id,
          action: `${actionPrefix}${req.method.toLowerCase()}_${entityType}`,
          entityType,
          entityId,
          description: `${req.method} ${req.originalUrl}`,
          metadata: {
            method: req.method,
            path: req.path,
            query: req.query,
            body: safeBody,
            status: res.statusCode
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }).catch(err => console.error('Audit logger error:', err));
      }
      
      return originalJson.call(this, data);
    };
  }
  next();
};

module.exports = { auditLogger };
