'use client';

import { useMemo } from 'react';
import useDialpadLineStore from '@/store/dialpadLineStore';

/**
 * Resolved Dialpad company user for the global line selector (navbar).
 */
export function useSelectedDialpadLineUser() {
  const users = useDialpadLineStore((s) => s.users);
  const offices = useDialpadLineStore((s) => s.offices);
  const selectedUserId = useDialpadLineStore((s) => s.selectedUserId);

  return useMemo(() => {
    const combined = [
      ...offices.map(o => ({
        ...o,
        is_office: true,
        display_name: o.name || 'Office',
        // Normalize phone_numbers so filtering always works
        phone_numbers: Array.isArray(o.phone_numbers) && o.phone_numbers.length
          ? o.phone_numbers
          : o.number ? [o.number] : [],
      })),
      ...users.map(u => ({ ...u, is_user: true }))
    ];
    if (!combined.length) return null;
    if (
      selectedUserId &&
      combined.some((u) => String(u.id) === String(selectedUserId))
    ) {
      return combined.find((u) => String(u.id) === String(selectedUserId)) ?? null;
    }
    return combined[0] ?? null;
  }, [users, offices, selectedUserId]);
}

export function useEffectiveDialpadLineUserId() {
  const u = useSelectedDialpadLineUser();
  return u ? String(u.id) : '';
}
