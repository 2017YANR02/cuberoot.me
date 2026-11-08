'use client';

import type {} from 'react/canary';
import { ViewTransition, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import './page-transition.css';

export function pageTransitionSection(pathname: string | null): string {
  const path = (pathname ?? '/').replace(/^\/(?:zh|en)(?=\/|$)/, '');
  // Forum reading transitions include entering/leaving a thread and changing threads.
  // Query-only changes (filter, sorting, reply pagination) keep the same identity.
  if (/^\/forum\/t\/\d+\/?$/.test(path)) return path.replace(/\/$/, '');
  return path.split('/')[1] || 'home';
}

/** Product sections and forum threads share the site's single exit/enter animation.
 * Other same-section detail transitions keep their existing owners. */
export default function PageTransition({ children }: { children: ReactNode }) {
  const section = pageTransitionSection(usePathname());
  return <ViewTransition key={section} default="none" enter="site-page-enter" exit="site-page-exit">
    {children}
  </ViewTransition>;
}
