import crypto from 'crypto';
import { query } from '../db/index.js';
import { upstashRest } from '../config/upstashRest.js';
import { emitDialpadDelta } from '../realtime/dialpadSseHub.js';
import { upsertContactFromEvent } from './contactService.js';

const CACHE_PREFIX = 'dialpad:messages:';
const CACHE_TTL_SEC = 30;

/**
 * Unwrap nested Dialpad webhook JWT when SMS fields live under `data` or `sms`.
 */
export const normalizeDialpadSmsPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  const hasTopLevelId =
    payload.id != null ||
    payload.event_id != null ||
    payload.message_id != null;
  const looksLikeSms =
    hasTopLevelId &&
    (payload.direction != null ||
      payload.contact != null ||
      payload.text != null ||
      payload.target != null);
  if (looksLikeSms) return payload;
  if (payload.data && typeof payload.data === 'object' && payload.data.id != null) {
    return payload.data;
  }
  if (payload.sms && typeof payload.sms === 'object' && payload.sms.id != null) {
    return payload.sms;
  }
  return payload;
};

/**
 * Call webhook payload (may be nested under `call` or `data`).
 * @returns {object | null}
 */
export const normalizeDialpadCallPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.call_id != null && payload.state != null) return payload;
  if (
    payload.call &&
    typeof payload.call === 'object' &&
    payload.call.call_id != null &&
    payload.call.state != null
  ) {
    return payload.call;
  }
  if (
    payload.data &&
    typeof payload.data === 'object' &&
    payload.data.call_id != null &&
    payload.data.state != null
  ) {
    return payload.data;
  }
  return null;
};

/**
 * Stable id for dedup + row key from Dialpad JWT payload.
 */
export const extractDialpadEventId = (payload) => {
  const callP = normalizeDialpadCallPayload(payload);
  if (callP) {
    const ts = Number(callP.event_timestamp ?? 0);
    return `call:${callP.call_id}:${String(callP.state)}:${ts}`;
  }
  const p = normalizeDialpadSmsPayload(payload);
  if (!p || typeof p !== 'object') return null;
  return (
    p.event_id ??
    p.id ??
    p.UUID ??
    p.message_id ??
    p.sms_id ??
    p.data?.id ??
    p.data?.message_id ??
    p.message?.id ??
    null
  );
};

/**
 * Dialpad SMS webhooks use `message_status` (sent | pending | delivered | failed | undelivered).
 * Delivery updates are only sent for every event if the SMS subscription was created with status=True;
 * otherwise many rows stay on `pending`. Inbound webhooks always mean the message was received.
 * `message_delivery_result: accepted` implies success even when `message_status` lags.
 */
export const resolveDialpadSmsStatus = (p, direction) => {
  const dir = String(direction || '').toLowerCase();
  let status =
    p.message_status ??
    p.status ??
    p.state ??
    p.data?.message_status ??
    p.data?.status ??
    'unknown';

  const delivery =
    p.message_delivery_result ?? p.data?.message_delivery_result ?? null;
  const deliveryLc = String(delivery || '').toLowerCase();
  let statusLc = String(status || '').toLowerCase();

  if (
    deliveryLc === 'accepted' &&
    (statusLc === 'pending' || statusLc === 'unknown')
  ) {
    status = 'delivered';
    statusLc = String(status).toLowerCase();
  }

  if (
    dir === 'inbound' &&
    (statusLc === 'pending' || statusLc === 'unknown' || status === '')
  ) {
    status = 'received';
  }

  return String(status);
};

const mapPayloadToRow = (payload) => {
  const p = normalizeDialpadSmsPayload(payload);
  const dialpadId = extractDialpadEventId(p);
  if (!dialpadId) return null;

  const callId =
    p.call_id ?? p.call?.id ?? p.call_id_str ?? null;
  const contactId =
    p.contact_id ??
    p.contact?.id ??
    p.customer_id ??
    p.target_id ??
    null;
  const direction = p.direction ?? p.data?.direction ?? null;
  const body =
    p.text ??
    p.body ??
    p.message?.text ??
    p.data?.text ??
    null;
  const status = resolveDialpadSmsStatus(p, direction);
  const fromNumber = p.from_number ?? p.contact?.phone ?? p.data?.from_number ?? null;
  const contactName = p.contact?.name ?? null;

  return {
    dialpadId: String(dialpadId),
    callId: callId != null ? String(callId) : null,
    contactId: contactId != null ? String(contactId) : null,
    direction: direction != null ? String(direction) : null,
    body: body != null ? String(body) : '',
    status: String(status),
    fromNumber,
    contactName,
    rawPayload: payload,
  };
};

/**
 * UPSERT dialpad_messages; skip no-op updates via WHERE IS DISTINCT FROM.
 */
