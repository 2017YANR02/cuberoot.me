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
 * The engine itself (_shared/useTimer + _lib/scramble + _lib/storage) is untouched.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { useQueryState, parseAsBoolean, parseAsString, parseAsStringEnum } from 'nuqs';
import {
  Download, Upload, Trash2, Settings as SettingsIcon, Maximize2, Minimize2,
  Bluetooth, Mic, BarChart3, Plus, Wrench, ListPlus, Printer, FileText,
  FileSpreadsheet, AlertTriangle, Target, Crosshair, Keyboard, Link2, Globe,
  Brain, X, Check, CheckCircle2, Footprints, Repeat,
  Timer,
} from 'lucide-react';
import AppLink from '@/components/AppLink';
import WcaEventSelector from '@/components/WcaEventSelector';
import { CubingIcon, EventIcon } from '@/components/EventIcon/EventIcon';
import CubeRootLogo from '@/components/CubeRootLogo';
import { petReact } from '@/lib/deskpet';
import { type MoreMenuItem } from '../_components/MoreMenu';
import { syncLangToUrl } from '@/i18n/i18n-client';

import { generateScramble, registerScramble } from '../_lib/scramble';
import { peekWca, nextWca, prefetchWca, hasWcaSource, isWcaSourceEmpty, isWcaCompUnindexed, probeCompCoverage, getCompCoverage, wcaEventId, wcaMetaFor, wcaPoolProgress, type WcaSourceSpec } from '../_lib/scramble/wca_pool';
import { takeScramble } from '../_lib/scramble/scramble_pool';
import { preScrambleFor } from '../_lib/scramble/pre_scramble';
import { applyOrientationPrefix } from '@/lib/cube-orientation';
import { use222Mode } from '@/lib/scramble-222-mode';
import { genByStepsScramble, genByStepsSig, wcaStepFilter } from '../_lib/scramble/gen-by-steps';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import { Flag } from '@/components/Flag';
import { compFlagIso2, loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { compSourceLine } from '@/lib/comp-schedule';
import { usesStepsIndex } from '@/lib/scramble-variants';
import { useAuthStore } from '@/lib/auth-store';
import { ownerKey as computeOwnerKey } from '@cuberoot/shared/account';
import { displayCuberName } from '@/lib/cuber-name-display';
import { fetchMarks, addMark, markKey, type ScrambleMark } from '../_lib/marks';
import { getLastPickedCase, type TrainerKind } from '../_lib/scramble/training';
import { warmup333, randomState333Sync } from '../_lib/scramble/kociemba/random_state';
import { useTimer, type TimerPhase } from '../_shared/useTimer';
import { formatMs, bestSingle, bestAverageOfN, bestMbldSolve, compareMbld, summarize } from '../_lib/stats';
import type { EventId, Penalty, Solve } from '../_lib/types';
import { EVENTS, isBldEvent, toWcaSpelling, fromWcaSpelling } from '../_lib/types';
import { stageSegmentsFor } from '../_lib/reconstruct/stage_segments';
import { isNonWcaEvent, prefetchNonWca, nextNonWcaScramble } from '../_lib/scramble/nonwca';
import {
  loadAll, saveAll, exportJson, importJson, makeSolve,
  importCstimerJson, exportCsv, exportSpeedstacks,
  listSessions, getActiveSessionId, moveSolveToSession,
} from '../_lib/storage/db';
import { formatTargetTime, useSettings, getSettings, updateSettings } from '../_lib/settings';
import { warmupSound } from '../_lib/sound';
import { setMetronomeHold } from '@/lib/metronome';
import { useBluetoothCube } from '../_lib/bluetooth';
import { mirrorForBrand, readDevQuatSource, sensorBasisForBrand, type Quat } from '../_lib/bluetooth/orientation';
import { GyroRecorder, encodeGyroTrack } from '../_lib/bluetooth/gyro_track';
import { applyScramble, facesEqual, type CubeFaces } from '../_lib/cube/state';
import { hintScramble, type ScrambleHint } from '../_lib/bluetooth/scramble_hint';
import ScrambleHintText from '../_components/ScrambleHintText';
import { createFixupRequester } from '../_lib/bluetooth/scramble_fixup';
import { installFakeCube } from '../_lib/bluetooth/fake_cube';
import { nxnSizeForEvent } from '../_lib/cube/colors';
import { DIGIT_OPENS_SOLVE, bindingForEvent, resolveKeymap } from '../_lib/keymap';
import { useAutoReady } from '../_lib/bluetooth/auto_ready';
import { useStackmat } from '../_lib/stackmat';
import { useBluetoothTimer } from '../_lib/bluetooth/timer';
import { useMultiStage } from '../_lib/multistage';
import { useBldMemo } from '../_lib/useBldMemo';

import StatsPanel from '../_components/StatsPanel';
import CrossSessionStats from '../_components/CrossSessionStats';
import CaseStatsPanel from '../_components/CaseStatsPanel';
import HistoryPanel from '../_components/HistoryPanel';
import { decodeReplayParam } from '../_lib/share/decode';
import { extractReplayParam } from '../_lib/share/paste_import';
import SettingsPanel from '../_components/SettingsPanel';
import GoalProgress from '../_components/GoalProgress';
import RoundPanel from '../_components/RoundPanel';
import { roundAttempts } from '../_lib/round';
import { generateDrillScramble, type DrillType } from '../_lib/scramble/drill';
import SolverHints from '../_components/SolverHints';
import SolverHintPanel, { HINTS_PARAM } from '../_components/SolverHintPanel';
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
import { Spinner } from '@/components/Spinner/Spinner';

import '../timer.css';
import '../_components/charts/charts.css';
import '../_components/charts/practice_heatmap.css';

// 弹层一律 next/dynamic。每一个的渲染都写成 `{xxxOpen && <Modal/>}`,首屏一个都不挂;
// 静态 import 会把这 11 个弹层连同各自的 CSS 一起焊进计时器首屏那个 chunk,而绝大多数
// 用户一次也不会打开它们。ssr:false —— 本文件已经在一个 ssr:false 的动态边界里(page.tsx
// 只在客户端拉 TimerShell),弹层再声明一次只是显式表态,不新增行为。
const BldHelperModal = dynamic(() => import('../_components/BldHelperModal'), { ssr: false });
const SolveModal = dynamic(() => import('../_components/SolveModal'), { ssr: false });
const ReconstructModal = dynamic(() => import('../_components/ReconstructModal'), { ssr: false });
const ShortcutsModal = dynamic(() => import('../_components/ShortcutsModal'), { ssr: false });
const BluetoothModal = dynamic(() => import('../_components/BluetoothModal'), { ssr: false });
const StackmatModal = dynamic(() => import('../_components/StackmatModal'), { ssr: false });
const TrainerSubsetModal = dynamic(() => import('../_components/TrainerSubsetModal'), { ssr: false });
const StatsModal = dynamic(() => import('../_components/StatsModal'), { ssr: false });
const ManualEntryModal = dynamic(() => import('../_components/ManualEntryModal'), { ssr: false });
const SolverModal = dynamic(() => import('../_components/SolverModal'), { ssr: false });
const BulkScrambleModal = dynamic(() => import('../_components/BulkScrambleModal'), { ssr: false });
const DrillModal = dynamic(() => import('../_components/DrillModal'), { ssr: false });
/** 假魔方调试面板只在 dev 存在;判断提到模块级,好让打包器把整个分支和它的
 *  chunk 一起消掉(见 DevFakeCubePanel.tsx)。 */
const DEV_PANEL = process.env.NODE_ENV !== 'production';
const DevFakeCubePanel = dynamic(() => import('../_components/DevFakeCubePanel'), { ssr: false });
import './shell.css';
import { tr } from '@/i18n/tr';

const TRAINER_KINDS = new Set<EventId>(['oll', 'pll', 'coll', 'cmll', 'zbll', 'eg1', 'eg2']);

/** Rolling window for the live TPS readout, in moves. Short enough to react to
 *  a pause or a lockup, long enough not to swing wildly on a single fast pair. */
const TPS_WINDOW_MOVES = 12;

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
  // 非 WCA puzzle(打乱来自 vendored csTimer 引擎,见 _lib/scramble/nonwca.ts)。
  // 清单从 EVENTS 的 'nonwca' 组派生 —— 加一个 puzzle 只改 types.ts + nonwca.ts。
  ...EVENTS.filter(e => e.group === 'nonwca').map(e => ({
    id: e.id as string,
    iconClass: e.icon ?? '',
    label: `${e.nameEn} / ${e.nameZh}`,
    textLabel: e.nameEn,
  })),
];

