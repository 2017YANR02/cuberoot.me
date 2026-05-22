// 全站搜索匹配 — 落地页 LandingSearch 和 /wca WcaStatsIndex 共用这一份逻辑
// 两个入口的 "搜出来的东西" 必须保持一致;UI 壳不同(下拉浮层 vs 内联页),数据层在这里统一。
//
// 数据源(全部自动派生,内容更新无需改本文件):
// - cards / tools / lookups — 调用方传入(对应 LandingPage SECTIONS / TOOL_ITEMS / LOOKUP_ITEMS)
// - stats / metrics — /stats/index.json (compute_index.ts 自动生成)
// - persons — /stats/persons_search.json.gz (stats-build 周更)
// - comps — utils/comp_search 已有
// - recons — /v1/recon/list + localStorage 缓存
// - glossary — pages/wiki/glossary.json (bundled,内容更新即跟着)
// - aboutEntries — pages/wca_about/registry (各 entries/*.ts 自动聚合)
// - stackTools — pages/code/stack_meta (auto-generated)
// - algSets — /v1/alg/sets (DB-backed)
import { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import { loadPersonsIndex, searchLocalPersons, type WcaPerson, type ReconSolve } from '@cuberoot/shared';
import { loadComps, searchComps, type Comp } from './comp_search';
import { listRecons } from './recon_api';
import { loadCachedSolves, saveCachedSolves } from './recon_cache';
import { compNameZh, loadFlagData } from './country_flags';
import { API_ORIGIN } from './api_base';
import { ABOUT_REGISTRY } from '../pages/wca_about/registry';
import { STACK_TOOLS_META, type StackToolMeta } from '../pages/code/stack_meta';
import GLOSSARY_DATA from '../pages/wiki/glossary.json';

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

// 命中条目类型 — 渲染层各自构造卡片。
export interface ReconHit {
  id: number;
  person: string;       // 已 strip 括号
  personIso2: string;
  valueStr: string;     // 显示用 — average 优先,否则 single
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

// NOTE: Ao3 在 WcaStatsPage UI 上显示成 Mo3,搜索也按这名字匹配。
export const METRIC_LABEL_OVERRIDE: Record<string, string> = { 'Ao3': 'Mo3' };

// NOTE: 工具类直达路由 — 不属于 landing 卡片也不在 stats index 里。
// 落地页和 /wca 都搜得到这些。
export const TOOL_ITEMS: ToolItem[] = [
  { path: '/wca/comp',       zh: '比赛',   en: 'Comp' },
  { path: '/wca/calendar',   zh: '日历',   en: 'Calendar' },
  { path: '/wca/globe',      zh: '地球',   en: 'Globe' },
  { path: '/wca/viz',        zh: '分布',   en: 'Distribution' },
  { path: '/wca/prediction', zh: '预测',   en: 'Prediction' },
  { path: '/nemesizer',      zh: '宿敌',   en: 'Nemesizer' },
  { path: '/calc',           zh: '计算器', en: 'Calculator' },
];

// NOTE: lookup 类查询入口(动态参数路由)。/wca/sum-of-ranks 含两个常用的变体 query。
export const LOOKUP_ITEMS: LookupItem[] = [
  { path: '/wca/grand-slam',       zh: '大满贯',       en: 'Grand Slam' },
  { path: '/wca/all-results',      zh: '全部成绩排名', en: 'All Results' },
  { path: '/wca/cohort-ranks',     zh: '参赛届别排名', en: 'Cohort Ranks' },
  { path: '/wca/success-rate',     zh: '项目成功率',   en: 'Success Rate' },
  { path: '/wca/all-events-done',  zh: '全项目达成',   en: 'All Events Done' },
  { path: '/wca/sum-of-ranks',     zh: '全项目排名',   en: 'Sum of Ranks' },
  { path: '/wca/sum-of-ranks', extraQuery: 'hidePodium=1', zh: '全能但无牌', en: 'All-Around · No Podium' },
  { path: '/wca/sum-of-ranks', extraQuery: 'bestMisser=4', zh: '殿军之王',   en: 'Fourth-Place King' },
];

const MIN_LEN_LATIN = 2;
const hasNonLatin = (s: string) => /[^\x00-\x7F]/.test(s);

// NOTE: 选手 / 比赛匹配上限。Infinity 时一个单字符 query 能匹到数万条,React 一次 commit
// 几万节点会冻死主线程。500 足够覆盖任何合理 query 的可视化需求,渲染时再分页(下面 CAP)。
const MATCH_HARD_CAP = 500;
// recon / alg-sets / glossary / about / stack 比 person/comp 体量小,共享同一上限即可。

// NOTE: 渲染分页大小。匹配 > 此值时只先渲染前 N 条,给用户一个 "+ N 更多" 按钮。
// 50 个 grid item 在桌面端 100ms 内能完成 layout + paint。
export const INITIAL_RENDER_CAP = 50;

// ── 多 token AND 匹配 ─────────────────────────────────────────────────────
// 用户输入 "3.84 耿暄一" / "耿暄一 3.84" / "耿暄一3.84"(无空格) 都应命中。
// 拆 token 规则:空格拆 + 中英/数字边界自动拆(latin/digit ↔ non-ASCII)。
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

// ── 静态索引(glossary / about / stack) — 模块加载即可立刻搜索 ───────────

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

// ── 动态索引(recon / algSets) — 模块级单 Promise ──────────────────────

interface ReconRecord { hit: ReconHit; hay: string }

function reconValueStr(r: ReconSolve): string {
  // 优先用 average(用户搜 "3.84 wr平均" 期望命中 avg);否则 single value。
  if (typeof r.average === 'number' && r.average > 0) return r.average.toFixed(2);
  return r.value ?? (typeof r.rawTime === 'number' ? r.rawTime.toFixed(2) : '');
}

function buildReconRecord(r: ReconSolve): ReconRecord {
  const valueStr = reconValueStr(r);
  // 选手名保留原始字符串("Xuanyi Geng (耿暄一)"),由 displayCuberName 按 lang 提取中/英。
  const personRaw = r.person ?? '';
  const recordTag = r.regionalAverageRecord || r.regionalSingleRecord || r.regionalAoxrRecord || '';
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
    personRaw, r.personId ?? '', valueStr, r.value ?? '',
    r.event, r.comp ?? '', r.compWcaId ?? '',
    compNameZh(r.comp ?? ''),
    r.note ?? '', r.caption ?? '',
    r.reconer ?? '', r.reconerId ?? '',
    r.aoType ?? '', recordTag, r.method ?? '',
    r.date ?? '',
  ].join('\n').toLowerCase();
  return { hit, hay };
}

let reconRecordsPromise: Promise<ReconRecord[] | null> | null = null;
function loadReconRecords(): Promise<ReconRecord[] | null> {
  if (reconRecordsPromise) return reconRecordsPromise;
  reconRecordsPromise = (async () => {
    // NOTE: 等 comp_names_zh 加载完再 build hay,否则搜中文比赛名(如"北京")只能匹到 r.comp 含括号中文的一条
    await loadFlagData().catch(() => 0);
    const cached = loadCachedSolves();
    if (cached) {
      // 后台刷新缓存,但不阻塞首次搜索。
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

// ── stats index 缓存 ─────────────────────────────────────────────────────
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
  statIndexLoaded: boolean;
}

// NOTE: 索引预拉策略 — eager 走 requestIdleCallback,在空闲时段就把 persons/comps 拉到内存;
// lazy 等用户敲到 xSearchEnabled 才开始拉。LandingSearch 用 eager(首屏 hero 区显眼,
// 用户大概率要搜),WcaStatsIndex 用 lazy(进 /wca 不一定搜索)。
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

  // NOTE: useDeferredValue 把"匹配 + 渲染"标成低优先级,输入框打字始终顺滑。
  const deferredRawQuery = useDeferredValue(query);
  const q = deferredRawQuery.trim().toLowerCase();
  const qRaw = deferredRawQuery.trim();
  const xSearchEnabled = qRaw.length >= (hasNonLatin(qRaw) ? 1 : MIN_LEN_LATIN);
  const tokens = useMemo(() => tokenize(q), [q]);

  // 索引预拉 — eager 用 requestIdleCallback(首屏不阻 LCP);lazy 等 xSearchEnabled 触发。
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
    // lazy: 立即拉
    kick();
    return () => { cancelled = true; };
  }, [prefetch, xSearchEnabled, xLoaded]);

  // debounced 跨库搜索 — 输入停 200ms 后跑;索引加载完后也会重跑一次。
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

      // recon — 多 token AND
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

      // algSets — 多 token AND
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
    statIndexLoaded: statIndex !== null,
  };
}
