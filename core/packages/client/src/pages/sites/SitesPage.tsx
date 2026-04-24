/**
 * /site — 魔方网址导航页
 * sidebar 分组 + 右侧单行密集列表；搜索用 Fuse.js。
 */
import { useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Search, AlertTriangle } from 'lucide-react';
import Fuse from 'fuse.js';
import { SITES } from './data/sites';
import { GROUPS } from './data/categories';
import type { GroupId, Site } from './data/types';
import './sites.css';

type GroupFilter = 'all' | GroupId;

// 按分组给字母头像配色（hue 保证彼此有区分度）
const GROUP_COLOR: Record<GroupId, string> = {
  competition: '#2f6fd8',
  timer:       '#0a8a6b',
  learning:    '#8c5ad1',
  algorithms:  '#c2410c',
  events:      '#b3248a',
  recon:       '#0891b2',
  simulators:  '#6b7c1f',
  solvers:     '#5b4bd4',
  cubers:      '#c2185b',
  shop:        '#8b6f18',
};

function firstGlyph(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  // 优先取首字母（含中日韩）
  const cp = trimmed.codePointAt(0) ?? 63;
  return String.fromCodePoint(cp).toUpperCase();
}

const TEXTS = {
  title:       { en: 'Web Directory', zh: '魔方导航' },
  subtitle:    { en: 'Curated cube-related sites',       zh: '精选魔方相关网站' },
  searchPh:    { en: 'Search name / description / URL…', zh: '搜索名称 / 描述 / 网址…' },
  allGroup:    { en: 'All',              zh: '全部' },
  sites:       { en: 'sites',            zh: '个站点' },
  dead:        { en: 'Offline',          zh: '不可访问' },
  resultsFor:  { en: 'Results for',      zh: '搜索' },
  crossGroup:  { en: 'Search all groups',zh: '跨分类搜索' },
  back:        { en: 'Home',             zh: '首页' },
  altLink:     { en: 'mirrors',          zh: '其他镜像' },
  noResults:   { en: 'No matches.',      zh: '没有匹配结果。' },
} as const;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function LetterAvatar({ name, group }: { name: string; group: GroupId }) {
  return (
    <span
      className="site-avatar"
      style={{ backgroundColor: GROUP_COLOR[group] }}
      aria-hidden
    >
      {firstGlyph(name)}
    </span>
  );
}

