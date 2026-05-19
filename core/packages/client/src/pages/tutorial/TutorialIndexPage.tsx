import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search as SearchIcon,
  Grid3x3, Award, Languages, Gauge, Eye, Square, Infinity as InfinityIcon,
  Shapes, Sparkles, Boxes, Triangle, Hexagon, EyeOff, LayoutGrid, Diamond,
  Workflow, BarChart3, FileText, MoreHorizontal, Play, Wrench, Cpu, Clock,
  Palette, BookOpen,
  type LucideIcon,
} from 'lucide-react';
import Fuse from 'fuse.js';
import { useTutorialCatalog, type CatalogEntry, type Lang } from './useTutorialCatalog';
import { TutorialCard } from './TutorialCard';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import './tutorial.css';

type Tier = 'hero' | 'hero-side' | 'medium' | 'standard' | 'utility';

interface CategoryConfig {
  cat: string;
  tier: Tier;
  Icon: LucideIcon;
  label: { en: string; zh: string };
}

// NOTE: Tier 映射 + i18n label。category 名 = catalog.json 里的 category 字段。
// 不在表里的 category 自动落到 tier-utility 尾部兜底。
const CATEGORY_CARDS: CategoryConfig[] = [
  // Tier 1 — 3 张大卡（1 hero + 2 hero-side）
  { cat: '3x3',       tier: 'hero',      Icon: Grid3x3,   label: { en: '3x3',        zh: '三阶' } },
  { cat: '魔方根',    tier: 'hero-side', Icon: Award,     label: { en: 'CubeRoot Method', zh: '魔方根方法' } },
  { cat: 'CHS',       tier: 'hero-side', Icon: Languages, label: { en: 'Chinese Resources', zh: '中文资料' } },
  // Tier 2 — medium（3 per row）
  { cat: 'FMC',       tier: 'medium',    Icon: Gauge,     label: { en: 'FMC',        zh: '最少步' } },
  { cat: '3BLD',      tier: 'medium',    Icon: Eye,       label: { en: '3BLD',       zh: '盲拧' } },
  { cat: '2x2',       tier: 'medium',    Icon: Square,    label: { en: '2x2',        zh: '二阶' } },
  // Tier 3 — standard（4 per row）
  { cat: 'Roux',      tier: 'standard',  Icon: InfinityIcon,  label: { en: 'Roux',       zh: 'Roux' } },
  { cat: 'SQ1',       tier: 'standard',  Icon: Shapes,    label: { en: 'SQ1',        zh: 'SQ1' } },
  { cat: 'Skewb',     tier: 'standard',  Icon: Diamond,   label: { en: 'Skewb',      zh: '斜转' } },
  { cat: 'Non-WCA',   tier: 'standard',  Icon: Sparkles,  label: { en: 'Non-WCA',    zh: '非 WCA' } },
  { cat: '4x4',       tier: 'standard',  Icon: LayoutGrid, label: { en: '4x4',       zh: '四阶' } },
  { cat: 'Pyraminx',  tier: 'standard',  Icon: Triangle,  label: { en: 'Pyraminx',   zh: '金字塔' } },
  { cat: '5x5',       tier: 'standard',  Icon: LayoutGrid, label: { en: '5x5',       zh: '五阶' } },
  { cat: 'Megaminx',  tier: 'standard',  Icon: Hexagon,   label: { en: 'Megaminx',   zh: '五魔' } },
  { cat: 'Big',       tier: 'standard',  Icon: Boxes,     label: { en: 'Big Cubes',  zh: '大魔方' } },
  { cat: 'Big BLD',   tier: 'standard',  Icon: EyeOff,    label: { en: 'Big BLD',    zh: '大魔方盲拧' } },
  { cat: 'Mehta',     tier: 'standard',  Icon: Workflow,  label: { en: 'Mehta',      zh: 'Mehta' } },
  // Tier 4 — utility（2 per row，小条）
  { cat: 'Stats',     tier: 'utility',   Icon: BarChart3, label: { en: 'Stats',      zh: '统计' } },
  { cat: 'Blogs',     tier: 'utility',   Icon: FileText,  label: { en: 'Blogs',      zh: '博客' } },
  { cat: 'Misc',      tier: 'utility',   Icon: MoreHorizontal, label: { en: 'Misc',  zh: '杂项' } },
  { cat: 'Solves',    tier: 'utility',   Icon: Play,      label: { en: 'Solves',     zh: '解法分析' } },
  { cat: 'Tools',     tier: 'utility',   Icon: Wrench,    label: { en: 'Tools',      zh: '工具' } },
  { cat: 'Hardware',  tier: 'utility',   Icon: Cpu,       label: { en: 'Hardware',   zh: '硬件' } },
  { cat: 'Clock',     tier: 'utility',   Icon: Clock,     label: { en: 'Clock',      zh: 'Clock' } },
  { cat: 'Pretty Patterns', tier: 'utility', Icon: Palette, label: { en: 'Pretty Patterns', zh: '花样' } },
  { cat: 'Theory',    tier: 'utility',   Icon: BookOpen,  label: { en: 'Theory',     zh: '理论' } },
];

