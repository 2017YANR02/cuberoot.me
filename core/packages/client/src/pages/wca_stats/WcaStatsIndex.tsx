// NOTE: WCA 统计索引页 — 浅色主题（对齐首页 landing.css tokens）+ 搜索 + Tab 分类
// 路由：/wca
// 搜索匹配跟落地页的 LandingSearch 完全共用 utils/site_search.ts;UI 壳是内联页,
// q 为空时显示 Tab 浏览态,q 非空时纯走 hook 的结果渲染。
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin, Search, Wrench,
  CalendarDays, LineChart, TrendingDown, Radio, Target, Calculator, LayoutGrid,
  ScanSearch, BookA, BookOpen, Library, Code as CodeIcon, type LucideIcon,
} from 'lucide-react';
import { getLangQuery } from '../../i18n';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import { ClearButton } from '../../components/ClearButton';
import { Flag } from '../../utils/flag';
import { displayCuberName } from '../../utils/name_utils';
import { localizeCompName } from '../../utils/comp_localize';
import { localizeCity } from '../../utils/city_localize';
import { formatDateRangeIso } from '../../utils/date_range';
import { compLinkProps } from '../../utils/comp_link';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import { EventIcon } from '../../components/EventIcon/EventIcon';
import { SEARCH_CARDS } from '../LandingPage';
import {
  useSiteSearch, LOOKUP_ITEMS, METRIC_LABEL_OVERRIDE, INITIAL_RENDER_CAP,
  type StatCategory,
} from '../../utils/site_search';
import './wca_stats.css';

// NOTE: iconName → lucide 组件映射（与 compute_index.ts STAT_CATEGORIES.iconName 对齐）
const ICON_MAP: Record<string, LucideIcon> = {
  Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin,
};

interface IndexData {
  categories: StatCategory[];
}

const TOOLS = '__tools__';
const LOOKUP = '__lookup__';

// 顶层工具页(大卡片,带图标 — 跟 landing 卡片视觉一致)。
// 仅用于 q 为空时的 TOOLS tab 大卡片渲染;搜索匹配走 utils/site_search.ts 的 TOOL_ITEMS。
const WCA_TOOLS: { path: string; zh: string; en: string; Icon: LucideIcon }[] = [
  { path: '/wca/comp',       zh: '比赛',     en: 'Comp',         Icon: Radio },
  { path: '/wca/calendar',   zh: '日历',     en: 'Calendar',     Icon: CalendarDays },
  { path: '/wca/globe',      zh: '地球',     en: 'Globe',        Icon: Globe2 },
  { path: '/wca/viz',        zh: '分布',     en: 'Distribution', Icon: LineChart },
  { path: '/wca/prediction', zh: '预测',     en: 'Prediction',   Icon: TrendingDown },
  { path: '/nemesizer',      zh: '宿敌',     en: 'Nemesizer',    Icon: Target },
  { path: '/calc',           zh: '计算器',   en: 'Calculator',   Icon: Calculator },
];

