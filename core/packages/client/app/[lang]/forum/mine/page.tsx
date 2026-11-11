'use client';

import { useCallback, useEffect, useState } from 'react';
import { parseAsInteger, parseAsStringEnum, useQueryState } from 'nuqs';
import { Ellipsis } from '@app-foundation/icons/lucide';
import { CompactSelect } from '@/components/CompactSelect';
import { ForumFeedList } from '@/components/forum/ForumFeedList';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import Paginator from '@/components/wca-stats/Paginator';
import { useEntryRouter } from '@/hooks/useEntryRouter';
import { useOwnerKey, authActions } from '@/lib/auth-store';
import { deletePost, deleteThread, fetchForumMine, type ForumMineData, type ForumMineKind, type ForumMineThread } from '@/lib/forum-api';
import { tr, useLang } from '@/i18n/tr';
import { ForumHeader } from '../_components/ForumHeader';
import '../forum.css';

const KINDS: ForumMineKind[] = ['threads', 'replies'];
const PAGE_SIZES = [10, 20, 40];

function MineThreadMenu({ thread, kind, onDeleted }: {
  thread: ForumMineThread; kind: ForumMineKind; onDeleted: () => void;
}) {
  const lang = useLang();
  const router = useEntryRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const post = thread.personalPost;
  const postPage = Math.max(1, Math.ceil(post.postNo / 20));
  const href = `${lang === 'zh' ? '/zh' : ''}/forum/t/${thread.id}?page=${postPage}`;
  const act = async (action: string) => {
    if (action !== 'delete') {
      router.push(`${href}${action === 'edit' ? `&edit=${post.id}` : ''}#post-${post.id}`);
      return;
    }
    if (!window.confirm(kind === 'threads'
      ? tr({ zh: '确定删除整个主题？所有回复将一并删除。', en: 'Delete the whole thread? All replies go with it.' })
      : tr({ zh: '确定删除这条回复？', en: 'Delete this reply?' }))) return;
    setBusy(true); setError('');
    try {
      if (kind === 'threads') await deleteThread(thread.id);
      else await deletePost(post.id);
      onDeleted();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <>
    {post.status !== 'approved' && <span className="forum-mine-status">{kind === 'replies'
      ? tr(post.status === 'pending' ? { zh: '回复待审核', en: 'Reply pending review' } : { zh: '回复未通过', en: 'Reply rejected' })
      : tr(post.status === 'pending' ? { zh: '待审核', en: 'Pending review' } : { zh: '未通过', en: 'Rejected' })}</span>}
    <CompactSelect className="forum-mine-menu" unstyledTrigger triggerClassName="forum-post-action" showArrow={false}
      ariaLabel={tr({ zh: '帖子操作', en: 'Post actions' })} label={<Ellipsis size={16} aria-hidden="true" />}
      disabled={busy} items={[
        { value: 'view', label: kind === 'replies' ? tr({ zh: '查看我的回复', en: 'View my reply' }) : tr({ zh: '查看帖子', en: 'View thread' }) },
        ...(post.canManage ? [
          { value: 'edit', label: tr({ zh: '编辑', en: 'Edit' }) },
          { value: 'delete', label: tr({ zh: '删除', en: 'Delete' }) },
        ] : []),
      ]} onChange={action => void act(action)} />
    {error && <span role="alert" className="forum-error">{error}</span>}
  </>;
}

// Remount on owner/filter/page changes so private content and requests never survive an account switch.
function MineResults({ kind, page, size, onPageChange, onSizeChange }: {
  kind: ForumMineKind; page: number; size: number;
  onPageChange: (page: number) => void; onSizeChange: (size: number) => void;
}) {
  const lang = useLang();
  const [data, setData] = useState<ForumMineData | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    fetchForumMine(kind, page, size, controller.signal).then(next => {
      if (controller.signal.aborted) return;
      const lastPage = Math.max(1, Math.ceil(next.total / size));
      if (page > lastPage) onPageChange(lastPage);
      else setData(next);
    }).catch(e => { if (!controller.signal.aborted) setError((e as Error).message); });
    return () => controller.abort();
  }, [kind, page, size, revision, onPageChange]);
  return <>
    {error ? <div className="forum-error" role="alert">{error} <button type="button" className="forum-btn-text" onClick={() => setRevision(n => n + 1)}>{tr({ zh: '重试', en: 'Retry' })}</button></div>
      : !data ? <ContentSkeleton variant="feed" />
      : data.threads.length === 0 ? <div className="forum-empty">{kind === 'threads'
        ? tr({ zh: '还没有发布帖子', en: 'No threads yet' }) : tr({ zh: '还没有回复帖子', en: 'No replies yet' })}</div>
      : <ForumFeedList threads={data.threads} renderBylineEnd={thread => <MineThreadMenu thread={thread} kind={kind} onDeleted={() => setRevision(n => n + 1)} />} />}
    {data && data.total > 0 && <Paginator page={page} totalPages={Math.max(1, Math.ceil(data.total / size))}
      size={size} pageSizeOptions={PAGE_SIZES} isZh={lang === 'zh'} className="forum-pagination"
      onPageChange={onPageChange} onSizeChange={onSizeChange} />}
  </>;
}

export default function ForumMinePage() {
  const ownerKey = useOwnerKey();
  const [kind, setKind] = useQueryState('kind', parseAsStringEnum(KINDS).withDefault('threads'));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [size, setSize] = useQueryState('size', parseAsInteger.withDefault(20));
  const safePage = Math.max(1, page);
  const safeSize = PAGE_SIZES.includes(size) ? size : 20;
  const changePage = useCallback((next: number) => { void setPage(next); }, [setPage]);
  const changeSize = useCallback((next: number) => { void setSize(next); void setPage(1); }, [setSize, setPage]);
  return <div className="forum-page forum-feed-page">
    <ForumHeader activeView="mine">
      <select className="native-select" value={kind} aria-label={tr({ zh: '我的帖子筛选', en: 'My activity filter' })}
        onChange={event => { void setKind(event.currentTarget.value as ForumMineKind); void setPage(1); }}>
        <option value="threads">{tr({ zh: '我发布的', en: 'My threads' })}</option>
        <option value="replies">{tr({ zh: '我回复的', en: 'My replies' })}</option>
      </select>
    </ForumHeader>
    {ownerKey ? <MineResults key={`${ownerKey}:${kind}:${safePage}:${safeSize}`} kind={kind} page={safePage} size={safeSize}
      onPageChange={changePage} onSizeChange={changeSize} />
      : <button type="button" className="forum-login-hint" onClick={() => authActions.login()}>{tr({ zh: '登录后查看我的帖子', en: 'Sign in to view your posts' })}</button>}
  </div>;
}
