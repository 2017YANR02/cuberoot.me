/**
 * /scramble/gen — "Comp" mode: unified competition scramble sheet UX.
 * Single tab merges 模拟 + WCA paths:
 *   - 不填 / 自由文本 → 配置项目 + 轮数,点 生成 走 cubing/scramble 出随机打乱
 *   - 输入比赛或链接 → 自动加载 WCA 已公布打乱 (/v1/recon/wca-scrambles)
 * 两条路径共用 SheetView + PDF 管道。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { RefreshCw, Download, X, Trash2, Edit3, Image as ImageIcon, ImageOff, Shuffle } from 'lucide-react';
import { EventIcon } from '../../components/EventIcon';
import WcaEventSelector from '../../components/WcaEventSelector';
import NumberCommitInput from '../../components/NumberCommitInput';
import Scramble555ModePicker from '../../components/Scramble555ModePicker';
import Scramble333ModePicker from '../../components/Scramble333ModePicker';
import HighOrderNxNInput from '../../components/HighOrderNxNInput';
import { activeEventOf } from './active_view';
import { CompPicker } from '../../components/CompPicker';
import { CompCell } from '../../components/CompCell/CompCell';
import { ClearButton } from '../../components/ClearButton';
import { loadComps, isCancelledComp, type Comp } from '../../utils/comp_search';
import { loadFlagData, flagDataVersion } from '../../utils/country_flags';
import { localizeCompName } from '../../utils/comp_localize';
import { type WcaScrambleRow } from '../../utils/wca_results_api';
import { fetchCompName } from '../../utils/comp_wcif';
import { apiUrl } from '../../utils/api_base';
import { eventDisplayName } from '../../utils/wca_events';
import { TNOODLE_WCA_EVENTS, TWIZZLE_NONWCA_EVENTS, TWIZZLE_NONWCA_APPEND, tnoodleRandomScramble } from '../../utils/cubingScramble';
import { CSTIMER_NONWCA_APPEND, CSTIMER_EVENT_IDS, CSTIMER_EVENTS, cstimerScramble, isCstimerEvent } from '../../utils/cstimerScramble';
import { SHAPE_MOD_APPEND, SHAPE_MOD_EVENT_IDS, SHAPE_MOD_EVENTS, isShapeModEvent, shapeModSourceEvent } from '../../utils/shapeModScramble';

// 给 selector 当 availableEvents 用,涵盖 WCA + 非 WCA。
const TNOODLE_EVENT_SET = new Set<string>([...TNOODLE_WCA_EVENTS, ...TWIZZLE_NONWCA_EVENTS, ...CSTIMER_EVENT_IDS, ...SHAPE_MOD_EVENT_IDS]);
const TN_APPEND_EVENTS = [...TWIZZLE_NONWCA_APPEND, ...CSTIMER_NONWCA_APPEND, ...SHAPE_MOD_APPEND];
const CSTIMER_EVENT_ORDER: ReadonlyArray<string> = CSTIMER_EVENTS.map((e) => e.id);
const SHAPE_MOD_EVENT_ORDER: ReadonlyArray<string> = SHAPE_MOD_EVENTS.map((e) => e.id);
import {
  allowedFormats, FORMAT_LABEL, formatAttempts, DEFAULT_EXTRA_COUNT,
  defaultEventConfig, defaultRoundConfig,
  type EventConfig, type WcaFormat,
} from './wca_round';
import type { RoundSheetInput } from './tnoodle_pdf';
import ClockColorPicker from './ClockColorPicker';
import ProgressButton from './ProgressButton';
import TranslationsPicker from './TranslationsPicker';
import SheetView, { type AttemptScramble, type RoundSheet } from './SheetView';

const GENERATOR_TAG = 'TNoodle-WCA-1.2.3-port';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const urlComp = searchParams.get('comp') ?? '';

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

  // 随机挑一场已结束/未取消/有项目的真比赛(才有可能拿到已公布打乱)。
  // 用户拿到空打乱(loadWca 报"未找到") 时再点一下即可重摇。
  const pickRandomComp = async () => {
    const all = await loadComps().catch(() => [] as Comp[]);
    const today = new Date().toISOString().slice(0, 10);
    const candidates = all.filter((c) =>
      !isCancelledComp(c) &&
      (c.events?.length ?? 0) > 0 &&
      (c.end_date || c.start_date) < today
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
      const { generateTnoodlePdf } = await import('./tnoodle_pdf');
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
  const activeView = activeEventOf(viewedEvent, eventsInSheets);
  const sheetsInEvent = sheets ? sheets.filter((s) => s.event === activeView) : [];
  const roundIdxsInEvent = useMemo(
    () => Array.from(new Set(sheetsInEvent.map((s) => s.roundIdx))).sort((a, b) => a - b),
    [sheetsInEvent],
  );
  const activeRoundIdx = viewedRoundIdx !== null && roundIdxsInEvent.includes(viewedRoundIdx)
    ? viewedRoundIdx
    : roundIdxsInEvent[0] ?? null;
  const visibleSheets = activeRoundIdx === null
    ? sheetsInEvent
    : sheetsInEvent.filter((s) => s.roundIdx === activeRoundIdx);
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
            to={`/wca/comp/${encodeURIComponent(loadedCompId)}`}
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
            <Shuffle size={14} />
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
            <button
              type="button"
              className="gen-btn"
              onClick={reset}
              title={loadedCompId ? t('换一场比赛', 'Load another competition') : t('重新配置', 'Reconfigure')}
              aria-label={loadedCompId ? t('换一场比赛', 'Load another competition') : t('重新配置', 'Reconfigure')}
            >
              {loadedCompId ? <Trash2 size={14} /> : <Edit3 size={14} />}
            </button>
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
          <div className="gen-tn-sheets">
            {visibleSheets.map((sh, i) => (
              <SheetView
                key={i}
                sheet={sh}
                isZh={isZh}
                t={t}
                showPreview={showPreview}
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
