'use client';

// /forum/search — title + post-body search across all forums.

import { useEffect, useState } from 'react';
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs';
import Paginator from '@/components/wca-stats/Paginator';
import { SearchInput } from '@/components/SearchInput';
import { tr, T, useLang } from '@/i18n/tr';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { searchForum, type SearchData } from '@/lib/forum-api';
import { ForumBreadcrumbs } from '../_components/ForumBreadcrumbs';
import { ThreadRowList } from '../_components/ThreadRowList';
import { formatCount } from '../_lib/forum-format';
import '../forum.css';
import './forum_search.css';

const MIN_QUERY_LEN = 2;

export default function ForumSearchPage() {
  useDocumentTitle('论坛搜索', 'Forum search');
  const lang = useLang();
  const zh = lang === 'zh';

  const [q, setQ] = useQueryState('q', parseAsString.withDefault(''));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [size, setSize] = useQueryState('size', parseAsInteger.withDefault(25));

  const [data, setData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const query = q.trim();

  useEffect(() => {
    if (query.length < MIN_QUERY_LEN) { setData(null); setError(''); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      searchForum(query, page, size)
        .then(d => { if (!cancelled) { setData(d); setError(''); } })
        .catch(e => { if (!cancelled) setError((e as Error).message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, page, size]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <div className="forum-page forum-search-page">
      <ForumBreadcrumbs items={[{ label: tr({ zh: '搜索', en: 'Search' }) }]} />
      <div className="forum-page-header">
        <div>
          <h1><T zh="搜索论坛" en="Search the forum" /></h1>
        </div>
      </div>

      <SearchInput
        value={q}
        onChange={v => { setQ(v || null); setPage(1); }}
        placeholder={tr({ zh: '搜标题和帖子内容', en: 'Search titles and post bodies' })}
        className="forum-search-box"
        inputClassName="forum-search-input"
        autoFocus
      />

      {error && <div className="forum-error">{error}</div>}

      {query.length < MIN_QUERY_LEN && (
        <div className="forum-empty">
          <T zh="至少输入 2 个字符开始搜索。" en="Type at least 2 characters to search." />
        </div>
      )}

      {query.length >= MIN_QUERY_LEN && data && (
        <>
          <div className="forum-search-total">
            {tr({ zh: '找到 ', en: 'Found ' })}{formatCount(data.total, lang)}{tr({ zh: ' 个主题', en: ' threads' })}
          </div>
          {data.threads.length > 0
            ? <ThreadRowList threads={data.threads} />
            : <div className="forum-empty"><T zh="没有匹配的主题。" en="No matching threads." /></div>}
          {totalPages > 1 && (
            <Paginator
              page={page} totalPages={totalPages} size={size}
              pageSizeOptions={[25, 50]} isZh={zh}
              className="forum-pagination"
              onPageChange={setPage}
              onSizeChange={s => { setSize(s); setPage(1); }}
            />
          )}
        </>
      )}

      {loading && <div className="forum-loading"><T zh="搜索中…" en="Searching…" /></div>}
    </div>
  );
}
