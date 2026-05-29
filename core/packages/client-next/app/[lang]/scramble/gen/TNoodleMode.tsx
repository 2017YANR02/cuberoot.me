'use client';
/**
 * /scramble/gen — "Comp" mode: unified competition scramble sheet UX.
 * Single tab merges 模拟 + WCA paths:
 *   - 不填 / 自由文本 → 配置项目 + 轮数,点 生成 走 cubing/scramble 出随机打乱
 *   - 输入比赛或链接 → 自动加载 WCA 已公布打乱 (/v1/recon/wca-scrambles)
 * 两条路径共用 SheetView + PDF 管道。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { RefreshCw, Download, X, Trash2, Edit3, Image as ImageIcon, ImageOff, Dices } from 'lucide-react';
import { EventIcon } from '@/components/EventIcon';
import WcaEventSelector from '@/components/WcaEventSelector';
import NumberCommitInput from '@/components/NumberCommitInput';
import Scramble555ModePicker from '@/components/Scramble555ModePicker';
import Scramble333ModePicker from '@/components/Scramble333ModePicker';
import HighOrderNxNInput from '@/components/HighOrderNxNInput';
import { activeEventOf } from './_active-view';
import { CompPicker } from '@/components/CompPicker';
import { CompCell } from '@/components/CompCell/CompCell';
import { ClearButton } from '@/components/ClearButton';
import { loadComps, isCancelledComp, type Comp } from '@/lib/comp-search';
import { loadNoScrambleIds } from '@/lib/comp-no-scrambles';
import { loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { type WcaScrambleRow } from '@/lib/wca-results-api';
import { fetchCompName } from '@/lib/comp-wcif';
import { apiUrl } from '@/lib/api-base';
import { eventDisplayName } from '@/lib/wca-events';
import { TNOODLE_WCA_EVENTS, TWIZZLE_NONWCA_EVENTS, TWIZZLE_NONWCA_APPEND, tnoodleRandomScramble } from '@/lib/cubing-scramble';
import { CSTIMER_NONWCA_APPEND, CSTIMER_EVENT_IDS, CSTIMER_EVENTS, cstimerScramble, isCstimerEvent } from '@/lib/cstimer-scramble';
import { SHAPE_MOD_APPEND, SHAPE_MOD_EVENT_IDS, SHAPE_MOD_EVENTS, isShapeModEvent, shapeModSourceEvent } from '@/lib/shape-mod-scramble';

// 给 selector 当 availableEvents 用,涵盖 WCA + 非 WCA。
const TNOODLE_EVENT_SET = new Set<string>([...TNOODLE_WCA_EVENTS, ...TWIZZLE_NONWCA_EVENTS, ...CSTIMER_EVENT_IDS, ...SHAPE_MOD_EVENT_IDS]);
const TN_APPEND_EVENTS = [...TWIZZLE_NONWCA_APPEND, ...CSTIMER_NONWCA_APPEND, ...SHAPE_MOD_APPEND];
const CSTIMER_EVENT_ORDER: ReadonlyArray<string> = CSTIMER_EVENTS.map((e) => e.id);
const SHAPE_MOD_EVENT_ORDER: ReadonlyArray<string> = SHAPE_MOD_EVENTS.map((e) => e.id);
import {
  allowedFormats, FORMAT_LABEL, formatAttempts, DEFAULT_EXTRA_COUNT,
  defaultEventConfig, defaultRoundConfig,
  type EventConfig, type WcaFormat,
} from './_wca-round';
import type { RoundSheetInput } from './_tnoodle-pdf';
import ClockColorPicker from './ClockColorPicker';
import ProgressButton from './ProgressButton';
import TranslationsPicker from './TranslationsPicker';
import SheetView, { type AttemptScramble, type RoundSheet } from './SheetView';
import CompCrossAnalysis, { type CrossFilter, type Metric, METRIC_OFFSET } from './CompCrossAnalysis';
import { useStepMap, type StepMetric, type StepMapState } from './useStepMap';
import {
  activeLetters, COLOR_MODES, MODE_LABEL, BADGE_LETTERS,
  OPPOSITE_PAIRS, COLOR_NAME, CX_CLASS, DEFAULT_COLOR_SEL,
  type ColorMode, type ColorLetter,
} from '@/lib/cross-color-subset';
import PillToggle from '@/components/PillToggle/PillToggle';
import { useCrossMap } from './useCrossMap';
import { useCompSteps, normScramble } from './useCompSteps';
import { useF2leoStepMap } from './useF2leoStepMap';
import { useVariantStepMap, VARIANT_WASM_ID } from './useVariantStepMap';

const GENERATOR_TAG = 'TNoodle-WCA-1.2.3-port';

// 变体 (前端先做,后端数据后续接;key 与 /scramble/analyzer + /scramble/stats 对齐)。
type VariantKey = 'std' | 'eo' | 'pair' | 'pseudo' | 'pseudo_pair' | 'f2leo' | 'pseudo_f2leo';
const VARIANTS: { key: VariantKey; zh: string; en: string }[] = [
  { key: 'std', zh: '标准', en: 'Standard' },
  { key: 'eo', zh: 'EO十字', en: 'EOCross' },
  { key: 'pair', zh: '十字+基态', en: 'Cross + Pair' },
  { key: 'pseudo', zh: '伪十字', en: 'Pseudo' },
  { key: 'pseudo_pair', zh: '伪十字+基态', en: 'Pseudo + Pair' },
  { key: 'f2leo', zh: 'F2LEO', en: 'F2LEO' },
  { key: 'pseudo_f2leo', zh: '伪 F2LEO', en: 'Pseudo F2LEO' },
];
// 每变体:阶段集 + 实时引擎能力。std=现有 cross WASM(5 阶段);f2leo/pseudo_f2leo=
// F2leoSolverWasm 浏览器当场算(4 阶段,无 xxxxc);其余暂仅靠预计算(comp_steps 未生成
// → 无数据时显示提示)。后端 comp_steps_<variant> 出齐后这些会自动秒载。
const STD_STAGES: Metric[] = ['cross', 'xc', 'xxc', 'xxxc', 'xxxxc'];
const F2L_STAGES: Metric[] = ['cross', 'xc', 'xxc', 'xxxc'];
// engine:'variant' = VariantSolverWasm 小表浏览器现算(pair 已接;eo/pseudo/pseudo_pair
// solver 就绪后从 'none' 改 'variant')。'none' = 仅 comp_steps 预计算,无 client 引擎。
const VARIANT_SPEC: Record<VariantKey, { stages: Metric[]; engine: 'std' | 'f2leo' | 'variant' | 'none' }> = {
  std: { stages: STD_STAGES, engine: 'std' },
  eo: { stages: STD_STAGES, engine: 'variant' },
  pair: { stages: F2L_STAGES, engine: 'variant' },
  pseudo: { stages: F2L_STAGES, engine: 'variant' },
  pseudo_pair: { stages: F2L_STAGES, engine: 'variant' },
  f2leo: { stages: F2L_STAGES, engine: 'f2leo' },
  pseudo_f2leo: { stages: F2L_STAGES, engine: 'f2leo' },
};
const EMPTY_STEP: StepMapState = { map: null, ready: true, done: 0, total: 0, error: null };
const EMPTY_MAP_TN: Map<string, number[]> = new Map();
// 阶段下拉显示名(metric → 标签);XCross 系沿用 stats 写法,中英一致。
const STAGE_LABEL: Record<Metric, { zh: string; en: string }> = {
  cross: { zh: '十字', en: 'Cross' },
  xc: { zh: 'XCross', en: 'XCross' },
  xxc: { zh: 'XXCross', en: 'XXCross' },
  xxxc: { zh: 'XXXCross', en: 'XXXCross' },
  xxxxc: { zh: 'XXXXCross', en: 'XXXXCross' },
};

interface Props {
  t: (zh: string, en: string) => string;
  isZh: boolean;
  showPreview: boolean;
  onTogglePreview: () => void;
  /** GenPage header 提供的 portal 目标:CompPicker(及 loaded/readonly 两个变体)
   *  会通过 createPortal 渲染到这里。null 时 fallback 回 body 内联。 */
  compHeaderSlot?: HTMLDivElement | null;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

