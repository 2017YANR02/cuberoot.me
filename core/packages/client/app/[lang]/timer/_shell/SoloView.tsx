'use client';

/**
 * SoloView — the redesigned Solo timer (Phase 1 shell).
 *
 * This is the LOGIC OWNER for the solo timer. It carries every hook / state /
 * handler / modal that previously lived in TimerPage.tsx (useTimer, useSettings,
 * scramble gen + warmup333, byEvent storage, bluetooth, stackmat, multistage,
 * bldMemo, all power modals, fullscreen, ?replay deep-link, import/export) —
 * NOTHING was removed. Only the *visual layout* (the JSX return) was rebuilt
 * into the new shell: topbar + TimingSurface + a docked side panel (desktop) /
 * bottom sheet (phone), with a distraction-free fade while running, pointer
 * input, and swipe shortcuts.
 *
 * The engine itself (_lib/useTimer + _lib/scramble + _lib/storage) is untouched.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryState, parseAsString } from 'nuqs';
import {
  Download, Upload, Trash2, Settings as SettingsIcon, Maximize2, Minimize2,
  Bluetooth, Mic, BarChart3, Plus, Wrench, ListPlus, Printer, FileText,
  FileSpreadsheet, AlertTriangle, Target, Crosshair, Keyboard, Link2, Globe,
  ListOrdered, LineChart, Brain, X, CheckCircle2, Footprints,
} from 'lucide-react';
import WcaEventSelector from '@/components/WcaEventSelector';
import { CubingIcon, EventIcon } from '@/components/EventIcon/EventIcon';
import CubeRootLogo from '@/components/CubeRootLogo';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { petReact } from '@/lib/deskpet';
import { type MoreMenuItem } from '../_components/MoreMenu';
import i18n, { syncLangToUrl } from '@/i18n/i18n-client';

import { generateScramble, registerScramble } from '../_lib/scramble';
import { peekWca, nextWca, prefetchWca, hasWcaSource, wcaMetaFor, type WcaSourceSpec } from '../_lib/scramble/wca_pool';
import { formatScrambleForEvent } from '@/lib/sq1-svg';
import { Flag } from '@/components/Flag';
import { compFlagIso2, loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { compSourceLine } from '@/lib/comp-schedule';
import { useAuthStore } from '@/lib/auth-store';
import { displayCuberName } from '@/lib/name-utils';
import { fetchMarks, addMark, markKey, type ScrambleMark } from '../_lib/marks';
import { getLastPickedCase, type TrainerKind } from '../_lib/scramble/training';
import { warmup333, randomState333Sync } from '../_lib/scramble/kociemba/random_state';
import { useTimer } from '../_lib/useTimer';
import { formatMs, bestSingle, bestAverageOfN, summarize } from '../_lib/stats';
import type { EventId, Penalty, Solve } from '../_lib/types';
import { EVENTS, isBldEvent } from '../_lib/types';
import {
  loadAll, saveAll, exportJson, importJson, makeSolve,
  importCstimerJson, exportCsv, exportSpeedstacks,
  listSessions, getActiveSessionId, moveSolveToSession,
} from '../_lib/storage/db';
import { formatTargetTime, useApplyTheme, useSettings } from '../_lib/settings';
import { warmupSound } from '../_lib/sound';
import { getMetronome } from '../_lib/sound/metronome';
import { useBluetoothCube } from '../_lib/bluetooth';
import { useAutoReady } from '../_lib/bluetooth/auto_ready';
import { useStackmat } from '../_lib/stackmat';
import { useMultiStage } from '../_lib/multistage';
import { useBldMemo } from '../_lib/useBldMemo';

import StatsPanel from '../_components/StatsPanel';
import CrossSessionStats from '../_components/CrossSessionStats';
import CaseStatsPanel from '../_components/CaseStatsPanel';
import HistoryPanel from '../_components/HistoryPanel';
import BldHelperModal from '../_components/BldHelperModal';
import SolveModal from '../_components/SolveModal';
import ReconstructModal from '../_components/ReconstructModal';
import { decodeReplayParam } from '../_lib/share/decode';
import { extractReplayParam } from '../_lib/share/paste_import';
import SettingsPanel from '../_components/SettingsPanel';
import GoalProgress from '../_components/GoalProgress';
import ShortcutsModal from '../_components/ShortcutsModal';
import BluetoothModal from '../_components/BluetoothModal';
import TrainerSubsetModal from '../_components/TrainerSubsetModal';
import StatsModal from '../_components/StatsModal';
import ManualEntryModal from '../_components/ManualEntryModal';
import SolverModal from '../_components/SolverModal';
import BulkScrambleModal from '../_components/BulkScrambleModal';
import DrillModal from '../_components/DrillModal';
import { generateDrillScramble, type DrillType } from '../_lib/scramble/drill';
import SolverHints from '../_components/SolverHints';
import { OLL_CASES } from '../_lib/scramble/algs/oll_cases';
import { PLL_CASES } from '../_lib/scramble/algs/pll_cases';
import HistogramChart from '../_components/charts/HistogramChart';
import TrendChart from '../_components/charts/TrendChart';
import ScatterChart from '../_components/charts/ScatterChart';
import HourChart from '../_components/charts/HourChart';
import PracticeHeatmap from '../_components/charts/PracticeHeatmap';
import { CubePreview } from '../_lib/cube';
import LiveCubeState from '../_components/LiveCubeState';

import TimingSurface from './TimingSurface';
import GestureWheel, { type GestureWheelHandle } from './GestureWheel';
import RankBadge from './RankBadge';
import SessionSwitcher from './SessionSwitcher';
import { useRankCountry } from '@/app/[lang]/timer/_shared/use-rank-country';

import '../timer.css';
import '../_components/charts/charts.css';
import '../_components/charts/practice_heatmap.css';
import './shell.css';
import { tr } from '@/i18n/tr';

const TRAINER_KINDS = new Set<EventId>(['oll', 'pll', 'coll', 'cmll', 'zbll', 'eg1', 'eg2']);

/** Max scrambles kept for ←/→ back/forward navigation. */
const SCRAMBLE_HISTORY_CAP = 50;

/** Timer EventIds that map to a real WCA event (drive WcaEventSelector
 *  active state). The rest render via appendEvents. */
const WCA_SELECTABLE = new Set<string>([
  '333', '222', '444', '555', '666', '777', '333oh', '333fm',
  '333bf', 'minx', 'pyram', 'clock', 'skewb', 'sq1', '444bf', '555bf', '333mbf',
]);

/** Non-WCA / training events surfaced in the picker as the "Other" append
 *  group. iconClass '' renders the textLabel. */
const APPEND_EVENTS: ReadonlyArray<{ id: string; iconClass: string; label?: string; textLabel?: string }> = [
  { id: '333ni',  iconClass: 'event-333bf', label: '3x3 NI / 三盲 NI' },
  { id: '333mr',  iconClass: '', textLabel: 'MR' },
  { id: '666bld', iconClass: '', textLabel: '6BLD' },
  { id: '777bld', iconClass: '', textLabel: '7BLD' },
  // magic / mmagic render in the main grid (they're in ALL_EVENT_IDS with
  // proper labels) — keeping them here too would duplicate under onlyAvailable.
  { id: 'r3',     iconClass: '', textLabel: 'R3' },
  { id: 'r4',     iconClass: '', textLabel: 'R4' },
  { id: 'r5',     iconClass: '', textLabel: 'R5' },
  { id: 'cross',  iconClass: '', textLabel: 'Cross' },
  { id: 'f2l',    iconClass: '', textLabel: 'F2L' },
  { id: 'll',     iconClass: '', textLabel: 'LL' },
  { id: 'oll',    iconClass: '', textLabel: 'OLL' },
  { id: 'pll',    iconClass: '', textLabel: 'PLL' },
  { id: 'coll',   iconClass: '', textLabel: 'COLL' },
  { id: 'cmll',   iconClass: '', textLabel: 'CMLL' },
  { id: 'zbll',   iconClass: '', textLabel: 'ZBLL' },
  { id: 'eg1',    iconClass: '', textLabel: 'EG-1' },
  { id: 'eg2',    iconClass: '', textLabel: 'EG-2' },
  { id: 'custom', iconClass: '', textLabel: 'Custom' },
];

