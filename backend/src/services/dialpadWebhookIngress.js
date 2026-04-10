import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { upstashRest, hasUpstashRest } from '../config/upstashRest.js';
import { extractDialpadEventId } from './dialpadMessageUpsert.js';

const DEDUP_PREFIX = 'dialpad:event:';
const DEDUP_TTL_SEC = 86400;
const QUEUE_KEY = 'dialpad:event:queue';

/**
 * Verify Dialpad webhook: with a shared secret, body is a JWT (HS256). Without secret, JSON body.
 */
export const verifyDialpadWebhookBody = (rawUtf8, secret) => {
  const trimmed = rawUtf8.trim();
  const allowUnsigned =
    process.env.NODE_ENV === 'development' &&
    process.env.DIALPAD_ALLOW_UNSIGNED_WEBHOOK === 'true';

  if (!secret?.trim()) {
    if (allowUnsigned) {
      return JSON.parse(trimmed);
    }
    throw new Error('DIALPAD_WEBHOOK_SECRET is not configured');
  }

  try {
    return jwt.verify(trimmed, secret.trim(), { algorithms: ['HS256'] });
  } catch (err) {
    if (allowUnsigned) {
      try {
        return JSON.parse(trimmed);
      } catch {
        /* fall through */
      }
    }
    throw new Error('Invalid webhook JWT signature');
  }
};

/**
 * Atomic dedup: SET only if absent. Returns true if this is the first time we see eventId.
 */
export const claimEventIdForProcessing = async (eventId) => {
  if (!hasUpstashRest()) {
    return true;
  }
  try {
    const key = `${DEDUP_PREFIX}${eventId}`;
    const set = await upstashRest.set(key, '1', { nx: true, ex: DEDUP_TTL_SEC });
    // Redis SET NX: "OK" if set; null if key already exists.
    if (set === 'OK' || set === true) return true;
    if (set === null) return false;
    if (set === undefined || set === '') {
      console.warn('Dialpad dedup SET empty/undefined; fail-open');
      return true;
    }
    console.warn(
      'Dialpad dedup SET returned unexpected value; allowing processing:',
      set,
    );
    return true;
  } catch (err) {
    console.error('Dialpad dedup SET failed (fail-open, may duplicate):', err.message);
    return true;
  }
};

export const enqueueDialpadPayload = async (job) => {
  if (!hasUpstashRest()) {
    return false;
  }
  try {
    await upstashRest.lpush(QUEUE_KEY, JSON.stringify(job));
    return true;
  } catch (err) {
    console.error('Dialpad queue LPUSH failed; will process inline:', err.message);
    return false;
  }
};

/**
 * Persist raw inbound, verify, dedup, queue. Returns { status, duplicate?, queued? }.
 */
export const ingestDialpadWebhook = async (rawBuffer) => {
  const rawUtf8 = rawBuffer.toString('utf8');
  const rawPreview = rawUtf8.length > 500_000 ? rawUtf8.slice(0, 500_000) : rawUtf8;

  const insert = await query(
    `
    INSERT INTO webhook_events (event_type, dialpad_event_id, raw_payload, processed)
    VALUES ($1, $2, $3::jsonb, false)
    RETURNING id
    `,
    [
      'dialpad_inbound_raw',
      null,
      JSON.stringify({ body: rawPreview }),
    ],
  );

  const webhookRowId = insert.rows[0].id;
  const secret = process.env.DIALPAD_WEBHOOK_SECRET;

  let payload;
  try {
    payload = verifyDialpadWebhookBody(rawUtf8, secret);
  } catch (err) {
    await query(
      `UPDATE webhook_events SET error_message = $1 WHERE id = $2`,
      [err.message, webhookRowId],
    );
    throw err;
  }

  const eventId = extractDialpadEventId(payload);
  if (!eventId) {
    const msg = 'Payload missing event id (event_id / id / message_id / data.id)';
    await query(`UPDATE webhook_events SET error_message = $1 WHERE id = $2`, [msg, webhookRowId]);
    throw new Error(msg);
  }

  const eventType =
    payload.event ?? payload.type ?? payload.name ?? 'dialpad_unknown';

  await query(
    `
    UPDATE webhook_events
    SET event_type = $1, dialpad_event_id = $2, raw_payload = raw_payload || $3::jsonb
    WHERE id = $4
    `,
    [
      String(eventType).slice(0, 100),
      String(eventId).slice(0, 200),
      JSON.stringify({ decoded: payload }),
      webhookRowId,
    ],
  );

  const firstDelivery = await claimEventIdForProcessing(String(eventId));
  if (!firstDelivery) {
    await query(
      `UPDATE webhook_events SET processed = true, processed_at = NOW(), error_message = $1 WHERE id = $2`,
      ['duplicate_event_id', webhookRowId],
    );
    return { status: 'duplicate', webhookRowId };
  }

  const queued = await enqueueDialpadPayload({
    webhookRowId,
    payload,
    eventId: String(eventId),
  });

  if (!queued) {
    return { status: 'accepted_no_queue', webhookRowId, payload };
  }

  return { status: 'queued', webhookRowId, payload };
};
