'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

// App shell used inside each authenticated page (replaces the Base44
// LayoutWrapper + per-page <AppLayout> pattern).
// Desktop (md+): sticky collapsible sidebar. Mobile: fixed top bar with a
// burger button that opens a slide-in drawer over a dimmed backdrop.
export default function AppLayout({ user, onLogout, children }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('sidebarCollapsed');
    return stored ? stored === 'true' : window.innerWidth < 768;
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebarCollapsed', String(!prev));
      return !prev;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <div className="md:flex min-h-screen">
        <div className="hidden md:block">
          <Sidebar user={user} onLogout={onLogout} collapsed={collapsed} onToggle={toggle} />
        </div>
        <main className="flex-1 min-w-0 pt-14 md:pt-0">{children}</main>
      </div>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-gradient-to-r from-blue-700 to-blue-900 text-white flex items-center gap-3 px-4 shadow-md">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-2 -ml-2 rounded-md hover:bg-white/10 transition-colors"
        >
          <Menu size={22} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="h-7 w-7" />
        <span className="font-bold tracking-tight">Budget Buddy</span>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 left-0 animate-drawer-in">
            <Sidebar
              user={user}
              onLogout={onLogout}
              collapsed={false}
              mobile
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
