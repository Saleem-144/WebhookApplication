const eventTypeLabel = (eventType) => {
  if (eventType === 'sms_inbound') return 'CUSTOMER';
  if (eventType === 'missed_call') return 'MISSED';
  if (eventType === 'internal_message') return 'AGENT';
  return 'UPDATE';
};

export const formatNotificationTime = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    if (diffMs < 60_000) return 'Just now';
    if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    if (diffMs < 86400_000) return `${Math.floor(diffMs / 3600_000)}h ago`;
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '';
  }
};

/**
 * Map API / DB notification row to UI list item.
 */
export const mapNotificationRow = (row) => {
  const m =
    row.meta && typeof row.meta === 'object'
      ? row.meta
      : typeof row.meta === 'string'
        ? (() => {
            try {
              return JSON.parse(row.meta);
            } catch {
              return {};
            }
          })()
        : {};

  return {
    id: row.id,
    created_at: row.created_at,
    /** @type {string} */
    eventType: row.event_type,
    name: m.label || 'Notification',
    time: formatNotificationTime(row.created_at),
    type: eventTypeLabel(row.event_type),
    text: row.preview_text || '',
    is_read: Boolean(row.is_read),
    chatId: m.thread_key || '',
    dialpadId: m.dialpad_id != null ? String(m.dialpad_id) : '',
    dialpadCallId: m.dialpad_call_id != null ? String(m.dialpad_call_id) : '',
    peerE164: m.peer_e164 != null ? String(m.peer_e164) : '',
    dismissedFromPopup: row.dismissed_from_popup_at != null,
    recipientLineE164s: Array.isArray(m.recipient_line_e164s)
      ? m.recipient_line_e164s.map((x) => String(x))
      : [],
  };
};
