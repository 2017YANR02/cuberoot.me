'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { platformNavigationState } from '@/lib/platform-navigation';
import { useIsAdmin } from '@/lib/auth-store';
import { PlatformState } from './PlatformState';
const PlatformShell = dynamic(() => import('./PlatformShell').then(module => module.PlatformShell));

const subscribe = () => () => {};

/** Shared layouts own the frame across administrative rewrites as well as native pages. */
export function PlatformSharedSurface({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const isAdmin = useIsAdmin();
  const { definition } = platformNavigationState(pathname);
  const admin = definition?.area === 'admin';
  // Native routes already render their static layout during SSR. Transfer
  // ownership after hydration, as with public rewrites: rendering this dynamic
  // shell on the server can emit stale Turbopack preload URLs during HMR.
  const shared = mounted && (admin || definition?.kind === 'canonical');
  const denied = definition?.kind === 'canonical' && definition.access === 'admin' && !isAdmin;
  return shared ? <PlatformShell shared>{denied ? <PlatformState kind="permission" /> : children}</PlatformShell> : children;
}
