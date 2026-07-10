'use client';

// Breadcrumb trail: 论坛 › category › forum. Items with href render as links.

import { ChevronRight } from 'lucide-react';
import Link from '@/components/AppLink';
import { tr } from '@/i18n/tr';

export interface Crumb {
  label: string;
  href?: string;
}

export function ForumBreadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ label: tr({ zh: '论坛', en: 'Forum' }), href: '/forum' }, ...items];
  return (
    <nav className="forum-crumbs" aria-label={tr({ zh: '面包屑', en: 'Breadcrumbs' })}>
      {all.map((c, i) => (
        <span key={i} className="forum-crumb">
          {i > 0 && <ChevronRight size={13} className="forum-crumb-sep" aria-hidden="true" />}
          {c.href ? (
            <Link href={c.href} prefetch={false} className="forum-crumb-link">{c.label}</Link>
          ) : (
            <span className="forum-crumb-here">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
