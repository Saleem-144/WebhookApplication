import { query } from '../db/index.js';

/**
 * Log an agent activity event.
 * @param {string} userId UUID of the agent
 * @param {string} type 'login', 'message_sent', 'message_seen', 'call_started'
 * @param {object} details Additional context (customer name, message preview, etc.)
 */
export async function logActivity(userId, type, details = {}) {
  try {
    await query(
      'INSERT INTO agent_activity_logs (user_id, action_type, details) VALUES ($1, $2, $3)',
      [userId, type, details]
    );
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

/**
 * Log that a message was seen by an agent.
 * @param {string} userId UUID of the agent
 * @param {string} messageDialpadId Dialpad's unique ID for the message
 */
export async function logMessageSeen(userId, messageDialpadId) {
  try {
    await query(
      `INSERT INTO message_seen_logs (message_dialpad_id, user_id) 
       VALUES ($1, $2) 
       ON CONFLICT (message_dialpad_id, user_id) DO UPDATE SET seen_at = NOW()`,
      [messageDialpadId, userId]
    );
    
    // Also log a general activity event for the timeline
    await logActivity(userId, 'message_seen', { message_dialpad_id: messageDialpadId });
  } catch (err) {
    console.error('Failed to log message seen:', err);
  }
}

/**
 * Cleanup logs older than 60 days.
 */
export async function cleanupOldLogs() {
  try {
    const days = 60;
    await query("DELETE FROM agent_activity_logs WHERE created_at < NOW() - INTERVAL '60 days'");
    await query("DELETE FROM message_seen_logs WHERE seen_at < NOW() - INTERVAL '60 days'");
  } catch (err) {
    console.error('Failed to cleanup old logs:', err);
  }
}
