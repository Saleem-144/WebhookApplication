import { io } from 'socket.io-client';
import useNotificationStore from '@/store/notificationStore';

export const DIALPAD_SMS_DELTA_EVENT = 'dialpad:sms-delta';

export const DIALPAD_CALL_DELTA_EVENT = 'dialpad:call-delta';

/** Fired after a `new_notification` payload is merged into the store (bell + sound in Navbar). */
export const NEW_NOTIFICATION_ALERT_EVENT = 'dialpad:new-notification-alert';

let socket;
let started = false;
let firstConnect = true;

/**
 * Socket.IO to Express on 127.0.0.1:4000 (via env). Never proxied through Next.
 */
export function ensureDialpadRealtime() {
  if (typeof window === 'undefined' || started) return;

  const backendUrl = (
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    ''
  ).replace(/\/$/, '');

  if (!backendUrl) {
    if (process.env.NODE_ENV === 'development') {
      console.error(
        '[Dialpad realtime] Set NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:4000 in .env.local',
      );
    }
    return;
  }

  started = true;

  socket = io(backendUrl, {
    path: '/socket.io',
    // Try polling first, then upgrade to websocket
    transports: ['polling', 'websocket'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 10, // Limit attempts to prevent infinite loop flooding
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    extraHeaders: {
      "ngrok-skip-browser-warning": "true"
    },
    upgrade: true,
    rememberUpgrade: true,
    autoConnect: true,
  });

  const broadcastDelta = () => {
    window.dispatchEvent(new CustomEvent(DIALPAD_SMS_DELTA_EVENT));
  };

  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id, 'Transport:', socket.io.engine.transport.name);
    if (firstConnect) { 
      firstConnect = false; 
      return; 
    }
    // Reconnect after a drop — refresh data so nothing is missed
    broadcastDelta();
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
    broadcastDelta();
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('🔄 Reconnect attempt', attemptNumber);
  });

  socket.on('reconnect_error', (error) => {
    console.error('❌ Reconnect error:', error.message);
  });

  socket.on('reconnect_failed', () => {
    console.error('❌ Reconnection failed after max attempts');
    started = false;
  });

  socket.on('connect_error', (err) => {
    console.error('[Dialpad realtime] Connection error:', {
      message: err?.message || err,
      type: err?.type,
      description: err?.description,
      backendUrl
    });
  });

  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });

  // Monitor transport changes
  socket.io.engine.on('upgrade', (transport) => {
    console.log('🚀 Transport upgraded to:', transport.name);
  });

  socket.io.engine.on('upgradeError', (error) => {
    console.error('❌ Upgrade error:', error);
  });

  socket.on('dialpad_sms_delta', (data) => {
    window.dispatchEvent(
      new CustomEvent(DIALPAD_SMS_DELTA_EVENT, { detail: data || {} }),
    );
  });

  socket.on('dialpad_call_delta', (data) => {
    window.dispatchEvent(
      new CustomEvent(DIALPAD_CALL_DELTA_EVENT, { detail: data || {} }),
    );
  });

  socket.on('new_notification', (payload) => {
    const row = payload?.data;
    if (row) {
      useNotificationStore.getState().upsertFromServerRow(row);
      window.dispatchEvent(new CustomEvent(NEW_NOTIFICATION_ALERT_EVENT));
    }
  });
}
