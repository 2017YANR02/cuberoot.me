'use client';

// One post in a thread: author card (left on desktop, top row on mobile),
// markdown body, meta line (#N permalink, edited mark), footer actions
// (react / quote / edit / delete).

import { useState } from 'react';
import { Link2, Quote, Pencil, Trash2, Check, Flag, ShieldCheck, Hourglass, CircleX, UserRoundX, UserRoundCheck } from '@app-foundation/icons/lucide';
import PersonLink from '@/components/PersonLink';
import { tr, useLang } from '@/i18n/tr';
import { ownerDisplayName } from '@/lib/cuber-name-display';
import { resolveAccountAvatar } from '@/lib/account-avatar';
import type { ForumPost, PostAuthor, ReactionKind } from '@/lib/forum-api';
import { formatRelativeTime, formatJoinedDate, formatCount } from '@/lib/forum-format';
import { ReactionBar } from './ReactionBar';
import { ForumPostBody, forumPostPlaceholder } from '@/components/forum/ForumPostBody';
import { UserContactLink } from '@/components/UserIdLabel';
import { ForumIconButton } from '@/components/forum/ForumIconButton';

export function PostCard({
  post, author, myKind, permalink, canEdit, canDelete, canQuote, canReport,
  onQuote, onEdit, onDelete, onReact, onReport, onModerate, onToggleBan, bodyOverride,
}: {
  post: ForumPost;
  author: PostAuthor | undefined;
  myKind: ReactionKind | null;
  /** Absolute URL for the #N permalink copy button. */
  permalink: string;
  canEdit: boolean;
  canDelete: boolean;
  /** False in locked threads for non-admins — quoting a closed thread is a dead end. */
  canQuote: boolean;
  canReport: boolean;
  onQuote: (post: ForumPost) => void;
  onEdit: (post: ForumPost) => void;
  onDelete: (post: ForumPost) => void;
  onReact: (post: ForumPost, kind: ReactionKind | null) => Promise<void>;
  onReport: (post: ForumPost) => void;
  /** 管理员对待审楼层就地过审/驳回;不传 = 非管理员,不显按钮。 */
  onModerate?: (post: ForumPost, action: 'approve' | 'reject') => void;
  onToggleBan?: (userId: number, banned: boolean) => void;
  /** Replaces body + footer while keeping the post frame (inline edit). */
  bodyOverride?: React.ReactNode;
}) {
  const lang = useLang();
  const zh = lang === 'zh';
  const [copied, setCopied] = useState(false);
  const name = ownerDisplayName(post.authorId, author?.name || post.authorName, zh);
  const avatar = resolveAccountAvatar(author?.avatarUrl, author?.avatarPreset);

  const copyPermalink = async () => {
    try {
      await navigator.clipboard.writeText(permalink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable — ignore */ }
  };

  const placeholder = forumPostPlaceholder(post);
  if (placeholder) {
    return (
      <article className="forum-post is-deleted" id={`post-${post.id}`}>
        <div className="forum-post-deleted">
          #{post.postNo} {placeholder}
        </div>
      </article>
    );
  }

  const published = post.status === 'approved';

  return (
    <article className="forum-post" id={`post-${post.id}`}>
      <aside className="forum-post-author">
        <UserContactLink userId={author?.userId} label={name} className={`forum-post-avatar${avatar.isClawd ? ' is-clawd' : ''}`}>
          <img src={avatar.src} alt="" />
        </UserContactLink>
        <div className="forum-post-author-meta">
          {author?.userId ? (
            <UserContactLink userId={author.userId} className="forum-post-author-name">{name}</UserContactLink>
          ) : author?.wcaId ? (
            <PersonLink wcaId={author.wcaId} className="forum-post-author-name">
              {name}
            </PersonLink>
          ) : (
            <span className="forum-post-author-name">{name}</span>
          )}
          {author?.isAdmin && (
            <span className="forum-staff-badge">
              <ShieldCheck size={11} aria-hidden="true" />
              {tr({ zh: '管理员', en: 'Staff' })}
            </span>
          )}
          <span className="forum-post-author-stats">
            {author?.joinedAt && (
              <span title={tr({ zh: '注册时间', en: 'Joined' })}>
                {tr({ zh: '注册于 ', en: 'Joined ' })}{formatJoinedDate(author.joinedAt)}
              </span>
            )}
            <span title={tr({ zh: '发帖数', en: 'Posts' })}>
              {tr({ zh: '帖子 ', en: 'Posts ' })}{formatCount(author?.postCount ?? 0, lang)}
            </span>
          </span>
        </div>
      </aside>
      <div className="forum-post-main">
        <div className="forum-post-meta">
          <span className="forum-post-time">{formatRelativeTime(post.createdAt, lang)}</span>
          {post.editedAt && (
            <span className="forum-post-edited">{tr({ zh: '(已编辑)', en: '(edited)' })}</span>
          )}
          {post.status === 'pending' && (
            <span className="forum-badge forum-badge-pending">
              <Hourglass size={11} aria-hidden="true" />
              {tr({ zh: '待审核', en: 'Pending review' })}
            </span>
          )}
          {post.status === 'rejected' && (
            <span className="forum-badge forum-badge-rejected">
              <CircleX size={11} aria-hidden="true" />
              {tr({ zh: '未通过审核', en: 'Rejected' })}
            </span>
          )}
          <span className="forum-composer-spacer" />
          <button
            type="button"
            className="forum-post-permalink"
            title={tr({ zh: '复制本楼链接', en: 'Copy link to this post' })}
            onClick={copyPermalink}
          >
            {copied
              ? <Check size={12} aria-hidden="true" />
              : <Link2 size={12} aria-hidden="true" />}
            #{post.postNo}
          </button>
        </div>
        {bodyOverride ?? <ForumPostBody post={post} />}
        {!bodyOverride && (
        <div className="forum-post-footer">
          {published && (
          <ReactionBar
            reactions={post.reactions}
            myKind={myKind}
            onReact={kind => onReact(post, kind)}
          />
          )}
          <span className="forum-composer-spacer" />
          {post.status === 'pending' && onModerate && (
            <>
              <button
                type="button" className="forum-post-action is-approve"
                onClick={() => onModerate(post, 'approve')}
              >
                <Check size={13} aria-hidden="true" /> {tr({ zh: '通过', en: 'Approve' })}
              </button>
              <button
                type="button" className="forum-post-action is-danger"
                onClick={() => onModerate(post, 'reject')}
              >
                <CircleX size={13} aria-hidden="true" /> {tr({ zh: '驳回', en: 'Reject' })}
              </button>
            </>
          )}
          {onToggleBan && author?.userId && !author.isAdmin && (
            <ForumIconButton
              icon={author.forumBanned ? UserRoundCheck : UserRoundX}
              label={author.forumBanned ? tr({ zh: '解除拉黑', en: 'Unban user' }) : tr({ zh: '拉黑', en: 'Ban user' })}
              className="is-danger"
              onClick={() => onToggleBan(author.userId!, !author.forumBanned)}
            />
          )}
          {published && canReport && (
            <ForumIconButton icon={Flag} label={tr({ zh: '举报', en: 'Report post' })} onClick={() => onReport(post)} />
          )}
          {published && canQuote && (
            <ForumIconButton icon={Quote} label={tr({ zh: '引用', en: 'Quote post' })} onClick={() => onQuote(post)} />
          )}
          {canEdit && (
            <ForumIconButton icon={Pencil} label={tr({ zh: '编辑', en: 'Edit post' })} onClick={() => onEdit(post)} />
          )}
          {canDelete && (
            <ForumIconButton icon={Trash2} label={tr({ zh: '删除', en: 'Delete post' })} className="is-danger" onClick={() => onDelete(post)} />
          )}
        </div>
        )}
      </div>
    </article>
  );
}
