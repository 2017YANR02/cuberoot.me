// NOTE: WCA 统计索引页 — 浅色主题（对齐首页 landing.css tokens）+ 搜索 + Tab 分类
// 路由：/wca-stats
import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin, Search, CalendarDays,
  type LucideIcon,
} from 'lucide-react';
import { loadPersonsIndex, searchLocalPersons, type WcaPerson } from '@cuberoot/shared';
import { getLangQuery } from '../../i18n';
import LangToggle from '../../components/LangToggle';
import { ClearButton } from '../../components/ClearButton';
import { Flag } from '../../utils/flag';
import { displayCuberName } from '../../utils/name_utils';
import { loadComps, searchComps, type Comp } from '../../utils/comp_search';
import { compNameZh } from '../../utils/country_flags';
import { stripWcaPrefix } from '../../utils/comp_localize';
import { localizeCity } from '../../utils/city_localize';
import { formatDateRangeIso } from '../../utils/date_range';
import './wca_stats.css';

// NOTE: iconName → lucide 组件映射（与 compute_index.ts STAT_CATEGORIES.iconName 对齐）
const ICON_MAP: Record<string, LucideIcon> = {
  Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin,
};

interface StatEntry {
  id: string;
  titleEn: string;
  titleZh: string;
}

interface Category {
  nameEn: string;
  nameZh: string;
  iconName?: string;
  // NOTE: 向后兼容旧字段（若 index.json 未重新生成）
  icon?: string;
  stats: StatEntry[];
}

interface IndexData {
  categories: Category[];
}

const ALL = '__all__';
const LOOKUP = '__lookup__';

const LOOKUP_ITEMS: { path: string; zh: string; en: string }[] = [
  { path: '/nemesizer',                  zh: '宿敌',         en: 'Nemesizer' },
  { path: '/wca-stats/grand-slam',       zh: '大满贯',       en: 'Grand Slam' },
  { path: '/wca-stats/all-results',      zh: '全部成绩排行', en: 'All Results' },
  { path: '/wca-stats/cohort-ranks',     zh: '参赛届别排行', en: 'Cohort Ranks' },
  { path: '/wca-stats/success-rate',     zh: '项目成功率',   en: 'Success Rate' },
  { path: '/wca-stats/all-events-done',  zh: '全项目达成',   en: 'All Events Done' },
  { path: '/wca-stats/sum-of-ranks',     zh: '全项目排行',   en: 'Sum of Ranks' },
];

// NOTE: 选手 / 比赛跨库搜索阈值。英文/数字 q.length >= 2 才发,中文/包含 unicode 1 字符即可
const MIN_LEN_LATIN = 2;
const hasNonLatin = (s: string) => /[^\x00-\x7F]/.test(s);

