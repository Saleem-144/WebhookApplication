/**
 * Chat day separator labels: Today, Yesterday, or "Wed, Apr 2, 2025".
 * @param {Date} date
 * @param {string} [timeZone]
 * @returns {string}
 */
export const chatDaySeparatorLabel = (date, timeZone) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const opts = { timeZone: timeZone || undefined };
  const now = new Date();
  const startOf = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  const d0 = startOf(date);
  const n0 = startOf(now);
  const dayMs = 86400000;
  if (d0 === n0) return 'Today';
  if (d0 === n0 - dayMs) return 'Yesterday';
  const yNow = new Intl.DateTimeFormat('en-US', { year: 'numeric', ...opts }).format(now);
  const yDate = new Intl.DateTimeFormat('en-US', { year: 'numeric', ...opts }).format(date);
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', ...opts }).format(date);
  const monthDay = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...opts,
  }).format(date);
  if (yDate === yNow) {
    return `${weekday}, ${monthDay}`;
  }
  return `${weekday}, ${monthDay}, ${yDate}`;
};

/**
 * Calendar day key in a given IANA zone for grouping (YYYY-MM-DD).
 * @param {number} ms
 * @param {string} [timeZone]
 */
export const chatDayKey = (ms, timeZone) => {
  try {
    const d = new Date(ms);
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return fmt.format(d);
  } catch {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
};

/**
 * Concise relative time: 'now', '5m', '1h', '2d', '1M', '1y'.
 * @param {Date | number | string} date
 * @returns {string}
 */
export const getRelativeTimeShort = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30.437); // Average month
  const diffYear = Math.floor(diffDay / 365.25);

  if (diffSec < 60) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 31) return `${diffDay}d`;
  if (diffMonth < 12) return `${diffMonth}M`;
  return `${diffYear}y`;
};
