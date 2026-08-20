'use client';

import { useEffect, useState } from 'react';
import { parseAsInteger, parseAsStringEnum, useQueryState } from 'nuqs';
import PillToggle from '@/components/PillToggle/PillToggle';
import Paginator from '@/components/wca-stats/Paginator';
import { ForumFeedList } from '@/components/forum/ForumFeedList';
import { T, tr, useLang } from '@/i18n/tr';
import { fetchForumFeed, type ForumFeedData, type ForumFeedSort } from '@/lib/forum-api';
import { ForumHeader } from '../_components/ForumHeader';
import { ForumFeedComposer } from './ForumFeedComposer';
import '../forum.css';

const SORTS: ForumFeedSort[] = ['active', 'latest'];
const PAGE_SIZES = [10, 20, 40];

export default function ForumFeedPage() {
  const lang = useLang();
  const [sort, setSort] = useQueryState(
    'sort', parseAsStringEnum<ForumFeedSort>(SORTS).withDefault('active'),
  );
  const [page, setPage] = useQueryState(
    'page', parseAsInteger.withDefault(1).withOptions({ history: 'push' }),
  );
  const [size, setSize] = useQueryState('size', parseAsInteger.withDefault(20));
  const safePage = Math.max(1, page);
  const safeSize = PAGE_SIZES.includes(size) ? size : 20;
  const [data, setData] = useState<ForumFeedData | null>(null);
  const [error, setError] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError('');
    setData(null);
    fetchForumFeed(sort, safePage, safeSize)
      .then((next) => { if (!cancelled) setData(next); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); });
    return () => { cancelled = true; };
  }, [sort, safePage, safeSize, refreshNonce]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / safeSize));

  useEffect(() => {
    if (data && data.total > 0 && safePage > totalPages) void setPage(totalPages);
  }, [data, safePage, setPage, totalPages]);

  return (
    <div className="forum-page">
      <ForumHeader activeView="feed" />
      <ForumFeedComposer
        onCreated={() => {
          void setSort('latest');
          void setPage(1);
          setRefreshNonce((nonce) => nonce + 1);
        }}
      />
      <div className="forum-feed-toolbar">
        <PillToggle
          value={sort === 'latest'}
          onChange={(latest) => { void setSort(latest ? 'latest' : 'active'); void setPage(1); }}
          offLabel={tr({ zh: '活跃', en: 'Active' })}
          onLabel={tr({ zh: '最新', en: 'Latest' })}
          ariaLabel={tr({ zh: '动态排序', en: 'Feed order' })}
        />
        <span>
          {sort === 'active'
            ? <T zh="优先显示最近有回复的讨论" en="Discussions with recent replies first" />
            : <T zh="优先显示刚发布的主题" en="Newest threads first" />}
        </span>
      </div>

      {error && <div className="forum-error">{error}</div>}
      {!data && !error && <div className="forum-loading"><T zh="加载动态中…" en="Loading feed…" /></div>}
      {data && data.threads.length === 0 && <div className="forum-empty"><T zh="还没有社区动态。" en="No community activity yet." /></div>}
      {data && data.threads.length > 0 && <ForumFeedList threads={data.threads} />}

      {data && data.total > 0 && (
        <Paginator
          page={Math.min(safePage, totalPages)}
          totalPages={totalPages}
          size={safeSize}
          pageSizeOptions={PAGE_SIZES}
          isZh={lang === 'zh'}
          className="forum-pagination"
          onPageChange={(next) => { void setPage(next); }}
          onSizeChange={(next) => { void setSize(next); void setPage(1); }}
        />
      )}
    </div>
  );
}