/** Map a timer EventId -> the id the WcaEventSelector renders as active, and
 *  back. Both directions come from the shared table in _lib/types.ts (the same
 *  one the battle engine's puzzle ids are derived from). */
const eventToSelectorId = toWcaSpelling;
const selectorIdToEvent = fromWcaSpelling;

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

// 「工具」那一档搬进设置弹窗了(见 SettingsPanel 的 tools 节),侧栏只剩成绩 / 图表两档,
// 入口是左下角那块统计(点它就弹出来),底部导航条已整条撤掉。
type PanelTab = 'times' | 'chart';
type ChartKind = 'histogram' | 'trend' | 'scatter' | 'hour' | 'heatmap';

interface SoloViewProps {
  /** The players (人数) select node, injected by the shell at the topbar left. */
  playersControl?: React.ReactNode;
}

export default function SoloView({ playersControl }: SoloViewProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const settings = useSettings();
  const rankCountry = useRankCountry();

  const isMobile = useMediaQuery('(max-width: 480px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');


  // 解法提示的全屏浮层由 SolverHintPanel 经同一个 URL param 开合(手机点 pill、桌面把头部的
  // 形态开关拨到「全屏」都进这一个);这里只读,用来把它算进 anyModalOpen(浮层盖住整屏时,
  // 空格/Escape 不该穿到后面的计时器)。
  const [hintsSheetParam] = useQueryState(HINTS_PARAM, parseAsBoolean.withDefault(false));
  const hintsSheetOpen = hintsSheetParam;

  // ── Side panel (desktop rail / 非桌面整屏) ──────────────────────
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
  // merged 也进签名:合并/分开是两个不同的取题池,切换后必须重置队列,否则继续出旧池的题。
  const wcaDiffSig = settings.wcaDifficultyOn && settings.wcaDiffSteps.length > 0
    ? `${settings.wcaDiffVariant}:${settings.wcaDiffStage}:${settings.wcaDiffColors}:${[...settings.wcaDiffSteps].sort((a, b) => a - b).join('.')}${settings.wcaDiffMerged ? ':m' : ''}`
    : '';
  // 「按步数」WCA 过滤(2×2 / 金字塔):把真实打乱按度量步数筛到 [lo,hi]。与随机来源共用同一组设置。
  const wcaStep = wcaStepFilter(event, settings);
  const wcaStepSig = wcaStep ? `${wcaStep.metric}:${wcaStep.lo}.${wcaStep.hi}` : '';
  // comp + 难度:该场若还没进难度库(离线管道对新赛滞后),难度过滤旁路(出正常整场打乱,不产生空结果),
  // 同时 WcaSourceConfig 会把「难度」开关灰锁。用户的 wcaDifficultyOn 偏好保留(切回已入库比赛/日期即恢复)。
  const [wcaCompUnindexed, setWcaCompUnindexed] = useState(false);
  useEffect(() => {
    const w = wcaEventId(event);
    // 「整体」/「打乱」不查阶段步数索引 → 该场有没有回填与它们无关,不旁路(见 usesStepsIndex)。
    if (settings.scrambleSource !== 'wca' || settings.wcaScrambleMode !== 'comp'
        || !settings.wcaComp || !settings.wcaDifficultyOn || !w
        || !usesStepsIndex(settings.wcaDiffVariant)) { setWcaCompUnindexed(false); return; }
    const cached = getCompCoverage(settings.wcaComp, w);
    if (cached !== null) { setWcaCompUnindexed(cached === false); return; }
    let cancelled = false;
    void probeCompCoverage(settings.wcaComp, settings.wcaCompName, w).then((r) => {
      if (!cancelled) setWcaCompUnindexed(r === false);
    });
    return () => { cancelled = true; };
  }, [settings.scrambleSource, settings.wcaScrambleMode, settings.wcaComp, settings.wcaCompName, settings.wcaDifficultyOn, settings.wcaDiffVariant, event]);
  // 比赛模式但没选比赛 → 回退成「日期全时段随机真题」:仍出真实 WCA 打乱(随机抽),不落本地
  // 随机生成。走 date 池(fillDate,空 from/to = 全时段),经预热后秒出。否则 specKey 对空 comp
  // 返回 null,会静默变成本地生成打乱(见 wca_pool.specKey / fillDate)。
  // 2x2 口径(WCA 11 步 ↔ 最优/Q|H):与 /scramble/gen 同一个全站设置(Scramble222ModePicker)。
  // 真题:optimal → 服务端 God's-number 最优等态(复用 optimal_scramble);随机状态 → 见 scramble222。
  const [mode222] = use222Mode();
  const wcaOptimalOn = event === '222' ? mode222 === 'optimal' : settings.wcaUseOptimal;
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
      optimal: wcaOptimalOn,
      // 难度过滤:未入库的比赛旁路(见 wcaCompUnindexed)。空比赛回退成「全时段随机真题」时仍生效——
      // 难度控件此时照常显示可操作(WcaSourceConfig 只看开关不看有无选中比赛),丢弃会静默出不符条件的
      // 打乱(如选了 0 步十字却拿到普通打乱);date 池服务端 /random 对空 from/to 走飞镖采样带环绕补齐,
      // 稀有档(0 步十字)也能出题。
      diff: !wcaCompUnindexed && settings.wcaDifficultyOn && settings.wcaDiffSteps.length > 0
        ? {
          variant: settings.wcaDiffVariant, stage: settings.wcaDiffStage,
          colors: settings.wcaDiffColors, steps: settings.wcaDiffSteps,
          merged: settings.wcaDiffMerged,
        }
        : undefined,
      stepFilter: wcaStep ?? undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, settings.wcaScrambleMode, settings.wcaComp, settings.wcaCompName, settings.wcaRound, settings.wcaGroup, settings.wcaDateFrom, settings.wcaDateTo, wcaOptimalOn, settings.wcaDifficultyOn, settings.wcaDiffVariant, settings.wcaDiffStage, settings.wcaDiffColors, settings.wcaDiffSteps, settings.wcaDiffMerged, wcaStepSig, wcaCompUnindexed]);
  const wcaSpecRef = useRef(wcaSpec);
  wcaSpecRef.current = wcaSpec;
  const wcaSourceSig = settings.scrambleSource === 'wca'
    ? `${settings.wcaScrambleMode}|${settings.wcaComp}|${settings.wcaRound}|${settings.wcaGroup}|${settings.wcaDateFrom}|${settings.wcaDateTo}|${event}|${wcaDiffSig}|${wcaStepSig}|${wcaCompUnindexed ? 'U' : ''}|${wcaOptimalOn ? 'O' : ''}`
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
    // 非 WCA puzzle:打乱在 csTimer Worker 里算,nonwca.ts 自带队列。别再套一层
    // scramble_pool —— 那会把「还在生成」的 '' 也缓存进 buffer。'' 由下面的 effect 补。
    if (isNonWcaEvent(event)) return generateScramble(event);
    // 「按步数生成」(2×2 / 金字塔):从完整状态空间均匀采样、按所选度量最优步数过滤(非案例库)。
    // 度量+区间进 pool key,改设置即换 buffer;拒绝采样 + IDA* 在后台 idle 生成,不阻塞计时。
    const byStepsScr = genByStepsScramble(event, s);
    if (byStepsScr) return takeScramble(byStepsScr.key, byStepsScr.gen, canGenScramble);
    return takeScramble(`${event}|${s.cnMode}|${event === '222' ? mode222 : ''}`, () => generateScramble(event), canGenScramble);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillTarget, drillAllowed, event, settings.scrambleSource, wcaSourceSig, genStepsSig, manualSig, canGenScramble, mode222]);

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
  // 「预打乱朝向」只进打乱图,不改打乱正文(同 csTimer:正文保持官方口径,图按你手持的朝向画)。
  const previewScramble = applyOrientationPrefix(
    scramble,
    preScrambleFor(event, settings.preScr, settings.preScrT),
  );

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

  // 非 WCA puzzle(FTO / 二阶五魔 / 齿轮…):打乱由 vendored csTimer 引擎在 Worker 里算
  // (随机态 IDA*,FTO 单条 1~3s),同 WCA 真题一样是异步的 —— 队列干了就先出 '',这里补上,
  // 期间显示转圈(而不是掉进 '—' 或退化成三阶打乱)。队列已有货时只做后台预取,不动当前打乱。
  // 手动输入模式例外:那里的 '' 表示「队列是空的,去粘贴打乱」(strip 有对应提示),
  // 不是「还在生成」—— 塞一条生成打乱进去会把提示吞掉。
  const [nonWcaLoading, setNonWcaLoading] = useState(false);
  useEffect(() => {
    if (!isNonWcaEvent(event) || settings.scrambleSource === 'manual') { setNonWcaLoading(false); return; }
    prefetchNonWca(event);
    if (scramble !== '') { setNonWcaLoading(false); return; }
    let cancelled = false;
    setNonWcaLoading(true);
    void nextNonWcaScramble(event).then((real) => {
      if (cancelled) return;
      setNonWcaLoading(false);
      const cur = scrambleHistRef.current;
      if (!real || cur.list[cur.idx] !== '') return;
      const list = [...cur.list];
      list[cur.idx] = real;
      applyScrambleHist({ list, idx: cur.idx });
    });
    return () => { cancelled = true; };
  }, [event, scramble, settings.scrambleSource, applyScrambleHist]);

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
  const wcaNonOptimal = wcaOptimalOn && !!wcaSource?.nonOptimal;
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
    if (s.penalty === 'DNF' || s.penalty === 'DNS') return;
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

  /** Load a past solve's scramble. Pushed onto the history rather than
   *  replacing the current one, so the arrows still walk back to where the
   *  user was. */
  const useScramble = useCallback((text: string) => {
    const t = (text ?? '').trim();
    if (!t) return;
    applyScrambleHist(histPush(scrambleHistRef.current, t));
  }, [applyScrambleHist]);

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
  /** The smart cube connected when the attempt STARTED. Snapshotted with the
   *  other at-start refs so a mid-solve disconnect can't erase who solved it. */
  const deviceAtStartRef = useRef<{ model: string; name: string } | null>(null);

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
    // 姿态流。没开录 / 魔方没报姿态 / 一次都没动 → take() 是空的,编码给 null,
    // 字段整个不出现 —— 回放面板就是靠「有没有这个字段」决定要不要给陀螺仪开关的。
    const gyro = encodeGyroTrack(gyroRecRef.current.take());
    if (gyro && solve.moves) solve.gyro = gyro;
    // Inspection actually used (0 when inspection was off / never entered).
    if (res.inspectionMs > 0) solve.inspectionMs = Math.round(res.inspectionMs);
    // Which cube solved it — only meaningful when the solve has a move stream.
    if (solve.moves && deviceAtStartRef.current) solve.device = deviceAtStartRef.current;
    // CFOP segmentation, computed now so the case labels and stage splits are
    // in storage from the moment the solve lands. Everything downstream reads
    // the stored segments rather than recomputing (case stats, the OLL/PLL
    // history filters, auto-tags, CSV export), so a solve without them is
    // invisible to all of them until the user runs a manual re-analysis.
    // A walk over the stream plus four recognizer lookups: 0.23ms for a real
    // 64-turn solve, 0.51ms for a 320-turn one, and the timer has already
    // stopped by the time we get here.
    const segs = stageSegmentsFor(solve);
    if (segs) solve.stageSegments = segs;
    setLastPenalty(res.autoPenalty);

    // 破纪录(单次/Ao5/Ao12)时桌宠开心一下;不再弹横幅,纪录改在统计面板用 PR 标体现。
    {
      const before = byEventRef.current[ev] ?? [];
      const after = [...before, solve];
      const isNew = (b: number | null, a: number | null): boolean =>
        a !== null && Number.isFinite(a) && (b === null || !Number.isFinite(b) || a < b);
      // MBLD ranks by points first and only then by time (WCA 9f12c), so
      // "smaller number is better" is simply the wrong comparison for it —
      // a slower 11/13 beats a faster 5/6. Averages aren't shown for MBLD.
      const newSingle = ev === '333mbld'
        ? (() => {
            const b = bestMbldSolve(before);
            const a = bestMbldSolve(after);
            return a !== null && (b === null || compareMbld(a, b) < 0);
          })()
        : isNew(bestSingle(before, ev), bestSingle(after, ev));
      if (newSingle
        || (ev !== '333mbld' && (isNew(bestAverageOfN(before, 12), bestAverageOfN(after, 12))
          || isNew(bestAverageOfN(before, 5), bestAverageOfN(after, 5))))) {
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

  // Set when the smart cube started this attempt. That path has already done
  // the bookkeeping below — at the true start instant, with the turn that
  // started the clock already in `movesRef` — so redoing it here would throw
  // away the solve's first move.
  const cubeStartedRef = useRef(false);
  useEffect(() => {
    if (timer.phase !== 'running') {
      cubeStartedRef.current = false;
      scrambleAtStartRef.current = scramble;
      eventAtStartRef.current = event;
      caseIdAtStartRef.current = TRAINER_KINDS.has(event)
        ? getLastPickedCase(event as TrainerKind)
        : null;
      const bt = bluetoothCubeRef.current?.status;
      deviceAtStartRef.current = bt?.connected
        ? { model: bt.brand, name: bt.deviceName }
        : null;
    } else if (!cubeStartedRef.current) {
      movesRef.current = [];
      solveStartTsRef.current = performance.now();
      gyroRecRef.current.reset();
      gyroStartRef.current = solveStartTsRef.current;
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

  // ── Orientation (gyroscope) ─────────────────────────────────────
  // The sample rate is 20-50 Hz and the only consumer is the 3D view's frame
  // loop, so the value lives in a ref: putting it in state would re-render this
  // entire shell at gyro cadence for a number nothing here reads.
  const gyroQuatRef = useRef<Quat | null>(null);
  const [calibrateNonce, setCalibrateNonce] = useState(0);
  const want3dLiveCube = settings.liveCubeView === '3d';
  // 姿态流录制。样本时刻用 performance.now() 而不是 solveStartTsRef —— 后者在
  // 「魔方起表」那条路上存的是**设备时钟**,而陀螺仪回调根本不带时间戳,两个
  // 时钟相减出来的是垃圾。这里自己记一个本地起点。
  const gyroRecRef = useRef(new GyroRecorder());
  const gyroStartRef = useRef(0);
  // What the live view actually rendered. LiveCubeState decides — it owns the
  // phone / no-sample / not-anchored fallbacks — and reports back, because the
  // calibrate button below must follow the outcome, not the request.
  const [liveCubeView, setLiveCubeView] = useState<'2d' | 'net' | '3d'>('net');

  /**
   * The first turn of an armed attempt starts the clock — csTimer's behaviour
   * (`timer/giiker.js:166`), and the missing half of auto-ready: arming used to
   * leave the timer waiting for a space bar the user's hands had already left,
   * so the inspection countdown just ran on to DNF while they solved.
   *
   * Assigned every render rather than memoised because it closes over `timer`,
   * and the BLE handler reads it through the ref — same shape as
   * `consumeFacesRef` / `externalTimeRecordRef` above.
   */
  const startFromCubeRef = useRef<(ts: number) => void>(() => {});
  startFromCubeRef.current = (ts: number) => {
    if (!getSettings().timingEnabled) return; // 练习模式:换题不计时
    // The phase check lives inside startFromCube, against the timer's own
    // synchronous phase — two turns from one BLE batch must not start twice.
    if (!timer.startFromCube(ts)) return;
    phaseSnapshotRef.current = 'running';
    cubeStartedRef.current = true;
    movesRef.current = [];
    solveStartTsRef.current = ts;
    gyroRecRef.current.reset();
    gyroStartRef.current = performance.now();
  };

  /**
   * dev 专用:没有真魔方时把**录制**这条路走通。
   *
   * 假魔方(`__cuberootFakeCube`)立的是 GAN v4 的 GATT,但它不发姿态帧,所以
   * `onGyro` 永远不会响 —— 3D 实况那边靠的是 `LiveCubeState` 自己轮询
   * `window.__cuberootFakeQuat`(见那个文件的 `useSyntheticQuat`),那条路绕开了
   * 蓝牙层,录制器就看不见。这里按同样的节奏、同样的来源补一路,让录制在没有
   * 硬件的时候也能被真的验一遍。
   *
   * 生产构建里整段被 `NODE_ENV` 判断消掉,和它模仿的那个 hook 一样。
   */
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!settings.recordGyro || timer.phase !== 'running') return;
    const id = setInterval(() => {
      const q = readDevQuatSource(performance.now());
      if (!q) return;
      gyroQuatRef.current = q;
      gyroRecRef.current.push(q, performance.now() - gyroStartRef.current);
    }, 40);
    return () => clearInterval(id);
  }, [settings.recordGyro, timer.phase]);

  const bluetoothCube = useBluetoothCube({
    // Passing onGyro is what turns the stream on at all (MoYu32 has an explicit
    // enable opcode), so only ask for it when the 3D view could use it.
    onGyro: (want3dLiveCube || settings.recordGyro)
      ? (q) => {
        gyroQuatRef.current = q;
        // 只在真的在计时的时候录:观察阶段和拧完之后的姿态不属于这一把。
        if (settings.recordGyro && phaseSnapshotRef.current === 'running') {
          gyroRecRef.current.push(q, performance.now() - gyroStartRef.current);
        }
      }
      : undefined,
    onMove: (move: string, ts: number) => {
      // Before the broadcast, deliberately: if this turn starts the clock, the
      // subscribers below have to see it as the solve's first move. They read
      // the phase from `phaseSnapshotRef`, which this sets synchronously —
      // waiting for React to re-render would lose the move, and BLE can hand us
      // two turns of the same batch inside one call stack.
      startFromCubeRef.current(ts);
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
    // The hook has always emitted these; nothing consumed them, so a cube that
    // dropped mid-session went quiet with no explanation. Surface them.
    onConnectionEvent: (ev) => {
      // A solve in progress just lost the thing that stops the clock. csTimer
      // interrupts the attempt here (`timer.js:715` synthesises ESC, which
      // records a DNF); we tell the user instead. Two reasons: the reconnect
      // ladder we have and it doesn't often rescues the attempt outright, and
      // throwing one away cannot be undone — a five-minute BLD attempt killed
      // by a radio glitch is a worse outcome than any wording. The space bar
      // still stops the clock, so saying so is a complete answer.
      if (ev.kind === 'disconnected' && phaseSnapshotRef.current === 'running') {
        setInfoToast({
          msg: tr({
            zh: '智能魔方断开,这一把不会自动停表 —— 按空格自己停',
            en: 'Smart cube disconnected — this attempt won’t auto-stop; press space to stop it',
          }),
        });
        return;
      }
      if (ev.kind === 'disconnected' && ev.reason === 'manual') return; // user asked for it
      setInfoToast({
        msg:
          ev.kind === 'disconnected'
            ? tr({ zh: '智能魔方连接断开', en: 'Smart cube disconnected' })
            : ev.kind === 'reconnecting'
              ? tr({
                  zh: `正在重连智能魔方（第 ${ev.attempt}/${ev.maxAttempts} 次）`,
                  en: `Reconnecting to smart cube (${ev.attempt}/${ev.maxAttempts})`,
                })
              : ev.kind === 'reconnected'
                ? tr({ zh: '智能魔方已重新连接', en: 'Smart cube reconnected' })
                : tr({ zh: '智能魔方重连失败，请重新配对', en: 'Smart cube reconnect failed — pair again' }),
      });
    },
  });

  useAutoReady({
    // 'scrambled' is not a move-stream gesture, so it is handled by the effect
    // below instead — this hook only knows about turns.
    enabled: (settings.bluetoothAutoReady === 'still' || settings.bluetoothAutoReady === 'double-flick')
      && bluetoothCube.status.connected,
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

  // Dev-only: publish the fake-smart-cube console API. Gives the whole
  // smart-cube flow (connect → scramble check → auto-stop → live view) a way
  // to be exercised without hardware. No-op in production builds.
  const scrambleForFakeRef = useRef(scramble);
  scrambleForFakeRef.current = scramble;
  useEffect(() => { installFakeCube(() => scrambleForFakeRef.current); }, []);

  // ── Live cube-state mirror ──────────────────────────────────────
  // The flat views read `bluetoothCube.facelets` (the cube's own state)
  // directly. This log exists only for the 3D view, which is alg-driven: it
  // is anchored either at the last moment the cube was SOLVED or at a derived
  // opening (see the anchor effect below), so replaying it from a solved cube
  // reproduces the current state exactly. `algAnchored` says whether that
  // anchor exists at all — without it the 3D view would be drawing a state
  // nobody verified, so we stay on the flat one.
  const [liveMoves, setLiveMoves] = useState<string[]>([]);
  const [algAnchored, setAlgAnchored] = useState(false);
  useEffect(() => {
    const subs = bluetoothSubscribersRef.current;
    const mirror = (m: string) => { setLiveMoves(prev => [...prev, m]); };
    subs.add(mirror);
    return () => { subs.delete(mirror); };
  }, []);
  const cubeConnected = bluetoothCube.status.connected;
  const cubeSolved = bluetoothCube.solved;
  useEffect(() => {
    if (!cubeConnected) { setLiveMoves([]); setAlgAnchored(false); return; }
    // Runs after the move that solved the cube has already been appended
    // above, so clearing here leaves the log correctly empty.
    if (cubeSolved) { setLiveMoves([]); setAlgAnchored(true); }
  }, [cubeConnected, cubeSolved]);

  // Connect a cube that is ALREADY scrambled and there is no anchor: nobody
  // knows how it got that way, so the 3D view had nothing to replay and the
  // first solve of a session never got one. The missing piece is not the
  // renderer, it is the opening — and the cube reports its own facelets, so we
  // can solve for it (see _lib/bluetooth/anchor.ts, which also verifies the
  // result before handing it over).
  //
  // Ordering: moves that land while the solver is running have already been
  // appended, so the answer is spliced in FRONT of them rather than replacing
  // the log.
  //
  // ONCE PER CONNECTION, and the ref is what enforces it: `facelets` changes on
  // every single turn, so keying the attempt on its value would fire a fresh
  // two-phase solve per move for as long as the cube stays un-anchored. One
  // attempt is also the right answer for a state the solver rejects — retrying
  // it per turn would just burn the worker on the same impossible cube.
  const anchorAskedRef = useRef(false);
  const liveMovesLenRef = useRef(0);
  liveMovesLenRef.current = liveMoves.length;
  const anchorFacelets = cubeConnected && !algAnchored ? bluetoothCube.facelets : null;
  useEffect(() => {
    if (!anchorFacelets || anchorAskedRef.current) return;
    anchorAskedRef.current = true;
    const baseLen = liveMovesLenRef.current;
    let cancelled = false;
    void (async () => {
      const { anchorAlgFor } = await import('../_lib/bluetooth/anchor');
      const tokens = await anchorAlgFor(anchorFacelets);
      if (cancelled || tokens === null) return;
      setLiveMoves(prev => [...tokens, ...prev.slice(baseLen)]);
      setAlgAnchored(true);
    })();
    return () => { cancelled = true; };
  }, [anchorFacelets]);
  // A disconnect must let the next connection ask again.
  useEffect(() => { if (!cubeConnected) anchorAskedRef.current = false; }, [cubeConnected]);

  // ── The cube picture under the digits ───────────────────────────
  // One box, two tenants. Without a smart cube it shows the scramble — the
  // state you are trying to REACH. With one connected it shows the cube itself
  // — the state you are actually IN — because that strictly dominates: the app
  // already tells you whether the two agree ("matches the scramble") and hands
  // you the moves back when they don't, so a static target picture beside a
  // live one is the same fact twice.
  //
  // Both tenants render into `.shell-corner-net-imgbox`, whose height is the
  // `--cube-h` token. Connecting a cube therefore swaps the picture without
  // moving anything below it.
  const centerCubeSlot = cubeConnected ? (
    <div className="shell-corner-net">
      <div className="shell-corner-net-imgbox">
        <div
          className="timer-live-cube"
          title={tr({ zh: '智能魔方实时状态（每次拧动同步）', en: 'Live smart-cube state (updates per move)' })}
        >
          <LiveCubeState
            facelets={bluetoothCube.facelets}
            moves={liveMoves}
            algAnchored={algAnchored}
            // 陀螺仪只决定这颗魔方**朝哪儿**,不决定它是什么状态 —— 没有姿态流
            // 的魔方照样该用 3D:贴纸一模一样准,而且每拧一手能把那一层转给你看,
            // 展开图做不到。没姿态就用引擎自己的等轴视角,不假装在跟手。
            mode={want3dLiveCube ? '3d' : (settings.liveCubeView === '2d' ? '2d' : 'net')}
            quatRef={gyroQuatRef}
            calibrateToken={calibrateNonce}
            sensorBasis={sensorBasisForBrand(bluetoothCube.status.brand)}
            mirror={mirrorForBrand(bluetoothCube.status.brand)}
            onViewChange={setLiveCubeView}
          />
        </div>
      </div>
      {/* Which way the sensor thinks is "up" is unverified for every brand, so
          the fix is manual: hold the cube upright, tap, and that pose becomes
          the reference. A real <button> — shouldIgnoreTimerTarget already lets
          presses on one through without arming the timer.

          Gated on the view that actually rendered, not on the one requested:
          phones and a state not reachable from solved fall back to the flat
          net, and there is nothing there to calibrate. Also gated on the cube
          actually having a gyro — the 3D view no longer needs one, so "3D is
          on screen" stopped implying "there is an orientation to calibrate",
          and a button that does nothing is worse than no button. */}
      {liveCubeView === '3d' && bluetoothCube.status.hasGyro && (
        <button
          type="button"
          className="live-cube-calibrate"
          onClick={() => setCalibrateNonce(n => n + 1)}
          title={tr({
            zh: '把魔方当前朝向设为正面朝上的基准',
            en: 'Set the cube’s current orientation as the upright reference',
          })}
        >
          {tr({ zh: '校准朝向', en: 'Calibrate' })}
        </button>
      )}
    </div>
  ) : settings.showCubePreview ? (
    <div className="shell-corner-net">
      <div className="shell-corner-net-imgbox">
        <div className="shell-corner-net-img">
          <CubePreview event={event} scramble={previewScramble} height="var(--cube-h)" visualization={settings.prefer3D ? '3D' : '2D'} />
        </div>
      </div>
    </div>
  ) : undefined;

  // ── Scramble verification ───────────────────────────────────────
  // A smart cube knows its own state, so it can answer the one question the
  // scramble line can't: did the user actually apply it correctly? We compare
  // the tracked facelets against the scramble applied to a solved cube.
  //
  // Only 3x3: the tracker models a 3x3 (every smart cube on the market is one),
  // and events whose scramble isn't plain face notation (FMC's solution, MBLD's
  // multiple scrambles) have nothing meaningful to compare against.
  const scrambleTarget = useMemo<CubeFaces | null>(() => {
    if (nxnSizeForEvent(event) !== 3) return null;
    if (event === '333fm' || event === '333mbld') return null;
    if (!scramble.trim()) return null;
    try { return applyScramble(3, scramble); } catch { return null; }
  }, [event, scramble]);

  // null = not applicable / nothing to say yet. The tracker only means anything
  // once the cube has actually been turned, so we stay quiet until then.
  const [scrambleMatch, setScrambleMatch] = useState<boolean | null>(null);
  // Where in the scramble the cube is, for step-by-step hinting. null = we have
  // nothing to say: no cube, no comparable scramble, or the cube is off the
  // scramble's path entirely (in which case the binary verdict is all we have).
  const [scrambleHint, setScrambleHint] = useState<ScrambleHint | null>(null);
  // A correction path: when the cube leaves the scramble's path, the solver
  // gives us a way from where it IS to the same scrambled state, and the strip
  // hints on that instead of just saying "wrong". `from` is the state it was
  // computed at — the walk has to start there, not at solved.
  const fixupRef = useRef<{ from: CubeFaces; seq: string } | null>(null);
  const [fixupActive, setFixupActive] = useState(false);
  const scrambleTargetRef = useRef<CubeFaces | null>(null);
  const scrambleTextRef = useRef<string>('');
  const clearFixup = useCallback(() => {
    fixupRef.current = null;
    setFixupActive(false);
  }, []);
  useEffect(() => {
    scrambleTargetRef.current = scrambleTarget;
    // The hint is computed against the same string the strip renders, so keep
    // them in lockstep: a stale hint would dim the wrong moves.
    scrambleTextRef.current = scrambleTarget ? scramble : '';
    setScrambleMatch(null);
    setScrambleHint(null);
    clearFixup();
  }, [scrambleTarget, scramble, clearFixup]);
  /**
   * 「打乱正确即预备」 —— csTimer's default (`giiSD='s'`, `giiker.js:143`). Once the
   * scramble is on the cube there is nothing left for the user to signal: the
   * cube can see it matches, so a keypress on top of that exists only because
   * software used not to be able to tell. Arming is passive — the clock still
   * waits for the first turn — which is what makes this safe as a default.
   */
  const armFromScrambleRef = useRef<() => void>(() => {});
  armFromScrambleRef.current = () => {
    const s = getSettings();
    if (s.bluetoothAutoReady !== 'scrambled' || !s.timingEnabled) return;
    const ph = phaseSnapshotRef.current;
    if (ph !== 'idle' && ph !== 'stopped') return;
    warmupSound();
    timer.onPressDown();
  };

  /** Ask the solver for a path from where the cube is to `target`, then hint. */
  const fixupRequester = useMemo(() => createFixupRequester({
    faces: () => bluetoothCubeRef.current?.getFaces() ?? null,
    valid: (target) => scrambleTargetRef.current === target && phaseSnapshotRef.current !== 'running',
  }), []);
  const requestFixup = useCallback(async (target: CubeFaces) => {
    const res = await fixupRequester.request(target);
    if (!res) return;
    fixupRef.current = { from: res.from, seq: res.seq };
    setFixupActive(true);
    setScrambleHint(res.hint);
  }, [fixupRequester]);
  useEffect(() => {
    const subs = bluetoothSubscribersRef.current;
    const verify = () => {
      const target = scrambleTargetRef.current;
      if (!target) return;
      // Only meaningful before the solve starts — mid-solve the cube is
      // deliberately no longer in the scrambled state.
      const ph = phaseSnapshotRef.current;
      if (ph === 'running') return;
      const faces = bluetoothCubeRef.current?.getFaces();
      if (!faces) return;
      const match = facesEqual(faces, target);
      setScrambleMatch(match);
      // 「打乱正确即预备」 belongs here and not in an effect over `scrambleMatch`:
      // it is the EVENT of a turn completing the scramble, not the state of
      // matching. As state it also fires on the commit where a solve ends —
      // `scrambleMatch` is still the `true` from before the solve there (the
      // check skips while running), so every solve armed the next attempt and
      // the next scramble's own turns started the clock.
      if (match) armFromScrambleRef.current();
      const text = scrambleTextRef.current;
      if (!text) { setScrambleHint(null); clearFixup(); return; }
      // Order matters, and it is csTimer's (`bluetoothutil.js:71`): a live
      // correction path wins, because that is what the user is following.
      const fx = fixupRef.current;
      if (fx) {
        const h = hintScramble(fx.seq, faces, fx.from);
        if (h && !h.complete) { setScrambleHint(h); return; }
        // Finished it (so we are at the scramble) or left it too — either way
        // the correction is spent, fall through to the scramble itself.
        clearFixup();
      }
      const raw = hintScramble(text, faces);
      if (raw) { setScrambleHint(raw); return; }
      // Off the scramble's path entirely. Until the solver answers, the binary
      // verdict is all we have.
      setScrambleHint(null);
      void requestFixup(target);
    };
    subs.add(verify);
    return () => { subs.delete(verify); };
  }, [clearFixup, requestFixup]);
  // Mid-solve the strip goes back to plain text: the cube has left the
  // scrambled state on purpose, so "you still owe R" would be nonsense.
  useEffect(() => {
    if (timer.phase === 'running') { setScrambleHint(null); clearFixup(); }
  }, [timer.phase, clearFixup]);


  // ── Round simulation ────────────────────────────────────────────
  // The round is a VIEW over the solve history, not a second store: it is the
  // tail slice of this event's solves. That keeps solves as the single source
  // of truth (deleting one just shortens the round) and means nothing extra
  // has to be persisted or migrated.
  //
  // `roundStartCount` is how many solves existed when the user asked for a new
  // round. null = no explicit start, so the round is simply the last N solves,
  // which is what you want when you turn the feature on mid-session.
  const [roundStartCount, setRoundStartCount] = useState<number | null>(null);
  useEffect(() => { setRoundStartCount(null); }, [event]);
  const startNewRound = useCallback(() => {
    setRoundStartCount(solvesRef.current.length);
  }, []);
  const roundSolves = useMemo(() => {
    if (!settings.round.on) return [];
    const n = roundAttempts(settings.round.format);
    // Clamp: deleting solves can leave the marker past the end of the list.
    const from = roundStartCount === null
      ? Math.max(0, solves.length - n)
      : Math.min(roundStartCount, solves.length);
    return solves.slice(from, from + n);
  }, [solves, roundStartCount, settings.round.on, settings.round.format]);

  // ── Live move count + TPS ───────────────────────────────────────
  // Turns per second was previously only available after the fact, in the
  // reconstruction modal. The move recorder already stamps every turn, so the
  // same numbers can be shown live. Rolling rather than cumulative: an average
  // over the whole solve barely moves after a few seconds, which makes it
  // useless as feedback — a short window actually tracks what the hands do.
  const [liveTps, setLiveTps] = useState<{ count: number; tps: number } | null>(null);
  // Own window rather than reading movesRef: subscriber order in the Set is an
  // implementation detail, and depending on the recorder having already pushed
  // this move would be a silent off-by-one if that ever changed.
  const tpsWindowRef = useRef<number[]>([]);
  const tpsCountRef = useRef(0);
  useEffect(() => {
    const subs = bluetoothSubscribersRef.current;
    const meter = (_m: string, ts: number) => {
      if (phaseSnapshotRef.current !== 'running') return;
      const win = tpsWindowRef.current;
      win.push(ts);
      if (win.length > TPS_WINDOW_MOVES) win.shift();
      tpsCountRef.current += 1;
      const span = win.length > 1 ? ts - win[0] : 0;
      setLiveTps({
        count: tpsCountRef.current,
        tps: span > 0 ? ((win.length - 1) * 1000) / span : 0,
      });
    };
    subs.add(meter);
    return () => { subs.delete(meter); };
  }, []);
  useEffect(() => {
    if (timer.phase === 'running') return;
    tpsWindowRef.current = [];
    tpsCountRef.current = 0;
    setLiveTps(null);
  }, [timer.phase]);

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

  // ── External timing devices (Stackmat mic + BLE smart timers) ───
  // All of them hand us a time the DEVICE measured, so we record it verbatim
  // rather than re-timing locally.
  const externalTimeRecordRef = useRef<((ms: number) => void) | null>(null);
  externalTimeRecordRef.current = (ms: number) => {
    const solve = makeSolve({ timeMs: ms, scramble: scrambleAtStartRef.current, event, penalty: 'ok' });
    setLastPenalty('ok');
    setByEvent(prev => ({ ...prev, [event]: [...(prev[event] ?? []), solve] }));
    nextScramble();
  };
  const stackmat = useStackmat({ onStop: (ms) => externalTimeRecordRef.current?.(ms) });

  const bleTimer = useBluetoothTimer({
    onStop: (ms) => externalTimeRecordRef.current?.(ms),
    onNeedMac: (deviceName) => requestMac(deviceName),
    onConnectionLost: () => {
      setInfoToast({ msg: tr({ zh: '计时器连接断开', en: 'Timer disconnected' }) });
    },
  });

  // ── Metronome ───────────────────────────────────────────────────
  // Holds the shared metronome on for the inspect/solve stretch instead of
  // driving it directly, so it hands control straight back to the floating
  // panel afterwards (and never stops a panel the user started themselves).
  // Releasing only on unmount keeps the beat continuous across inspect→run.
  useEffect(() => {
    setMetronomeHold('timer',
      settings.metronomeOn && (timer.phase === 'inspecting' || timer.phase === 'running'));
  }, [settings.metronomeOn, timer.phase]);

  useEffect(() => () => setMetronomeHold('timer', false), []);

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
    if (patch.penalty === 'DNF' || patch.penalty === 'DNS') petReact('error');
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
  const [stackmatOpen, setStackmatOpen] = useState(false);
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
  // 成绩 / 图表面板在非桌面宽度下是整屏的(桌面是右侧常驻栏,不挡计时器),所以只有
  // 整屏那一形态要算进「有东西盖住计时器」—— 否则空格会穿到后面预备计时。
  const panelFullscreen = panelTab !== null && !isDesktop;
  const otherModalOpen =
    settingsOpen || shortcutsOpen || bluetoothOpen || stackmatOpen ||
    trainerSubsetOpen !== null || statsModalOpen ||
    manualEntryOpen || solverOpen || bulkScrambleOpen ||
    drillModalOpen || bldHelperOpen || panelFullscreen ||
    modalSolve !== null || reconstructSolve !== null;
  // 整屏之后没有「点空白处关掉」了(遮罩全被盖住,已删),所以 Escape 得亲自接住 ——
  // 主键盘处理器见 anyModalOpenRef 那道闸,面板开着时它整个不响应,不会误触 reset()。
  useEffect(() => {
    if (!panelFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanelTab(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelFullscreen]);

  const anyModalOpen = otherModalOpen || hintsSheetOpen;
  const anyModalOpenRef = useRef(anyModalOpen);
  useEffect(() => { anyModalOpenRef.current = anyModalOpen; }, [anyModalOpen]);
  // 解法全屏浮层是唯一的例外:它盖住整屏,但讲的就是眼前这条打乱 —— 换题键(默认左右键)
  // 仍要能用,否则全屏形态下只能先关掉浮层才能换题。其余键照旧被吞(空格不能穿到后面预备计时)。
  const hintsOnlyRef = useRef(false);
  useEffect(() => { hintsOnlyRef.current = hintsSheetOpen && !otherModalOpen; }, [hintsSheetOpen, otherModalOpen]);
  // 换题(浮层里的键盘 / 手势共用):计时、预备、观察进行中不换 —— 那会把正在解的题换掉。
  const canSwitchScramble = useCallback(() => {
    const ph = phaseRef.current;
    return !(ph === 'running' || ph === 'holding' || ph === 'ready' || ph === 'inspecting');
  }, []);
  const sheetPrevScramble = useCallback(() => { if (canSwitchScramble()) prevScramble(); }, [canSwitchScramble, prevScramble]);
  const sheetNextScramble = useCallback(() => { if (canSwitchScramble()) nextScramble(); }, [canSwitchScramble, nextScramble]);
  // Through a ref so rebinding a key doesn't tear down and re-add the window
  // listeners — and so the handler's dep array stays as it was.
  const resolvedKeymap = useMemo(() => resolveKeymap(settings.keymap), [settings.keymap]);
  const keymapRef = useRef(resolvedKeymap);
  useEffect(() => { keymapRef.current = resolvedKeymap; }, [resolvedKeymap]);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (anyModalOpenRef.current) {
        // 解法全屏浮层:只放行「上/下一个打乱」这两个动作(见 hintsOnlyRef 处的注释),
        // 走的是同一份可改键位表,所以用户改过键位在浮层里也照样生效。
        if (!hintsOnlyRef.current || e.repeat) return;
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
        const b = bindingForEvent(e);
        const a = b ? keymapRef.current[b] : undefined;
        if (a !== 'next-scramble' && a !== 'prev-scramble') return;
        e.preventDefault();
        (a === 'prev-scramble' ? sheetPrevScramble : sheetNextScramble)();
        return;
      }
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
      // ── Rebindable tail. Everything above this point is fixed: it either
      //    guards the handler or owns Space/Escape, which must always work.
      const cur = solvesRef.current;
      const last = cur[cur.length - 1];
      const binding = bindingForEvent(e);
      const action = binding ? keymapRef.current[binding] : undefined;
      const togglePenalty = (p: Penalty) => {
        if (!last) return;
        const next: Penalty = last.penalty === p ? 'ok' : p;
        updateSolve(last.id, { penalty: next });
        setLastPenalty(next);
      };
      switch (action) {
        case 'delete-last':
          if (last) { deleteSolve(last.id); setLastPenalty(null); }
          return;
        case 'toggle-plus2': togglePenalty('+2'); return;
        case 'toggle-dnf': togglePenalty('DNF'); return;
        case 'toggle-dns': togglePenalty('DNS'); return;
        // Arrow keys scroll the page by default; the others don't need it.
        case 'next-scramble': e.preventDefault(); nextScramble(); return;
        case 'prev-scramble': e.preventDefault(); prevScramble(); return;
        case 'toggle-fullscreen': toggleFullscreen(); return;
        default: break;
      }
      // Digit1-9 opens the Nth-from-last solve. Not rebindable (it's a family,
      // not one action) and checked after the keymap, so a digit bound to an
      // action — Digit2 → +2 by default — keeps shadowing it, as it always has.
      const m = e.code.match(DIGIT_OPENS_SOLVE);
      if (m && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const n = Number(m[1]);
        const idx = cur.length - n;
        if (idx >= 0) setModalSolve({ s: cur[idx], idx });
      }
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
  }, [onPressDown, onPressUp, reset, updateSolve, deleteSolve, nextScramble, prevScramble,
    sheetNextScramble, sheetPrevScramble, toggleFullscreen, multiStageActive, bldMemoActive]);

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
    // External timing devices. These used to sit inside the mobile-only block,
    // which made the Stackmat toggle unreachable on desktop — exactly where a
    // Stackmat is most likely to be plugged in.
    {
      icon: <Mic size={14} />,
      label: stackmat.status.listening
        ? tr({ zh: 'Stackmat 监听中', en: 'Stackmat listening' })
        : tr({ zh: 'Stackmat 计时器（麦克风）', en: 'Stackmat timer (mic)' }),
      // Opens the panel rather than toggling straight away: which audio input
      // the browser picked, and whether frames are decoding at all, is the
      // difference between "works" and "silently does nothing".
      onClick: () => setStackmatOpen(true),
    },
    {
      icon: <Timer size={14} />,
      label: bleTimer.status.connected
        ? tr({
            zh: `计时器：${bleTimer.status.deviceName}（点击断开）`,
            en: `Timer: ${bleTimer.status.deviceName} (disconnect)`,
          })
        : tr({ zh: '连接蓝牙计时器', en: 'Connect Bluetooth timer' }),
      onClick: async () => {
        if (bleTimer.status.connected) { bleTimer.disconnect(); return; }
        try { await bleTimer.connect(); }
        catch (err) {
          const kind = (err as Error & { kind?: string }).kind;
          setInfoToast({
            msg: kind === 'no-web-bluetooth'
              ? tr({ zh: '当前浏览器不支持 Web Bluetooth', en: 'This browser has no Web Bluetooth' })
              : tr({
                  zh: `连接计时器失败：${(err as Error).message}`,
                  en: `Timer connect failed: ${(err as Error).message}`,
                }),
          });
        }
      },
    },
    ...(isMobile ? [
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
    // Speffz 记忆读数只对 3x3 盲拧有意义。原来写的是 startsWith('333'),于是 3x3 / OH / FM / MR
    // 这些非盲项目也挂着这一项。三个 3x3 盲拧项目都要:三盲、三盲 NI(不给观察)、多盲(逐个
    // 魔方还是同一套编码)。4BLD 以上不算 —— 那是另一套编码,这个助手只读 3x3 打乱。
    ...(event === '333bld' || event === '333ni' || event === '333mbld' ? [{
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
  ], [isZh, handleImport, handleExport, handleExportCsv, handleExportSs, clearAll, solves.length, drillAllowed, drillTarget, fullscreen, toggleFullscreen, handlePasteReplay, isMobile, stackmat, bleTimer, i18n, event]);

  const allSolves = useMemo(() => {
    const out: Solve[] = [];
    for (const list of Object.values(byEvent)) out.push(...list);
    return out;
  }, [byEvent]);

  // ── Derived display (digits text + color class) ─────────────────
  const stats = useMemo(() => summarize(solves, event), [solves, event]);
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
    if (timer.phase === 'stopped' && (lastPenalty === 'DNF' || lastPenalty === 'DNS')) return 'dnf';
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
    if (timer.phase === 'stopped' && lastPenalty === 'DNS') return 'DNS';
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
    if (lastPenalty === 'DNF' || lastPenalty === 'DNS' || !Number.isFinite(timer.displayMs)) return null;
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
  // Opt-in, and stronger than `distractionFree`: that one only fades
  // .surface-chrome, this also takes the side panel and the solver rail. It is
  // NOT gated on prefers-reduced-motion — the user asked for things to be
  // hidden, not animated; the reduced-motion block below drops the transition.
  const hideAllUi = timer.phase === 'running' && settings.hideAllUiWhileRunning;

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
            onQuickReconstruct={(s) => setReconstructSolve(s)}
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
    return null;
  };

  // ── 工具清单 ────────────────────────────────────────────────────
  // 原来是底部导航第三档,现在是设置弹窗里的一节(设置本身不再列在里面 —— 人已经在设置里了)。
  // 打乱足迹从顶栏图标挪到了这里,仍是真链接(中键 / Ctrl 点能新开标签页)。
  const toolsList = (
    <div className="shell-tools-list">
      <AppLink className="shell-tools-item" href="/timer/marks">
        <span className="shell-tools-icon"><Footprints size={14} /></span>
        <span>{tr({ zh: '打乱足迹', en: 'Scramble marks' })}</span>
      </AppLink>
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
    </div>
  );

  // 解法提示(仅 333)。同一个组件在两处挂点里二选一:桌面进右侧 .shell-rail(展开成竖栏),
  // 手机进顶栏那一组控件的末尾(点开 = 全屏浮层)。写成一个变量,免得两处各写一遍 props。
  const solverHintPanel = event === '333'
    ? <SolverHintPanel scramble={scramble} isZh={isZh} onPrevScramble={sheetPrevScramble} onNextScramble={sheetNextScramble} />
    : null;

  return (
    <div
      className={`timer-shell${fullscreen ? ' fullscreen' : ''}${distractionFree ? ' is-solving' : ''}${hideAllUi ? ' hide-ui' : ''}${isDesktop && panelTab ? ' panel-open' : ''}`}
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
          {/* 解法提示(手机形态)。桌面同一个组件挂在右侧 .shell-rail 里(见下),
              这里是二选一 —— 两处同时挂就有两个实例抢同一个 ?hints。 */}
          {!isDesktop && solverHintPanel}
        </div>
        <div className="shell-topbar-right">
          {/* 打乱足迹搬进了设置里的「工具」一节 —— 顶栏只留蓝牙 + 设置两颗。 */}
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
              // Smart-cube scramble check: 'ok' once the cube's tracked state
              // equals this scramble applied to a solved cube. Absent when
              // there's no cube, no comparable state, or nothing turned yet.
              data-scramble-match={scrambleMatch === null ? undefined : scrambleMatch ? 'ok' : 'off'}
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
              <span className="scramble-text">{scrambleLoading || nonWcaLoading
                // 转圈取代了原来的「加载真实打乱…」文字,所以它是唯一的加载提示 → 传 label 供读屏。
                // 原来包在外面的 .scramble-loading 没有任何 CSS 规则也没有别的消费者,一并去掉。
                ? <Spinner size={22} label={nonWcaLoading
                    ? tr({ zh: '生成打乱', en: 'Generating scramble' })
                    : tr({ zh: '加载真实打乱', en: 'Loading real scramble' })} />
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
                        const copiedCheck = scrambleCopied && (
                          <Check className="scramble-copied-check" aria-label={tr({ zh: '已复制', en: 'Copied' })} />
                        );
                        // 智能魔方逐步提示:已拧的变暗、当前这步高亮、剩下的正常。
                        // 打乱拧完(complete)就整条恢复正常 —— 此时右侧「打乱已就绪」已经说明一切,
                        // 再留一堆暗字反而像出错。拧歪(hint === null)也回到纯文本。
                        if (scrambleHint && !scrambleHint.complete) {
                          return <ScrambleHintText hint={scrambleHint} tailExtra={copiedCheck} />;
                        }
                        const i = displayScramble.lastIndexOf(' ');
                        const head = i >= 0 ? displayScramble.slice(0, i + 1) : '';
                        const tail = i >= 0 ? displayScramble.slice(i + 1) : displayScramble;
                        return (
                          <>{head}<span className="scramble-copied-tail">{tail}{copiedCheck}</span></>
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
              {/* While the hint is live the strip itself is the status — being
                  "不符" halfway through applying a scramble is progress, not an
                  error, and a red pill there reads as one. The pill comes back
                  for the two states the hint cannot express: done, and off the
                  scramble's path entirely.

                  The exception is a correction path: those moves are NOT the
                  printed scramble, and the user has to be told that, or the
                  strip looks like it silently rewrote itself. It ends at the
                  same state, so the solve still records the original scramble. */}
              {scrambleHint && !scrambleHint.complete
                ? fixupActive && (
                    <span
                      className="scramble-verify"
                      data-ok="fix"
                      title={tr({
                        zh: '拧歪了。这些不是上面那条打乱,而是从魔方现在的状态回到同一个打乱状态的步骤,拧完成绩记的还是原打乱。',
                        en: 'Off the scramble path. These moves are not the printed scramble — they lead from where the cube is now to the same scrambled state, and the solve still records the original scramble.',
                      })}
                    >{tr({ zh: '拧回原打乱', en: 'Back to scramble' })}</span>
                  )
                : scrambleMatch !== null && (
                    <span className="scramble-verify" data-ok={scrambleMatch ? 'true' : 'false'}>
                      {scrambleMatch
                        ? tr({ zh: '打乱已就绪', en: 'Scrambled' })
                        : tr({ zh: '与打乱不符', en: 'Doesn’t match' })}
                    </span>
                  )}
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
          cornerSlot={centerCubeSlot}
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
          {timer.phase === 'running' && liveTps && (
            <div className="timer-live-tps">
              <span>{liveTps.count} {tr({ zh: '步', en: 'moves' })}</span>
              <span>{liveTps.tps.toFixed(2)} TPS</span>
            </div>
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
          <RoundPanel
            solves={roundSolves}
            config={settings.round}
            targetMs={settings.targetMsByEvent[event] ?? null}
            event={event}
            precision={settings.precision}
            onReset={startNewRound}
          />
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
            桌面收成主区右侧竖栏。手机上这颗 pill 挂在顶栏(见上),不再落在打乱图下方。
            打乱来源已移到计时读数上方(见 ScrambleSourceBar)。 */}
        <div className="shell-rail" data-no-timer>
          {isDesktop && solverHintPanel}
        </div>

        {/* Session stats — vertical cstimer-style list, bottom-left of the main area.
            也是成绩 / 图表面板的唯一入口(底部导航条撤掉了),所以是真 <button>。
            还没有成绩时不摆一排破折号,只留「成绩」两个字 —— 面板里有会话切换器,
            当前会话空着的时候恰恰最需要能点进去换会话。 */}
        <button
          type="button"
          className="shell-stat-rail surface-chrome"
          onClick={() => setPanelTab(t => (t ? null : 'times'))}
          aria-expanded={panelTab != null}
          title={tr({ zh: '打开成绩 / 图表', en: 'Open times / chart' })}
        >
          {solves.length > 0 ? (
            <>
              {/* 「次数」单独一行去掉了 —— 总次数已含在下面「成功」的分母(solved/count)里,不用重复占一行。 */}
              <span className="shell-stat"><span className="shell-stat-lbl">{tr({ zh: '成功', en: 'solved' })}</span> <span className="shell-stat-val">{stats.solved}/{stats.count}</span></span>
              <span className="shell-stat"><span className="shell-stat-lbl">mean</span> <span className="shell-stat-val">{stats.mean}</span></span>
              <span className="shell-stat"><span className="shell-stat-lbl">{tr({ zh: '最佳', en: 'best' })}</span> <span className="shell-stat-val">{stats.best}</span></span>
              <span className="shell-stat"><span className="shell-stat-lbl">mo3</span> <span className="shell-stat-val">{stats.mo3}</span></span>
              <span className="shell-stat"><span className="shell-stat-lbl">ao5</span> <span className="shell-stat-val">{stats.ao5}</span></span>
              <span className="shell-stat"><span className="shell-stat-lbl">ao12</span> <span className="shell-stat-val">{stats.ao12}</span></span>
            </>
          ) : (
            <span className="shell-stat"><span className="shell-stat-val">{tr({ zh: '成绩', en: 'Times' })}</span></span>
          )}
        </button>

      </div>

      {/* ── Side panel: desktop dock / 非桌面整屏 ───────────────
          入口是左下角那块统计(见上);底部导航条已撤掉,「工具」搬进了设置。
          非桌面宽度整屏铺开,关闭走右上角 × 或 Escape。 */}
      {panelTab && (
        <aside className={`shell-panel${isDesktop ? ' shell-panel--rail' : ' shell-panel--sheet'}`}>
          <div className="shell-panel-tabs">
            <button type="button" className={`shell-panel-tab${panelTab === 'times' ? ' active' : ''}`} onClick={() => setPanelTab('times')}>{tr({ zh: '成绩', en: 'Times'
          })}</button>
            <button type="button" className={`shell-panel-tab${panelTab === 'chart' ? ' active' : ''}`} onClick={() => setPanelTab('chart')}>{tr({ zh: '图表', en: 'Chart'
          })}</button>
            <button type="button" className="shell-panel-close" onClick={() => setPanelTab(null)} aria-label={tr({ zh: '关闭', en: 'Close'
          })}><X size={16} /></button>
          </div>
          <div className="shell-panel-body">{renderPanelBody()}</div>
        </aside>
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
            /* Keyed to remount when switching solves — but NAMESPACED, because
               the ReconstructModal below is a sibling keyed by the same solve
               id, and opening it from this modal would otherwise give two
               siblings the same key (React then reuses one for the other). */
            key={`detail-${modalSolve.s.id}`}
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
        <ReconstructModal
          key={`recon-${reconstructSolve.id}`}
          solve={reconstructSolve}
          isZh={isZh}
          onClose={() => setReconstructSolve(null)}
          history={byEvent[reconstructSolve.event] ?? []}
          onUseScramble={useScramble}
          // Two writes because the modal reads a *snapshot*: the store keeps the
          // answer, and the copy the modal is rendering has to agree with it or
          // the button won't look pressed.
          onReconFeedback={(ok) => {
            updateSolve(reconstructSolve.id, { reconOk: ok });
            setReconstructSolve(s => (s ? { ...s, reconOk: ok } : s));
          }}
        />
      )}

      {settingsOpen && <SettingsPanel isZh={isZh} event={event} tools={toolsList} onClose={() => setSettingsOpen(false)} onDataReplaced={() => setByEvent(loadAll())} />}

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

      {stackmatOpen && (
        <StackmatModal stackmat={stackmat} onClose={() => setStackmatOpen(false)} />
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

      {/* 没有硬件时把假魔方从控制台搬到页面上。`DEV_PANEL` 在生产里是 false 且
          `next/dynamic` 的那个 chunk 从没被引用过,所以整块不进生产包。 */}
      {DEV_PANEL && (
        <DevFakeCubePanel
          connected={bluetoothCube.status.connected}
          deviceName={bluetoothCube.status.deviceName ?? null}
          onConnect={bluetoothCube.connect}
          onDisconnect={bluetoothCube.disconnect}
          scramble={scramble}
        />
      )}
    </div>
  );
}
