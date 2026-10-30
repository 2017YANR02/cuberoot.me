'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { membershipEntryHref } from '@/lib/membership-return';

/** Call from a user action. False means login or checkout has taken over navigation. */
export function useRequireMembership(hasAccess: boolean) {
  const router = useRouter();
  return () => {
    const user = useAuthStore.getState().user;
    if (user && hasAccess) return true;
    const path = window.location.pathname + window.location.search + window.location.hash;
    const membership = membershipEntryHref(path);
    const prefix = window.location.pathname.startsWith('/zh/') ? '/zh' : '';
    router.push(user ? membership : `${prefix}/account?next=${encodeURIComponent(membership)}`);
    return false;
  };
}
