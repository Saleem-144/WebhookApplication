import axios from 'axios';
import { getBackendBase } from './server/backendBase';

const resolveSsrApiBase = () => {
  const explicit =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL;
  const t = (explicit || '').trim().replace(/\/$/, '');
  if (t) return t;
  return getBackendBase();
};

/**
 * Browser: same-origin `/api` + `/uploads` so Set-Cookie is first-party on the Next host
 * (avoids cross-origin cookie issues for localhost vs 127.0.0.1).
 * SSR: INTERNAL_API_URL → NEXT_PUBLIC_API_URL → NEXT_PUBLIC_BACKEND_URL → BACKEND_URL (getBackendBase).
 */
const baseURL =
  typeof window !== 'undefined' ? window.location.origin : resolveSsrApiBase();

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * @param {string} email
 * @param {string} password
 */
export const loginRequest = async (email, password) => {
  const { data } = await api.post('/api/auth/login', { email, password });
  return data;
};

export const logoutRequest = async () => {
  const { data } = await api.post('/api/auth/logout');
  return data;
};

export const fetchMe = async () => {
  const res = await api.get('/api/auth/me', {
    validateStatus: (status) => status === 200 || status === 401,
  });
  if (res.status === 401) {
    return {
      success: false,
      error: res.data?.error ?? 'Unauthorized',
      code: res.data?.code ?? 'UNAUTHORIZED',
    };
  }
  return res.data;
};

export const fetchStatsSummary = async () => {
  const { data } = await api.get('/api/stats/summary');
  return data;
};

export const fetchOffices = async () => {
  const { data } = await api.get('/api/stats/offices');
  return data;
};

/**
 * @param {string} officeId
 */
export const fetchDepartmentsByOffice = async (officeId) => {
  const { data } = await api.get('/api/stats/departments', {
    params: { office_id: officeId },
  });
  return data;
};

/**
 * @param {string} officeId
 */
export const fetchAgentsByOffice = async (officeId) => {
  const { data } = await api.get('/api/stats/agents', {
    params: { office_id: officeId },
  });
  return data;
};

/**
 * SMS rows ingested from Dialpad webhooks (`dialpad_messages`), newest first.
 * @param {{ limit?: number, before?: string, threadKey?: string }} [opts]
 */
export const fetchIngestedDialpadMessages = async (opts = {}) => {
  const { data } = await api.get('/api/dialpad/messages/ingested', {
    params: {
      limit: opts.limit ?? 100,
      before: opts.before ?? undefined,
      threadKey: opts.threadKey ?? undefined,
      slim: opts.slim !== false ? '1' : undefined,
    },
  });
  return data;
};

/**
 * Dialpad company users (agents). Response shape: { items: [...] } from /api/v2/users.
 */
export const fetchDialpadUsers = async (opts = {}) => {
  const { data } = await api.get('/api/dialpad/users', {
    params: opts.params || {},
  });
  return data;
};

export const fetchDialpadOffices = async () => {
  const { data } = await api.get('/api/dialpad/offices');
  return data;
};

/**
 * Outbound SMS/MMS via Dialpad API v2 (backend adds from_number from env if omitted).
 * @param {Record<string, unknown>} payload infer_country_code, to_numbers, text, media? (base64)
 */
export const sendDialpadSms = async (payload) => {
  const { data } = await api.post('/api/dialpad/sms', payload);
  return data;
};

/** Recent rows from Dialpad call webhooks (`dialpad_calls`). */
export const fetchIngestedDialpadCalls = async (opts = {}) => {
  const { data } = await api.get('/api/dialpad/calls/ingested', {
    params: {
      limit: opts.limit ?? 100,
      before: opts.before ?? undefined,
      threadKey: opts.threadKey ?? undefined,
      slim: opts.slim !== false ? '1' : undefined,
    },
  });
  return data;
};

/** One row from `dialpad_calls` by Dialpad `call_id` (webhook-ingested). */
export const fetchDialpadIngestedCallById = async (callId) => {
  const { data } = await api.get(
    `/api/dialpad/calls/by-id/${encodeURIComponent(String(callId))}`,
    { validateStatus: (s) => (s >= 200 && s < 300) || s === 404 },
  );
  return data;
};

/**
 * Ring Dialpad user devices toward an E.164 number (POST /api/v2/call).
 * @param {{ user_id: string|number, phone_number: string, outbound_caller_id?: string }} payload
 */
export const initiateDialpadCall = async (payload) => {
  const res = await api.post('/api/dialpad/call', payload, {
    validateStatus: () => true,
  });
  return res.data;
};

