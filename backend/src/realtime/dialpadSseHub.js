import { EventEmitter } from 'events';

/** In-process fan-out for GET /api/dialpad/events/stream (single Node process). */
export const dialpadSseHub = new EventEmitter();
dialpadSseHub.setMaxListeners(200);

export const emitDialpadDelta = (payload) => {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  dialpadSseHub.emit('delta', str);
};
