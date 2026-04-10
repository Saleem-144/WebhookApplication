import { query } from '../db/index.js';
import { emitDialpadDelta } from '../realtime/dialpadSseHub.js';
import { normalizeDialpadCallPayload } from './dialpadMessageUpsert.js';
import { filterFormattedDialpadTranscriptPlaintext } from '../utils/dialpadTranscriptLineFilter.js';
import { normalizeToE164 } from '../utils/phoneNormalize.js';
import { isDialpadTranscriptPlaceholderText } from '../utils/transcriptPlaceholder.js';
import { upsertContactFromEvent } from './contactService.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

const CALL_WEBHOOK_STATE_HINTS = new Set([
  'connected',
  'hangup',
  'missed',
  'call_transcription',
  'ringing',
  'calling',
  'hold',
  'takeover',
  'voicemail',
  'recording',
  'transcription',
  'csat',
  'disposition',
  'recap_summary',
]);

/**
 * True when this webhook is a Dialpad call event (not SMS).
 * SMS payloads may include call_id; we require call lifecycle fields.
 */
export const isDialpadCallPayload = (payload) => {
  const p = normalizeDialpadCallPayload(payload);
  if (!p || p.call_id == null || p.state == null) return false;
  const st = String(p.state).toLowerCase();
  if (CALL_WEBHOOK_STATE_HINTS.has(st)) return true;
  return (
    p.external_number != null &&
    p.direction != null &&
    p.target != null &&
    typeof p.target === 'object'
  );
};

const threadKeyFromCall = (p) => {
  const ext = normalizeToE164(p.external_number || p.contact?.phone);
  const cid = p.contact?.id;
  if (cid != null && isUuid(String(cid))) {
    return `c:${cid}`;
  }
  if (ext) {
    return `phone:${ext}`;
  }
  return `call:${p.call_id}`;
};

const contactIdText = (p) => {
  const cid = p.contact?.id;
  return cid != null ? String(cid) : null;
};

const mergeRawPayload = (prevRaw, p) => {
  const base =
    prevRaw && typeof prevRaw === 'object' && !Array.isArray(prevRaw)
      ? prevRaw
      : {};
  const states =
    base.states && typeof base.states === 'object' ? { ...base.states } : {};
  states[String(p.state)] = p;
  return { ...base, states, latest: p };
};

/** Max ring time (ms) below which unanswered inbound hangup → `declined`; at/above → `missed`. */
const declineMaxRingMs = () => {
  const raw = process.env.DIALPAD_DECLINE_MAX_RING_MS;
  const n = raw != null && String(raw).trim() !== '' ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 1000 && n <= 180_000) return n;
  return 12_000;
};

const effectiveTalkDurationMs = (merged) => {
  const d = Number(merged.duration_ms ?? 0);
  const t = Number(merged.total_duration_ms ?? 0);
  if (Number.isFinite(d) && d > 0) return d;
  if (Number.isFinite(t) && t > 0) return t;
  return 0;
};

const hasPositiveDateConnected = (merged) => {
  const dc = Number(merged.date_connected ?? 0);
  return Number.isFinite(dc) && dc > 0;
};

/** Ringing window from Dialpad timestamps (epoch ms). */
const ringDurationMsFromMerged = (merged) => {
  const end = Number(merged.date_ended ?? 0);
  const rang = Number(merged.date_rang ?? 0);
  if (!Number.isFinite(end) || !Number.isFinite(rang) || end <= 0 || rang <= 0) {
    return null;
  }
  const ms = end - rang;
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms;
};

/**
 * Normalize Dialpad `hangup` into stored outcomes:
 * - duration/talk > 0 → `hangup` (real call ended)
 * - date_connected set, 0 duration → `hangup` (brief connect)
 * - else unanswered: inbound uses date_ended - date_rang vs threshold → `declined` | `missed`
 * - outbound: same ring heuristic (short ring ≈ callee rejected, long ≈ no answer)
 * Dialpad `missed` events always → `missed`.
 */
