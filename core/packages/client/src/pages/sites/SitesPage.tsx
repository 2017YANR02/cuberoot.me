/**
 * /site — 魔方网址导航页
 * sidebar 分组 + 右侧单行密集列表；搜索用 Fuse.js。
 */
import { useMemo, useCallback, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, AlertTriangle } from 'lucide-react';

function YouTubeBadge() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
      <rect x="1" y="5" width="22" height="14" rx="3" fill="#d13636" />
      <polygon points="10,9 10,15 15,12" fill="#fff" />
    </svg>
  );
}
import Fuse from 'fuse.js';
import { SITES } from './data/sites';
import { GROUPS } from './data/categories';
import type { GroupId, Site } from './data/types';
import './sites.css';

type GroupFilter = GroupId;
const DEFAULT_GROUP: GroupId = 'competition';

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
  sites:       { en: 'sites',            zh: '个站点' },
  dead:        { en: 'Offline',          zh: '不可访问' },
  resultsFor:  { en: 'Results for',      zh: '搜索' },
  altLink:     { en: 'mirrors',          zh: '其他镜像' },
  noResults:   { en: 'No matches.',      zh: '没有匹配结果。' },
  colName:     { en: 'Name',             zh: '名称' },
  colAuthor:   { en: 'Author',           zh: '作者' },
  colDesc:     { en: 'Description',      zh: '简介' },
} as const;

// tag 字符串里 EN 和 ZH 拼在一起（如 "Timer 计时器"），按首个 CJK 字符切开
function splitLangTag(s: string): { en: string; zh: string } {
  const idx = s.search(/[㐀-鿿豈-﫿]/);
  if (idx < 0) return { en: s, zh: s }; // 纯 EN（"Stat" / "FMC"）
  if (idx === 0) return { en: s, zh: s }; // 纯 ZH（"拼图"）
  return { en: s.slice(0, idx).trim(), zh: s.slice(idx).trim() };
}

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
      ? site.desc_zh || site.desc_en
      : site.desc_en || site.desc_zh;
  const dead = site.status === 'dead';

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
        <div className="site-row-title">
          <span className="site-row-name">{name}</span>
          <span className="site-row-host">{hostOf(site.url)}</span>
          {site.tags?.map((t) => (
            <span key={t} className="site-row-subgroup">{splitLangTag(t)[lang]}</span>
          ))}
          {dead && <span className="site-row-dead-badge">{TEXTS.dead[lang]}</span>}
        </div>
        <div className="site-row-author" title={site.author || ''}>
          {site.author || ''}
        </div>
        <div className="site-row-desc" title={desc || ''}>
          {desc || ''}
        </div>
      </a>
      {site.youtube && (
        <a
          href={site.youtube}
          target="_blank"
          rel="noopener noreferrer"
          className="site-row-yt"
          title="YouTube"
          onClick={(e) => e.stopPropagation()}
        >
          <YouTubeBadge />
        </a>
      )}
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
  const group = ((params.get('g') as GroupId) || DEFAULT_GROUP) as GroupFilter;
  const query = params.get('q') || '';

  const setGroup = useCallback(
    (g: GroupFilter) => {
      const next = new URLSearchParams(params);
      if (g === DEFAULT_GROUP) next.delete('g');
      else next.set('g', g);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  // 本地输入 state:避免每次按键都 setParams 导致中文 IME 组词错乱
  const [inputValue, setInputValue] = useState(query);
  const [composing, setComposing] = useState(false);

  // URL 外部变化(例如浏览器返回)同步回本地 state
  useEffect(() => {
    setInputValue((prev) => (prev === query ? prev : query));
  }, [query]);

  // 本地输入变更 → 延迟写回 URL;组词期间不写
  // composing 必须是 state(不是 ref)— compositionEnd 时 inputValue 常和组词中的中间态相同,
  // 不会触发 re-render,要靠 composing 翻转重跑 effect 才能 flush
  useEffect(() => {
    if (inputValue === query) return;
    if (composing) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (inputValue) next.set('q', inputValue);
      else next.delete('q');
      setParams(next, { replace: true });
    }, 150);
    return () => clearTimeout(t);
  }, [inputValue, composing, query, params, setParams]);

  const toggleLang = useCallback(() => {
    const n = lang === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(n);
    localStorage.setItem('trainer-lang', n);
  }, [lang, i18n]);

  // 分组计数
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
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
          { name: 'tags', weight: 0.05 },
          { name: 'url', weight: 0.05 },
        ],
        threshold: 0.35,
        minMatchCharLength: 2,
        ignoreLocation: true,
      }),
    [],
  );

  const filtered = useMemo(() => {
    if (query.trim()) {
      return fuse.search(query.trim()).map((r) => r.item);
    }
    return SITES.filter((s) => s.group === group);
  }, [query, group, fuse]);

  const headerLabel = query.trim()
    ? `${TEXTS.resultsFor[lang]} "${query.trim()}"`
    : GROUPS.find((g) => g.id === group)?.[lang === 'zh' ? 'label_zh' : 'label_en'] || group;

  return (
    <div className="sites-page">
      <aside className="sites-sidebar">
        <div className="sites-title">{TEXTS.title[lang]}</div>

        <div className="sites-search">
          <Search size={14} className="sites-search-icon" />
          <input
            className="sites-search-input"
            placeholder={TEXTS.searchPh[lang]}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(e) => {
              setComposing(false);
              setInputValue((e.target as HTMLInputElement).value);
            }}
          />
        </div>

        <nav className="sites-nav">
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
            <div className="sites-list-head" aria-hidden>
              <span />
              <span>{TEXTS.colName[lang]}</span>
              <span>{TEXTS.colAuthor[lang]}</span>
              <span>{TEXTS.colDesc[lang]}</span>
            </div>
            {filtered.map((s) => (
              <SiteRow key={s.id} site={s} lang={lang} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
