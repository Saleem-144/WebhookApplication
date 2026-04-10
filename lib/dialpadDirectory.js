import { normalizeToE164, formatE164USNational } from '@/lib/dialpadSmsRecipient';

/**
 * Unwrap nested Dialpad webhook payloads (stored raw in DB).
 * Dialpad sometimes wraps the real payload under `data` or `sms`.
 */
const unwrapDialpadPayload = (obj) => {
  if (!obj || typeof obj !== 'object') return {};
  // Nested under `data`
  if (obj.data && typeof obj.data === 'object' && obj.data.id != null) return obj.data;
  // Nested under `sms`
  if (obj.sms && typeof obj.sms === 'object' && obj.sms.id != null) return obj.sms;
  return obj;
};

export const parseRowRawPayload = (row) => {
  const raw = row?.raw_payload;
  let obj = null;
  if (raw && typeof raw === 'object') {
    obj = raw;
  } else if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!obj) return {};
  return unwrapDialpadPayload(obj);
};

/**
 * Display name for Dialpad user list / labels.
 */
export const formatDialpadPersonLabel = (user) => {
  if (!user || typeof user !== 'object') return '';
  const dn = String(user.display_name || '').trim();
  if (dn) return dn;
  const fn = String(user.first_name || '').trim();
  const ln = String(user.last_name || '').trim();
  const both = `${fn} ${ln}`.trim();
  if (both) return both;
  const emails = user.emails;
  if (Array.isArray(emails) && emails[0]) return String(emails[0]);
  const phones = user.phone_numbers;
  if (Array.isArray(phones) && phones[0]) return String(phones[0]);
  return String(user.id || 'User');
};

/** Map normalized E.164 → user object (last write wins on collision). */
export const buildPhoneToDialpadUserMap = (users) => {
  const map = new Map();
  if (!Array.isArray(users)) return map;
  for (const u of users) {
    const nums = u.phone_numbers;
    if (!Array.isArray(nums)) continue;
    for (const p of nums) {
      const e = normalizeToE164(p);
      if (e) map.set(e, u);
    }
  }
  return map;
};

/** Office display name when peer E.164 matches an office line. */
export const officeLabelFromPhoneE164 = (e164, offices = []) => {
  if (!e164 || !Array.isArray(offices)) return '';
  const e = normalizeToE164(e164);
  if (!e) return '';
  for (const off of offices) {
    const nums = [];
    if (Array.isArray(off.phone_numbers)) nums.push(...off.phone_numbers);
    if (off.number) nums.push(off.number);
    for (const p of nums) {
      if (normalizeToE164(p) === e) {
        return String(off.name || off.display_name || `Office ${off.id}`).trim();
      }
    }
  }
  return '';
};

/**
 * Other party phone (customer or teammate) for labeling a row.
 * Optimized: uses agentPhones set to avoid picking the current agent's own number as the peer.
 */
export const peerE164FromRow = (row, agentPhones = new Set()) => {
  const p = parseRowRawPayload(row);
  const dir = String(row.direction || p.direction || '').toLowerCase();

  // Try all known locations for the sender phone
  const from =
    normalizeToE164(row.from_number) ||
    normalizeToE164(p.from_number) ||
    normalizeToE164(p.sender?.phone) ||
    normalizeToE164(p.sender?.phone_number) ||
    normalizeToE164(p.contact?.phone) ||
    normalizeToE164(p.contact?.phone_number);

  // Try all known locations for the recipient phone(s)
  // `sms_to_first` comes from SQL (required when slim mode strips raw_payload)
  const toList = Array.isArray(p.to_numbers)
    ? p.to_numbers
    : p.to_number
    ? [p.to_number]
    : [];
  const to0 =
    normalizeToE164(row.sms_to_first) ||
    normalizeToE164(toList[0]) ||
    normalizeToE164(p.recipient_phone) ||
    normalizeToE164(p.target?.phone) ||
    normalizeToE164(p.target?.phone_number);

  if (dir === 'inbound') {
    // Inbound: Peer is usually the sender.
    if (from && agentPhones.has(from) && to0 && !agentPhones.has(to0)) {
      return to0;
    }
    if (from && !agentPhones.has(from)) return from;
    // If sender is an agent (internal), try the recipient if it's not an agent.
    if (to0 && !agentPhones.has(to0)) return to0;
    // If both are agents, pick the one that ISN'T in the current agentPhones set
    if (from && to0) {
      const isFromCurrent = agentPhones.has(from);
      const isToCurrent = agentPhones.has(to0);
      if (isFromCurrent && !isToCurrent) return to0;
      if (!isFromCurrent && isToCurrent) return from;
    }
    return from;
  }

  // Outbound: Peer is usually the recipient.
  if (to0 && !agentPhones.has(to0)) return to0;
  // If recipient is an agent (internal), try the sender if it's not an agent.
  if (from && !agentPhones.has(from)) return from;
  // If both are agents, pick the one that ISN'T in the current agentPhones set
  if (from && to0) {
    const isFromCurrent = agentPhones.has(from);
    const isToCurrent = agentPhones.has(to0);
    if (isFromCurrent && !isToCurrent) return to0;
    if (!isFromCurrent && isToCurrent) return from;
  }

  const pick = to0 || from;
  if (pick && agentPhones.size > 0 && agentPhones.has(pick)) {
    const alt = pick === to0 ? from : to0;
    if (alt && !agentPhones.has(alt)) return alt;
  }
  return pick;
};