export default function WcaStatsIndex() {
  const { i18n } = useTranslation();
  const [data, setData] = useState<IndexData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string>(ALL);
  const [query, setQuery] = useState('');
  // 跨库搜索结果 — 选手 / 比赛(stats titles 已即时 filter,不存 state)
  const [personMatches, setPersonMatches] = useState<WcaPerson[]>([]);
  const [compMatches, setCompMatches] = useState<Comp[]>([]);
  // loadComps 结果缓存(模块级 cache 在 utils,这里只是触发一次)
  const compsRef = useRef<Comp[] | null>(null);
  // 两个索引是否已完成加载 — 用于控制"未找到"提示,避免首次输入闪现
  const [xLoaded, setXLoaded] = useState(false);

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

  const q = query.trim().toLowerCase();
  const qRaw = query.trim();
  const xSearchEnabled = qRaw.length >= (hasNonLatin(qRaw) ? 1 : MIN_LEN_LATIN);

  // 首次需要跨库搜索时 lazy load persons + comps 索引
  useEffect(() => {
    if (!xSearchEnabled || xLoaded) return;
    Promise.all([
      loadPersonsIndex().catch(() => null),
      loadComps().then(arr => { compsRef.current = arr; }).catch(() => null),
    ]).then(() => setXLoaded(true));
  }, [xSearchEnabled, xLoaded]);

  // debounced 跨库搜索 — 输入停 200ms 后跑;索引加载完后也会重跑一次
  useEffect(() => {
    if (!xSearchEnabled) {
      setPersonMatches([]);
      setCompMatches([]);
      return;
    }
    const handle = setTimeout(() => {
      // 不 limit:全量命中,用户自己用更具体的 query 收窄
      const persons = searchLocalPersons(qRaw, Infinity) ?? [];
      setPersonMatches(persons);
      const comps = compsRef.current ? searchComps(qRaw, compsRef.current, Infinity) : [];
      setCompMatches(comps);
    }, 200);
    return () => clearTimeout(handle);
  }, [qRaw, xSearchEnabled, xLoaded]);

  // NOTE: 搜索模式忽略 tab，全库匹配；否则按 tab 过滤
  const visible = useMemo(() => {
    if (!data) return [];
    if (activeCat === LOOKUP && q === '') return [];
    return data.categories
      .filter(c => q !== '' || activeCat === ALL || c.nameEn === activeCat)
      .map(c => ({
        ...c,
        stats: q === '' ? c.stats : c.stats.filter(s =>
          s.titleEn.toLowerCase().includes(q) ||
          s.titleZh.toLowerCase().includes(q)
        ),
      }))
      .filter(c => c.stats.length > 0);
  }, [data, activeCat, q]);

  const lookupVisible = useMemo(() => {
    if (q === '') return LOOKUP_ITEMS;
    return LOOKUP_ITEMS.filter(it =>
      it.zh.toLowerCase().includes(q) || it.en.toLowerCase().includes(q),
    );
  }, [q]);

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
  const totalCount = data.categories.reduce((s, c) => s + c.stats.length, 0);
  const visibleCount =
    visible.reduce((s, c) => s + c.stats.length, 0) +
    lookupVisible.length +
    personMatches.length +
    compMatches.length;
  const hasAnyMatch = visibleCount > 0;

  return (
    <div className="wca-stats-index">
      <header className="wca-stats-index-hero">
        <div>
          <div className="wca-stats-index-eyebrow">WCA Statistics</div>
          <h1 className="wca-stats-index-title">
            {isZh ? '魔方世界的数字切片' : 'The numbers behind every solve'}
          </h1>
          <p className="wca-stats-index-sub">
            {isZh
              ? `基于 WCA 官方数据库自动生成 · 共 ${totalCount} 项 · 每周更新`
              : `${totalCount} auto-generated rankings from the WCA database · updated weekly`}
          </p>
        </div>
        <div className="wca-stats-index-hero-right">
          <LangToggle />
        </div>
      </header>

      <div className="wca-stats-index-toolbar">
        <div className="wca-stats-index-search">
          <Search size={16} strokeWidth={1.75} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isZh ? '搜索统计项 / 选手 / 比赛…' : 'Search stats, persons, competitions…'}
          />
          {q !== '' && (
            <span className="wca-stats-index-search-count">{visibleCount}</span>
          )}
          {query !== '' && (
            <ClearButton onClick={() => setQuery('')} isZh={isZh} preserveFocus />
          )}
        </div>

        {q === '' && (
          <div className="wca-stats-index-tabs">
            <button
              className={`wca-stats-index-tab ${activeCat === ALL ? 'active' : ''}`}
              onClick={() => setActiveCat(ALL)}
            >
              <span>{isZh ? '全部' : 'All'}</span>
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
        {((q === '' && (activeCat === ALL || activeCat === LOOKUP)) || (q !== '' && lookupVisible.length > 0)) && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <Search size={18} strokeWidth={1.75} />
              <h2>{isZh ? '查询' : 'Lookup'}</h2>
            </div>
            <div className="wca-stats-index-grid">
              {lookupVisible.map(it => (
                <Link key={it.path} to={`${it.path}${langQuery}`} className="wca-stats-index-card">
                  {isZh ? it.zh : it.en}
                </Link>
              ))}
            </div>
          </section>
        )}

        {visible.map(cat => {
          const iconKey = cat.iconName || '';
          const Icon = ICON_MAP[iconKey];
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
                    to={`/wca-stats/${s.id}${langQuery}`}
                    className="wca-stats-index-card"
                  >
                    {isZh ? s.titleZh : s.titleEn}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        {compMatches.length > 0 && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <CalendarDays size={18} strokeWidth={1.75} />
              <h2>{isZh ? '比赛' : 'Competitions'}</h2>
            </div>
            <div className="wca-stats-index-grid">
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
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {personMatches.length > 0 && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <UserRound size={18} strokeWidth={1.75} />
              <h2>{isZh ? '选手' : 'Persons'}</h2>
            </div>
            <div className="wca-stats-index-grid">
              {personMatches.map(p => (
                <Link
                  key={p.wcaId}
                  to={`/wca-stats/persons/${p.wcaId}${langQuery}`}
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
          </section>
        )}

        {!hasAnyMatch && activeCat !== LOOKUP && (!xSearchEnabled || xLoaded) && (
          <div className="wca-stats-index-empty">
            {isZh ? '未找到匹配项' : 'No matches found.'}
          </div>
        )}
        {!hasAnyMatch && xSearchEnabled && !xLoaded && (
          <div className="wca-stats-index-empty">
            {isZh ? '搜索中…' : 'Searching…'}
          </div>
        )}
      </div>
    </div>
  );
}
