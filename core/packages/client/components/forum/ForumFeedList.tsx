'use client';

import { Eye, MessageCircle } from 'lucide-react';
import Link from '@/components/AppLink';
import PersonLink from '@/components/PersonLink';
import { tr, useLang } from '@/i18n/tr';
import { ownerDisplayName } from '@/lib/cuber-name-display';
import { formatCount, formatRelativeTime } from '@/lib/forum-format';
import { REACTION_EMOJI, type ForumFeedThread } from '@/lib/forum-api';
import './forum-feed.css';

export function ForumFeedList({ threads, compact = false }: { threads: ForumFeedThread[]; compact?: boolean }) {
  const lang = useLang();
  const zh = lang === 'zh';

  return (
    <div className={`community-feed-list${compact ? ' is-compact' : ''}`}>
      {threads.map((thread) => {
        const displayName = ownerDisplayName(thread.authorId, thread.author.name || thread.authorName, zh);
        const reactionCount = thread.reactions.reduce((sum, reaction) => sum + reaction.count, 0);
        return (
          <article className="community-feed-item" key={thread.id}>
            <div className="community-feed-avatar" aria-hidden="true">
              {thread.author.avatarUrl
                ? <img src={thread.author.avatarUrl} alt="" />
                : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
            </div>
            <div className="community-feed-main">
              <div className="community-feed-byline">
                <PersonLink wcaId={thread.author.wcaId ?? thread.authorId} className="community-feed-author">
                  {displayName}
                </PersonLink>
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
              <div className="community-feed-meta">
                <span title={tr({ zh: `${reactionCount} 个反应`, en: `${reactionCount} reactions` })}>
                  <span className="community-feed-reactions" aria-hidden="true">
                    {thread.reactions.slice(0, 3).map((reaction) => REACTION_EMOJI[reaction.kind]).join('') || '♡'}
                  </span>
                  {formatCount(reactionCount, lang)}
                </span>
                <span><MessageCircle size={14} aria-hidden="true" />{formatCount(thread.replyCount, lang)}</span>
                <span><Eye size={14} aria-hidden="true" />{formatCount(thread.viewCount, lang)}</span>
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
