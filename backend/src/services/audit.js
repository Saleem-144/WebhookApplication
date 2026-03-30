import { query } from '../db/index.js';

/**
 * Logs an administrative action to the audit_log table
 * @param {string} performedBy - UUID of the user who performed the action
 * @param {string} action - Description of the action (e.g., 'CREATE_USER')
 * @param {string} targetType - The type of object affected (e.g., 'user')
 * @param {string} targetId - The ID of the affected object
 * @param {object} details - Additional JSON details about the action
 */
export const logAction = async (performedBy, action, targetType = null, targetId = null, details = {}) => {
  try {
    await query(
      `INSERT INTO audit_log (performed_by, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [performedBy, action, targetType, targetId, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('Failed to log audit action:', err);
    // We don't throw here to avoid failing the main action if logging fails
  }
};