function SiteRow({ site, lang }: { site: Site; lang: 'en' | 'zh' }) {
  const name =
    lang === 'zh'
      ? site.name_zh || site.name
      : site.name_en || site.name;
  const desc =
    lang === 'zh'
      ? site.desc_zh || site.desc_en || site.author
      : site.desc_en || site.desc_zh || site.author;
  const dead = site.status === 'dead';

  // 不把整行做成 <a>（里面会嵌套 alt <a>，HTML 非法）。
  // 主链接只包 icon + 文本块，alt_urls 作为兄弟节点放在同一容器。
  return (
    <div className={`site-row${dead ? ' is-dead' : ''}`}>
      <a
        href={site.url}
        target="_blank"
        rel="noopener noreferrer"
        className="site-row-main"
      >
        <div className="site-row-icon">
          {dead ? <AlertTriangle size={20} className="site-dead-icon" /> : <LetterAvatar name={name} group={site.group} />}
        </div>
        <div className="site-row-body">
          <div className="site-row-head">
            <span className="site-row-name">{name}</span>
            <span className="site-row-host">{hostOf(site.url)}</span>
            {site.subgroup && <span className="site-row-subgroup">{site.subgroup}</span>}
            {dead && <span className="site-row-dead-badge">{TEXTS.dead[lang]}</span>}
          </div>
          {desc && <div className="site-row-desc">{desc}</div>}
        </div>
      </a>
      {site.alt_urls && site.alt_urls.length > 0 && (
        <div className="site-row-alts">
          <span className="site-row-alts-label">{TEXTS.altLink[lang]}:</span>
          {site.alt_urls.map((u) => (
            <a
              key={u}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="site-row-alt"
            >
              {hostOf(u)}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SitesPage() {
  const { i18n } = useTranslation();
  const lang: 'en' | 'zh' = i18n.language.startsWith('zh') ? 'zh' : 'en';

  const [params, setParams] = useSearchParams();
  const group = (params.get('g') || 'all') as GroupFilter;
  const query = params.get('q') || '';
  const crossGroup = params.get('cross') === '1';

  const setGroup = useCallback(
    (g: GroupFilter) => {
      const next = new URLSearchParams(params);
      if (g === 'all') next.delete('g');
      else next.set('g', g);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const setQuery = useCallback(
    (q: string) => {
      const next = new URLSearchParams(params);
      if (q) next.set('q', q);
      else next.delete('q');
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const toggleCross = useCallback(() => {
    const next = new URLSearchParams(params);
    if (crossGroup) next.delete('cross');
    else next.set('cross', '1');
    setParams(next, { replace: true });
  }, [params, setParams, crossGroup]);

  const toggleLang = useCallback(() => {
    const n = lang === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(n);
    localStorage.setItem('trainer-lang', n);
  }, [lang, i18n]);

  // 分组计数
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: SITES.length };
    for (const s of SITES) c[s.group] = (c[s.group] || 0) + 1;
    return c;
  }, []);

  // Fuse 实例（全体，按 group 过滤在外层处理）
  const fuse = useMemo(
    () =>
      new Fuse(SITES, {
        keys: [
          { name: 'name', weight: 0.3 },
          { name: 'name_zh', weight: 0.3 },
          { name: 'name_en', weight: 0.2 },
          { name: 'desc_zh', weight: 0.15 },
          { name: 'desc_en', weight: 0.1 },
          { name: 'author', weight: 0.05 },
          { name: 'subgroup', weight: 0.05 },
          { name: 'url', weight: 0.05 },
        ],
        threshold: 0.35,
        minMatchCharLength: 2,
        ignoreLocation: true,
      }),
    [],
  );

  const filtered = useMemo(() => {
    let list: Site[] = SITES;
    if (query.trim()) {
      const hits = fuse.search(query.trim()).map((r) => r.item);
      list = crossGroup ? hits : hits.filter((s) => group === 'all' || s.group === group);
    } else {
      list = group === 'all' ? SITES : SITES.filter((s) => s.group === group);
    }
    return list;
  }, [query, group, crossGroup, fuse]);

  const headerLabel = query.trim()
    ? `${TEXTS.resultsFor[lang]} "${query.trim()}"`
    : group === 'all'
      ? TEXTS.allGroup[lang]
      : GROUPS.find((g) => g.id === group)?.[lang === 'zh' ? 'label_zh' : 'label_en'] || group;

  return (
    <div className="sites-page">
      <aside className="sites-sidebar">
        <Link to="/" className="sites-back">
          <ArrowLeft size={16} />
          {TEXTS.back[lang]}
        </Link>
        <div className="sites-title">{TEXTS.title[lang]}</div>

        <div className="sites-search">
          <Search size={14} className="sites-search-icon" />
          <input
            className="sites-search-input"
            placeholder={TEXTS.searchPh[lang]}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {query.trim() && (
          <label className="sites-cross">
            <input type="checkbox" checked={crossGroup} onChange={toggleCross} />
            <span>{TEXTS.crossGroup[lang]}</span>
          </label>
        )}

        <nav className="sites-nav">
          <button
            className={`sites-nav-item${group === 'all' ? ' is-active' : ''}`}
            onClick={() => setGroup('all')}
          >
            <span>{TEXTS.allGroup[lang]}</span>
            <span className="sites-nav-count">{counts.all}</span>
          </button>
          {GROUPS.map((g) => (
            <button
              key={g.id}
              className={`sites-nav-item${group === g.id ? ' is-active' : ''}`}
              onClick={() => setGroup(g.id)}
            >
              <span>{lang === 'zh' ? g.label_zh : g.label_en}</span>
              <span className="sites-nav-count">{counts[g.id] || 0}</span>
            </button>
          ))}
        </nav>

        <button className="sites-lang" onClick={toggleLang}>
          {lang === 'zh' ? 'English' : '中文'}
        </button>
      </aside>

      <main className="sites-main">
        <header className="sites-main-header">
          <h1>{headerLabel}</h1>
          <span className="sites-main-count">
            {filtered.length} {TEXTS.sites[lang]}
          </span>
        </header>

        {filtered.length === 0 ? (
          <div className="sites-empty">{TEXTS.noResults[lang]}</div>
        ) : (
          <div className="sites-list">
            {filtered.map((s) => (
              <SiteRow key={s.id} site={s} lang={lang} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
