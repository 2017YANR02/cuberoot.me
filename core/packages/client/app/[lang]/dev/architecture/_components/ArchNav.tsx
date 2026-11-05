'use client';

import PageBackLink from '@/components/PageBackLink';
import Link from '@/components/AppLink';
import { usePathname } from 'next/navigation';
import { tr } from '@/i18n/tr';

const TABS = [
  { path: '/dev/architecture',           zh: '概览',    en: 'Overview' },
  { path: '/dev/architecture/flow',      zh: '请求',    en: 'Requests' },
  { path: '/dev/architecture/log',       zh: '日志',    en: 'Log' },
] as const;

export default function ArchNav() {
  const pathname = usePathname();
  // strip /zh or /en prefix
  const base = pathname.replace(/^\/(zh|en)/, '');

  const isActive = (tabPath: string) => {
    if (tabPath === '/dev/architecture') return base === '/dev/architecture';
    return base.startsWith(tabPath);
  };

  // derive lang prefix for links (/zh or /en)
  const match = pathname.match(/^\/(zh|en)/);
  const prefix = match ? `/${match[1]}` : '';

  return (
    <nav className="arch-nav" aria-label="Architecture sections">
      <PageBackLink fallback={base === "/dev/architecture" ? "/dev" : "/dev/architecture"} className="arch-nav-back" />
      <div className="arch-nav-tabs" role="tablist">
        {TABS.map((tab) => (
          <Link
            key={tab.path}
            href={`${prefix}${tab.path}`}
            prefetch={false}
            role="tab"
            aria-selected={isActive(tab.path)}
            className={`arch-nav-tab${isActive(tab.path) ? ' active' : ''}`}
          >
            {tr(tab)}
          </Link>
        ))}
      </div>
    </nav>
  );
}
