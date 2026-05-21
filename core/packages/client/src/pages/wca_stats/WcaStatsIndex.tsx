// NOTE: WCA 统计索引页 — 浅色主题（对齐首页 landing.css tokens）+ 搜索 + Tab 分类
// 路由：/wca
import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin, Search, Wrench,
  CalendarDays, LineChart, TrendingDown, Radio, Target, Calculator,
  type LucideIcon,
} from 'lucide-react';
import { loadPersonsIndex, searchLocalPersons, type WcaPerson } from '@cuberoot/shared';
import { getLangQuery } from '../../i18n';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import { ClearButton } from '../../components/ClearButton';
import { Flag } from '../../utils/flag';
import { displayCuberName } from '../../utils/name_utils';
import { loadComps, searchComps, type Comp } from '../../utils/comp_search';
import { compNameZh } from '../../utils/country_flags';
import { stripWcaPrefix } from '../../utils/comp_localize';
import { localizeCity } from '../../utils/city_localize';
import { formatDateRangeIso } from '../../utils/date_range';
import { compLinkProps } from '../../utils/comp_link';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
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

const TOOLS = '__tools__';
const LOOKUP = '__lookup__';

// 顶层工具页(大卡片,带图标 — 跟 landing 卡片视觉一致)
const WCA_TOOLS: { path: string; zh: string; en: string; Icon: LucideIcon }[] = [
  { path: '/wca/comp',       zh: '比赛',     en: 'Comp',         Icon: Radio },
  { path: '/wca/calendar',   zh: '日历',     en: 'Calendar',     Icon: CalendarDays },
  { path: '/wca/globe',      zh: '地球',     en: 'Globe',        Icon: Globe2 },
  { path: '/wca/viz',        zh: '分布',     en: 'Distribution', Icon: LineChart },
  { path: '/wca/prediction', zh: '预测',     en: 'Prediction',   Icon: TrendingDown },
  { path: '/nemesizer',      zh: '宿敌',     en: 'Nemesizer',    Icon: Target },
  { path: '/calc',           zh: '计算器',   en: 'Calculator',   Icon: Calculator },
];

const LOOKUP_ITEMS: { path: string; extraQuery?: string; zh: string; en: string }[] = [
  { path: '/wca/grand-slam',       zh: '大满贯',       en: 'Grand Slam' },
  { path: '/wca/all-results',      zh: '全部成绩排名', en: 'All Results' },
  { path: '/wca/cohort-ranks',     zh: '参赛届别排名', en: 'Cohort Ranks' },
  { path: '/wca/success-rate',     zh: '项目成功率',   en: 'Success Rate' },
  { path: '/wca/all-events-done',  zh: '全项目达成',   en: 'All Events Done' },
  { path: '/wca/sum-of-ranks',     zh: '全项目排名',   en: 'Sum of Ranks' },
  { path: '/wca/sum-of-ranks',     extraQuery: 'hidePodium=1',    zh: '全能但无牌', en: 'All-Around · No Podium' },
  { path: '/wca/sum-of-ranks',     extraQuery: 'bestMisser=4',    zh: '殿军之王',   en: 'Fourth-Place King' },
];

// NOTE: 选手 / 比赛跨库搜索阈值。英文/数字 q.length >= 2 才发,中文/包含 unicode 1 字符即可
const MIN_LEN_LATIN = 2;
const hasNonLatin = (s: string) => /[^\x00-\x7F]/.test(s);

export default function WcaStatsIndex() {
  const { i18n } = useTranslation();
  useDocumentTitle('WCA 统计', 'WCA Statistics');
  const [data, setData] = useState<IndexData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string>(TOOLS);
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

  // NOTE: 搜索模式忽略 tab,全库匹配;否则按 tab 过滤(TOOLS / LOOKUP 不显示 stats categories)
  const visible = useMemo(() => {
    if (!data) return [];
    if (q === '' && (activeCat === LOOKUP || activeCat === TOOLS)) return [];
    return data.categories
      .filter(c => q !== '' || c.nameEn === activeCat)
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

  const toolsVisible = useMemo(() => {
    if (q === '') return WCA_TOOLS;
    return WCA_TOOLS.filter(it =>
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
  const visibleCount =
    visible.reduce((s, c) => s + c.stats.length, 0) +
    lookupVisible.length +
    toolsVisible.length +
    personMatches.length +
    compMatches.length;
  const hasAnyMatch = visibleCount > 0;

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
        {((q === '' && activeCat === TOOLS) || (q !== '' && toolsVisible.length > 0)) && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <Wrench size={18} strokeWidth={1.75} />
              <h2>{isZh ? '工具' : 'Tools'}</h2>
            </div>
            <div className="wca-tools-grid">
              {toolsVisible.map(it => (
                <Link key={it.path} to={`${it.path}${langQuery}`} className="wca-tool-card">
                  <it.Icon size={28} strokeWidth={1.5} />
                  <span>{isZh ? it.zh : it.en}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {((q === '' && activeCat === LOOKUP) || (q !== '' && lookupVisible.length > 0)) && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <Search size={18} strokeWidth={1.75} />
              <h2>{isZh ? '查询' : 'Lookup'}</h2>
            </div>
            <div className="wca-stats-index-grid">
              {lookupVisible.map(it => {
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
