'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from '@app-foundation/icons/lucide';
import Link from '@/components/AppLink';
import PersonLink from '@/components/PersonLink';
import { UserContactLink } from '@/components/UserIdLabel';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { tr, useLang } from '@/i18n/tr';
import { ownerDisplayName } from '@/lib/cuber-name-display';
import { fetchThread, type ThreadPageData } from '@/lib/forum-api';
import { formatRelativeTime } from '@/lib/forum-format';
import { ForumPostBody, forumPostPlaceholder } from './ForumPostBody';

const PAGE_SIZE = 5;

export default function ForumFeedReplies({ threadId, open, onCollapse }: {
  threadId: number;
  open: boolean;
  onCollapse: () => void;
}) {
  const lang = useLang();
  const [data, setData] = useState<ThreadPageData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const loaded = useRef(false);
  const request = useRef<AbortController | null>(null);

  const loadPage = useCallback(async (page: number) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(false);
    try {
      const next = await fetchThread(threadId, page, PAGE_SIZE, controller.signal);
      if (controller.signal.aborted) return;
      loaded.current = true;
      setData(previous => {
        if (!previous || page === 1) return next;
        const seen = new Set(previous.posts.map(post => post.id));
        return {
          ...next,
          posts: [...previous.posts, ...next.posts.filter(post => !seen.has(post.id))],
          authors: { ...previous.authors, ...next.authors },
        };
      });
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [threadId]);

  useEffect(() => {
    if (open && !loaded.current) void loadPage(1);
  }, [open, loadPage]);

  useEffect(() => () => {
    request.current?.abort();
    request.current = null;
  }, [threadId]);

  // Page totals include the first post and masked/deleted placeholders.
  const posts = data?.posts.filter(post => post.postNo !== 1) ?? [];
  const hasMore = !!data && data.page * data.size < data.total;
  const nextPage = data ? data.page + 1 : 1;

  return (
    <div className="community-feed-replies" hidden={!open} aria-busy={busy}>
      {posts.map(post => {
        const author = data?.authors[post.authorId];
        const name = ownerDisplayName(post.authorId, author?.name || post.authorName, lang === 'zh');
        const placeholder = forumPostPlaceholder(post);
        return (
          <article className="community-feed-reply" key={post.id}>
            {!placeholder && <div className="community-feed-byline">
              {author?.userId
                ? <UserContactLink userId={author.userId} className="community-feed-author">{name}</UserContactLink>
                : author?.wcaId
                  ? <PersonLink wcaId={author.wcaId} className="community-feed-author">{name}</PersonLink>
                  : <span className="community-feed-author">{name}</span>}
              <span aria-hidden="true">·</span>
              <time dateTime={post.createdAt}>{formatRelativeTime(post.createdAt, lang)}</time>
              {post.status !== 'approved' && <span>{post.status === 'pending'
                ? tr({ zh: '待审核', en: 'Pending review' })
                : tr({ zh: '未通过审核', en: 'Rejected' })}</span>}
            </div>}
            <ForumPostBody post={post} />
          </article>
        );
      })}
      {data && posts.length === 0 && !hasMore && <p className="community-feed-replies-notice">
        {tr({ zh: '暂无回复', en: 'No replies yet' })}
      </p>}
      {busy && <div role="status" className="community-feed-replies-notice">
        <LoadingIndicator>{tr({ zh: '加载中…', en: 'Loading…' })}</LoadingIndicator>
      </div>}
      {error && <div role="alert" className="community-feed-replies-notice">
        {tr({ zh: '回复加载失败', en: 'Could not load replies' })}
        <button type="button" className="community-feed-meta-action" onClick={() => void loadPage(nextPage)}>
          {tr({ zh: '重试', en: 'Retry' })}
        </button>
      </div>}
      <div className="community-feed-replies-actions">
        {hasMore && !error && <button type="button" className="community-feed-meta-action" disabled={busy} onClick={() => void loadPage(nextPage)}>
          <ChevronDown size={14} aria-hidden="true" />{tr({ zh: '展开更多', en: 'Show more' })}
        </button>}
        <Link href={`/forum/t/${threadId}`} prefetch={false} className="community-feed-meta-action">
          {tr({ zh: '完整讨论', en: 'Full discussion' })}
        </Link>
        <button type="button" className="community-feed-meta-action" onClick={onCollapse}>
          <ChevronUp size={14} aria-hidden="true" />{tr({ zh: '收起', en: 'Collapse' })}
        </button>
      </div>
    </div>
  );
}
