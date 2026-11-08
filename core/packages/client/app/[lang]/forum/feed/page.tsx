'use client';
import '@cuberoot/timer-ui/compact-select.css';

import { useEffect, useState } from 'react';
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import Paginator from '@/components/wca-stats/Paginator';
import { ForumFeedList } from '@/components/forum/ForumFeedList';
import { T, tr, useLang } from '@/i18n/tr';
import { fetchForumFeed, fetchForumIndex, type ForumFeedData, type ForumFeedSort, type ForumIndexData } from '@/lib/forum-api';
import { ForumHeader } from '../_components/ForumHeader';
import '../forum.css';
import { ContentSkeleton } from '@/components/ContentSkeleton';

const SORTS: ForumFeedSort[] = ['active', 'latest'];
const PAGE_SIZES = [10, 20, 40];

export default function ForumFeedPage() {
  const lang = useLang();
  const [{ sort, page, size, forum }, setFilters] = useQueryStates({
    sort: parseAsStringEnum<ForumFeedSort>(SORTS).withDefault('active'),
    page: parseAsInteger.withDefault(1),
    size: parseAsInteger.withDefault(20),
    forum: parseAsString.withDefault(''),
  }, { history: 'replace' });
  const safePage = Math.max(1, page);
  const safeSize = PAGE_SIZES.includes(size) ? size : 20;
  const [data, setData] = useState<ForumFeedData | null>(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState<ForumIndexData | null>(null);
  const [indexError, setIndexError] = useState(false);
  const [indexRetry, setIndexRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIndexError(false);
    fetchForumIndex()
      .then(next => { if (!cancelled) setIndex(next); })
      .catch(() => { if (!cancelled) setIndexError(true); });
    return () => { cancelled = true; };
  }, [indexRetry]);

  useEffect(() => {
    let cancelled = false;
    setError('');
    setData(null);
    fetchForumFeed(sort, safePage, safeSize, forum)
      .then((next) => { if (!cancelled) setData(next); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); });
    return () => { cancelled = true; };
  }, [sort, safePage, safeSize, forum]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / safeSize));

  useEffect(() => {
    if (data && data.total > 0 && safePage > totalPages) void setFilters({ page: totalPages });
  }, [data, safePage, setFilters, totalPages]);

  return (
    <div className="forum-page forum-feed-page">
      <ForumHeader activeView="feed">
        <select
          value={forum}
          onChange={event => { void setFilters({ forum: event.currentTarget.value, page: 1 }); }}
          aria-label={tr({ zh: '筛选板块', en: 'Filter by board' })}
          className="native-select"
        >
          <option value="">{tr({ zh: '全部板块', en: 'All boards' })}</option>
          {forum && !index?.categories.some(category => category.forums.some(board => board.slug === forum)) && (
            <option value={forum}>{tr({ zh: '所选板块', en: 'Selected board' })}</option>
          )}
          {!index && <option disabled>{indexError
            ? tr({ zh: '板块加载失败', en: 'Could not load boards' })
            : tr({ zh: '加载中…', en: 'Loading…' })}</option>}
          {index?.categories.filter(category => category.forums.length > 0).map(category => (
            <optgroup key={category.id} label={tr({ zh: category.nameZh, en: category.nameEn })}>
              {category.forums.map(board => <option key={board.id} value={board.slug}>{tr({ zh: board.nameZh, en: board.nameEn })}</option>)}
            </optgroup>
          ))}
        </select>
        {indexError && <button type="button" className="forum-btn-ghost" onClick={() => setIndexRetry(value => value + 1)}>
          <T zh="重试板块筛选" en="Retry board filter" />
        </button>}
        <select
          value={sort}
          onChange={event => { void setFilters({ sort: event.currentTarget.value as ForumFeedSort, page: 1 }); }}
          aria-label={tr({ zh: '动态排序', en: 'Feed order' })}
          className="native-select"
        >
          <option value="active">{tr({ zh: '最近活跃', en: 'Recently active' })}</option>
          <option value="latest">{tr({ zh: '最新发布', en: 'Newest posts' })}</option>
        </select>
      </ForumHeader>

      {error && <div className="forum-error">{error}</div>}
      {!data && !error && <ContentSkeleton variant="feed" />}
      {data && data.threads.length === 0 && <div className="forum-empty">{forum
        ? <T zh="该板块暂无动态。" en="No activity in this board yet." />
        : <T zh="还没有社区动态。" en="No community activity yet." />}</div>}
      {data && data.threads.length > 0 && <ForumFeedList threads={data.threads} />}

      {data && data.total > 0 && (
        <Paginator
          page={Math.min(safePage, totalPages)}
          totalPages={totalPages}
          size={safeSize}
          pageSizeOptions={PAGE_SIZES}
          isZh={lang === 'zh'}
          className="forum-pagination"
          onPageChange={(next) => { void setFilters({ page: next }); }}
          onSizeChange={(next) => { void setFilters({ size: next, page: 1 }); }}
        />
      )}
    </div>
  );
}
