'use client';

import { Suspense, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Link from '@/components/AppLink';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import {
  Search as SearchIcon,
  Grid3x3, Award, Languages, Gauge, Eye, Square, Infinity as InfinityIcon,
  Shapes, Sparkles, Boxes, Triangle, Hexagon, EyeOff, LayoutGrid, Diamond,
  Workflow, BarChart3, FileText, MoreHorizontal, Play, Wrench, Cpu, Clock,
  Palette, BookOpen,
  type LucideIcon,
} from 'lucide-react';
import Fuse from 'fuse.js';
import { useTutorialCatalog, type CatalogEntry, type Lang } from './_lib/useTutorialCatalog';
import { CATEGORY_CARDS, type Tier } from './_data/categories';
import { TutorialCard } from './_components/TutorialCard';
import './tutorial.css';
import { tr } from '@/i18n/tr';

// Icon per category. The order, tier and bilingual label live in
// _data/categories so the server metadata for /tutorial/c/<cat> can render the
// same label the card shows; only the lucide component stays here, since a
// Server Component cannot import one. Keys match CATEGORY_CARDS[].cat.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  '3x3': Grid3x3,
  '魔方根': Award,
  'CHS': Languages,
  'FMC': Gauge,
  '3BLD': Eye,
  '2x2': Square,
  'Roux': InfinityIcon,
  'SQ1': Shapes,
  'Skewb': Diamond,
  'Non-WCA': Sparkles,
  '4x4': LayoutGrid,
  'Pyraminx': Triangle,
  '5x5': LayoutGrid,
  'Megaminx': Hexagon,
  'Big': Boxes,
  'Big BLD': EyeOff,
  'Mehta': Workflow,
  'Stats': BarChart3,
  'Blogs': FileText,
  'Misc': MoreHorizontal,
  'Solves': Play,
  'Tools': Wrench,
  'Hardware': Cpu,
  'Clock': Clock,
  'Pretty Patterns': Palette,
  'Theory': BookOpen,
};

const ICON_SIZE: Record<Tier, number> = {
  hero: 40, 'hero-side': 32, medium: 28, standard: 24, utility: 18,
};

function CategoryIcon({ cat, size }: { cat: string; size: number }) {
  const Icon = CATEGORY_ICONS[cat] ?? BookOpen;
  return <Icon size={size} strokeWidth={1.5} />;
}

function TutorialIndexPageInner() {
  const { catalog, loading, error } = useTutorialCatalog();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const pageLang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const [show] = useQueryState(
    'show',
    parseAsStringEnum(['hidden']).withOptions({ history: 'replace' }),
  );
  const showHidden = show === 'hidden';

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
            {tr({ zh: '公式教程', en: 'Algorithms' })}
          </h1>
          <p className="tutorial-index-subtitle">
            {(isZh
                                    ? `${visible.length} 个教程与公式库`
                                    : `${visible.length} tutorials & algorithm sets`)}
          </p>
        </div>
        <div className="tutorial-search-box">
          <SearchIcon size={16} color="var(--tutorial-text-faint)" />
          <input
            className="tutorial-search-input"
            type="search"
            placeholder={tr({ zh: '搜索全部…', en: 'Search all…'
            })}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading && <div className="tutorial-empty-state">{tr({ zh: '加载中…', en: 'Loading…'
    })}</div>}
      {error && (
        <div className="tutorial-empty-state">
          {tr({ zh: '加载失败: ', en: 'Load failed: '
        })}
          {error}
        </div>
      )}

      {!loading && !error && searchResults === null && (
        <div className="tutorial-bento">
          {cards.map(c => (
            <Link
              key={c.cat}
              href={`/tutorial/c/${encodeURIComponent(c.cat)}`}
              className={`tutorial-bento-card tier-${c.tier}`}
            >
              <div className="tutorial-bento-icon">
                <CategoryIcon cat={c.cat} size={ICON_SIZE[c.tier]} />
              </div>
              <div className="tutorial-bento-name">{c.label[pageLang]}</div>
            </Link>
          ))}
        </div>
      )}

      {!loading && !error && searchResults !== null && (
        <>
          <div className="tutorial-search-meta">
            {(isZh
                                    ? `找到 ${searchResults.length} 个结果`
                                    : `${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`)}
            {' · '}
            <button className="tutorial-link-btn tutorial-btn" onClick={() => setQuery('')}>
              {tr({ zh: '清空搜索', en: 'clear search'
            })}
            </button>
          </div>
          <div className="tutorial-card-grid">
            {searchResults.length === 0 && (
              <div className="tutorial-empty-state">
                {tr({ zh: '没有匹配的教程', en: 'No matching tutorials'
                })}
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

export default function TutorialIndexPage() {
  return (
    <Suspense fallback={<div className="tutorial-root"><div className="tutorial-empty-state">Loading…</div></div>}>
      <TutorialIndexPageInner />
    </Suspense>
  );
}