// 十字分析总开关(每行徽标 + 分布面板)。默认开,localStorage 记忆。
const SHOW_CROSS_KEY = 'gen:showCross';
function readShowCross(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(SHOW_CROSS_KEY) !== '0';
}
// 分析范围:本轮(默认) / 全部轮次。localStorage 记忆。
const SCOPE_ALL_KEY = 'gen:cxScopeAll';
function readScopeAll(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(SCOPE_ALL_KEY) === '1';
}
const NO_SCRAMBLES: string[] = [];
// 用 3x3 打乱、可做十字步数分析的项目(跳过 333mbf 多盲:一把多方块无法逐方块对应)。
const FAMILY_333 = new Set(['333', '333oh', '333ft', '333fm', '333bf']);

// ── WCA load helpers (was ImportMode.tsx) ─────────────────────────────────
const ROUND_INDEX: Record<string, number> = {
  '1': 0, 'b': 0, 'd': 0,
  '2': 1, 'c': 1, 'e': 1,
  '3': 2, 'g': 2,
  'f': 3, 'h': 3,
};
function roundIdxOf(rt: string): number { return ROUND_INDEX[rt] ?? 0; }
function groupIdxOf(g: string): number {
  if (!g) return 0;
  const c = g.toUpperCase().charCodeAt(0);
  return c >= 65 && c <= 90 ? c - 65 : 0;
}
function inferFormat(event: string, nonExtraCount: number): WcaFormat {
  const allowed = allowedFormats(event);
  const COUNT: Record<WcaFormat, number> = { 'a': 5, 'm': 3, '5': 5, '3': 3, '2': 2, '1': 1 };
  return allowed.find((f) => COUNT[f] === nonExtraCount) ?? allowed[0];
}

/** 流式读取响应体,边收边报告字节进度。proxy 失败则 fallback 到 WCA 直拉。 */
async function streamFetchScrambles(
  compId: string,
  onProgress: (received: number, total: number) => void,
): Promise<WcaScrambleRow[] | null> {
  const candidates = [
    apiUrl(`/v1/recon/wca-scrambles?compId=${encodeURIComponent(compId)}`),
    `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(compId)}/scrambles`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok || !res.body) continue;
      const total = Number(res.headers.get('Content-Length') ?? 0);
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let text = '';
      let received = 0;
      onProgress(0, total);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        received += value.length;
        onProgress(received, total);
      }
      text += decoder.decode();
      const json = JSON.parse(text);
      return Array.isArray(json) ? (json as WcaScrambleRow[]) : null;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function buildSheetsFromWca(rows: WcaScrambleRow[]): RoundSheet[] {
  type Key = string;
  const groups = new Map<Key, WcaScrambleRow[]>();
  for (const r of rows) {
    const k = `${r.event_id}|${roundIdxOf(r.round_type_id)}|${r.group_id}`;
    let arr = groups.get(k);
    if (!arr) { arr = []; groups.set(k, arr); }
    arr.push(r);
  }
  const groupCountByER = new Map<string, number>();
  for (const k of groups.keys()) {
    const [ev, ri] = k.split('|');
    const erKey = `${ev}|${ri}`;
    groupCountByER.set(erKey, (groupCountByER.get(erKey) ?? 0) + 1);
  }
  const sheets: RoundSheet[] = [];
  for (const [k, arr] of groups) {
    const [event, riStr, groupId] = k.split('|');
    const roundIdx = Number(riStr);
    const main = arr.filter((r) => !r.is_extra).sort((a, b) => a.scramble_num - b.scramble_num);
    const extras = arr.filter((r) => r.is_extra).sort((a, b) => a.scramble_num - b.scramble_num);
    const attempts: AttemptScramble[] = [
      ...main.map((r, i) => ({ label: String(i + 1), scramble: r.scramble, isExtra: false })),
      ...extras.map((r, i) => ({ label: `E${i + 1}`, scramble: r.scramble, isExtra: true })),
    ];
    sheets.push({
      event,
      roundIdx,
      groupIdx: groupIdxOf(groupId),
      format: inferFormat(event, main.length || 1),
      attempts,
      totalGroups: groupCountByER.get(`${event}|${roundIdx}`) ?? 1,
    });
  }
  sheets.sort((a, b) => {
    if (a.event !== b.event) return a.event.localeCompare(b.event);
    if (a.roundIdx !== b.roundIdx) return a.roundIdx - b.roundIdx;
    return a.groupIdx - b.groupIdx;
  });
  return sheets;
}

