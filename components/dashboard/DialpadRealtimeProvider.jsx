'use client';

import { useEffect } from 'react';
import { ensureDialpadRealtime } from '@/lib/dialpadSocket';
import { useNotificationFeed } from '@/lib/useNotificationFeed';

export default function DialpadRealtimeProvider({ children }) {
  useEffect(() => {
    ensureDialpadRealtime();
  }, []);
  useNotificationFeed();
  return children;
}
