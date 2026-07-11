'use client';

/**
 * /site — 魔方网址导航页
 * sidebar 分组 + 右侧单行密集列表;搜索用 Fuse.js;数据源 /v1/nav/sites。
 * admin 看到行内 ✏️/🗑/⬆⬇ 按钮 + 每个 group 顶端 + Add。
 *
 * 1:1 port from packages/client-vite/src/pages/sites/SitesPage.tsx (Vite SPA).
 * URL state (?g group, ?q query) is managed via nuqs (history: 'replace').
 */
import { Suspense, useMemo, useCallback, useState, useEffect } from 'react';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { Search, AlertTriangle, Pencil, Trash2, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import Fuse from 'fuse.js';
import { GROUPS } from './data/categories';
import type { GroupId, Site } from './data/types';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isAdmin } from '@/lib/auth-store';
import BackHome from '@/components/BackHome';
import { listSites, deleteSite, reorderGroup } from './nav_sites_api';
import SiteEditor from './SiteEditor';
import './sites.css';

function YouTubeBadge() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
      <rect x="1" y="5" width="22" height="14" rx="3" fill="var(--destructive)" />
      <polygon points="10,9 10,15 15,12" fill="#fff" />
    </svg>
  );
}

type GroupFilter = GroupId;
const DEFAULT_GROUP: GroupId = 'competition';

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
  const cp = trimmed.codePointAt(0) ?? 63;
  return String.fromCodePoint(cp).toUpperCase();
}

const TEXTS = {
  title:       { en: 'Web Directory', zh: '魔方导航'
},
  searchPh:    { en: 'Search name / description / URL…', zh: '搜索名称 / 描述 / 网址…'
},
  sites:       { en: 'sites',            zh: '个站点'
},
  dead:        { en: 'Offline',          zh: '不可访问'
},
  resultsFor:  { en: 'Results for',      zh: '搜索'
},
  altLink:     { en: 'mirrors',          zh: '其他镜像'
},
  noResults:   { en: 'No matches.',      zh: '没有匹配结果。'
},
  colName:     { en: 'Name',             zh: '名称'
},
  colAuthor:   { en: 'Author',           zh: '作者' },
  colDesc:     { en: 'Description',      zh: '简介'
},
  loading:     { en: 'Loading…',         zh: '加载中…'
},
  err:         { en: 'Failed to load',   zh: '加载失败'
},
  add:         { en: 'Add',              zh: '新增' },
  confirmDel:  { en: 'Delete this site?', zh: '确认删除此站点?'
},
} as const;

function splitLangTag(s: string): { en: string; zh: string
 } {
  const idx = s.search(/[㐀-鿿豈-﫿]/);
  if (idx < 0) return { en: s, zh: s };
  if (idx === 0) return { en: s, zh: s };
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
    <span className="site-avatar" style={{ backgroundColor: GROUP_COLOR[group] }} aria-hidden>
      {firstGlyph(name)}
    </span>
  );
}

interface RowProps {
  site: Site;
  lang: 'en' | 'zh';
  admin: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: (s: Site) => void;
  onDelete: (s: Site) => void;
  onMove: (s: Site, dir: -1 | 1) => void;
}

function SiteRow({ site, lang, admin, canMoveUp, canMoveDown, onEdit, onDelete, onMove }: RowProps) {
  const name = lang === 'zh' ? site.name_zh || site.name : site.name_en || site.name;
  const desc = lang === 'zh' ? site.desc_zh || site.desc_en : site.desc_en || site.desc_zh;
  const dead = site.status === 'dead';

  return (
    <div className={`site-row${dead ? ' is-dead' : ''}${admin ? ' is-admin' : ''}`}>
      <a href={site.url} target="_blank" rel="noopener noreferrer" className="site-row-main">
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
        <div className="site-row-author" title={site.author || ''}>{site.author || ''}</div>
        <div className="site-row-desc" title={desc || ''}>{desc || ''}</div>
      </a>

      {site.youtube && (
        <a href={site.youtube} target="_blank" rel="noopener noreferrer" className="site-row-yt" title="YouTube" onClick={(e) => e.stopPropagation()}>
          <YouTubeBadge />
        </a>
      )}

      {admin && (
        <div className="site-row-admin">
          <button className="site-admin-btn" disabled={!canMoveUp} title="up" onClick={() => onMove(site, -1)}><ArrowUp size={14} /></button>
          <button className="site-admin-btn" disabled={!canMoveDown} title="down" onClick={() => onMove(site, 1)}><ArrowDown size={14} /></button>
          <button className="site-admin-btn" title="edit" onClick={() => onEdit(site)}><Pencil size={14} /></button>
          <button className="site-admin-btn site-admin-del" title="delete" onClick={() => onDelete(site)}><Trash2 size={14} /></button>
        </div>
      )}

      {site.alt_urls && site.alt_urls.length > 0 && (
        <div className="site-row-alts">
          <span className="site-row-alts-label">{TEXTS.altLink[lang]}:</span>
          {site.alt_urls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="site-row-alt">{hostOf(u)}</a>
          ))}
        </div>
      )}
    </div>
  );
}