export default function TNoodleMode({ t, isZh, showPreview, onTogglePreview, compHeaderSlot }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const setSearchParams = useCallback(
    (
      updater: ((prev: URLSearchParams) => URLSearchParams) | URLSearchParams,
      _opts?: { replace?: boolean },
    ) => {
      const prev = new URLSearchParams(searchParams?.toString() ?? '');
      const next = typeof updater === 'function' ? updater(prev) : updater;
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );
  const urlComp = searchParams?.get('comp') ?? '';

  // CompPicker 的当前文本(用户在输入框里看到/输入的内容)。
  // 在 mock 路径里它兼作 PDF 标题(空则 fallback 到今天日期)。
  const [compInput, setCompInput] = useState<string>('');

  // 一旦走 WCA 路径加载成功,记录 id + 原始英文名(显示由 CompCell + localizeCompName 处理)。
  // loadedCompId 同时是 mock vs wca 路径的判别(非 null = wca)。
  const [loadedCompId, setLoadedCompId] = useState<string | null>(null);
  const [loadedCompName, setLoadedCompName] = useState<string | null>(null);

  const [events, setEvents] = useState<Record<string, EventConfig>>({
    '333': defaultEventConfig('333'),
  });
  const [sheets, setSheets] = useState<RoundSheet[] | null>(null);
  const [viewedEvent, setViewedEvent] = useState<string | null>(null);
  const [viewedRoundIdx, setViewedRoundIdx] = useState<number | null>(null);

  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pdfBuilding, setPdfBuilding] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);

  const autoLoadedRef = useRef<string | null>(null);
  // 用户点垃圾桶可以中途取消生成 — generate() 每轮 tick 检一下,被置 true 就早退。
  const generateAbortRef = useRef(false);

  // 后台预生成 cache。用户调 event / rounds / sets 时,后台默默按当前配置 top up
  // 对应 scramble type 的 pool;点击 生成 时直接 drain pool 而不是现场算。
  // key = 传给 tnoodleRandomScramble 的 scramble type ('333bf' for MBLD, ev otherwise)。
  // targetRef 由 effect 实时写,fill loop 每轮重读 —— 配置中途上调 mbldCubes/sets
  // 时已 in-flight 的 fill 能跟上,不需要等 fill 退出再重启。
  const cacheRef = useRef<Record<string, string[]>>({});
  const cacheBusyRef = useRef<Set<string>>(new Set());
  const cacheTargetRef = useRef<Record<string, number>>({});

  const [flagVer, setFlagVer] = useState(flagDataVersion());
  useEffect(() => {
    loadFlagData().then((v) => { if (v !== flagVer) setFlagVer(v); });
  }, [flagVer]);

  // 高阶 NxN(nxn8..nxn300)按 N 升序排,接在 WCA 21 项之后。
  const customNxN = useMemo(
    () => Object.keys(events)
      .filter((id) => /^nxn\d+$/.test(id))
      .sort((a, b) => parseInt(a.slice(3), 10) - parseInt(b.slice(3), 10)),
    [events],
  );
  const enabledEvents = useMemo(
    () => [
      ...TNOODLE_WCA_EVENTS.filter((e) => events[e]),
      ...TWIZZLE_NONWCA_EVENTS.filter((e) => events[e]),
      ...CSTIMER_EVENT_ORDER.filter((e) => events[e]),
      ...SHAPE_MOD_EVENT_ORDER.filter((e) => events[e]),
      ...customNxN,
    ],
    [events, customNxN],
  );

  const toggleEvent = (e: string) => {
    setEvents((prev) => {
      const next = { ...prev };
      if (next[e]) delete next[e];
      else next[e] = defaultEventConfig(e);
      return next;
    });
  };

  // 高阶 NxN 入选 → defaultEventConfig 兜底。
  const addHighNxN = (n: number) => {
    const id = `nxn${n}`;
    setEvents((prev) => {
      if (prev[id]) return prev;
      return { ...prev, [id]: defaultEventConfig(id) };
    });
  };
  // 「其他」展开态:控制高阶 NxN 输入框的显隐(view 模式自身已隐藏整块)。
  const [otherExpanded, setOtherExpanded] = useState(false);

  const setRoundCount = (e: string, count: number) => {
    setEvents((prev) => {
      const cfg = prev[e];
      if (!cfg) return prev;
      const rounds = [...cfg.rounds];
      while (rounds.length < count) rounds.push(defaultRoundConfig(e));
      while (rounds.length > count) rounds.pop();
      return { ...prev, [e]: { ...cfg, rounds } };
    });
  };

  const updateRound = (e: string, ri: number, patch: Partial<EventConfig['rounds'][number]>) => {
    setEvents((prev) => {
      const cfg = prev[e];
      if (!cfg) return prev;
      const rounds = cfg.rounds.map((r, i) => (i === ri ? { ...r, ...patch } : r));
      return { ...prev, [e]: { ...cfg, rounds } };
    });
  };

  const setMbldCubes = (e: string, cubes: number) => {
    setEvents((prev) => {
      const cfg = prev[e];
      if (!cfg) return prev;
      return { ...prev, [e]: { ...cfg, mbldCubes: cubes } };
    });
  };

  const setEventColors = (e: string, colors: Record<string, string> | undefined) => {
    setEvents((prev) => {
      const cfg = prev[e];
      if (!cfg) return prev;
      return { ...prev, [e]: { ...cfg, colors } };
    });
  };

  const totalAttempts = useMemo(() => {
    let n = 0;
    for (const ev of enabledEvents) {
      const cfg = events[ev];
      for (const r of cfg.rounds) {
        const sets = Math.max(1, r.scrambleSets);
        if (ev === '333mbf' || ev === '333mbo') {
          n += formatAttempts(r.format) * (cfg.mbldCubes ?? 8) * sets;
        } else if (ev === '333fm') {
          n += formatAttempts(r.format) * sets;
        } else {
          n += (formatAttempts(r.format) + DEFAULT_EXTRA_COUNT) * sets;
        }
      }
    }
    return n;
  }, [enabledEvents, events]);

  // Map event → cache/scramble key. WCA MBLD shares 333bf scramble; shape mods
  // borrow scramble from underlying WCA event (Pyramorphix → 222, Mirror → 333);
  // cstimer events keep their own id (worker dispatches by it).
  const scrambleTypeFor = (ev: string): string => {
    if (ev === '333mbf' || ev === '333mbo') return '333bf';
    if (isShapeModEvent(ev)) return shapeModSourceEvent(ev) ?? ev;
    return ev;
  };

  // Generate one scramble. Routed by type: cstimer ids → worker bridge;
  // everything else → cubing.js / TNoodle pool.
  const generateOne = async (type: string): Promise<string> => {
    if (isCstimerEvent(type)) return cstimerScramble(type);
    return (await tnoodleRandomScramble(type)) ?? '';
  };

  const drawScramble = async (type: string): Promise<string> => {
    const q = cacheRef.current[type];
    if (q && q.length > 0) return q.shift() ?? '';
    return generateOne(type);
  };

  // 后台预生成:用户在 configure 模式下调整时,按当前配置算出每种 scramble type
  // 需要的数量,默默 top up cache。WCA 加载路径 / 已生成视图 都跳过。
  useEffect(() => {
    if (loadedCompId || sheets) return;
    const need = new Map<string, number>();
    for (const ev of enabledEvents) {
      const cfg = events[ev];
      if (!cfg) continue;
      const type = scrambleTypeFor(ev);
      let n = 0;
      for (const r of cfg.rounds) {
        const sets = Math.max(1, r.scrambleSets);
        if (ev === '333mbf' || ev === '333mbo') {
          n += formatAttempts(r.format) * (cfg.mbldCubes ?? 8) * sets;
        } else if (ev === '333fm') {
          n += formatAttempts(r.format) * sets;
        } else {
          n += (formatAttempts(r.format) + DEFAULT_EXTRA_COUNT) * sets;
        }
      }
      need.set(type, (need.get(type) ?? 0) + n);
    }
    // 先把 targetRef 同步到当前值;in-flight fill 会在每轮 while 重读到新 target。
    for (const [type, target] of need) cacheTargetRef.current[type] = target;
    for (const [type] of need) {
      if (cacheBusyRef.current.has(type)) continue;
      if ((cacheRef.current[type]?.length ?? 0) >= (cacheTargetRef.current[type] ?? 0)) continue;
      cacheBusyRef.current.add(type);
      (async () => {
        try {
          while ((cacheRef.current[type]?.length ?? 0) < (cacheTargetRef.current[type] ?? 0)) {
            const s = await generateOne(type);
            if (!cacheRef.current[type]) cacheRef.current[type] = [];
            cacheRef.current[type].push(s ?? '');
          }
        } catch (err) {
          console.warn('[gen/comp] background prefill failed', type, err);
        } finally {
          cacheBusyRef.current.delete(type);
        }
      })();
    }
  }, [enabledEvents, events, loadedCompId, sheets]);

  // ── mock 生成 ─────────────────────────────────────────────────
  const generate = async () => {
    generateAbortRef.current = false;
    setGenerating(true);
    let done = 0;
    const total = totalAttempts;
    setGenProgress({ done: 0, total });
    const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));
    // tick 内 throw 这个 sentinel,catch 里识别并静默退出 — 避开层层 break。
    // 延迟最多 1 个 scramble(in-flight 的 drawScramble 必须先 resolve)。
    const ABORT_SENTINEL = {};
    const tick = async () => {
      if (generateAbortRef.current) throw ABORT_SENTINEL;
      done += 1;
      setGenProgress({ done, total });
      if (done % 2 === 0) await yieldToUi();
    };
    try {
      const out: RoundSheet[] = [];
      outer: for (const ev of enabledEvents) {
        if (generateAbortRef.current) break outer;
        const cfg = events[ev];
        for (let ri = 0; ri < cfg.rounds.length; ri++) {
          if (generateAbortRef.current) break outer;
          const round = cfg.rounds[ri];
          const mainCount = formatAttempts(round.format);
          for (let g = 0; g < Math.max(1, round.scrambleSets); g++) {
            if (generateAbortRef.current) break outer;
            if (ev === '333mbf' || ev === '333mbo') {
              const cubesPerAttempt = cfg.mbldCubes ?? 8;
              for (let a = 0; a < mainCount; a++) {
                const cubeRows: AttemptScramble[] = [];
                for (let c = 0; c < cubesPerAttempt; c++) {
                  const s = await drawScramble('333bf');
                  cubeRows.push({ label: String(c + 1), scramble: s, isExtra: false });
                  await tick();
                }
                out.push({
                  event: ev, roundIdx: ri, groupIdx: g,
                  format: round.format,
                  attemptNumber: a,
                  attempts: cubeRows,
                  copies: round.copies,
                  totalGroups: round.scrambleSets,
                });
              }
            } else if (ev === '333fm') {
              const type = scrambleTypeFor(ev);
              for (let a = 0; a < mainCount; a++) {
                const s = await drawScramble(type);
                await tick();
                out.push({
                  event: ev, roundIdx: ri, groupIdx: g,
                  format: round.format,
                  attemptNumber: a,
                  attempts: [{ label: '1', scramble: s, isExtra: false }],
                  locales: round.locales,
                  copies: round.copies,
                  totalGroups: round.scrambleSets,
                });
              }
            } else {
              const type = scrambleTypeFor(ev);
              const attempts: AttemptScramble[] = [];
              for (let i = 0; i < mainCount; i++) {
                const s = await drawScramble(type);
                attempts.push({ label: String(i + 1), scramble: s, isExtra: false });
                await tick();
              }
              for (let i = 0; i < DEFAULT_EXTRA_COUNT; i++) {
                const s = await drawScramble(type);
                attempts.push({ label: `E${i + 1}`, scramble: s, isExtra: true });
                await tick();
              }
              out.push({
                event: ev, roundIdx: ri, groupIdx: g,
                format: round.format,
                attempts,
                copies: round.copies,
                totalGroups: round.scrambleSets,
              });
            }
          }
        }
      }
      if (!generateAbortRef.current) {
        setSheets(out);
        // viewedEvent = null 让 activeEventOf 落到默认 (333 若存在,否则首项)。
        setViewedEvent(null);
        setViewedRoundIdx(null);
      }
    } catch (err) {
      if (err !== ABORT_SENTINEL) console.error('[gen/comp] generate failed', err);
      // abort 路径:静默退出,垃圾桶的 setSheets(null) 已经清场。
    } finally {
      setGenerating(false);
      setGenProgress(null);
    }
  };

  // ── WCA 加载(picker pick / URL paste / ?comp= 直链) ─────────
  // name 解析顺序: nameOverride → 本地索引 (loadComps) → WCA API (fetchCompName)
  // 本地索引 ~4.4MB 但全局缓存,picker 聚焦时就预热好了。WCA API 时不时被 CORS/网络挡
  // 或 upcoming 比赛延迟上线,本地拿到就直接用,绕开兜底成 slug "PleaseDontDNF..." 的坑。
  const loadWca = async (compId: string, nameOverride?: string) => {
    if (!compId) return;
    setLoading(true);
    setLoadProgress({ done: 0, total: 0 });
    setError(null);
    try {
      const resolveName = async (): Promise<string | null> => {
        if (nameOverride) return nameOverride;
        const localComps = await loadComps().catch(() => [] as Comp[]);
        const local = localComps.find((c) => c.id === compId);
        if (local?.name) return local.name;
        return fetchCompName(compId);
      };
      const [data, name] = await Promise.all([
        streamFetchScrambles(compId, (done, total) => setLoadProgress({ done, total })),
        resolveName(),
      ]);
      if (!data || data.length === 0) {
        setError(t('未找到该比赛或暂无已公布的打乱', 'Competition not found or no published scrambles'));
        return;
      }
      const built = buildSheetsFromWca(data);
      setSheets(built);
      // viewedEvent = null 让 activeEventOf 落到默认 (333 若存在,否则首项)。
      setViewedEvent(null);
      setViewedRoundIdx(null);
      setLoadedCompId(compId);
      setLoadedCompName(name);
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('comp', compId);
        return p;
      }, { replace: true });
    } catch (err) {
      setError(t('网络错误', 'Network error') + ': ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
      setLoadProgress(null);
    }
  };

  const onPickComp = (c: Comp) => {
    setCompInput(localizeCompName(c.id, c.name, isZh));
    loadWca(c.id, c.name);
  };

  // 随机挑一场已结束/未取消/有项目的真比赛,跳过黑名单(WCA dump 抽出:2020 前
  // 真办过但没 scrambles 的 1675 场,2020+ 默认全有 scrambles 不过滤)。
  const pickRandomComp = async () => {
    const [all, noScrambles] = await Promise.all([
      loadComps().catch(() => [] as Comp[]),
      loadNoScrambleIds().catch(() => new Set<string>()),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const candidates = all.filter((c) =>
      !isCancelledComp(c) &&
      (c.events?.length ?? 0) > 0 &&
      (c.end_date || c.start_date) < today &&
      !noScrambles.has(c.id)
    );
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    onPickComp(pick);
  };

  // URL ?comp=... → mount/变更时自动加载一次。
  useEffect(() => {
    if (!urlComp || urlComp === loadedCompId || urlComp === autoLoadedRef.current || loading) return;
    autoLoadedRef.current = urlComp;
    loadWca(urlComp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlComp]);

  // 切 event 时清掉旧的 round 选择,让默认落回新 event 的第一个轮次
  useEffect(() => {
    setViewedRoundIdx(null);
  }, [viewedEvent]);

  // ── 重置回配置模式 ─────────────────────────────────────────
  const reset = () => {
    setSheets(null);
    setViewedEvent(null);
    setViewedRoundIdx(null);
    setError(null);
    // mock 路径:保留 compInput(用户的标题文本)
    // wca 路径:清掉 loaded 状态 + compInput + URL ?comp
    if (loadedCompId) {
      setLoadedCompId(null);
      setLoadedCompName(null);
      setCompInput('');
      autoLoadedRef.current = null;
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.delete('comp');
        return p;
      }, { replace: true });
    }
  };

  // ── PDF 下载(两条路径共用) ────────────────────────────────
  const downloadPdf = async () => {
    if (!sheets || sheets.length === 0) return;
    setPdfBuilding(true);
    setPdfProgress({ done: 0, total: 1 });
    try {
      const { generateTnoodlePdf } = await import('./_tnoodle-pdf');
      const sheetInputs: RoundSheetInput[] = sheets.map((s) => ({
        event: s.event,
        roundIdx: s.roundIdx,
        groupIdx: s.groupIdx,
        format: s.format,
        attemptNumber: s.attemptNumber,
        attempts: s.attempts.map((a) => ({ label: a.label, isExtra: a.isExtra, scramble: a.scramble })),
        locales: s.locales,
        copies: s.copies,
        totalGroups: s.totalGroups,
      }));
      const eventColors: Record<string, Record<string, string>> = {};
      if (!loadedCompId) {
        for (const ev of Object.keys(events)) {
          const c = events[ev].colors;
          if (c) eventColors[ev] = c;
        }
      }
      const title = loadedCompId
        ? (loadedCompName ?? loadedCompId)
        : (compInput.trim() || `Scrambles for ${todayIso()}`);
      const blob = await generateTnoodlePdf(sheetInputs, {
        competitionTitle: title,
        generatorTag: GENERATOR_TAG,
        isZh,
        showPreview,
        onProgress: (done, total) => setPdfProgress({ done, total }),
        eventColors,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/[^\w一-龥-]+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error('[gen/comp] pdf failed', err);
      alert(`PDF generation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPdfBuilding(false);
      setPdfProgress(null);
    }
  };

  // ── 视图衍生 ───────────────────────────────────────────────
  const eventsInSheets = useMemo(
    () => Array.from(new Set((sheets ?? []).map((s) => s.event))),
    [sheets],
  );
  // 3x3 系列(333/oh/ft/fm/bf)cross-step 分析:跟随当前事件视图。
  const activeView = activeEventOf(viewedEvent, eventsInSheets);
  const is333Family = FAMILY_333.has(activeView ?? '');
  const analysisScrambles = useMemo(() => {
    const out: string[] = [];
    if (!is333Family) return out;
    const seen = new Set<string>();
    for (const sh of sheets ?? []) {
      if (sh.event !== activeView) continue;
      for (const a of sh.attempts) {
        if (a.scramble && !seen.has(a.scramble)) { seen.add(a.scramble); out.push(a.scramble); }
      }
    }
    return out;
  }, [sheets, activeView, is333Family]);
  const [showCross, setShowCrossState] = useState<boolean>(readShowCross);
  const setShowCross = (v: boolean) => {
    setShowCrossState(v);
    try { localStorage.setItem(SHOW_CROSS_KEY, v ? '1' : '0'); } catch { /* swallow */ }
  };
  const [includeExtras, setIncludeExtras] = useState(true);
  // 分析范围:false=本轮(默认) / true=全部轮次。
  const [analysisAll, setAnalysisAllState] = useState<boolean>(readScopeAll);
  const setAnalysisAll = (v: boolean) => {
    setAnalysisAllState(v);
    try { localStorage.setItem(SCOPE_ALL_KEY, v ? '1' : '0'); } catch { /* swallow */ }
  };
  // 十字分析里点某步 → 把命中打乱集合提上来,过滤下方打乱表(只渲染含命中打乱的 sheet)。
  const [crossFilter, setCrossFilter] = useState<CrossFilter | null>(null);
  // 指标 + 底色子集(原在 CompCrossAnalysis,提上来跟 toggles 同一行)。
  const [variant, setVariant] = useState<VariantKey>('std');
  const [metric, setMetric] = useState<Metric>('cross');
  const [colorMode, setColorMode] = useState<ColorMode>(DEFAULT_COLOR_SEL.mode);
  const [cxSingle, setCxSingle] = useState<ColorLetter>(DEFAULT_COLOR_SEL.single);
  const [cxPair, setCxPair] = useState(DEFAULT_COLOR_SEL.pair);
  const [cxQuadExcl, setCxQuadExcl] = useState(DEFAULT_COLOR_SEL.quadExcl);
  const cxLetters = useMemo(
    () => activeLetters({ mode: colorMode, single: cxSingle, pair: cxPair, quadExcl: cxQuadExcl }),
    [colorMode, cxSingle, cxPair, cxQuadExcl],
  );
  const vspec = VARIANT_SPEC[variant];
  const variantEngine = vspec.engine;
  // metric 落在当前变体阶段集外(切变体后)→ 视为 cross,避免越界取数。
  const safeMetric: Metric = vspec.stages.includes(metric) ? metric : 'cross';
  // 切变体后复位越界 metric(同步 select)。
  useEffect(() => {
    if (!VARIANT_SPEC[variant].stages.includes(metric)) setMetric('cross');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  // 关闭 / 非 333 / 非 std 引擎时不建 JS cross 表。
  const crossA = useCrossMap(showCross && is333Family && variantEngine === 'std' ? analysisScrambles : NO_SCRAMBLES);
  // 预计算步数表:每个变体取自己的 comp_steps 目录(命中秒出)。404 → std/f2leo 退实时
  // 引擎;无 client 引擎的变体(eo/pair/pseudo/pseudo_pair)显示「暂无数据」而非永远转圈。
  const compSteps = useCompSteps(showCross && is333Family ? loadedCompId : null, variant);
  const uncovered = useMemo(() => {
    if (!(showCross && is333Family) || !compSteps.ready) return NO_SCRAMBLES;
    if (!compSteps.map) return analysisScrambles;
    return analysisScrambles.filter((s) => !compSteps.map!.has(normScramble(s)));
  }, [showCross, is333Family, analysisScrambles, compSteps.ready, compSteps.map]);
  // std:非 cross 指标走实时 cross-step WASM(comp_steps 未覆盖的打乱);cross 走 JS crossA。
  const stepUncovered = variantEngine === 'std' && safeMetric !== 'cross' ? uncovered : NO_SCRAMBLES;
  const stepLive = useStepMap(stepUncovered, stepUncovered.length === 0 ? null : (safeMetric as StepMetric));
  // f2leo / pseudo_f2leo:整变体一次算全 24 值(浏览器当场算,无需预计算)。
  const f2leoScrambles = variantEngine === 'f2leo' ? uncovered : NO_SCRAMBLES;
  const f2leoLive = useF2leoStepMap(f2leoScrambles, variantEngine === 'f2leo', variant === 'pseudo_f2leo');
  // f2leoLive(全 24)派生 cross-map + 当前 metric-map,复用现有 crossMap/step props(不改 CompCrossAnalysis)。
  const f2leoCrossMap = useMemo(() => {
    const m = new Map<string, number[]>();
    if (variantEngine === 'f2leo' && f2leoLive.map) for (const [s, v] of f2leoLive.map) m.set(s, v.slice(0, 6));
    return m;
    // f2leoLive 原地 mutate 同一 Map(引用不变),靠 done/crossReady 触发重算。
  }, [variantEngine, f2leoLive.map, f2leoLive.done, f2leoLive.crossReady]);
  const f2leoMetricMap = useMemo(() => {
    const m = new Map<string, number[]>();
    const off = METRIC_OFFSET[safeMetric];
    if (variantEngine === 'f2leo' && f2leoLive.map) {
      for (const [s, v] of f2leoLive.map) if (v.length >= off + 6) m.set(s, v.slice(off, off + 6));
    }
    return m;
  }, [variantEngine, f2leoLive.map, f2leoLive.done, f2leoLive.fullReady, safeMetric]);
  // pair / eo / pseudo / pseudo_pair:VariantSolverWasm 小表浏览器现算(comp_steps 未覆盖的打乱)。
  const variantScrambles = variantEngine === 'variant' ? uncovered : NO_SCRAMBLES;
  const variantLive = useVariantStepMap(
    variantScrambles,
    variantEngine === 'variant',
    VARIANT_WASM_ID[variant] ?? 0,
    vspec.stages.length,
  );
  const variantCrossMap = useMemo(() => {
    const m = new Map<string, number[]>();
    if (variantEngine === 'variant' && variantLive.map) for (const [s, v] of variantLive.map) m.set(s, v.slice(0, 6));
    return m;
  }, [variantEngine, variantLive.map, variantLive.done, variantLive.crossReady]);
  const variantMetricMap = useMemo(() => {
    const m = new Map<string, number[]>();
    const off = METRIC_OFFSET[safeMetric];
    if (variantEngine === 'variant' && variantLive.map) {
      for (const [s, v] of variantLive.map) if (v.length >= off + 6) m.set(s, v.slice(off, off + 6));
    }
    return m;
  }, [variantEngine, variantLive.map, variantLive.done, variantLive.fullReady, safeMetric]);
  // 按引擎统一选源喂 CompCrossAnalysis。cross 视图 gate 在 crossReady(秒出),深阶段 gate 在 fullReady。
  const cxCrossMap = variantEngine === 'f2leo' ? f2leoCrossMap
    : variantEngine === 'variant' ? variantCrossMap
    : (variantEngine === 'std' ? crossA.map : EMPTY_MAP_TN);
  const cxReady = variantEngine === 'f2leo' ? f2leoLive.crossReady
    : variantEngine === 'variant' ? variantLive.crossReady
    : (variantEngine === 'std' ? crossA.ready : true);
  const cxStep: StepMapState = variantEngine === 'f2leo'
    ? { map: f2leoMetricMap, ready: f2leoLive.fullReady, done: f2leoLive.done, total: f2leoLive.total, error: f2leoLive.error }
    : variantEngine === 'variant'
      ? { map: variantMetricMap, ready: variantLive.fullReady, done: variantLive.done, total: variantLive.total, error: variantLive.error }
      : (variantEngine === 'std' ? stepLive : EMPTY_STEP);
  const cxStepUncovered = variantEngine === 'f2leo' ? f2leoScrambles.length
    : variantEngine === 'variant' ? variantScrambles.length
    : (variantEngine === 'std' ? stepUncovered.length : 0);
  // 逐行徽标取值(BADGE_ORDER 6 值),无数据 → undefined。
  const rowDigits = useCallback((scr: string, m: Metric): number[] | undefined => {
    const off = METRIC_OFFSET[m];
    // std cross 优先 JS 实时表(未收录比赛也有值);其余统一先查 comp_steps,再退引擎。
    if (variantEngine === 'std' && m === 'cross') { const d = crossA.map.get(scr); if (d) return d; }
    const pv = compSteps.map?.get(normScramble(scr));
    if (pv && pv.length >= off + 6) return pv.slice(off, off + 6);
    if (variantEngine === 'std' && m === safeMetric) return stepLive.map?.get(scr);
    if (variantEngine === 'f2leo') {
      const fv = f2leoLive.map?.get(scr);
      if (fv && fv.length >= off + 6) return fv.slice(off, off + 6);
    }
    if (variantEngine === 'variant') {
      const fv = variantLive.map?.get(scr);
      if (fv && fv.length >= off + 6) return fv.slice(off, off + 6);
    }
    return undefined;
  }, [variantEngine, crossA.map, compSteps.map, stepLive.map, f2leoLive.map, variantLive.map, safeMetric]);
  // 稳定引用:CompCrossAnalysis 把它当 sheets333,身份不稳会让上报 filter 的 effect
  // 每 render 都 fire → setState 循环。
  const sheetsInEvent = useMemo(
    () => (sheets ? sheets.filter((s) => s.event === activeView) : []),
    [sheets, activeView],
  );
  const roundIdxsInEvent = useMemo(
    () => Array.from(new Set(sheetsInEvent.map((s) => s.roundIdx))).sort((a, b) => a - b),
    [sheetsInEvent],
  );
  const activeRoundIdx = viewedRoundIdx !== null && roundIdxsInEvent.includes(viewedRoundIdx)
    ? viewedRoundIdx
    : roundIdxsInEvent[0] ?? null;
  const visibleSheets = useMemo(
    () => (activeRoundIdx === null ? sheetsInEvent : sheetsInEvent.filter((s) => s.roundIdx === activeRoundIdx)),
    [sheetsInEvent, activeRoundIdx],
  );
  // 分析范围:本轮(默认)只看当前轮,全部看该项目所有轮。决定分布面板口径 + 筛选范围。
  const analysisSheets = analysisAll ? sheetsInEvent : visibleSheets;
  // 十字筛选生效时(面板可见 + 选了某步):在分析范围内只留含命中打乱的 sheet,
  // 且每个 sheet 只保留命中打乱行(label 不变,保住真实打乱序号);否则照常显示当前轮。
  const activeCrossFilter = showCross && is333Family ? crossFilter : null;
  const sheetsToRender = useMemo(() => {
    if (!activeCrossFilter) return visibleSheets;
    return analysisSheets
      .map((sh) => ({ ...sh, attempts: sh.attempts.filter((a) => activeCrossFilter.scrambles.has(a.scramble)) }))
      .filter((sh) => sh.attempts.length > 0);
  }, [activeCrossFilter, analysisSheets, visibleSheets]);
  // icon 角标:多轮时显示当前轮次缩写 (1/2/3/F),提示再次点击会循环。
  const roundBadgeLabel = (idx: number): string => idx === 3 ? 'F' : `${idx + 1}`;
  const roundBadges = activeView && roundIdxsInEvent.length > 1 && activeRoundIdx !== null
    ? { [activeView]: roundBadgeLabel(activeRoundIdx) }
    : undefined;
  // 单击 event icon:不同 event → 切到该 event (轮次重置成第一);同一 event 再点 → 循环到下一轮。
  const onEventIconClick = (ev: string) => {
    if (ev === activeView && roundIdxsInEvent.length > 1) {
      const cur = activeRoundIdx === null ? -1 : roundIdxsInEvent.indexOf(activeRoundIdx);
      const nextIdx = roundIdxsInEvent[(cur + 1) % roundIdxsInEvent.length];
      setViewedRoundIdx(nextIdx);
      return;
    }
    setViewedEvent(ev);
  };

  const loaded = sheets && sheets.length > 0;
  const fmtKB = (b: number) => `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`;
  const placeholder = t('输入 WCA 比赛或链接,或自定义比赛名', 'Enter a WCA comp / link, or a custom name');

  // picker 三态:已加载真比赛 / mock 已生成(标题 readonly) / picker 输入态
  const compPickerNode = (
    <div
      className="gen-control-group"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && loadedCompId && !loaded) e.preventDefault();
      }}
    >
      {loadedCompId ? (
        <div className="gen-tn-comp-display">
          <Link
            href={`/wca/comp/${encodeURIComponent(loadedCompId)}`}
            className="gen-tn-comp-link"
            title={t('查看比赛成绩', 'View competition results')}
          >
            <CompCell compId={loadedCompId} compName={loadedCompName} isZh={isZh} />
          </Link>
          <ClearButton
            variant="standalone"
            onClick={reset}
            isZh={isZh}
            ariaLabel={t('取消比赛', 'Clear competition')}
            title={t('取消比赛', 'Clear competition')}
          />
        </div>
      ) : loaded ? (
        <input
          type="text"
          className="gen-tn-comp-input"
          value={compInput || `Scrambles for ${todayIso()}`}
          readOnly
          onChange={() => { /* readonly */ }}
        />
      ) : (
        <div className="gen-tn-comp-picker-row">
          <CompPicker
            className="gen-tn-comp-picker"
            value={compInput}
            onChange={setCompInput}
            onUrlPaste={(wcaId) => loadWca(wcaId)}
            onPick={onPickComp}
            isZh={isZh}
            placeholder={placeholder}
          />
          <button
            type="button"
            className="gen-btn gen-tn-comp-random"
            onClick={pickRandomComp}
            title={t('随机抽一场 WCA 比赛', 'Pick a random WCA competition')}
            aria-label={t('随机抽一场 WCA 比赛', 'Pick a random WCA competition')}
            disabled={loading}
          >
            <Dices size={14} />
          </button>
        </div>
      )}
    </div>
  );

  const controlsNode = (
    <div className={`gen-tn-controls${loaded ? ' is-loaded' : ''}`}>
      {!compHeaderSlot && compPickerNode}
      <div className="gen-control-group gen-control-actions">
          {loaded ? (
            // loadedCompId 模式下顶部 picker 已有 × 清除按钮,这里不再重复;
            // mock(loaded 但无 compId)模式顶部是 readonly 标题,需要 Edit3 回配置态。
            loadedCompId ? null : (
              <button
                type="button"
                className="gen-btn"
                onClick={reset}
                title={t('重新配置', 'Reconfigure')}
                aria-label={t('重新配置', 'Reconfigure')}
              >
                <Edit3 size={14} />
              </button>
            )
          ) : loading ? (
            <ProgressButton
              primary
              icon={<RefreshCw size={14} className="gen-spin" />}
              label={(() => {
                if (!loadProgress) return t('加载中…', 'Loading…');
                const { done, total } = loadProgress;
                if (total > 0) return `${fmtKB(done)} / ${fmtKB(total)}`;
                if (done > 0) return fmtKB(done);
                return t('加载中…', 'Loading…');
              })()}
              progress={loadProgress}
              onClick={() => { /* no-op while loading */ }}
              disabled
              title={t('加载打乱', 'Load scrambles')}
            />
          ) : (
            <ProgressButton
              primary
              icon={<RefreshCw size={14} className={generating ? 'gen-spin' : ''} />}
              label={generating
                ? <span className="gen-btn-progress-num">{`${genProgress?.done ?? 0}/${genProgress?.total ?? totalAttempts}`}</span>
                : t(`生成 (${totalAttempts})`, `Generate (${totalAttempts})`)}
              progress={genProgress}
              onClick={generate}
              disabled={enabledEvents.length === 0 || generating}
              title={t('生成打乱', 'Generate scrambles')}
            />
          )}
          <button
            type="button"
            className="gen-btn"
            onClick={onTogglePreview}
            title={showPreview ? t('隐藏打乱图', 'Hide preview') : t('显示打乱图', 'Show preview')}
            aria-label={showPreview ? t('隐藏打乱图', 'Hide preview') : t('显示打乱图', 'Show preview')}
            aria-pressed={!showPreview}
          >
            {showPreview ? <ImageIcon size={14} /> : <ImageOff size={14} />}
          </button>
          {loaded && (
            <ProgressButton
              icon={<Download size={14} className={pdfBuilding ? 'gen-spin' : ''} />}
              label={pdfBuilding
                ? <span className="gen-btn-progress-num">{`${pdfProgress?.done ?? 0}/${pdfProgress?.total ?? 1}`}</span>
                : ''}
              progress={pdfProgress}
              onClick={downloadPdf}
              disabled={pdfBuilding}
              title={t('下载 PDF (tnoodle 风格)', 'Download PDF (tnoodle style)')}
            />
          )}
          {!loadedCompId && (Object.keys(events).length > 0 || loaded || generating) && (
            <button
              type="button"
              className="gen-btn"
              onClick={() => {
                // 取消 in-flight 生成 + 清空 sheets + 清空 events,回到全空配置态。
                generateAbortRef.current = true;
                setSheets(null);
                setViewedEvent(null);
                setViewedRoundIdx(null);
                setEvents({});
              }}
              title={generating ? t('取消生成', 'Cancel generation') : t('清空所有项目', 'Clear all events')}
              aria-label={generating ? t('取消生成', 'Cancel generation') : t('清空所有项目', 'Clear all events')}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
  );

  return (
    <>
      {/* picker 提到 GenPage header (跟 chip 一行);slot 不可用就 fallback 回 body */}
      {compHeaderSlot ? createPortal(compPickerNode, compHeaderSlot) : null}

      {error && <div className="gen-tn-empty" style={{ color: 'var(--gen-accent)' }}>{error}</div>}

      {loaded ? (
        // ── 视图模式:已生成/加载,顶端 selector 单选,只能切视图 ──
        // sheets 里可能同时有 WCA + 非 WCA(cubing.js twizzleEvents),
        // 通过 appendEvents 同行 flex-wrap,不分两段。
        <WcaEventSelector
          availableEvents={new Set(eventsInSheets)}
          selectedEvent={activeView ?? undefined}
          onSelect={onEventIconClick}
          badges={roundBadges}
          appendEvents={TN_APPEND_EVENTS}
          collapsibleAppend
          onlyAvailable
          isZh={isZh}
        />
      ) : (
        // ── 配置模式:多选 toggle + 点击循环轮数(只有 mock 路径走到这里) ──
        <WcaEventSelector
          availableEvents={TNOODLE_EVENT_SET}
          onlyAvailable
          collapsibleAppend
          onExpandedChange={setOtherExpanded}
          selectedEvents={new Set(Object.keys(events))}
          badges={Object.fromEntries(Object.entries(events).map(([ev, cfg]) => [ev, cfg.rounds.length]))}
          onToggle={(ev) => {
            if (!events[ev]) {
              toggleEvent(ev);
            } else {
              const cur = events[ev].rounds.length;
              if (cur >= 4) toggleEvent(ev);
              else setRoundCount(ev, cur + 1);
            }
          }}
          onRemove={toggleEvent}
          appendEvents={TN_APPEND_EVENTS}
          isZh={isZh}
        />
      )}

      {/* 配置条:高阶 NxN(随「其他」展开) + 5x5 打乱模式(选了 5x5 才显),view 模式隐藏整块 */}
      {!loaded && (
        <div className="gen-tn-config-row">
          {otherExpanded && (
            <HighOrderNxNInput isZh={isZh} onAdd={addHighNxN} />
          )}
          <Scramble555ModePicker active555={!!events['555']} isZh={isZh} />
          <Scramble333ModePicker active333={!!events['333']} isZh={isZh} />
        </div>
      )}

      {/* 生成 / 预览 / 清空 按钮行 — 放在 selector + config 之后,events 列表之前 */}
      {controlsNode}

      {loaded ? null : enabledEvents.length === 0 ? (
        <div className="gen-tn-empty">{t('点击上方图标添加项目', 'Tap an event icon above to add it')}</div>
      ) : (
        <div className="gen-tn-event-list">
          {enabledEvents.map((ev) => {
            const cfg = events[ev];
            return (
              <div key={ev} className="gen-tn-event-card is-on">
                <div className="gen-tn-event-header gen-tn-event-header--static">
                  <EventIcon event={ev} />
                  <span className="gen-tn-event-name">{eventDisplayName(ev, isZh)}</span>
                  <button
                    type="button"
                    className="gen-tn-event-remove"
                    onClick={() => toggleEvent(ev)}
                    title={t('移除项目', 'Remove event')}
                    aria-label={t('移除项目', 'Remove event')}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="gen-tn-event-body">
                  {cfg.rounds.map((r, ri) => (
                    <div key={ri} className="gen-tn-round-row">
                      <span className="gen-tn-round-num">R{ri + 1}</span>
                      {allowedFormats(ev).length > 1 ? (
                        <select
                          className="gen-tn-format-select"
                          value={r.format}
                          onChange={(e) => updateRound(ev, ri, { format: e.target.value as WcaFormat })}
                        >
                          {allowedFormats(ev).map((f) => (
                            <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="gen-tn-format-static">{FORMAT_LABEL[r.format]}</span>
                      )}
                      <label className="gen-tn-mini-num">
                        <span>{t('组', 'Sets')}</span>
                        <NumberCommitInput
                          min={1} max={20}
                          value={r.scrambleSets}
                          onCommit={(n) => updateRound(ev, ri, { scrambleSets: n })}
                        />
                      </label>
                      <label className="gen-tn-mini-num">
                        <span>{t('份', 'Copies')}</span>
                        <NumberCommitInput
                          min={1} max={50}
                          value={r.copies}
                          onCommit={(n) => updateRound(ev, ri, { copies: n })}
                        />
                      </label>
                    </div>
                  ))}
                  {ev === '333fm' && cfg.rounds.map((r, ri) => (
                    <TranslationsPicker
                      key={`tx-${ri}`}
                      selected={r.locales ?? ['en']}
                      onChange={(next) => updateRound(ev, ri, { locales: next })}
                      isZh={isZh}
                    />
                  ))}
                  {(ev === '333mbf' || ev === '333mbo') && (
                    <div className="gen-tn-round-row">
                      <span className="gen-tn-round-num">{t('魔方', 'Cubes')}</span>
                      <NumberCommitInput
                        min={2} max={50}
                        className="gen-tn-mbld-cubes"
                        value={cfg.mbldCubes ?? 8}
                        onCommit={(n) => setMbldCubes(ev, n)}
                      />
                    </div>
                  )}
                  {ev === 'clock' && (
                    <ClockColorPicker
                      colors={cfg.colors}
                      onChange={(c) => setEventColors(ev, c)}
                      t={t}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loaded && activeView && (
        <>
          {is333Family && sheetsInEvent.length > 0 && (
            <div className="gen-cx-switchrow">
              <PillToggle
                value={showCross}
                onChange={setShowCross}
                onLabel={t('分析', 'Analysis')}
                offLabel={t('分析', 'Analysis')}
                ariaLabel={t('显示十字步数分析', 'Show cross analysis')}
              />
              {showCross && roundIdxsInEvent.length > 1 && (
                <PillToggle
                  value={analysisAll}
                  onChange={setAnalysisAll}
                  onLabel={t('全部', 'All')}
                  offLabel={t('本轮', 'This round')}
                  ariaLabel={t('分析范围', 'Analysis scope')}
                />
              )}
              {showCross && (
                <PillToggle
                  value={includeExtras}
                  onChange={setIncludeExtras}
                  onLabel={t('备打', 'Extras')}
                  offLabel={t('备打', 'Extras')}
                  ariaLabel={t('含备用打乱', 'Include extra scrambles')}
                />
              )}
              {showCross && (
                <label className="gen-cx-sel">
                  <span>{t('变体', 'Variant')}</span>
                  <select
                    className="gen-cx-modesel"
                    value={variant}
                    onChange={(e) => setVariant(e.target.value as VariantKey)}
                    aria-label={t('变体', 'Variant')}
                  >
                    {VARIANTS.map((v) => (
                      <option key={v.key} value={v.key}>{t(v.zh, v.en)}</option>
                    ))}
                  </select>
                </label>
              )}
              {showCross && (
                <label className="gen-cx-sel">
                  <span>{t('阶段', 'Stage')}</span>
                  <select
                    className="gen-cx-modesel"
                    value={safeMetric}
                    onChange={(e) => setMetric(e.target.value as Metric)}
                    aria-label={t('阶段', 'Stage')}
                  >
                    {vspec.stages.map((mk) => (
                      <option key={mk} value={mk}>{t(STAGE_LABEL[mk].zh, STAGE_LABEL[mk].en)}</option>
                    ))}
                  </select>
                </label>
              )}
              {showCross && (
                <div className="gen-cx-colorsel">
                  <select
                    className="gen-cx-modesel"
                    value={colorMode}
                    onChange={(e) => setColorMode(e.target.value as ColorMode)}
                    aria-label={t('底色模式', 'Bottom-colour mode')}
                  >
                    {COLOR_MODES.map((m) => (
                      <option key={m} value={m}>{t(MODE_LABEL[m].zh, MODE_LABEL[m].en)}</option>
                    ))}
                  </select>
                  <div className="gen-cx-swatches">
                    {colorMode === 'cn' && BADGE_LETTERS.map((c) => (
                      <i key={c} className={`gen-cx-sw ${CX_CLASS[c]}`} title={t(COLOR_NAME[c].zh, COLOR_NAME[c].en)} />
                    ))}
                    {colorMode === 'single' && BADGE_LETTERS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`gen-cx-swbtn${cxSingle === c ? ' is-on' : ''}`}
                        onClick={() => setCxSingle(c)}
                        title={t(COLOR_NAME[c].zh, COLOR_NAME[c].en)}
                      >
                        <i className={`gen-cx-sw ${CX_CLASS[c]}`} />
                      </button>
                    ))}
                    {colorMode === 'dual' && OPPOSITE_PAIRS.map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`gen-cx-swbtn${cxPair === i ? ' is-on' : ''}`}
                        onClick={() => setCxPair(i)}
                        title={p.map((c) => t(COLOR_NAME[c].zh, COLOR_NAME[c].en)).join(' / ')}
                      >
                        {p.map((c) => <i key={c} className={`gen-cx-sw ${CX_CLASS[c]}`} />)}
                      </button>
                    ))}
                    {colorMode === 'quad' && OPPOSITE_PAIRS.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`gen-cx-swbtn is-quad${cxQuadExcl === i ? ' is-on' : ''}`}
                        onClick={() => setCxQuadExcl(i)}
                        title={`${t('排除', 'Exclude')} ${OPPOSITE_PAIRS[i].map((c) => t(COLOR_NAME[c].zh, COLOR_NAME[c].en)).join('/')}`}
                      >
                        {BADGE_LETTERS.filter((c) => !OPPOSITE_PAIRS[i].includes(c)).map((c) => (
                          <i key={c} className={`gen-cx-sw ${CX_CLASS[c]}`} />
                        ))}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {is333Family && sheetsInEvent.length > 0 && showCross && (
            <CompCrossAnalysis sheets333={analysisSheets} crossMap={cxCrossMap} ready={cxReady} pre={compSteps} step={cxStep} stepUncoveredCount={cxStepUncovered} engineless={variantEngine === 'none'} includeExtras={includeExtras} metric={safeMetric} letters={cxLetters} onFilterChange={setCrossFilter} t={t} />
          )}
          <div className="gen-tn-sheets">
            {sheetsToRender.map((sh, i) => (
              <SheetView
                key={i}
                sheet={sh}
                isZh={isZh}
                t={t}
                showPreview={showPreview}
                rowDigits={showCross && is333Family ? rowDigits : undefined}
                metric={metric}
                variant={variant}
                clockColors={!loadedCompId && sh.event === 'clock' ? events[sh.event]?.colors : undefined}
                sq1Colors={!loadedCompId && sh.event === 'sq1' ? events[sh.event]?.colors : undefined}
                megaColors={!loadedCompId && sh.event === 'minx' ? events[sh.event]?.colors : undefined}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