export const upsertDialpadMessageFromPayload = async (payload) => {
  const row = mapPayloadToRow(payload);
  if (!row) {
    const fallback = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    throw new Error(`Cannot derive dialpad_id from payload (hash ${fallback.slice(0, 12)}…)`);
  }

  const rawJson = JSON.stringify(row.rawPayload);

  await query(
    `
    INSERT INTO dialpad_messages
      (dialpad_id, call_id, contact_id, direction, body, status, raw_payload)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7::jsonb)
    ON CONFLICT (dialpad_id) DO UPDATE SET
      call_id      = EXCLUDED.call_id,
      contact_id   = EXCLUDED.contact_id,
      direction    = EXCLUDED.direction,
      body         = EXCLUDED.body,
      status       = EXCLUDED.status,
      raw_payload  = EXCLUDED.raw_payload,
      updated_at   = NOW()
    WHERE
      dialpad_messages.status IS DISTINCT FROM EXCLUDED.status
      OR dialpad_messages.body IS DISTINCT FROM EXCLUDED.body
      OR dialpad_messages.raw_payload IS DISTINCT FROM EXCLUDED.raw_payload
    `,
    [
      row.dialpadId,
      row.callId,
      row.contactId,
      row.direction,
      row.body,
      row.status,
      rawJson,
    ],
  );

  if (row.contactId && upstashRest) {
    await upstashRest.del(`${CACHE_PREFIX}${row.contactId}`);
  }

  // CENTRALIZED CONTACT UPSERT
  if (row.fromNumber) {
    await upsertContactFromEvent(row.fromNumber, {
      name: row.contactName,
      dialpadId: row.contactId
    });
  }

  emitDialpadDelta({
    type: 'dialpad_message_upserted',
    dialpad_id: row.dialpadId,
    contact_id: row.contactId,
    status: row.status,
  });

  return row;
};

/**
 * Cache-aside read for recent messages by contact (optional UI helper).
 */
/**
 * Recent rows from webhook ingestion (newest first). For dashboard debugging / UI.
 */
export const listRecentDialpadMessages = async (limit = 50, before = null, threadKey = null, opts = {}) => {
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const slim = Boolean(opts.slim);
  // Extract from_number from top-level OR nested data/sms wrapper (Dialpad nests payloads sometimes)
  const fromNumberExpr = `COALESCE(
       raw_payload->>'from_number',
       raw_payload->'data'->>'from_number',
       raw_payload->'sms'->>'from_number',
       raw_payload->'contact'->>'phone',
       raw_payload->'data'->'contact'->>'phone'
     ) AS from_number`;
  // First outbound recipient (slim mode has no raw_payload JSON — without this, peer = from_number = agent line)
  const smsToFirstExpr = `COALESCE(
       raw_payload#>>'{to_numbers,0}',
       raw_payload#>>'{data,to_numbers,0}',
       raw_payload#>>'{sms,to_numbers,0}',
       raw_payload->>'to_number',
       raw_payload->'data'->>'to_number',
       raw_payload->'sms'->>'to_number',
       raw_payload->'target'->>'phone',
       raw_payload->'data'->'target'->>'phone'
     ) AS sms_to_first`;
  const selectCols = slim
    ? `dialpad_id, call_id, contact_id, direction, body, status,
       created_at, updated_at, ${fromNumberExpr}, ${smsToFirstExpr}`
    : `dialpad_id, call_id, contact_id, direction, body, status,
       created_at, updated_at, ${fromNumberExpr}, ${smsToFirstExpr},
       raw_payload`;
  let sql = `SELECT ${selectCols} FROM dialpad_messages WHERE 1=1`;
  const params = [];

  if (threadKey) {
    if (threadKey.startsWith('c:')) {
      sql += ` AND contact_id = $${params.length + 1}`;
      params.push(threadKey.slice(2));
    } else if (threadKey.startsWith('d:')) {
      sql += ` AND dialpad_id = $${params.length + 1}`;
      params.push(threadKey.slice(2));
    } else {
      sql += ` AND (contact_id = $${params.length + 1} OR dialpad_id = $${params.length + 1})`;
      params.push(threadKey);
    }
  }

  if (before) {
    sql += ` AND updated_at < $${params.length + 1}`;
    params.push(before);
  }

  sql += ` ORDER BY updated_at DESC LIMIT $${params.length + 1}`;
  params.push(cap);

  const { rows } = await query(sql, params);
  return rows.map((row) => {
    const raw = row.raw_payload;
    const payload = raw && typeof raw === 'object' ? raw : {};
    const inner = normalizeDialpadSmsPayload(payload);
    return {
      ...row,
      status: resolveDialpadSmsStatus(inner, row.direction),
    };
  });
};

export const getCachedMessagesForContact = async (contactId, limit = 50, before = null) => {
  if (!contactId) return [];

  const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
  let sql = `
    SELECT
      dialpad_id,
      call_id,
      contact_id,
      direction,
      body,
      status,
      created_at,
      updated_at,
      raw_payload
    FROM dialpad_messages
    WHERE contact_id = $1
  `;
  const params = [contactId];

  if (before) {
    sql += ` AND updated_at < $2`;
    params.push(before);
  }

  sql += ` ORDER BY updated_at DESC LIMIT $${params.length + 1 === 2 ? 2 : 3}`;
  params.push(cap);

  const { rows } = await query(sql, params);

  const mapped = rows.map((row) => {
    const raw = row.raw_payload;
    const payload =
      raw && typeof raw === 'object' ? raw : {};
    const inner = normalizeDialpadSmsPayload(payload);
    return {
      ...row,
      status: resolveDialpadSmsStatus(inner, row.direction),
    };
  });

  if (!upstashRest) {
    return mapped;
  }

  const key = `${CACHE_PREFIX}${contactId}`;
  const cached = await upstashRest.get(key);
  if (cached) {
    return typeof cached === 'string' ? JSON.parse(cached) : cached;
  }

  await upstashRest.set(key, JSON.stringify(mapped), { ex: CACHE_TTL_SEC });
  return mapped;
};
