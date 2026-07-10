'use client';

// /forum/f/[slug] — thread listing for one subforum.
// Sentinel shell: real slug comes from window.location (see page.tsx).

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryState, parseAsInteger, parseAsStringEnum } from 'nuqs';
import { Plus, Lock } from 'lucide-react';
import Link from '@/components/AppLink';
import Paginator from '@/components/wca-stats/Paginator';
import { tr, T, useLang } from '@/i18n/tr';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useIsAdmin } from '@/lib/auth-store';
import { fetchForumList, type ForumListData } from '@/lib/forum-api';
import { forumIcon } from '../../_lib/forum-icons';
import { formatCount } from '../../_lib/forum-format';
import { ForumBreadcrumbs } from '../../_components/ForumBreadcrumbs';
import { ThreadRowList } from '../../_components/ThreadRowList';
import '../../forum.css';
import './forum_list.css';

type Sort = 'activity' | 'created';
const SORTS: Sort[] = ['activity', 'created'];

export default function ForumListClient() {
  const pathname = usePathname();
  const lang = useLang();
  const zh = lang === 'zh';
  const isAdmin = useIsAdmin();

  const [slug, setSlug] = useState('');
  useEffect(() => {
    // Sentinel route: derive the real slug from the browser URL; usePathname()
    // as dep so soft navigation between forums re-resolves it.
    const m = window.location.pathname.match(/\/forum\/f\/([^/?#]+)/);
    setSlug(m ? decodeURIComponent(m[1]) : '');
  }, [pathname]);

  const [page, setPage] = useQueryState(
    'page', parseAsInteger.withDefault(1).withOptions({ history: 'push' }));
  const [size, setSize] = useQueryState('size', parseAsInteger.withDefault(25));
  const [sort, setSort] = useQueryState(
    'sort', parseAsStringEnum<Sort>(SORTS).withDefault('activity'));

  const [data, setData] = useState<ForumListData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    fetchForumList(slug, page, size, sort)
      .then(d => { if (!cancelled) { setData(d); setError(''); } })
      .catch(e => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, page, size, sort]);

  const forumName = data ? (zh ? data.forum.nameZh : data.forum.nameEn) : '';
  useDocumentTitle(
    data ? `${data.forum.nameZh}(论坛)` : '论坛',
    data ? `${data.forum.nameEn} (Forum)` : 'Forum',
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;
  const Icon = data ? forumIcon(data.forum.icon) : null;
  const canPost = data ? (!data.forum.adminOnly || isAdmin) : false;

  return (
    <div className="forum-page">
      <ForumBreadcrumbs items={data ? [
        { label: zh ? data.category.nameZh : data.category.nameEn },
        { label: forumName },
      ] : []} />

      {error && <div className="forum-error">{error}</div>}

      {data && (
        <>
          <div className="forum-page-header">
            <div className="forum-list-head">
              {Icon && <Icon size={28} strokeWidth={1.5} className="forum-forum-icon" aria-hidden="true" />}
              <div>
                <h1>{forumName}</h1>
                <p className="forum-subtitle">{zh ? data.forum.descZh : data.forum.descEn}</p>
              </div>
            </div>
            <div className="forum-header-actions">
              <label className="forum-sort-label">
                <span className="forum-sort-caption"><T zh="排序" en="Sort" /></span>
                <select
                  className="forum-sort-select"
                  value={sort}
                  onChange={e => { setSort(e.target.value as Sort); setPage(1); }}
                >
                  <option value="activity">{tr({ zh: '最新回复', en: 'Latest reply' })}</option>
                  <option value="created">{tr({ zh: '最新发布', en: 'Newest thread' })}</option>
                </select>
              </label>
              {canPost && (
                <Link
                  href={`/forum/new?f=${encodeURIComponent(data.forum.slug)}`}
                  prefetch={false}
                  className="forum-btn-primary"
                >
                  <Plus size={15} aria-hidden="true" />
                  <T zh="发帖" en="Post thread" />
                </Link>
              )}
            </div>
          </div>

          {page === 1 && data.pinned.length > 0 && (
            <section className="forum-list-section">
              <h2 className="forum-cat-title"><T zh="置顶" en="Pinned" /></h2>
              <ThreadRowList threads={data.pinned} />
            </section>
          )}

          <section className="forum-list-section">
            {page === 1 && data.pinned.length > 0 && (
              <h2 className="forum-cat-title"><T zh="主题" en="Threads" /></h2>
            )}
            {data.threads.length > 0 ? (
              <ThreadRowList threads={data.threads} />
            ) : (
              <div className="forum-empty">
                {data.forum.adminOnly && !isAdmin
                  ? <T zh="还没有内容。" en="Nothing here yet." />
                  : <T zh="还没有主题,来发第一帖。" en="No threads yet — start the first one." />}
              </div>
            )}
          </section>

          <div className="forum-list-footer">
            <span className="forum-list-total">
              {tr({ zh: '共 ', en: 'Total ' })}{formatCount(data.total, lang)}{tr({ zh: ' 个主题', en: ' threads' })}
            </span>
            {totalPages > 1 && (
              <Paginator
                page={page}
                totalPages={totalPages}
                size={size}
                pageSizeOptions={[25, 50, 100]}
                isZh={zh}
                className="forum-pagination"
                onPageChange={setPage}
                onSizeChange={s => { setSize(s); setPage(1); }}
              />
            )}
          </div>

          {data.forum.adminOnly && !isAdmin && (
            <p className="forum-adminonly-note">
              <Lock size={13} aria-hidden="true" />
              <T zh="该版块仅管理员可发帖。" en="Only admins can post in this forum." />
            </p>
          )}
        </>
      )}

      {loading && !data && !error && <div className="forum-loading"><T zh="加载中…" en="Loading…" /></div>}
    </div>
  );
}
