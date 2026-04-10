/**
 * Helpers for SMS rows from GET /api/dialpad/messages/ingested (webhook → dialpad_messages).
 */

import {
  threadLabelWithDirectory,
  peerE164FromRow,
  buildPhoneToDialpadUserMap,
  formatDialpadPersonLabel,
} from '@/lib/dialpadDirectory';
import { normalizeToE164 } from '@/lib/dialpadSmsRecipient';

export const threadKey = (row) =>
  row.contact_id ? `c:${row.contact_id}` : `d:${row.dialpad_id}`;

/** @deprecated use threadLabelWithDirectory */
export const threadLabel = (row) => threadLabelWithDirectory(row, []);

export const formatDialpadWhen = (iso, timeZone) => {
  try {
    const d = new Date(iso);
    const opts = {
      dateStyle: 'short',
      timeStyle: 'short',
    };
    if (timeZone && typeof timeZone === 'string') {
      opts.timeZone = timeZone;
    }
    return d.toLocaleString(undefined, opts);
  } catch {
    return '';
  }
};

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {{ dialpadUsers?: unknown[], dialpadOffices?: unknown[], agentPhones?: Set<string>, allCompanyPhones?: Set<string> }} [ctx]
 */
export const buildThreadsFromRows = (rows, ctx = {}) => {
  const dialpadUsers = ctx.dialpadUsers || [];
  const dialpadOffices = ctx.dialpadOffices || [];
  const agentPhones = ctx.agentPhones || new Set();
  const allCompanyPhones = ctx.allCompanyPhones || new Set();
  const map = new Map();
  for (const row of rows) {
    const k = threadKey(row);
    const prev = map.get(k);
    if (
      !prev ||
      new Date(row.updated_at) > new Date(prev.latest.updated_at)
    ) {
      map.set(k, {
        key: k,
        latest: row,
        label: threadLabelWithDirectory(
          row,
          dialpadUsers,
          agentPhones,
          allCompanyPhones,
          dialpadOffices,
        ),
      });
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      new Date(b.latest.updated_at) - new Date(a.latest.updated_at),
  );
};

export const getThreadMessages = (rows, selectedChatId) => {
  if (!selectedChatId || !Array.isArray(rows)) return [];
  return rows
    .filter((r) => threadKey(r) === selectedChatId)
    .sort(
      (a, b) =>
        new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
    );
};

/** Bubble header: who sent (for outbound show agent; inbound show customer label). */
export const messageSenderLabel = (msg, dialpadUsers = [], agentPhones = new Set()) => {
  const p =
    msg.raw_payload && typeof msg.raw_payload === 'object'
      ? msg.raw_payload
      : {};
  const dir = String(msg.direction || p.direction || '').toLowerCase();
  const phoneMap = buildPhoneToDialpadUserMap(dialpadUsers);
  if (dir === 'outbound') {
    const from = normalizeToE164(msg.from_number || p.from_number);
    const user = from ? phoneMap.get(from) : null;
    const label = user ? formatDialpadPersonLabel(user) : null;
    return label || from || 'Outbound';
  }
  const peer = peerE164FromRow(msg, agentPhones);
  if (peer) {
    const user = phoneMap.get(peer);
    const label = user ? formatDialpadPersonLabel(user) : null;
    return label || peer;
  }
  return 'Inbound';
};
