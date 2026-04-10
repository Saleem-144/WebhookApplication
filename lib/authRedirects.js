/** Only allow same-origin relative paths (no //evil.com, no /login loop). */
export const safeRedirectPath = (raw) => {
  if (raw == null || typeof raw !== 'string') return '/home';
  let t = raw.trim();
  if (t.includes('%')) {
    try {
      t = decodeURIComponent(t);
    } catch {
      /* keep t */
    }
  }
  t = t.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return '/home';
  if (t === '/login') return '/home';
  return t;
};

const AGENT_INBOX = '/agent-dashboard/inbox';

/**
 * Post-login destination: agents skip the admin home and land on inbox by default.
 * Maps admin `next` paths to agent equivalents when possible.
 */
export const afterAuthPathForUser = (user, nextRaw) => {
  const path = safeRedirectPath(nextRaw);
  if (user?.role !== 'agent') return path;
  if (path.startsWith('/agent-dashboard') || path.startsWith('/settings')) return path;
  if (path.startsWith('/messages')) {
    return `/agent-dashboard/messages${path.slice('/messages'.length)}`;
  }
  if (path.startsWith('/inbox')) {
    return `/agent-dashboard/inbox${path.slice('/inbox'.length)}`;
  }
  if (path.startsWith('/calls')) {
    return `/agent-dashboard/inbox${path.slice('/calls'.length)}`;
  }
  if (path === '/home' || path === '/' || path.startsWith('/home?')) {
    return AGENT_INBOX;
  }
  return AGENT_INBOX;
};
