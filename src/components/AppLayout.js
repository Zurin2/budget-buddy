'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';

// App shell used inside each authenticated page (replaces the Base44
// LayoutWrapper + per-page <AppLayout> pattern). Only mounts after auth
// resolves (post-hydration), so reading localStorage in the initializer is safe.
export default function AppLayout({ user, onLogout, children }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('sidebarCollapsed');
    return stored ? stored === 'true' : window.innerWidth < 768;
  });

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebarCollapsed', String(!prev));
      return !prev;
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar user={user} onLogout={onLogout} collapsed={collapsed} onToggle={toggle} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
