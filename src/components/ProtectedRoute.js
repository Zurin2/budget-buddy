'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/utils/supabase/client';

// Client-side guard for the authenticated pages. RLS in Postgres is the real
// security boundary; this only keeps signed-out visitors from staring at
// empty states (replaces Base44's base44.auth.me() / redirectToLogin flow).
export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const [state, setState] = useState('checking'); // 'checking' | 'in'

  useEffect(() => {
    let alive = true;
    getSupabase().auth.getUser().then(({ data }) => {
      if (!alive) return;
      if (data?.user) {
        setState('in');
      } else {
        router.replace('/login');
      }
    });
    return () => {
      alive = false;
    };
  }, [router]);

  if (state === 'in') return children;

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div
        className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"
        aria-label="Loading"
        role="status"
      />
    </div>
  );
}
