'use client';

// /forum/t/[id] — thread view: posts + reply composer + moderation.
// Sentinel shell: real id from window.location (see page.tsx).

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryState, parseAsInteger } from 'nuqs';
import { Pin, PinOff, Lock, LockOpen, Trash2, Pencil, Hourglass, CircleX, Check } from 'lucide-react';
import Paginator from '@/components/wca-stats/Paginator';
import { tr, T, useLang } from '@/i18n/tr';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useHashHighlight } from '@/hooks/useHashHighlight';
import { useAuthStore, useIsAdmin, useOwnerKey } from '@/lib/auth-store';
import {
  fetchThread, createPost, updatePost, deletePost, deleteThread, updateThread,
  reactToPost, trackThreadView, reportPost, moderateReview,
  type ThreadPageData, type ForumPost, type ReactionKind,
} from '@/lib/forum-api';
import { ForumBreadcrumbs } from '../../_components/ForumBreadcrumbs';
import { PostCard } from '../../_components/PostCard';
import { ForumComposer, type ForumComposerHandle } from '../../_components/ForumComposer';
import { ForumMarkdownEditor } from '../../_components/ForumMarkdownEditor';
import { formatCount } from '../../_lib/forum-format';
import '../../forum.css';
import './forum_thread.css';
import '@/components/hash-highlight.css';

const SIZE_DEFAULT = 20;

