'use client';

import { Plus, Search, ShieldCheck } from 'lucide-react';
import Link from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import WcaAuth from '@/components/WcaAuth';
import { T, tr } from '@/i18n/tr';
import { useIsAdmin } from '@/lib/auth-store';

export function ForumHeader({ activeView }: { activeView: 'feed' | 'boards' }) {
  const isAdmin = useIsAdmin();
  return (
    <>
      <div className="forum-back-row"><BackHome /></div>
      <div className="forum-page-header">
        <div>
          <h1>
            {activeView === 'feed'
              ? <T zh="社区动态" en="Community feed" />
              : <T zh="论坛" en="Forum" />}
          </h1>
          <p className="forum-subtitle">
            {activeView === 'feed'
              ? <T zh="按时间浏览各版块的新主题与活跃讨论。" en="Browse new and active discussions across every board." />
              : <T zh="魔方速拧社区:提问、讨论、分享。" en="The speedcubing community: ask, discuss, share." />}
          </p>
        </div>
        <div className="forum-header-actions">
          {isAdmin && (
            <Link href="/forum/review" prefetch={false} className="forum-btn-ghost" title={tr({ zh: '审核', en: 'Moderation' })}>
              <ShieldCheck size={15} aria-hidden="true" />
              <T zh="审核" en="Review" />
            </Link>
          )}
          <Link href="/forum/search" prefetch={false} className="forum-btn-ghost" title={tr({ zh: '搜索', en: 'Search' })}>
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
      <nav className="forum-view-nav" aria-label={tr({ zh: '论坛视图', en: 'Forum views' })}>
        <Link href="/forum/feed" prefetch={false} aria-current={activeView === 'feed' ? 'page' : undefined}>
          <T zh="动态" en="Feed" />
        </Link>
        <Link href="/forum" prefetch={false} aria-current={activeView === 'boards' ? 'page' : undefined}>
          <T zh="版块" en="Boards" />
        </Link>
      </nav>
    </>
  );
}