/**
 * GET /api/v2/transcripts/{call_id} via backend; persists `transcription_text` on `dialpad_calls`.
 * @param {string} callId Dialpad call id (string — keep bigint ids as strings).
 * @param {{ refresh?: boolean }} [opts] refresh=true → skip DB cache, re-fetch from Dialpad (?refresh=1).
 */
export const fetchDialpadCallTranscript = async (callId, opts = {}) => {
  const params = {};
  if (opts.refresh) params.refresh = '1';
  const res = await api.get(
    `/api/dialpad/calls/${encodeURIComponent(String(callId))}/transcript`,
    { validateStatus: () => true, params },
  );
  return res.data;
};

/** Superadmin only — recent webhook_events + dialpad_messages count. */
export const fetchDialpadWebhookPipelineDebug = async (opts = {}) => {
  const { data } = await api.get('/api/dialpad/debug/webhook-pipeline', {
    params: { limit: opts.limit ?? 20 },
  });
  return data;
};

export const fetchNotifications = async (opts = {}) => {
  const { data } = await api.get('/api/notifications', {
    params: { limit: opts.limit ?? 80 },
  });
  return data;
};

export const markNotificationReadApi = async (id) => {
  const { data } = await api.patch(`/api/notifications/${id}/read`);
  return data;
};

export const markAllNotificationsReadApi = async () => {
  const { data } = await api.post('/api/notifications/read-all');
  return data;
};

/**
 * Mark unread notifications for one SMS thread (meta.thread_key) as read.
 * @param {string} threadKey e.g. c:contactId or d:dialpadId
 */
export const markNotificationsReadByThreadKeyApi = async (threadKey) => {
  const { data } = await api.post('/api/notifications/read-by-thread', {
    thread_key: threadKey,
  });
  return data;
};

/** Remove one notification from the bell dropdown only (stays in Inbox). */
export const dismissNotificationFromPopupApi = async (id) => {
  const { data } = await api.patch(`/api/notifications/${id}/dismiss-popup`);
  return data;
};

/** Clear the bell dropdown list; Inbox unchanged. */
export const dismissAllNotificationsFromPopupApi = async () => {
  const { data } = await api.post('/api/notifications/dismiss-popup-all');
  return data;
};

export const patchProfile = async (name) => {
  const { data } = await api.patch('/api/auth/profile', { name });
  return data;
};

export const changePasswordRequest = async (currentPassword, newPassword) => {
  const { data } = await api.post('/api/auth/change-password', {
    currentPassword,
    newPassword,
  });
  return data;
};

export const fetchUsers = async () => {
  const { data } = await api.get('/api/users');
  return data;
};

export const createUserRequest = async (payload) => {
  const { data } = await api.post('/api/users', payload);
  return data;
};

export const deleteUserRequest = async (userId) => {
  const { data } = await api.delete(`/api/users/${userId}`);
  return data;
};

/**
 * @param {File} file
 */
export const uploadAvatarRequest = async (file) => {
  const form = new FormData();
  form.append('avatar', file);
  const { data } = await api.post('/api/auth/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

/**
 * GET /api/contacts
 * Query: search, limit, offset, linePhoneNumber
 */
export const fetchContacts = async (search = '', linePhoneNumber = null) => {
  const { data } = await api.get('/api/contacts', {
    params: { search, linePhoneNumber }
  });
  return data;
};

/**
 * PUT /api/contacts/:id
 * Body: name, email
 */
export const updateContactApi = async (id, payload) => {
  const { data } = await api.put(`/api/contacts/${id}`, payload);
  return data;
};

/**
 * POST /api/contacts/sync
 * Body: { [id]: name }
 */
export const syncContactsApi = async (customNames) => {
  const { data } = await api.post('/api/contacts/sync', customNames);
  return data;
};

/**
 * DELETE /api/contacts/:id
 */
export const deleteContactApi = async (id) => {
  const { data } = await api.delete(`/api/contacts/${id}`);
  return data;
};

/* --- SUPERVISION LOGS --- */

export const fetchAgentSummaries = async () => {
  const { data } = await api.get('/api/logs/agent-summaries');
  return data;
};

export const fetchAgentLogs = async (userId) => {
  const { data } = await api.get(`/api/logs/agent/${userId}`);
  return data;
};

export const trackMessageSeen = async (dialpadId) => {
  const { data } = await api.post('/api/logs/seen', { dialpadId, type: 'message' });
  return data;
};

export const trackConversationOpened = async (threadKey) => {
  const { data } = await api.post('/api/logs/seen', { threadKey, type: 'thread' });
  return data;
};

export const fetchMessageSeenBy = async (dialpadId) => {
  const { data } = await api.get(`/api/logs/seen-by/${dialpadId}`);
  return data;
};