export default function ThreadClient() {
  const pathname = usePathname();
  const router = useRouter();
  const lang = useLang();
  const zh = lang === 'zh';
  const isAdmin = useIsAdmin();
  const myKey = useOwnerKey();

  const [threadId, setThreadId] = useState(0);
  useEffect(() => {
    const m = window.location.pathname.match(/\/forum\/t\/(\d+)/);
    setThreadId(m ? Number(m[1]) : 0);
  }, [pathname]);

  const [page, setPage] = useQueryState(
    'page', parseAsInteger.withDefault(1).withOptions({ history: 'push' }));
  const [size, setSize] = useQueryState('size', parseAsInteger.withDefault(SIZE_DEFAULT));

  const [data, setData] = useState<ThreadPageData | null>(null);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [editingPost, setEditingPost] = useState<ForumPost | null>(null);
  const [editText, setEditText] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const composerRef = useRef<ForumComposerHandle>(null);
  const viewedRef = useRef(0);
  // Post id to scroll to after the NEXT successful load (reply lands on a new page).
  const pendingScrollRef = useRef(0);
  // Monotonic request seq: a stale in-flight fetch must not clobber a newer page's data.
  const loadSeqRef = useRef(0);

  const load = useCallback(async (id: number, p: number, s: number) => {
    const seq = ++loadSeqRef.current;
    try {
      const d = await fetchThread(id, p, s);
      if (seq !== loadSeqRef.current) return null;
      setData(d);
      setError('');
      return d;
    } catch (e) {
      if (seq !== loadSeqRef.current) return null;
      setError((e as Error).message);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    (async () => {
      const d = await load(threadId, page, size);
      if (cancelled || !d) return;
      if (pendingScrollRef.current) {
        // A just-posted reply landed on this page — jump to it.
        const id = pendingScrollRef.current;
        pendingScrollRef.current = 0;
        requestAnimationFrame(() => {
          document.getElementById(`post-${id}`)?.scrollIntoView({ block: 'center' });
        });
      }
    })();
    return () => { cancelled = true; };
  }, [threadId, page, size, load]);

  // #post-N 永久链接(分享 / 从列表点进):滚到该帖并闪一下。帖子随分页异步加载,故 deps:[data];
  // resolve 只认 post-*。(刚发的回复落到本页那种滚动是自己发的、非锚点导航,仍走 pendingScrollRef。)
  useHashHighlight({
    highlightClass: 'hash-flash-target',
    block: 'start',
    linger: 1800,
    deps: [data],
    resolve: (h) => {
      const id = h.replace(/^#/, '');
      return id.startsWith('post-') ? document.getElementById(id) : null;
    },
  });

  // View counter: once per thread id per mount.
  useEffect(() => {
    if (!threadId || viewedRef.current === threadId) return;
    viewedRef.current = threadId;
    trackThreadView(threadId);
  }, [threadId]);

  useDocumentTitle(data?.thread.title ?? '论坛', data?.thread.title ?? 'Forum');

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;
  const isOwner = !!data && !!myKey && data.thread.authorId === myKey;
  const locked = !!data?.thread.isLocked;

  // Canonical page under the DEFAULT size — a shared link must not embed the
  // viewer's personal ?size, or it points at the wrong page for everyone else.
  const canonicalQsFor = (post: ForumPost) => {
    const p = Math.max(1, Math.ceil(post.postNo / SIZE_DEFAULT));
    return `${p > 1 ? `?page=${p}` : ''}#post-${post.id}`;
  };
  const permalinkFor = (post: ForumPost) =>
    `${window.location.origin}${window.location.pathname}${canonicalQsFor(post)}`;

  const handleQuote = (post: ForumPost) => {
    if (!myKey) { useAuthStore.getState().login(); return; }
    const link = `${window.location.pathname}${canonicalQsFor(post)}`;
    const quoted = post.content.split('\n').map(l => `> ${l}`).join('\n');
    // Blank "> " line keeps the attribution its own paragraph inside the quote.
    const block = `> **${post.authorName}** ([#${post.postNo}](${link}))\n> \n${quoted}\n\n`;
    setReply(r => (r ? `${r.replace(/\n*$/, '\n\n')}${block}` : block));
    composerRef.current?.focus();
  };

  const handleReplySubmit = async () => {
    if (!data) return;
    const res = await createPost(data.thread.id, reply.trim());
    setReply('');
    const lastPage = Math.max(1, Math.ceil(res.postNo / size));
    if (lastPage !== page) {
      // Page change re-runs the load effect; scroll there once it lands.
      pendingScrollRef.current = res.id;
      await setPage(lastPage);
    } else {
      await load(data.thread.id, page, size);
      requestAnimationFrame(() => {
        document.getElementById(`post-${res.id}`)?.scrollIntoView({ block: 'center' });
      });
    }
  };

  const handleEdit = (post: ForumPost) => {
    setEditingPost(post);
    setEditText(post.content);
  };

  const handleEditSave = async () => {
    if (!editingPost || !data) return;
    await updatePost(editingPost.id, editText.trim());
    setEditingPost(null);
    await load(data.thread.id, page, size);
  };

  const handleDeletePost = async (post: ForumPost) => {
    if (!data) return;
    if (!window.confirm(tr({ zh: '确定删除这条回复?', en: 'Delete this post?' }))) return;
    try {
      await deletePost(post.id);
      await load(data.thread.id, page, size);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleDeleteThread = async () => {
    if (!data) return;
    if (!window.confirm(tr({
      zh: '确定删除整个主题?所有回复将一并删除。',
      en: 'Delete the whole thread? All replies go with it.',
    }))) return;
    try {
      await deleteThread(data.thread.id);
      const prefix = lang === 'zh' ? '/zh' : '';
      router.push(`${prefix}/forum/f/${data.forum.slug}`);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleMod = async (patch: { isPinned?: boolean; isLocked?: boolean }) => {
    if (!data) return;
    try {
      await updateThread(data.thread.id, patch);
      await load(data.thread.id, page, size);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleTitleSave = async () => {
    if (!data) return;
    const title = titleDraft.trim();
    if (!title || title === data.thread.title) { setEditingTitle(false); return; }
    try {
      await updateThread(data.thread.id, { title });
      setEditingTitle(false);
      await load(data.thread.id, page, size);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleReport = async (post: ForumPost) => {
    if (!myKey) { useAuthStore.getState().login(); return; }
    const reason = window.prompt(tr({
      zh: '举报原因(必填,管理员会看到):',
      en: 'Report reason (required, visible to moderators):',
    }));
    if (reason === null) return;
    const trimmed = reason.trim().slice(0, 500);
    if (!trimmed) return;
    try {
      await reportPost(post.id, trimmed);
      alert(tr({ zh: '已举报,感谢反馈。', en: 'Reported — thanks for the heads-up.' }));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  // 管理员就地审核(单楼或整个主题)。驳回时 prompt 原因(会随通知发给作者)。
  const handleModerate = async (type: 'thread' | 'post', id: number, action: 'approve' | 'reject') => {
    let reason: string | undefined;
    if (action === 'reject') {
      const input = window.prompt(tr({
        zh: '驳回原因(可留空,作者会收到):',
        en: 'Rejection reason (optional, sent to the author):',
      }));
      if (input === null) return;
      reason = input.trim().slice(0, 500) || undefined;
    }
    try {
      await moderateReview(type, id, action, reason);
      if (data) await load(data.thread.id, page, size);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleReact = async (post: ForumPost, kind: ReactionKind | null) => {
    const res = await reactToPost(post.id, kind);
    setData(d => {
      if (!d) return d;
      const myReactions = { ...d.myReactions };
      if (kind) myReactions[String(post.id)] = kind;
      else delete myReactions[String(post.id)];
      return {
        ...d,
        posts: d.posts.map(p => (p.id === post.id ? { ...p, reactions: res.reactions } : p)),
        myReactions,
      };
    });
  };

  return (
    <div className="forum-page">
      <ForumBreadcrumbs items={data ? [
        { label: zh ? data.category.nameZh : data.category.nameEn },
        { label: zh ? data.forum.nameZh : data.forum.nameEn, href: `/forum/f/${data.forum.slug}` },
      ] : []} />

      {error && <div className="forum-error">{error}</div>}
      {!data && !error && <div className="forum-loading"><T zh="加载中…" en="Loading…" /></div>}

      {data && (
        <>
          <div className="forum-thread-head">
            {editingTitle ? (
              <div className="forum-title-edit">
                <input
                  className="forum-title-input"
                  value={titleDraft}
                  maxLength={200}
                  onChange={e => setTitleDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleTitleSave(); }}
                  autoFocus
                />
                <button type="button" className="forum-btn-primary" onClick={handleTitleSave}>
                  <T zh="保存" en="Save" />
                </button>
                <button type="button" className="forum-btn-text" onClick={() => setEditingTitle(false)}>
                  <T zh="取消" en="Cancel" />
                </button>
              </div>
            ) : (
              <h1 className="forum-thread-heading">
                {data.thread.isPinned && (
                  <span className="forum-badge"><Pin size={12} aria-hidden="true" /><T zh="置顶" en="Pinned" /></span>
                )}
                {locked && (
                  <span className="forum-badge"><Lock size={12} aria-hidden="true" /><T zh="已锁定" en="Locked" /></span>
                )}
                {data.thread.title}
              </h1>
            )}
            <div className="forum-thread-headmeta">
              <span>
                {formatCount(data.thread.viewCount, lang)}{tr({ zh: ' 次查看', en: ' views' })}
              </span>
              <span className="forum-composer-spacer" />
              {(isAdmin || (isOwner && !locked)) && !editingTitle && (
                <button
                  type="button" className="forum-post-action"
                  onClick={() => { setTitleDraft(data.thread.title); setEditingTitle(true); }}
                >
                  <Pencil size={13} aria-hidden="true" /> <T zh="改标题" en="Rename" />
                </button>
              )}
              {isAdmin && (
                <>
                  <button type="button" className="forum-post-action" onClick={() => handleMod({ isPinned: !data.thread.isPinned })}>
                    {data.thread.isPinned
                      ? <><PinOff size={13} aria-hidden="true" /> <T zh="取消置顶" en="Unpin" /></>
                      : <><Pin size={13} aria-hidden="true" /> <T zh="置顶" en="Pin" /></>}
                  </button>
                  <button type="button" className="forum-post-action" onClick={() => handleMod({ isLocked: !locked })}>
                    {locked
                      ? <><LockOpen size={13} aria-hidden="true" /> <T zh="解锁" en="Unlock" /></>
                      : <><Lock size={13} aria-hidden="true" /> <T zh="锁定" en="Lock" /></>}
                  </button>
                </>
              )}
              {(isAdmin || (isOwner && !locked)) && (
                <button type="button" className="forum-post-action is-danger" onClick={handleDeleteThread}>
                  <Trash2 size={13} aria-hidden="true" /> <T zh="删除主题" en="Delete thread" />
                </button>
              )}
            </div>
          </div>

          {data.thread.status === 'pending' && (
            <div className="forum-review-banner is-pending">
              <Hourglass size={14} aria-hidden="true" />
              <span>
                <T
                  zh="本主题待管理员审核,目前仅你和管理员可见。"
                  en="This thread is awaiting moderator review — only you and moderators can see it."
                />
              </span>
              {isAdmin && (
                <span className="forum-review-banner-actions">
                  <button
                    type="button" className="forum-post-action is-approve"
                    onClick={() => handleModerate('thread', data.thread.id, 'approve')}
                  >
                    <Check size={13} aria-hidden="true" /> <T zh="通过" en="Approve" />
                  </button>
                  <button
                    type="button" className="forum-post-action is-danger"
                    onClick={() => handleModerate('thread', data.thread.id, 'reject')}
                  >
                    <CircleX size={13} aria-hidden="true" /> <T zh="驳回" en="Reject" />
                  </button>
                </span>
              )}
            </div>
          )}
          {data.thread.status === 'rejected' && (
            <div className="forum-review-banner is-rejected">
              <CircleX size={14} aria-hidden="true" />
              <span>
                <T zh="本主题未通过审核,不会公开显示。" en="This thread was rejected and is not publicly visible." />
                {data.thread.reviewNote && (
                  <> {tr({ zh: '原因:', en: 'Reason: ' })}{data.thread.reviewNote}</>
                )}
              </span>
            </div>
          )}

          {(totalPages > 1 || size !== SIZE_DEFAULT) && (
            <Paginator
              page={page} totalPages={totalPages} size={size}
              pageSizeOptions={[20, 50]} isZh={zh}
              className="forum-pagination"
              onPageChange={setPage}
              onSizeChange={s => { setSize(s); setPage(1); }}
            />
          )}

          <div className="forum-posts">
            {data.posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                author={data.authors[post.authorId]}
                myKind={data.myReactions[String(post.id)] ?? null}
                permalink={permalinkFor(post)}
                canEdit={!post.isDeleted && (isAdmin || (!!myKey && post.authorId === myKey && !locked))}
                canDelete={!post.isDeleted && post.postNo !== 1 && (isAdmin || (!!myKey && post.authorId === myKey && !locked))}
                canQuote={!locked || isAdmin}
                canReport={!!myKey && post.authorId !== myKey}
                onQuote={handleQuote}
                onEdit={handleEdit}
                onDelete={handleDeletePost}
                onReact={handleReact}
                onReport={handleReport}
                onModerate={isAdmin ? (p, action) => handleModerate('post', p.id, action) : undefined}
                bodyOverride={editingPost?.id === post.id ? (
                  <div className="forum-post-editwrap">
                    <ForumMarkdownEditor
                      value={editText}
                      onChange={setEditText}
                    />
                    <div className="forum-composer-actions">
                      <span className="forum-composer-spacer" />
                      <button type="button" className="forum-btn-text" onClick={() => setEditingPost(null)}>
                        <T zh="取消" en="Cancel" />
                      </button>
                      <button
                        type="button" className="forum-btn-primary"
                        onClick={() => handleEditSave().catch(e => alert((e as Error).message))}
                        disabled={!editText.trim()}
                      >
                        <T zh="保存" en="Save" />
                      </button>
                    </div>
                  </div>
                ) : undefined}
              />
            ))}
          </div>

          {(totalPages > 1 || size !== SIZE_DEFAULT) && (
            <Paginator
              page={page} totalPages={totalPages} size={size}
              pageSizeOptions={[20, 50]} isZh={zh}
              className="forum-pagination"
              onPageChange={setPage}
              onSizeChange={s => { setSize(s); setPage(1); }}
            />
          )}

          <div className="forum-reply-block">
            {data.thread.status !== 'approved' && !isAdmin ? (
              <div className="forum-locked-note">
                <Hourglass size={14} aria-hidden="true" />
                <T zh="主题未公开,暂不能回复。" en="This thread isn't public yet — replies are closed." />
              </div>
            ) : locked && !isAdmin ? (
              <div className="forum-locked-note">
                <Lock size={14} aria-hidden="true" />
                <T zh="主题已锁定,不能回复。" en="This thread is locked — replies are closed." />
              </div>
            ) : (
              <>
                {locked && (
                  <div className="forum-locked-note">
                    <Lock size={14} aria-hidden="true" />
                    <T zh="主题已锁定(管理员仍可回复)。" en="Thread locked (admins can still reply)." />
                  </div>
                )}
                <ForumComposer
                  ref={composerRef}
                  value={reply}
                  onChange={setReply}
                  onSubmit={handleReplySubmit}
                  submitLabel={tr({ zh: '回复', en: 'Reply' })}
                  placeholder={tr({ zh: '写下你的回复…', en: 'Write your reply…' })}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
