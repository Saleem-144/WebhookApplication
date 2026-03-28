import { query } from '../db/index.js';
import { emitNotification } from '../socket/emitters.js';

/**
 * Creates a notification in the DB and emits it via Socket.IO
 * @param {object} io - Socket.IO instance
 * @param {object} params - Notification parameters
 */
export const createNotification = async (io, { eventType, sourceType, sourceId, threadId, callId, previewText }) => {
  try {
    const res = await query(
      `INSERT INTO notifications (event_type, source_type, source_id, thread_id, call_id, preview_text) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [eventType, sourceType, sourceId, threadId, callId, previewText]
    );
    
    const notification = res.rows[0];
    
    // Push real-time update
    emitNotification(io, notification);
    
    return notification;
  } catch (err) {
    console.error('Failed to create notification:', err);
    // Don't throw to avoid breaking the main webhook processing flow
  }
};
