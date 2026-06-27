'use client';

import Link from '@/components/AppLink';
import { usePathname } from 'next/navigation';
import { tr } from '@/i18n/tr';

const TABS = [
  { path: '/code/architecture',           zh: '概览',    en: 'Overview' },
  { path: '/code/architecture/flow',      zh: '请求流程', en: 'Flow' },
  { path: '/code/architecture/decisions', zh: '技术决策', en: 'Decisions' },
  { path: '/code/architecture/history',   zh: '历程',    en: 'History' },
] as const;

export default function ArchNav() {
  const pathname = usePathname();
  // strip /zh or /en prefix
  const base = pathname.replace(/^\/(zh|en)/, '');

  const isActive = (tabPath: string) => {
    if (tabPath === '/code/architecture') return base === '/code/architecture';
    return base.startsWith(tabPath);
  };

  // derive lang prefix for links (/zh or /en)
  const match = pathname.match(/^\/(zh|en)/);
  const prefix = match ? `/${match[1]}` : '';

  return (
    <nav className="arch-nav" aria-label="Architecture sections">
      <Link href="/code" className="arch-nav-back">← /code</Link>
      <div className="arch-nav-tabs" role="tablist">
        {TABS.map((tab) => (
          <Link
            key={tab.path}
            href={`${prefix}${tab.path}`}
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
