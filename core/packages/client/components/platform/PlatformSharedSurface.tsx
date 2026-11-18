'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { isPlatformSharedRoute, platformNavigationState } from '@/lib/platform-navigation';
const PlatformShell = dynamic(() => import('./PlatformShell').then(module => module.PlatformShell));

const subscribe = () => () => {};

/** Rewritten routes use the original page, with Platform chrome added after hydration. */
export function PlatformSharedSurface({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const shared = mounted && isPlatformSharedRoute(platformNavigationState(pathname).definition);
  return shared ? <PlatformShell shared>{children}</PlatformShell> : children;
}