/**
 * Thread list label using Dialpad user directory (never raw contact UUID as primary).
 */
export const threadLabelWithDirectory = (
  row,
  dialpadUsers = [],
  agentPhones = new Set(),
  allCompanyPhones = new Set(),
  dialpadOffices = [],
) => {
  const peer = peerE164FromRow(row, agentPhones);
  
  // Smart Peer Selection for labeling:
  // 1. Try to find a peer that is NOT a company phone
  let smartPeer = peer;
  if (peer && allCompanyPhones.has(peer)) {
    // If the identified peer is a company phone, check if the other side is a customer
    const p = parseRowRawPayload(row);
    const from = normalizeToE164(row.from_number || p.from_number);
    const toList = Array.isArray(p.to_numbers) ? p.to_numbers : [p.to_number];
    const to0 =
      normalizeToE164(row.sms_to_first) || normalizeToE164(toList[0]);
    
    if (from && !allCompanyPhones.has(from)) smartPeer = from;
    else if (to0 && !allCompanyPhones.has(to0)) smartPeer = to0;
  }

  if (smartPeer) {
    if (Array.isArray(dialpadUsers) && dialpadUsers.length > 0) {
      const phoneMap = buildPhoneToDialpadUserMap(dialpadUsers);
      const user = phoneMap.get(smartPeer);
      if (user) return formatDialpadPersonLabel(user);
    }
    const officeName = officeLabelFromPhoneE164(smartPeer, dialpadOffices);
    if (officeName) return officeName;
    return smartPeer;
  }
  if (row.contact_id) {
    const s = String(row.contact_id);
    return s.length > 36 ? `Contact ${s.slice(0, 8)}…` : `Contact ${s.slice(0, 13)}`;
  }
  if (row.from_number) return String(row.from_number);
  return `SMS ${String(row.dialpad_id || '').slice(-10)}`;
};

const agentPhoneSet = (agent) => {
  const set = new Set();
  // From phone_numbers array (users)
  const nums = agent?.phone_numbers;
  if (Array.isArray(nums)) {
    for (const p of nums) {
      const e = normalizeToE164(p);
      if (e) set.add(e);
    }
  }
  // Dialpad offices expose their line as a single `number` field
  const single = agent?.number;
  if (single) {
    const e = normalizeToE164(single);
    if (e) set.add(e);
  }
  return set;
};

/**
 * Keep rows tied to the selected agent's line (outbound from, or inbound to, that line).
 */
export const filterRowsByDialpadAgent = (rows, agent) => {
  if (!agent || !Array.isArray(rows) || rows.length === 0) return rows;
  const phones = agentPhoneSet(agent);
  const agentId = String(agent.id || '');
  const isOffice = Boolean(agent.is_office);

  // No way to filter at all → return everything
  if (phones.size === 0 && !agentId) return rows;

  // If it's an office with no phones resolved, show all rows (can't discriminate)
  if (isOffice && phones.size === 0) return rows;

  return rows.filter((row) => {
    const p = parseRowRawPayload(row);
    const dir = String(row.direction || p.direction || '').toLowerCase();
    const from = normalizeToE164(row.from_number || p.from_number);

    // Outbound: must have come from one of the agent/office phones
    if (dir === 'outbound' && from && phones.size > 0 && phones.has(from)) return true;

    // Inbound: must be addressed to one of the agent/office phones
    if (dir === 'inbound' && phones.size > 0) {
      const toList = Array.isArray(p.to_numbers) ? p.to_numbers : [];
      for (const t of toList) {
        const e = normalizeToE164(t);
        if (e && phones.has(e)) return true;
      }
      const to1 = normalizeToE164(p.to_number);
      if (to1 && phones.has(to1)) return true;
      const toTarget = normalizeToE164(p.target?.phone || p.target?.phone_number);
      if (toTarget && phones.has(toTarget)) return true;
    }

    // ID-based matching (user_id / target_id in webhook payload)
    if (agentId) {
      if (String(p.user_id) === agentId) return true;
      if (String(p.target_id) === agentId) return true;
      // For offices: also check office_id field in payload
      if (isOffice && String(p.office_id) === agentId) return true;
    }

    return false;
  });
};