const reconcileStoredCallState = (merged, rawPayload) => {
  const states =
    rawPayload?.states && typeof rawPayload.states === 'object'
      ? rawPayload.states
      : {};
  const stateKeys = Object.keys(states).map((k) => String(k).toLowerCase());
  const hadMissedEvent = stateKeys.includes('missed');
  const hadConnectedEvent = stateKeys.includes('connected');
  const wasConnected =
    hadConnectedEvent || hasPositiveDateConnected(merged);
  const latest = String(merged.state || '').toLowerCase();

  if (wasConnected) {
    return merged.state;
  }

  if (hadMissedEvent || latest === 'missed') {
    return 'missed';
  }

  if (latest !== 'hangup') {
    return merged.state;
  }

  const talk = effectiveTalkDurationMs(merged);
  if (talk > 0) {
    return 'hangup';
  }

  if (hasPositiveDateConnected(merged)) {
    return 'hangup';
  }

  const ringMs = ringDurationMsFromMerged(merged);
  if (ringMs == null) {
    return 'missed';
  }

  const dir = String(merged.direction || '').toLowerCase();
  if (dir === 'inbound') {
    return ringMs < declineMaxRingMs() ? 'declined' : 'missed';
  }

  if (dir === 'outbound') {
    return ringMs < declineMaxRingMs() ? 'declined' : 'missed';
  }

  return ringMs < declineMaxRingMs() ? 'declined' : 'missed';
};

/**
 * Merge scalar / JSON fields: prefer newer event_timestamp; fill gaps from older rows.
 */
const mergeCallRow = (prev, p) => {
  const prevTs = Number(prev?.event_timestamp ?? 0);
  const nextTs = Number(p.event_timestamp ?? 0);
  const newer = nextTs >= prevTs;

  const pickNum = (n, o) => {
    if (n != null && newer) return Number(n);
    if (n != null && o == null) return Number(n);
    return o != null ? Number(o) : n != null ? Number(n) : null;
  };

  /**
   * Hangup events may send duration 0 while an earlier state had real talk time.
   * Keep the larger positive value so transcript hydration still runs.
   */
  const mergeDurationMs = (incoming, prevMs) => {
    const inc =
      incoming?.duration != null
        ? Number(incoming.duration)
        : incoming?.duration_ms != null
          ? Number(incoming.duration_ms)
          : NaN;
    const prv = prevMs != null ? Number(prevMs) : NaN;
    const iOk = Number.isFinite(inc) && inc > 0;
    const pOk = Number.isFinite(prv) && prv > 0;
    if (iOk && pOk) return Math.max(inc, prv);
    if (iOk) return inc;
    if (pOk) return prv;
    if (Number.isFinite(inc) && newer) return inc;
    return Number.isFinite(prv) ? prv : Number.isFinite(inc) ? inc : null;
  };

  const mergeTotalDurationMs = (incoming, prevMs) => {
    const inc =
      incoming?.total_duration != null
        ? Number(incoming.total_duration)
        : incoming?.total_duration_ms != null
          ? Number(incoming.total_duration_ms)
          : NaN;
    const prv = prevMs != null ? Number(prevMs) : NaN;
    const iOk = Number.isFinite(inc) && inc > 0;
    const pOk = Number.isFinite(prv) && prv > 0;
    if (iOk && pOk) return Math.max(inc, prv);
    if (iOk) return inc;
    if (pOk) return prv;
    if (Number.isFinite(inc) && newer) return inc;
    return Number.isFinite(prv) ? prv : Number.isFinite(inc) ? inc : null;
  };

  const pickStr = (n, o) => {
    const ns = n != null ? String(n) : '';
    const os = o != null ? String(o) : '';
    if (ns !== '' && newer) return ns;
    if (ns !== '' && os === '') return ns;
    return os !== '' ? os : ns || null;
  };

  const prevContact =
    prev?.contact && typeof prev.contact === 'object' ? prev.contact : {};
  const prevTarget =
    prev?.target && typeof prev.target === 'object' ? prev.target : {};

  const contact =
    newer && p.contact && typeof p.contact === 'object'
      ? p.contact
      : Object.keys(prevContact).length
        ? prevContact
        : p.contact && typeof p.contact === 'object'
          ? p.contact
          : {};

  const target =
    newer && p.target && typeof p.target === 'object'
      ? p.target
      : Object.keys(prevTarget).length
        ? prevTarget
        : p.target && typeof p.target === 'object'
          ? p.target
          : {};

  // Bug 2 fix: new-call states must clear any stale transcript from a prior call
  const incomingState = String(p.state || '').toLowerCase();
  const isNewCallState = ['calling', 'ringing', 'connected'].includes(incomingState);

  let tx;
  if (isNewCallState) {
    // Force null — there cannot be a transcript yet for a call that just started
    tx = null;
  } else {
    tx = pickStr(p.transcription_text, prev?.transcription_text);
    if (tx != null && isDialpadTranscriptPlaceholderText(String(tx))) {
      const prevTx = prev?.transcription_text != null ? String(prev.transcription_text) : '';
      tx =
        prevTx && !isDialpadTranscriptPlaceholderText(prevTx) ? prevTx : null;
    }
    if (tx != null) {
      const polished = filterFormattedDialpadTranscriptPlaintext(String(tx));
      tx = polished ? polished : null;
    }
  }
  const recap = pickStr(p.recap_summary, prev?.recap_summary);

  return {
    dialpad_call_id: String(p.call_id),
    state:
      newer && p.state != null
        ? String(p.state)
        : pickStr(p.state, prev?.state),
    direction: pickStr(p.direction, prev?.direction),
    duration_ms: mergeDurationMs(p, prev?.duration_ms),
    total_duration_ms: mergeTotalDurationMs(p, prev?.total_duration_ms),
    date_started: pickNum(p.date_started, prev?.date_started),
    date_connected: pickNum(p.date_connected, prev?.date_connected),
    date_ended: pickNum(p.date_ended, prev?.date_ended),
    date_rang: pickNum(p.date_rang, prev?.date_rang),
    event_timestamp: Math.max(prevTs, nextTs),
    external_number: pickStr(p.external_number, prev?.external_number),
    external_e164:
      normalizeToE164(p.external_number || p.contact?.phone) ||
      prev?.external_e164 ||
      null,
    internal_number: pickStr(p.internal_number, prev?.internal_number),
    contact,
    target,
    contact_id_text:
      contactIdText(p) ||
      prev?.contact_id_text ||
      contactIdText({ contact }),
    thread_key: threadKeyFromCall(p),
    transcription_text: tx,
    recap_summary: recap,
  };
};

