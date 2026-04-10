'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import useAuthStore from '@/store/authStore';
import { fetchMe } from '@/lib/api';

export default function SessionGate({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetchMe();
        if (cancelled) return;
        if (res.success && res.data?.user) {
          const user = res.data.user;
          useAuthStore.getState().login(user);

          // 1. Force password change if required
          if (user.must_change_password && pathname !== '/settings') {
            router.replace('/settings?mode=change-password');
            return;
          }

          // 2. Agent landing: no hub at /agent-dashboard — use inbox
          if (user.role === 'agent' && pathname === '/agent-dashboard') {
            router.replace('/agent-dashboard/inbox');
            return;
          }

          // 3. Redirect Agent into agent routes (default inbox)
          if (
            user.role === 'agent' &&
            !pathname?.startsWith('/agent-dashboard') &&
            pathname !== '/settings'
          ) {
            router.replace('/agent-dashboard/inbox');
            return;
          }

          // 4. Prevent Agent from accessing admin dashboard pages
          const adminPages = ['/home', '/messages', '/calls', '/inbox'];
          if (user.role === 'agent' && adminPages.some((p) => pathname?.startsWith(p))) {
            router.replace('/agent-dashboard/inbox');
            return;
          }

          // 5. Redirect Admin/Superadmin away from agent-dashboard
          if ((user.role === 'admin' || user.role === 'superadmin') && pathname?.startsWith('/agent-dashboard')) {
            router.replace('/home');
            return;
          }
        } else {
          useAuthStore.getState().logout();
          const skipNext =
            !pathname ||
            pathname === '/login' ||
            pathname === '/home' ||
            pathname === '/';
          const next = skipNext
            ? ''
            : `?next=${encodeURIComponent(pathname)}`;
          router.replace(`/login${next}`);
        }
      } catch {
        if (!cancelled) {
          useAuthStore.getState().logout();
          const skipNext =
            !pathname ||
            pathname === '/login' ||
            pathname === '/home' ||
            pathname === '/';
          const next = skipNext
            ? ''
            : `?next=${encodeURIComponent(pathname)}`;
          router.replace(`/login${next}`);
        }
      } finally {
        if (!cancelled) {
          setChecked(true);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (!checked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-[#fbfbfd]">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#2563eb]"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return children;
}