export default function WcaStatsIndex() {
  const { i18n } = useTranslation();
  useDocumentTitle('WCA 统计', 'WCA Statistics');
  const [data, setData] = useState<IndexData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string>(TOOLS);
  const [query, setQuery] = useState('');
  const [expandedPersons, setExpandedPersons] = useState(false);
  const [expandedComps, setExpandedComps] = useState(false);
  const [expandedRecons, setExpandedRecons] = useState(false);
  const [expandedGlossary, setExpandedGlossary] = useState(false);

  const isZh = i18n.language === 'zh';

  useEffect(() => {
    fetch('/stats/index.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: IndexData) => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const {
    q, xSearchEnabled, xLoaded,
    cardMatches, toolMatches, lookupMatches, statMatches,
    personMatches, compMatches,
    reconMatches, glossaryMatches, aboutMatches, stackMatches, algSetMatches,
    totalCount,
  } = useSiteSearch(query, 'lazy', { cards: SEARCH_CARDS });

  // NOTE: 切 query → 折回默认页(50 条 + "+ N 更多" 按钮),跟 LandingSearch 对齐。
  useEffect(() => {
    setExpandedPersons(false); setExpandedComps(false);
    setExpandedRecons(false); setExpandedGlossary(false);
  }, [q]);
  const visiblePersons = expandedPersons ? personMatches : personMatches.slice(0, INITIAL_RENDER_CAP);
  const visibleComps = expandedComps ? compMatches : compMatches.slice(0, INITIAL_RENDER_CAP);
  const visibleRecons = expandedRecons ? reconMatches : reconMatches.slice(0, INITIAL_RENDER_CAP);
  const visibleGlossary = expandedGlossary ? glossaryMatches : glossaryMatches.slice(0, INITIAL_RENDER_CAP);

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
  const hasAnyMatch = totalCount > 0;

  // q 为空时:按 activeCat 展示浏览态(Tools / Lookup / 各分类)
  const browseLookupItems = q === '' ? LOOKUP_ITEMS : [];
  const browseStats = (q === '' && data)
    ? data.categories.filter(c => c.nameEn === activeCat)
    : [];

  return (
    <div className="wca-stats-index">
      <header className="wca-stats-index-hero">
        <div>
          <div className="wca-stats-index-eyebrow">WCA Statistics</div>
          <h1 className="wca-stats-index-title">
            {isZh ? 'WCA 统计' : 'WCA Statistics'}
          </h1>
        </div>
        <div className="wca-stats-index-hero-right">
          <LangToggle />
          <ThemeToggle />
        </div>
      </header>

      <div className="wca-stats-index-toolbar">
        <div className="wca-stats-index-search">
          <Search size={16} strokeWidth={1.75} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isZh ? '搜索页面 / 统计 / 选手 / 比赛…' : 'Search pages, stats, persons, comps…'}
          />
          {q !== '' && (
            <span className="wca-stats-index-search-count">{totalCount}</span>
          )}
          {query !== '' && (
            <ClearButton onClick={() => setQuery('')} isZh={isZh} preserveFocus />
          )}
        </div>

        {q === '' && (
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
        )}
      </div>

      <div className="wca-stats-index-body">
        {/* q 为空 + TOOLS tab:大卡片 WCA tools 浏览态 */}
        {q === '' && activeCat === TOOLS && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <Wrench size={18} strokeWidth={1.75} />
              <h2>{isZh ? '工具' : 'Tools'}</h2>
            </div>
            <div className="wca-tools-grid">
              {WCA_TOOLS.map(it => (
                <Link key={it.path} to={`${it.path}${langQuery}`} className="wca-tool-card">
                  <it.Icon size={28} strokeWidth={1.5} />
                  <span>{isZh ? it.zh : it.en}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* q 为空 + LOOKUP tab:lookup 列表浏览 */}
        {q === '' && activeCat === LOOKUP && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <Search size={18} strokeWidth={1.75} />
              <h2>{isZh ? '查询' : 'Lookup'}</h2>
            </div>
            <div className="wca-stats-index-grid">
              {browseLookupItems.map(it => {
                const to = it.extraQuery ? `${it.path}${langQuery}&${it.extraQuery}` : `${it.path}${langQuery}`;
                return (
                  <Link key={`${it.path}|${it.extraQuery ?? ''}`} to={to} className="wca-stats-index-card">
                    {isZh ? it.zh : it.en}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* q 为空 + 某 stats 分类 tab:该分类下所有 stat */}
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
                    to={`/wca/${s.id}${langQuery}`}
                    className="wca-stats-index-card"
                  >
                    {isZh ? s.titleZh : s.titleEn}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        {/* q 非空:hook 出的所有匹配 — 跟 LandingSearch 完全一致 */}
        {q !== '' && cardMatches.length > 0 && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <LayoutGrid size={18} strokeWidth={1.75} />
              <h2>{isZh ? '页面' : 'Pages'}</h2>
            </div>
            <div className="wca-stats-index-grid">
              {cardMatches.map(c => (
                c.internal ? (
                  <Link key={c.id} to={c.href} className="wca-stats-index-card">
                    {isZh ? c.nameZh : c.nameEn}
                  </Link>
                ) : (
                  <a key={c.id} href={c.href} className="wca-stats-index-card">
                    {isZh ? c.nameZh : c.nameEn}
                  </a>
                )
              ))}
            </div>
          </section>
        )}

        {q !== '' && toolMatches.length > 0 && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <Wrench size={18} strokeWidth={1.75} />
              <h2>{isZh ? '工具' : 'Tools'}</h2>
            </div>
            <div className="wca-stats-index-grid">
              {toolMatches.map(it => (
                <Link key={it.path} to={`${it.path}${langQuery}`} className="wca-stats-index-card">
                  {isZh ? it.zh : it.en}
                </Link>
              ))}
            </div>
          </section>
        )}

        {q !== '' && lookupMatches.length > 0 && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <Search size={18} strokeWidth={1.75} />
              <h2>{isZh ? '查询' : 'Lookup'}</h2>
            </div>
            <div className="wca-stats-index-grid">
              {lookupMatches.map(it => {
                const to = it.extraQuery ? `${it.path}${langQuery}&${it.extraQuery}` : `${it.path}${langQuery}`;
                return (
                  <Link key={`${it.path}|${it.extraQuery ?? ''}`} to={to} className="wca-stats-index-card">
                    {isZh ? it.zh : it.en}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {q !== '' && statMatches.map(({ cat, items }) => {
          const Icon = ICON_MAP[cat.iconName || ''];
          return (
            <section key={cat.nameEn} className="wca-stats-index-section">
              <div className="wca-stats-index-section-header">
                {Icon && <Icon size={18} strokeWidth={1.75} />}
                <h2>{isZh ? cat.nameZh : cat.nameEn}</h2>
              </div>
              <div className="wca-stats-index-grid">
                {items.map(it => {
                  if (it.kind === 'stat') {
                    const s = it.stat;
                    return (
                      <Link
                        key={`s:${s.id}`}
                        to={`/wca/${s.id}${langQuery}`}
                        className="wca-stats-index-card"
                      >
                        {isZh ? s.titleZh : s.titleEn}
                      </Link>
                    );
                  }
                  const { parent, metric } = it;
                  const parentTitle = isZh ? parent.titleZh : parent.titleEn;
                  const metricLabel = METRIC_LABEL_OVERRIDE[metric.labelEn] ?? (isZh ? metric.labelZh : metric.labelEn);
                  return (
                    <Link
                      key={`m:${parent.id}:${metric.id}`}
                      to={`/wca/${parent.id}${langQuery}#metric=${metric.id}`}
                      className="wca-stats-index-card"
                    >
                      {parentTitle} · {metricLabel}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}

        {q !== '' && aboutMatches.length > 0 && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <BookOpen size={18} strokeWidth={1.75} />
              <h2>{isZh ? '算法说明' : 'About'}</h2>
            </div>
            <div className="wca-stats-index-grid">
              {aboutMatches.map(a => (
                <Link key={a.id} to={`/wca/about/${a.id}${langQuery}`} className="wca-stats-index-card">
                  {isZh ? a.titleZh : a.titleEn}
                </Link>
              ))}
            </div>
          </section>
        )}

        {q !== '' && stackMatches.length > 0 && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <CodeIcon size={18} strokeWidth={1.75} />
              <h2>{isZh ? '技术栈' : 'Stack'}</h2>
            </div>
            <div className="wca-stats-index-grid">
              {stackMatches.map(s => (
                <Link
                  key={s.slug}
                  to={`/code/stack/${s.slug}${langQuery}`}
                  className="wca-stats-index-card wca-stats-index-card--rich"
                >
                  <span className="wca-stats-index-card-main">
                    <span className="wca-stats-index-card-name">{s.name}</span>
                    <span className="wca-stats-index-card-meta">{isZh ? s.zh.tagline : s.en.tagline}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {q !== '' && glossaryMatches.length > 0 && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <BookA size={18} strokeWidth={1.75} />
              <h2>{isZh ? '术语' : 'Glossary'}</h2>
            </div>
            <div className="wca-stats-index-grid">
              {visibleGlossary.map(g => (
                <Link
                  key={g.slug}
                  to={`/wiki${langQuery}#${g.slug}`}
                  className="wca-stats-index-card wca-stats-index-card--rich"
                >
                  <span className="wca-stats-index-card-main">
                    <span className="wca-stats-index-card-name">{g.head}</span>
                    <span className="wca-stats-index-card-meta">{g.body.slice(0, 100)}</span>
                  </span>
                </Link>
              ))}
            </div>
            {!expandedGlossary && glossaryMatches.length > INITIAL_RENDER_CAP && (
              <button
                type="button"
                className="wca-stats-index-more"
                onClick={() => setExpandedGlossary(true)}
              >
                {isZh
                  ? `显示更多 (+${glossaryMatches.length - INITIAL_RENDER_CAP})`
                  : `Show more (+${glossaryMatches.length - INITIAL_RENDER_CAP})`}
              </button>
            )}
          </section>
        )}

        {q !== '' && algSetMatches.length > 0 && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <Library size={18} strokeWidth={1.75} />
              <h2>{isZh ? '公式库' : 'Algorithms'}</h2>
            </div>
            <div className="wca-stats-index-grid">
              {algSetMatches.map(a => (
                <Link
                  key={`${a.puzzle}/${a.setSlug}`}
                  to={`/alg/${a.puzzle}/${a.setSlug}${langQuery}`}
                  className="wca-stats-index-card"
                >
                  {a.puzzle} · {a.setSlug}
                </Link>
              ))}
            </div>
          </section>
        )}

        {q !== '' && reconMatches.length > 0 && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <ScanSearch size={18} strokeWidth={1.75} />
              <h2>{isZh ? '复盘' : 'Recons'}</h2>
            </div>
            <div className="wca-stats-index-grid">
              {visibleRecons.map(r => (
                <Link
                  key={r.id}
                  to={`/recon/${r.id}${langQuery}`}
                  className="wca-stats-index-card wca-stats-index-card--rich"
                >
                  {r.personIso2 && <Flag iso2={r.personIso2} className="country-flag" />}
                  <EventIcon event={r.event} className="wca-stats-index-event-icon" />
                  <span className="wca-stats-index-card-main">
                    <span className="wca-stats-index-card-name">
                      {displayCuberName(r.person, isZh)} · {r.valueStr}
                      {r.recordTag ? ` · ${r.recordTag}` : ''}
                      {r.aoType ? ` · ${r.aoType}` : ''}
                    </span>
                    <span className="wca-stats-index-card-meta">
                      {r.comp ? r.comp : ''}
                      {r.comp && r.date ? ' · ' : ''}
                      {r.date ?? ''}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
            {!expandedRecons && reconMatches.length > INITIAL_RENDER_CAP && (
              <button
                type="button"
                className="wca-stats-index-more"
                onClick={() => setExpandedRecons(true)}
              >
                {isZh
                  ? `显示更多 (+${reconMatches.length - INITIAL_RENDER_CAP})`
                  : `Show more (+${reconMatches.length - INITIAL_RENDER_CAP})`}
              </button>
            )}
          </section>
        )}

        {q !== '' && compMatches.length > 0 && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <CalendarDays size={18} strokeWidth={1.75} />
              <h2>{isZh ? '比赛' : 'Competitions'}</h2>
            </div>
            <div className="wca-stats-index-grid">
              {visibleComps.map(c => {
                const displayName = localizeCompName(c.id, c.name, isZh);
                const cityStr = c.city ? localizeCity(c.city, isZh) : '';
                return (
                  <Link
                    key={c.id}
                    {...compLinkProps(c.id)}
                    className="wca-stats-index-card wca-stats-index-card--rich"
                  >
                    <Flag iso2={c.country} className="country-flag" />
                    <span className="wca-stats-index-card-main">
                      <span className="wca-stats-index-card-name">{displayName}</span>
                      <span className="wca-stats-index-card-meta">
                        {formatDateRangeIso(c.start_date, c.end_date)}
                        {cityStr ? ` · ${cityStr}` : ''}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
            {!expandedComps && compMatches.length > INITIAL_RENDER_CAP && (
              <button
                type="button"
                className="wca-stats-index-more"
                onClick={() => setExpandedComps(true)}
              >
                {isZh
                  ? `显示更多 (+${compMatches.length - INITIAL_RENDER_CAP})`
                  : `Show more (+${compMatches.length - INITIAL_RENDER_CAP})`}
              </button>
            )}
          </section>
        )}

        {q !== '' && personMatches.length > 0 && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <UserRound size={18} strokeWidth={1.75} />
              <h2>{isZh ? '选手' : 'Persons'}</h2>
            </div>
            <div className="wca-stats-index-grid">
              {visiblePersons.map(p => (
                <Link
                  key={p.wcaId}
                  to={`/wca/persons/${p.wcaId}${langQuery}`}
                  className="wca-stats-index-card wca-stats-index-card--rich"
                >
                  <Flag iso2={p.iso2} className="country-flag" />
                  <span className="wca-stats-index-card-main">
                    <span className="wca-stats-index-card-name">{displayCuberName(p.name, isZh)}</span>
                    <span className="wca-stats-index-card-meta">{p.wcaId}</span>
                  </span>
                </Link>
              ))}
            </div>
            {!expandedPersons && personMatches.length > INITIAL_RENDER_CAP && (
              <button
                type="button"
                className="wca-stats-index-more"
                onClick={() => setExpandedPersons(true)}
              >
                {isZh
                  ? `显示更多 (+${personMatches.length - INITIAL_RENDER_CAP})`
                  : `Show more (+${personMatches.length - INITIAL_RENDER_CAP})`}
              </button>
            )}
          </section>
        )}

        {q !== '' && !hasAnyMatch && (xLoaded || !xSearchEnabled) && (
          <div className="wca-stats-index-empty">
            {isZh ? '未找到匹配项' : 'No matches found.'}
          </div>
        )}
        {q !== '' && !hasAnyMatch && xSearchEnabled && !xLoaded && (
          <div className="wca-stats-index-empty">
            {isZh ? '搜索中…' : 'Searching…'}
          </div>
        )}
      </div>
    </div>
  );
}
