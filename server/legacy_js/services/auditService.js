const { dbRun } = require('../database');

/**
 * Log an activity to the audit trail
 * @param {Object} params - The log parameters
 * @param {number} params.schoolId - The school ID
 * @param {number} params.userId - The user ID who performed the action
 * @param {string} params.action - The action performed (e.g., 'create_student')
 * @param {string} params.entityType - The type of entity affected (e.g., 'student')
 * @param {number} params.entityId - The ID of the entity affected
 * @param {string} params.description - Human-readable description
 * @param {Object} [params.metadata] - Optional metadata (will be JSON stringified)
 * @param {string} [params.ipAddress] - IP address of the user
 * @param {string} [params.userAgent] - User agent of the user
 */
const logActivity = async ({
  schoolId,
  userId,
  action,
  entityType,
  entityId,
  description,
  metadata = null,
  ipAddress = null,
  userAgent = null
}) => {
  try {
    const metadataStr = metadata ? JSON.stringify(metadata) : null;
    
    // Check if we are using PostgreSQL (which uses NOW() or CURRENT_TIMESTAMP)
    // database.js handles placeholder conversion from ? to $1, $2
    await dbRun(
      `INSERT INTO activity_logs (
        school_id, 
        user_id, 
        action, 
        entity_type, 
        entity_id, 
        description, 
        metadata, 
        ip_address, 
        user_agent, 
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        schoolId,
        userId,
        action,
        entityType,
        entityId,
        description,
        metadataStr,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    // We don't want to crash the app if logging fails, but we should log the error
    console.error('Failed to write to activity_logs:', error);
  }
};

module.exports = {
  logActivity
};
