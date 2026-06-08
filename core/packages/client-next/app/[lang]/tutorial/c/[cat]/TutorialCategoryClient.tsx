'use client';

import { Suspense, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'next/navigation';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import { Search as SearchIcon } from 'lucide-react';
import Fuse from 'fuse.js';
import { useTutorialCatalog, type CatalogEntry, type Lang } from '../../_lib/useTutorialCatalog';
import { TutorialCard } from '../../_components/TutorialCard';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../../tutorial.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

function TutorialCategoryPageInner() {
  const { catalog, loading, error } = useTutorialCatalog();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const pageLang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const params = useParams<{ cat: string | string[] }>();
  const rawCategory = Array.isArray(params?.cat) ? params.cat[0] : params?.cat;
  const category = rawCategory ? decodeURIComponent(rawCategory) : '';
  const [show] = useQueryState(
    'show',
    parseAsStringEnum(['hidden']).withOptions({ history: 'replace' }),
  );
  const showHidden = show === 'hidden';

  const tutorialTitle = category || (tr({ zh: '教程', en: 'Tutorial' }));
  useDocumentTitle(tutorialTitle, tutorialTitle);

  const [query, setQuery] = useState('');
  const [activeSub, setActiveSub] = useState<string>('all');

  const inCategory = useMemo(() => {
    if (!catalog) return [];
    return catalog.filter(
      e => e.category === category && (showHidden || !e.hidden),
    );
  }, [catalog, category, showHidden]);

  // 二级分类(subcategory)列表 —— 仅当该 category 下有 >=1 subcategory 才显示
  const subcategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of inCategory) {
      const sc = e.subcategory ?? '';
      counts.set(sc, (counts.get(sc) ?? 0) + 1);
    }
    // 若全部 subcategory 为空,不显示 chip bar
    if (counts.size <= 1) return [];
    return [...counts.entries()]
      .map(([sc, count]) => ({ sc, count }))
      .sort((a, b) => b.count - a.count);
  }, [inCategory]);

  const bySub = useMemo(() => {
    if (activeSub === 'all') return inCategory;
    return inCategory.filter(e => (e.subcategory ?? '') === activeSub);
  }, [inCategory, activeSub]);

  const fuse = useMemo(() => {
    return new Fuse(bySub, {
      keys: [
        { name: 'title.en', weight: 2 },
        { name: 'title.zh', weight: 2 },
        { name: 'slug', weight: 1 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
    });
  }, [bySub]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return bySub;
    return fuse.search(q).map(r => r.item as CatalogEntry);
  }, [query, bySub, fuse]);

  return (
    <div className="tutorial-root">
      <div className="tutorial-index-header">
        <div>
          <h1 className="tutorial-index-title">{category}</h1>
          <p className="tutorial-index-subtitle">
            {i18n.language === 'zh-Hant' ? (`${inCategory.length} 個教程與公式庫`) : (isZh
                                    ? `${inCategory.length} 个教程与公式库`
                                    : `${inCategory.length} tutorials & algorithm sets`)}
          </p>
        </div>
        <div className="tutorial-search-box">
          <SearchIcon size={16} color="var(--tutorial-text-faint)" />
          <input
            className="tutorial-search-input"
            type="search"
            placeholder={tr({ zh: '搜索…', en: 'Search…',
                zhHant: "搜尋…"
            })}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {subcategories.length > 0 && (
        <div className="tutorial-category-bar">
          <button
            className={'tutorial-category-chip' + (activeSub === 'all' ? ' is-active' : '')}
            onClick={() => setActiveSub('all')}
          >
            {tr({ zh: '全部', en: 'All' })}
            <span className="tutorial-category-chip-count">{inCategory.length}</span>
          </button>
          {subcategories.map(({ sc, count }) => (
            <button
              key={sc || '__none__'}
              className={'tutorial-category-chip' + (activeSub === sc ? ' is-active' : '')}
              onClick={() => setActiveSub(sc)}
            >
              {sc || (tr({ zh: '未分类', en: 'Uncategorized',
                  zhHant: "未分類"
            }))}
              <span className="tutorial-category-chip-count">{count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="tutorial-card-grid">
        {loading && <div className="tutorial-empty-state">{tr({ zh: '加载中…', en: 'Loading…',
            zhHant: "載入中…"
        })}</div>}
        {error && (
          <div className="tutorial-empty-state">
            {tr({ zh: '加载失败: ', en: 'Load failed: ',
                zhHant: "載入失敗: "
            })}
            {error}
          </div>
        )}
        {!loading && !error && results.length === 0 && (
          <div className="tutorial-empty-state">
            {tr({ zh: '没有匹配的教程', en: 'No matching tutorials',
                zhHant: "沒有匹配的教程"
            })}
          </div>
        )}
        {results.map(entry => (
          <TutorialCard key={entry.slug} entry={entry} lang={pageLang} />
        ))}
      </div>
    </div>
  );
}

export default function TutorialCategoryClient() {
  return (
    <Suspense fallback={<div className="tutorial-root"><div className="tutorial-empty-state">Loading…</div></div>}>
      <TutorialCategoryPageInner />
    </Suspense>
  );
}
