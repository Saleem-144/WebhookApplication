'use client';

import { useEffect } from 'react';
import useAuthStore from '@/store/authStore';
import useDialpadLineStore, { STORAGE_KEY } from '@/store/dialpadLineStore';
import { fetchDialpadUsers, fetchDialpadOffices } from '@/lib/api';

function pickInitialLineId(items, offices = []) {
  const all = [
    ...offices.map((o) => ({ ...o, is_office: true })),
    ...items,
  ];
  if (!all.length) return '';
  if (typeof window === 'undefined') return String(all[0].id);
  const fromUrl =
    new URLSearchParams(window.location.search).get('agentId') || '';
  if (fromUrl && all.some((u) => String(u.id) === String(fromUrl))) {
    return String(fromUrl);
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && all.some((u) => String(u.id) === String(stored))) {
    return String(stored);
  }
  return String(all[0].id);
}

/** Normalize a Dialpad office object so phone_numbers is always present. */
function normalizeOffice(off) {
  const normalized = { ...off, is_office: true };
  if (!Array.isArray(normalized.phone_numbers)) {
    normalized.phone_numbers = off.number ? [off.number] : [];
  }
  return normalized;
}

/**
 * Loads Dialpad company users once after auth; hydrates selected line from URL, then localStorage, then first user.
 */
export default function DialpadLineProvider({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      useDialpadLineStore.getState().setUsersBundle({ users: [], error: '' });
      useDialpadLineStore.getState().setUsersLoading(false);
      return undefined;
    }

    let cancelled = false;
    let pollInterval = null;

    const refreshUsers = async (isInitial = false) => {
      // Prevent redundant initial fetches if already loaded
      const currentUsers = useDialpadLineStore.getState().users;
      if (isInitial && currentUsers.length > 0) {
        useDialpadLineStore.getState().setUsersLoading(false);
        return;
      }

      if (isInitial) useDialpadLineStore.getState().setUsersLoading(true);
      try {
        const [res, offRes] = await Promise.all([
          fetchDialpadUsers(),
          fetchDialpadOffices().catch(() => ({ items: [] })),
        ]);

        if (cancelled) return;

        const officeItems = Array.isArray(offRes?.items)
          ? offRes.items.map(normalizeOffice)
          : Array.isArray(offRes?.data?.items)
          ? offRes.data.items.map(normalizeOffice)
          : [];
        if (officeItems.length) {
          useDialpadLineStore.getState().setOffices(officeItems);
        }

        if (res?.success === false) {
          if (isInitial) {
            useDialpadLineStore.getState().setUsersBundle({
              users: [],
              error: res.error || 'Could not load Dialpad users',
            });
            useDialpadLineStore.getState().setSelectedUserId('', { syncUrl: false });
          }
          return;
        }
        const items = Array.isArray(res?.items) ? res.items : [];
        useDialpadLineStore.getState().setUsersBundle({ users: items, error: '' });
        
        if (isInitial) {
          const currentOffices = useDialpadLineStore.getState().offices;
          const pick = pickInitialLineId(items, currentOffices);
          if (pick) {
            useDialpadLineStore.getState().setSelectedUserId(pick, { syncUrl: true });
          }
        }
      } catch (err) {
        if (!cancelled && isInitial) {
          useDialpadLineStore.getState().setUsersBundle({
            users: [],
            error: err.response?.data?.error || err.message || 'Dialpad users failed',
          });
        }
      } finally {
        if (!cancelled && isInitial) useDialpadLineStore.getState().setUsersLoading(false);
      }
    };

    refreshUsers(true);
    pollInterval = setInterval(() => refreshUsers(false), 300000); // Poll every 5 minutes instead of 1

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isAuthenticated]);

  return children;
}
