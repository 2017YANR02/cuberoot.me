'use client';

import { useEntryRouter as useRouter } from '@/hooks/useEntryRouter';
import { getAuthUser } from '@/lib/auth-store';
import { membershipEntryHref } from '@/lib/membership-return';

/** Call from a user action. False means login or checkout has taken over navigation. */
export function useRequireMembership(hasAccess: boolean) {
  const router = useRouter();
  return (options?: { returnPath?: string; requireActive?: boolean }) => {
    const user = getAuthUser();
    if (user && hasAccess) return true;
    const path = options?.returnPath ?? window.location.pathname + window.location.search + window.location.hash;
    const membership = membershipEntryHref(path, options?.requireActive);
    const prefix = window.location.pathname.startsWith('/zh/') ? '/zh' : '';
    router.push(user ? membership : `${prefix}/account?next=${encodeURIComponent(membership)}`);
    return false;
  };
}
