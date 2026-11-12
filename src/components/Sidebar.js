'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, StickyNote, Target, BookOpen, LogOut, ChevronsLeft, ChevronsRight } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Home', path: '/home', icon: LayoutDashboard },
  { label: 'Notes', path: '/notes', icon: StickyNote },
  { label: 'Budget Planning', path: '/budget-planning', icon: Target },
  { label: 'Guide', path: '/guide', icon: BookOpen },
];

// The nav column. Desktop: sticky collapsible rail. Mobile: rendered expanded
// inside AppLayout's burger drawer (mobile=true, onNavigate closes the drawer).
export default function Sidebar({ user, onLogout, collapsed, onToggle, mobile = false, onNavigate }) {
  const pathname = usePathname();
  const isCollapsed = mobile ? false : collapsed;

  return (
    <aside
      className={`sticky top-0 h-screen bg-gradient-to-b from-blue-700 to-blue-900 text-white transition-all duration-300 flex flex-col ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand */}
      <div className={`flex items-center gap-3 px-4 py-5 ${isCollapsed ? 'justify-center' : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Budget Buddy logo" className="h-8 w-8 shrink-0" />
        {!isCollapsed && <span className="text-lg font-bold tracking-tight">Budget Buddy</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-1">
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
          const active = pathname === path || pathname.startsWith(path + '/');
          return (
            <Link
              key={path}
              href={path}
              onClick={onNavigate}
              title={isCollapsed ? label : undefined}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active ? 'bg-white/15 font-semibold' : 'text-blue-100 hover:bg-white/10 hover:text-white'
              } ${isCollapsed ? 'justify-center' : ''}`}
            >
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-white" />}
              <Icon size={18} className="shrink-0" />
              {!isCollapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle (desktop only) */}
      {!mobile && (
        <div className="px-2 pb-2">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-blue-100 hover:bg-white/10 hover:text-white transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight size={18} className="mx-auto" /> : <><ChevronsLeft size={18} /><span>Collapse</span></>}
          </button>
        </div>
      )}

      {/* Account footer */}
      <div className="border-t border-white/15 p-3">
        {isCollapsed ? (
          <div className="relative group flex justify-center">
            <button
              className="w-9 h-9 rounded-full bg-white/20 grid place-items-center text-sm font-bold hover:bg-white/30 transition-colors"
              title={user?.email}
            >
              {(user?.email || '?').charAt(0).toUpperCase()}
            </button>
            <div className="absolute bottom-11 left-2 hidden group-hover:block z-10 w-56 rounded-lg bg-slate-900 border border-white/10 shadow-lg p-3 text-xs">
              <p className="truncate text-blue-100 mb-2">{user?.email}</p>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-red-300 hover:bg-white/10 transition-colors"
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-white/20 grid place-items-center text-sm font-bold shrink-0">
              {(user?.email || '?').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-blue-200">Signed in as</p>
              <p className="text-sm font-medium truncate">{user?.email}</p>
            </div>
            <button
              onClick={onLogout}
              title="Logout"
              className="p-2 rounded-md text-blue-100 hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
