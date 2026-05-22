// 全站搜索匹配 — 落地页 LandingSearch 和 /wca WcaStatsIndex 共用这一份逻辑
// 两个入口的 "搜出来的东西" 必须保持一致;UI 壳不同(下拉浮层 vs 内联页),数据层在这里统一。
import { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import { loadPersonsIndex, searchLocalPersons, type WcaPerson } from '@cuberoot/shared';
import { loadComps, searchComps, type Comp } from './comp_search';

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

// NOTE: 渲染分页大小。匹配 > 此值时只先渲染前 N 条,给用户一个 "+ N 更多" 按钮。
// 50 个 grid item 在桌面端 100ms 内能完成 layout + paint。
export const INITIAL_RENDER_CAP = 50;

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
  totalCount: number;
  statIndexLoaded: boolean;
}

// 模块级 stat index 缓存 — 落地页和 /wca 都会请求,共享一次 fetch。
let statIndexPromise: Promise<StatIndex | null> | null = null;
function loadStatIndex(): Promise<StatIndex | null> {
  if (!statIndexPromise) {
    statIndexPromise = fetch('/stats/index.json')
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return statIndexPromise;
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
  const compsRef = useRef<Comp[] | null>(null);
  const [xLoaded, setXLoaded] = useState(false);

  useEffect(() => {
    loadStatIndex().then(j => { if (j) setStatIndex(j); });
  }, []);

  // NOTE: useDeferredValue 把"匹配 + 渲染"标成低优先级,输入框打字始终顺滑。
  // 用户敲 'a/o/5' 时,旧的 deferredQuery 还能正常 render,React 会用 idle 时间算新结果。
  const deferredRawQuery = useDeferredValue(query);
  const q = deferredRawQuery.trim().toLowerCase();
  const qRaw = deferredRawQuery.trim();
  const xSearchEnabled = qRaw.length >= (hasNonLatin(qRaw) ? 1 : MIN_LEN_LATIN);

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
  // 不 limit:全量命中,用户自己用更具体的 query 收窄。
  useEffect(() => {
    if (!xSearchEnabled) {
      setPersonMatches([]);
      setCompMatches([]);
      return;
    }
    const h = setTimeout(() => {
      setPersonMatches(searchLocalPersons(qRaw, MATCH_HARD_CAP) ?? []);
      setCompMatches(compsRef.current ? searchComps(qRaw, compsRef.current, MATCH_HARD_CAP) : []);
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

  const toolMatches = useMemo(() => {
    if (q === '') return [];
    return tools.filter(t => t.zh.toLowerCase().includes(q) || t.en.toLowerCase().includes(q));
  }, [q, tools]);

  const lookupMatches = useMemo(() => {
    if (q === '') return [];
    return lookups.filter(it => it.zh.toLowerCase().includes(q) || it.en.toLowerCase().includes(q));
  }, [q, lookups]);

  const statMatches = useMemo(() => {
    if (!statIndex || q === '') return [] as { cat: StatCategory; items: StatItem[] }[];
    return statIndex.categories
      .map(cat => {
        const items: StatItem[] = [];
        for (const stat of cat.stats) {
          if (stat.titleEn.toLowerCase().includes(q) || stat.titleZh.toLowerCase().includes(q)) {
            items.push({ kind: 'stat', stat });
          }
          if (stat.metrics) {
            for (const m of stat.metrics) {
              const override = METRIC_LABEL_OVERRIDE[m.labelEn];
              const hay = [m.labelEn, m.labelZh, override].filter(Boolean).join('\n').toLowerCase();
              if (hay.includes(q)) items.push({ kind: 'metric', parent: stat, metric: m });
            }
          }
        }
        return { cat, items };
      })
      .filter(g => g.items.length > 0);
  }, [q, statIndex]);

  const totalCount =
    cardMatches.length +
    toolMatches.length +
    lookupMatches.length +
    statMatches.reduce((s, g) => s + g.items.length, 0) +
    personMatches.length +
    compMatches.length;

  return {
    q, qRaw, xSearchEnabled, xLoaded,
    cardMatches, toolMatches, lookupMatches, statMatches,
    personMatches, compMatches, totalCount,
    statIndexLoaded: statIndex !== null,
  };
}