export default function TutorialIndexPage() {
  const { catalog, loading, error } = useTutorialCatalog();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('教程', 'Tutorial');
  const pageLang: Lang = isZh ? 'zh' : 'en';
  const [searchParams] = useSearchParams();
  const showHidden = searchParams.get('show') === 'hidden';

  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    if (!catalog) return [];
    return catalog.filter(e => showHidden || !e.hidden);
  }, [catalog, showHidden]);

  // 每 category 的计数
  const countByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of visible) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return m;
  }, [visible]);

  // 有配置 + 有内容的 category cards
  const cards = useMemo(() => {
    return CATEGORY_CARDS.filter(c => (countByCat.get(c.cat) ?? 0) > 0);
  }, [countByCat]);

  // Fuse 全量搜索(query 非空时启用)
  const fuse = useMemo(() => {
    return new Fuse(visible, {
      keys: [
        { name: 'title.en', weight: 2 },
        { name: 'title.zh', weight: 2 },
        { name: 'slug', weight: 1 },
        { name: 'category', weight: 0.5 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
    });
  }, [visible]);

  const searchResults = useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    return fuse.search(q).map(r => r.item as CatalogEntry);
  }, [query, fuse]);

  return (
    <div className="tutorial-root tutorial-landing">
      <div className="tutorial-index-header">
        <div>
          <h1 className="tutorial-index-title">
            {isZh ? '公式教程' : 'Algorithms'}
          </h1>
          <p className="tutorial-index-subtitle">
            {isZh
              ? `${visible.length} 个教程与公式库`
              : `${visible.length} tutorials & algorithm sets`}
          </p>
        </div>
        <div className="tutorial-search-box">
          <SearchIcon size={16} color="var(--tutorial-text-faint)" />
          <input
            className="tutorial-search-input"
            type="search"
            placeholder={isZh ? '搜索全部…' : 'Search all…'}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading && <div className="tutorial-empty-state">{isZh ? '加载中…' : 'Loading…'}</div>}
      {error && (
        <div className="tutorial-empty-state">
          {isZh ? '加载失败: ' : 'Load failed: '}
          {error}
        </div>
      )}

      {!loading && !error && searchResults === null && (
        <div className="tutorial-bento">
          {cards.map(c => (
            <Link
              key={c.cat}
              to={`/tutorial/c/${encodeURIComponent(c.cat)}`}
              className={`tutorial-bento-card tier-${c.tier}`}
            >
              <div className="tutorial-bento-icon">
                <c.Icon size={c.tier === 'hero' ? 40 : c.tier === 'hero-side' ? 32 : c.tier === 'medium' ? 28 : c.tier === 'utility' ? 18 : 24} strokeWidth={1.5} />
              </div>
              <div className="tutorial-bento-name">{c.label[pageLang]}</div>
            </Link>
          ))}
        </div>
      )}

      {!loading && !error && searchResults !== null && (
        <>
          <div className="tutorial-search-meta">
            {isZh
              ? `找到 ${searchResults.length} 个结果`
              : `${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`}
            {' · '}
            <button className="tutorial-link-btn" onClick={() => setQuery('')}>
              {isZh ? '清空搜索' : 'clear search'}
            </button>
          </div>
          <div className="tutorial-card-grid">
            {searchResults.length === 0 && (
              <div className="tutorial-empty-state">
                {isZh ? '没有匹配的教程' : 'No matching tutorials'}
              </div>
            )}
            {searchResults.map(entry => (
              <TutorialCard key={entry.slug} entry={entry} lang={pageLang} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