function SitesPageInner() {
  const { i18n } = useTranslation();
  const lang: 'en' | 'zh' = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  useDocumentTitle('网站导航', 'Sites Directory');
  // admin comes from the client-only auth store; gate on mount so SSR and the
  // first client render agree (both non-admin) and don't trip a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const admin = mounted && isAdmin();

  const [params, setQuery] = useQueryStates(
    { g: parseAsString, q: parseAsString },
    { history: 'replace', scroll: false },
  );
  const group = ((params.g as GroupId) || DEFAULT_GROUP) as GroupFilter;
  const query = params.q || '';

  const [sites, setSites] = useState<Site[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Site | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancel = false;
    listSites()
      .then((rows) => { if (!cancel) setSites(rows); })
      .catch((e) => { if (!cancel) setLoadErr(e instanceof Error ? e.message : String(e)); });
    return () => { cancel = true; };
  }, []);

  const setGroup = useCallback(
    (g: GroupFilter) => {
      void setQuery({ g: g === DEFAULT_GROUP ? null : g });
    },
    [setQuery],
  );

  const [inputValue, setInputValue] = useState(query);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    setInputValue((prev) => (prev === query ? prev : query));
  }, [query]);

  useEffect(() => {
    if (inputValue === query) return;
    if (composing) return;
    const t = setTimeout(() => {
      void setQuery({ q: inputValue || null });
    }, 150);
    return () => clearTimeout(t);
  }, [inputValue, composing, query, setQuery]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    if (sites) for (const s of sites) c[s.group] = (c[s.group] || 0) + 1;
    return c;
  }, [sites]);

  const fuse = useMemo(
    () =>
      new Fuse(sites ?? [], {
        keys: [
          { name: 'name', weight: 0.25 },
          { name: 'name_zh', weight: 0.25 },
          { name: 'name_en', weight: 0.18 },
          { name: 'desc_zh', weight: 0.12 },
          { name: 'desc_en', weight: 0.08 },
          { name: 'author', weight: 0.05 },
          {
            name: 'tagTokens',
            weight: 0.3,
            getFn: (s: Site) =>
              (s.tags ?? []).flatMap((t) => {
                const { en, zh } = splitLangTag(t);
                return [en, zh].filter(Boolean);
              }),
          },
          { name: 'url', weight: 0.05 },
        ],
        threshold: 0.35,
        minMatchCharLength: 2,
        ignoreLocation: true,
      }),
    [sites],
  );

  const filtered = useMemo(() => {
    if (!sites) return [];
    if (query.trim()) return fuse.search(query.trim()).map((r) => r.item);
    return sites.filter((s) => s.group === group);
  }, [sites, query, group, fuse]);

  const headerLabel = query.trim()
    ? `${TEXTS.resultsFor[lang]} "${query.trim()}"`
    : GROUPS.find((g) => g.id === group)?.[lang === 'zh' ? 'label_zh' : 'label_en'] || group;

  function applySaved(saved: Site) {
    setSites((prev) => {
      if (!prev) return [saved];
      const i = prev.findIndex((s) => s.id === saved.id);
      if (i >= 0) {
        const copy = prev.slice();
        copy[i] = saved;
        return copy;
      }
      return [...prev, saved];
    });
    setEditing(null);
    setCreating(false);
  }

  async function handleDelete(s: Site) {
    if (!window.confirm(TEXTS.confirmDel[lang])) return;
    try {
      await deleteSite(s.id);
      setSites((prev) => prev?.filter((x) => x.id !== s.id) ?? null);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleMove(s: Site, dir: -1 | 1) {
    if (!sites) return;
    const groupRows = sites.filter((x) => x.group === s.group);
    const idx = groupRows.findIndex((x) => x.id === s.id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= groupRows.length) return;
    const newOrder = groupRows.slice();
    [newOrder[idx], newOrder[j]] = [newOrder[j], newOrder[idx]];
    const ids = newOrder.map((x) => x.id);
    setSites((prev) => {
      if (!prev) return prev;
      const others = prev.filter((x) => x.group !== s.group);
      return [...others, ...newOrder];
    });
    try {
      await reorderGroup(s.group, ids);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
      listSites().then(setSites).catch(() => {});
    }
  }

  return (
    <div className="sites-page">
      <aside className="sites-sidebar">
        <BackHome className="sites-back" />
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
      </aside>

      <main className="sites-main">
        <header className="sites-main-header">
          <h1>{headerLabel}</h1>
          <span className="sites-main-count">
            {filtered.length} {TEXTS.sites[lang]}
          </span>
          {admin && !query.trim() && (
            <button className="sites-add-btn" onClick={() => setCreating(true)}>
              <Plus size={14} /> {TEXTS.add[lang]}
            </button>
          )}
        </header>

        {loadErr ? (
          <div className="sites-empty">{TEXTS.err[lang]}: {loadErr}</div>
        ) : !sites ? (
          <div className="sites-empty">{TEXTS.loading[lang]}</div>
        ) : filtered.length === 0 ? (
          <div className="sites-empty">{TEXTS.noResults[lang]}</div>
        ) : (
          <div className="sites-list">
            <div className="sites-list-head" aria-hidden>
              <span />
              <span>{TEXTS.colName[lang]}</span>
              <span>{TEXTS.colAuthor[lang]}</span>
              <span>{TEXTS.colDesc[lang]}</span>
            </div>
            {filtered.map((s, i) => (
              <SiteRow
                key={s.id}
                site={s}
                lang={lang}
                admin={admin && !query.trim()}
                canMoveUp={i > 0 && filtered[i - 1].group === s.group}
                canMoveDown={i < filtered.length - 1 && filtered[i + 1].group === s.group}
                onEdit={setEditing}
                onDelete={handleDelete}
                onMove={handleMove}
              />
            ))}
          </div>
        )}
      </main>

      {(editing || creating) && (
        <SiteEditor
          initial={editing}
          defaultGroup={group}
          lang={lang}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={applySaved}
        />
      )}
    </div>
  );
}

export default function SitesPage() {
  return (
    <Suspense fallback={<div className="sites-page"><div className="sites-empty">Loading…</div></div>}>
      <SitesPageInner />
    </Suspense>
  );
}
