'use client';

import { Suspense } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import SessionGate from '@/components/dashboard/SessionGate';
import DialpadRealtimeProvider from '@/components/dashboard/DialpadRealtimeProvider';
import DialpadLineProvider from '@/components/dashboard/DialpadLineProvider';
import IncomingCallBanner from '@/components/dashboard/IncomingCallBanner';
import useAuthStore from '@/store/authStore';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }) {
  const user = useAuthStore((s) => s.user);
  const isAgent = user?.role === 'agent';

  return (
    <DialpadLineProvider>
      <div className="h-screen w-full flex bg-background overflow-hidden relative group/layout">
        <Suspense fallback={null}>
          <Sidebar key={user?.role} />
        </Suspense>
        <div
          className={cn(
            'flex-1 flex flex-col min-w-0 transition-all duration-300',
            isAgent ? 'ml-[240px]' : 'ml-[80px]',
          )}
        >
          <Navbar />
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#fbfbfd]">
            <SessionGate>
              <DialpadRealtimeProvider>{children}</DialpadRealtimeProvider>
            </SessionGate>
          </main>
        </div>
        {isAgent ? <IncomingCallBanner /> : null}
      </div>
    </DialpadLineProvider>
  );
}
