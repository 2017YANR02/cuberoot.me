'use client';

// /forum — index: category groups of subforums + latest activity + stats.
// Structure modeled on classic forum landing (speedsolving-style taxonomy).

import { useEffect, useState } from 'react';
import { Plus, Search, ShieldCheck } from 'lucide-react';
import Link from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import WcaAuth from '@/components/WcaAuth';
import { tr, T, useLang } from '@/i18n/tr';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useIsAdmin } from '@/lib/auth-store';
import { displayCuberName } from '@/lib/cuber-name-display';
import {
  fetchForumIndex, fetchLatestThreads,
  type ForumIndexData, type LatestThread,
} from '@/lib/forum-api';
import { forumIcon } from './_lib/forum-icons';
import { formatRelativeTime, formatCount } from './_lib/forum-format';
import { ThreadRowList } from './_components/ThreadRowList';
import './forum.css';

export default function ForumIndexPage() {
  useDocumentTitle('论坛', 'Forum');
  const lang = useLang();
  const zh = lang === 'zh';
  const isAdmin = useIsAdmin();
  const [data, setData] = useState<ForumIndexData | null>(null);
  const [latest, setLatest] = useState<LatestThread[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchForumIndex()
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError((e as Error).message); });
    fetchLatestThreads(12)
      .then(d => { if (!cancelled) setLatest(d.threads); })
      .catch(() => { /* latest block is optional */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="forum-page">
      <BackHome />
      <div className="forum-page-header">
        <div>
          <h1><T zh="论坛" en="Forum" /></h1>
          <p className="forum-subtitle">
            <T zh="魔方速拧社区:提问、讨论、分享。" en="The speedcubing community: ask, discuss, share." />
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

      {error && <div className="forum-error">{error}</div>}
      {!data && !error && <div className="forum-loading"><T zh="加载中…" en="Loading…" /></div>}

      {data && (
        <div className="forum-index-layout">
          <div className="forum-index-main">
            {data.categories.map(cat => {
              // adminOnly only restricts POSTING — every forum stays readable.
              const forums = cat.forums;
              if (forums.length === 0) return null;
              return (
                <section key={cat.id} className="forum-cat">
                  <h2 className="forum-cat-title">{zh ? cat.nameZh : cat.nameEn}</h2>
                  <div className="forum-cat-forums">
                    {forums.map(f => {
                      const Icon = forumIcon(f.icon);
                      return (
                        <div key={f.id} className="forum-forum-row">
                          <Icon size={22} strokeWidth={1.5} className="forum-forum-icon" aria-hidden="true" />
                          <div className="forum-forum-main">
                            <Link href={`/forum/f/${f.slug}`} prefetch={false} className="forum-forum-name">
                              {zh ? f.nameZh : f.nameEn}
                            </Link>
                            <div className="forum-forum-desc">{zh ? f.descZh : f.descEn}</div>
                          </div>
                          <div className="forum-forum-counts">
                            <span>{tr({ zh: '主题 ', en: 'Threads ' })}{formatCount(f.threadCount, lang)}</span>
                            <span>{tr({ zh: '帖子 ', en: 'Posts ' })}{formatCount(f.postCount, lang)}</span>
                          </div>
                          <div className="forum-forum-last">
                            {f.lastThread ? (
                              <>
                                <Link
                                  href={`/forum/t/${f.lastThread.id}`}
                                  prefetch={false}
                                  className="forum-forum-last-title"
                                  title={f.lastThread.title}
                                >
                                  {f.lastThread.title}
                                </Link>
                                <span className="forum-forum-last-sub">
                                  {displayCuberName(f.lastThread.lastPostAuthorName, zh)}
                                  {' '}
                                  {formatRelativeTime(f.lastThread.lastPostAt, lang)}
                                </span>
                              </>
                            ) : (
                              <span className="forum-forum-last-sub"><T zh="暂无主题" en="No threads yet" /></span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <aside className="forum-index-side">
            <section className="forum-side-block">
              <h2 className="forum-cat-title"><T zh="最新活跃" en="Latest activity" /></h2>
              {latest.length > 0
                ? <ThreadRowList threads={latest} />
                : <div className="forum-forum-last-sub"><T zh="还没有动态" en="Nothing yet" /></div>}
            </section>
            <section className="forum-side-block forum-stats-block">
              <h2 className="forum-cat-title"><T zh="论坛统计" en="Forum statistics" /></h2>
              <dl className="forum-stats">
                <div><dt><T zh="主题" en="Threads" /></dt><dd>{formatCount(data.stats.threads, lang)}</dd></div>
                <div><dt><T zh="帖子" en="Posts" /></dt><dd>{formatCount(data.stats.posts, lang)}</dd></div>
                <div><dt><T zh="成员" en="Members" /></dt><dd>{formatCount(data.stats.members, lang)}</dd></div>
                {data.stats.latestMemberName && (
                  <div>
                    <dt><T zh="最新成员" en="Newest member" /></dt>
                    <dd>{displayCuberName(data.stats.latestMemberName, zh)}</dd>
                  </div>
                )}
              </dl>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
