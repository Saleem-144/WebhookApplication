import { query } from '../db/index.js';
import { emitNotification } from '../socket/emitters.js';
import { getSocketIo } from '../realtime/socketIoRef.js';
import { hasUpstashRest, upstashRest } from '../config/upstashRest.js';
import { normalizeDialpadSmsPayload } from './dialpadMessageUpsert.js';
import { normalizeToE164 } from '../utils/phoneNormalize.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

/**
 * Creates a notification in the DB and emits Socket.IO new_notification.
 * @param {object} params
 */
export const createNotification = async ({
  eventType,
  sourceType,
  sourceId,
  threadId,
  callId,
  previewText,
  meta = {},
}) => {
  const io = getSocketIo();
  try {
    const res = await query(
      `
      INSERT INTO notifications
        (event_type, source_type, source_id, thread_id, call_id, preview_text, meta)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *
      `,
      [
        eventType,
        sourceType,
        sourceId,
        threadId,
        callId,
        previewText,
        JSON.stringify(meta && typeof meta === 'object' ? meta : {}),
      ],
    );

    const notification = res.rows[0];
    emitNotification(io, notification);
    return notification;
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
};

const NOTIFY_DEDUP_PREFIX = 'notify:sms:';

/**
 * Inbound SMS: numbers that received the text (company lines) for filtering by Dialpad user.
 */
const recipientLineE164sFromRaw = (rawPayload) => {
  const p = normalizeDialpadSmsPayload(rawPayload);
  if (!p || typeof p !== 'object') return [];
  const set = new Set();
  const add = (v) => {
    const e = normalizeToE164(v);
    if (e) set.add(e);
  };
  if (Array.isArray(p.to_number)) {
    for (const t of p.to_number) add(t);
  }
  if (Array.isArray(p.to_numbers)) {
    for (const t of p.to_numbers) add(t);
  }
  add(p.to_number);
  add(p.target?.phone);
  add(p.target?.phone_number);
  return [...set];
};

/**
 * One in-app notification per Dialpad SMS id (deduped); inbound only.
 */
export const createInboundSmsNotificationIfNew = async (row) => {
  if (String(row.direction || '').toLowerCase() !== 'inbound') return;

  const dialpadId = row.dialpadId;
  if (!dialpadId) return;

  if (hasUpstashRest()) {
    try {
      const key = `${NOTIFY_DEDUP_PREFIX}${dialpadId}`;
      const set = await upstashRest.set(key, '1', { nx: true, ex: 172800 });
      if (set !== 'OK' && set !== true) return;
    } catch (err) {
      console.error('Notification dedup SET failed:', err.message);
    }
  }

  const threadKey = row.contactId ? `c:${row.contactId}` : `d:${dialpadId}`;
  const preview =
    (row.body && String(row.body).trim()) || 'New inbound SMS';
  const fromNum =
    row.rawPayload?.from_number != null
      ? String(row.rawPayload.from_number)
      : '';

  let label = 'SMS';
  const cId = String(row.contactId || '');
  const isNumericId = /^\d+$/.test(cId) && cId.length > 10;

  if (cId && !isNumericId) {
    label = cId;
  } else if (fromNum) {
    label = fromNum;
  }

  const recipientLineE164s = recipientLineE164sFromRaw(row.rawPayload);

  await createNotification({
    eventType: 'sms_inbound',
    sourceType: 'customer',
    sourceId: isUuid(row.contactId) ? row.contactId : null,
    threadId: null,
    callId: null,
    previewText: preview.slice(0, 500),
    meta: {
      thread_key: threadKey,
      label: String(label).slice(0, 120),
      dialpad_id: String(dialpadId),
      recipient_line_e164s: recipientLineE164s,
    },
  });
};

const NOTIFY_CALL_MISSED_PREFIX = 'notify:call:missed:';

/**
 * One in-app notification per missed call (Dialpad call_id), deduped.
 * @param {{ state: string, threadKey: string, contactName: string, dialpadCallId: string, targetPhone: string | null }} row
 */
export const createMissedCallNotificationIfNeeded = async (row) => {
  if (String(row.state || '').toLowerCase() !== 'missed') return;

  const dialpadCallId = row.dialpadCallId;
  if (!dialpadCallId) return;

  if (hasUpstashRest()) {
    try {
      const key = `${NOTIFY_CALL_MISSED_PREFIX}${dialpadCallId}`;
      const set = await upstashRest.set(key, '1', { nx: true, ex: 172800 });
      if (set !== 'OK' && set !== true) return;
    } catch (err) {
      console.error('Missed call notify dedup SET failed:', err.message);
    }
  }

  const label =
    row.contactName && String(row.contactName).trim()
      ? String(row.contactName).trim()
      : row.externalE164 || 'Missed call';
  const recipientLineE164s = row.targetPhone ? [row.targetPhone] : [];
  const dir = String(row.direction || '').toLowerCase();
  const previewText =
    dir === 'outbound'
      ? `No answer · ${label}`.slice(0, 500)
      : `Missed call from ${label}`.slice(0, 500);

  await createNotification({
    eventType: 'missed_call',
    sourceType: 'customer',
    sourceId: null,
    threadId: null,
    callId: null,
    previewText,
    meta: {
      thread_key: row.threadKey || '',
      label: String(label).slice(0, 120),
      dialpad_call_id: String(dialpadCallId),
      recipient_line_e164s: recipientLineE164s,
      peer_e164: row.externalE164 ? String(row.externalE164) : '',
    },
  });
};
