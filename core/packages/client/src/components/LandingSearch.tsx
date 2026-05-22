// 落地页全站搜索 — Hero 下拉浮层
// 匹配逻辑统一在 utils/site_search.ts;这里只管下拉浮层的 UI 壳。
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin,
  CalendarDays, LayoutGrid, Wrench, type LucideIcon,
} from 'lucide-react';
import { getLangQuery } from '../i18n';
import { ClearButton } from './ClearButton';
import { Flag } from '../utils/flag';
import { displayCuberName } from '../utils/name_utils';
import { localizeCompName } from '../utils/comp_localize';
import { compLinkProps } from '../utils/comp_link';
import { localizeCity } from '../utils/city_localize';
import { formatDateRangeIso } from '../utils/date_range';
import {
  useSiteSearch,
  METRIC_LABEL_OVERRIDE,
  INITIAL_RENDER_CAP,
  type SiteSearchCard,
} from '../utils/site_search';
import './landing_search.css';

const ICON_MAP: Record<string, LucideIcon> = {
  Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin,
};

export type LandingSearchCard = SiteSearchCard;

interface Props {
  cards: LandingSearchCard[];
  lang: 'zh' | 'en';
}

export default function LandingSearch({ cards, lang }: Props) {
  const isZh = lang === 'zh';
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [expandedPersons, setExpandedPersons] = useState(false);
  const [expandedComps, setExpandedComps] = useState(false);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);

  const {
    q, xSearchEnabled, xLoaded,
    cardMatches, toolMatches, lookupMatches, statMatches,
    personMatches, compMatches, totalCount,
  } = useSiteSearch(query, 'eager', { cards });

  // NOTE: 切 query → 折回默认页(50 条 + "+ N 更多" 按钮)。
  useEffect(() => { setExpandedPersons(false); setExpandedComps(false); }, [q]);

  const visiblePersons = expandedPersons ? personMatches : personMatches.slice(0, INITIAL_RENDER_CAP);
  const visibleComps = expandedComps ? compMatches : compMatches.slice(0, INITIAL_RENDER_CAP);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const showDropdown = open && q !== '';
  const langQuery = getLangQuery();

  const closeAfter = () => { setOpen(false); setQuery(''); };
  const goCard = (c: LandingSearchCard) => {
    closeAfter();
    if (c.internal) navigate(c.href);
    else window.location.href = c.href;
  };

  return (
    <div className="landing-search" ref={wrapRef}>
      <div className="landing-search-input">
        <Search size={16} strokeWidth={1.75} />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder={isZh ? '搜索页面 / 统计 / 选手 / 比赛…' : 'Search pages, stats, persons, comps…'}
        />
        {q !== '' && <span className="landing-search-count">{totalCount}</span>}
        {query !== '' && <ClearButton onClick={() => setQuery('')} isZh={isZh} preserveFocus />}
      </div>

      {showDropdown && (
        <div className="landing-search-panel">
          {cardMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <LayoutGrid size={14} strokeWidth={1.75} />
                <h3>{isZh ? '页面' : 'Pages'}</h3>
              </div>
              <div className="landing-search-grid">
                {cardMatches.map(c => (
                  <button
                    type="button"
                    key={c.id}
                    className="landing-search-item"
                    onClick={() => goCard(c)}
                  >
                    <span className="landing-search-item-name">{isZh ? c.nameZh : c.nameEn}</span>
                    <span className="landing-search-item-meta">{isZh ? c.sectionTitleZh : c.sectionTitleEn}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {toolMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <Wrench size={14} strokeWidth={1.75} />
                <h3>{isZh ? '工具' : 'Tools'}</h3>
              </div>
              <div className="landing-search-grid">
                {toolMatches.map(it => (
                  <Link
                    key={it.path}
                    to={`${it.path}${langQuery}`}
                    className="landing-search-item"
                    onClick={closeAfter}
                  >
                    <span className="landing-search-item-name">{isZh ? it.zh : it.en}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {lookupMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <Search size={14} strokeWidth={1.75} />
                <h3>{isZh ? '查询' : 'Lookup'}</h3>
              </div>
              <div className="landing-search-grid">
                {lookupMatches.map(it => {
                  const to = it.extraQuery ? `${it.path}${langQuery}&${it.extraQuery}` : `${it.path}${langQuery}`;
                  return (
                    <Link
                      key={`${it.path}|${it.extraQuery ?? ''}`}
                      to={to}
                      className="landing-search-item"
                      onClick={closeAfter}
                    >
                      <span className="landing-search-item-name">{isZh ? it.zh : it.en}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {statMatches.map(({ cat, items }) => {
            const Icon = ICON_MAP[cat.iconName || ''];
            return (
              <section key={cat.nameEn} className="landing-search-section">
                <div className="landing-search-section-header">
                  {Icon && <Icon size={14} strokeWidth={1.75} />}
                  <h3>{isZh ? cat.nameZh : cat.nameEn}</h3>
                </div>
                <div className="landing-search-grid">
                  {items.map(it => {
                    if (it.kind === 'stat') {
                      const s = it.stat;
                      return (
                        <Link
                          key={`s:${s.id}`}
                          to={`/wca/${s.id}${langQuery}`}
                          className="landing-search-item"
                          onClick={closeAfter}
                        >
                          <span className="landing-search-item-name">{isZh ? s.titleZh : s.titleEn}</span>
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
                        className="landing-search-item"
                        onClick={closeAfter}
                      >
                        <span className="landing-search-item-name">{parentTitle} · {metricLabel}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {compMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <CalendarDays size={14} strokeWidth={1.75} />
                <h3>{isZh ? '比赛' : 'Competitions'}</h3>
              </div>
              <div className="landing-search-grid">
                {visibleComps.map(c => {
                  const displayName = localizeCompName(c.id, c.name, isZh);
                  const cityStr = c.city ? localizeCity(c.city, isZh) : '';
                  return (
                    <Link
                      key={c.id}
                      {...compLinkProps(c.id)}
                      className="landing-search-item landing-search-item--rich"
                      onClick={closeAfter}
                    >
                      <Flag iso2={c.country} className="country-flag" />
                      <span className="landing-search-item-main">
                        <span className="landing-search-item-name">{displayName}</span>
                        <span className="landing-search-item-meta">
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
                  className="landing-search-more"
                  onClick={() => setExpandedComps(true)}
                >
                  {isZh
                    ? `显示更多 (+${compMatches.length - INITIAL_RENDER_CAP})`
                    : `Show more (+${compMatches.length - INITIAL_RENDER_CAP})`}
                </button>
              )}
            </section>
          )}

          {personMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <UserRound size={14} strokeWidth={1.75} />
                <h3>{isZh ? '选手' : 'Persons'}</h3>
              </div>
              <div className="landing-search-grid">
                {visiblePersons.map(p => (
                  <Link
                    key={p.wcaId}
                    to={`/wca/persons/${p.wcaId}${langQuery}`}
                    className="landing-search-item landing-search-item--rich"
                    onClick={closeAfter}
                  >
                    <Flag iso2={p.iso2} className="country-flag" />
                    <span className="landing-search-item-main">
                      <span className="landing-search-item-name">{displayCuberName(p.name, isZh)}</span>
                      <span className="landing-search-item-meta">{p.wcaId}</span>
                    </span>
                  </Link>
                ))}
              </div>
              {!expandedPersons && personMatches.length > INITIAL_RENDER_CAP && (
                <button
                  type="button"
                  className="landing-search-more"
                  onClick={() => setExpandedPersons(true)}
                >
                  {isZh
                    ? `显示更多 (+${personMatches.length - INITIAL_RENDER_CAP})`
                    : `Show more (+${personMatches.length - INITIAL_RENDER_CAP})`}
                </button>
              )}
            </section>
          )}

          {totalCount === 0 && (xLoaded || !xSearchEnabled) && (
            <div className="landing-search-empty">
              {isZh ? '未找到匹配项' : 'No matches found.'}
            </div>
          )}
          {totalCount === 0 && xSearchEnabled && !xLoaded && (
            <div className="landing-search-empty">
              {isZh ? '搜索中…' : 'Searching…'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
