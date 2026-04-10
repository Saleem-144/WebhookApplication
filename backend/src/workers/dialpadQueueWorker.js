import { upstashRest, hasUpstashRest } from '../config/upstashRest.js';
import { query } from '../db/index.js';
import { upsertDialpadMessageFromPayload } from '../services/dialpadMessageUpsert.js';
import {
  upsertDialpadCallFromPayload,
  isDialpadCallPayload,
} from '../services/dialpadCallUpsert.js';
import { maybeScheduleTranscriptHydration } from '../services/dialpadTranscriptHydrate.js';
import {
  createInboundSmsNotificationIfNew,
  createMissedCallNotificationIfNeeded,
} from '../services/notification.js';
import {
  emitDialpadSmsDelta,
  emitDialpadCallDelta,
} from '../realtime/socketIoRef.js';
import { logDialpadCallWebhookPayload } from '../utils/dialpadCallWebhookLog.js';
import redis from '../config/redis.js';

const QUEUE_KEY = 'dialpad:event:queue';
const INTERVAL_MS = 750;

let timer = null;

/** Redis bridge for multi-node; otherwise emit directly from this process. */
const publishToSocketBridge = async (event, data) => {
  if (redis) {
    try {
      await redis.publish(
        'dialpad_events',
        JSON.stringify({ event, data }),
      );
      return;
    } catch (err) {
      console.error(`Redis publish ${event} failed:`, err.message);
    }
  }
  if (event === 'dialpad_call_delta') {
    emitDialpadCallDelta(data);
  } else {
    emitDialpadSmsDelta(data);
  }
};

export const processDialpadWebhookJob = async (job) => {
  const { webhookRowId, payload } = job;
  try {
    if (isDialpadCallPayload(payload)) {
      logDialpadCallWebhookPayload(payload);
      const callRow = await upsertDialpadCallFromPayload(payload);
      await createMissedCallNotificationIfNeeded(callRow);
      maybeScheduleTranscriptHydration(callRow);
      await publishToSocketBridge('dialpad_call_delta', {
        dialpad_call_id: callRow.dialpadCallId,
        thread_key: callRow.threadKey,
        state: callRow.state,
        direction: callRow.direction,
        external_e164: callRow.externalE164,
        external_number: callRow.externalNumber,
        internal_number: callRow.internalNumber,
        contact: callRow.contact,
        target: callRow.target,
      });
    } else {
      const row = await upsertDialpadMessageFromPayload(payload);
      await createInboundSmsNotificationIfNew(row);
      await publishToSocketBridge('dialpad_sms_delta', {
        dialpad_id: row.dialpadId,
        contact_id: row.contactId,
        status: row.status,
      });
    }
    if (webhookRowId) {
      await query(
        `
        UPDATE webhook_events
        SET processed = true, processed_at = NOW(), error_message = NULL
        WHERE id = $1
        `,
        [webhookRowId],
      );
    }
  } catch (err) {
    console.error('Dialpad queue worker error:', err.message);
    if (webhookRowId) {
      await query(
        `UPDATE webhook_events SET error_message = $1 WHERE id = $2`,
        [err.message.slice(0, 2000), webhookRowId],
      );
    }
  }
};

const processOne = async () => {
  if (!hasUpstashRest()) return;

  const raw = await upstashRest.rpop(QUEUE_KEY);
  if (raw == null || raw === '') return;

  /** Upstash may return an already-parsed object; String(obj) breaks JSON.parse. */
  let job;
  if (typeof raw === 'string') {
    try {
      job = JSON.parse(raw);
    } catch (err) {
      console.error('Dialpad queue: invalid JSON', err.message);
      return;
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    job = raw;
  } else {
    console.error('Dialpad queue: unexpected item type', typeof raw);
    return;
  }

  await processDialpadWebhookJob(job);
};

export const startDialpadQueueWorker = () => {
  if (!hasUpstashRest()) {
    console.warn('Dialpad queue worker not started (Upstash REST unset).');
    return;
  }
  if (timer) return;

  const tick = () => {
    processOne().catch((e) => console.error('Dialpad worker tick:', e));
  };

  timer = setInterval(tick, INTERVAL_MS);
  tick();
  console.log('Dialpad queue worker started (Upstash RPOP).');
};
