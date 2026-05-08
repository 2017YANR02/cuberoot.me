// NOTE: WCA 统计索引页 — 浅色主题（对齐首页 landing.css tokens）+ 搜索 + Tab 分类
// 路由：/wca-stats
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Trophy, BarChart3, Medal, UserRound, Tent, Globe2, Pin, Search,
  type LucideIcon,
} from 'lucide-react';
import { getLangQuery } from '../../i18n';
import LangToggle from '../../components/LangToggle';
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

export default function WcaStatsIndex() {
  const { i18n } = useTranslation();
  const [data, setData] = useState<IndexData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string>(ALL);
  const [query, setQuery] = useState('');

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

  // NOTE: 搜索模式忽略 tab，全库匹配；否则按 tab 过滤
  const visible = useMemo(() => {
    if (!data) return [];
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
  const visibleCount = visible.reduce((s, c) => s + c.stats.length, 0);

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
            placeholder={isZh ? '搜索统计项…' : 'Search stats…'}
          />
          {q !== '' && (
            <span className="wca-stats-index-search-count">{visibleCount}</span>
          )}
        </div>

        {q === '' && (
          <div className="wca-stats-index-tabs">
            <button
              className={`wca-stats-index-tab ${activeCat === ALL ? 'active' : ''}`}
              onClick={() => setActiveCat(ALL)}
            >
              <span>{isZh ? '全部' : 'All'}</span>
              <span className="wca-stats-index-tab-count">{totalCount}</span>
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
                  <span className="wca-stats-index-tab-count">{cat.stats.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="wca-stats-index-body">
        {(q === '' && activeCat === ALL) && (
          <section className="wca-stats-index-section">
            <div className="wca-stats-index-section-header">
              <Search size={18} strokeWidth={1.75} />
              <h2>{isZh ? '查询' : 'Lookup'}</h2>
            </div>
            <div className="wca-stats-index-grid">
              <Link to={`/wca-stats/persons${langQuery}`} className="wca-stats-index-card">
                {isZh ? '查 WCA 个人成绩 / PR / 比赛历史' : 'WCA results / PRs / competition history'}
              </Link>
              <Link to={`/nemesizer${langQuery}`} className="wca-stats-index-card">
                {isZh ? '宿敌' : 'Nemesizer'}
              </Link>
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
                <span className="wca-stats-index-section-count">{cat.stats.length}</span>
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

        {visible.length === 0 && (
          <div className="wca-stats-index-empty">
            {isZh ? '未找到匹配的统计项' : 'No stats match your search.'}
          </div>
        )}
      </div>
    </div>
  );
}