/**
 * Merge call webhook into dialpad_calls.
 * @param {object} payload decoded JWT / JSON webhook body
 */
export const upsertDialpadCallFromPayload = async (payload) => {
  const p = normalizeDialpadCallPayload(payload);
  if (!p || p.call_id == null) {
    throw new Error('Invalid Dialpad call payload (missing call_id)');
  }

  const dialpadCallId = String(p.call_id);

  const { rows: existingRows } = await query(
    `SELECT * FROM dialpad_calls WHERE dialpad_call_id = $1`,
    [dialpadCallId],
  );
  const prev = existingRows[0] || null;
  const merged = mergeCallRow(prev, p);
  const rawPayload = mergeRawPayload(prev?.raw_payload, p);
  const storedState = reconcileStoredCallState(merged, rawPayload);
  const mergedForDb = { ...merged, state: storedState };

  await query(
    `
    INSERT INTO dialpad_calls (
      dialpad_call_id, state, direction, duration_ms, total_duration_ms,
      date_started, date_connected, date_ended, date_rang, event_timestamp,
      external_number, external_e164, internal_number,
      contact, target, contact_id_text, thread_key,
      transcription_text, recap_summary, raw_payload
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14::jsonb, $15::jsonb, $16, $17, $18, $19, $20::jsonb
    )
    ON CONFLICT (dialpad_call_id) DO UPDATE SET
      state = EXCLUDED.state,
      direction = EXCLUDED.direction,
      duration_ms = EXCLUDED.duration_ms,
      total_duration_ms = EXCLUDED.total_duration_ms,
      date_started = EXCLUDED.date_started,
      date_connected = EXCLUDED.date_connected,
      date_ended = EXCLUDED.date_ended,
      date_rang = EXCLUDED.date_rang,
      event_timestamp = EXCLUDED.event_timestamp,
      external_number = EXCLUDED.external_number,
      external_e164 = EXCLUDED.external_e164,
      internal_number = EXCLUDED.internal_number,
      contact = EXCLUDED.contact,
      target = EXCLUDED.target,
      contact_id_text = EXCLUDED.contact_id_text,
      thread_key = EXCLUDED.thread_key,
      transcription_text = EXCLUDED.transcription_text,
      recap_summary = EXCLUDED.recap_summary,
      raw_payload = EXCLUDED.raw_payload,
      updated_at = NOW()
    `,
    [
      mergedForDb.dialpad_call_id,
      mergedForDb.state,
      mergedForDb.direction,
      mergedForDb.duration_ms,
      mergedForDb.total_duration_ms,
      mergedForDb.date_started,
      mergedForDb.date_connected,
      mergedForDb.date_ended,
      mergedForDb.date_rang,
      mergedForDb.event_timestamp,
      mergedForDb.external_number,
      mergedForDb.external_e164,
      mergedForDb.internal_number,
      JSON.stringify(mergedForDb.contact || {}),
      JSON.stringify(mergedForDb.target || {}),
      mergedForDb.contact_id_text,
      mergedForDb.thread_key,
      mergedForDb.transcription_text,
      mergedForDb.recap_summary,
      JSON.stringify(rawPayload),
    ],
  );

  emitDialpadDelta({
    type: 'dialpad_call_upserted',
    dialpad_call_id: dialpadCallId,
    thread_key: mergedForDb.thread_key,
    state: mergedForDb.state,
  });
  
  // CENTRALIZED CONTACT UPSERT
  if (mergedForDb.external_e164) {
    await upsertContactFromEvent(mergedForDb.external_e164, {
      name: mergedForDb.contact?.name,
      dialpadId: mergedForDb.contact_id_text
    });
  }

  const targetPhone = mergedForDb.target?.phone
    ? normalizeToE164(mergedForDb.target.phone)
    : null;

  return {
    dialpadCallId,
    state: mergedForDb.state,
    direction: mergedForDb.direction,
    durationMs: mergedForDb.duration_ms,
    totalDurationMs: mergedForDb.total_duration_ms,
    dateConnected: mergedForDb.date_connected,
    threadKey: mergedForDb.thread_key,
    externalE164: mergedForDb.external_e164,
    externalNumber: mergedForDb.external_number,
    internalNumber: mergedForDb.internal_number,
    target: mergedForDb.target && typeof mergedForDb.target === 'object'
      ? mergedForDb.target
      : {},
    contact:
      mergedForDb.contact && typeof mergedForDb.contact === 'object'
        ? mergedForDb.contact
        : {},
    targetPhone,
    contactName:
      mergedForDb.contact?.name != null
        ? String(mergedForDb.contact.name)
        : '',
    rawPayload,
  };
};

