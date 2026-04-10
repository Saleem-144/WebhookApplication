import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { hasUpstashRest } from '../config/upstashRest.js';
import {
  getCachedMessagesForContact,
  listRecentDialpadMessages,
} from '../services/dialpadMessageUpsert.js';
import {
  listRecentDialpadCalls,
  getDialpadCallById,
} from '../services/dialpadCallUpsert.js';
import { fetchDialpadTranscriptAndStore } from '../services/dialpadTranscriptHydrate.js';
import { dialpadFetch } from '../services/dialpadApiFetch.js';
import { dialpadSseHub } from '../realtime/dialpadSseHub.js';
import { normalizeToE164 } from '../utils/phoneNormalize.js';
import { logActivity } from '../services/loggerService.js';

const router = express.Router();

router.get('/users', protect, async (req, res) => {
  try {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (v != null && v !== '') qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const r = await dialpadFetch(`/api/v2/users${suffix}`);
    if (!r.ok) {
      const msg =
        (r.data && (r.data.error || r.data.message)) ||
        `Dialpad users error (${r.status})`;
      return res.status(r.status >= 400 && r.status < 600 ? r.status : 502).json({
        success: false,
        error: typeof msg === 'string' ? msg : JSON.stringify(msg),
        dialpad: r.data,
      });
    }
    return res.json(r.data);
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ success: false, error: err.message });
  }
});

router.get('/offices', protect, async (req, res) => {
  try {
    const r = await dialpadFetch('/api/v2/offices');
    if (!r.ok) {
      const msg = (r.data && (r.data.error || r.data.message)) || `Dialpad offices error (${r.status})`;
      return res.status(r.status >= 400 && r.status < 600 ? r.status : 502).json({
        success: false,
        error: typeof msg === 'string' ? msg : JSON.stringify(msg),
        dialpad: r.data,
      });
    }
    return res.json(r.data);
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ success: false, error: err.message });
  }
});

router.get('/contacts', protect, async (req, res) => {
  try {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (v != null && v !== '') qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const r = await dialpadFetch(`/api/v2/contacts${suffix}`);
    return res.status(r.status).json(r.data);
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ success: false, error: err.message });
  }
});

const DIALPAD_MEDIA_MAX_BYTES = 500 * 1024;

router.post('/sms', protect, async (req, res) => {
  try {
    const body =
      req.body && typeof req.body === 'object' ? { ...req.body } : {};

    if (body.infer_country_code === undefined) {
      body.infer_country_code = false;
    }

    const fromEnv = process.env.DIALPAD_SMS_FROM_NUMBER?.trim();
    if (!String(body.from_number || '').trim() && fromEnv) {
      body.from_number = fromEnv;
    }

    if (!String(body.from_number || '').trim()) {
      return res.status(400).json({
        success: false,
        error:
          'from_number is required (set DIALPAD_SMS_FROM_NUMBER in backend .env or pass from_number).',
        code: 'MISSING_FROM_NUMBER',
      });
    }

    if (!Array.isArray(body.to_numbers) || body.to_numbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'to_numbers must be a non-empty array (E.164).',
        code: 'MISSING_TO_NUMBERS',
      });
    }

    if (body.media != null && typeof body.media === 'string') {
      const approxBytes = Math.floor((body.media.length * 3) / 4);
      if (approxBytes > DIALPAD_MEDIA_MAX_BYTES) {
        return res.status(400).json({
          success: false,
          error: `Media exceeds Dialpad limit (${DIALPAD_MEDIA_MAX_BYTES} bytes raw).`,
          code: 'MEDIA_TOO_LARGE',
        });
      }
    }

    if (body.text == null) {
      body.text = '';
    }

    const r = await dialpadFetch('/api/v2/sms', {
      method: 'POST',
      body: JSON.stringify(body),
    }, 3);

    if (!r.ok) {
      const errMsg =
        (r.data &&
          (r.data.error || r.data.message || r.data.detail || r.data.title)) ||
        `Dialpad returned ${r.status}`;
      const msg =
        typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg);
      const status =
        r.status >= 400 && r.status < 600 ? r.status : 502;
      return res.status(status).json({
        success: false,
        error: msg,
        dialpad: r.data,
      });
    }

    // Log message activity for supervisor
    logActivity(req.user.id, 'message_sent', {
      to: body.to_numbers,
      textPreview: (body.text || '').slice(0, 100),
      from: body.from_number,
    });

    return res.json({ success: true, data: r.data });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ success: false, error: err.message });
  }
});

