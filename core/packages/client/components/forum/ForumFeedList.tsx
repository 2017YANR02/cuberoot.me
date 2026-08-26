'use client';

import { useEffect, useState } from 'react';
import { Eye, Heart, MessageCircle } from 'lucide-react';
import Link from '@/components/AppLink';
import PersonLink from '@/components/PersonLink';
import { tr, useLang } from '@/i18n/tr';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import { ownerDisplayName } from '@/lib/cuber-name-display';
import { resolveAccountAvatar } from '@/lib/account-avatar';
import { formatCount, formatRelativeTime } from '@/lib/forum-format';
import {
  reactToPost,
  type ForumFeedThread,
  type PostReaction,
  type ReactionKind,
} from '@/lib/forum-api';
import { ForumVideoPlayer } from './ForumVideoPlayer';
import { UserIdLabel } from '@/components/UserIdLabel';
import './forum-feed.css';

export function ForumFeedList({ threads, compact = false }: { threads: ForumFeedThread[]; compact?: boolean }) {
  const lang = useLang();
  const zh = lang === 'zh';
  const user = useAuthUser();
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
        return (
          <article className="community-feed-item" key={thread.id}>
            <div className={`community-feed-avatar${avatar.isClawd ? ' is-clawd' : ''}`} aria-hidden="true">
              <img src={avatar.src} alt="" />
            </div>
            <div className="community-feed-main">
              <div className="community-feed-byline">
                <PersonLink wcaId={thread.author.wcaId ?? thread.authorId} className="community-feed-author">
                  {displayName}
                </PersonLink>
                <UserIdLabel userId={thread.author.userId} />
                <span aria-hidden="true">/</span>
                <Link href={`/forum/f/${thread.forumSlug}`} prefetch={false} className="community-feed-board">
                  {zh ? thread.forumNameZh : thread.forumNameEn}
                </Link>
                <span>{formatRelativeTime(thread.createdAt, lang)}</span>
              </div>
              <Link href={`/forum/t/${thread.id}`} prefetch={false} className="community-feed-title">
                {thread.title}
              </Link>
              {thread.excerpt && <p className="community-feed-excerpt">{thread.excerpt}</p>}
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
                    zh: currentReaction.myReaction ? '取消回应' : '点赞',
                    en: currentReaction.myReaction ? 'Remove reaction' : 'Like',
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
                  {formatCount(reactionCount, lang)}
                </button>
                <Link
                  href={`/forum/t/${thread.id}`}
                  prefetch={false}
                  className="community-feed-meta-action"
                  aria-label={tr({ zh: `查看 ${thread.replyCount} 条回复`, en: `View ${thread.replyCount} replies` })}
                >
                  <MessageCircle size={14} aria-hidden="true" />{formatCount(thread.replyCount, lang)}
                </Link>
                <Link
                  href={`/forum/t/${thread.id}`}
                  prefetch={false}
                  className="community-feed-meta-action"
                  aria-label={tr({ zh: `查看主题，已有 ${thread.viewCount} 次浏览`, en: `View thread with ${thread.viewCount} views` })}
                >
                  <Eye size={14} aria-hidden="true" />{formatCount(thread.viewCount, lang)}
                </Link>
                {thread.lastPostAt !== thread.createdAt && (
                  <span className="community-feed-active">
                    {tr({ zh: `活跃于 ${formatRelativeTime(thread.lastPostAt, lang)}`, en: `active ${formatRelativeTime(thread.lastPostAt, lang)}` })}
                  </span>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