export const listRecentDialpadCalls = async (limit = 80, before = null, threadKey = null, opts = {}) => {
  const cap = Math.min(Math.max(Number(limit) || 80, 1), 200);
  const slim = Boolean(opts.slim);
  const cols = `dialpad_call_id, state, direction, duration_ms, total_duration_ms,
    date_started, date_connected, date_ended, date_rang, event_timestamp,
    external_number, external_e164, internal_number, contact, target,
    contact_id_text, thread_key, transcription_text, recap_summary,
    created_at, updated_at${slim ? '' : ', raw_payload'}`;
  let sql = `SELECT ${cols} FROM dialpad_calls WHERE 1=1`;
  const params = [];

  if (threadKey) {
    sql += ` AND thread_key = $${params.length + 1}`;
    params.push(threadKey);
  }
  if (before) {
    sql += ` AND updated_at < $${params.length + 1}`;
    params.push(before);
  }

  sql += ` ORDER BY updated_at DESC LIMIT $${params.length + 1}`;
  params.push(cap);

  const { rows } = await query(sql, params);
  return rows;
};

export const getDialpadCallById = async (dialpadCallId) => {
  const { rows } = await query(
    `SELECT * FROM dialpad_calls WHERE dialpad_call_id = $1`,
    [String(dialpadCallId)],
  );
  return rows[0] || null;
};

export const updateDialpadCallTranscription = async (dialpadCallId, text) => {
  await query(
    `
    UPDATE dialpad_calls
    SET transcription_text = $2, updated_at = NOW()
    WHERE dialpad_call_id = $1
    `,
    [String(dialpadCallId), String(text || '').slice(0, 500_000)],
  );
};
