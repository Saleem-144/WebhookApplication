/**
 * Broadcasts a new message to all connected clients
 * @param {object} io - The Socket.IO server instance
 * @param {object} message - The message object to emit
 */
export const emitNewMessage = (io, message) => {
  if (!io) return;
  io.emit('new_message', {
    success: true,
    data: message
  });
};

/**
 * Broadcasts a call status update
 * @param {object} io - The Socket.IO server instance
 * @param {object} call - The call object with updated status
 */
export const emitCallUpdate = (io, call) => {
  if (!io) return;
  
  const event = call.status === 'ringing' || call.status === 'connected' 
    ? 'call_started' 
    : 'call_ended';
    
  io.emit(event, {
    success: true,
    data: call
  });
};

/**
 * Broadcasts an agent status change
 * @param {object} io - The Socket.IO server instance
 * @param {string} agentId - The ID of the agent
 * @param {string} status - The new status (available, busy, dnd, offline)
 */
export const emitAgentStatus = (io, agentId, status) => {
  if (!io) return;
  io.emit('agent_status', {
    success: true,
    data: { agentId, status }
  });
};

/**
 * Broadcasts a new in-app notification
 * @param {object} io - The Socket.IO server instance
 * @param {object} notification - The notification object
 */
export const emitNotification = (io, notification) => {
  if (!io) return;
  io.emit('new_notification', {
    success: true,
    data: notification
  });
};
