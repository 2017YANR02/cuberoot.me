'use client';

/**
 * /site — 魔方网址导航页
 * 顶部话题/项目筛选 + 单行密集列表;搜索用 Fuse.js;数据源 /v1/nav/sites。
 * admin 看到行内 ✏️/🗑/⬆⬇ 按钮 + Add。
 *
 * 1:1 port from packages/client-vite/src/pages/sites/SitesPage.tsx (Vite SPA).
 * URL state (?q query, ?topic topics, ?events events, ?sets alg sets, ?methods methods)
 * is managed via nuqs (history: 'replace').
 */
import { Suspense, useMemo, useCallback, useState, useEffect } from 'react';
import { useQueryStates, parseAsArrayOf, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { Search, AlertTriangle, Pencil, Trash2, ArrowUp, ArrowDown, Plus, Route, Sigma } from 'lucide-react';
import Fuse from 'fuse.js';
import { ALG_CATALOG } from '@cuberoot/shared/alg';
import { WCA_AUTHOR_BY_CREDIT } from './data/wca-authors';
import type { GroupId, Site } from './data/types';
import { isAdmin } from '@/lib/auth-store';
import { firstGlyph } from '@/lib/first-glyph';
import BackHome from '@/components/BackHome';
import { ClearButton } from '@/components/ClearButton';
import PersonLink from '@/components/PersonLink';
import PuzzlePicker, { type PuzzlePickerGroup } from '@/components/PuzzlePicker/PuzzlePicker';
import { ALL_EVENT_IDS, CANCELLED_EVENT_IDS } from '@/lib/event-constants';
import { eventDisplayName } from '@/lib/wca-events';
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

const TEXTS = {
  title:       { en: 'Web Directory', zh: '魔方导航' },
  topics:      { en: 'Topics',        zh: '话题' },
  projects:    { en: 'Events',        zh: '项目' },
  algSets:     { en: 'Algorithm sets', zh: '公式集' },
  methods:     { en: 'Methods',        zh: '方法' },
  wcaProjects: { en: 'WCA events',    zh: 'WCA 项目' },
  otherProjects: { en: 'Non-WCA events', zh: '非 WCA 项目' },
  clearProjects: { en: 'Clear events', zh: '清除项目' },
  clearAlgSets: { en: 'Clear algorithm sets', zh: '清除公式集' },
  clearMethods: { en: 'Clear methods', zh: '清除方法' },
  searchPh:    { en: 'Search name / description / URL…', zh: '搜索名称 / 描述 / 网址…'
},
  sites:       { en: 'sites',            zh: '个站点'
},
  dead:        { en: 'Offline',          zh: '不可访问'
},
  resultsFor:  { en: 'Results for',      zh: '搜索'
},
  altLink:     { en: 'related links',    zh: '相关链接'
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

const ACTIVE_WCA_EVENT_IDS = ALL_EVENT_IDS.filter((id) => !CANCELLED_EVENT_IDS.has(id));
const NON_WCA_SITE_PROJECT_IDS = ['fto'] as const;
const SITE_PROJECT_IDS = [...ACTIVE_WCA_EVENT_IDS, ...NON_WCA_SITE_PROJECT_IDS];
const SITE_PROJECTS = new Set<string>(SITE_PROJECT_IDS);

/** 网址目录的规范标签与项目之间的精确映射;这些标签只进项目菜单,不再重复显示为话题。 */
const SITE_EVENT_TAGS: Record<string, readonly string[]> = {
  '333': ['3x3 三阶'],
  '222': ['2x2 二阶'],
  '444': ['4x4 四阶'],
  '555': ['5x5 五阶'],
  '666': ['6x6 六阶'],
  '777': ['7x7 七阶'],
  '333bf': ['BLD 盲拧'],
  '333fm': ['FMC 最少步'],
  '333oh': ['OH 单手'],
  minx: ['Megaminx 五魔方'],
  pyram: ['Pyraminx 金字塔'],
  clock: ['Clock 魔表'],
  skewb: ['Skewb 斜转'],
  sq1: ['Square-1', 'SQ1'],
  fto: ['FTO'],
};

const PROJECT_TOPIC_TAGS = new Set(
  Object.values(SITE_EVENT_TAGS).flat().map((tag) => tag.toLowerCase()),
);

interface SiteFilterOption {
  id: string;
  label: { en: string; zh: string };
  aliases: readonly string[];
}

const normalizeFilterValue = (value: string): string => value.trim().toLowerCase();

/** 目录现有的解法标签;精确别名避免把一般教程词误判为方法。 */
const SITE_METHOD_OPTIONS: readonly SiteFilterOption[] = [
  { id: 'cfop', label: { en: 'CFOP', zh: 'CFOP' }, aliases: ['CFOP'] },
  { id: 'roux', label: { en: 'Roux', zh: '桥式' }, aliases: ['Roux', '桥式', 'Roux 桥式'] },
  { id: 'zz', label: { en: 'ZZ', zh: 'ZZ' }, aliases: ['ZZ'] },
  { id: 'petrus', label: { en: 'Petrus', zh: 'Petrus' }, aliases: ['Petrus'] },
  { id: 'lbl', label: { en: 'LBL', zh: '层先' }, aliases: ['LBL', '层先', 'LBL 层先'] },
];

const SITE_METHOD_BY_ALIAS = new Map<string, SiteFilterOption>();
for (const option of SITE_METHOD_OPTIONS) {
  SITE_METHOD_BY_ALIAS.set(option.id, option);
  for (const alias of option.aliases) SITE_METHOD_BY_ALIAS.set(normalizeFilterValue(alias), option);
}

/** 公式集名称来自共享 ALG_CATALOG;目录只显示当前站点数据实际使用到的集合。 */
const SITE_ALG_SET_OPTIONS: SiteFilterOption[] = [];
const SITE_ALG_SET_BY_ID = new Map<string, SiteFilterOption>();
const SITE_ALG_SET_BY_ALIAS = new Map<string, SiteFilterOption>();
for (const sets of Object.values(ALG_CATALOG)) {
  for (const meta of sets) {
    const canonicalLabel = meta.short || meta.en;
    const id = normalizeFilterValue(canonicalLabel);
    let option = SITE_ALG_SET_BY_ID.get(id);
    if (!option) {
      option = { id, label: { en: canonicalLabel, zh: canonicalLabel }, aliases: [] };
      SITE_ALG_SET_BY_ID.set(id, option);
      SITE_ALG_SET_OPTIONS.push(option);
    }
    for (const alias of [meta.short, meta.scd, meta.en, meta.zh]) {
      if (!alias) continue;
      const key = normalizeFilterValue(alias);
      if (!SITE_ALG_SET_BY_ALIAS.has(key)) SITE_ALG_SET_BY_ALIAS.set(key, option);
    }
  }
}

// 兼容旧话题链接与目录数据中的简称;共享目录使用“棱块朝向”。
const eoOption = SITE_ALG_SET_BY_ID.get('eo');
if (eoOption) SITE_ALG_SET_BY_ALIAS.set(normalizeFilterValue('棱朝向'), eoOption);

/** 目录没有为高阶盲拧/多盲单列标签,只在名称与简介里按这些明确别名补充匹配。 */
const SITE_EVENT_TEXT_ALIASES: Record<string, readonly string[]> = {
  '444bf': ['4bld', '444bf', '四阶盲拧', '四盲'],
  '555bf': ['5bld', '555bf', '五阶盲拧', '五盲'],
  '333mbf': ['mbld', '333mbf', 'multi-blind', 'multiblind', '多盲'],
};

function siteMatchesEvent(site: Site, eventId: string): boolean {
  const acceptedTags = SITE_EVENT_TAGS[eventId];
  if (acceptedTags) {
    const normalized = new Set((site.tags ?? []).map((tag) => tag.trim().toLowerCase()));
    if (acceptedTags.some((tag) => normalized.has(tag.toLowerCase()))) return true;
  }
  const aliases = SITE_EVENT_TEXT_ALIASES[eventId];
  if (!aliases) return false;
  const text = [site.name, site.name_zh, site.name_en, site.desc_zh, site.desc_en, ...(site.tags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return aliases.some((alias) => text.includes(alias));
}

function splitLangTag(s: string): { en: string; zh: string
 } {
  const idx = s.search(/[㐀-鿿豈-﫿]/);
  if (idx < 0) return { en: s, zh: s };
  if (idx === 0) return { en: s, zh: s };
  return { en: s.slice(0, idx).trim(), zh: s.slice(idx).trim() };
}

function optionForTag(rawTag: string, byAlias: ReadonlyMap<string, SiteFilterOption>): SiteFilterOption | undefined {
  const { en, zh } = splitLangTag(rawTag);
  for (const value of [rawTag, en, zh]) {
    const option = byAlias.get(normalizeFilterValue(value));
    if (option) return option;
  }
  return undefined;
}

function methodForTag(rawTag: string): SiteFilterOption | undefined {
  return optionForTag(rawTag, SITE_METHOD_BY_ALIAS);
}

function algSetForTag(rawTag: string): SiteFilterOption | undefined {
  // 解法标签优先,避免未来公式目录出现同名集合时在两个菜单重复。
  if (methodForTag(rawTag)) return undefined;
  return optionForTag(rawTag, SITE_ALG_SET_BY_ALIAS);
}

function topicKey(label: string, lang: 'en' | 'zh'): string {
  return label.trim().toLocaleLowerCase(lang === 'zh' ? 'zh-Hans' : 'en');
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function linkLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${host}${path}${parsed.search}${parsed.hash}`;
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

/** 精确子串(不区分大小写)命中在哪一档:名称 0 > 标签/作者/网址 1 > 简介 2 > 只是模糊像 3。 */
function matchTier(s: Site, lowerQuery: string): number {
  const has = (v?: string | null) => !!v && v.toLowerCase().includes(lowerQuery);
  if (has(s.name) || has(s.name_zh) || has(s.name_en)) return 0;
  if (has(s.author) || has(s.url) || has(s.github) || (s.alt_urls ?? []).some(has) || (s.tags ?? []).some(has)) return 1;
  if (has(s.desc_zh) || has(s.desc_en)) return 2;
  return 3;
}

interface RowProps {
  site: Site;
  lang: 'en' | 'zh';
  admin: boolean;
  /** 搜索结果按相关度跨组混排,「组内上下移」在这种列表里没有可见反馈 → 只收起移动按钮,编辑/删除照常。 */
  reorderable: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: (s: Site) => void;
  onDelete: (s: Site) => void;
  onMove: (s: Site, dir: -1 | 1) => void;
}

function SiteRow({ site, lang, admin, reorderable, canMoveUp, canMoveDown, onEdit, onDelete, onMove }: RowProps) {
  const name = lang === 'zh' ? site.name_zh || site.name : site.name_en || site.name;
  const desc = lang === 'zh' ? site.desc_zh || site.desc_en : site.desc_en || site.desc_zh;
  const dead = site.status === 'dead';
  const wcaAuthor = site.author ? WCA_AUTHOR_BY_CREDIT[site.author] : undefined;
  const hasExternalLinks = Boolean(site.youtube || site.github);
  const hasMultipleExternalLinks = Boolean(site.youtube && site.github);

  return (
    <div className={`site-row${dead ? ' is-dead' : ''}${admin ? ' is-admin' : ''}${hasExternalLinks ? ' has-external-links' : ''}${hasMultipleExternalLinks ? ' has-multiple-external-links' : ''}`}>
      <div className="site-row-main">
        <a
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          className="site-row-primary-link"
          aria-label={name}
        />
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
          {wcaAuthor ? (
            <PersonLink wcaId={wcaAuthor[0]} name={wcaAuthor[1]} isZh={lang === 'zh'} />
          ) : site.author || ''}
        </div>
        <div className="site-row-desc" title={desc || ''}>{desc || ''}</div>
      </div>

      {hasExternalLinks && (
        <div className="site-row-external-links">
          {site.youtube && (
            // allow-nested-link: sibling of the row overlay anchor
            <a href={site.youtube} target="_blank" rel="noopener noreferrer" className="site-row-external-link" title="YouTube" aria-label="YouTube">
              <YouTubeBadge />
            </a>
          )}
          {site.github && (
            // allow-nested-link: sibling of the row overlay anchor
            <a href={site.github} target="_blank" rel="noopener noreferrer" className="site-row-external-link" title="GitHub" aria-label="GitHub">
              <span className="site-row-github-label">GitHub</span>
            </a>
          )}
        </div>
      )}

      {admin && (
        <div className="site-row-admin">
          {reorderable && (
            <>
              <button className="site-admin-btn" disabled={!canMoveUp} title="up" onClick={() => onMove(site, -1)}><ArrowUp size={14} /></button>
              <button className="site-admin-btn" disabled={!canMoveDown} title="down" onClick={() => onMove(site, 1)}><ArrowDown size={14} /></button>
            </>
          )}
          <button className="site-admin-btn" title="edit" onClick={() => onEdit(site)}><Pencil size={14} /></button>
          <button className="site-admin-btn site-admin-del" title="delete" onClick={() => onDelete(site)}><Trash2 size={14} /></button>
        </div>
      )}

      {site.alt_urls && site.alt_urls.length > 0 && (
        <div className="site-row-alts">
          <span className="site-row-alts-label">{TEXTS.altLink[lang]}:</span>
          {site.alt_urls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="site-row-alt">{linkLabel(u)}</a>
          ))}
        </div>
      )}
    </div>
  );
}

function SitesPageInner() {
  const { i18n } = useTranslation();
  const lang: 'en' | 'zh' = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  // admin comes from the client-only auth store; gate on mount so SSR and the
  // first client render agree (both non-admin) and don't trip a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const admin = mounted && isAdmin();

  const [params, setQuery] = useQueryStates(
    {
      q: parseAsString,
      topic: parseAsArrayOf(parseAsString).withDefault([]),
      events: parseAsArrayOf(parseAsString).withDefault([]),
      sets: parseAsArrayOf(parseAsString).withDefault([]),
      methods: parseAsArrayOf(parseAsString).withDefault([]),
    },
    { history: 'replace', scroll: false },
  );
  const query = params.q || '';
  const selectedTopics = useMemo(() => {
    const seen = new Set<string>();
    return params.topic
      .map((label) => label.trim())
      .filter(Boolean)
      .filter((label) => !algSetForTag(label) && !methodForTag(label))
      .filter((label) => {
        const key = topicKey(label, lang);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [params.topic, lang]);
  const selectedTopicKeys = useMemo(
    () => new Set(selectedTopics.map((label) => topicKey(label, lang))),
    [selectedTopics, lang],
  );
  const requestedAlgSetIds = useMemo(() => {
    const legacyIds = params.topic.map((label) => algSetForTag(label)?.id).filter((id): id is string => Boolean(id));
    return [...new Set([...params.sets.map(normalizeFilterValue), ...legacyIds])]
      .filter((id) => SITE_ALG_SET_BY_ID.has(id));
  }, [params.sets, params.topic]);
  const requestedMethodIds = useMemo(() => {
    const legacyIds = params.topic.map((label) => methodForTag(label)?.id).filter((id): id is string => Boolean(id));
    return [...new Set([...params.methods.map(normalizeFilterValue), ...legacyIds])]
      .filter((id) => SITE_METHOD_OPTIONS.some((option) => option.id === id));
  }, [params.methods, params.topic]);
  const selectedEventIds = useMemo(
    () => params.events.filter((id) => SITE_PROJECTS.has(id)),
    [params.events],
  );
  const selectedEvents = useMemo(() => new Set(selectedEventIds), [selectedEventIds]);

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

  const algSetOptions = useMemo(() => {
    const present = new Set<string>();
    for (const site of sites ?? []) {
      for (const rawTag of site.tags ?? []) {
        const option = algSetForTag(rawTag);
        if (option) present.add(option.id);
      }
    }
    return SITE_ALG_SET_OPTIONS.filter((option) => present.has(option.id));
  }, [sites]);
  const methodOptions = useMemo(() => {
    const present = new Set<string>();
    for (const site of sites ?? []) {
      for (const rawTag of site.tags ?? []) {
        const option = methodForTag(rawTag);
        if (option) present.add(option.id);
      }
    }
    return SITE_METHOD_OPTIONS.filter((option) => present.has(option.id));
  }, [sites]);
  const selectedAlgSetIds = useMemo(() => {
    const available = new Set(algSetOptions.map((option) => option.id));
    return requestedAlgSetIds.filter((id) => available.has(id));
  }, [algSetOptions, requestedAlgSetIds]);
  const selectedAlgSets = useMemo(() => new Set(selectedAlgSetIds), [selectedAlgSetIds]);
  const selectedMethodIds = useMemo(() => {
    const available = new Set(methodOptions.map((option) => option.id));
    return requestedMethodIds.filter((id) => available.has(id));
  }, [methodOptions, requestedMethodIds]);
  const selectedMethods = useMemo(() => new Set(selectedMethodIds), [selectedMethodIds]);

  const topics = useMemo(() => {
    const byLabel = new Map<string, { label: string; count: number; firstSeen: number }>();
    let firstSeen = 0;
    for (const site of sites ?? []) {
      const seenForSite = new Set<string>();
      for (const rawTag of site.tags ?? []) {
        if (PROJECT_TOPIC_TAGS.has(rawTag.trim().toLowerCase())) continue;
        if (algSetForTag(rawTag) || methodForTag(rawTag)) continue;
        const label = splitLangTag(rawTag)[lang].trim();
        if (!label) continue;
        const key = label.toLocaleLowerCase(lang === 'zh' ? 'zh-Hans' : 'en');
        if (seenForSite.has(key)) continue;
        seenForSite.add(key);
        const existing = byLabel.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          byLabel.set(key, { label, count: 1, firstSeen });
          firstSeen += 1;
        }
      }
    }
    return [...byLabel.values()].sort((a, b) => b.count - a.count || a.firstSeen - b.firstSeen);
  }, [sites, lang]);

  const toggleTopic = useCallback((label: string) => {
    const key = topicKey(label, lang);
    const next = selectedTopicKeys.has(key)
      ? selectedTopics.filter((topic) => topicKey(topic, lang) !== key)
      : [...selectedTopics, label];
    void setQuery({
      topic: next.length > 0 ? next : null,
      sets: selectedAlgSetIds.length > 0 ? selectedAlgSetIds : null,
      methods: selectedMethodIds.length > 0 ? selectedMethodIds : null,
    });
  }, [selectedTopics, selectedTopicKeys, selectedAlgSetIds, selectedMethodIds, lang, setQuery]);

  const eventPickerGroups = useMemo<readonly PuzzlePickerGroup[]>(() => [
    {
      id: 'wca',
      label: TEXTS.wcaProjects[lang],
      items: ACTIVE_WCA_EVENT_IDS.map((id) => ({
        id,
        label: eventDisplayName(id, lang === 'zh'),
        iconClass: `event-${id}`,
      })),
    },
    {
      id: 'non-wca',
      label: TEXTS.otherProjects[lang],
      items: [{ id: 'fto', label: 'FTO', iconClass: 'unofficial-fto' }],
    },
  ], [lang]);

  const algSetPickerGroups = useMemo<readonly PuzzlePickerGroup[]>(() => [{
    id: 'alg-sets',
    label: TEXTS.algSets[lang],
    items: algSetOptions.map((option) => ({ id: option.id, label: option.label[lang] })),
  }], [algSetOptions, lang]);

  const methodPickerGroups = useMemo<readonly PuzzlePickerGroup[]>(() => [{
    id: 'methods',
    label: TEXTS.methods[lang],
    items: methodOptions.map((option) => ({ id: option.id, label: option.label[lang] })),
  }], [methodOptions, lang]);

  const toggleAlgSet = useCallback((id: string) => {
    if (!algSetOptions.some((option) => option.id === id)) return;
    const next = new Set(selectedAlgSets);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const ordered = algSetOptions.map((option) => option.id).filter((optionId) => next.has(optionId));
    void setQuery({
      sets: ordered.length > 0 ? ordered : null,
      methods: selectedMethodIds.length > 0 ? selectedMethodIds : null,
      topic: selectedTopics.length > 0 ? selectedTopics : null,
    });
  }, [algSetOptions, selectedAlgSets, selectedMethodIds, selectedTopics, setQuery]);

  const toggleMethod = useCallback((id: string) => {
    if (!methodOptions.some((option) => option.id === id)) return;
    const next = new Set(selectedMethods);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const ordered = methodOptions.map((option) => option.id).filter((optionId) => next.has(optionId));
    void setQuery({
      methods: ordered.length > 0 ? ordered : null,
      sets: selectedAlgSetIds.length > 0 ? selectedAlgSetIds : null,
      topic: selectedTopics.length > 0 ? selectedTopics : null,
    });
  }, [methodOptions, selectedMethods, selectedAlgSetIds, selectedTopics, setQuery]);

  const toggleEvent = useCallback((eventId: string) => {
    if (!SITE_PROJECTS.has(eventId)) return;
    const next = new Set(selectedEvents);
    if (next.has(eventId)) next.delete(eventId);
    else next.add(eventId);
    void setQuery({ events: SITE_PROJECT_IDS.filter((id) => next.has(id)) });
  }, [selectedEvents, setQuery]);

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
          { name: 'github', weight: 0.05 },
        ],
        threshold: 0.35,
        minMatchCharLength: 2,
        ignoreLocation: true,
      }),
    [sites],
  );

  const filtered = useMemo(() => {
    if (!sites) return [];
    const locale = lang === 'zh' ? 'zh-Hans' : 'en';
    const topicCandidates = selectedTopicKeys.size > 0
      ? sites.filter((site) => (site.tags ?? []).some((rawTag) => (
        selectedTopicKeys.has(splitLangTag(rawTag)[lang].trim().toLocaleLowerCase(locale))
      )))
      : sites;
    const algSetCandidates = selectedAlgSetIds.length > 0
      ? topicCandidates.filter((site) => (site.tags ?? []).some((rawTag) => {
        const option = algSetForTag(rawTag);
        return option ? selectedAlgSets.has(option.id) : false;
      }))
      : topicCandidates;
    const methodCandidates = selectedMethodIds.length > 0
      ? algSetCandidates.filter((site) => (site.tags ?? []).some((rawTag) => {
        const option = methodForTag(rawTag);
        return option ? selectedMethods.has(option.id) : false;
      }))
      : algSetCandidates;
    const candidates = selectedEventIds.length > 0
      ? methodCandidates.filter((site) => selectedEventIds.some((eventId) => siteMatchesEvent(site, eventId)))
      : methodCandidates;
    const q = query.trim();
    if (!q) return candidates;
    // 先只认精确子串(不区分大小写),按命中字段分层排序 —— 搜 "MCC" 就该给含 MCC 的,
    // 而不是被 Fuse 判成「像 FMC」的一大片噪音(3 字母缩写编辑距离 2 就命中)。
    // 精确匹配独立于 Fuse 算,不受 threshold 影响,不会漏。
    const lower = q.toLowerCase();
    const exact = candidates
      .map((site, i) => ({ site, i, tier: matchTier(site, lower) }))
      .filter((r) => r.tier < 3)
      .sort((a, b) => a.tier - b.tier || a.i - b.i)
      .map((r) => r.site);
    if (exact.length) return exact;
    // 一条精确的都没有(拼错 / 记岔了)才降级到 Fuse 模糊,保住容错。
    const candidateIds = new Set(candidates.map((site) => site.id));
    return fuse.search(q).map((r) => r.item).filter((site) => candidateIds.has(site.id));
  }, [
    sites, query, selectedTopicKeys, selectedAlgSetIds, selectedAlgSets,
    selectedMethodIds, selectedMethods, selectedEventIds, lang, fuse,
  ]);

  const selectedEventNames = selectedEventIds.map((id) => eventDisplayName(id, lang === 'zh'));
  const filterLabels = [
    selectedEventNames.length > 0 ? `${TEXTS.projects[lang]}: ${selectedEventNames.join(', ')}` : '',
    query.trim() ? `${TEXTS.resultsFor[lang]} "${query.trim()}"` : '',
  ].filter(Boolean);
  const headerLabel = filterLabels.join(' / ');

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
      <main className="sites-main">
        <header className="sites-page-header">
          <BackHome className="sites-back" />
          <h1 className="sites-title">{TEXTS.title[lang]}</h1>
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
            {inputValue && (
              <ClearButton
                onClick={() => {
                  setInputValue('');
                  void setQuery({ q: null });
                }}
                preserveFocus
              />
            )}
          </div>
        </header>

        {sites && (
          <div className="sites-filter-row">
            <div className="sites-filter-control" aria-label={TEXTS.projects[lang]}>
              <PuzzlePicker
                isZh={lang === 'zh'}
                groups={eventPickerGroups}
                selectedEvents={selectedEvents}
                onToggle={toggleEvent}
              />
              {selectedEventIds.length > 0 && (
                <ClearButton
                  variant="standalone"
                  ariaLabel={TEXTS.clearProjects[lang]}
                  onClick={() => void setQuery({ events: [] })}
                />
              )}
            </div>
            {algSetOptions.length > 0 && (
              <div className="sites-filter-control" aria-label={TEXTS.algSets[lang]}>
                <PuzzlePicker
                  isZh={lang === 'zh'}
                  groups={algSetPickerGroups}
                  placeholderLabel={TEXTS.algSets[lang]}
                  triggerIcon={<Sigma size={15} className="pp-trigger-icon" />}
                  showItemIcons={false}
                  selectedEvents={selectedAlgSets}
                  onToggle={toggleAlgSet}
                />
                {selectedAlgSetIds.length > 0 && (
                  <ClearButton
                    variant="standalone"
                    ariaLabel={TEXTS.clearAlgSets[lang]}
                    onClick={() => void setQuery({
                      sets: null,
                      methods: selectedMethodIds.length > 0 ? selectedMethodIds : null,
                      topic: selectedTopics.length > 0 ? selectedTopics : null,
                    })}
                  />
                )}
              </div>
            )}
            {methodOptions.length > 0 && (
              <div className="sites-filter-control" aria-label={TEXTS.methods[lang]}>
                <PuzzlePicker
                  isZh={lang === 'zh'}
                  groups={methodPickerGroups}
                  placeholderLabel={TEXTS.methods[lang]}
                  triggerIcon={<Route size={15} className="pp-trigger-icon" />}
                  showItemIcons={false}
                  selectedEvents={selectedMethods}
                  onToggle={toggleMethod}
                />
                {selectedMethodIds.length > 0 && (
                  <ClearButton
                    variant="standalone"
                    ariaLabel={TEXTS.clearMethods[lang]}
                    onClick={() => void setQuery({
                      methods: null,
                      sets: selectedAlgSetIds.length > 0 ? selectedAlgSetIds : null,
                      topic: selectedTopics.length > 0 ? selectedTopics : null,
                    })}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {sites && topics.length > 0 && (
          <section className="sites-topics" aria-labelledby="sites-topics-title">
            <h2 id="sites-topics-title">{TEXTS.topics[lang]}</h2>
            <div className="sites-topic-list">
              {topics.map((topic) => {
                const active = selectedTopicKeys.has(topicKey(topic.label, lang));
                return (
                  <button
                    key={topic.label}
                    type="button"
                    className={`sites-topic${active ? ' is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => toggleTopic(topic.label)}
                  >
                    {topic.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <header className="sites-main-header">
          {headerLabel && <h2>{headerLabel}</h2>}
          <span className="sites-main-count">
            {filtered.length} {TEXTS.sites[lang]}
          </span>
          {admin && (
            <button
              className="sites-add-btn"
              onClick={() => setCreating(true)}
              aria-label={TEXTS.add[lang]}
            >
              <Plus size={14} />
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
                admin={admin}
                reorderable={
                  !query.trim()
                  && selectedTopics.length === 0
                  && selectedEventIds.length === 0
                  && selectedAlgSetIds.length === 0
                  && selectedMethodIds.length === 0
                }
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
          defaultGroup={DEFAULT_GROUP}
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