router.get('/messages/cache/:contactId', protect, async (req, res) => {
  try {
    const rows = await getCachedMessagesForContact(req.params.contactId);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Superadmin: inspect whether webhooks hit the DB and if processing failed.
 * GET /api/dialpad/debug/webhook-pipeline?limit=20
 */
router.get('/debug/webhook-pipeline', protect, restrictTo('superadmin'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const { rows: events } = await query(
      `
      SELECT id, event_type, dialpad_event_id, processed, error_message, received_at
      FROM webhook_events
      ORDER BY received_at DESC
      LIMIT $1
      `,
      [limit],
    );
    const { rows: countRows } = await query(
      'SELECT COUNT(*)::int AS n FROM dialpad_messages',
    );
    return res.json({
      success: true,
      data: {
        upstashRestConfigured: hasUpstashRest(),
        dialpadMessagesCount: countRows[0]?.n ?? 0,
        recentWebhookEvents: events,
        checklist: [
          'Webhook URL in Dialpad must be your public base + /api/webhooks/dialpad (e.g. ngrok → Next :3000).',
          'DIALPAD_WEBHOOK_SECRET must match the secret on the Dialpad webhook (JWT HS256).',
          'Create an SMS event subscription (API /api/v2/subscriptions/sms) tied to that webhook.',
          'For calls: POST /api/v2/subscriptions/call with call_states connected, hangup, missed, call_transcription → same webhook.',
          'Run migration 006_dialpad_calls.sql so dialpad_calls exists.',
          'If recentWebhookEvents is empty, requests are not reaching this server or wrong DATABASE_URL.',
          'If error_message is Invalid webhook JWT, the secret is wrong.',
          'If rows appear here but dialpad_messages stays 0, check backend console for worker/upsert errors.',
        ],
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** Recent SMS rows stored from Dialpad webhooks (newest first). */
router.get('/messages/ingested', protect, async (req, res) => {
  try {
    const slim = req.query.slim === '1';
    const rows = await listRecentDialpadMessages(
      req.query.limit,
      req.query.before,
      req.query.threadKey,
      { slim },
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Outbound call: rings Dialpad user devices (POST /api/v2/call).
 * Body: { user_id, phone_number, outbound_caller_id?, custom_data? }
 */
// Outbound Dialpad calls: agents only (admin/superadmin cannot initiate calls from policy).
router.post('/call', protect, restrictTo('agent'), async (req, res) => {
  try {
    const body =
      req.body && typeof req.body === 'object' ? { ...req.body } : {};
    const userId = body.user_id ?? body.userId;
    const phoneNumber = body.phone_number ?? body.phoneNumber;
    if (userId === undefined || userId === null || String(userId).trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'user_id is required (Dialpad company user id).',
        code: 'MISSING_USER_ID',
      });
    }
    if (!String(phoneNumber || '').trim()) {
      return res.status(400).json({
        success: false,
        error: 'phone_number is required (E.164).',
        code: 'MISSING_PHONE_NUMBER',
      });
    }

    const rawPhone = String(phoneNumber).trim();
    const e164 = normalizeToE164(rawPhone);
    const dialpadPhone = e164 || rawPhone;
    if (!dialpadPhone.startsWith('+')) {
      return res.status(400).json({
        success: false,
        error:
          'phone_number must be E.164 (e.g. +15551234567). Add country code or + prefix.',
        code: 'INVALID_PHONE_E164',
      });
    }

    const dialpadBody = {
      user_id: typeof userId === 'string' ? Number(userId) || userId : userId,
      phone_number: dialpadPhone,
    };
    if (body.outbound_caller_id != null && body.outbound_caller_id !== '') {
      const oc = String(body.outbound_caller_id).trim();
      const ocE164 = normalizeToE164(oc);
      dialpadBody.outbound_caller_id = ocE164 || oc;
    }
    if (body.custom_data != null && body.custom_data !== '') {
      dialpadBody.custom_data = String(body.custom_data).slice(0, 2000);
    }

    const r = await dialpadFetch('/api/v2/call', {
      method: 'POST',
      body: JSON.stringify(dialpadBody),
    });

    if (!r.ok) {
      const errMsg =
        (r.data &&
          (r.data.error || r.data.message || r.data.detail || r.data.title)) ||
        `Dialpad returned ${r.status}`;
      const msg =
        typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg);
      const status =
        r.status >= 400 && r.status < 600 ? r.status : 502;
      return res.status(status).json({
        success: false,
        error: msg,
        dialpad: r.data,
      });
    }

    return res.json({ success: true, data: r.data });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ success: false, error: err.message });
  }
});

/** Recent call rows from Dialpad call webhooks. */
router.get('/calls/ingested', protect, async (req, res) => {
  try {
    const slim = req.query.slim === '1';
    const rows = await listRecentDialpadCalls(
      req.query.limit,
      req.query.before,
      req.query.threadKey,
      { slim },
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** Single ingested call row (for live outbound status polling). */
router.get('/calls/by-id/:callId', protect, async (req, res) => {
  try {
    const callId = String(req.params.callId || '').trim();
    if (!callId) {
      return res.status(400).json({
        success: false,
        error: 'callId is required',
      });
    }
    const row = await getDialpadCallById(callId);
    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'Call not found yet (wait for first webhook).',
        code: 'NOT_FOUND',
      });
    }
    return res.json({ success: true, data: row });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET Dialpad call transcript (GET /api/v2/transcripts/{call_id}) and persist text.
 */
router.get('/calls/:callId/transcript', protect, async (req, res) => {
  try {
    const callId = String(req.params.callId || '').trim();
    if (!callId) {
      return res.status(400).json({
        success: false,
        error: 'callId is required',
      });
    }

    const forceRefresh =
      req.query.refresh === '1' ||
      req.query.force === '1' ||
      String(req.query.revalidate || '') === '1';

    const result = await fetchDialpadTranscriptAndStore(callId, {
      forceRefresh,
    });
    if (!result.ok) {
      return res.status(result.status || 502).json({
        success: false,
        error: result.error,
        dialpad: result.data,
      });
    }

    return res.json({
      success: true,
      data: result.data,
      transcription_text: result.transcription_text,
    });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ success: false, error: err.message });
  }
});

router.get('/events/stream', protect, (req, res) => {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const onDelta = (payload) => {
    res.write(`data: ${payload}\n\n`);
  };

  dialpadSseHub.on('delta', onDelta);
  const ping = setInterval(() => {
    res.write(`:ping ${Date.now()}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    dialpadSseHub.off('delta', onDelta);
  });

  res.write(':connected\n\n');
});

export default router;
