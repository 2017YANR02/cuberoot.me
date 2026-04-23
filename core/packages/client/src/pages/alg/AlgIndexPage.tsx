import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import Fuse from 'fuse.js';
import { useAlgCatalog, type CatalogEntry, type Lang } from './useAlgCatalog';
import { AlgCard } from './AlgCard';
import './alg.css';

export default function AlgIndexPage() {
  const { catalog, loading, error } = useAlgCatalog();
  const { i18n } = useTranslation();
  const pageLang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const [searchParams] = useSearchParams();
  const showHidden = searchParams.get('show') === 'hidden';

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // 可见 entries
  const visible = useMemo(() => {
    if (!catalog) return [];
    return catalog.filter(e => showHidden || !e.hidden);
  }, [catalog, showHidden]);

  // 分类列表
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of visible) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    // 按 order 推断顺序：使用每 category 下最小 order
    const categoryOrder = new Map<string, number>();
    for (const e of visible) {
      const prev = categoryOrder.get(e.category);
      if (prev === undefined || e.order < prev) categoryOrder.set(e.category, e.order);
    }
    return [...counts.entries()]
      .map(([cat, count]) => ({ cat, count, order: categoryOrder.get(cat) ?? 999 }))
      .sort((a, b) => a.order - b.order);
  }, [visible]);

  // 先按 category 过滤
  const byCategory = useMemo(() => {
    if (activeCategory === 'all') return visible;
    return visible.filter(e => e.category === activeCategory);
  }, [visible, activeCategory]);

  // Fuse 搜索
  const fuse = useMemo(() => {
    return new Fuse(byCategory, {
      keys: [
        { name: 'title.en', weight: 2 },
        { name: 'title.zh', weight: 2 },
        { name: 'slug', weight: 1 },
        { name: 'category', weight: 0.5 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
    });
  }, [byCategory]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return byCategory;
    return fuse.search(q).map(r => r.item as CatalogEntry);
  }, [query, byCategory, fuse]);

  return (
    <div className="alg-root">
      <div className="alg-index-header">
        <div>
          <h1 className="alg-index-title">
            {pageLang === 'zh' ? '公式教程' : 'Algorithms'}
          </h1>
          <p className="alg-index-subtitle">
            {pageLang === 'zh'
              ? `${visible.length} 个教程与公式库`
              : `${visible.length} tutorials & algorithm sets`}
          </p>
        </div>
        <div className="alg-search-box">
          <SearchIcon size={16} color="var(--alg-text-faint)" />
          <input
            className="alg-search-input"
            type="search"
            placeholder={pageLang === 'zh' ? '搜索教程…' : 'Search…'}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="alg-category-bar">
        <button
          className={'alg-category-chip' + (activeCategory === 'all' ? ' is-active' : '')}
          onClick={() => setActiveCategory('all')}
        >
          {pageLang === 'zh' ? '全部' : 'All'}
          <span className="alg-category-chip-count">{visible.length}</span>
        </button>
        {categories.map(({ cat, count }) => (
          <button
            key={cat}
            className={
              'alg-category-chip' + (activeCategory === cat ? ' is-active' : '')
            }
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
            <span className="alg-category-chip-count">{count}</span>
          </button>
        ))}
      </div>

      <div className="alg-card-grid">
        {loading && (
          <div className="alg-empty-state">Loading…</div>
        )}
        {error && (
          <div className="alg-empty-state">
            {pageLang === 'zh' ? '加载失败: ' : 'Load failed: '}
            {error}
          </div>
        )}
        {!loading && !error && results.length === 0 && (
          <div className="alg-empty-state">
            {pageLang === 'zh' ? '没有匹配的教程' : 'No matching tutorials'}
            {' · '}
            <Link to="/alg" onClick={() => setQuery('')}>
              {pageLang === 'zh' ? '清空搜索' : 'clear search'}
            </Link>
          </div>
        )}
        {results.map(entry => (
          <AlgCard key={entry.slug} entry={entry} lang={pageLang} />
        ))}
      </div>
    </div>
  );
}
