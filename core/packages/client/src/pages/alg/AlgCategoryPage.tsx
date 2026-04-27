import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import Fuse from 'fuse.js';
import { useAlgCatalog, type CatalogEntry, type Lang } from './useAlgCatalog';
import { AlgCard } from './AlgCard';
import './alg.css';

export default function AlgCategoryPage() {
  const { catalog, loading, error } = useAlgCatalog();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const pageLang: Lang = isZh ? 'zh' : 'en';
  const { category: rawCategory } = useParams<{ category: string }>();
  const category = rawCategory ? decodeURIComponent(rawCategory) : '';
  const [searchParams] = useSearchParams();
  const showHidden = searchParams.get('show') === 'hidden';

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
    <div className="alg-root">
      <div className="alg-index-header">
        <div>
          <h1 className="alg-index-title">{category}</h1>
          <p className="alg-index-subtitle">
            {isZh
              ? `${inCategory.length} 个教程与公式库`
              : `${inCategory.length} tutorials & algorithm sets`}
          </p>
        </div>
        <div className="alg-search-box">
          <SearchIcon size={16} color="var(--alg-text-faint)" />
          <input
            className="alg-search-input"
            type="search"
            placeholder={isZh ? '搜索…' : 'Search…'}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {subcategories.length > 0 && (
        <div className="alg-category-bar">
          <button
            className={'alg-category-chip' + (activeSub === 'all' ? ' is-active' : '')}
            onClick={() => setActiveSub('all')}
          >
            {isZh ? '全部' : 'All'}
            <span className="alg-category-chip-count">{inCategory.length}</span>
          </button>
          {subcategories.map(({ sc, count }) => (
            <button
              key={sc || '__none__'}
              className={'alg-category-chip' + (activeSub === sc ? ' is-active' : '')}
              onClick={() => setActiveSub(sc)}
            >
              {sc || (isZh ? '未分类' : 'Uncategorized')}
              <span className="alg-category-chip-count">{count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="alg-card-grid">
        {loading && <div className="alg-empty-state">{isZh ? '加载中…' : 'Loading…'}</div>}
        {error && (
          <div className="alg-empty-state">
            {isZh ? '加载失败: ' : 'Load failed: '}
            {error}
          </div>
        )}
        {!loading && !error && results.length === 0 && (
          <div className="alg-empty-state">
            {isZh ? '没有匹配的教程' : 'No matching tutorials'}
          </div>
        )}
        {results.map(entry => (
          <AlgCard key={entry.slug} entry={entry} lang={pageLang} />
        ))}
      </div>
    </div>
  );
}
