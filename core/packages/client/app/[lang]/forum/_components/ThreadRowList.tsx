'use client';

// Shared thread-row list: forum listing, search results and the index's
// latest-activity block all render the same row anatomy.
// title (+pin/lock) / starter + created / replies / views / last post.

import { Pin, Lock, MessageSquare, Eye } from 'lucide-react';
import Link from '@/components/AppLink';
import { tr, useLang } from '@/i18n/tr';
import { displayCuberName } from '@/lib/cuber-name-display';
import type { ForumThread, LatestThread, SearchThread } from '@/lib/forum-api';
import { formatRelativeTime, formatCount } from '../_lib/forum-format';

export const THREAD_PAGE_SIZE = 20;

function lastPostPage(t: ForumThread): number {
  // postTotal 含软删占位,楼层号按它排——replyCount 不含被删楼,算出的页会偏前
  return Math.max(1, Math.ceil(t.postTotal / THREAD_PAGE_SIZE));
}

type RowThread = ForumThread & Partial<Pick<LatestThread, 'forumSlug' | 'forumNameEn' | 'forumNameZh'>>
  & Partial<Pick<SearchThread, 'snippet'>>;

export function ThreadRow({ thread }: { thread: RowThread }) {
  const lang = useLang();
  const zh = lang === 'zh';
  const starter = displayCuberName(thread.authorName, zh);
  const lastBy = displayCuberName(thread.lastPostAuthorName, zh);
  const forumName = zh ? thread.forumNameZh : thread.forumNameEn;
  const lastPage = lastPostPage(thread);
  return (
    <div className={`forum-thread-row${thread.isPinned ? ' is-pinned' : ''}`}>
      <div className="forum-thread-main">
        <div className="forum-thread-title-line">
          {thread.isPinned && <Pin size={14} className="forum-thread-flag" aria-label={tr({ zh: '置顶', en: 'Pinned' })} />}
          {thread.isLocked && <Lock size={14} className="forum-thread-flag" aria-label={tr({ zh: '已锁定', en: 'Locked' })} />}
          <Link href={`/forum/t/${thread.id}`} prefetch={false} className="forum-thread-title">
            {thread.title}
          </Link>
          {forumName && thread.forumSlug && (
            <Link href={`/forum/f/${thread.forumSlug}`} prefetch={false} className="forum-thread-forum-chip">
              {forumName}
            </Link>
          )}
        </div>
        <div className="forum-thread-sub">
          <span className="forum-thread-starter">{starter}</span>
          <span>{formatRelativeTime(thread.createdAt, lang)}</span>
        </div>
        {thread.snippet && <div className="forum-thread-snippet">{thread.snippet}</div>}
      </div>
      <div className="forum-thread-counts">
        <span className="forum-thread-count" title={tr({ zh: '回复', en: 'Replies' })}>
          <MessageSquare size={13} aria-hidden="true" /> {formatCount(thread.replyCount, lang)}
        </span>
        <span className="forum-thread-count" title={tr({ zh: '查看', en: 'Views' })}>
          <Eye size={13} aria-hidden="true" /> {formatCount(thread.viewCount, lang)}
        </span>
      </div>
      <div className="forum-thread-last">
        <Link
          href={`/forum/t/${thread.id}?page=${lastPage}`}
          prefetch={false}
          className="forum-thread-last-time"
        >
          {formatRelativeTime(thread.lastPostAt, lang)}
        </Link>
        <span className="forum-thread-last-by">{lastBy}</span>
      </div>
    </div>
  );
}

export function ThreadRowList({ threads }: { threads: RowThread[] }) {
  return (
    <div className="forum-thread-rows">
      {threads.map(t => <ThreadRow key={t.id} thread={t} />)}
    </div>
  );
}
