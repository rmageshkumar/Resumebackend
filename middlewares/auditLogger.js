const pool = require("../config/db");

/**
 * Log an audit event to the database.
 * @param {Object} params
 * @param {number} params.userId - The user who performed the action
 * @param {string} params.action - The action performed (e.g., 'resume.create', 'subscription.upgrade')
 * @param {string} params.resource - The resource type (e.g., 'resume', 'subscription', 'template')
 * @param {string} params.resourceId - The ID of the resource affected
 * @param {Object} [params.details] - Optional JSON payload with extra context
 * @param {string} [params.ip] - The IP address of the requester
 */
async function logAuditEvent({
  userId,
  action,
  resource,
  resourceId,
  details,
  ip,
}) {
  try {
    await pool.execute(
      `INSERT INTO audit_logs (user_id, action, resource, resource_id, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        action,
        resource,
        resourceId || null,
        details ? JSON.stringify(details) : null,
        ip || null,
      ],
    );
  } catch (error) {
    // Don't throw — audit logging should never break the main flow
    console.error("Audit log write failed:", error.message);
  }
}

/**
 * Express middleware to automatically log route access.
 * Add as the last middleware before your controller.
 */
function auditMiddleware(action, resource) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      const userId = req.user?.userId || req.user?.id;
      const resourceId =
        req.params?.id || req.params?.resumeId || req.params?.coverId || null;

      // Only log successful operations (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logAuditEvent({
          userId,
          action,
          resource,
          resourceId,
          ip: req.ip,
        }).catch(() => {});
      }

      return originalJson(body);
    };

    next();
  };
}

module.exports = { logAuditEvent, auditMiddleware };
