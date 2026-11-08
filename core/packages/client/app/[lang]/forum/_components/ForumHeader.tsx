'use client';

import type { ReactNode } from 'react';
import { Plus, Search, ShieldCheck } from '@app-foundation/icons/lucide';
import Link from '@/components/AppLink';
import PageBackLink from '@/components/PageBackLink';
import WcaAuth from '@/components/WcaAuth';
import { T, tr } from '@/i18n/tr';
import { useIsAdmin } from '@/lib/auth-store';

export function ForumHeader({ activeView, children }: { activeView: 'feed' | 'boards' | 'mine'; children?: ReactNode }) {
  const isAdmin = useIsAdmin();
  return (
    <>
      <div className="forum-page-header forum-overview-header">
        <div className="forum-overview-title">
          <PageBackLink fallback={activeView === 'feed' ? '/forum' : '/'} />
          <h1><T zh="论坛" en="Forum" /></h1>
        </div>
        <div className="forum-header-actions">
          <Link href="/forum/search" prefetch={false} className="forum-btn-ghost">
            <Search size={15} aria-hidden="true" />
            <T zh="搜索" en="Search" />
          </Link>
          <Link href="/forum/new" prefetch={false} className="forum-btn-primary">
            <Plus size={15} aria-hidden="true" />
            <T zh="发帖" en="Post thread" />
          </Link>
          <WcaAuth />
        </div>
      </div>
      <div className="forum-view-toolbar">
        <nav className="forum-view-nav" aria-label={tr({ zh: '论坛视图', en: 'Forum views' })}>
          <Link href="/forum/feed" prefetch={false} aria-current={activeView === 'feed' ? 'page' : undefined}>
            <T zh="动态" en="Feed" />
          </Link>
          <Link href="/forum" prefetch={false} aria-current={activeView === 'boards' ? 'page' : undefined}>
            <T zh="版块" en="Boards" />
          </Link>
          <Link href="/forum/mine" prefetch={false} aria-current={activeView === 'mine' ? 'page' : undefined}>
            <T zh="我的" en="Mine" />
          </Link>
        </nav>
        <div className="forum-view-tools">
          {isAdmin && (
            <Link href="/forum/review" prefetch={false} className="forum-review-link">
              <ShieldCheck size={15} aria-hidden="true" />
              <T zh="审核" en="Review" />
            </Link>
          )}
          {children}
        </div>
      </div>
    </>
  );
}
