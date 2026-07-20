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
import { useQueryState, parseAsString, parseAsStringEnum } from 'nuqs';
import {
  Download, Upload, Trash2, Settings as SettingsIcon, Maximize2, Minimize2,
  Bluetooth, Mic, BarChart3, Plus, Wrench, ListPlus, Printer, FileText,
  FileSpreadsheet, AlertTriangle, Target, Crosshair, Keyboard, Link2, Globe,
  ListOrdered, LineChart, Brain, X, Check, CheckCircle2, Footprints, Repeat,
} from 'lucide-react';
import WcaEventSelector from '@/components/WcaEventSelector';
import { CubingIcon, EventIcon } from '@/components/EventIcon/EventIcon';
import CubeRootLogo from '@/components/CubeRootLogo';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { petReact } from '@/lib/deskpet';
import { type MoreMenuItem } from '../_components/MoreMenu';
import { syncLangToUrl } from '@/i18n/i18n-client';

import { generateScramble, registerScramble } from '../_lib/scramble';
import { peekWca, nextWca, prefetchWca, hasWcaSource, isWcaSourceEmpty, isWcaCompUnindexed, probeCompCoverage, getCompCoverage, wcaEventId, wcaMetaFor, wcaPoolProgress, type WcaSourceSpec } from '../_lib/scramble/wca_pool';
import { takeScramble } from '../_lib/scramble/scramble_pool';
import { genByStepsScramble, genByStepsSig, wcaStepFilter } from '../_lib/scramble/gen-by-steps';
import { formatScrambleForEvent } from '@/lib/sq1-svg';
import { Flag } from '@/components/Flag';
import { compFlagIso2, loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { compSourceLine } from '@/lib/comp-schedule';
import { useAuthStore } from '@/lib/auth-store';
import { ownerKey as computeOwnerKey } from '@cuberoot/shared/account';
import { displayCuberName } from '@/lib/cuber-name-display';
import { fetchMarks, addMark, markKey, type ScrambleMark } from '../_lib/marks';
import { getLastPickedCase, type TrainerKind } from '../_lib/scramble/training';
import { warmup333, randomState333Sync } from '../_lib/scramble/kociemba/random_state';
import { useTimer, type TimerPhase } from '../_lib/useTimer';
import { formatMs, bestSingle, bestAverageOfN, summarize } from '../_lib/stats';
import type { EventId, Penalty, Solve } from '../_lib/types';
import { EVENTS, isBldEvent } from '../_lib/types';
import {
  loadAll, saveAll, exportJson, importJson, makeSolve,
  importCstimerJson, exportCsv, exportSpeedstacks,
  listSessions, getActiveSessionId, moveSolveToSession,
} from '../_lib/storage/db';
import { formatTargetTime, useSettings, getSettings, updateSettings } from '../_lib/settings';
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
import SolverHintPanel from '../_components/SolverHintPanel';
import ScrambleSourceBar from '../_components/ScrambleSourceBar';
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
import GestureWheel from '@/components/GestureWheel';
import { SegmentTime } from '@/components/SegmentTime';
import { useGestureWheel } from '@/hooks/useGestureWheel';
import { histBack, histForward, histPush } from '@/lib/scramble-history';
import { shouldIgnoreTimerTarget } from '@/lib/timer-ignore-target';
import { persistItem } from '@/lib/safe-storage';
import RankBadge from './RankBadge';
import SessionSwitcher from './SessionSwitcher';
import { useRankCountry } from '@/app/[lang]/timer/_shared/use-rank-country';

import '../timer.css';
import '../_components/charts/charts.css';
import '../_components/charts/practice_heatmap.css';
import './shell.css';
import { tr } from '@/i18n/tr';

const TRAINER_KINDS = new Set<EventId>(['oll', 'pll', 'coll', 'cmll', 'zbll', 'eg1', 'eg2']);

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

  const isMobile = useMediaQuery('(max-width: 480px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');


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

  // 项目进 URL(?event=,nuqs,clearOnDefault:false 强制写默认值也显式展示,不再只落
  // localStorage)。history:'replace' 不污染后退(换项目很频繁,不该像换人数那样入栈)。
  const [event, setEvent] = useQueryState(
    'event',
    parseAsStringEnum<EventId>(EVENTS.map(e => e.id) as EventId[])
      .withDefault('333')
      .withOptions({ history: 'replace', clearOnDefault: false }),
  );
  // 裸 /timer(无 ?event=)→ 用 localStorage 记的上次项目补齐并强制写回 URL;
  // 有 ?event= 时(分享链接 / 收藏)以 URL 为准。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).has('event')) return;
    const stored = localStorage.getItem('cuberoot-timer.event');
    const valid = EVENTS.some(e => e.id === stored);
    // 始终显式写一次(哪怕就是当前默认值 '333'),否则 clearOnDefault:false 只在真调用
    // setEvent 时生效 —— 光靠 withDefault 不会自动把默认值补进 URL。
    void setEvent(valid ? (stored as EventId) : event, { history: 'replace' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { persistItem('cuberoot-timer.event', event); }, [event]);

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
  // 「按步数」WCA 过滤(2×2 / 金字塔):把真实打乱按度量步数筛到 [lo,hi]。与随机来源共用同一组设置。
  const wcaStep = wcaStepFilter(event, settings);
  const wcaStepSig = wcaStep ? `${wcaStep.metric}:${wcaStep.lo}.${wcaStep.hi}` : '';
  // comp + 难度:该场若还没进难度库(离线管道对新赛滞后),难度过滤旁路(出正常整场打乱,不产生空结果),
  // 同时 WcaSourceConfig 会把「难度」开关灰锁。用户的 wcaDifficultyOn 偏好保留(切回已入库比赛/日期即恢复)。
  const [wcaCompUnindexed, setWcaCompUnindexed] = useState(false);
  useEffect(() => {
    const w = wcaEventId(event);
    if (settings.scrambleSource !== 'wca' || settings.wcaScrambleMode !== 'comp'
        || !settings.wcaComp || !settings.wcaDifficultyOn || !w) { setWcaCompUnindexed(false); return; }
    const cached = getCompCoverage(settings.wcaComp, w);
    if (cached !== null) { setWcaCompUnindexed(cached === false); return; }
    let cancelled = false;
    void probeCompCoverage(settings.wcaComp, settings.wcaCompName, w).then((r) => {
      if (!cancelled) setWcaCompUnindexed(r === false);
    });
    return () => { cancelled = true; };
  }, [settings.scrambleSource, settings.wcaScrambleMode, settings.wcaComp, settings.wcaCompName, settings.wcaDifficultyOn, event]);
  // 比赛模式但没选比赛 → 回退成「日期全时段随机真题」:仍出真实 WCA 打乱(随机抽),不落本地
  // 随机生成。走 date 池(fillDate,空 from/to = 全时段),经预热后秒出。否则 specKey 对空 comp
  // 返回 null,会静默变成本地生成打乱(见 wca_pool.specKey / fillDate)。
  const wcaSpec = useMemo<WcaSourceSpec>(() => {
    const compMissing = settings.wcaScrambleMode === 'comp' && !settings.wcaComp;
    return {
      event,
      mode: compMissing ? 'date' : settings.wcaScrambleMode,
      comp: settings.wcaComp,
      compName: settings.wcaCompName,
      round: compMissing ? '' : settings.wcaRound,
      group: compMissing ? '' : settings.wcaGroup,
      from: compMissing ? '' : settings.wcaDateFrom,
      to: compMissing ? '' : settings.wcaDateTo,
      optimal: settings.wcaUseOptimal,
      // 难度过滤:未入库的比赛旁路(见 wcaCompUnindexed)。空比赛回退成「全时段随机真题」时仍生效——
      // 难度控件此时照常显示可操作(WcaSourceConfig 只看开关不看有无选中比赛),丢弃会静默出不符条件的
      // 打乱(如选了 0 步十字却拿到普通打乱);date 池服务端 /random 对空 from/to 走飞镖采样带环绕补齐,
      // 稀有档(0 步十字)也能出题。
      diff: !wcaCompUnindexed && settings.wcaDifficultyOn && settings.wcaDiffSteps.length > 0
        ? { variant: settings.wcaDiffVariant, stage: settings.wcaDiffStage, colors: settings.wcaDiffColors, steps: settings.wcaDiffSteps }
        : undefined,
      stepFilter: wcaStep ?? undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, settings.wcaScrambleMode, settings.wcaComp, settings.wcaCompName, settings.wcaRound, settings.wcaGroup, settings.wcaDateFrom, settings.wcaDateTo, settings.wcaUseOptimal, settings.wcaDifficultyOn, settings.wcaDiffVariant, settings.wcaDiffStage, settings.wcaDiffColors, settings.wcaDiffSteps, wcaStepSig, wcaCompUnindexed]);
  const wcaSpecRef = useRef(wcaSpec);
  wcaSpecRef.current = wcaSpec;
  const wcaSourceSig = settings.scrambleSource === 'wca'
    ? `${settings.wcaScrambleMode}|${settings.wcaComp}|${settings.wcaRound}|${settings.wcaGroup}|${settings.wcaDateFrom}|${settings.wcaDateTo}|${event}|${wcaDiffSig}|${wcaStepSig}|${wcaCompUnindexed ? 'U' : ''}`
    : 'random';
  // 按步数生成签名(2×2 / 金字塔,随机来源):开启且选了步数才生效,变了即重置打乱队列(同 wcaSourceSig 机制)。
  const genStepsSig = settings.scrambleSource === 'random'
    ? genByStepsSig(event, settings)
    : '';

  // 手动输入队列:每行一条打乱(去空行);source==='manual' 时按游标顺序取用(走完循环回队首),
  // ←/→ 仍走 scrambleHist 历史。队列内容变了即重置打乱历史(经 genScramble 身份变化)+ 游标。
  const manualQueue = useMemo(
    () => settings.manualScrambles.split('\n').map((l) => l.trim()).filter(Boolean),
    [settings.manualScrambles],
  );
  const manualQueueRef = useRef(manualQueue);
  manualQueueRef.current = manualQueue;
  const manualSig = settings.scrambleSource === 'manual' ? manualQueue.join('\n') : '';
  const manualCursorRef = useRef(0);
  // 队列内容变化 → 游标归零(下次生成从队首开始)。声明在打乱历史重置 effect 之前,
  // 同一次提交里先跑,保证重置历史时 genScramble() 取到的是 queue[0]。
  useEffect(() => { manualCursorRef.current = 0; }, [manualSig]);

  // Live timer phase (written through after useTimer below) — read by the scramble
  // buffer's safety gate so background generation never blocks a running solve.
  const phaseRef = useRef<TimerPhase>('idle');
  // Background scramble generation is only safe in non-timing phases: useTimer
  // captures start/stop with performance.now() inside the keypress handler, so a
  // slow random-state generation (4x4 / sq1) mid-solve would corrupt the time.
  // Also off in seeded-sync mode (must not advance the shared counter ahead).
  const canGenScramble = useCallback(() => {
    const p = phaseRef.current;
    return (p === 'idle' || p === 'stopped' || p === 'inspecting') && !getSettings().syncSeed;
  }, []);

  const genScramble = useCallback((): string => {
    // Manual queue: walk the user-typed lines in order, wrapping at the end.
    // Empty queue → '' placeholder (the strip shows a "paste scrambles" hint).
    if (settings.scrambleSource === 'manual') {
      const q = manualQueueRef.current;
      if (q.length === 0) return '';
      const s = q[manualCursorRef.current % q.length];
      manualCursorRef.current += 1;
      return s;
    }
    if (drillTarget && drillAllowed) {
      const ds = generateDrillScramble(drillTarget.type, drillTarget.id);
      if (ds) return ds.scramble;
    }
    // WCA real-scramble mode: take from the pool synchronously when available;
    // '' is a loading placeholder filled async by the effect below.
    if (settings.scrambleSource === 'wca' && hasWcaSource(wcaSpecRef.current)) {
      return peekWca(wcaSpecRef.current) ?? '';
    }
    // Local generation: serve from the background buffer (instant), except in
    // deterministic seeded-sync mode where consumption order must stay exact.
    const s = getSettings();
    if (s.syncSeed) return generateScramble(event);
    // 「按步数生成」(2×2 / 金字塔):从完整状态空间均匀采样、按所选度量最优步数过滤(非案例库)。
    // 度量+区间进 pool key,改设置即换 buffer;拒绝采样 + IDA* 在后台 idle 生成,不阻塞计时。
    const byStepsScr = genByStepsScramble(event, s);
    if (byStepsScr) return takeScramble(byStepsScr.key, byStepsScr.gen, canGenScramble);
    return takeScramble(`${event}|${s.cnMode}`, () => generateScramble(event), canGenScramble);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillTarget, drillAllowed, event, settings.scrambleSource, wcaSourceSig, genStepsSig, manualSig, canGenScramble]);

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
  // scramble and fill it in, showing a loading state until it lands. We never
  // substitute a locally generated scramble here: in WCA mode a generated one has
  // no competition source and wouldn't match the chosen difficulty (the exact
  // confusing symptom users hit). If the source is *confirmed* empty (difficulty
  // with no matches / comp lacking the event), show a notice instead.
  const [scrambleLoading, setScrambleLoading] = useState(false);
  const [wcaSourceEmpty, setWcaSourceEmpty] = useState(false);
  useEffect(() => {
    if (scramble !== '' || settings.scrambleSource !== 'wca' || !hasWcaSource(wcaSpecRef.current)) {
      setScrambleLoading(false);
      setWcaSourceEmpty(false);
      return;
    }
    let cancelled = false;
    let retryTimer = 0;
    setScrambleLoading(true);
    setWcaSourceEmpty(false);
    // Fetch a real scramble; retry transient failures (cold start / slow query /
    // network) with backoff while staying in the loading state — only a *confirmed*
    // empty source (404) shows the notice, and we never substitute a generated one.
    const attempt = (n: number) => {
      void nextWca(wcaSpecRef.current).then((real) => {
        if (cancelled) return;
        const cur = scrambleHistRef.current;
        if (cur.list[cur.idx] !== '') { setScrambleLoading(false); return; }
        if (real) {
          setScrambleLoading(false);
          const list = [...cur.list];
          list[cur.idx] = real;
          applyScrambleHist({ list, idx: cur.idx });
        } else if (isWcaSourceEmpty(wcaSpecRef.current)) {
          setScrambleLoading(false);
          setWcaSourceEmpty(true); // 确认无真题(端点 404)→ 显式提示,不伪造生成打乱
        } else if (n < 6) {
          // 暂态(冷启动 503 / 慢查询 / 网络)→ 保持「加载中」,退避重试,不伪造、不误报空。
          retryTimer = window.setTimeout(() => attempt(n + 1), Math.min(1000 + n * 1500, 6000));
        } else {
          setScrambleLoading(false); // 多次仍失败 → 收起转圈(显示 — ),换打乱 / 改设置可再试
        }
      });
    };
    attempt(0);
    return () => { cancelled = true; if (retryTimer) window.clearTimeout(retryTimer); };
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
  // 稀有筛选(如 8 步双色十字,全库仅 2 条)下真题总数是确切已知的(见 wca_pool 的封闭集)——
  // 从第一条起就显示「已练 n/N」,让用户一眼知道池子有多小;练满 N 条后转成「已全部练过」,
  // 明确告知之后是重复出题,免得以为出题坏了。常见档总数未知 → 返回 null,整块不渲染。
  // 随 scramble 变化重算即可(每出一条都会重渲染),不需要额外的订阅/状态。
  const poolRun = settings.scrambleSource === 'wca' && !scrambleLoading ? wcaPoolProgress(wcaSpec) : null;
  const poolRunDone = !!poolRun && poolRun.seen >= poolRun.total;
  // 开了「最优打乱」但这条是回退的原打乱(该难度档无最优等态)→ 在打乱右侧标「非最优」。
  const wcaNonOptimal = settings.wcaUseOptimal && !!wcaSource?.nonOptimal;
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
  // 所有权键(与服务端一致):非 WCA 账号的标记也能正确认出「已标记」,避免重复标记。
  const myKey = authUser ? computeOwnerKey(authUser.uid, authUser.wcaId) : '';
  const myMark = !!(myKey && curMarks?.marks.some((m) => m.wcaId === myKey));

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
    const alreadyMine = marksCache[key]?.marks.some((m) => m.wcaId === myKey);
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
    applyScrambleHist(histForward(cur) ?? histPush(cur, genScramble()));
  }, [genScramble, applyScrambleHist]);

  const prevScramble = useCallback(() => {
    const back = histBack(scrambleHistRef.current);
    if (back) applyScrambleHist(back);
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
      if (!getSettings().timingEnabled) return; // 练习模式不自动预备计时
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

  // Stable ref to the 8 radial-gesture actions, indexed by direction
  // (0=right, then counter-clockwise: 1=up-right … 7=down-right). Populated
  // below once the solve mutators exist.
  const gestureActionsRef = useRef<Array<() => void>>([]);

  // Radial press-and-drag dial (idle/stopped) — shared with the /alg trainer run page via the
  // useGestureWheel hook. A plain hold still times; only a drag fires a slot.
  const { wheelRef: gestureWheelRef } = useGestureWheel({
    surfaceRef,
    canGesture: () => {
      const ph = phaseSnapshotRef.current;
      return ph === 'idle' || ph === 'stopped';
    },
    enabledFor: () => {
      const hasLast = solvesRef.current.length > 0;
      const canPrev = scrambleHistRef.current.idx > 0;
      // index: 0 next · 1 OK · 2 +2 · 3 DNF · 4 prev · 5 note · 6 del · 7 copy
      return [true, hasLast, hasLast, hasLast, canPrev, hasLast, hasLast, true];
    },
    fireAction: (i) => gestureActionsRef.current[i]?.(),
    // 计时关(练习模式):按下不预备,松开(未拖动)直接下一个打乱,不计时不记成绩。同 /alg 训练器。
    onPressDown: () => { if (!getSettings().timingEnabled) return; warmupSound(); onPressDown(); },
    onPressUp: () => { if (!getSettings().timingEnabled) { nextScramble(); return; } onPressUp(); },
    onArmCancel: () => cancelArm(),
    ignoreTarget: shouldIgnoreTimerTarget,
  });

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
  // phaseRef is declared up by genScramble (the scramble buffer's safety gate
  // reads it); keep it in sync with the live timer phase here.
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
      // Focus inside an always-present in-page control region (解法提示面板 / 打乱来源栏的
      // selects/buttons) must not arm the timer or fire other shortcuts —— 唯独左右键仍要能
      // 切上一个/下一个打乱:面板常驻且可竖向滚动,不该把换题键吞给滚动条。原生 <select>
      // (左右键=切换选项)与计时进行中例外。
      if (target && target.closest('[data-no-timer]')) {
        const ph = phaseRef.current;
        const busy = ph === 'running' || ph === 'holding' || ph === 'ready' || ph === 'inspecting';
        if (!busy && !e.repeat && target.tagName !== 'SELECT'
            && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
          e.preventDefault();
          (e.code === 'ArrowLeft' ? prevScramble : nextScramble)();
        }
        return;
      }
      // Holding Space auto-repeats keydown; swallow the page-scroll default on
      // every repeat, but only arm the timer once (first non-repeat keydown).
      if (e.code === 'Space') {
        e.preventDefault();
        if (e.repeat) return;
        // 计时关(练习模式):空格 = 下一个打乱,不预备/不计时。
        if (!getSettings().timingEnabled) { nextScramble(); return; }
        warmupSound(); onPressDown(); return;
      }
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
      // 计时进行中按任意键停止(stage 标记 / BLD memo 等功能键已在上面 return)。
      if (ph === 'running') { e.preventDefault(); onPressDown(); return; }
      if (ph === 'holding' || ph === 'ready' || ph === 'inspecting') return;
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
      if (target && target.closest('[data-no-timer]')) return;
      if (e.code === 'Space') { e.preventDefault(); if (!getSettings().timingEnabled) return; onPressUp(); }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onPressDown, onPressUp, reset, updateSolve, deleteSolve, nextScramble, prevScramble, toggleFullscreen, multiStageActive, bldMemoActive]);

  // 计时进行中:点屏幕任何地方都停表。计时面板内由 useGestureWheel(surfaceRef)处理,
  // 这里只补面板之外的区域,并跳过面板内目标避免双触发(双触发会停表后立即重新进入 hold/观察)。
  useEffect(() => {
    const onDocDown = (e: PointerEvent) => {
      if (phaseSnapshotRef.current !== 'running') return;
      const t = e.target as Node | null;
      if (surfaceRef.current && t && surfaceRef.current.contains(t)) return;
      onPressDown();
    };
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [onPressDown]);

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
    // 练习模式(计时关):不显示任何读数 —— 按压只换打乱,没有时间可言。
    if (!settings.timingEnabled) return '';
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
  }, [timer.phase, timer.inspectionDisplayMs, timer.displayMs, inspectionLimit, lastPenalty, settings.hideTime, settings.precision, settings.runningPrecision, settings.timingEnabled]);

  const fontSize = `calc(clamp(48px, 10vw, 132px) * ${settings.timerFontScale})`;

  // Rank badge centis from the last effective time (DNF -> null). 练习模式(计时关)下
  // timer.phase/displayMs 可能还残留关闭前最后一次真实成绩 —— 没有新成绩产生,徽章不该显示。
  const stoppedCentis = useMemo<number | null>(() => {
    if (!settings.timingEnabled) return null;
    if (timer.phase !== 'stopped') return null;
    if (lastPenalty === 'DNF' || !Number.isFinite(timer.displayMs)) return null;
    const ms = lastPenalty === '+2' ? timer.displayMs + 2000 : timer.displayMs;
    return Math.round(ms / 10);
  }, [timer.phase, timer.displayMs, lastPenalty, settings.timingEnabled]);

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
          {/* 打乱来源:随机 / WCA 真题 / 手动输入。放在项目选择器右侧,和「人数」下拉同一组。
              data-no-timer:聚焦此下拉时空格不触发计时(见 lib/timer-ignore-target / 键盘处理)。 */}
          <select
            className="shell-players-select"
            data-no-timer
            value={settings.scrambleSource}
            onChange={(e) => updateSettings({ scrambleSource: e.target.value as 'random' | 'wca' | 'manual' })}
            aria-label={tr({ zh: '打乱来源', en: 'Scramble source' })}
            title={tr({ zh: '打乱来源', en: 'Scramble source' })}
          >
            <option value="wca">{tr({ zh: 'WCA 真题', en: 'WCA real' })}</option>
            <option value="random">{tr({ zh: '随机状态', en: 'Random' })}</option>
            <option value="manual">{tr({ zh: '手动输入', en: 'Manual' })}</option>
          </select>
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
        {/* 打乱来源配置条 —— 常驻计时读数上方(全项目)。计时中随 surface-chrome 淡出。 */}
        <ScrambleSourceBar event={event} isZh={isZh} />
        <TimingSurface
          phase={timer.phase}
          colorClass={`${colorClass} tf-${settings.timerFont}`.trim()}
          fontSize={fontSize}
          digits={<SegmentTime text={digitsText} />}
          digitsRef={digitsRef}
          surfaceRef={surfaceRef}
          className={`${isOvershot ? 'target-overshot' : ''} ${stopPulse ? `target-pulse-${stopPulse}` : ''}`.trim()}
          onMouseDown={onCenterMouseDown}
          onMouseUp={onCenterMouseUp}
          scrambleSlot={
            <div
              className={`scramble-strip sf-${settings.scrambleFont}${settings.compactScramble ? ' compact' : ''}`}
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
                : wcaSourceEmpty
                  ? <span className="scramble-empty">{
                      // 「按步数」过滤在 comp/date 两模式都生效,先判——真题近上帝数,低步数常无匹配。
                      wcaStep
                        ? tr({ zh: '该步数范围没有匹配的 WCA 真题,换个步数试试', en: 'No WCA scramble matches this move-count range — try another range' })
                        // 难度过滤 date/comp 两模式都生效(wcaSpec.diff 仅在难度实际生效时有值)——
                        // 先判难度,再判 comp 缺项目,避免 comp+难度为空时误报「该比赛没有此项目」。
                        // comp 模式再按覆盖探测(isWcaCompUnindexed)细分:该场压根没进难度库(离线管道
                        // 还没算,常见新赛)→ 换步数/配色也没用,提示改用日期模式;已入库只是此难度档无匹配
                        // → 提示换步数/配色。
                        : wcaSpec.diff
                          ? wcaSpec.mode === 'comp'
                            ? isWcaCompUnindexed(wcaSpec)
                              ? tr({ zh: '难度库待更新', en: 'Difficulty index not updated yet' })
                              : tr({ zh: '该比赛没有匹配此难度的真题,换个步数或配色试试', en: 'This competition has no scramble at this difficulty — try other step counts or colors' })
                            : tr({ zh: '该难度组合没有匹配的 WCA 真题,换个步数或配色试试', en: 'No WCA scramble matches this difficulty — try other step counts or colors' })
                          : wcaSpec.mode === 'comp'
                            ? tr({ zh: '该比赛没有此项目的打乱', en: 'This competition has no scrambles for this event' })
                            : tr({ zh: '该时间段内没有 WCA 真题', en: 'No WCA scrambles in this date range' })
                    }</span>
                  : displayScramble
                    ? <><span className="scramble-moves">{(() => {
                        // 复制成功的绿勾必须绝对不换行(即使不另起、也不能把最后一步挤下去)。
                        // 做法:把最后一步单独包进 .scramble-copied-tail(relative),绿勾在其中
                        // 绝对定位(left:100%),完全脱离文本流 → 既不新增断行点、也不占宽度,永不换行。
                        const i = displayScramble.lastIndexOf(' ');
                        const head = i >= 0 ? displayScramble.slice(0, i + 1) : '';
                        const tail = i >= 0 ? displayScramble.slice(i + 1) : displayScramble;
                        return (
                          <>{head}<span className="scramble-copied-tail">{tail}{scrambleCopied && (
                            <Check className="scramble-copied-check" aria-label={tr({ zh: '已复制', en: 'Copied' })} />
                          )}</span></>
                        );
                      })()}</span>{wcaNonOptimal && (
                        <span
                          className="scramble-nonopt"
                          data-no-timer
                          title={tr({ zh: '该难度档暂无最优等态打乱,显示原始 WCA 打乱', en: 'No optimal-equivalent scramble for this difficulty — showing the original WCA scramble' })}
                        >{tr({ zh: '非最优', en: 'non-optimal' })}</span>
                      )}</>
                    : settings.scrambleSource === 'manual' && manualQueue.length === 0
                      ? <span className="scramble-empty">{tr({ zh: '在上方「打乱来源」粘贴打乱,每行一条', en: 'Paste scrambles above — one per line' })}</span>
                      : <span className="scramble-empty">—</span>}</span>
              {wcaSrcDisplay && (
                <div className="scramble-src-row">
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
                {wcaSource && curMarks && curMarks.count > 0 && (
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
                {poolRun && (
                  <span
                    className={`scramble-pool-run${poolRunDone ? ' done' : ''}`}
                    data-no-timer
                    title={poolRunDone
                      ? tr({
                          zh: `符合当前筛选的 WCA 真题只有 ${poolRun.total} 条,已全部练过,之后是重复出题`,
                          en: `Only ${poolRun.total} WCA scrambles match the current filters — all practiced, so they now repeat`,
                        })
                      : tr({
                          zh: `符合当前筛选的 WCA 真题只有 ${poolRun.total} 条,练完后会重复出题`,
                          en: `Only ${poolRun.total} WCA scrambles match the current filters — they repeat once all are practiced`,
                        })}
                  >
                    {poolRunDone && <Repeat size={12} />}
                    {poolRunDone
                      ? tr({ zh: `${poolRun.total} 条已全部练过`, en: `All ${poolRun.total} practiced` })
                      : tr({ zh: `已练 ${poolRun.seen}/${poolRun.total}`, en: `${poolRun.seen}/${poolRun.total} practiced` })}
                  </span>
                )}
                </div>
              )}
            </div>
          }
          cornerSlot={settings.showCubePreview ? (
            <div className="shell-corner-net">
              <div className="shell-corner-net-imgbox">
                <div className="shell-corner-net-img">
                  <CubePreview event={event} scramble={scramble} height="var(--cube-h)" colors={settings.colors} visualization={settings.prefer3D ? '3D' : '2D'} />
                </div>
              </div>
            </div>
          ) : undefined}
          digitsCorner={settings.showRankBadge !== false && timer.phase === 'stopped' && solves.length > 0 ? (
            <RankBadge eventId={event} centis={stoppedCentis} type="single" country={rankCountry} isZh={isZh} />
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
        {(event === '222' || event === 'pyra' || event === 'skewb' || event === 'sq1' || event === 'mega') && (
          <div className="shell-undersurface surface-chrome"><SolverHints scramble={scramble} isZh={isZh} event={event} /></div>
        )}

        {/* 右侧配置栏:解法提示(仅 333,逐阶段最优 + 分步解法)常驻可折叠面板 ——
            桌面收成主区右侧竖栏,手机落在打乱图下方。打乱来源已移到计时读数上方(见 ScrambleSourceBar)。 */}
        <div className="shell-rail" data-no-timer>
          {event === '333' && <SolverHintPanel scramble={scramble} isZh={isZh} />}
        </div>

        {/* Session stats — vertical cstimer-style list, bottom-left of the main
            area. Only once there's data (no bare dashes at idle). */}
        {solves.length > 0 && (
          <div className="shell-stat-rail surface-chrome">
            {/* 「次数」单独一行去掉了 —— 总次数已含在下面「成功」的分母(solved/count)里,不用重复占一行。 */}
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
            <button type="button" className="shell-info-toast-btn" onClick={() => { infoToast.undo?.(); setInfoToast(null); }}>{tr({ zh: '撤销', en: 'Undo'
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
