'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/utils/supabase/client';

// Session hook replacing Base44's base44.auth.me() + redirectToLogin pattern.
export function useAuthUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    let alive = true;
    getSupabase().auth.getUser().then(({ data }) => {
      if (alive) setUser(data?.user || null);
    });
    return () => {
      alive = false;
    };
  }, []);
  return user;
}

export function useLogout() {
  const router = useRouter();
  return async () => {
    await getSupabase().auth.signOut();
    router.replace('/login');
    router.refresh();
  };
}