/** Map a timer EventId -> the id the WcaEventSelector renders as active. */
function eventToSelectorId(ev: EventId): string {
  if (ev === '333bld') return '333bf';
  if (ev === '333mbld') return '333mbf';
  if (ev === '444bld') return '444bf';
  if (ev === '555bld') return '555bf';
  if (ev === 'mega') return 'minx';
  if (ev === 'pyra') return 'pyram';
  return ev;
}
/** Inverse: selector id -> timer EventId. */
function selectorIdToEvent(id: string): EventId {
  if (id === '333bf') return '333bld';
  if (id === '333mbf') return '333mbld';
  if (id === '444bf') return '444bld';
  if (id === '555bf') return '555bld';
  if (id === 'minx') return 'mega';
  if (id === 'pyram') return 'pyra';
  return id as EventId;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

type PanelTab = 'times' | 'chart' | 'tools';
type ChartKind = 'histogram' | 'trend' | 'scatter' | 'hour' | 'heatmap';

interface SoloViewProps {
  /** The players (人数) select node, injected by the shell at the topbar left. */
  playersControl?: React.ReactNode;
}

export default function SoloView({ playersControl }: SoloViewProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('计时器', 'Timer');
  const settings = useSettings();
  const rankCountry = useRankCountry();
  useApplyTheme();

  const isMobile = useMediaQuery('(max-width: 480px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  // Enlarged corner net (phone tap-to-enlarge).
  const [previewEnlarged, setPreviewEnlarged] = useState(false);

  // ── Side panel (desktop rail / phone bottom sheet) ──────────────
  const [panelTab, setPanelTab] = useState<PanelTab | null>(null);
  const [chartKind, setChartKind] = useState<ChartKind>('histogram');

  // ── State: per-event solve lists ────────────────────────────────
  const [byEvent, setByEvent] = useState<Record<string, Solve[]>>(() => {
    if (typeof window === 'undefined') return {};
    return loadAll();
  });
  // Skip the very first save (loadAll → saveAll round-trip is a no-op) and any
  // save triggered by a session switch (we just re-loaded the active session's
  // data; writing it straight back is harmless but pointless).
  const skipNextSaveRef = useRef(true);
  useEffect(() => {
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return; }
    saveAll(byEvent);
  }, [byEvent]);

  // Re-load the active session's solves after a session switch / clear / delete.
  // db.setActiveSession() has already persisted the new active id, so loadAll()
  // now returns that session's byEvent. Suppress the resulting save effect.
  const reloadActiveSession = useCallback(() => {
    skipNextSaveRef.current = true;
    setByEvent(loadAll());
    setLastPenalty(null);
  }, []);

  const [event, setEvent] = useState<EventId>(() => {
    if (typeof window === 'undefined') return '333';
    const stored = localStorage.getItem('cuberoot-timer.event');
    const valid = EVENTS.some(e => e.id === stored);
    return valid ? (stored as EventId) : '333';
  });
  useEffect(() => { localStorage.setItem('cuberoot-timer.event', event); }, [event]);

  const solves = useMemo(() => byEvent[event] ?? [], [byEvent, event]);

  // ── Kociemba warmup (3x3 random-state) ─────────────────────────
  const [kociembaReady, setKociembaReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    warmup333().then(() => {
      if (cancelled) return;
      registerScramble('333', () => randomState333Sync());
      registerScramble('333oh', () => randomState333Sync());
      registerScramble('333fm', () => randomState333Sync());
      setKociembaReady(true);
    }).catch(err => {
      console.error('[timer] kociemba warmup failed:', err);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Drill mode ──────────────────────────────────────────────────
  const [drillTarget, setDrillTarget] = useState<{ type: DrillType; id: string } | null>(null);
  const [drillModalOpen, setDrillModalOpen] = useState(false);
  const drillAllowed = ['333', '333oh', '333fm', 'oll', 'pll'].includes(event);
  useEffect(() => {
    if (!drillAllowed && drillTarget) setDrillTarget(null);
  }, [drillAllowed, drillTarget]);

  // ── Scramble (with back/forward history) ────────────────────────
  // A bounded ring of recently shown scrambles so ←/→ can revisit the
  // previous scramble or advance to the next. nextScramble() at the tip
  // generates a fresh one; in the middle it steps forward through history.
  // Changing event / drill target / kociemba-ready resets history to a single
  // fresh scramble (matches the old memo's regenerate-on-context-change).
  // The WCA source the pool should draw from, derived from settings. Kept in a
  // ref so the (stable-identity) scramble callbacks read the live value; the
  // `sig` string is the *meaningful* identity (excludes compName, which changes
  // per keystroke while typing in the comp picker) used as the reset trigger.
  // 难度过滤(date 模式)签名:开启且选了步数才生效,变了即重置打乱队列。
  const wcaDiffSig = settings.wcaDifficultyOn && settings.wcaDiffSteps.length > 0
    ? `${settings.wcaDiffVariant}:${settings.wcaDiffStage}:${settings.wcaDiffColors}:${[...settings.wcaDiffSteps].sort((a, b) => a - b).join('.')}`
    : '';
  const wcaSpec = useMemo<WcaSourceSpec>(() => ({
    event,
    mode: settings.wcaScrambleMode,
    comp: settings.wcaComp,
    compName: settings.wcaCompName,
    round: settings.wcaRound,
    group: settings.wcaGroup,
    from: settings.wcaDateFrom,
    to: settings.wcaDateTo,
    optimal: settings.wcaUseOptimal,
    diff: settings.wcaDifficultyOn && settings.wcaDiffSteps.length > 0
      ? { variant: settings.wcaDiffVariant, stage: settings.wcaDiffStage, colors: settings.wcaDiffColors, steps: settings.wcaDiffSteps }
      : undefined,
  }), [event, settings.wcaScrambleMode, settings.wcaComp, settings.wcaCompName, settings.wcaRound, settings.wcaGroup, settings.wcaDateFrom, settings.wcaDateTo, settings.wcaUseOptimal, settings.wcaDifficultyOn, settings.wcaDiffVariant, settings.wcaDiffStage, settings.wcaDiffColors, settings.wcaDiffSteps]);
  const wcaSpecRef = useRef(wcaSpec);
  wcaSpecRef.current = wcaSpec;
  const wcaSourceSig = settings.scrambleSource === 'wca'
    ? `${settings.wcaScrambleMode}|${settings.wcaComp}|${settings.wcaRound}|${settings.wcaGroup}|${settings.wcaDateFrom}|${settings.wcaDateTo}|${event}|${wcaDiffSig}`
    : 'random';

  const genScramble = useCallback((): string => {
    if (drillTarget && drillAllowed) {
      const ds = generateDrillScramble(drillTarget.type, drillTarget.id);
      if (ds) return ds.scramble;
    }
    // WCA real-scramble mode: take from the pool synchronously when available;
    // '' is a loading placeholder filled async by the effect below.
    if (settings.scrambleSource === 'wca' && hasWcaSource(wcaSpecRef.current)) {
      return peekWca(wcaSpecRef.current) ?? '';
    }
    return generateScramble(event);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillTarget, drillAllowed, event, settings.scrambleSource, wcaSourceSig]);

  const [scrambleHist, setScrambleHist] = useState<{ list: string[]; idx: number }>(
    () => ({ list: [genScramble()], idx: 0 }),
  );
  // Write-through ref so the nav callbacks read the latest history without a
  // stale closure and without re-creating themselves each push.
  const scrambleHistRef = useRef(scrambleHist);
  const applyScrambleHist = useCallback((next: { list: string[]; idx: number }) => {
    scrambleHistRef.current = next;
    setScrambleHist(next);
  }, []);
  const scramble = scrambleHist.list[scrambleHist.idx] ?? '';

  // WCA mode: an empty slot means the pool was momentarily dry — fetch a real
  // scramble and fill it in, showing a loading state until it lands.
  const [scrambleLoading, setScrambleLoading] = useState(false);
  useEffect(() => {
    if (scramble !== '' || settings.scrambleSource !== 'wca' || !hasWcaSource(wcaSpecRef.current)) {
      setScrambleLoading(false);
      return;
    }
    let cancelled = false;
    setScrambleLoading(true);
    void nextWca(wcaSpecRef.current).then((real) => {
      if (cancelled) return;
      setScrambleLoading(false);
      const cur = scrambleHistRef.current;
      if (cur.list[cur.idx] !== '') return;
      const list = [...cur.list];
      list[cur.idx] = real ?? generateScramble(event); // fetch failed / comp lacks event → fall back
      applyScrambleHist({ list, idx: cur.idx });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scramble, settings.scrambleSource, wcaSourceSig, applyScrambleHist]);

  // Warm the WCA pool ahead of demand (on source change / when mode turns on).
  useEffect(() => {
    if (settings.scrambleSource === 'wca') prefetchWca(wcaSpecRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.scrambleSource, wcaSourceSig]);
  // What the user sees/copies. SQ1 shows compact notation (4/-36/...) site-wide;
  // the raw canonical form stays in `scramble` for the solver hints / cube preview
  // (their parsers only accept `(a,b)/`). Other events pass through unchanged.
  const displayScramble = formatScrambleForEvent(event, scramble);

  // WCA mode: source of the current real scramble (comp / event / round / group),
  // shown under the strip the same way the landing page's RecentScrambles does.
  // Flag + comp name need the lazily-loaded comp index; bump flagVer when it lands.
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    if (settings.scrambleSource !== 'wca') return;
    void loadFlagData().then((v) => setFlagVer((cur) => (v !== cur ? v : cur)));
  }, [settings.scrambleSource]);
  const wcaSource = settings.scrambleSource === 'wca' && !scrambleLoading ? wcaMetaFor(scramble) : null;
  const wcaSrcDisplay = useMemo(() => {
    if (!wcaSource) return null;
    return {
      ci: wcaSource.ci,
      iso2: compFlagIso2(wcaSource.ci),
      name: localizeCompName(wcaSource.ci, wcaSource.cn, isZh),
      event: wcaSource.e,
      meta: compSourceLine(wcaSource.r, wcaSource.g, wcaSource.n, isZh, !!wcaSource.x),
    };
    // flagVer: re-derive flag + localized name once the comp index loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wcaSource, isZh, flagVer]);

  // ── 打卡:当前真实打乱的公开标记(谁做过这条打乱,纯展示)──────────
  // 标记由「做完自动打卡」负责(下方 effect);这里只读 + 弹层看名单。
  // 列表按 markKey 缓存(同会话内重看同一条不重拉)。
  const authUser = useAuthStore((st) => st.user);
  const [marksOpen, setMarksOpen] = useState(false);
  const [marksCache, setMarksCache] = useState<Record<string, { count: number; marks: ScrambleMark[] }>>({});
  const marksBoxRef = useRef<HTMLSpanElement | null>(null);
  const curMarkKey = wcaSource ? markKey(wcaSource) : null;
  const curMarks = curMarkKey ? marksCache[curMarkKey] : undefined;
  const myMark = !!(authUser && curMarks?.marks.some((m) => m.wcaId === authUser.wcaId));

  useEffect(() => {
    setMarksOpen(false);
    if (!wcaSource || !curMarkKey) return;
    if (marksCache[curMarkKey]) return;
    const key = curMarkKey, src = wcaSource;
    // 轻微防抖:快速连点「换打乱」时不为路过的打乱发请求。
    const t = window.setTimeout(() => {
      fetchMarks(src)
        .then((d) => setMarksCache((cur) => ({ ...cur, [key]: d })))
        .catch(() => { /* 读失败静默,chip 显示「标记」兜底 */ });
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curMarkKey]);

  // 点弹层外部关闭。
  useEffect(() => {
    if (!marksOpen) return;
    const onDown = (ev: PointerEvent) => {
      if (marksBoxRef.current && !marksBoxRef.current.contains(ev.target as Node)) setMarksOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [marksOpen]);


  // 做完一把真实打乱(非 DNF、已登录)后自动打卡 + 同步成绩。
  //   开关开(默认):无论标没标记都 upsert —— 省去每把手动点「标记已做」。
  //   开关关:只把成绩回填到「已经标记过」的打乱,不自动新建公开记录。
  // 按 event 记最后一条 solve 的签名,首次加载/切 event 只登记不触发;DNF 跳过。
  const lastSolveSigRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const s = solves[solves.length - 1];
    const sig = s ? `${s.id}|${s.timeMs}|${s.penalty}` : '';
    const prev = lastSolveSigRef.current[event];
    if (sig === prev) return;
    lastSolveSigRef.current[event] = sig;
    if (prev === undefined || !s || !authUser) return;
    if (s.penalty === 'DNF') return;
    const meta = wcaMetaFor(s.scramble);
    if (!meta) return;
    const key = markKey(meta);
    const alreadyMine = marksCache[key]?.marks.some((m) => m.wcaId === authUser.wcaId);
    if (!settings.autoMarkWcaScramble && !alreadyMine) return; // 关:不自动新建公开记录
    const timeCs = Math.round((s.timeMs + (s.penalty === '+2' ? 2000 : 0)) / 10);
    addMark(meta, timeCs, authUser.country || '')
      .then(() => fetchMarks(meta))
      .then((d) => setMarksCache((cur) => ({ ...cur, [key]: d })))
      .catch(() => { /* 网络失败静默,下次成绩变更再试 */ });
  }, [solves, event, authUser, marksCache, settings.autoMarkWcaScramble]);

  // Click-to-copy flash (cstimer-style). Reads the live scramble via ref so the
  // helper stays stable; shows a brief "已复制" badge.
  const [scrambleCopied, setScrambleCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  const copyScrambleFlash = useCallback(() => {
    const s = scrambleHistRef.current.list[scrambleHistRef.current.idx] ?? '';
    if (!s) return;
    try { void navigator.clipboard.writeText(formatScrambleForEvent(event, s)); } catch { /* ignore */ }
    setScrambleCopied(true);
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => setScrambleCopied(false), 1200);
  }, [event]);
  useEffect(() => () => { if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current); }, []);

  const nextScramble = useCallback(() => {
    const cur = scrambleHistRef.current;
    if (cur.idx < cur.list.length - 1) {
      applyScrambleHist({ list: cur.list, idx: cur.idx + 1 });
      return;
    }
    let list = [...cur.list, genScramble()];
    let idx = cur.idx + 1;
    if (list.length > SCRAMBLE_HISTORY_CAP) { list = list.slice(1); idx = list.length - 1; }
    applyScrambleHist({ list, idx });
  }, [genScramble, applyScrambleHist]);

  const prevScramble = useCallback(() => {
    const cur = scrambleHistRef.current;
    if (cur.idx <= 0) return;
    applyScrambleHist({ list: cur.list, idx: cur.idx - 1 });
  }, [applyScrambleHist]);

  // Reset history when the generation context changes. Skip the very first
  // mount run — the lazy initializer already produced the opening scramble.
  const scrambleResetRef = useRef(true);
  useEffect(() => {
    if (scrambleResetRef.current) { scrambleResetRef.current = false; return; }
    applyScrambleHist({ list: [genScramble()], idx: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genScramble, kociembaReady]);

  // ── Solve recording ─────────────────────────────────────────────
  const [lastPenalty, setLastPenalty] = useState<Penalty | null>(null);
  // Generic undo/info toast for swipe-delete etc.
  const [infoToast, setInfoToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const byEventRef = useRef(byEvent);
  useEffect(() => { byEventRef.current = byEvent; }, [byEvent]);
  const scrambleAtStartRef = useRef<string>(scramble);
  const eventAtStartRef = useRef<EventId>(event);
  const caseIdAtStartRef = useRef<string | null>(null);
  const movesRef = useRef<Array<{ m: string; ts: number }>>([]);
  const solveStartTsRef = useRef<number>(0);

  const isNxNEvent = ['222','333','444','555','666','777','333oh','333fm'].includes(event);
  const multiStageActive = settings.multiStage && isNxNEvent;
  const bldMemoActive = settings.bldMemo && isBldEvent(event);
  const multiStageRef = useRef<ReturnType<typeof useMultiStage> | null>(null);
  const bldMemoRef = useRef<ReturnType<typeof useBldMemo> | null>(null);

  const recordSolve = useCallback((res: { timeMs: number; inspectionMs: number; autoPenalty: 'ok' | '+2' | 'DNF' }) => {
    const ev = eventAtStartRef.current;
    const wasNxN = ['222','333','444','555','666','777','333oh','333fm'].includes(ev);
    const wasBld = isBldEvent(ev);
    const stages = (settings.multiStage && wasNxN)
      ? multiStageRef.current?.extractFinal(res.timeMs)
      : undefined;
    const bld = (settings.bldMemo && wasBld)
      ? bldMemoRef.current?.extractFinal()
      : undefined;
    const solve = makeSolve({
      timeMs: res.timeMs,
      scramble: scrambleAtStartRef.current,
      event: ev,
      penalty: res.autoPenalty,
    });
    if (stages) solve.stages = stages;
    if (bld) solve.bld = bld;
    if (caseIdAtStartRef.current) solve.caseId = caseIdAtStartRef.current;
    if (movesRef.current.length > 0) solve.moves = movesRef.current.slice();
    setLastPenalty(res.autoPenalty);

    // 破纪录(单次/Ao5/Ao12)时桌宠开心一下;不再弹横幅,纪录改在统计面板用 PR 标体现。
    {
      const before = byEventRef.current[ev] ?? [];
      const after = [...before, solve];
      const isNew = (b: number | null, a: number | null): boolean =>
        a !== null && Number.isFinite(a) && (b === null || !Number.isFinite(b) || a < b);
      if (isNew(bestAverageOfN(before, 12), bestAverageOfN(after, 12))
        || isNew(bestAverageOfN(before, 5), bestAverageOfN(after, 5))
        || isNew(bestSingle(before), bestSingle(after))) {
        petReact('happy');
      }
    }

    setByEvent(prev => ({ ...prev, [ev]: [...(prev[ev] ?? []), solve] }));
    if (res.autoPenalty === 'DNF') petReact('error');
    nextScramble();
  }, [nextScramble, settings.multiStage, settings.bldMemo, settings.precision]);

  const timer = useTimer(recordSolve);

  const multiStage = useMultiStage({ phase: timer.phase, displayMs: timer.displayMs, enabled: multiStageActive });
  useEffect(() => { multiStageRef.current = multiStage; }, [multiStage]);

  const bldMemo = useBldMemo({ phase: timer.phase, displayMs: timer.displayMs, enabled: bldMemoActive });
  useEffect(() => { bldMemoRef.current = bldMemo; }, [bldMemo]);

  useEffect(() => {
    if (timer.phase !== 'running') {
      scrambleAtStartRef.current = scramble;
      eventAtStartRef.current = event;
      caseIdAtStartRef.current = TRAINER_KINDS.has(event)
        ? getLastPickedCase(event as TrainerKind)
        : null;
    } else {
      movesRef.current = [];
      solveStartTsRef.current = performance.now();
    }
  }, [timer.phase, scramble, event]);

  // ── Bluetooth smart cube ────────────────────────────────────────
  const phaseSnapshotRef = useRef(timer.phase);
  useEffect(() => { phaseSnapshotRef.current = timer.phase; }, [timer.phase]);
  const consumeFacesRef = useRef<(faces: import('../_lib/cube/state').CubeFaces) => void>(() => {});
  useEffect(() => { consumeFacesRef.current = multiStage.consumeFromState; }, [multiStage.consumeFromState]);
  const bluetoothSubscribersRef = useRef<Set<(m: string, ts: number) => void>>(new Set());

  const [macPrompt, setMacPrompt] = useState<{ deviceName: string; isWrongKey?: boolean } | null>(null);
  const macResolverRef = useRef<((m: string | null) => void) | null>(null);
  const requestMac = useCallback((deviceName: string, isWrongKey?: boolean) => new Promise<string | null>((resolve) => {
    macResolverRef.current = resolve;
    setMacPrompt({ deviceName, isWrongKey });
  }), []);
  const resolveMac = useCallback((mac: string | null) => {
    macResolverRef.current?.(mac);
    macResolverRef.current = null;
    setMacPrompt(null);
  }, []);

  const bluetoothCube = useBluetoothCube({
    onMove: (move: string, ts: number) => {
      const faces = bluetoothCubeRef.current?.getFaces();
      if (faces) consumeFacesRef.current(faces);
      for (const sub of bluetoothSubscribersRef.current) {
        try { sub(move, ts); } catch (err) { console.error('[bt-broadcast]', err); }
      }
    },
    onSolved: () => {
      if (phaseSnapshotRef.current === 'running') timer.onPressDown();
    },
    onNeedMac: requestMac,
  });

  useAutoReady({
    enabled: settings.bluetoothAutoReady !== 'off' && bluetoothCube.status.connected,
    mode: settings.bluetoothAutoReady === 'double-flick' ? 'double-flick' : 'still',
    onReady: () => {
      const ph = timer.phase;
      if (ph === 'idle' || ph === 'inspecting' || ph === 'stopped') {
        warmupSound();
        timer.onPressDown();
      }
    },
    onMoveSubscriber: (cb) => {
      const subs = bluetoothSubscribersRef.current;
      subs.add(cb);
      return () => { subs.delete(cb); };
    },
  });
  const bluetoothCubeRef = useRef<typeof bluetoothCube | null>(null);
  useEffect(() => { bluetoothCubeRef.current = bluetoothCube; }, [bluetoothCube]);

  useEffect(() => {
    const subs = bluetoothSubscribersRef.current;
    const recorder = (m: string, ts: number) => {
      if (phaseSnapshotRef.current !== 'running') return;
      movesRef.current.push({ m, ts: ts - solveStartTsRef.current });
    };
    subs.add(recorder);
    return () => { subs.delete(recorder); };
  }, []);

  // ── Live cube-state mirror ──────────────────────────────────────
  const [liveMoves, setLiveMoves] = useState<string[]>([]);
  useEffect(() => { setLiveMoves([]); }, [scramble]);
  useEffect(() => {
    const subs = bluetoothSubscribersRef.current;
    const mirror = (m: string) => { setLiveMoves(prev => [...prev, m]); };
    subs.add(mirror);
    return () => { subs.delete(mirror); };
  }, []);

  // ── WCA inspection-phase move classification ───────────────────
  const [inspectionIllegalCount, setInspectionIllegalCount] = useState(0);
  const prevPhaseRef = useRef(timer.phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (timer.phase === 'inspecting' && prev !== 'inspecting' && prev !== 'holding') {
      setInspectionIllegalCount(0);
    }
    prevPhaseRef.current = timer.phase;
  }, [timer.phase]);
  useEffect(() => {
    const subs = bluetoothSubscribersRef.current;
    const inspector = (m: string) => {
      const ph = phaseSnapshotRef.current;
      if (ph !== 'inspecting' && ph !== 'holding' && ph !== 'ready') return;
      const trimmed = m.trim();
      if (!trimmed) return;
      if (/^[xyzXYZ][2']?$/.test(trimmed)) return;
      if (/[UDFBLRMESudfblr]/.test(trimmed)) setInspectionIllegalCount(c => c + 1);
    };
    subs.add(inspector);
    return () => { subs.delete(inspector); };
  }, []);

  // ── Stackmat ────────────────────────────────────────────────────
  const stackmatRecordRef = useRef<((ms: number) => void) | null>(null);
  stackmatRecordRef.current = (ms: number) => {
    const solve = makeSolve({ timeMs: ms, scramble: scrambleAtStartRef.current, event, penalty: 'ok' });
    setLastPenalty('ok');
    setByEvent(prev => ({ ...prev, [event]: [...(prev[event] ?? []), solve] }));
    nextScramble();
  };
  const stackmat = useStackmat({ onStop: (ms) => stackmatRecordRef.current?.(ms) });

  // ── Metronome ───────────────────────────────────────────────────
  useEffect(() => {
    const m = getMetronome();
    const active = settings.metronomeOn && (timer.phase === 'inspecting' || timer.phase === 'running');
    if (active) {
      if (!m.isRunning()) m.start(settings.metronomeBpm);
      else m.setBpm(settings.metronomeBpm);
    } else if (m.isRunning()) {
      m.stop();
    }
    return () => { m.stop(); };
  }, [settings.metronomeOn, settings.metronomeBpm, timer.phase]);

  // ── Press input wiring (pointer + mouse fallback) ───────────────
  const { onPressDown, onPressUp, reset, cancelArm } = timer;
  const solvesRef = useRef(solves);
  useEffect(() => { solvesRef.current = solves; }, [solves]);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const digitsRef = useRef<HTMLDivElement | null>(null);
  const touchActiveRef = useRef(false);
  const lastTouchEndTsRef = useRef(0);
  // Radial gesture tracking (idle/stopped, touch only) — cstimer-style dial.
  const swipeStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const swipeMovedRef = useRef(false);
  const gestureHitRef = useRef(-1);
  const gestureWheelRef = useRef<GestureWheelHandle | null>(null);

  const shouldIgnoreTimerTarget = useCallback((target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return target.closest('button, a, input, textarea, select, [contenteditable="true"], [data-no-timer]') !== null;
  }, []);

  // Stable ref to the 8 radial-gesture actions, indexed by direction
  // (0=right, then counter-clockwise: 1=up-right … 7=down-right). Populated
  // below once the solve mutators exist.
  const gestureActionsRef = useRef<Array<() => void>>([]);

  // Native pointer listeners with { passive: false } so preventDefault works
  // on iOS. Pointer events unify mouse/touch and (with touch-action:none in
  // CSS) eliminate the 300ms delay + synthetic double-fire. We keep the
  // shouldIgnoreTimerTarget guard verbatim. A movement threshold protects a
  // hold-to-arm from being eaten by a swipe.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const TAP_SLOP = 10;   // px wobble still counts as a press, not a drag
    const DEAD_ZONE = 44;  // px the drag must travel before a direction locks in

    const isIdleOrStopped = () => {
      const ph = phaseSnapshotRef.current;
      return ph === 'idle' || ph === 'stopped';
    };

    // Direction index from a drag delta: 0=right, then counter-clockwise
    // (matches GestureWheel's label order). -1 inside the dead-zone.
    const hitFor = (dx: number, dy: number): number => {
      if (Math.hypot(dx, dy) < DEAD_ZONE) return -1;
      const theta = -Math.atan2(dy, dx);
      return ((Math.floor((theta / Math.PI) * 4 + 8.5) % 8) + 8) % 8;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (shouldIgnoreTimerTarget(e.target)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      touchActiveRef.current = true;
      swipeMovedRef.current = false;
      gestureHitRef.current = -1;
      // Works for mouse too (cstimer is touch-only, but desktop mouse-drag is
      // non-conflicting: a plain click/hold still times — only a drag past
      // TAP_SLOP switches to gesture mode).
      const canGesture = isIdleOrStopped();
      swipeStartRef.current = canGesture
        ? { x: e.clientX, y: e.clientY, t: performance.now() }
        : null;
      if (canGesture) {
        const hasLast = solvesRef.current.length > 0;
        const canPrev = scrambleHistRef.current.idx > 0;
        // index: 0 next · 1 OK · 2 +2 · 3 DNF · 4 prev · 5 note · 6 del · 7 copy
        gestureWheelRef.current?.show(e.clientX, e.clientY,
          [true, hasLast, hasLast, hasLast, canPrev, hasLast, hasLast, true]);
      }
      warmupSound();
      onPressDown();
    };
    const handlePointerMove = (e: PointerEvent) => {
      const start = swipeStartRef.current;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const dist = Math.hypot(dx, dy);
      if (!swipeMovedRef.current && dist > TAP_SLOP) {
        // Crossed the tap-slop: this is a drag, not a hold. Soft-cancel the arm
        // so we never start the timer on a gesture — but keep the last result
        // on screen (reset() would blank it to 0.00).
        swipeMovedRef.current = true;
        touchActiveRef.current = false;
        cancelArm();
      }
      if (swipeMovedRef.current) {
        const hit = hitFor(dx, dy);
        gestureHitRef.current = hit;
        gestureWheelRef.current?.update(hit, Math.min(1, dist / DEAD_ZONE));
      }
    };
    const handlePointerUp = (e: PointerEvent) => {
      const start = swipeStartRef.current;
      swipeStartRef.current = null;
      if (start) gestureWheelRef.current?.hide();
      // Gesture path: a drag that already cancelled the arm.
      if (start && swipeMovedRef.current) {
        const hit = gestureHitRef.current;
        swipeMovedRef.current = false;
        gestureHitRef.current = -1;
        lastTouchEndTsRef.current = performance.now();
        if (hit >= 0) gestureActionsRef.current[hit]?.();
        return;
      }
      if (!touchActiveRef.current) return;
      e.preventDefault();
      touchActiveRef.current = false;
      lastTouchEndTsRef.current = performance.now();
      onPressUp();
    };
    const handlePointerCancel = () => {
      if (swipeStartRef.current) gestureWheelRef.current?.hide();
      swipeStartRef.current = null;
      swipeMovedRef.current = false;
      gestureHitRef.current = -1;
      if (!touchActiveRef.current) return;
      touchActiveRef.current = false;
      lastTouchEndTsRef.current = performance.now();
      onPressUp();
    };

    el.addEventListener('pointerdown', handlePointerDown, { passive: false });
    el.addEventListener('pointermove', handlePointerMove, { passive: false });
    el.addEventListener('pointerup', handlePointerUp, { passive: false });
    el.addEventListener('pointercancel', handlePointerCancel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [onPressDown, onPressUp, cancelArm, shouldIgnoreTimerTarget]);

  // Mouse handlers on the React node are now redundant (pointerdown covers
  // mouse) but kept as a no-op guard so child buttons stay isolated and we
  // never double-fire if a browser emits both. With touch-action:none +
  // pointer events the synthetic mouse path is suppressed; these stay inert.
  const onCenterMouseDown = useCallback((_e: ReactMouseEvent<HTMLDivElement>) => {}, []);
  const onCenterMouseUp = useCallback((_e: ReactMouseEvent<HTMLDivElement>) => {}, []);

  // ── Solve mutators ──────────────────────────────────────────────
  const updateSolve = useCallback((solveId: string, patch: Partial<Solve>) => {
    if (patch.penalty === 'DNF') petReact('error');
    setByEvent(prev => ({
      ...prev,
      [event]: (prev[event] ?? []).map(s => s.id === solveId ? { ...s, ...patch } : s),
    }));
  }, [event]);

  const deleteSolve = useCallback((solveId: string) => {
    setByEvent(prev => ({
      ...prev,
      [event]: (prev[event] ?? []).filter(s => s.id !== solveId),
    }));
  }, [event]);

  const changeLastPenalty = useCallback((p: Penalty) => {
    const last = solves[solves.length - 1];
    if (!last) return;
    updateSolve(last.id, { penalty: p });
    setLastPenalty(p);
  }, [solves, updateSolve]);

  // Swipe-delete: no confirm dialog (gesture intent is clear), restore via
  // the undo toast instead.
  const swipeDeleteLast = useCallback(() => {
    const last = solves[solves.length - 1];
    if (!last) return;
    const ev = event;
    deleteSolve(last.id);
    setLastPenalty(null);
    setInfoToast({
      msg: tr({ zh: '已删除最后一次成绩', en: 'Deleted last solve'
    }),
      undo: () => {
        setByEvent(prev => ({ ...prev, [ev]: [...(prev[ev] ?? []), last] }));
        setLastPenalty(last.penalty);
      },
    });
  }, [solves, event, deleteSolve, isZh]);

  const clearAll = useCallback(() => {
    if (!solves.length) return;
    const evName = EVENTS.find(e => e.id === event);
    if (!confirm((isZh
              ? `清空当前项目「${evName?.nameZh}」的所有 ${solves.length} 次成绩？`
              : `Clear all ${solves.length} solves of "${evName?.nameEn}"?`),
    )) return;
    setByEvent(prev => ({ ...prev, [event]: [] }));
    setLastPenalty(null);
  }, [event, isZh, solves.length]);

  // Penalties are now direct radial-gesture directions (↗ OK · ↑ +2 · ↖ DNF ·
  // ↓ delete), so the old swipe-up action sheet was removed. gestureActionsRef
  // is wired below, after the solve-detail modal state exists (note gesture).

  // ── Target-time (time-attack) ──────────────────────────────────
  const targetMs = useMemo<number | null>(() => {
    const v = settings.targetMsByEvent?.[event];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
  }, [settings.targetMsByEvent, event]);
  const isOvershot = timer.phase === 'running' && targetMs !== null && timer.displayMs > targetMs;
  const [stopPulse, setStopPulse] = useState<'good' | 'bad' | null>(null);
  const prevTimerPhaseRef = useRef(timer.phase);
  useEffect(() => {
    const prev = prevTimerPhaseRef.current;
    if (timer.phase === 'stopped' && prev !== 'stopped' && targetMs !== null && Number.isFinite(timer.displayMs)) {
      setStopPulse(timer.displayMs <= targetMs ? 'good' : 'bad');
      const handle = window.setTimeout(() => setStopPulse(null), 1000);
      prevTimerPhaseRef.current = timer.phase;
      return () => window.clearTimeout(handle);
    }
    prevTimerPhaseRef.current = timer.phase;
  }, [timer.phase, timer.displayMs, targetMs]);

  // ── Modals ──────────────────────────────────────────────────────
  const [modalSolve, setModalSolve] = useState<{ s: Solve; idx: number } | null>(null);
  const [reconstructSolve, setReconstructSolve] = useState<Solve | null>(null);

  // Gesture: open the last solve's detail (to add a note / comment).
  const commentLast = useCallback(() => {
    const cur = solvesRef.current;
    const last = cur[cur.length - 1];
    if (!last) return;
    setModalSolve({ s: last, idx: cur.length - 1 });
  }, []);

  // Wire the 8 radial-gesture directions (0=right, then counter-clockwise).
  // Each action is a no-op when its target is absent, so disabled directions
  // (greyed on the wheel) are also safe to fire.
  useEffect(() => {
    gestureActionsRef.current = [
      nextScramble,                                                  // 0 → next scramble
      () => changeLastPenalty('ok'),                                 // 1 ↗ OK
      () => changeLastPenalty(lastPenalty === '+2' ? 'ok' : '+2'),   // 2 ↑ +2
      () => changeLastPenalty(lastPenalty === 'DNF' ? 'ok' : 'DNF'), // 3 ↖ DNF
      prevScramble,                                                  // 4 ← prev scramble
      commentLast,                                                   // 5 ↙ note
      swipeDeleteLast,                                               // 6 ↓ delete last
      copyScrambleFlash,                                             // 7 ↘ copy scramble
    ];
  }, [nextScramble, prevScramble, changeLastPenalty, lastPenalty, commentLast, swipeDeleteLast, copyScrambleFlash]);

  // ?replay= is a consume-once deep link: decode it into an ephemeral solve, open
  // the reconstruct modal, then strip the param. nuqs owns it (replace — clearing
  // a transient deep link should not push history); the hash is left untouched
  // automatically. After setReplay(null) the param is gone and this re-run early
  // returns (consume-once).
  const [replay, setReplay] = useQueryState('replay', parseAsString.withOptions({ history: 'replace' }));
  useEffect(() => {
    if (!replay) return;
    const decoded = decodeReplayParam(replay);
    if (!decoded) {
      console.warn('[timer] invalid ?replay= payload');
    } else {
      const ephemeral: Solve = {
        id: `replay-${Date.now()}`,
        timeMs: decoded.totalMs,
        penalty: 'ok',
        scramble: decoded.scramble,
        event: decoded.event,
        ts: Date.now(),
        moves: decoded.moves.length > 0 ? decoded.moves : undefined,
      };
      setReconstructSolve(ephemeral);
    }
    void setReplay(null);
  }, [replay, setReplay]);

  const handlePasteReplay = useCallback(() => {
    const raw = window.prompt(tr({ zh: '粘贴 replay URL 或 token：', en: 'Paste a replay URL or token:'
    }), '');
    if (raw === null) return;
    const param = extractReplayParam(raw);
    if (!param) { alert(tr({ zh: '未识别为 replay URL。', en: 'Not a recognizable replay URL.'
    })); return; }
    const decoded = decodeReplayParam(param);
    if (!decoded) { alert(tr({ zh: 'replay 数据无法解码。', en: 'Failed to decode replay payload.'
    })); return; }
    const ephemeral: Solve = {
      id: `replay-${Date.now()}`,
      timeMs: decoded.totalMs,
      penalty: 'ok',
      scramble: decoded.scramble,
      event: decoded.event,
      ts: Date.now(),
      moves: decoded.moves.length > 0 ? decoded.moves : undefined,
    };
    setReconstructSolve(ephemeral);
  }, [isZh]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [bluetoothOpen, setBluetoothOpen] = useState(false);
  const [trainerSubsetOpen, setTrainerSubsetOpen] = useState<'oll' | 'pll' | null>(null);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [solverOpen, setSolverOpen] = useState(false);
  const [bulkScrambleOpen, setBulkScrambleOpen] = useState(false);
  const [bldHelperOpen, setBldHelperOpen] = useState(false);
  const [showCrossSession, setShowCrossSession] = useState(false);

  // ── Fullscreen ──────────────────────────────────────────────────
  const [fullscreen, setFullscreen] = useState(false);
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
        setFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setFullscreen(false);
      }
    } catch { /* needs gesture */ }
  }, []);
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────
  const phaseRef = useRef(timer.phase);
  useEffect(() => { phaseRef.current = timer.phase; }, [timer.phase]);
  const anyModalOpen =
    settingsOpen || shortcutsOpen || bluetoothOpen ||
    trainerSubsetOpen !== null || statsModalOpen ||
    manualEntryOpen || solverOpen || bulkScrambleOpen ||
    drillModalOpen || bldHelperOpen ||
    modalSolve !== null || reconstructSolve !== null;
  const anyModalOpenRef = useRef(anyModalOpen);
  useEffect(() => { anyModalOpenRef.current = anyModalOpen; }, [anyModalOpen]);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (anyModalOpenRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      // Holding Space auto-repeats keydown; swallow the page-scroll default on
      // every repeat, but only arm the timer once (first non-repeat keydown).
      if (e.code === 'Space') { e.preventDefault(); if (e.repeat) return; warmupSound(); onPressDown(); return; }
      if (e.repeat) return;
      if (e.code === 'Escape') { reset(); return; }
      const ph = phaseRef.current;
      if (ph === 'running' && multiStageActive) {
        if (e.code === 'Digit1' && !e.shiftKey && !e.ctrlKey && !e.metaKey) { multiStageRef.current?.markStage('cross'); return; }
        if (e.code === 'Digit2' && !e.shiftKey && !e.ctrlKey && !e.metaKey) { multiStageRef.current?.markStage('f2l'); return; }
        if (e.code === 'Digit3' && !e.shiftKey && !e.ctrlKey && !e.metaKey) { multiStageRef.current?.markStage('oll'); return; }
      }
      if (ph === 'running' && bldMemoActive && e.code === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); bldMemoRef.current?.markMemo(); return;
      }
      if (ph === 'holding' || ph === 'ready' || ph === 'running' || ph === 'inspecting') return;
      const cur = solvesRef.current;
      const last = cur[cur.length - 1];
      if (e.code === 'KeyZ' && !e.ctrlKey && !e.metaKey) {
        if (last) { deleteSolve(last.id); setLastPenalty(null); }
        return;
      }
      if (e.code === 'Digit2' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (last) { const p: Penalty = last.penalty === '+2' ? 'ok' : '+2'; updateSolve(last.id, { penalty: p }); setLastPenalty(p); }
        return;
      }
      if (e.code === 'KeyD' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        if (last) { const p: Penalty = last.penalty === 'DNF' ? 'ok' : 'DNF'; updateSolve(last.id, { penalty: p }); setLastPenalty(p); }
        return;
      }
      const m = e.code.match(/^Digit([1-9])$/);
      if (m && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const n = Number(m[1]);
        const idx = cur.length - n;
        if (idx >= 0) setModalSolve({ s: cur[idx], idx });
        return;
      }
      if (e.code === 'Comma') { nextScramble(); return; }
      if (e.code === 'ArrowLeft') { e.preventDefault(); prevScramble(); return; }
      if (e.code === 'ArrowRight') { e.preventDefault(); nextScramble(); return; }
      if (e.code === 'KeyF') { toggleFullscreen(); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (anyModalOpenRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.code === 'Space') { e.preventDefault(); onPressUp(); }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onPressDown, onPressUp, reset, updateSolve, deleteSolve, nextScramble, prevScramble, toggleFullscreen, multiStageActive, bldMemoActive]);

  // ── Import / export ─────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const json = exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `cuberoot-timer-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }, []);
  const handleExportCsv = useCallback(() => {
    const csv = exportCsv(byEvent);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `cuberoot-timer-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [byEvent]);
  const handleExportSs = useCallback(() => {
    const txt = exportSpeedstacks(solves);
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `cuberoot-timer-${event}-${new Date().toISOString().slice(0, 10)}.ss.txt`; a.click();
    URL.revokeObjectURL(url);
  }, [event, solves]);
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.txt';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result);
        if (importJson(text)) { setByEvent(loadAll()); return; }
        const cs = importCstimerJson(text);
        if (cs) {
          setByEvent(prev => {
            const merged = { ...prev };
            for (const [evId, list] of Object.entries(cs)) {
              merged[evId] = [...(merged[evId] ?? []), ...list].sort((a, b) => a.ts - b.ts);
            }
            return merged;
          });
          alert((isZh ? `从 cstimer 导入了 ${Object.values(cs).reduce((n, l) => n + l.length, 0)} 次成绩。` : `Imported ${Object.values(cs).reduce((n, l) => n + l.length, 0)} solves from cstimer.`));
          return;
        }
        alert(tr({ zh: '导入失败：文件格式无效。', en: 'Import failed: invalid file.'
        }));
      };
      reader.readAsText(file);
    };
    input.click();
  }, [isZh]);

  // ── More menu items ─────────────────────────────────────────────
  const moreItems = useMemo<MoreMenuItem[]>(() => [
    ...(isMobile ? [
      {
        icon: <Mic size={14} />,
        label: stackmat.status.listening
          ? tr({ zh: 'Stackmat 监听中（点击停止）', en: 'Stackmat listening (stop)'
                    })
          : tr({ zh: '启用 Stackmat（麦克风）', en: 'Enable Stackmat (mic)'
                    }),
        onClick: async () => {
          if (stackmat.status.listening) stackmat.stop();
          else {
            try { await stackmat.start(); }
            catch (err) { alert((isZh ? `麦克风启用失败：${(err as Error).message}` : `Mic error: ${(err as Error).message}`)); }
          }
        },
      },
      { icon: <BarChart3 size={14} />, label: tr({ zh: '统计', en: 'Stats'
    }), onClick: () => setStatsModalOpen(true) },
      {
        icon: <Globe size={14} />, label: tr({ zh: '语言：EN', en: 'Language: 中文'
        }),
        onClick: () => { const next = (i18n.language.startsWith('zh') ? 'en' : 'zh'); i18n.changeLanguage(next); syncLangToUrl(next); },
      },
    ] : []),
    ...(drillAllowed && !drillTarget ? [{
      icon: <Crosshair size={14} />, label: tr({ zh: '专项练习', en: 'Drill mode'
    }), onClick: () => setDrillModalOpen(true),
    }] : []),
    ...(event.startsWith('333') ? [{
      icon: <Brain size={14} />, label: tr({ zh: '盲拧助手', en: 'BLD helper'
    }), onClick: () => setBldHelperOpen(true),
    }] : []),
    { icon: <Keyboard size={14} />, label: tr({ zh: '快捷键', en: 'Shortcuts'
    }), onClick: () => setShortcutsOpen(true) },
    { icon: fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />, label: tr({ zh: '全屏', en: 'Fullscreen' }), onClick: toggleFullscreen },
    { icon: <Bluetooth size={14} />, label: tr({ zh: '智能魔方', en: 'Smart cube'
    }), onClick: () => setBluetoothOpen(true) },
    { icon: <Upload size={14} />, label: tr({ zh: '导入（自动识别 cstimer JSON）', en: 'Import (auto-detects cstimer JSON)'
    }), onClick: handleImport },
    { icon: <Download size={14} />, label: tr({ zh: '导出 JSON', en: 'Export JSON'
    }), onClick: handleExport },
    { icon: <FileSpreadsheet size={14} />, label: tr({ zh: '导出 CSV', en: 'Export CSV'
    }), onClick: handleExportCsv },
    { icon: <FileText size={14} />, label: tr({ zh: '导出 Speedstacks', en: 'Export Speedstacks'
    }), onClick: handleExportSs },
    { icon: <Plus size={14} />, label: tr({ zh: '手动录入', en: 'Manual entry'
    }), onClick: () => setManualEntryOpen(true) },
    { icon: <Link2 size={14} />, label: tr({ zh: '粘贴 replay 链接', en: 'Paste replay URL'
    }), onClick: handlePasteReplay },
    { icon: <Wrench size={14} />, label: tr({ zh: '通用求解器', en: 'Solver' }), onClick: () => setSolverOpen(true) },
    { icon: <ListPlus size={14} />, label: tr({ zh: '批量打乱', en: 'Bulk scrambles'
    }), onClick: () => setBulkScrambleOpen(true) },
    { icon: <Printer size={14} />, label: tr({ zh: '打印', en: 'Print'
    }), onClick: () => window.print() },
    { icon: <Trash2 size={14} />, label: tr({ zh: '清空当前项目', en: 'Clear current event'
    }), onClick: clearAll, danger: true, disabled: !solves.length },
  ], [isZh, handleImport, handleExport, handleExportCsv, handleExportSs, clearAll, solves.length, drillAllowed, drillTarget, fullscreen, toggleFullscreen, handlePasteReplay, isMobile, stackmat, i18n, event]);

  const allSolves = useMemo(() => {
    const out: Solve[] = [];
    for (const list of Object.values(byEvent)) out.push(...list);
    return out;
  }, [byEvent]);

  // ── Derived display (digits text + color class) ─────────────────
  const stats = useMemo(() => summarize(solves), [solves]);
  const inspectionLimit = settings.inspection;
  const colorClass = useMemo(() => {
    if (timer.phase === 'holding') return 'holding';
    if (timer.phase === 'ready') return 'ready';
    if (timer.phase === 'running') return 'running';
    if (timer.phase === 'inspecting') {
      const sec = Math.floor(timer.inspectionDisplayMs / 1000);
      if (sec >= inspectionLimit + 2) return 'inspection-dnf';
      if (sec >= inspectionLimit) return 'inspection-plus2';
      if (sec >= 12) return 'inspection-warn-12';
      if (sec >= 8) return 'inspection-warn-8';
      return 'inspection';
    }
    if (timer.phase === 'stopped' && lastPenalty === 'DNF') return 'dnf';
    return '';
  }, [timer.phase, timer.inspectionDisplayMs, inspectionLimit, lastPenalty]);

  const digitsText = useMemo(() => {
    if (timer.phase === 'inspecting') {
      const remaining = Math.max(0, Math.ceil((inspectionLimit * 1000 - timer.inspectionDisplayMs) / 1000));
      if (timer.inspectionDisplayMs > inspectionLimit * 1000 + 2000) return 'DNF';
      if (timer.inspectionDisplayMs > inspectionLimit * 1000) return '+2';
      return remaining.toString();
    }
    if (timer.phase === 'running') {
      return settings.hideTime ? '…' : formatMs(timer.displayMs, settings.runningPrecision);
    }
    if (timer.phase === 'stopped' && lastPenalty === 'DNF') return 'DNF';
    if (timer.phase === 'stopped' && lastPenalty === '+2') return formatMs(timer.displayMs + 2000, settings.precision) + '+';
    return formatMs(timer.displayMs, settings.precision);
  }, [timer.phase, timer.inspectionDisplayMs, timer.displayMs, inspectionLimit, lastPenalty, settings.hideTime, settings.precision, settings.runningPrecision]);

  const fontSize = `calc(clamp(64px, 14vw, 192px) * ${settings.timerFontScale})`;

  // Rank badge centis from the last effective time (DNF -> null).
  const stoppedCentis = useMemo<number | null>(() => {
    if (timer.phase !== 'stopped') return null;
    if (lastPenalty === 'DNF' || !Number.isFinite(timer.displayMs)) return null;
    const ms = lastPenalty === '+2' ? timer.displayMs + 2000 : timer.displayMs;
    return Math.round(ms / 10);
  }, [timer.phase, timer.displayMs, lastPenalty]);

  const eventInfoCurrent = EVENTS.find(e => e.id === event);
  const printEventName = eventInfoCurrent ? ((isZh ? eventInfoCurrent.nameZh : eventInfoCurrent.nameEn)) : event;
  const eventLabel = eventInfoCurrent ? ((isZh ? eventInfoCurrent.nameZh : eventInfoCurrent.nameEn)) : event;

  // Available set for the selector: every WCA id we map to + the append ids +
  // magic/mmagic (rendered in the main grid via ALL_EVENT_IDS, not appended).
  // With onlyAvailable the selector renders ONLY this set, so 333ft / 333mbo
  // (never timer events) are dropped instead of showing as stray disabled icons.
  const availableEvents = useMemo(() => new Set<string>([
    ...WCA_SELECTABLE, 'magic', 'mmagic', ...APPEND_EVENTS.map(e => e.id),
  ]), []);
  const selectorActiveId = eventToSelectorId(event);
  // Trigger shows the event icon (same mapping the grid uses). Non-WCA training
  // events without an icon (Cross / OLL / Custom…) fall back to their text label.
  const triggerAppend = APPEND_EVENTS.find(e => e.id === event);
  const triggerIcon = triggerAppend
    ? (triggerAppend.iconClass || null)
    : `event-${selectorActiveId}`;

  // Picker dropdown open state (the topbar event pill opens the icon grid).
  const [eventPickerOpen, setEventPickerOpen] = useState(false);

  const distractionFree = timer.phase === 'running' && !prefersReducedMotion;

  const togglePanel = useCallback((tab: PanelTab) => {
    setPanelTab(prev => (prev === tab ? null : tab));
  }, []);

  // Auto-dismiss the info toast.
  useEffect(() => {
    if (!infoToast) return;
    const h = window.setTimeout(() => setInfoToast(null), 5000);
    return () => window.clearTimeout(h);
  }, [infoToast]);

  // ── Side-panel body ─────────────────────────────────────────────
  const renderPanelBody = () => {
    if (panelTab === 'times') {
      return (
        <>
          <SessionSwitcher isZh={isZh} onSessionsChanged={reloadActiveSession} />
          <div className="shell-panel-statgrid">
            <StatsPanel solves={solves} isZh={isZh} event={event} />
            <CaseStatsPanel event={event} solves={solves} isZh={isZh} />
          </div>
          {/* 历史紧贴当前/最佳统计下方 (cstimer 式);完整统计 / 跨分组统计等次级入口移到列表之后。 */}
          <HistoryPanel
            solves={solves}
            isZh={isZh}
            aoWindows={settings.statsAoWindows}
            onRowClick={(s, idx) => setModalSolve({ s, idx })}
            onQuickPenalty={(id, p) => updateSolve(id, { penalty: p })}
            onQuickDelete={(id) => deleteSolve(id)}
            onQuickComment={(s, idx) => setModalSolve({ s, idx })}
          />
          <div className="shell-times-actions">
            <button type="button" className="stats-expand-toggle" onClick={() => setStatsModalOpen(true)}>
              {tr({ zh: '完整统计', en: 'Full stats'
            })}
            </button>
            <button type="button" className="stats-expand-toggle" onClick={() => setShowCrossSession(v => !v)}>
              {tr({ zh: '跨分组统计', en: 'Cross-session'
            })} {showCrossSession ? '▴' : '▾'}
            </button>
          </div>
          {showCrossSession && <CrossSessionStats event={event} isZh={isZh} />}
        </>
      );
    }
    if (panelTab === 'chart') {
      return (
        <div className="shell-chart-tab">
          <div className="shell-chart-switch">
            {([
              ['histogram', tr({ zh: '分布', en: 'Histogram'
            })],
              ['trend', tr({ zh: '趋势', en: 'Trend'
            })],
              ['scatter', tr({ zh: '散点', en: 'Scatter'
            })],
              ['hour', tr({ zh: '时段', en: 'Hour'
            })],
              ['heatmap', tr({ zh: '日历', en: 'Heatmap'
            })],
            ] as const).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                className={`shell-chart-chip${chartKind === k ? ' active' : ''}`}
                onClick={() => setChartKind(k as ChartKind)}
              >{lbl}</button>
            ))}
          </div>
          <div className="shell-chart-canvas">
            {chartKind === 'histogram' && <HistogramChart solves={solves} isZh={isZh} width={300} height={150} />}
            {chartKind === 'trend' && <TrendChart solves={solves} isZh={isZh} width={300} height={170} />}
            {chartKind === 'scatter' && <ScatterChart solves={solves} isZh={isZh} width={300} height={170} />}
            {chartKind === 'hour' && <HourChart solves={solves} isZh={isZh} width={300} height={150} />}
            {chartKind === 'heatmap' && <PracticeHeatmap solves={solves} isZh={isZh} cellSize={11} />}
          </div>
        </div>
      );
    }
    // tools
    return (
      <div className="shell-tools-list">
        {moreItems.map((it, i) => (
          <button
            key={i}
            type="button"
            className={`shell-tools-item${it.danger ? ' danger' : ''}`}
            disabled={it.disabled}
            onClick={() => { if (!it.disabled) it.onClick(); }}
          >
            {it.icon && <span className="shell-tools-icon">{it.icon}</span>}
            <span>{it.label}</span>
          </button>
        ))}
        <button type="button" className="shell-tools-item" onClick={() => setSettingsOpen(true)}>
          <span className="shell-tools-icon"><SettingsIcon size={14} /></span>
          <span>{tr({ zh: '设置', en: 'Settings'
        })}</span>
        </button>
      </div>
    );
  };

  return (
    <div
      className={`timer-shell${fullscreen ? ' fullscreen' : ''}${distractionFree ? ' is-solving' : ''}${isDesktop && panelTab ? ' panel-open' : ''}`}
      data-solving={timer.phase === 'running' ? 'true' : undefined}
    >
      <div className="print-only-header">
        <h1>{tr({ zh: '魔方计时器 — ', en: 'Cube Timer — '
        })}{printEventName}</h1>
        <div className="print-meta"><span>{new Date().toLocaleString()}</span><span>{solves.length} {tr({ zh: '次', en: 'solves' })}</span></div>
      </div>

      {/* ── Topbar ──────────────────────────────────────────── */}
      <header className="shell-topbar surface-chrome">
        <CubeRootLogo className="shell-topbar-brand" />
        <div className="shell-topbar-left">
          {playersControl}
          <div className="shell-event-pick">
            <button
              type="button"
              className={`shell-event-btn${triggerIcon ? ' icon-only' : ''}`}
              onClick={() => setEventPickerOpen(o => !o)}
              aria-expanded={eventPickerOpen}
              aria-label={eventLabel}
              title={eventLabel}
            >
              {triggerIcon
                ? <CubingIcon icon={triggerIcon} />
                : <span className="shell-event-label">{eventLabel}</span>}
            </button>
            {eventPickerOpen && (
              <>
                <div className="shell-event-backdrop" onClick={() => setEventPickerOpen(false)} />
                <div className="shell-event-pop">
                  <WcaEventSelector
                    availableEvents={availableEvents}
                    isZh={isZh}
                    selectedEvent={selectorActiveId}
                    onSelect={(id) => { setEvent(selectorIdToEvent(id)); setEventPickerOpen(false); }}
                    appendEvents={APPEND_EVENTS}
                    collapsibleAppend
                    onlyAvailable
                  />
                </div>
              </>
            )}
          </div>
        </div>
        <div className="shell-topbar-right">
          <a
            className="tb-btn"
            href={`${isZh ? '/zh' : ''}/timer/marks`}
            title={tr({ zh: '打乱足迹', en: 'Scramble marks'
            })}
            aria-label={tr({ zh: '打乱足迹', en: 'Scramble marks'
            })}
          >
            <Footprints size={14} />
          </a>
          <button
            type="button"
            className={`tb-btn${bluetoothCube.status.connected ? ' connected' : ''}`}
            onClick={() => setBluetoothOpen(true)}
            title={bluetoothCube.status.connected
              ? ((isZh ? `已连接 ${bluetoothCube.status.deviceName}` : `Connected: ${bluetoothCube.status.deviceName}`))
              : tr({ zh: '智能魔方（iOS 用 Bluefy）', en: 'Smart cube (use Bluefy on iOS)'
                            })}
          >
            <Bluetooth size={14} />
          </button>
          <button type="button" className="tb-btn" onClick={() => setSettingsOpen(true)} title={tr({ zh: '设置', en: 'Settings'
        })}>
            <SettingsIcon size={14} />
          </button>
        </div>
      </header>

      {/* ── Main column ─────────────────────────────────────── */}
      <div className="shell-main">
        <TimingSurface
          phase={timer.phase}
          colorClass={colorClass}
          fontSize={fontSize}
          digits={digitsText}
          digitsRef={digitsRef}
          surfaceRef={surfaceRef}
          className={`${isOvershot ? 'target-overshot' : ''} ${stopPulse ? `target-pulse-${stopPulse}` : ''}`.trim()}
          onMouseDown={onCenterMouseDown}
          onMouseUp={onCenterMouseUp}
          scrambleSlot={
            <div
              className={`scramble-strip${settings.compactScramble ? ' compact' : ''}`}
              style={{ '--scramble-scale': settings.scrambleFontScale } as React.CSSProperties}
              onClick={() => {
                const action = settings.scrambleClickAction;
                if (action === 'none') return;
                if (action === 'copy') { copyScrambleFlash(); return; }
                nextScramble();
              }}
              title={settings.scrambleClickAction === 'copy'
                ? tr({ zh: '点击复制打乱', en: 'Click to copy'
                                  })
                : settings.scrambleClickAction === 'none'
                  ? tr({ zh: '点击无操作', en: 'Click disabled'
                                      })
                  : tr({ zh: '点击换一个打乱', en: 'Click to refresh'
                                      })}
            >
              <span className="scramble-text">{scrambleLoading
                ? <span className="scramble-loading">{tr({ zh: '加载真实打乱…', en: 'Loading real scramble…' })}</span>
                : (displayScramble || <span className="scramble-empty">—</span>)}</span>
              {scrambleCopied && (
                <span className="scramble-copied-flash" data-no-timer>{tr({ zh: '已复制', en: 'Copied'
                })}</span>
              )}
              {wcaSrcDisplay && (
                <a
                  className="scramble-src"
                  data-no-timer
                  href={`${isZh ? '/zh' : ''}/scramble/gen?comp=${encodeURIComponent(wcaSrcDisplay.ci)}`}
                  onClick={(e) => e.stopPropagation()}
                  title={tr({ zh: '查看该比赛打乱', en: 'View this competition' })}
                >
                  {wcaSrcDisplay.iso2 && <Flag iso2={wcaSrcDisplay.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                  <span className="scramble-src-name">{wcaSrcDisplay.name}</span>
                  <EventIcon event={wcaSrcDisplay.event} className="scramble-src-evt" />
                  <span className="scramble-src-meta">{wcaSrcDisplay.meta}</span>
                </a>
              )}
              {wcaSrcDisplay && wcaSource && curMarks && curMarks.count > 0 && (
                <span className="scramble-marks" data-no-timer ref={marksBoxRef} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={`scramble-marks-chip${myMark ? ' marked' : ''}`}
                    onClick={() => setMarksOpen((o) => !o)}
                    title={tr({ zh: '谁做过这条打乱', en: 'Who did this scramble'
                    })}
                  >
                    <CheckCircle2 size={12} />
                    {tr({ zh: `${curMarks.count} 人做过`, en: `${curMarks.count} did it` })}
                  </button>
                  {marksOpen && (
                    <div className="scramble-marks-pop">
                      <ul className="scramble-marks-list">
                        {curMarks.marks.map((m) => (
                          <li key={m.wcaId}>
                            {m.country && <Flag iso2={m.country} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                            <a href={`${isZh ? '/zh' : ''}/wca/persons/${encodeURIComponent(m.wcaId)}`} className="scramble-marks-name">
                              {displayCuberName(m.name, isZh) || m.wcaId}
                            </a>
                            {m.timeCs != null && <span className="scramble-marks-time">{formatMs(m.timeCs * 10)}</span>}
                            <span className="scramble-marks-date">{new Date(m.createdAt * 1000).toISOString().slice(0, 10)}</span>
                          </li>
                        ))}
                      </ul>
                      <a href={`${isZh ? '/zh' : ''}/timer/marks`} className="scramble-marks-all">
                        {tr({ zh: '全站足迹', en: 'All marks'
                        })}
                      </a>
                    </div>
                  )}
                </span>
              )}
            </div>
          }
          cornerSlot={settings.showCubePreview ? (
            <div className="shell-corner-net">
              <div className="shell-corner-net-imgbox">
                <button
                  type="button"
                  className="shell-corner-net-img"
                  data-no-timer
                  onClick={() => setPreviewEnlarged(true)}
                  title={tr({ zh: '点击放大', en: 'Tap to enlarge'
                  })}
                >
                  <CubePreview event={event} scramble={scramble} height="var(--cube-h)" colors={settings.colors} visualization={settings.prefer3D ? '3D' : '2D'} />
                </button>
              </div>
            </div>
          ) : undefined}
        >
          {/* sub-content under the digits */}
          {timer.phase === 'running' && targetMs !== null && (
            <div className={`timer-target-indicator${isOvershot ? ' overshot' : ''}`}>
              <Target size={12} />
              <span className="target-label">{tr({ zh: '目标', en: 'target'
            })} {formatTargetTime(targetMs)}</span>
              <span className="target-delta">
                {(() => {
                  const deltaMs = targetMs - timer.displayMs;
                  const sign = deltaMs >= 0 ? '+' : '-';
                  return `${sign}${(Math.abs(deltaMs) / 1000).toFixed(2)}s`;
                })()}
              </span>
            </div>
          )}
          {timer.phase === 'inspecting' && (
            <>
              <div className="timer-hint">{tr({ zh: '观察中… 再按空格开始上手', en: 'Inspecting… press space again to grip'
            })}</div>
              {inspectionIllegalCount > 0 && (
                <div className="inspection-illegal-warn" title={tr({ zh: 'WCA 4d: 观察期间只允许整体旋转 (x/y/z)，转面会判 DNF', en: 'WCA 4d: only rotations (x/y/z) are legal during inspection — face turns are DNF'
                })}>
                  <AlertTriangle size={14} />
                  <span>{(isZh ? `检测到 ${inspectionIllegalCount} 次违规转面（WCA 应判 DNF）` : `${inspectionIllegalCount} illegal face turn${inspectionIllegalCount === 1 ? '' : 's'} detected (WCA: DNF)`)}</span>
                </div>
              )}
            </>
          )}
          {timer.phase === 'running' && multiStageActive && (
            <div className="timer-stage-splits">
              <span className={`stage-chip ${multiStage.liveStages.cross !== undefined ? 'done' : ''}`}>
                {tr({ zh: '十字', en: 'Cross' })}{multiStage.liveStages.cross !== undefined ? ` ${formatMs(multiStage.liveStages.cross)}` : ''}
              </span>
              <span className={`stage-chip ${multiStage.liveStages.f2l !== undefined ? 'done' : ''}`}>
                F2L{multiStage.liveStages.f2l !== undefined ? ` ${formatMs(multiStage.liveStages.f2l)}` : ''}
              </span>
              <span className={`stage-chip ${multiStage.liveStages.oll !== undefined ? 'done' : ''}`}>
                OLL{multiStage.liveStages.oll !== undefined ? ` ${formatMs(multiStage.liveStages.oll)}` : ''}
              </span>
            </div>
          )}
          {timer.phase === 'running' && bldMemoActive && (
            <div className="timer-stage-splits">
              {bldMemo.memoMs === undefined ? (
                <button
                  type="button"
                  className="stage-chip stage-chip-action"
                  data-no-timer
                  onClick={(e) => { e.stopPropagation(); bldMemoRef.current?.markMemo(); }}
                >{tr({ zh: '记忆中… 按 Enter 或点这里', en: 'Memo… press Enter or tap'
                })}</button>
              ) : (
                <>
                  <span className="stage-chip done">{tr({ zh: '记忆', en: 'Memo'
                })} {formatMs(bldMemo.memoMs)}</span>
                  <span className="stage-chip">{tr({ zh: '执行中…', en: 'Executing…'
                })}</span>
                </>
              )}
            </div>
          )}
          {/* 始终渲染该行占位(min-height),计时途中 badge 不显示但保留高度,避免长按时布局跳动。 */}
          <div className="shell-stopped-row">
            <div className="shell-rank-slot">
              {timer.phase === 'stopped' && solves.length > 0 && (
                <RankBadge eventId={event} centis={stoppedCentis} type="single" country={rankCountry} isZh={isZh} />
              )}
            </div>
          </div>
        </TimingSurface>

        {/* Goal pill + trainer subset + solver hints (chrome, fade while solving) */}
        <div className="shell-undersurface surface-chrome">
          <GoalProgress solves={allSolves} goal={settings.dailySolveGoal ?? null} isZh={isZh} />
          {(event === 'oll' || event === 'pll') && (() => {
            const total = event === 'oll' ? OLL_CASES.length : PLL_CASES.length;
            const subset = event === 'oll' ? settings.ollSubset : settings.pllSubset;
            const sel = subset && subset.length > 0 ? subset.length : null;
            return (
              <button type="button" className="trainer-subset-btn" onClick={() => setTrainerSubsetOpen(event === 'oll' ? 'oll' : 'pll')} title={tr({ zh: '选择训练子集', en: 'Pick training subset'
            })}>
                {sel !== null ? (isZh ? `子集 (${sel}/${total})` : `Subset (${sel}/${total})`) : (isZh ? `全部 (${total})` : `All (${total})`)}
              </button>
            );
          })()}
        </div>
        {event === '333' && <div className="shell-undersurface surface-chrome"><SolverHints scramble={scramble} isZh={isZh} /></div>}
        {(event === '222' || event === 'pyra' || event === 'skewb' || event === 'sq1' || event === 'mega') && (
          <div className="shell-undersurface surface-chrome"><SolverHints scramble={scramble} isZh={isZh} event={event} /></div>
        )}

        {/* Session stats — vertical cstimer-style list, bottom-left of the main
            area. Only once there's data (no bare dashes at idle). */}
        {solves.length > 0 && (
          <div className="shell-stat-rail surface-chrome">
            <span className="shell-stat"><span className="shell-stat-lbl">{tr({ zh: '次数', en: 'count'
            })}</span> <span className="shell-stat-val">{stats.count}</span></span>
            <span className="shell-stat"><span className="shell-stat-lbl">{tr({ zh: '成功', en: 'solved' })}</span> <span className="shell-stat-val">{stats.solved}/{stats.count}</span></span>
            <span className="shell-stat"><span className="shell-stat-lbl">mean</span> <span className="shell-stat-val">{stats.mean}</span></span>
            <span className="shell-stat"><span className="shell-stat-lbl">{tr({ zh: '最佳', en: 'best' })}</span> <span className="shell-stat-val">{stats.best}</span></span>
            <span className="shell-stat"><span className="shell-stat-lbl">mo3</span> <span className="shell-stat-val">{stats.mo3}</span></span>
            <span className="shell-stat"><span className="shell-stat-lbl">ao5</span> <span className="shell-stat-val">{stats.ao5}</span></span>
            <span className="shell-stat"><span className="shell-stat-lbl">ao12</span> <span className="shell-stat-val">{stats.ao12}</span></span>
          </div>
        )}

      </div>

      {/* ── Side panel: desktop dock / phone bottom sheet ────── */}
      <nav className="shell-bottombar surface-chrome">
        <button type="button" className={`shell-bottombar-btn${panelTab === 'times' ? ' active' : ''}`} onClick={() => togglePanel('times')}>
          <ListOrdered size={18} /><span>{tr({ zh: '成绩', en: 'Times'
        })}</span>
        </button>
        <button type="button" className={`shell-bottombar-btn${panelTab === 'chart' ? ' active' : ''}`} onClick={() => togglePanel('chart')}>
          <LineChart size={18} /><span>{tr({ zh: '图表', en: 'Chart'
        })}</span>
        </button>
        <button type="button" className={`shell-bottombar-btn${panelTab === 'tools' ? ' active' : ''}`} onClick={() => togglePanel('tools')}>
          <Wrench size={18} /><span>{tr({ zh: '工具', en: 'Tools' })}</span>
        </button>
      </nav>

      {panelTab && (
        <>
          {!isDesktop && <div className="shell-sheet-backdrop" onClick={() => setPanelTab(null)} />}
          <aside className={`shell-panel${isDesktop ? ' shell-panel--rail' : ' shell-panel--sheet'}`}>
            <div className="shell-panel-tabs">
              <button type="button" className={`shell-panel-tab${panelTab === 'times' ? ' active' : ''}`} onClick={() => setPanelTab('times')}>{tr({ zh: '成绩', en: 'Times'
            })}</button>
              <button type="button" className={`shell-panel-tab${panelTab === 'chart' ? ' active' : ''}`} onClick={() => setPanelTab('chart')}>{tr({ zh: '图表', en: 'Chart'
            })}</button>
              <button type="button" className={`shell-panel-tab${panelTab === 'tools' ? ' active' : ''}`} onClick={() => setPanelTab('tools')}>{tr({ zh: '工具', en: 'Tools' })}</button>
              <button type="button" className="shell-panel-close" onClick={() => setPanelTab(null)} aria-label={tr({ zh: '关闭', en: 'Close'
            })}><X size={16} /></button>
            </div>
            <div className="shell-panel-body">{renderPanelBody()}</div>
          </aside>
        </>
      )}

      {/* ── Enlarged cube net ────────────────────────────────── */}
      {previewEnlarged && settings.showCubePreview && (
        <div className="shell-net-enlarge" onClick={() => setPreviewEnlarged(false)}>
          <div className="shell-net-enlarge-inner" onClick={(e) => e.stopPropagation()}>
            <CubePreview event={event} scramble={scramble} size={40} colors={settings.colors} visualization={settings.prefer3D ? '3D' : '2D'} />
          </div>
        </div>
      )}

      {/* ── Radial gesture wheel (touch press-and-drag, idle/stopped) ── */}
      <GestureWheel ref={gestureWheelRef} isZh={isZh} />

      {/* ── Modals (unchanged) ───────────────────────────────── */}
      {modalSolve && (() => {
        const liveIdx = solves.findIndex(x => x.id === modalSolve.s.id);
        const displayIdx = liveIdx >= 0 ? liveIdx : modalSolve.idx;
        const isLatest = liveIdx >= 0 && liveIdx === solves.length - 1;
        return (
          <SolveModal
            key={modalSolve.s.id}
            solve={modalSolve.s}
            index={displayIdx}
            isZh={isZh}
            onClose={() => setModalSolve(null)}
            onChangePenalty={(p) => {
              updateSolve(modalSolve.s.id, { penalty: p });
              setModalSolve({ ...modalSolve, s: { ...modalSolve.s, penalty: p } });
              if (isLatest) setLastPenalty(p);
            }}
            onChangeComment={(text) => {
              updateSolve(modalSolve.s.id, { comment: text });
              setModalSolve({ ...modalSolve, s: { ...modalSolve.s, comment: text } });
            }}
            onDelete={() => { deleteSolve(modalSolve.s.id); setModalSolve(null); if (isLatest) setLastPenalty(null); }}
            onOpenReconstruct={() => setReconstructSolve(modalSolve.s)}
            moveTargets={listSessions().filter(s => s.id !== getActiveSessionId()).map(s => ({ id: s.id, name: s.name }))}
            onMoveToSession={(toId) => {
              if (moveSolveToSession(modalSolve.s.id, toId)) {
                setByEvent(loadAll());
                setModalSolve(null);
                if (isLatest) setLastPenalty(null);
              }
            }}
          />
        );
      })()}

      {reconstructSolve && (
        <ReconstructModal key={reconstructSolve.id} solve={reconstructSolve} isZh={isZh} onClose={() => setReconstructSolve(null)} history={byEvent[reconstructSolve.event] ?? []} />
      )}

      {settingsOpen && <SettingsPanel isZh={isZh} event={event} onClose={() => setSettingsOpen(false)} onDataReplaced={() => setByEvent(loadAll())} />}

      {infoToast && (
        <div className="shell-info-toast" role="status">
          <span>{infoToast.msg}</span>
          {infoToast.undo && (
            <button type="button" onClick={() => { infoToast.undo?.(); setInfoToast(null); }}>{tr({ zh: '撤销', en: 'Undo'
            })}</button>
          )}
        </div>
      )}

      {shortcutsOpen && <ShortcutsModal isZh={isZh} onClose={() => setShortcutsOpen(false)} />}
      {trainerSubsetOpen && <TrainerSubsetModal kind={trainerSubsetOpen} isZh={isZh} onClose={() => setTrainerSubsetOpen(null)} />}

      {bluetoothOpen && (
        <BluetoothModal
          isZh={isZh}
          cube={bluetoothCube}
          macPrompt={macPrompt}
          onSubmitMac={(mac) => resolveMac(mac)}
          onCancelMac={() => resolveMac(null)}
          onClose={() => { if (macResolverRef.current) resolveMac(null); setBluetoothOpen(false); }}
          onConnect={async () => {
            try { await bluetoothCube.connect(); }
            catch (err) {
              const msg = (err as Error).message ?? String(err);
              if (msg !== 'NO_WEB_BLUETOOTH') alert((isZh ? `连接失败：${msg}` : `Connection failed: ${msg}`));
            }
          }}
        />
      )}

      {statsModalOpen && <StatsModal event={event} solves={solves} isZh={isZh} onClose={() => setStatsModalOpen(false)} />}

      {manualEntryOpen && (
        <ManualEntryModal
          event={event}
          currentScramble={displayScramble}
          isZh={isZh}
          onClose={() => setManualEntryOpen(false)}
          onSubmit={(solve) => {
            setByEvent(prev => ({ ...prev, [solve.event]: [...(prev[solve.event] ?? []), solve] }));
            setLastPenalty(solve.penalty);
            setManualEntryOpen(false);
          }}
        />
      )}

      {solverOpen && <SolverModal isZh={isZh} onClose={() => setSolverOpen(false)} />}
      {bulkScrambleOpen && <BulkScrambleModal defaultEvent={event} isZh={isZh} onClose={() => setBulkScrambleOpen(false)} />}
      {bldHelperOpen && <BldHelperModal scramble={scramble} event={event} isZh={isZh} onClose={() => setBldHelperOpen(false)} />}

      {drillModalOpen && (
        <DrillModal
          isZh={isZh}
          activeCase={drillTarget}
          initialType={event === 'pll' ? 'pll' : 'oll'}
          onPick={(type, id) => { setDrillTarget({ type, id }); }}
          onExit={() => setDrillTarget(null)}
          onClose={() => setDrillModalOpen(false)}
        />
      )}

      {bluetoothCube.status.connected && (
        <div className="timer-live-cube" title={tr({ zh: '智能魔方实时状态（每次拧动同步）', en: 'Live smart-cube state (updates per move)'
        })}>
          <LiveCubeState event={event} scramble={scramble} moves={liveMoves} size={120} />
        </div>
      )}
    </div>
  );
}