export const primarySendFromNumber = (agent) => {
  const nums = agent?.phone_numbers;
  if (!Array.isArray(nums) || !nums[0]) return '';
  return String(nums[0]).trim();
};

/**
 * Bell / inbox: show SMS notification only if it hit one of the selected user’s lines.
 * Older rows without recipient_line_e164s still show for every line.
 */
/**
 * Pick Dialpad company user id from webhook recipient lines (inbound SMS to-numbers).
 */
export const resolveDialpadUserIdFromRecipientLines = (e164List, users) => {
  if (!Array.isArray(e164List) || e164List.length === 0 || !Array.isArray(users)) {
    return '';
  }
  const map = buildPhoneToDialpadUserMap(users);
  for (const raw of e164List) {
    const e = normalizeToE164(raw);
    if (!e) continue;
    const u = map.get(e);
    if (u?.id != null && String(u.id)) return String(u.id);
  }
  return '';
};

export const notificationMatchesSelectedDialpadLine = (notif, selectedUser) => {
  if (!selectedUser) return true;
  const lines = notif.recipientLineE164s;
  if (!Array.isArray(lines) || lines.length === 0) return true;
  const agentPhones = new Set();
  const nums = selectedUser.phone_numbers;
  if (Array.isArray(nums)) {
    for (const p of nums) {
      const e = normalizeToE164(p);
      if (e) agentPhones.add(e);
    }
  }
  const single = selectedUser.number;
  if (single) {
    const e = normalizeToE164(single);
    if (e) agentPhones.add(e);
  }
  if (agentPhones.size === 0) return true;
  return lines.some((L) => agentPhones.has(normalizeToE164(L)));
};

/**
 * Current date/time in a Dialpad user timezone (e.g. US/Pacific).
 */
export const formatNowInDialpadTimeZone = (timeZone) => {
  if (!timeZone || typeof timeZone !== 'string') return '';
  const tz = timeZone.trim();
  if (!tz) return '';
  try {
    return new Date().toLocaleString(undefined, {
      timeZone: tz,
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '';
  }
};

/**
 * Other party in an SMS thread: match peer phone to company Dialpad users when possible.
 */
export const resolveThreadPeerProfile = (threadRows, dialpadUsers, agentPhones = new Set()) => {
  const empty = {
    peerE164: null,
    dialpadUser: null,
    phoneDisplay: '',
    emailDisplay: '',
    localTimeDisplay: '',
    timeZoneLabel: '',
  };
  if (!Array.isArray(threadRows) || threadRows.length === 0) return empty;

  let peer = null;
  for (let i = threadRows.length - 1; i >= 0; i--) {
    peer = peerE164FromRow(threadRows[i], agentPhones);
    if (peer) break;
  }

  const map = buildPhoneToDialpadUserMap(dialpadUsers);
  let dialpadUser = null;
  if (peer && !agentPhones.has(peer)) {
    dialpadUser = map.get(peer) ?? null;
  }

  let phoneDisplay = '';
  if (dialpadUser && Array.isArray(dialpadUser.phone_numbers)) {
    const parts = dialpadUser.phone_numbers
      .map((p) => String(p).trim())
      .filter(Boolean);
    if (parts.length) {
      phoneDisplay = parts.map((p) => formatE164USNational(p) || p).join(', ');
    }
  }
  if (!phoneDisplay && peer && !agentPhones.has(peer)) {
    phoneDisplay = formatE164USNational(peer) || peer;
  }

  let emailDisplay = '';
  if (dialpadUser && Array.isArray(dialpadUser.emails)) {
    const es = dialpadUser.emails
      .map((e) => String(e).trim())
      .filter(Boolean);
    if (es.length) emailDisplay = es.join(', ');
  }

  const tzRaw = dialpadUser?.timezone;
  const timeZoneLabel =
    tzRaw && typeof tzRaw === 'string' ? tzRaw.trim() : '';
  const localTimeDisplay = timeZoneLabel
    ? formatNowInDialpadTimeZone(timeZoneLabel)
    : '';

  return {
    peerE164: peer,
    dialpadUser,
    phoneDisplay,
    emailDisplay,
    localTimeDisplay,
    timeZoneLabel,
  };
};
