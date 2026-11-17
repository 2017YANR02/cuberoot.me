'use client';
import { ChevronLeft } from '@app-foundation/icons/lucide';
import AppLink from './AppLink';
import HomeLink from './HomeLink';
import { readEntryNavigationBack, subscribeEntryNavigation } from '@/lib/entry-navigation';
import { tr } from '@/i18n/tr';
import { useSyncExternalStore, type AnchorHTMLAttributes } from 'react';
import { usePathname } from 'next/navigation';
import { installedWebsiteSurface } from '@/lib/installed-content';
import './page-back-link.css';

const subscribeSurface = () => () => undefined;
const serverSurface = () => null;
const isHome = (href: string) => /^\/(en|zh)?\/?(?:[?#]|$)/.test(href);

export default function PageBackLink({ fallback = '/', className, contextOnly = false, miniProgramTarget, prefetch = false, ...rest }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  fallback?: string; className?: string; contextOnly?: boolean; miniProgramTarget?: 'tools' | 'account'; prefetch?: false;
}) {
  const back = useSyncExternalStore(subscribeEntryNavigation, readEntryNavigationBack, () => null);
  const surface = useSyncExternalStore(subscribeSurface, installedWebsiteSurface, serverSurface);
  const pathname = usePathname();
  // Account has its own persistent tab. Its root has no website-home parent.
  const accountFallback = surface === 'account' && (!back || isHome(back));
  if (accountFallback && /^\/(?:en\/|zh\/)?account\/?$/.test(pathname ?? '')) return null;
  if (contextOnly && !back) return null;
  const target = accountFallback && isHome(fallback) ? '/account' : back ?? fallback;
  const props = { ...rest, className: ['back-home', className].filter(Boolean).join(' '), prefetch,
    'aria-label': back ? tr({ zh: '返回上一层', en: 'Back to previous page' }) : rest['aria-label'] ?? (target === '/' ? tr({ zh: '返回首页', en: 'Back to home' }) : tr({ zh: '返回上一层', en: 'Back to previous page' })) };
  const icon = <ChevronLeft size={16} aria-hidden="true" />;
  return !back && target === '/' ? <HomeLink {...props} miniProgramTarget={miniProgramTarget}>{icon}</HomeLink>
    : <AppLink {...props} href={target} navigation="return">{icon}</AppLink>;
}
