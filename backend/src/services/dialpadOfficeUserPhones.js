import { dialpadFetch } from './dialpadApiFetch.js';
import { normalizeToE164 } from '../utils/phoneNormalize.js';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = {
  set: /** @type {Set<string>|null} */ (null),
  loadedAt: 0,
  officeFilterKey: '',
};

const configuredOfficeId = () => {
  const v = process.env.DIALPAD_OFFICE_ID;
  return v != null && String(v).trim() !== '' ? String(v).trim() : '';
};

const userMatchesOfficeFilter = (u, officeId) => {
  if (!officeId) return true;
  const oid = u?.office_id != null ? String(u.office_id) : '';
  if (oid === officeId) return true;
  const admin = Array.isArray(u?.admin_office_ids) ? u.admin_office_ids : [];
  return admin.some((x) => String(x) === officeId);
};

/**
 * E.164 numbers for Dialpad company users (same scope as GET /api/v2/users for this API key).
 * Optional `DIALPAD_OFFICE_ID`: only users in that office (or with that id in admin_office_ids).
 * Cached ~5m to avoid hitting Dialpad on every transcript peer check.
 */
export const getDialpadOfficeUserE164Set = async () => {
  const officeId = configuredOfficeId();
  const now = Date.now();
  if (
    cache.set &&
    now - cache.loadedAt < CACHE_TTL_MS &&
    cache.officeFilterKey === officeId
  ) {
    return cache.set;
  }

  const r = await dialpadFetch('/api/v2/users');
  if (!r.ok || r.data == null || typeof r.data !== 'object') {
    return cache.set ?? new Set();
  }

  const items = Array.isArray(r.data.items) ? r.data.items : [];
  const set = new Set();
  for (const u of items) {
    if (!userMatchesOfficeFilter(u, officeId)) continue;
    const phones = Array.isArray(u?.phone_numbers) ? u.phone_numbers : [];
    for (const p of phones) {
      const n = normalizeToE164(p);
      if (n) set.add(n);
    }
  }

  // Also include office numbers
  const offRes = await dialpadFetch('/api/v2/offices');
  if (offRes.ok && Array.isArray(offRes.data?.items)) {
    for (const off of offRes.data.items) {
      const phones = Array.isArray(off.phone_numbers) ? off.phone_numbers : [];
      for (const p of phones) {
        const n = normalizeToE164(p);
        if (n) set.add(n);
      }
    }
  }

  cache = { set, loadedAt: now, officeFilterKey: officeId };
  return set;
};

/** Tests or forced refresh after admin changes Dialpad users. */
export const clearDialpadOfficeUserPhonesCache = () => {
  cache = { set: null, loadedAt: 0, officeFilterKey: '' };
};
