'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { ChevronRight, Eye, Heart, MessageCircle } from '@app-foundation/icons/lucide';
import Link from '@/components/AppLink';
import PersonLink from '@/components/PersonLink';
import { tr, useLang } from '@/i18n/tr';
import { useAuthStore, useAuthUser, useIsAdmin, useOwnerKey } from '@/lib/auth-store';
import { ownerDisplayName } from '@/lib/cuber-name-display';
import { resolveAccountAvatar } from '@/lib/account-avatar';
import { formatCount, formatPostTime } from '@/lib/forum-format';
import {
  reactToPost,
  type ForumFeedThread,
  type PostReaction,
  type ReactionKind,
} from '@/lib/forum-api';
import { ForumVideoPlayer } from './ForumVideoPlayer';
import { ForumReplySkeleton } from './ForumReplySkeleton';
import { UserContactLink } from '@/components/UserIdLabel';
import './forum-feed.css';

const ForumFeedReplies = dynamic(() => import('./ForumFeedReplies'), {
  loading: () => <div className="community-feed-replies">
    <ForumReplySkeleton />
  </div>,
});

export function ForumFeedList<T extends ForumFeedThread>({ threads, compact = false, timeMode = 'published', renderBylineEnd }: {
  threads: T[]; compact?: boolean; timeMode?: 'published' | 'activity'; renderBylineEnd?: (thread: T) => ReactNode;
}) {
  const lang = useLang();
  const zh = lang === 'zh';
  const user = useAuthUser();
  const ownerKey = useOwnerKey();
  const isAdmin = useIsAdmin();
  const repliesId = useId();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [busyPostId, setBusyPostId] = useState<number | null>(null);
  const [reactionState, setReactionState] = useState<Record<number, {
    reactions: PostReaction[];
    myReaction: ReactionKind | null;
  }>>({});

  useEffect(() => {
    setReactionState(Object.fromEntries(threads.map((thread) => [thread.id, {
      reactions: thread.reactions,
      myReaction: thread.myReaction ?? null,
    }])));
  }, [threads]);

  const toggleReaction = async (thread: ForumFeedThread) => {
    if (!user) {
      useAuthStore.getState().login();
      return;
    }
    if (busyPostId !== null) return;
    const current = reactionState[thread.id] ?? {
      reactions: thread.reactions,
      myReaction: thread.myReaction ?? null,
    };
    const nextReaction = current.myReaction ? null : 'like';
    setBusyPostId(thread.firstPostId);
    try {
      const result = await reactToPost(thread.firstPostId, nextReaction);
      setReactionState((previous) => ({
        ...previous,
        [thread.id]: { reactions: result.reactions, myReaction: nextReaction },
      }));
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setBusyPostId(null);
    }
  };

  return (
    <div className={`community-feed-list${compact ? ' is-compact' : ''}`}>
      {threads.map((thread) => {
        const displayName = ownerDisplayName(thread.authorId, thread.author.name || thread.authorName, zh);
        const avatar = resolveAccountAvatar(thread.author.avatarUrl, thread.author.avatarPreset);
        const currentReaction = reactionState[thread.id] ?? {
          reactions: thread.reactions,
          myReaction: thread.myReaction ?? null,
        };
        const reactionCount = currentReaction.reactions.reduce((sum, reaction) => sum + reaction.count, 0);
        const imageUrls = thread.imageUrls ?? [];
        const videos = thread.videos ?? [];
        const showReplyTime = timeMode === 'activity' && thread.replyCount > 0
          && Date.parse(thread.lastPostAt) > Date.parse(thread.createdAt);
        const timestamp = showReplyTime ? thread.lastPostAt : thread.createdAt;
        const displayTime = formatPostTime(timestamp, lang);
        return (
          <article className="community-feed-item" key={thread.id}>
            <div className={`community-feed-avatar${avatar.isClawd ? ' is-clawd' : ''}`} aria-hidden="true">
              <img src={avatar.src} alt="" />
            </div>
            <div className="community-feed-main">
              <div className="community-feed-byline">
                {thread.author.userId ? <UserContactLink userId={thread.author.userId} className="community-feed-author">{displayName}</UserContactLink> : <PersonLink wcaId={thread.author.wcaId ?? thread.authorId} className="community-feed-author">{displayName}</PersonLink>}
                <span aria-hidden="true">·</span>
                <time dateTime={timestamp}>{showReplyTime
                  ? tr({ zh: `最近回复 ${displayTime}`, en: `Last reply ${displayTime}` })
                  : displayTime}</time>
                <span aria-hidden="true">·</span>
                <Link href={`/forum/f/${thread.forumSlug}`} prefetch={false} className="community-feed-board">
                  {tr({ zh: thread.forumNameZh, en: thread.forumNameEn })}
                </Link>
                {renderBylineEnd?.(thread)}
              </div>
              <Link href={`/forum/t/${thread.id}`} prefetch={false} className="community-feed-content">
                <span className="community-feed-title">{thread.title}</span>
                {thread.excerpt && <p className="community-feed-excerpt">{thread.excerpt}</p>}
              </Link>
              {!compact && imageUrls.length > 0 && (
                <div className={`community-feed-images${imageUrls.length === 1 ? ' is-single' : ''}`}>
                  {imageUrls.slice(0, 4).map((url, index) => (
                    <Link key={`${url}-${index}`} href={`/forum/t/${thread.id}`} prefetch={false}>
                      <img src={url} alt={tr({ zh: `帖子图片 ${index + 1}`, en: `Post image ${index + 1}` })} loading="lazy" />
                    </Link>
                  ))}
                </div>
              )}
              {!compact && videos.map((video) => <ForumVideoPlayer key={video.id} video={video} />)}
              <div className="community-feed-meta">
                <button
                  type="button"
                  className={`community-feed-meta-action community-feed-reaction-action${currentReaction.myReaction ? ' is-mine' : ''}`}
                  aria-label={tr({
                    zh: `${currentReaction.myReaction ? '取消回应' : '点赞'}，${reactionCount} 次回应`,
                    en: `${currentReaction.myReaction ? 'Remove reaction' : 'Like'}, ${reactionCount} reactions`,
                  })}
                  title={tr({
                    zh: currentReaction.myReaction ? '取消回应' : '点赞',
                    en: currentReaction.myReaction ? 'Remove reaction' : 'Like',
                  })}
                  aria-pressed={currentReaction.myReaction !== null}
                  onClick={() => void toggleReaction(thread)}
                  disabled={busyPostId !== null}
                >
                  <Heart className="community-feed-heart" size={14} aria-hidden="true" />
                  <span className="community-feed-count" aria-hidden="true">{reactionCount > 0 ? formatCount(reactionCount, lang) : ''}</span>
                </button>
                {compact || thread.replyCount === 0 ? <Link
                  href={`/forum/t/${thread.id}`}
                  prefetch={false}
                  className="community-feed-meta-action"
                  aria-label={thread.replyCount === 0
                    ? tr({ zh: '回复', en: 'Reply' })
                    : tr({ zh: `查看 ${thread.replyCount} 条回复`, en: `View ${thread.replyCount} replies` })}
                >
                  <MessageCircle size={14} aria-hidden="true" />
                  <span className="community-feed-count" aria-hidden="true">{thread.replyCount > 0 ? formatCount(thread.replyCount, lang) : ''}</span>
                </Link> : <button
                  type="button"
                  id={`${repliesId}-trigger-${thread.id}`}
                  className="community-feed-meta-action"
                  aria-label={tr({ zh: `${expanded[thread.id] ? '收起' : '展开'} ${thread.replyCount} 条回复`, en: `${expanded[thread.id] ? 'Collapse' : 'Expand'} ${thread.replyCount} replies` })}
                  aria-expanded={!!expanded[thread.id]}
                  aria-controls={`${repliesId}-${thread.id}`}
                  onClick={() => setExpanded(previous => ({ ...previous, [thread.id]: !previous[thread.id] }))}
                >
                  <MessageCircle size={14} aria-hidden="true" />
                  <span className="community-feed-count" aria-hidden="true">{thread.replyCount > 0 ? formatCount(thread.replyCount, lang) : ''}</span>
                  <ChevronRight className="community-feed-reply-chevron" size={12} aria-hidden="true" />
                </button>}
                <Link
                  href={`/forum/t/${thread.id}`}
                  prefetch={false}
                  className="community-feed-meta-action"
                  aria-label={tr({ zh: `查看主题，已有 ${thread.viewCount} 次浏览`, en: `View thread with ${thread.viewCount} views` })}
                >
                  <Eye size={14} aria-hidden="true" />
                  <span className="community-feed-count" aria-hidden="true">{formatCount(thread.viewCount, lang)}</span>
                </Link>
              </div>
              {!compact && thread.replyCount > 0 && <div
                id={`${repliesId}-${thread.id}`}
                className="community-feed-replies-panel"
                data-open={!!expanded[thread.id]}
                aria-hidden={!expanded[thread.id]}
                inert={!expanded[thread.id]}
              >
                <div className="community-feed-replies-clip">
                  {expanded[thread.id] !== undefined && <ForumFeedReplies
                    key={`${thread.id}:${ownerKey}:${isAdmin}`}
                    threadId={thread.id}
                    open={!!expanded[thread.id]}
                    onCollapse={() => {
                      setExpanded(previous => ({ ...previous, [thread.id]: false }));
                      document.getElementById(`${repliesId}-trigger-${thread.id}`)?.focus({ preventScroll: true });
                    }}
                  />}
                </div>
              </div>}
            </div>
          </article>
        );
      })}
    </div>
  );
}
