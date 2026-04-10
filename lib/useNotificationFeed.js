'use client';

import { useEffect } from 'react';
import { fetchNotifications } from '@/lib/api';
import useNotificationStore from '@/store/notificationStore';
import { DIALPAD_SMS_DELTA_EVENT } from '@/lib/dialpadSocket';

/**
 * Load notifications from API and refresh when Dialpad SMS events arrive (socket).
 */
export function useNotificationFeed() {
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchNotifications({ limit: 80 });
        if (res?.success && Array.isArray(res.data)) {
          useNotificationStore.getState().setFromFetchRows(res.data);
        }
      } catch {
        /* ignore */
      }
    };

    load();
    const onDelta = () => load();
    window.addEventListener(DIALPAD_SMS_DELTA_EVENT, onDelta);
    return () => window.removeEventListener(DIALPAD_SMS_DELTA_EVENT, onDelta);
  }, []);
}
