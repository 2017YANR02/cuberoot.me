'use client';
import { ChevronLeft } from '@app-foundation/icons/lucide';
import AppLink from './AppLink';
import HomeLink from './HomeLink';
import { readEntryNavigationBack, subscribeEntryNavigation } from '@/lib/entry-navigation';
import { tr } from '@/i18n/tr';
import { useSyncExternalStore, type AnchorHTMLAttributes } from 'react';
import './page-back-link.css';

export default function PageBackLink({ fallback = '/', className, contextOnly = false, miniProgramTarget, prefetch = false, ...rest }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  fallback?: string; className?: string; contextOnly?: boolean; miniProgramTarget?: 'tools' | 'account'; prefetch?: false;
}) {
  const back = useSyncExternalStore(subscribeEntryNavigation, readEntryNavigationBack, () => null);
  if (contextOnly && !back) return null;
  const props = { ...rest, className: ['back-home', className].filter(Boolean).join(' '), prefetch,
    'aria-label': back ? tr({ zh: '返回上一层', en: 'Back to previous page' }) : rest['aria-label'] ?? (fallback === '/' ? tr({ zh: '返回首页', en: 'Back to home' }) : tr({ zh: '返回上一层', en: 'Back to previous page' })) };
  const icon = <ChevronLeft size={16} aria-hidden="true" />;
  return !back && fallback === '/' ? <HomeLink {...props} miniProgramTarget={miniProgramTarget}>{icon}</HomeLink>
    : <AppLink {...props} href={back ?? fallback} navigation="return">{icon}</AppLink>;
}
