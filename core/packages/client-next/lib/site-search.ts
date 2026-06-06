'use client';

// 全站搜索匹配 — 落地页 LandingSearch 共用。
// Ported from packages/client/src/utils/site_search.ts (1:1 data layer,
// 调整路径到 client-next 别名 + 不依赖 react-router)。
import { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import { loadPersonsIndex, searchLocalPersons, type WcaPerson, type ReconSolve } from '@cuberoot/shared';
import { loadComps, searchComps, type Comp } from '@/lib/comp-search';
import { listRecons } from '@/lib/recon-api';
import { loadCachedSolves, saveCachedSolves } from '@/lib/recon-cache';
import { compNameZh, loadFlagData } from '@/lib/country-flags';
import { formatTime, formatAvg, expandContinentRecord } from '@/lib/recon-utils';
import { API_ORIGIN } from '@/lib/api-base';
import { ABOUT_REGISTRY } from '@/app/[lang]/wca/about/[id]/_lib/registry';
import { STACK_TOOLS_META, type StackToolMeta } from '@/app/[lang]/code/stack/_lib/stack_meta';
import GLOSSARY_DATA from '@/app/[lang]/wiki/glossary.json';

export interface SiteSearchCard {
  id: string;
  href: string;
  internal: boolean;
  nameEn: string;
  nameZh: string;
  sectionTitleEn: string;
  sectionTitleZh: string;
}

export interface ToolItem { path: string; zh: string; en: string }
export interface LookupItem { path: string; extraQuery?: string; zh: string; en: string }

export interface MetricEntry { id: string; labelEn: string; labelZh: string }
export interface StatEntry { id: string; titleEn: string; titleZh: string; metrics?: MetricEntry[] }
export interface StatCategory { nameEn: string; nameZh: string; iconName?: string; stats: StatEntry[] }
export interface StatIndex { categories: StatCategory[] }

export type StatItem =
  | { kind: 'stat'; stat: StatEntry }
  | { kind: 'metric'; parent: StatEntry; metric: MetricEntry };

export interface ReconHit {
  id: number;
  person: string;
  personIso2: string;
  valueStr: string;
  event: string;
  comp?: string;
  date?: string;
  aoType?: string;
  recordTag?: string;
}
export interface GlossaryHit { head: string; body: string; slug: string }
export interface AboutHit { id: string; titleZh: string; titleEn: string }
export interface StackHit extends StackToolMeta {}
export interface AlgSetHit { puzzle: string; setSlug: string }

export const METRIC_LABEL_OVERRIDE: Record<string, string> = { 'Ao3': 'Mo3' };

export const TOOL_ITEMS: ToolItem[] = [
  { path: '/wca/comp',       zh: '比赛',   en: 'Comp' },
  { path: '/wca/calendar',   zh: '日历',   en: 'Calendar' },
  { path: '/wca/globe',      zh: '地球',   en: 'Globe' },
  { path: '/wca/viz',        zh: '分布',   en: 'Distribution' },
  { path: '/wca/prediction', zh: '预测',   en: 'Prediction' },
  { path: '/nemesizer',      zh: '宿敌',   en: 'Nemesizer' },
  { path: '/calc',           zh: '计算器', en: 'Calculator' },
];

export const LOOKUP_ITEMS: LookupItem[] = [
  { path: '/wca/grand-slam',       zh: '大满贯',       en: 'Grand Slam' },
  { path: '/wca/all-results',      zh: '全部成绩排名', en: 'All Results' },
  { path: '/wca/cohort-ranks',     zh: '参赛届别排名', en: 'Cohort Ranks' },
  { path: '/wca/success-rate',     zh: '项目成功率',   en: 'Success Rate' },
  { path: '/wca/all-events-done',  zh: '全项目达成',   en: 'All Events Done' },
  { path: '/wca/sum-of-ranks',     zh: '全项目排名',   en: 'Sum of Ranks' },
  { path: '/wca/sum-of-ranks', extraQuery: 'hidePodium=1', zh: '全能但无牌', en: 'All-Around · No Podium' },
];

const MIN_LEN_LATIN = 2;
const hasNonLatin = (s: string) => /[^\x00-\x7F]/.test(s);

const MATCH_HARD_CAP = 500;
export const INITIAL_RENDER_CAP = 50;

function tokenize(q: string): string[] {
  const withBoundary = q
    .replace(/([^\x00-\x7F])([a-z0-9])/gi, '$1 $2')
    .replace(/([a-z0-9.])([^\x00-\x7F])/gi, '$1 $2');
  return withBoundary.split(/\s+/).map(t => t.trim()).filter(t => t.length > 0);
}
function allTokensIn(haystack: string, tokens: string[]): boolean {
  for (const t of tokens) if (!haystack.includes(t)) return false;
  return true;
}

interface GlossaryEntry { head: string; body: string }
interface GlossarySection { entries?: GlossaryEntry[] }
interface GlossaryRoot { sections?: GlossarySection[] }
function slugifyHead(head: string): string {
  return head.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
interface GlossaryRecord { head: string; body: string; slug: string; hay: string }
const GLOSSARY_ENTRIES: GlossaryRecord[] = ((): GlossaryRecord[] => {
  const root = GLOSSARY_DATA as unknown as GlossaryRoot;
  const out: GlossaryRecord[] = [];
  for (const sec of root.sections ?? []) {
    for (const e of sec.entries ?? []) {
      out.push({
        head: e.head,
        body: e.body,
        slug: slugifyHead(e.head),
        hay: `${e.head}\n${e.body}`.toLowerCase(),
      });
    }
  }
  return out;
})();

interface AboutRecord { id: string; titleZh: string; titleEn: string; hay: string }
const ABOUT_ENTRIES: AboutRecord[] = Object.values(ABOUT_REGISTRY).map(e => ({
  id: e.id,
  titleZh: e.titleZh,
  titleEn: e.titleEn,
  hay: `${e.id}\n${e.titleZh}\n${e.titleEn}\n${e.badgeZh ?? ''}\n${e.badgeEn ?? ''}`.toLowerCase(),
}));

interface StackRecord { meta: StackToolMeta; hay: string }
const STACK_ENTRIES: StackRecord[] = STACK_TOOLS_META.map(m => ({
  meta: m,
  hay: `${m.slug}\n${m.name}\n${m.zh.tagline}\n${m.zh.role}\n${m.en.tagline}\n${m.en.role}`.toLowerCase(),
}));

interface ReconRecord { hit: ReconHit; hay: string }

// 与详情页头部 (recon/[id]/page.tsx) 口径一致:展示单次 (value ?? rawTime),average 仅兜底
function reconValueStr(r: ReconSolve): string {
  if (r.value) return r.value;
  if (typeof r.rawTime === 'number') return formatTime(r.rawTime);
  if (typeof r.average === 'number' && r.average > 0) return r.average.toFixed(2);
  return '';
}

function buildReconRecord(r: ReconSolve): ReconRecord {
  const valueStr = reconValueStr(r);
  const avgStr = typeof r.average === 'number' && r.average > 0 ? formatAvg(r.average) : '';
  const personRaw = r.person ?? '';
  // 详情页头部徽章用单次记录;存原始值 (CR),由 RecordBadge 按 iso2 展开成 AsR/ER/…
  const recordTag = r.regionalSingleRecord || '';
  const recordExpanded = expandContinentRecord(r.regionalSingleRecord, r.personCountry) || '';
  const hit: ReconHit = {
    id: r.id,
    person: personRaw,
    personIso2: (r.personCountry ?? '').toLowerCase(),
    valueStr,
    event: r.event,
    comp: r.comp,
    date: r.date,
    aoType: r.aoType,
    recordTag,
  };
  const hay = [
    personRaw, r.personId ?? '', valueStr, r.value ?? '', avgStr,
    r.event, r.comp ?? '', r.compWcaId ?? '',
    compNameZh(r.comp ?? ''),
    r.note ?? '', r.caption ?? '',
    r.reconer ?? '', r.reconerId ?? '',
    r.aoType ?? '',
    r.regionalSingleRecord ?? '', r.regionalAverageRecord ?? '', r.regionalAoxrRecord ?? '',
    recordExpanded, r.method ?? '',
    r.date ?? '',
  ].join('\n').toLowerCase();
  return { hit, hay };
}

let reconRecordsPromise: Promise<ReconRecord[] | null> | null = null;
function loadReconRecords(): Promise<ReconRecord[] | null> {
  if (reconRecordsPromise) return reconRecordsPromise;
  reconRecordsPromise = (async () => {
    await loadFlagData().catch(() => 0);
    const cached = loadCachedSolves();
    if (cached) {
      listRecons().then(fresh => { saveCachedSolves(fresh); reconRecordsPromise = Promise.resolve(fresh.map(buildReconRecord)); }).catch(() => {});
      return cached.map(buildReconRecord);
    }
    try {
      const fresh = await listRecons();
      saveCachedSolves(fresh);
      return fresh.map(buildReconRecord);
    } catch {
      return null;
    }
  })();
  return reconRecordsPromise;
}

interface AlgSetRow { puzzle: string; setSlug: string }
interface AlgSetRecord { hit: AlgSetHit; hay: string }
let algSetsPromise: Promise<AlgSetRecord[] | null> | null = null;
function loadAlgSets(): Promise<AlgSetRecord[] | null> {
  if (algSetsPromise) return algSetsPromise;
  algSetsPromise = fetch(`${API_ORIGIN}/v1/alg/sets`)
    .then(r => (r.ok ? r.json() as Promise<AlgSetRow[]> : null))
    .then(rows => rows?.map(r => ({
      hit: { puzzle: r.puzzle, setSlug: r.setSlug },
      hay: `${r.puzzle}\n${r.setSlug}`.toLowerCase(),
    })) ?? null)
    .catch(() => null);
  return algSetsPromise;
}

let statIndexPromise: Promise<StatIndex | null> | null = null;
function loadStatIndex(): Promise<StatIndex | null> {
  if (!statIndexPromise) {
    statIndexPromise = fetch('/stats/index.json')
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return statIndexPromise;
}

export interface UseSiteSearchOptions {
  cards?: SiteSearchCard[];
  tools?: ToolItem[];
  lookups?: LookupItem[];
}

export interface SiteSearchResult {
  q: string;
  qRaw: string;
  xSearchEnabled: boolean;
  xLoaded: boolean;
  cardMatches: SiteSearchCard[];
  toolMatches: ToolItem[];
  lookupMatches: LookupItem[];
  statMatches: { cat: StatCategory; items: StatItem[] }[];
  personMatches: WcaPerson[];
  compMatches: Comp[];
  reconMatches: ReconHit[];
  glossaryMatches: GlossaryHit[];
  aboutMatches: AboutHit[];
  stackMatches: StackHit[];
  algSetMatches: AlgSetHit[];
  totalCount: number;
  yearMatch: string | null;
  statIndexLoaded: boolean;
}

export function useSiteSearch(
  query: string,
  prefetch: 'eager' | 'lazy',
  options?: UseSiteSearchOptions,
): SiteSearchResult {
  const cards = options?.cards ?? [];
  const tools = options?.tools ?? TOOL_ITEMS;
  const lookups = options?.lookups ?? LOOKUP_ITEMS;

  const [statIndex, setStatIndex] = useState<StatIndex | null>(null);
  const [personMatches, setPersonMatches] = useState<WcaPerson[]>([]);
  const [compMatches, setCompMatches] = useState<Comp[]>([]);
  const [reconMatches, setReconMatches] = useState<ReconHit[]>([]);
  const [algSetMatches, setAlgSetMatches] = useState<AlgSetHit[]>([]);
  const compsRef = useRef<Comp[] | null>(null);
  const reconsRef = useRef<ReconRecord[] | null>(null);
  const algSetsRef = useRef<AlgSetRecord[] | null>(null);
  const [xLoaded, setXLoaded] = useState(false);

  useEffect(() => {
    loadStatIndex().then(j => { if (j) setStatIndex(j); });
  }, []);

  const deferredRawQuery = useDeferredValue(query);
  const q = deferredRawQuery.trim().toLowerCase();
  const qRaw = deferredRawQuery.trim();
  const xSearchEnabled = qRaw.length >= (hasNonLatin(qRaw) ? 1 : MIN_LEN_LATIN);
  const tokens = useMemo(() => tokenize(q), [q]);

  useEffect(() => {
    if (xLoaded) return;
    if (prefetch === 'lazy' && !xSearchEnabled) return;

    let cancelled = false;
    const kick = () => {
      if (cancelled) return;
      Promise.all([
        loadPersonsIndex().catch(() => null),
        loadComps().then(arr => { compsRef.current = arr; }).catch(() => null),
        loadReconRecords().then(arr => { reconsRef.current = arr; }).catch(() => null),
        loadAlgSets().then(arr => { algSetsRef.current = arr; }).catch(() => null),
      ]).then(() => { if (!cancelled) setXLoaded(true); });
    };

    if (prefetch === 'eager') {
      type RIC = (cb: () => void, opts?: { timeout?: number }) => number;
      type CIC = (id: number) => void;
      const w = window as Window & { requestIdleCallback?: RIC; cancelIdleCallback?: CIC };
      if (w.requestIdleCallback) {
        const id = w.requestIdleCallback(kick, { timeout: 2000 });
        return () => { cancelled = true; w.cancelIdleCallback?.(id); };
      }
      const id = setTimeout(kick, 200);
      return () => { cancelled = true; clearTimeout(id); };
    }
    kick();
    return () => { cancelled = true; };
  }, [prefetch, xSearchEnabled, xLoaded]);

  useEffect(() => {
    if (!xSearchEnabled) {
      setPersonMatches([]);
      setCompMatches([]);
      setReconMatches([]);
      setAlgSetMatches([]);
      return;
    }
    const h = setTimeout(() => {
      setPersonMatches(searchLocalPersons(qRaw, MATCH_HARD_CAP) ?? []);
      setCompMatches(compsRef.current ? searchComps(qRaw, compsRef.current, MATCH_HARD_CAP) : []);

      if (reconsRef.current && tokens.length > 0) {
        const hits: ReconHit[] = [];
        for (const rec of reconsRef.current) {
          if (allTokensIn(rec.hay, tokens)) {
            hits.push(rec.hit);
            if (hits.length >= MATCH_HARD_CAP) break;
          }
        }
        setReconMatches(hits);
      } else {
        setReconMatches([]);
      }

      if (algSetsRef.current && tokens.length > 0) {
        const hits: AlgSetHit[] = [];
        for (const rec of algSetsRef.current) {
          if (allTokensIn(rec.hay, tokens)) hits.push(rec.hit);
          if (hits.length >= MATCH_HARD_CAP) break;
        }
        setAlgSetMatches(hits);
      } else {
        setAlgSetMatches([]);
      }
    }, 200);
    return () => clearTimeout(h);
  }, [qRaw, tokens, xSearchEnabled, xLoaded]);

  const cardMatches = useMemo(() => {
    if (q === '' || tokens.length === 0) return [];
    return cards.filter(c => {
      const hay = `${c.nameEn}\n${c.nameZh}\n${c.sectionTitleEn}\n${c.sectionTitleZh}`.toLowerCase();
      return allTokensIn(hay, tokens);
    });
  }, [cards, q, tokens]);

  const toolMatches = useMemo(() => {
    if (q === '' || tokens.length === 0) return [];
    return tools.filter(t => allTokensIn(`${t.zh}\n${t.en}`.toLowerCase(), tokens));
  }, [tools, q, tokens]);

  const lookupMatches = useMemo(() => {
    if (q === '' || tokens.length === 0) return [];
    return lookups.filter(it => allTokensIn(`${it.zh}\n${it.en}`.toLowerCase(), tokens));
  }, [lookups, q, tokens]);

  const statMatches = useMemo(() => {
    if (!statIndex || q === '' || tokens.length === 0) return [] as { cat: StatCategory; items: StatItem[] }[];
    return statIndex.categories
      .map(cat => {
        const items: StatItem[] = [];
        for (const stat of cat.stats) {
          if (allTokensIn(`${stat.titleEn}\n${stat.titleZh}`.toLowerCase(), tokens)) {
            items.push({ kind: 'stat', stat });
          }
          if (stat.metrics) {
            for (const m of stat.metrics) {
              const override = METRIC_LABEL_OVERRIDE[m.labelEn] ?? '';
              const hay = `${m.labelEn}\n${m.labelZh}\n${override}\n${stat.titleEn}\n${stat.titleZh}`.toLowerCase();
              if (allTokensIn(hay, tokens)) items.push({ kind: 'metric', parent: stat, metric: m });
            }
          }
        }
        return { cat, items };
      })
      .filter(g => g.items.length > 0);
  }, [statIndex, q, tokens]);

  const glossaryMatches = useMemo(() => {
    if (q === '' || tokens.length === 0) return [] as GlossaryHit[];
    const out: GlossaryHit[] = [];
    for (const e of GLOSSARY_ENTRIES) {
      if (allTokensIn(e.hay, tokens)) {
        out.push({ head: e.head, body: e.body, slug: e.slug });
        if (out.length >= MATCH_HARD_CAP) break;
      }
    }
    return out;
  }, [q, tokens]);

  const aboutMatches = useMemo(() => {
    if (q === '' || tokens.length === 0) return [] as AboutHit[];
    const out: AboutHit[] = [];
    for (const e of ABOUT_ENTRIES) {
      if (allTokensIn(e.hay, tokens)) {
        out.push({ id: e.id, titleZh: e.titleZh, titleEn: e.titleEn });
        if (out.length >= MATCH_HARD_CAP) break;
      }
    }
    return out;
  }, [q, tokens]);

  const stackMatches = useMemo(() => {
    if (q === '' || tokens.length === 0) return [] as StackHit[];
    const out: StackHit[] = [];
    for (const e of STACK_ENTRIES) {
      if (allTokensIn(e.hay, tokens)) {
        out.push(e.meta);
        if (out.length >= MATCH_HARD_CAP) break;
      }
    }
    return out;
  }, [q, tokens]);

  // 纯 4 位年份(1982~2099)→ 让调用方置顶「该年比赛日历」直达,并把选手沉底
  const yearMatch = useMemo(() => {
    if (!/^(19|20)\d{2}$/.test(q)) return null;
    const y = Number(q);
    return y >= 1982 && y <= 2099 ? q : null;
  }, [q]);

  const totalCount =
    cardMatches.length +
    toolMatches.length +
    lookupMatches.length +
    statMatches.reduce((s, g) => s + g.items.length, 0) +
    personMatches.length +
    compMatches.length +
    reconMatches.length +
    glossaryMatches.length +
    aboutMatches.length +
    stackMatches.length +
    algSetMatches.length;

  return {
    q, qRaw, xSearchEnabled, xLoaded,
    cardMatches, toolMatches, lookupMatches, statMatches,
    personMatches, compMatches,
    reconMatches, glossaryMatches, aboutMatches, stackMatches, algSetMatches,
    totalCount,
    yearMatch,
    statIndexLoaded: statIndex !== null,
  };
}
