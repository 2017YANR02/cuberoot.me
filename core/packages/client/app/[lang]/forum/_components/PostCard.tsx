'use client';

// One post in a thread: author card (left on desktop, top row on mobile),
// markdown body, meta line (#N permalink, edited mark), footer actions
// (react / quote / edit / delete).

import { useState } from 'react';
import { Link2, Quote, Pencil, Trash2, Check, Flag, ShieldCheck, Hourglass, CircleX } from 'lucide-react';
import Link from '@/components/AppLink';
import { tr, useLang } from '@/i18n/tr';
import { displayCuberName } from '@/lib/cuber-name-display';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import type { ForumPost, PostAuthor, ReactionKind } from '@/lib/forum-api';
import { formatRelativeTime, formatJoinedMonth, formatCount } from '../_lib/forum-format';
import { ReactionBar } from './ReactionBar';

export function PostCard({
  post, author, myKind, permalink, canEdit, canDelete, canQuote, canReport,
  onQuote, onEdit, onDelete, onReact, onReport, onModerate, bodyOverride,
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
  /** Replaces body + footer while keeping the post frame (inline edit). */
  bodyOverride?: React.ReactNode;
}) {
  const lang = useLang();
  const zh = lang === 'zh';
  const [copied, setCopied] = useState(false);
  const name = displayCuberName(author?.name || post.authorName, zh);

  const copyPermalink = async () => {
    try {
      await navigator.clipboard.writeText(permalink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable — ignore */ }
  };

  if (post.isDeleted) {
    return (
      <article className="forum-post is-deleted" id={`post-${post.id}`}>
        <div className="forum-post-deleted">
          #{post.postNo} {tr({ zh: '该帖已删除', en: 'This post was deleted' })}
        </div>
      </article>
    );
  }

  // 待审/驳回楼层:非作者非管理员拿到的是掩码空内容 → 只render占位,楼号不塌
  if (post.status !== 'approved' && !post.content) {
    return (
      <article className="forum-post is-deleted" id={`post-${post.id}`}>
        <div className="forum-post-deleted">
          #{post.postNo} {post.status === 'pending'
            ? tr({ zh: '该帖待审核', en: 'This post is awaiting review' })
            : tr({ zh: '该帖已删除', en: 'This post was deleted' })}
        </div>
      </article>
    );
  }

  const published = post.status === 'approved';

  return (
    <article className="forum-post" id={`post-${post.id}`}>
      <aside className="forum-post-author">
        {author?.avatarUrl ? (
          <img src={author.avatarUrl} alt="" className="forum-post-avatar" />
        ) : (
          <div className="forum-post-avatar forum-post-avatar-fallback" aria-hidden="true">
            {name[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="forum-post-author-meta">
          {author?.wcaId ? (
            <Link
              href={`/wca/persons/${author.wcaId}`}
              prefetch={false}
              className="forum-post-author-name"
            >
              {name}
            </Link>
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
                {tr({ zh: '注册于 ', en: 'Joined ' })}{formatJoinedMonth(author.joinedAt)}
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
        {bodyOverride ?? (
        <div className="forum-post-body">
          {post.status === 'rejected' && post.reviewNote && (
            <div className="forum-review-note">
              {tr({ zh: '驳回原因:', en: 'Reason: ' })}{post.reviewNote}
            </div>
          )}
          {renderArticleMarkdown(post.content)}
        </div>
        )}
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
          {published && canReport && (
            <button
              type="button" className="forum-post-action"
              title={tr({ zh: '向管理员举报此帖', en: 'Report this post to moderators' })}
              onClick={() => onReport(post)}
            >
              <Flag size={13} aria-hidden="true" /> {tr({ zh: '举报', en: 'Report' })}
            </button>
          )}
          {published && canQuote && (
            <button type="button" className="forum-post-action" onClick={() => onQuote(post)}>
              <Quote size={13} aria-hidden="true" /> {tr({ zh: '引用', en: 'Quote' })}
            </button>
          )}
          {canEdit && (
            <button type="button" className="forum-post-action" onClick={() => onEdit(post)}>
              <Pencil size={13} aria-hidden="true" /> {tr({ zh: '编辑', en: 'Edit' })}
            </button>
          )}
          {canDelete && (
            <button type="button" className="forum-post-action is-danger" onClick={() => onDelete(post)}>
              <Trash2 size={13} aria-hidden="true" /> {tr({ zh: '删除', en: 'Delete' })}
            </button>
          )}
        </div>
        )}
      </div>
    </article>
  );
}
