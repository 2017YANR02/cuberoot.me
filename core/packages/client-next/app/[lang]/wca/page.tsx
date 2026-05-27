'use client';

/**
 * /wca — WCA Stats index. Simplified port of
 * packages/client/src/pages/wca_stats/WcaStatsIndex.tsx.
 *
 * NOTE: The full Vite version uses utils/site_search.ts for cross-cutting
 * search (persons / comps / recons / glossary / alg sets / etc.) — those
 * data sources haven't been ported yet, so this version drops the search
 * box and renders only the curated category cards + Tools tab.
 * TODO: port useSiteSearch + SEARCH_CARDS once LandingPage is migrated.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin, Wrench,
  CalendarDays, LineChart, TrendingDown, Radio, Target, Calculator, Search,
  type LucideIcon,
} from 'lucide-react';
import { getLangQuery } from '@/i18n/i18n-client';
import HeaderToggles from '@/components/HeaderToggles';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../wca/_wca_stats.css';

const ICON_MAP: Record<string, LucideIcon> = {
  Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin,
};

interface StatItem { id: string; titleEn: string; titleZh: string }
interface StatCategory { nameEn: string; nameZh: string; iconName?: string; stats: StatItem[] }
interface IndexData { categories: StatCategory[] }

const TOOLS = '__tools__';
const LOOKUP = '__lookup__';

const WCA_TOOLS: { path: string; zh: string; en: string; Icon: LucideIcon }[] = [
  { path: '/wca/comp',       zh: '比赛',     en: 'Comp',         Icon: Radio },
  { path: '/wca/calendar',   zh: '日历',     en: 'Calendar',     Icon: CalendarDays },
  { path: '/wca/globe',      zh: '地球',     en: 'Globe',        Icon: Globe2 },
  { path: '/wca/viz',        zh: '分布',     en: 'Distribution', Icon: LineChart },
  { path: '/wca/prediction', zh: '预测',     en: 'Prediction',   Icon: TrendingDown },
  { path: '/nemesizer',      zh: '宿敌',     en: 'Nemesizer',    Icon: Target },
  { path: '/calc',           zh: '计算器',   en: 'Calculator',   Icon: Calculator },
];

const LOOKUP_ITEMS: { path: string; zh: string; en: string; extraQuery?: string }[] = [
  { path: '/wca/all-results',     zh: '排名',         en: 'Rankings' },
  { path: '/wca/records',         zh: '纪录',         en: 'Records' },
  { path: '/wca/cohort-ranks',    zh: '届别排名',     en: 'Cohort Ranks' },
  { path: '/wca/success-rate',    zh: '完成率',       en: 'Success Rate' },
  { path: '/wca/all-events-done', zh: '全项目达成',   en: 'All Events Done' },
  { path: '/wca/sum-of-ranks',    zh: '名次和',       en: 'Sum of Ranks' },
  { path: '/wca/grand-slam',      zh: '大满贯',       en: 'Grand Slam' },
  { path: '/wca/historical',      zh: '历史排名',     en: 'Historical Ranks' },
];

export default function WcaStatsIndex() {
  const { i18n } = useTranslation();
  useDocumentTitle('WCA 统计', 'WCA Statistics');
  const [data, setData] = useState<IndexData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string>(TOOLS);

  const isZh = i18n.language === 'zh';

  useEffect(() => {
    const ac = new AbortController();
    fetch('/stats/index.json', { signal: ac.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: IndexData) => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });
    return () => ac.abort();
  }, []);

  if (loading) {
    return (
      <div className="wca-stats-index">
        <div className="wca-stats-index-status">{isZh ? '加载中...' : 'Loading...'}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="wca-stats-index">
        <div className="wca-stats-index-status wca-stats-index-status-error">
          <h2>{isZh ? '加载失败' : 'Failed to load'}</h2>
          <p>{error || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const langQuery = getLangQuery();
  const browseStats = data.categories.filter(c => c.nameEn === activeCat);

  return (
    <div className="wca-stats-index">
      <header className="wca-stats-index-hero">
        <div>
          <div className="wca-stats-index-eyebrow">WCA Statistics</div>
          <h1 className="wca-stats-index-title">
            {isZh ? 'WCA 统计' : 'WCA Statistics'}
          </h1>
        </div>
        <HeaderToggles className="wca-stats-index-hero-right" />
      </header>

      <div className="wca-stats-index-toolbar">
        <div className="wca-stats-index-tabs">
          <button
            className={`wca-stats-index-tab ${activeCat === TOOLS ? 'active' : ''}`}
            onClick={() => setActiveCat(TOOLS)}
          >
            <Wrench size={14} strokeWidth={1.75} />
            <span>{isZh ? '工具' : 'Tools'}</span>
          </button>
          <button
            className={`wca-stats-index-tab ${activeCat === LOOKUP ? 'active' : ''}`}
            onClick={() => setActiveCat(LOOKUP)}
          >
            <Search size={14} strokeWidth={1.75} />
            <span>{isZh ? '查询' : 'Lookup'}</span>
          </button>
          {data.categories.map(cat => {
            const iconKey = cat.iconName || '';
            const Icon = ICON_MAP[iconKey];
            const active = activeCat === cat.nameEn;
            return (
              <button
                key={cat.nameEn}
                className={`wca-stats-index-tab ${active ? 'active' : ''}`}
                onClick={() => setActiveCat(cat.nameEn)}
                title={isZh ? cat.nameZh : cat.nameEn}
              >
                {Icon && <Icon size={14} strokeWidth={1.75} />}
                <span>{isZh ? cat.nameZh : cat.nameEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="wca-stats-index-body">
        {activeCat === TOOLS && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <Wrench size={18} strokeWidth={1.75} />
              <h2>{isZh ? '工具' : 'Tools'}</h2>
            </div>
            <div className="wca-tools-grid">
              {WCA_TOOLS.map(it => (
                <Link key={it.path} href={`${it.path}${langQuery}`} className="wca-tool-card">
                  <it.Icon size={28} strokeWidth={1.5} />
                  <span>{isZh ? it.zh : it.en}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {activeCat === LOOKUP && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <Search size={18} strokeWidth={1.75} />
              <h2>{isZh ? '查询' : 'Lookup'}</h2>
            </div>
            <div className="wca-stats-index-grid">
              {LOOKUP_ITEMS.map(it => {
                const to = it.extraQuery ? `${it.path}${langQuery}&${it.extraQuery}` : `${it.path}${langQuery}`;
                return (
                  <Link key={`${it.path}|${it.extraQuery ?? ''}`} href={to} className="wca-stats-index-card">
                    {isZh ? it.zh : it.en}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {browseStats.map(cat => {
          const Icon = ICON_MAP[cat.iconName || ''];
          return (
            <section key={cat.nameEn} className="wca-stats-index-section">
              <div className="wca-stats-index-section-header">
                {Icon && <Icon size={18} strokeWidth={1.75} />}
                <h2>{isZh ? cat.nameZh : cat.nameEn}</h2>
              </div>
              <div className="wca-stats-index-grid">
                {cat.stats.map(s => (
                  <Link
                    key={s.id}
                    href={`/wca/${s.id}${langQuery}`}
                    className="wca-stats-index-card"
                  >
                    {isZh ? s.titleZh : s.titleEn}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
