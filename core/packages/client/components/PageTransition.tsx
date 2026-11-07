'use client';

import type {} from 'react/canary';
import { ViewTransition, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import './page-transition.css';

export function pageTransitionSection(pathname: string | null): string {
  return (pathname ?? '/').replace(/^\/(?:zh|en)(?=\/|$)/, '').split('/')[1] || 'home';
}

/** Only changing product sections creates an exit/enter pair. Search params,
 * timer ticks, filters and same-section detail transitions keep their owners. */
export default function PageTransition({ children }: { children: ReactNode }) {
  const section = pageTransitionSection(usePathname());
  return <ViewTransition key={section} default="none" enter="site-page-enter" exit="site-page-exit">
    {children}
  </ViewTransition>;
}
