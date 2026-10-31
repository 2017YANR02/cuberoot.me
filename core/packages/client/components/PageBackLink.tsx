'use client';
import { ChevronLeft } from '@app-foundation/icons/lucide';
import AppLink from './AppLink';
import HomeLink from './HomeLink';
import { useLiveUrlSuffix } from '@/hooks/useLiveUrlSuffix';
import { accountNavigationBack } from '@/lib/account-navigation';
import { tr } from '@/i18n/tr';
import './page-back-link.css';

export default function PageBackLink({ fallback = '/', className, contextOnly = false, miniProgramTarget, prefetch = false }: {
  fallback?: string; className?: string; contextOnly?: boolean; miniProgramTarget?: 'tools' | 'account'; prefetch?: false;
}) {
  const back = accountNavigationBack(useLiveUrlSuffix(), fallback);
  if (contextOnly && !back) return null;
  const props = { className: ['back-home', className].filter(Boolean).join(' '), prefetch,
    'aria-label': back ? tr({ zh: '返回上一层', en: 'Back to previous page' }) : fallback === '/' ? tr({ zh: '返回首页', en: 'Back to home' }) : tr({ zh: '返回上一层', en: 'Back to previous page' }) };
  const icon = <ChevronLeft size={16} aria-hidden="true" />;
  return !back && fallback === '/' ? <HomeLink {...props} miniProgramTarget={miniProgramTarget}>{icon}</HomeLink>
    : <AppLink {...props} href={back ?? fallback}>{icon}</AppLink>;
}
