// 落地页全站搜索 — Hero 下拉浮层
// 索引:landing 卡片 + /stats/index.json + 7 个 Lookup + persons(lazy) + comps(lazy)
import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin,
  CalendarDays, LayoutGrid, type LucideIcon,
} from 'lucide-react';
import { loadPersonsIndex, searchLocalPersons, type WcaPerson } from '@cuberoot/shared';
import { getLangQuery } from '../i18n';
import { ClearButton } from './ClearButton';
import { Flag } from '../utils/flag';
import { displayCuberName } from '../utils/name_utils';
import { loadComps, searchComps, type Comp } from '../utils/comp_search';
import { compNameZh } from '../utils/country_flags';
import { stripWcaPrefix } from '../utils/comp_localize';
import { localizeCity } from '../utils/city_localize';
import { formatDateRangeIso } from '../utils/date_range';
import './landing_search.css';

const ICON_MAP: Record<string, LucideIcon> = {
  Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin,
};

export interface LandingSearchCard {
  id: string;
  href: string;
  internal: boolean;
  nameEn: string;
  nameZh: string;
  sectionTitleEn: string;
  sectionTitleZh: string;
}

const LOOKUP_ITEMS: { path: string; zh: string; en: string }[] = [
  { path: '/nemesizer',                  zh: '宿敌',         en: 'Nemesizer' },
  { path: '/wca/grand-slam',       zh: '大满贯',       en: 'Grand Slam' },
  { path: '/wca/all-results',      zh: '全部成绩排行', en: 'All Results' },
  { path: '/wca/cohort-ranks',     zh: '参赛届别排行', en: 'Cohort Ranks' },
  { path: '/wca/success-rate',     zh: '项目成功率',   en: 'Success Rate' },
  { path: '/wca/all-events-done',  zh: '全项目达成',   en: 'All Events Done' },
  { path: '/wca/sum-of-ranks',     zh: '全项目排行',   en: 'Sum of Ranks' },
];

const MIN_LEN_LATIN = 2;
const hasNonLatin = (s: string) => /[^\x00-\x7F]/.test(s);

const PERSON_LIMIT = 8;
const COMP_LIMIT = 8;

interface StatEntry { id: string; titleEn: string; titleZh: string }
interface StatCategory { nameEn: string; nameZh: string; iconName?: string; stats: StatEntry[] }
interface StatIndex { categories: StatCategory[] }

interface Props {
  cards: LandingSearchCard[];
  lang: 'zh' | 'en';
}

export default function LandingSearch({ cards, lang }: Props) {
  const isZh = lang === 'zh';
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [statIndex, setStatIndex] = useState<StatIndex | null>(null);
  const [personMatches, setPersonMatches] = useState<WcaPerson[]>([]);
  const [compMatches, setCompMatches] = useState<Comp[]>([]);
  const compsRef = useRef<Comp[] | null>(null);
  const [xLoaded, setXLoaded] = useState(false);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/stats/index.json')
      .then(r => (r.ok ? r.json() : null))
      .then((j: StatIndex | null) => { if (j) setStatIndex(j); })
      .catch(() => {});
  }, []);

  const q = query.trim().toLowerCase();
  const qRaw = query.trim();
  const xSearchEnabled = qRaw.length >= (hasNonLatin(qRaw) ? 1 : MIN_LEN_LATIN);

  useEffect(() => {
    if (!xSearchEnabled || xLoaded) return;
    Promise.all([
      loadPersonsIndex().catch(() => null),
      loadComps().then(arr => { compsRef.current = arr; }).catch(() => null),
    ]).then(() => setXLoaded(true));
  }, [xSearchEnabled, xLoaded]);

  useEffect(() => {
    if (!xSearchEnabled) {
      setPersonMatches([]);
      setCompMatches([]);
      return;
    }
    const h = setTimeout(() => {
      setPersonMatches(searchLocalPersons(qRaw, PERSON_LIMIT) ?? []);
      setCompMatches(compsRef.current ? searchComps(qRaw, compsRef.current, COMP_LIMIT) : []);
    }, 200);
    return () => clearTimeout(h);
  }, [qRaw, xSearchEnabled, xLoaded]);

  const cardMatches = useMemo(() => {
    if (q === '') return [];
    return cards.filter(c =>
      c.nameEn.toLowerCase().includes(q) ||
      c.nameZh.toLowerCase().includes(q) ||
      c.sectionTitleEn.toLowerCase().includes(q) ||
      c.sectionTitleZh.toLowerCase().includes(q),
    );
  }, [q, cards]);

  const statMatches = useMemo(() => {
    if (!statIndex || q === '') return [] as { cat: StatCategory; stats: StatEntry[] }[];
    return statIndex.categories
      .map(cat => ({
        cat,
        stats: cat.stats.filter(s =>
          s.titleEn.toLowerCase().includes(q) || s.titleZh.toLowerCase().includes(q),
        ),
      }))
      .filter(g => g.stats.length > 0);
  }, [q, statIndex]);

  const lookupMatches = useMemo(() => {
    if (q === '') return [];
    return LOOKUP_ITEMS.filter(it =>
      it.zh.toLowerCase().includes(q) || it.en.toLowerCase().includes(q),
    );
  }, [q]);

  const totalCount =
    cardMatches.length +
    lookupMatches.length +
    statMatches.reduce((s, g) => s + g.stats.length, 0) +
    personMatches.length +
    compMatches.length;

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

          {lookupMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <Search size={14} strokeWidth={1.75} />
                <h3>{isZh ? '查询' : 'Lookup'}</h3>
              </div>
              <div className="landing-search-grid">
                {lookupMatches.map(it => (
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

          {statMatches.map(({ cat, stats }) => {
            const Icon = ICON_MAP[cat.iconName || ''];
            return (
              <section key={cat.nameEn} className="landing-search-section">
                <div className="landing-search-section-header">
                  {Icon && <Icon size={14} strokeWidth={1.75} />}
                  <h3>{isZh ? cat.nameZh : cat.nameEn}</h3>
                </div>
                <div className="landing-search-grid">
                  {stats.map(s => (
                    <Link
                      key={s.id}
                      to={`/wca/${s.id}${langQuery}`}
                      className="landing-search-item"
                      onClick={closeAfter}
                    >
                      <span className="landing-search-item-name">{isZh ? s.titleZh : s.titleEn}</span>
                    </Link>
                  ))}
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
                {compMatches.map(c => {
                  const zhName = isZh ? compNameZh(c.name) : '';
                  const displayName = stripWcaPrefix(zhName || c.name);
                  const cityStr = c.city ? localizeCity(c.city, isZh) : '';
                  return (
                    <a
                      key={c.id}
                      href={`https://www.worldcubeassociation.org/competitions/${c.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
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
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {personMatches.length > 0 && (
            <section className="landing-search-section">
              <div className="landing-search-section-header">
                <UserRound size={14} strokeWidth={1.75} />
                <h3>{isZh ? '选手' : 'Persons'}</h3>
              </div>
              <div className="landing-search-grid">
                {personMatches.map(p => (
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
