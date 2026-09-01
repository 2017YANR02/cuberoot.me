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

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { useQueryState, parseAsBoolean, parseAsString, parseAsStringEnum } from 'nuqs';
import {
  Settings as SettingsIcon,
  AlertTriangle, Target,
  X, CheckCircle2, Repeat,
} from 'lucide-react';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import CubeRootLogo from '@/components/CubeRootLogo';
import { petReact } from '@/lib/deskpet';
import {
  parseTrainingAssignmentDestination,
  startTrainingEvidenceOutbox,
  submitTrainingEvidence,
} from '@/lib/training-evidence';
import MoreMenu, { type MoreMenuItem } from '../_components/MoreMenu';
import { syncLangToUrl } from '@/i18n/i18n-client';

import { generateScramble, registerScramble } from '../_lib/scramble';
import {
  peekWcaRow,
  nextWcaRow,
  prefetchWca,
  hasWcaSource,
  isWcaSourceEmpty,
  isWcaCompUnindexed,
  probeCompCoverage,
  getCompCoverage,
  wcaEventId,
  wcaMetaFor,
  wcaMetaForSlot,
  wcaPoolProgress,
  type WcaDispensedScramble,
  type WcaSourceSpec,
} from '../_lib/scramble/wca_pool';
import { takeScramble } from '../_lib/scramble/scramble_pool';
import { preScrambleFor } from '../_lib/scramble/pre_scramble';
import { applyOrientationPrefix } from '@/lib/cube-orientation';
import { use222Mode, use222Type } from '@/lib/scramble-222-mode';
import {
  isCube222StateType,
  resolveTimerWcaSourceCore,
  stepPuzzleOf,
  timerWcaDifficultyFilter,
  timerWcaDifficultyIdentity,
  timerWcaOptimalRequested,
  timerWcaSourceIdentity,
  TIMER_MORE_ACTION_COPY,
  TIMER_SCRAMBLE_CLICK_TITLE_COPY,
  timerClearCurrentEventConfirmation,
  timerCanHandleAttemptPress,
  timerCanStartAttempt,
  timerEventSupportsDrill,
  timerSupportsSmartCubeAutoTiming,
  timerCanUseGestureWheel,
  timerGestureActionAt,
  timerGestureActionStates,
  formatTimerTimingDisplay,
  timerShouldStopFromExternalPointer,
  timerPrintScrambleSource,
  timerScrambleAllowsEmptySlot,
  timerScrambleClickEffect,
  timerTracksTrainerCase,
  usesStepsIndex,
  visibleTimerMoreActions,
  type TimerGestureActionId,
  type TimerNon222StepPuzzle,
} from '@cuberoot/shared/timer';
import {
  createSmartCubeGuidanceController,
  type SmartCubeGuidanceState,
} from '@cuberoot/shared/smart-cube/scramble-guidance';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import type { Cube222SpecialType } from '@cuberoot/puzzle-solvers/cube222';
import { genByStepsScramble, genByStepsSig, wcaStepFilter } from '../_lib/scramble/gen-by-steps';
import {
  nextWebNon222ByStepsScramble,
  takeWebNon222ByStepsScramble,
} from '../_lib/scramble/non222-steps-pool';
import { trainerSpecOf, trainerSig } from '../_lib/scramble/trainer-source';
import { aliasTrainerMeta, peekTrainer, awaitTrainer, prefetchTrainer, releaseTrainer, retryTrainer } from '../_lib/scramble/trainer_pool';
import {
  awaitOptimal333,
  peekOptimal333,
  prefetchOptimal333,
  releaseOptimal333,
  retryOptimal333,
  shouldUseRandomOptimal333,
  type Optimal333Source,
} from '../_lib/scramble/optimal333_pool';
import TrainerCaseBar from '../_components/TrainerCaseBar';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import { Flag } from '@/components/Flag';
import { compFlagIso2, loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { compSourceLine } from '@/lib/comp-schedule';
import { useAuthStore } from '@/lib/auth-store';
import { cloudOptimalScramble } from '@/lib/cloud-optimal-scramble';
import { ownerKey as computeOwnerKey } from '@cuberoot/shared/account';
import { displayCuberName } from '@/lib/cuber-name-display';
import { fetchMarks, addMark, markKey, type ScrambleMark } from '../_lib/marks';
import { getLastPickedCase, type TrainerKind } from '../_lib/scramble/training';
import { warmup333, randomState333, randomState333Sync } from '../_lib/scramble/kociemba/random_state';
import { useTimer, type TimerPhase } from '../_shared/useTimer';
import { inspectionPenalty } from '../_shared/inspection';
import { formatMs, bestSingle, bestAverageOfN, bestMbldSolve, compareMbld, summarize } from '../_lib/stats';
import type { EventId, Penalty, Solve } from '../_lib/types';
import { EVENTS, isBldEvent } from '../_lib/types';
import {
  deleteTimerHistorySolve,
  restoreTimerHistorySolve,
  timerHistoryMoveTargets,
  updateTimerHistorySolve,
} from '../_lib/history';
import {
  parseManualScrambleQueue,
  takeManualScramble,
  TIMER_EVENT_PICKER_GROUPS,
  TIMER_REAL_SCRAMBLE_CONFIRMED_EMPTY,
  TIMER_REAL_SCRAMBLE_TRANSIENT_ERROR,
  startTimerRealScrambleRetry,
  timerEventIdFromSelector,
  timerRealScrambleReady,
} from '@cuberoot/shared/timer';
import { stageSegmentsFor } from '../_lib/reconstruct/stage_segments';
import { shouldAutoRecap } from '../_lib/reconstruct/recap';
import {
  isNonWcaEvent,
  nextNonWcaScramble,
  prefetchNonWca,
} from '../_lib/scramble/nonwca';
import {
  nextCube222SpecialScramble,
  prefetchCube222SpecialScramble,
  takeCube222SpecialScramble,
} from '../_lib/scramble/cube222-special-pool';
import {
  loadAll, saveAll, makeSolve,
  listSessions, getActiveSessionId, moveSolveToSession,
  activateSessionForEvent, getSessionEvent, setSessionEvent,
} from '../_lib/storage/db';
import { formatTargetTime, useSettings, getSettings, updateSettings } from '../_lib/settings';
import { warmupSound } from '../_lib/sound';
import { setMetronomeHold } from '@/lib/metronome';
import { useBluetoothCube } from '../_lib/bluetooth';
import {
  classifyUnifiedBluetoothDevice,
  requestUnifiedBluetoothDevice,
} from '../_lib/bluetooth/unified_picker';
import type { TimerPresenceReport } from '../_lib/presence';
import { mirrorForBrand, readDevQuatSource, sensorBasisForBrand, type Quat } from '../_lib/bluetooth/orientation';
import { GyroRecorder, encodeGyroTrack } from '../_lib/bluetooth/gyro_track';
import {
  fromFaceletString,
  toFaceletString,
} from '../_lib/cube/state';
import { fixupScramble } from '../_lib/bluetooth/scramble_fixup';
import { installFakeCube } from '../_lib/bluetooth/fake_cube';
import {
  resolveKeymap,
  timerCanSwitchScramble,
  timerKeyDownDecision,
  timerKeyboardTargetContext,
  timerKeyUpDecision,
  type TimerKeyboardModalState,
} from '../_lib/keymap';
import { useAutoReady } from '../_lib/bluetooth/auto_ready';
import { useBluetoothTimer } from '../_lib/bluetooth/timer';
import { useStackmat } from '../_lib/stackmat';
import { useMultiStage } from '../_lib/multistage';
import { useBldMemo } from '../_lib/useBldMemo';

import StatsPanel from '../_components/StatsPanel';
import CrossSessionStats from '../_components/CrossSessionStats';
import CaseStatsPanel from '../_components/CaseStatsPanel';
import HistoryPanel from '../_components/HistoryPanel';
import { decodeReplayParam, solveFromReplay } from '../_lib/share/decode';
import { extractReplayParam } from '../_lib/share/paste_import';
import SettingsPanel from '../_components/SettingsPanel';
import GoalProgress from '../_components/GoalProgress';
import RoundPanel from '../_components/RoundPanel';
import { roundAttempts } from '@cuberoot/shared/timer';
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
import {
  GestureWheel,
  SegmentTime,
  TimerDeviceActions,
  TimerInfoToast,
  TimerPuzzlePicker,
  TimerPrintController,
  TimerScrambleStrip,
  TimerScrambleSourceSelect,
  TimerStatRail,
  TimerTopbar,
  TimingSurface,
  browserPrintTransport,
  useGestureWheel,
  type TimerPrintControllerHandle,
  type TimerPuzzlePickerGroup,
} from '@cuberoot/timer-ui';
import { histBack, histForward, histPush } from '@cuberoot/shared/timer';
import { shouldIgnoreTimerTarget } from '@/lib/timer-ignore-target';
import { persistItem } from '@/lib/safe-storage';
import { onIdle } from '@/lib/on-idle';
import RankBadge from './RankBadge';
import SessionSwitcher from './SessionSwitcher';
import { useRankCountry } from '@/app/[lang]/timer/_shared/use-rank-country';
import { Spinner } from '@/components/Spinner/Spinner';

import '../timer.css';
import '../_components/charts/charts.css';
import '../_components/charts/practice_heatmap.css';

// 弹层一律 next/dynamic。每一个的渲染都写成 `{xxxOpen && <Modal/>}`,首屏一个都不挂;
// 静态 import 会把这些弹层连同各自的 CSS 一起焊进计时器首屏那个 chunk,而绝大多数
// 用户一次也不会打开它们。ssr:false —— 本文件已经在一个 ssr:false 的动态边界里(page.tsx
// 只在客户端拉 TimerShell),弹层再声明一次只是显式表态,不新增行为。
const BldHelperModal = dynamic(() => import('../_components/BldHelperModal'), { ssr: false });
const SolveModal = dynamic(() => import('../_components/SolveModal'), { ssr: false });
const ReconstructModal = dynamic(() => import('../_components/ReconstructModal'), { ssr: false });
const BluetoothModal = dynamic(() => import('../_components/BluetoothModal'), { ssr: false });
const BluetoothTimerModal = dynamic(() => import('../_components/BluetoothTimerModal'), { ssr: false });
const StackmatModal = dynamic(() => import('../_components/StackmatModal'), { ssr: false });
const TrainerSubsetModal = dynamic(() => import('../_components/TrainerSubsetModal'), { ssr: false });
const StatsModal = dynamic(() => import('../_components/StatsModal'), { ssr: false });
const ManualEntryModal = dynamic(() => import('../_components/ManualEntryModal'), { ssr: false });
const SolverModal = dynamic(() => import('../_components/SolverModal'), { ssr: false });
const BulkScrambleModal = dynamic(() => import('../_components/BulkScrambleModal'), { ssr: false });
const DrillModal = dynamic(() => import('../_components/DrillModal'), { ssr: false });
/** 停表后就地摊开的复盘(见 SolveRecap 头注)。和上面那些弹层一样留在自己的 chunk
 *  里,但它不是「用户可能会打开的东西」而是「拧完就会出现的东西」—— 所以魔方一连上
 *  就 onIdle 预取(见 recapPrefetch),真停表那下已经在注册表里。 */
const SolveRecap = dynamic(() => import('../_components/SolveRecap'), { ssr: false });
/** 假魔方调试面板只在 dev 存在;判断提到模块级,好让打包器把整个分支和它的
 *  chunk 一起消掉(见 DevFakeCubePanel.tsx)。 */
const DEV_PANEL = process.env.NODE_ENV !== 'production';
const DevFakeCubePanel = dynamic(() => import('../_components/DevFakeCubePanel'), { ssr: false });
import './shell.css';
import { tr } from '@/i18n/tr';

/** Rolling window for the live TPS readout, in moves. Short enough to react to
 *  a pause or a lockup, long enough not to swing wildly on a single fast pair. */
const TPS_WINDOW_MOVES = 12;

interface TimerScrambleHistoryEntry {
  id: number;
  scramble: string;
  /** Stable occurrence provenance; separate official slots may share text. */
  wca: WcaDispensedScramble | null;
}

let nextTimerScrambleHistoryEntryId = 1;

function timerScrambleHistoryEntry(
  scramble: string,
  wca: WcaDispensedScramble | null = null,
): TimerScrambleHistoryEntry {
  return { id: nextTimerScrambleHistoryEntryId++, scramble, wca };
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

// 工具收进顶栏 MoreMenu；齿轮只保留持久设置，避免工具动作再叠一层弹窗。
//
// 三档各答一个问题,名字就是答案:**成绩**是这些把本身(会话 + 那张单子),**统计**
// 是从它们算出来的数(当前/最佳、σ、阈值占比、完整统计),**图表**是画出来的。
// 原来成绩那一档从当前/最佳一路铺到阈值占比再到历史,要滚很久才够到自己刚拧的那把。
type PanelTab = 'times' | 'stats' | 'chart';
type ChartKind = 'histogram' | 'trend' | 'scatter' | 'hour' | 'heatmap';

interface SoloViewProps {
  /** The players (人数) select node, injected by the shell at the topbar left. */
  playersControl?: React.ReactNode;
  presenceControl?: React.ReactNode;
  onPresenceChange?: (report: TimerPresenceReport) => void;
}

function submitTimerTrainingEvidence(
  destination: ReturnType<typeof parseTrainingAssignmentDestination>,
  solve: Solve,
): void {
  if (!destination || !Number.isFinite(solve.ts) || !Number.isFinite(solve.timeMs)) return;
  const success = solve.penalty !== 'DNF' && solve.penalty !== 'DNS';
  const durationMs = Math.min(86_400_000, Math.max(0, Math.round(solve.timeMs)));
  const resultMs = success
    ? Math.min(86_400_000, durationMs + (solve.penalty === '+2' ? 2_000 : 0))
    : null;
  submitTrainingEvidence(destination, {
    schemaVersion: 1,
    source: 'timer',
    sourceEventId: `timer:${solve.id}`,
    occurredAt: new Date(solve.ts).toISOString(),
    activity: 'solve',
    durationMs,
    metrics: { success, resultMs },
    payloadVersion: 1,
    payload: {
      event: solve.event,
      penalty: solve.penalty,
      ...(solve.caseId ? { caseId: solve.caseId } : {}),
    },
  });
}

export default function SoloView({ playersControl, presenceControl, onPresenceChange }: SoloViewProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const printControllerRef = useRef<TimerPrintControllerHandle>(null);
  const settings = useSettings();
  const authUser = useAuthStore((st) => st.user);
  const rankCountry = useRankCountry();

  const isMobile = useMediaQuery('(max-width: 480px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const trainingDestinationRef = useRef<ReturnType<typeof parseTrainingAssignmentDestination>>(null);
  useEffect(() => {
    trainingDestinationRef.current = parseTrainingAssignmentDestination(window.location.search);
    return startTrainingEvidenceOutbox(trainingDestinationRef.current);
  }, []);


  // 解法提示的全屏浮层由 SolverHintPanel 经同一个 URL param 开合(手机点 pill、桌面把头部的
  // 形态开关拨到「全屏」都进这一个);这里只读,用来把它算进 anyModalOpen(浮层盖住整屏时,
  // 空格/Escape 不该穿到后面的计时器)。
  const [hintsSheetParam] = useQueryState(HINTS_PARAM, parseAsBoolean.withDefault(false));
  const hintsSheetOpen = hintsSheetParam;

  // ── Side panel (desktop rail / 非桌面整屏) ──────────────────────
  const [panelTab, setPanelTab] = useState<PanelTab | null>(null);
  const closeResultsPanel = useCallback(() => setPanelTab(null), []);
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

  const selectEvent = useCallback((nextEvent: EventId) => {
    if (nextEvent === event) return;
    const previousSessionId = getActiveSessionId();
    const matchedSessionId = settings.autoSessionForEvent
      ? activateSessionForEvent(nextEvent)
      : null;

    if (matchedSessionId && matchedSessionId !== previousSessionId) {
      reloadActiveSession();
    } else if (!matchedSessionId) {
      setSessionEvent(previousSessionId, nextEvent);
    }
    void setEvent(nextEvent);
  }, [event, reloadActiveSession, setEvent, settings.autoSessionForEvent]);

  const handleSessionsChanged = useCallback((activeSessionId?: string) => {
    reloadActiveSession();
    if (!activeSessionId || !settings.autoEventForSession) return;
    const associatedEvent = getSessionEvent(activeSessionId);
    if (associatedEvent && associatedEvent !== event) void setEvent(associatedEvent);
  }, [event, reloadActiveSession, setEvent, settings.autoEventForSession]);

  const solves = useMemo(() => byEvent[event] ?? [], [byEvent, event]);
  const activePrintSessionName = useMemo(() => {
    const activeSessionId = getActiveSessionId();
    return listSessions().find((session) => session.id === activeSessionId)?.name;
  }, [byEvent]);

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
  const drillAllowed = timerEventSupportsDrill(event);
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
  // 「按步数」WCA 过滤(2×2 / 金字塔):把真实打乱按度量步数筛到 [lo,hi]。与随机来源共用同一组设置。
  const wcaStep = wcaStepFilter(event, settings);
  const wcaStepSig = wcaStep ? `${wcaStep.metric}:${wcaStep.lo}.${wcaStep.hi}` : '';
  // comp + 难度:该场若还没进难度库(离线管道对新赛滞后),难度过滤旁路(出正常整场打乱,不产生空结果),
  // 同时 WcaSourceConfig 会把「难度」开关灰锁。用户的 wcaDifficultyOn 偏好保留(切回已入库比赛/日期即恢复)。
  const [wcaCompUnindexed, setWcaCompUnindexed] = useState(false);
  useEffect(() => {
    const w = wcaEventId(event);
    // 「整体」/「打乱」不查阶段步数索引 → 该场有没有回填与它们无关,不旁路(见 usesStepsIndex)。
    const requestedDifficulty = timerWcaDifficultyFilter(w, settings);
    if (settings.scrambleSource !== 'wca' || settings.wcaScrambleMode !== 'comp'
        || !settings.wcaComp || !w || !requestedDifficulty
        || !usesStepsIndex(requestedDifficulty.variant)) { setWcaCompUnindexed(false); return; }
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
  const [type222] = use222Type();
  const wca222Type = event === '222' && settings.scrambleSource === 'wca' && !settings.syncSeed
    && isCube222StateType(type222) ? type222 : undefined;
  const wca222TypeSig = wca222Type ?? '';
  // 随机来源的专项状态由 @cuberoot/puzzle-solvers 的同一状态模型生成；Web 只加 Worker 调度层。
  // WCA 来源继续在既有真题池里用同一个状态谓词筛选，两条路径不会维护两份类型判定。
  const special222Type = useMemo<Cube222SpecialType | null>(
    () => {
      if (event !== '222' || settings.scrambleSource !== 'random' || settings.syncSeed) return null;
      return type222 === '3gen' || isCube222StateType(type222) ? type222 : null;
    },
    [event, settings.scrambleSource, settings.syncSeed, type222],
  );
  const special222TypeRef = useRef(special222Type);
  special222TypeRef.current = special222Type;
  const special222Sig = special222Type ?? '';
  const mappedWcaEvent = wcaEventId(event);
  const optimalOverride = event === '222' ? mode222 === 'optimal' : undefined;
  const wcaDifficulty = timerWcaDifficultyFilter(mappedWcaEvent, settings, {
    competitionUnindexed: wcaCompUnindexed,
    suppress: !!wca222Type,
  });
  const wcaDifficultySig = timerWcaDifficultyIdentity(mappedWcaEvent, settings, {
    competitionUnindexed: wcaCompUnindexed,
    suppress: !!wca222Type,
  });
  const wcaOptimalOn = timerWcaOptimalRequested(mappedWcaEvent, settings, {
    competitionUnindexed: wcaCompUnindexed,
    optimalOverride,
    suppressDifficulty: !!wca222Type,
  });
  const wcaSpec = useMemo<WcaSourceSpec>(() => {
    const source = resolveTimerWcaSourceCore(settings);
    return {
      event,
      mode: source.mode,
      comp: source.comp,
      compName: source.compName,
      round: source.round,
      group: source.group,
      from: source.from,
      to: source.to,
      optimal: wcaOptimalOn,
      // 难度过滤:未入库的比赛旁路(见 wcaCompUnindexed)。空比赛回退成「全时段随机真题」时仍生效——
      // 难度控件此时照常显示可操作(WcaSourceConfig 只看开关不看有无选中比赛),丢弃会静默出不符条件的
      // 打乱(如选了 0 步十字却拿到普通打乱);date 池服务端 /random 对空 from/to 走飞镖采样带环绕补齐,
      // 稀有档(0 步十字)也能出题。
      diff: wcaDifficulty ?? undefined,
      // 二阶专项与「按步数」互斥:隐藏的旧步数偏好不能继续叠加过滤。
      stepFilter: wca222Type ? undefined : wcaStep ?? undefined,
      typeFilter: wca222Type,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, settings.wcaScrambleMode, settings.wcaComp, settings.wcaCompName, settings.wcaRound, settings.wcaGroup, settings.wcaDateFrom, settings.wcaDateTo, wcaOptimalOn, wcaDifficultySig, wcaStepSig, wca222TypeSig]);
  const wcaSpecRef = useRef(wcaSpec);
  wcaSpecRef.current = wcaSpec;
  const sharedWcaSourceSig = timerWcaSourceIdentity(event, mappedWcaEvent, settings, {
    competitionUnindexed: wcaCompUnindexed,
    optimalOverride,
    suppressDifficulty: !!wca222Type,
  });
  const wcaSourceSig = settings.scrambleSource === 'wca'
    ? `${sharedWcaSourceSig ?? 'unmapped'}|${wcaStepSig}|${wca222TypeSig}`
    : 'random';
  // 按步数生成签名:随机来源一律生效；非 WCA 项目即便全局来源仍记着「真题」也只能本地生成，
  // 因此同样要让难度变化重置打乱队列。WCA 项目的真题来源由 wcaStepSig 负责。
  const genStepsSig = !special222Type && (settings.scrambleSource === 'random'
    || (settings.scrambleSource === 'wca' && !wcaEventId(event)))
    ? genByStepsSig(event, settings, mode222)
    : '';
  const stepPuzzle = stepPuzzleOf(event);
  const non222ByStepsEvent: TimerNon222StepPuzzle | null = genStepsSig
    && stepPuzzle
    && stepPuzzle !== '222'
    ? stepPuzzle
    : null;
  // 随机来源的「难度」(3×3 族):按所选阶段的最优步数直接生成状态(lib/cross-trainer)。
  // 与真题难度筛互斥 —— 那边筛真题,这边生成,二者只按当前来源取其一。
  const trainerSpec = settings.scrambleSource === 'random' ? trainerSpecOf(event, settings) : null;
  const trainerSpecRef = useRef(trainerSpec);
  trainerSpecRef.current = trainerSpec;
  const trainerSigVal = settings.scrambleSource === 'random' ? trainerSig(event, settings) : '';

  // 云端大表只服务三阶随机状态。同步种子要求严格按消费顺序推进，后台预生成会破坏该契约，
  // 因而设置行会同步置灰。难度/专项状态仍先照原规则生成，再求同一状态的最短打乱。
  const randomOptimalRequested = shouldUseRandomOptimal333(
    settings.wcaUseOptimal,
    event,
    settings.scrambleSource,
    !!authUser,
    settings.syncSeed,
  );
  const randomOptimalOwner = authUser ? computeOwnerKey(authUser.uid, authUser.wcaId) : '';
  const randomOptimalKey = randomOptimalRequested
    ? `${randomOptimalOwner}|${trainerSigVal}|${drillTarget ? `${drillTarget.type}:${drillTarget.id}` : ''}`
    : '';
  const randomOptimalSource: Optimal333Source | null = randomOptimalRequested
    ? {
        key: randomOptimalKey,
        generateBase: async () => {
          if (drillTarget && drillAllowed) {
            const drill = generateDrillScramble(drillTarget.type, drillTarget.id);
            if (drill) return drill.scramble;
          }
          const spec = trainerSpecRef.current;
          if (spec) {
            prefetchTrainer(spec);
            const status = await awaitTrainer(spec);
            if (status === 'ready') {
              const generated = peekTrainer(spec);
              if (generated) return generated;
            }
            throw new Error('trainer state unavailable');
          }
          return randomState333();
        },
        optimize: async (base, signal) => (await cloudOptimalScramble(base, undefined, signal)).scramble,
        onOptimized: aliasTrainerMeta,
      }
    : null;
  const randomOptimalSourceRef = useRef(randomOptimalSource);
  randomOptimalSourceRef.current = randomOptimalSource;

  // 手动输入队列:每行一条打乱(去空行);source==='manual' 时按游标顺序取用(走完循环回队首),
  // ←/→ 仍走 scrambleHist 历史。队列内容变了即重置打乱历史(经 genScramble 身份变化)+ 游标。
  const manualQueue = useMemo(
    () => parseManualScrambleQueue(settings.manualScrambles),
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

  const genScramble = useCallback((): TimerScrambleHistoryEntry => {
    // Manual queue: walk the user-typed lines in order, wrapping at the end.
    // Empty queue → '' placeholder (the strip shows a "paste scrambles" hint).
    if (settings.scrambleSource === 'manual') {
      const taken = takeManualScramble(manualQueueRef.current, manualCursorRef.current);
      manualCursorRef.current = taken.nextCursor;
      return timerScrambleHistoryEntry(taken.scramble);
    }
    // Buffered async path: a ready optimal scramble is instant; '' is filled by
    // the effect below while the pool keeps the next three states warm.
    if (randomOptimalRequested) {
      const source = randomOptimalSourceRef.current;
      return timerScrambleHistoryEntry(source ? peekOptimal333(source) : '');
    }
    if (drillTarget && drillAllowed) {
      const ds = generateDrillScramble(drillTarget.type, drillTarget.id);
      if (ds) return timerScrambleHistoryEntry(ds.scramble);
    }
    // WCA real-scramble mode: take from the pool synchronously when available;
    // '' is a loading placeholder filled async by the effect below.
    if (settings.scrambleSource === 'wca' && hasWcaSource(wcaSpecRef.current)) {
      const row = peekWcaRow(wcaSpecRef.current);
      return timerScrambleHistoryEntry(row?.scramble ?? '', row);
    }
    // Local generation: serve from the background buffer (instant), except in
    // deterministic seeded-sync mode where consumption order must stay exact.
    const s = getSettings();
    if (s.syncSeed) return timerScrambleHistoryEntry(generateScramble(event));
    // 二阶专项类型复用 runtime-neutral provider 与 Web Worker 队列。目标条件由共享状态谓词保证,
    // 因此它优先于普通难度 / 按步数链；空串只表示 worker 尚未返回,由下方 effect 补位。
    const special = special222TypeRef.current;
    if (special) return timerScrambleHistoryEntry(takeCube222SpecialScramble(special));
    // 「按难度生成」(3×3 族):状态在 worker 里按阶段最优步数采样,再由 min2phase 转成打乱 ——
    // 同样是异步的,队列干了就先出 '',由下面的 effect 补上(期间转圈)。
    if (trainerSpecRef.current) return timerScrambleHistoryEntry(peekTrainer(trainerSpecRef.current));
    // 「按步数生成」(2×2 / 金字塔 / 斜转 / 枫叶 / 齿轮):从完整状态空间均匀采样、
    // 按所选度量最优步数生成(非案例库)。必须先于 non-WCA worker 分支,否则后两项会绕过难度。
    // 度量+区间进 pool key,改设置即换 buffer;拒绝采样 + IDA* 在后台 idle 生成,不阻塞计时。
    if (non222ByStepsEvent) {
      return timerScrambleHistoryEntry(takeWebNon222ByStepsScramble(non222ByStepsEvent, s));
    }
    const byStepsScr = genByStepsScramble(event, s, mode222);
    if (byStepsScr) return timerScrambleHistoryEntry(
      takeScramble(byStepsScr.key, byStepsScr.gen, canGenScramble),
    );
    // 其余非 WCA puzzle:打乱在 csTimer Worker 里算,nonwca.ts 自带队列。别再套一层
    // scramble_pool —— 那会把「还在生成」的 '' 也缓存进 buffer。'' 由下面的 effect 补。
    if (isNonWcaEvent(event)) return timerScrambleHistoryEntry(generateScramble(event));
    return timerScrambleHistoryEntry(
      takeScramble(`${event}|${s.cnMode}|${event === '222' ? mode222 : ''}`, () => generateScramble(event), canGenScramble),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillTarget, drillAllowed, event, settings.scrambleSource, wcaSourceSig, special222Sig, genStepsSig, trainerSigVal, manualSig, canGenScramble, mode222, randomOptimalRequested, randomOptimalKey, non222ByStepsEvent]);

  const [scrambleHist, setScrambleHist] = useState<{ list: TimerScrambleHistoryEntry[]; idx: number }>(
    () => ({ list: [genScramble()], idx: 0 }),
  );
  // The displayed history belongs to the generator identity that produced its
  // current context. A source/event/config render happens before the reset
  // effect below; fail closed during that render instead of allowing the old
  // non-empty scramble to start under the new settings.
  const scrambleGeneratorAtHistoryResetRef = useRef(genScramble);
  // Write-through ref so the nav callbacks read the latest history without a
  // stale closure and without re-creating themselves each push.
  const scrambleHistRef = useRef(scrambleHist);
  const cancelArmForScrambleChangeRef = useRef<() => void>(() => {});
  const applyScrambleHist = useCallback((next: { list: TimerScrambleHistoryEntry[]; idx: number }) => {
    // A source/config/history change creates a different attempt. Cancel every
    // pre-run phase first so a later key/pointer release cannot start the new
    // scramble using the old hold or inspection state.
    cancelArmForScrambleChangeRef.current();
    scrambleHistRef.current = next;
    setScrambleHist(next);
  }, []);
  const currentScrambleEntry = scrambleHist.list[scrambleHist.idx]
    ?? timerScrambleHistoryEntry('');
  const scramble = currentScrambleEntry.scramble;
  // 「预打乱朝向」只进打乱图,不改打乱正文(同 csTimer:正文保持官方口径,图按你手持的朝向画)。
  const previewScramble = applyOrientationPrefix(
    scramble,
    preScrambleFor(event, settings.preScr, settings.preScrT),
  );

  const [randomOptimalLoading, setRandomOptimalLoading] = useState(false);
  const [randomOptimalFailed, setRandomOptimalFailed] = useState(false);
  const [randomOptimalRetry, setRandomOptimalRetry] = useState(0);

  // Own the pool lifecycle separately from the current slot: changing history
  // must not abort the background fill, but leaving this exact generation
  // context must immediately cancel its in-flight cloud solve and drop stale rows.
  useEffect(() => {
    const source = randomOptimalSourceRef.current;
    if (!randomOptimalRequested || !source) {
      releaseOptimal333();
      return;
    }
    prefetchOptimal333(source);
    return () => releaseOptimal333();
  }, [randomOptimalRequested, randomOptimalKey]);

  // A dry optimal buffer uses the same empty-history-slot contract as WCA and
  // worker sources. Fill only the still-current empty slot so navigation or a
  // settings change can never overwrite a newer scramble.
  useEffect(() => {
    const source = randomOptimalSourceRef.current;
    if (!randomOptimalRequested || !source || scramble !== '') {
      setRandomOptimalLoading(false);
      setRandomOptimalFailed(false);
      return;
    }
    let cancelled = false;
    setRandomOptimalLoading(true);
    setRandomOptimalFailed(false);
    void awaitOptimal333(source).then((status) => {
      if (cancelled) return;
      if (status === 'error') {
        setRandomOptimalLoading(false);
        setRandomOptimalFailed(true);
        return;
      }
      if (status !== 'ready') return;
      const cur = scrambleHistRef.current;
      if (cur.list[cur.idx]?.scramble !== '') {
        setRandomOptimalLoading(false);
        return;
      }
      const optimal = peekOptimal333(source);
      if (!optimal) return;
      const list = [...cur.list];
      list[cur.idx] = timerScrambleHistoryEntry(optimal);
      setRandomOptimalLoading(false);
      applyScrambleHist({ list, idx: cur.idx });
    });
    return () => { cancelled = true; };
  }, [scramble, randomOptimalRequested, randomOptimalKey, randomOptimalRetry, applyScrambleHist]);

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
    setScrambleLoading(true);
    setWcaSourceEmpty(false);
    // Fetch a real scramble; retry transient failures (cold start / slow query /
    // network) with backoff while staying in the loading state — only a *confirmed*
    // empty source (404) shows the notice, and we never substitute a generated one.
    const sourceSpec = wcaSpecRef.current;
    const retryRun = startTimerRealScrambleRetry(async () => {
      const real = await nextWcaRow(sourceSpec);
      if (real) return timerRealScrambleReady(real);
      return isWcaSourceEmpty(sourceSpec)
        ? TIMER_REAL_SCRAMBLE_CONFIRMED_EMPTY
        : TIMER_REAL_SCRAMBLE_TRANSIENT_ERROR;
    });
    void retryRun.result.then((outcome) => {
      if (outcome.kind === 'cancelled') return;
      const cur = scrambleHistRef.current;
      if (cur.list[cur.idx]?.scramble !== '') { setScrambleLoading(false); return; }
      setScrambleLoading(false);
      if (outcome.kind === 'ready') {
        const list = [...cur.list];
        list[cur.idx] = timerScrambleHistoryEntry(outcome.value.scramble, outcome.value);
        applyScrambleHist({ list, idx: cur.idx });
      } else if (outcome.kind === 'confirmed-empty') {
        // 确认无真题(端点 404)→ 显式提示,不伪造生成打乱。
        setWcaSourceEmpty(true);
      }
      // exhausted = 多次仍失败:收起转圈(显示 — ),换打乱 / 改设置可再试。
    });
    return () => retryRun.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scramble, settings.scrambleSource, wcaSourceSig, applyScrambleHist]);

  // Exact non-2x2 move-count generation is Worker-only. The history slot owns
  // only the current semantic identity; an A→B→A switch cancels the stale A
  // waiter while the shared per-identity queue may still satisfy the new A.
  const [byStepsLoading, setByStepsLoading] = useState(false);
  const [byStepsFailed, setByStepsFailed] = useState(false);
  const [byStepsRetry, setByStepsRetry] = useState(0);
  useEffect(() => {
    const requestEvent = non222ByStepsEvent;
    if (!requestEvent || scramble !== '') {
      setByStepsLoading(false);
      setByStepsFailed(false);
      return;
    }
    const requestSignature = genStepsSig;
    const requestSettings = getSettings();
    if (genByStepsSig(event, requestSettings, mode222) !== requestSignature) return;
    const controller = new AbortController();
    let cancelled = false;
    setByStepsLoading(true);
    setByStepsFailed(false);
    void nextWebNon222ByStepsScramble(requestEvent, requestSettings, controller.signal).then((generated) => {
      if (cancelled) return;
      setByStepsLoading(false);
      if (!generated) {
        setByStepsFailed(true);
        return;
      }
      if (genByStepsSig(event, getSettings(), mode222) !== requestSignature) return;
      const cur = scrambleHistRef.current;
      if (cur.list[cur.idx]?.scramble !== '') return;
      const list = [...cur.list];
      list[cur.idx] = timerScrambleHistoryEntry(generated);
      applyScrambleHist({ list, idx: cur.idx });
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [event, mode222, non222ByStepsEvent, genStepsSig, scramble, byStepsRetry, applyScrambleHist]);

  // 后台 worker 打乱(共享二阶专项 provider / csTimer 的 FTO、二阶五魔等):
  // 与 WCA 真题一样是异步的 ——
  // 队列干了就先出 '',这里补上；共享二阶队列按语义 type 隔离,csTimer 队列按 key + length
  // 隔离,专项之间不会串题。
  // 期间显示转圈(而不是掉进 '—' 或退化成三阶打乱)。队列已有货时只做后台预取,不动当前打乱。
  // 手动输入模式例外:那里的 '' 表示「队列是空的,去粘贴打乱」(strip 有对应提示),
  // 不是「还在生成」—— 塞一条生成打乱进去会把提示吞掉。
  const [cstimerLoading, setCstimerLoading] = useState(false);
  useEffect(() => {
    // 枫叶/齿轮启用精确难度后由完整图生成，不再启动 csTimer Worker 补位；尤其 0 步的
    // 恒等打乱也不能被当成「Worker 尚未返回」。
    const special = special222TypeRef.current;
    if ((!special && !isNonWcaEvent(event)) || settings.scrambleSource === 'manual' || genStepsSig) {
      setCstimerLoading(false);
      return;
    }
    if (special) prefetchCube222SpecialScramble(special);
    else prefetchNonWca(event);
    if (scramble !== '') { setCstimerLoading(false); return; }
    let cancelled = false;
    const waiter = new AbortController();
    setCstimerLoading(true);
    const pending = special
      ? nextCube222SpecialScramble(special, waiter.signal)
      : nextNonWcaScramble(event, waiter.signal);
    void pending.then((real) => {
      if (cancelled) return;
      setCstimerLoading(false);
      const cur = scrambleHistRef.current;
      if (!real || cur.list[cur.idx]?.scramble !== '') return;
      const list = [...cur.list];
      list[cur.idx] = timerScrambleHistoryEntry(real);
      applyScrambleHist({ list, idx: cur.idx });
    });
    return () => {
      cancelled = true;
      waiter.abort();
    };
  }, [event, scramble, settings.scrambleSource, special222Sig, genStepsSig, type222, applyScrambleHist]);

  // 「按难度生成」:状态采样在 worker(冷启建表 0.3~10s),打乱文本由 min2phase 现算 —— 首条要等,
  // 之后队列已预热。'' = 还在生成(转圈)。**取不到分两种**:worker 证明了这个窗口没有任何状态
  // (empty)才说「生成不出来」;只是没在预算内找到(rare)说的是「太稀有」并且可以再试 ——
  // 冷启建表被算成「不存在」正是之前那条假提示的来源。绝不塞一条别的难度的打乱冒充。
  const [trainerLoading, setTrainerLoading] = useState(false);
  const [trainerMiss, setTrainerMiss] = useState<'empty' | 'rare' | null>(null);
  // 「再试一次」靠它重跑下面那个 effect —— 重试不改 spec,不进依赖就不会重新 await。
  const [trainerRetry, setTrainerRetry] = useState(0);
  useEffect(() => {
    const spec = trainerSpecRef.current;
    // 难度关了 / 不适用:放掉缓冲,否则上一个 spec 的 awaitTrainer 永远不会落地。
    if (!spec) { releaseTrainer(); setTrainerLoading(false); setTrainerMiss(null); return; }
    prefetchTrainer(spec);
    if (scramble !== '') { setTrainerLoading(false); setTrainerMiss(null); return; }
    let cancelled = false;
    setTrainerLoading(true);
    setTrainerMiss(null);
    void awaitTrainer(spec).then((status) => {
      if (cancelled) return;
      setTrainerLoading(false);
      if (status === 'empty' || status === 'rare') { setTrainerMiss(status); return; }
      if (status !== 'ready') return;
      const cur = scrambleHistRef.current;
      if (cur.list[cur.idx]?.scramble !== '') return;
      const real = peekTrainer(spec);
      if (!real) return;
      const list = [...cur.list];
      list[cur.idx] = timerScrambleHistoryEntry(real);
      applyScrambleHist({ list, idx: cur.idx });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scramble, trainerSigVal, trainerRetry, applyScrambleHist]);

  const attemptCanStart = timerCanStartAttempt({
    availability: randomOptimalLoading || scrambleLoading || cstimerLoading
      || trainerLoading || byStepsLoading
      ? 'loading'
      : randomOptimalFailed || byStepsFailed || trainerMiss !== null || wcaSourceEmpty
        ? 'unavailable'
        : 'ready',
    emptyScrambleAllowed: timerScrambleAllowsEmptySlot(event, settings.scrambleSource),
    scramble,
    sourceMatches: scrambleGeneratorAtHistoryResetRef.current === genScramble,
  });
  const attemptCanStartRef = useRef(attemptCanStart);
  attemptCanStartRef.current = attemptCanStart;

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
  const wcaSource = settings.scrambleSource === 'wca' && !scrambleLoading
    ? wcaMetaFor(currentScrambleEntry.wca ?? scramble)
    : null;
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
    const meta = s.scrambleSource?.kind === 'wca'
      ? wcaMetaForSlot(s.scrambleSource.identity)
      : wcaMetaFor(s.scramble);
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
    const s = scrambleHistRef.current.list[scrambleHistRef.current.idx]?.scramble ?? '';
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
    applyScrambleHist(histPush(scrambleHistRef.current, timerScrambleHistoryEntry(t)));
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
    scrambleGeneratorAtHistoryResetRef.current = genScramble;
    applyScrambleHist({ list: [genScramble()], idx: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genScramble, kociembaReady]);

  // ── Solve recording ─────────────────────────────────────────────
  const [lastPenalty, setLastPenalty] = useState<Penalty | null>(null);
  // Generic undo/info toast for swipe-delete etc.
  type InfoToastPayload = { msg: string; undo?: () => void };
  const infoToastSequenceRef = useRef(0);
  const [infoToast, setInfoToastState] = useState<(InfoToastPayload & { sequence: number }) | null>(null);
  const setInfoToast = useCallback((next: InfoToastPayload | null) => {
    setInfoToastState(next ? { ...next, sequence: ++infoToastSequenceRef.current } : null);
  }, []);
  const byEventRef = useRef(byEvent);
  useEffect(() => { byEventRef.current = byEvent; }, [byEvent]);
  const scrambleAtStartRef = useRef<string>(scramble);
  const wcaAtStartRef = useRef<WcaDispensedScramble | null>(currentScrambleEntry.wca);
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
    if (wcaAtStartRef.current?.slot) {
      solve.scrambleSource = { kind: 'wca', identity: wcaAtStartRef.current.slot };
    }
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
    submitTimerTrainingEvidence(trainingDestinationRef.current, solve);
    // 拧完了复盘就在这一屏,不用去成绩里找那条刚拧的。只对录到动作流的成绩成立
    // (判据见 shouldAutoRecap),下一把一开始就收起。
    setRecapId(shouldAutoRecap(solve, { autoRecap: settings.autoRecap }) ? solve.id : null);
    if (res.autoPenalty === 'DNF') petReact('error');
    nextScramble();
  }, [nextScramble, settings.multiStage, settings.bldMemo, settings.precision, settings.autoRecap]);

  const timer = useTimer(recordSolve);
  cancelArmForScrambleChangeRef.current = timer.cancelArm;

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
      wcaAtStartRef.current = currentScrambleEntry.wca;
      eventAtStartRef.current = event;
      caseIdAtStartRef.current = timerTracksTrainerCase(event)
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
  }, [timer.phase, scramble, event, currentScrambleEntry.wca]);

  // ── Bluetooth smart cube ────────────────────────────────────────
  const phaseSnapshotRef = useRef(timer.phase);
  useEffect(() => { phaseSnapshotRef.current = timer.phase; }, [timer.phase]);
  const onPressDown = useCallback((withWarmup = false): boolean => {
    if (!timerCanHandleAttemptPress(
      phaseSnapshotRef.current,
      attemptCanStartRef.current,
    )) return false;
    if (withWarmup) warmupSound();
    timer.onPressDown();
    return true;
  }, [timer.onPressDown]);
  const onPressUp = useCallback((): boolean => {
    if (!attemptCanStartRef.current && phaseSnapshotRef.current !== 'running') {
      timer.cancelArm();
      return false;
    }
    timer.onPressUp();
    return true;
  }, [timer.cancelArm, timer.onPressUp]);
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
  // 姿态流录制。样本时刻用 performance.now() 而不是 solveStartTsRef —— 后者在
  // 「魔方起表」那条路上存的是**设备时钟**,而陀螺仪回调根本不带时间戳,两个
  // 时钟相减出来的是垃圾。这里自己记一个本地起点。
  const gyroRecRef = useRef(new GyroRecorder());
  const gyroStartRef = useRef(0);
  // What the live view actually rendered. LiveCubeState decides — it owns the
  // phone / no-sample / not-anchored fallbacks — and reports back, because the
  // calibrate button below must follow the outcome, not the request.
  const [liveCubeView, setLiveCubeView] = useState<'2d' | 'net' | '3d' | 'q2look'>('net');

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
    if (!attemptCanStartRef.current) return;
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
    onGyro: (settings.liveCubeView === '3d' || settings.recordGyro)
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
    onSolved: (atMs) => {
      if (phaseSnapshotRef.current === 'running' && timer.stopFromCube(atMs)) {
        phaseSnapshotRef.current = 'stopped';
      }
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
        onPressDown(true);
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
  const latestPresenceSolve = solves.at(-1);
  useEffect(() => {
    onPresenceChange?.({
      ...(cubeConnected ? { normal: 0, smart: 1 } : { normal: 1, smart: 0 }),
      mode: 'solo',
      players: 1,
      events: [event],
      results: latestPresenceSolve ? [{
        event: latestPresenceSolve.event,
        timeMs: latestPresenceSolve.timeMs,
        penalty: latestPresenceSolve.penalty,
        at: latestPresenceSolve.ts,
      }] : [],
      devices: cubeConnected ? [{
        name: bluetoothCube.status.deviceName,
        ...(bluetoothCube.status.deviceId ? { id: bluetoothCube.status.deviceId } : {}),
      }] : [],
    });
  }, [
    cubeConnected,
    bluetoothCube.status.deviceId,
    bluetoothCube.status.deviceName,
    event,
    latestPresenceSolve?.event,
    latestPresenceSolve?.penalty,
    latestPresenceSolve?.timeMs,
    latestPresenceSolve?.ts,
    onPresenceChange,
  ]);
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

  // 复盘那一屏的整条懒加载链,魔方一连上就预取。连了智能魔方的人下一步几乎必然是
  // 拧一把,而拧完那一下 SolveRecap 就要渲染 —— 到那时才开始下载 200 KB 的报告
  // (它自己还要再串三维魔方和 OLL/PLL 表),就是眼睁睁等一秒。这里把三级串行摊平成
  // 一次空闲期的并行下载,和成绩详情那条路走的是同一份清单(见 SolveModal)。
  useEffect(() => {
    if (!cubeConnected) return;
    return onIdle(() => {
      void import('../_components/SolveRecap');
      void import('../_components/ReconstructReport');
      void import('@/components/sim-embed/SimCubeView');
      void import('@/components/sim-embed/mountSimWorld');
      void import('@/lib/oll_lookup').then((m) => { m.prewarmOllTable(); });
      void import('@/lib/pll_lookup').then((m) => { m.prewarmPllTable(); });
    }, { timeout: 1000 });
  }, [cubeConnected]);

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
            mode={settings.liveCubeView}
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
  const scrambleTarget = useMemo(() => (
    timerSupportsSmartCubeAutoTiming(event) && scramble.trim()
      ? smartCubeTargetFacelets(scramble)
      : null
  ), [event, scramble]);

  const [scrambleGuidance, setScrambleGuidance] = useState<SmartCubeGuidanceState>({
    correctionActive: false,
    hint: null,
    match: null,
  });
  const scrambleGuidanceController = useMemo(() => createSmartCubeGuidanceController({
    onChange: setScrambleGuidance,
    solve: async (fromFacelets, targetFacelets) => {
      const from = fromFaceletString(fromFacelets);
      const target = fromFaceletString(targetFacelets);
      return from && target ? fixupScramble(from, target) : null;
    },
  }), []);
  useLayoutEffect(() => {
    scrambleGuidanceController.setContext(scrambleTarget
      ? {
        id: currentScrambleEntry.id,
        scramble,
        targetFacelets: scrambleTarget,
      }
      : null);
  }, [currentScrambleEntry.id, scramble, scrambleGuidanceController, scrambleTarget]);
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
    onPressDown(true);
  };

  useEffect(() => {
    const subs = bluetoothSubscribersRef.current;
    const verify = () => {
      const running = phaseSnapshotRef.current === 'running';
      scrambleGuidanceController.setRunning(running);
      if (running) return;
      const faces = bluetoothCubeRef.current?.getFaces();
      if (!faces) return;
      const observation = scrambleGuidanceController.observe(toFaceletString(faces));
      // 「打乱正确即预备」 belongs here and not in an effect over match state:
      // it is the EVENT of a turn completing the scramble, not the state of
      // matching. As state it also fires on the commit where a solve ends —
      // the match is still `true` from before the solve there (the
      // check skips while running), so every solve armed the next attempt and
      // the next scramble's own turns started the clock.
      if (observation.completedNow) armFromScrambleRef.current();
    };
    subs.add(verify);
    return () => { subs.delete(verify); };
  }, [scrambleGuidanceController]);
  useLayoutEffect(() => {
    scrambleGuidanceController.setConnected(cubeConnected);
    return () => scrambleGuidanceController.setConnected(false);
  }, [cubeConnected, scrambleGuidanceController]);
  // Mid-solve the strip goes back to plain text: the cube has left the
  // scrambled state on purpose, so "you still owe R" would be nonsense.
  useLayoutEffect(() => {
    scrambleGuidanceController.setRunning(timer.phase === 'running');
  }, [scrambleGuidanceController, timer.phase]);
  useLayoutEffect(() => {
    if (bluetoothCube.facelets) {
      scrambleGuidanceController.syncFacelets(bluetoothCube.facelets);
    }
  }, [
    bluetoothCube.facelets,
    cubeConnected,
    currentScrambleEntry.id,
    scramble,
    scrambleGuidanceController,
    scrambleTarget,
    timer.phase,
  ]);


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

  // ── External timing devices (BLE smart timer / Stackmat mic) ───
  // Record the time the device measured verbatim rather than re-timing locally.
  // A BLE timer drives the page's live display while it runs, then supplies an
  // explicit event/scramble snapshot and exact hardware reading when it stops.
  type ExternalAttempt = { event: EventId; scramble: string };
  type ExternalRecordContext = ExternalAttempt & { inspectionMs?: number };
  const externalTimeRecordRef = useRef<((ms: number, context?: ExternalRecordContext) => void) | null>(null);
  externalTimeRecordRef.current = (ms: number, context?: ExternalRecordContext) => {
    if (!Number.isFinite(ms) || ms < 0) {
      setInfoToast({
        msg: tr({ zh: '计时器返回了无效读数，未保存成绩', en: 'The timer returned an invalid reading; no result was saved' }),
      });
      return;
    }
    const solveEvent = context?.event ?? eventAtStartRef.current;
    const solve = makeSolve({
      timeMs: Math.round(ms),
      scramble: context?.scramble ?? scrambleAtStartRef.current,
      event: solveEvent,
      penalty: 'ok',
    });
    if (context?.inspectionMs !== undefined
      && Number.isFinite(context.inspectionMs)
      && context.inspectionMs > 0) {
      solve.inspectionMs = Math.round(context.inspectionMs);
    }
    setLastPenalty('ok');
    setByEvent(prev => ({ ...prev, [solveEvent]: [...(prev[solveEvent] ?? []), solve] }));
    submitTimerTrainingEvidence(trainingDestinationRef.current, solve);
    nextScramble();
  };
  const stackmatAttemptRef = useRef<ExternalAttempt | null>(null);
  const stackmat = useStackmat({
    onStart: () => {
      stackmatAttemptRef.current = attemptCanStartRef.current ? { event, scramble } : null;
    },
    onStop: (ms) => {
      const attempt = stackmatAttemptRef.current;
      stackmatAttemptRef.current = null;
      if (attempt) externalTimeRecordRef.current?.(ms, attempt);
    },
  });

  const [bluetoothTimerMacPrompt, setBluetoothTimerMacPrompt] = useState<{
    deviceName: string;
    suggestedMac?: string;
  } | null>(null);
  const bluetoothTimerMacResolverRef = useRef<((mac: string | null) => void) | null>(null);
  const requestBluetoothTimerMac = useCallback((deviceName: string, suggestedMac?: string) => new Promise<string | null>((resolve) => {
    bluetoothTimerMacResolverRef.current = resolve;
    setBluetoothTimerMacPrompt({ deviceName, suggestedMac });
  }), []);
  const resolveBluetoothTimerMac = useCallback((mac: string | null) => {
    bluetoothTimerMacResolverRef.current?.(mac);
    bluetoothTimerMacResolverRef.current = null;
    setBluetoothTimerMacPrompt(null);
  }, []);
  const bluetoothTimerAttemptRef = useRef<ExternalAttempt | null>(null);
  const bluetoothTimer = useBluetoothTimer({
    onNeedMac: requestBluetoothTimerMac,
    onEvent: (timerEvent) => {
      if (timerEvent.state === 'IDLE' || timerEvent.state === 'GAN_RESET') {
        bluetoothTimerAttemptRef.current = null;
        timer.reset();
        phaseSnapshotRef.current = 'idle';
        return;
      }
      if (timerEvent.state === 'DISCONNECT') {
        if (bluetoothTimerAttemptRef.current !== null) timer.reset();
        bluetoothTimerAttemptRef.current = null;
        phaseSnapshotRef.current = 'idle';
        return;
      }
      if (timerEvent.state === 'HANDS_ON'
        || timerEvent.state === 'GET_SET'
        || timerEvent.state === 'INSPECTION') {
        if (attemptCanStartRef.current) {
          bluetoothTimerAttemptRef.current ??= { event, scramble };
        } else {
          bluetoothTimerAttemptRef.current = null;
        }
      }
      if (timerEvent.state === 'RUNNING') {
        if (!attemptCanStartRef.current) {
          bluetoothTimerAttemptRef.current = null;
          timer.reset();
          phaseSnapshotRef.current = 'idle';
          return;
        }
        bluetoothTimerAttemptRef.current ??= { event, scramble };
        // QiYi reports the device reading when RUNNING begins, then csTimer
        // advances the browser display locally until the exact STOPPED frame.
        // Starting from that reading mirrors cstimer/src/js/timer/bttimer.js.
        timer.startNow(timerEvent.solveTime ?? 0);
        phaseSnapshotRef.current = 'running';
      }
    },
    onStop: (ms, timerEvent) => {
      const attempt = bluetoothTimerAttemptRef.current;
      if (phaseSnapshotRef.current !== 'running' || attempt === null) return;
      eventAtStartRef.current = attempt.event;
      scrambleAtStartRef.current = attempt.scramble;
      timer.stopExternal(ms, timerEvent.inspectTime);
      phaseSnapshotRef.current = 'stopped';
      bluetoothTimerAttemptRef.current = null;
    },
    onConnectionLost: () => {
      const interrupted = bluetoothTimerAttemptRef.current !== null;
      bluetoothTimerAttemptRef.current = null;
      if (interrupted) timer.reset();
      phaseSnapshotRef.current = 'idle';
      setInfoToast({
        msg: interrupted
          ? tr({ zh: '蓝牙计时器已断开，这一次可能无法自动记录', en: 'Bluetooth timer disconnected; this attempt may not be recorded automatically' })
          : tr({ zh: '蓝牙计时器连接断开', en: 'Bluetooth timer disconnected' }),
      });
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
  const { reset, cancelArm, cancelPress } = timer;
  const solvesRef = useRef(solves);
  useEffect(() => { solvesRef.current = solves; }, [solves]);

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const digitsRef = useRef<HTMLDivElement | null>(null);

  // Stable host effects keyed by the shared eight-direction action IDs. The
  // direction order and enabled rules live in @cuberoot/shared/timer.
  const gestureActionsRef = useRef<Partial<Record<TimerGestureActionId, () => void>>>({});

  // Radial press-and-drag dial (idle/stopped) — shared with the /alg trainer run page via the
  // useGestureWheel hook. A plain hold still times; only a drag fires a slot.
  const { wheelRef: gestureWheelRef } = useGestureWheel({
    surfaceRef,
    canGesture: () => {
      const ph = phaseSnapshotRef.current;
      return timerCanUseGestureWheel(ph);
    },
    enabledFor: () => {
      return timerGestureActionStates({
        hasLastSolve: solvesRef.current.length > 0,
        hasPreviousScramble: scrambleHistRef.current.idx > 0,
      }).map((action) => action.enabled);
    },
    fireAction: (direction) => {
      const action = timerGestureActionAt(direction);
      if (action) gestureActionsRef.current[action.id]?.();
    },
    // 计时关(练习模式):按下不预备,松开(未拖动)直接下一个打乱,不计时不记成绩。同 /alg 训练器。
    onPressDown: () => {
      if (!getSettings().timingEnabled) return;
      onPressDown(true);
    },
    onPressCancel: () => cancelPress(),
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
    setByEvent(prev => {
      const result = updateTimerHistorySolve(prev[event] ?? [], solveId, patch);
      return result.changed
        ? { ...prev, [event]: result.solves as Solve[] }
        : prev;
    });
  }, [event]);

  const deleteSolve = useCallback((solveId: string) => {
    setByEvent(prev => {
      const result = deleteTimerHistorySolve(prev[event] ?? [], solveId);
      return result.changed
        ? { ...prev, [event]: result.solves as Solve[] }
        : prev;
    });
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
        setByEvent(prev => {
          const result = restoreTimerHistorySolve(prev[ev] ?? [], last);
          return result.changed ? { ...prev, [ev]: result.solves as Solve[] } : prev;
        });
        setLastPenalty(last.penalty);
      },
    });
  }, [solves, event, deleteSolve, isZh]);

  const clearAll = useCallback(() => {
    if (!solves.length) return;
    const evName = EVENTS.find(e => e.id === event);
    const name = tr({ en: evName?.nameEn ?? event, zh: evName?.nameZh ?? event });
    if (!confirm(tr(timerClearCurrentEventConfirmation(name, solves.length)))) return;
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

  // ── 停表后就地摊开的复盘 ────────────────────────────────────────
  // 存 id 不存 solve:改惩罚、加注释、删除都在别处写库,存快照就得跟着同步,而这块
  // 显示的正是那些数字。null = 不显示(还没拧完 / 关了开关 / 用户收起了 / 开下一把)。
  const [recapId, setRecapId] = useState<string | null>(null);
  const recapSolve = useMemo(
    () => (recapId ? solves.find(s => s.id === recapId) ?? null : null),
    [recapId, solves],
  );
  // 开下一把就收起 —— 观察、按住、计时中都不该有半屏复盘在下面。停表停在原地
  // (那正是它该在的时候),换项目/换会话由上面 find 不到自然落空。
  useEffect(() => {
    if (timer.phase !== 'stopped') setRecapId(null);
  }, [timer.phase]);

  // Gesture: open the last solve's detail (to add a note / comment).
  const commentLast = useCallback(() => {
    const cur = solvesRef.current;
    const last = cur[cur.length - 1];
    if (!last) return;
    setModalSolve({ s: last, idx: cur.length - 1 });
  }, []);

  // Wire the shared gesture IDs to Web effects. Availability is resolved by
  // timerGestureActionStates above; this map contains no placeholder effects.
  useEffect(() => {
    gestureActionsRef.current = {
      'next-scramble': nextScramble,
      'penalty-ok': () => changeLastPenalty('ok'),
      'toggle-plus2': () => changeLastPenalty(lastPenalty === '+2' ? 'ok' : '+2'),
      'toggle-dnf': () => changeLastPenalty(lastPenalty === 'DNF' ? 'ok' : 'DNF'),
      'prev-scramble': prevScramble,
      'comment-last': commentLast,
      'delete-last': swipeDeleteLast,
      'copy-scramble': copyScrambleFlash,
    };
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
      const ephemeral = solveFromReplay(decoded, byEvent[decoded.event] ?? []);
      setReconstructSolve(ephemeral);
    }
    void setReplay(null);
  }, [replay, setReplay, byEvent]);

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
    const ephemeral = solveFromReplay(decoded, byEvent[decoded.event] ?? []);
    setReconstructSolve(ephemeral);
  }, [isZh, byEvent]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const [bluetoothOpen, setBluetoothOpen] = useState(false);
  const [bluetoothConnectAttempt, setBluetoothConnectAttempt] = useState<Promise<void> | null>(null);
  const bluetoothConnectingRef = useRef(false);
  const [bluetoothTimerOpen, setBluetoothTimerOpen] = useState(false);
  const [bluetoothTimerConnectAttempt, setBluetoothTimerConnectAttempt] = useState<Promise<void> | null>(null);
  const [stackmatOpen, setStackmatOpen] = useState(false);
  const [stackmatConnectAttempt, setStackmatConnectAttempt] = useState<Promise<void> | null>(null);
  const stackmatConnectingRef = useRef(false);
  const [trainerSubsetOpen, setTrainerSubsetOpen] = useState<'oll' | 'pll' | null>(null);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [solverOpen, setSolverOpen] = useState(false);
  const [bulkScrambleOpen, setBulkScrambleOpen] = useState(false);
  const [bldHelperOpen, setBldHelperOpen] = useState(false);
  const [showCrossSession, setShowCrossSession] = useState(false);

  useEffect(() => {
    // Defer one task so React Strict Mode can cancel its test mount before any
    // Bluetooth side effect begins. The real mount then starts exactly once.
    const timer = window.setTimeout(() => {
      bluetoothConnectingRef.current = true;
      const attempt = bluetoothCube.preconnectGrantedDevice().then(() => undefined);
      setBluetoothConnectAttempt(attempt);
      void attempt.finally(() => {
        bluetoothConnectingRef.current = false;
      }).catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bluetoothCube.preconnectGrantedDevice]);

  const connectExternalBluetooth = useCallback(() => {
    if (bluetoothCube.status.connected) {
      setBluetoothOpen(true);
      return;
    }
    if (bluetoothTimer.status.connected) {
      setBluetoothTimerOpen(true);
      return;
    }
    if (bluetoothConnectingRef.current) {
      setBluetoothOpen(true);
      return;
    }

    // Exactly one requestDevice() starts from this click. After the user picks
    // a device, its registry/service signature routes it to the matching
    // connector without an intermediate in-app device-type menu.
    bluetoothConnectingRef.current = true;
    void (async () => {
      let modalOwner: 'cube' | 'timer' | null = null;
      try {
        const device = await requestUnifiedBluetoothDevice();
        if (!device) return;
        const kind = await classifyUnifiedBluetoothDevice(device);
        if (kind === 'smart-timer') {
          modalOwner = 'timer';
          setBluetoothTimerOpen(true);
          const attempt = bluetoothTimer.connectDevice(device);
          setBluetoothTimerConnectAttempt(attempt);
          await attempt;
          return;
        }

        modalOwner = 'cube';
        setBluetoothOpen(true);
        const attempt = bluetoothCube.connectDevice(device);
        setBluetoothConnectAttempt(attempt);
        await attempt;
      } catch (error) {
        // Connection errors are rendered by the relevant modal. A failure
        // before classification has no better device-specific owner, so reuse
        // the mature Bluetooth diagnostics shown by the smart-cube modal.
        if (modalOwner === null) {
          const failedAttempt = Promise.reject(error);
          void failedAttempt.catch(() => undefined);
          setBluetoothConnectAttempt(failedAttempt);
          setBluetoothOpen(true);
        }
      } finally {
        bluetoothConnectingRef.current = false;
      }
    })();
  }, [
    bluetoothCube,
    bluetoothTimer,
  ]);

  const connectStackmat = useCallback(() => {
    setStackmatOpen(true);
    if (stackmat.status.listening || stackmatConnectingRef.current) return;

    // Match the Bluetooth capsule: the first click starts the browser-owned
    // permission flow directly. The modal only observes this attempt and
    // becomes the status / input-device / retry surface.
    stackmatConnectingRef.current = true;
    const attempt = stackmat.start();
    setStackmatConnectAttempt(attempt);
    void attempt.finally(() => {
      stackmatConnectingRef.current = false;
    }).catch(() => undefined);
  }, [stackmat]);

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
    settingsOpen || bluetoothOpen || bluetoothTimerOpen || stackmatOpen ||
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
    return timerCanSwitchScramble(phaseRef.current);
  }, []);
  const sheetPrevScramble = useCallback(() => { if (canSwitchScramble()) prevScramble(); }, [canSwitchScramble, prevScramble]);
  const sheetNextScramble = useCallback(() => { if (canSwitchScramble()) nextScramble(); }, [canSwitchScramble, nextScramble]);
  // Through a ref so rebinding a key doesn't tear down and re-add the window
  // listeners — and so the handler's dep array stays as it was.
  const resolvedKeymap = useMemo(() => resolveKeymap(settings.keymap), [settings.keymap]);
  const keymapRef = useRef(resolvedKeymap);
  useEffect(() => { keymapRef.current = resolvedKeymap; }, [resolvedKeymap]);
  useEffect(() => {
    const executeKeyboardDecision = (
      decision: ReturnType<typeof timerKeyDownDecision>,
      event: KeyboardEvent,
      modal: TimerKeyboardModalState,
    ) => {
      if (decision.preventDefault) event.preventDefault();
      if (decision.blurActiveElement && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      const command = decision.command;
      const currentSolves = solvesRef.current;
      const last = currentSolves[currentSolves.length - 1];
      const togglePenalty = (penalty: Penalty) => {
        if (!last) return;
        const next: Penalty = last.penalty === penalty ? 'ok' : penalty;
        updateSolve(last.id, { penalty: next });
        setLastPenalty(next);
      };

      switch (command.id) {
        case 'none':
          return;
        case 'press-down':
          onPressDown(command.warmupSound);
          return;
        case 'press-up':
          onPressUp();
          return;
        case 'reset':
          reset();
          return;
        case 'mark-stage':
          multiStageRef.current?.markStage(command.stage);
          return;
        case 'mark-bld-memo':
          bldMemoRef.current?.markMemo();
          return;
        case 'delete-last':
          if (last) {
            deleteSolve(last.id);
            setLastPenalty(null);
          }
          return;
        case 'toggle-plus2':
          togglePenalty('+2');
          return;
        case 'toggle-dnf':
          togglePenalty('DNF');
          return;
        case 'toggle-dns':
          togglePenalty('DNS');
          return;
        case 'next-scramble':
          (modal === 'hints-only' ? sheetNextScramble : nextScramble)();
          return;
        case 'prev-scramble':
          (modal === 'hints-only' ? sheetPrevScramble : prevScramble)();
          return;
        case 'toggle-fullscreen':
          void toggleFullscreen();
          return;
        case 'open-solve': {
          const index = currentSolves.length - command.offsetFromLast;
          if (index >= 0) setModalSolve({ s: currentSolves[index], idx: index });
          return;
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const modal: TimerKeyboardModalState = !anyModalOpenRef.current
        ? 'none'
        : hintsOnlyRef.current ? 'hints-only' : 'blocking';
      executeKeyboardDecision(timerKeyDownDecision({
        input: e,
        target: timerKeyboardTargetContext(e.target),
        modal,
        phase: phaseRef.current,
        timingEnabled: getSettings().timingEnabled,
        multiStageActive,
        bldMemoActive,
        keymap: keymapRef.current,
        solveCount: solvesRef.current.length,
      }), e, modal);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      executeKeyboardDecision(timerKeyUpDecision({
        input: e,
        target: timerKeyboardTargetContext(e.target),
        modalOpen: anyModalOpenRef.current,
        timingEnabled: getSettings().timingEnabled,
      }), e, 'none');
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
      const t = e.target as Node | null;
      const insideSurface = !!(surfaceRef.current && t && surfaceRef.current.contains(t));
      if (timerShouldStopFromExternalPointer(phaseSnapshotRef.current, insideSurface)) {
        onPressDown();
      }
    };
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [onPressDown]);

  // ── External devices + More menu items ──────────────────────────
  const deviceActive = bluetoothCube.status.connected
    || bluetoothTimer.status.connected
    || stackmat.status.listening;

  const moreItems = useMemo<MoreMenuItem[]>(() => visibleTimerMoreActions({
    compactViewport: isMobile,
    drillActive: drillTarget !== null,
    event,
    fullscreen,
    solveCount: solves.length,
  }).map((action): MoreMenuItem => {
    const base = { ...action, label: tr(TIMER_MORE_ACTION_COPY[action.id]) };
    switch (action.id) {
      case 'more.marks':
        return { ...base, href: '/timer/marks' };
      case 'more.stats-mobile':
        return { ...base, onSelect: () => setStatsModalOpen(true) };
      case 'more.language-mobile':
        return {
          ...base,
          onSelect: () => {
            let next: 'en' | 'zh' = 'zh';
            if (i18n.language.startsWith('zh')) next = 'en';
            void i18n.changeLanguage(next);
            syncLangToUrl(next);
          },
        };
      case 'more.drill':
        return { ...base, onSelect: () => setDrillModalOpen(true) };
      case 'more.bld-helper':
        return { ...base, onSelect: () => setBldHelperOpen(true) };
      case 'more.fullscreen':
        return { ...base, onSelect: toggleFullscreen };
      case 'more.manual-entry':
        return { ...base, onSelect: () => setManualEntryOpen(true) };
      case 'more.replay':
        return { ...base, onSelect: handlePasteReplay };
      case 'more.solver':
        return { ...base, onSelect: () => setSolverOpen(true) };
      case 'more.bulk':
        return { ...base, onSelect: () => setBulkScrambleOpen(true) };
      case 'more.print':
        return { ...base, onSelect: () => printControllerRef.current?.print() };
      case 'more.clear-event':
        return { ...base, onSelect: clearAll };
    }
  }), [clearAll, drillTarget, event, fullscreen, handlePasteReplay, i18n, isMobile, isZh, solves.length, toggleFullscreen]);

  const allSolves = useMemo(() => {
    const out: Solve[] = [];
    for (const list of Object.values(byEvent)) out.push(...list);
    return out;
  }, [byEvent]);

  // ── Derived display (digits text + color class) ─────────────────
  const stats = useMemo(() => summarize(solves, event), [solves, event]);
  const inspectionLimit = settings.inspectionSec;
  const colorClass = useMemo(() => {
    if (timer.phase === 'holding') return 'holding';
    if (timer.phase === 'ready') return 'ready';
    if (timer.phase === 'running') return 'running';
    if (timer.phase === 'inspecting') {
      const penalty = inspectionPenalty(timer.inspectionDisplayMs, inspectionLimit);
      if (penalty === 'DNF') return 'inspection-dnf';
      if (penalty === '+2') return 'inspection-plus2';
      const sec = Math.floor(timer.inspectionDisplayMs / 1000);
      if (sec >= 12) return 'inspection-warn-12';
      if (sec >= 8) return 'inspection-warn-8';
      return 'inspection';
    }
    if (timer.phase === 'stopped' && (lastPenalty === 'DNF' || lastPenalty === 'DNS')) return 'dnf';
    return '';
  }, [timer.phase, timer.inspectionDisplayMs, inspectionLimit, lastPenalty]);

  const digitsText = useMemo(() => {
    return formatTimerTimingDisplay({
      displayMs: timer.displayMs,
      hideTime: settings.hideTime,
      inspectionDisplayMs: timer.inspectionDisplayMs,
      inspectionLimitSec: inspectionLimit,
      lastPenalty,
      phase: timer.phase,
      precision: settings.precision,
      runningPrecision: settings.runningPrecision,
      timingEnabled: settings.timingEnabled,
    });
  }, [timer.phase, timer.inspectionDisplayMs, timer.displayMs, inspectionLimit, lastPenalty, settings.hideTime, settings.precision, settings.runningPrecision, settings.timingEnabled]);

  const fontSize = `calc(clamp(48px, 10vw, 132px) * ${settings.timerFontScale})`;

  // 短按进入 holding 时屏幕仍显示上一把成绩,排名徽章也应保持不动；长按到 ready
  // 后读数已清零,再隐藏徽章。inspectionDisplayMs 用来排除观察阶段里的 holding。
  const rankBadgePhase = timer.phase === 'stopped'
    || (timer.phase === 'holding' && timer.lastMs !== null && timer.inspectionDisplayMs === 0);
  // Rank badge centis from the last effective time (DNF -> null). 练习模式(计时关)下
  // timer.lastMs 可能还残留关闭前最后一次真实成绩 —— 没有新成绩产生,徽章不该显示。
  const rankCentis = useMemo<number | null>(() => {
    if (!settings.timingEnabled) return null;
    if (!rankBadgePhase || timer.lastMs === null || !Number.isFinite(timer.lastMs)) return null;
    if (lastPenalty === 'DNF' || lastPenalty === 'DNS') return null;
    const ms = lastPenalty === '+2' ? timer.lastMs + 2000 : timer.lastMs;
    return Math.round(ms / 10);
  }, [rankBadgePhase, timer.lastMs, lastPenalty, settings.timingEnabled]);

  const eventPickerGroups = useMemo<readonly TimerPuzzlePickerGroup[]>(() => (
    TIMER_EVENT_PICKER_GROUPS.map((group) => ({
      id: group.id,
      label: [group.nameEn, group.nameZh][Number(isZh)],
      items: group.items.map((item) => ({
        id: item.id,
        label: [item.nameEn, item.nameZh][Number(isZh)],
        iconClass: item.iconClass,
        textLabel: item.textLabel,
      })),
    }))
  ), [isZh]);

  // 「难度」开关的挂点。开关的可用性归打乱来源那两个配置组件(只有它们知道当前项目 / 当前
  // 比赛能不能按难度筛),但它属于顶栏这排常驻控件 —— 所以状态留在原处,DOM 用 portal 送上来。
  // 用 state 而非 ref:portal 的目标必须在子组件渲染时已存在,ref.current 那一帧还是 null。
  const [diffSlot, setDiffSlot] = useState<HTMLSpanElement | null>(null);

  const distractionFree = timer.phase === 'running' && !prefersReducedMotion;
  // Opt-in, and stronger than `distractionFree`: that one only fades
  // .surface-chrome, this also takes the side panel and the solver rail. It is
  // NOT gated on prefers-reduced-motion — the user asked for things to be
  // hidden, not animated; the reduced-motion block below drops the transition.
  const hideAllUi = timer.phase === 'running' && settings.hideAllUiWhileRunning;

  // ── Side-panel body ─────────────────────────────────────────────
  const renderPanelBody = () => {
    if (panelTab === 'times') {
      return (
        <>
          <SessionSwitcher
            isZh={isZh}
            event={event}
            onSessionsChanged={handleSessionsChanged}
          />
          {/* 这一档就是这些把本身:会话切换器 + 那张单子。算出来的数都在「统计」那档。 */}
          <HistoryPanel
            solves={solves}
            isZh={isZh}
            rollingStatColumns={settings.statsRollingColumns}
            onRowClick={(s, idx) => setModalSolve({ s, idx })}
            onQuickPenalty={(id, p) => updateSolve(id, { penalty: p })}
            onQuickDelete={(id) => deleteSolve(id)}
            onQuickComment={(s, idx) => setModalSolve({ s, idx })}
          />
        </>
      );
    }
    if (panelTab === 'stats') {
      return (
        <>
          <div className="shell-panel-statgrid">
            <StatsPanel solves={solves} event={event} />
            <CaseStatsPanel event={event} solves={solves} isZh={isZh} />
          </div>
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

  // 解法提示(仅 333)。同一个组件在两处挂点里二选一:桌面进右侧 .shell-rail(展开成竖栏),
  // 手机进顶栏那一组控件的末尾(点开 = 全屏浮层)。写成一个变量,免得两处各写一遍 props。
  const solverHintPanel = event === '333'
    ? (
        <SolverHintPanel
          scramble={scramble}
          isZh={isZh}
          resultsPanelOpen={panelTab !== null}
          onOpen={closeResultsPanel}
          onPrevScramble={sheetPrevScramble}
          onNextScramble={sheetNextScramble}
        />
      )
    : null;

  const retryableScramble = byStepsFailed
    || randomOptimalFailed
    || trainerMiss === 'rare';
  const retryDisplayedScramble = () => {
    if (byStepsFailed) {
      setByStepsRetry((value) => value + 1);
      return;
    }
    if (randomOptimalFailed) {
      const source = randomOptimalSourceRef.current;
      if (!source) return;
      retryOptimal333(source);
      setRandomOptimalRetry((value) => value + 1);
      return;
    }
    if (trainerMiss === 'rare') {
      const spec = trainerSpecRef.current;
      if (!spec) return;
      retryTrainer(spec);
      setTrainerRetry((value) => value + 1);
    }
  };
  const scrambleClickEffect = timerScrambleClickEffect(
    settings.scrambleClickAction,
    displayScramble.length > 0,
    attemptCanStart,
    retryableScramble,
  );

  return (
    <div
      className={`timer-shell${fullscreen ? ' fullscreen' : ''}${distractionFree ? ' is-solving' : ''}${hideAllUi ? ' hide-ui' : ''}${isDesktop && panelTab ? ' panel-open' : ''}`}
      data-solving={timer.phase === 'running' ? 'true' : undefined}
    >
      <TimerPrintController
        currentResult={digitsText}
        currentScramble={displayScramble}
        currentScrambleSource={timerPrintScrambleSource(
          settings.scrambleSource,
          isZh ? 'zh' : 'en',
          wcaSrcDisplay ? `${wcaSrcDisplay.name} · ${wcaSrcDisplay.meta}` : undefined,
        )}
        event={event}
        language={isZh ? 'zh' : 'en'}
        ref={printControllerRef}
        sessionName={activePrintSessionName}
        solves={solves}
        transport={browserPrintTransport}
      />

      {/* ── Topbar ──────────────────────────────────────────── */}
      <TimerTopbar
        brand={<CubeRootLogo className="shell-topbar-brand" />}
        controls={(
          <>
          {playersControl}
          <TimerPuzzlePicker
            selectedEvent={event}
            groups={eventPickerGroups}
            onSelect={(id) => {
              const nextEvent = timerEventIdFromSelector(id);
              if (nextEvent) selectEvent(nextEvent);
            }}
            puzzleLabel={tr({ zh: '项目', en: 'Puzzle' })}
            dataNoTimer
          />
          {/* 收起态用短名称,菜单保留完整名称。放在项目选择器右侧,和「人数」下拉同一组。 */}
          <TimerScrambleSourceSelect
            className="shell-scramble-source-select"
            triggerClassName="shell-players-select"
            popupClassName="shell-scramble-source-popup"
            labels={{
              ariaLabel: tr({ zh: '打乱来源', en: 'Scramble source' }),
              real: tr({ zh: '真题', en: 'Real' }),
              realOption: tr({ zh: 'WCA 真题', en: 'WCA real' }),
              random: tr({ zh: '随机', en: 'Random' }),
              randomOption: tr({ zh: '随机状态', en: 'Random state' }),
              manual: tr({ zh: '手动', en: 'Manual' }),
              manualOption: tr({ zh: '手动输入', en: 'Manual input' }),
            }}
            value={settings.scrambleSource}
            onChange={(scrambleSource) => updateSettings({ scrambleSource })}
            realValue="wca"
          />
          {/* 「难度」开关的落点(内容由 ScrambleSourceBar 里的两个配置组件 portal 过来)。
              摆在「解法」左边,和来源下拉同一组:难度讲的就是这条打乱怎么来的。
              data-no-timer 得挂在这儿 —— 开关已经不在打乱来源条里,借不到那块的豁免。 */}
          <span className="shell-topbar-diff" data-no-timer ref={setDiffSlot} />
          {/* 解法提示(手机形态)。桌面同一个组件挂在右侧 .shell-rail 里(见下),
              这里是二选一 —— 两处同时挂就有两个实例抢同一个 ?hints。 */}
          {!isDesktop && solverHintPanel}
          {/* 假魔方是 dev 调试入口,跟当前打乱相关,放在常驻计时控件末尾。 */}
          {DEV_PANEL && settings.showDevFakeCube && (
            <DevFakeCubePanel
              connected={bluetoothCube.status.connected}
              deviceName={bluetoothCube.status.deviceName ?? null}
              onConnect={bluetoothCube.connect}
              onDisconnect={bluetoothCube.disconnect}
              scramble={scramble}
            />
          )}
          </>
        )}
        actions={(
          <>
          {presenceControl}
          <MoreMenu items={moreItems} />
          <button type="button" className="tb-btn" onClick={() => setSettingsOpen(true)} title={tr({ zh: '设置', en: 'Settings'
        })}>
            <SettingsIcon size={14} />
          </button>
          </>
        )}
      />

      {/* ── Main column ─────────────────────────────────────── */}
      <div className="shell-main">
        {/* 打乱来源配置条 —— 常驻计时读数上方(全项目)。计时中随 surface-chrome 淡出。 */}
        <ScrambleSourceBar event={event} isZh={isZh} diffSlot={diffSlot} />
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
            <TimerScrambleStrip
              compact={settings.compactScramble}
              copied={scrambleCopied}
              copiedLabel={tr({ zh: '已复制', en: 'Copied' })}
              correctionActive={scrambleGuidance.correctionActive}
              fallback={randomOptimalLoading || scrambleLoading || cstimerLoading || trainerLoading || byStepsLoading
                ? <Spinner size={22} label={randomOptimalLoading
                    ? tr({ zh: '生成最优打乱', en: 'Generating optimal scramble' })
                    : cstimerLoading || trainerLoading || byStepsLoading
                      ? tr({ zh: '生成打乱', en: 'Generating scramble' })
                      : tr({ zh: '加载真实打乱', en: 'Loading real scramble' })} />
                : byStepsFailed
                  ? <>{tr({
                      zh: '按步数打乱生成失败。',
                      en: 'Could not generate a move-count scramble.',
                    })} {tr(TIMER_SCRAMBLE_CLICK_TITLE_COPY.retry)}</>
                  : randomOptimalFailed
                    ? <>{tr({
                        zh: '最优打乱生成失败。',
                        en: 'Could not generate an optimal scramble.',
                      })} {tr(TIMER_SCRAMBLE_CLICK_TITLE_COPY.retry)}</>
                    : trainerMiss
                      ? trainerMiss === 'empty'
                        ? tr({
                            zh: '没有任何打乱是这个难度,把步数范围放宽一点',
                            en: 'No scramble has this difficulty — widen the step range',
                          })
                        : <>{tr({
                            zh: '这个难度太稀有,一时找不出来。',
                            en: 'This difficulty is too rare to find quickly.',
                          })} {tr(TIMER_SCRAMBLE_CLICK_TITLE_COPY.retry)}</>
                      : wcaSourceEmpty
                        ? wca222Type
                          ? tr({ zh: '该范围没有匹配此类型的 WCA 真题,换个类型或范围试试', en: 'No WCA scramble of this type matches the range — try another type or range' })
                          : wcaStep
                            ? tr({ zh: '该步数范围没有匹配的 WCA 真题,换个步数试试', en: 'No WCA scramble matches this move-count range — try another range' })
                            : wcaSpec.diff
                              ? wcaSpec.mode === 'comp'
                                ? isWcaCompUnindexed(wcaSpec)
                                  ? tr({ zh: '难度库待更新', en: 'Difficulty index not updated yet' })
                                  : tr({ zh: '该比赛没有匹配此难度的真题,换个步数或配色试试', en: 'This competition has no scramble at this difficulty — try other step counts or colors' })
                                : tr({ zh: '该难度组合没有匹配的 WCA 真题,换个步数或配色试试', en: 'No WCA scramble matches this difficulty — try other step counts or colors' })
                              : wcaSpec.mode === 'comp'
                                ? tr({ zh: '该比赛没有此项目的打乱', en: 'This competition has no scrambles for this event' })
                                : tr({ zh: '该时间段内没有 WCA 真题', en: 'No WCA scrambles in this date range' })
                        : settings.scrambleSource === 'manual' && manualQueue.length === 0
                          ? tr({ zh: '在上方「打乱来源」粘贴打乱,每行一条', en: 'Paste scrambles above — one per line' })
                          : '—'}
              fallbackKind={randomOptimalLoading || scrambleLoading || cstimerLoading || trainerLoading || byStepsLoading
                ? 'custom'
                : 'empty'}
              font={settings.scrambleFont}
              fontScale={settings.scrambleFontScale}
              hint={scrambleGuidance.hint}
              match={scrambleGuidance.match}
              nonOptimal={wcaNonOptimal ? {
                label: tr({ zh: '非最优', en: 'non-optimal' }),
                title: tr({ zh: '该难度档暂无最优等态打乱,显示原始 WCA 打乱', en: 'No optimal-equivalent scramble for this difficulty — showing the original WCA scramble' }),
              } : undefined}
              onActivate={scrambleClickEffect === 'retry'
                ? retryDisplayedScramble
                : scrambleClickEffect === 'copy'
                  ? copyScrambleFlash
                  : scrambleClickEffect === 'next' ? nextScramble : undefined}
              scramble={randomOptimalLoading || scrambleLoading || cstimerLoading || trainerLoading
                || byStepsLoading || byStepsFailed || randomOptimalFailed || !!trainerMiss || wcaSourceEmpty
                ? ''
                : displayScramble}
              title={tr(TIMER_SCRAMBLE_CLICK_TITLE_COPY[scrambleClickEffect])}
              verificationLabels={{
                copiedCorrection: tr({ zh: '已复制原打乱', en: 'Copied the scramble' }),
                correction: tr({ zh: '拧回原打乱', en: 'Back to scramble' }),
                correctionTitle: tr({
                  zh: '拧歪了。这些不是上面那条打乱,而是从魔方现在的状态回到同一个打乱状态的步骤,拧完成绩记的还是原打乱。',
                  en: 'Off the scramble path. These moves are not the printed scramble — they lead from where the cube is now to the same scrambled state, and the solve still records the original scramble.',
                }),
                mismatch: tr({ zh: '与打乱不符', en: 'Doesn’t match' }),
                ready: tr({ zh: '打乱已就绪', en: 'Scrambled' }),
              }}
            >
              {/* 「按难度生成」的打乱 + 答案(只在该来源下有 meta 时出现)。 */}
              {!randomOptimalLoading && !scrambleLoading && !trainerLoading && !byStepsLoading && <TrainerCaseBar scramble={scramble} isZh={isZh} />}
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
            </TimerScrambleStrip>
          }
          cornerSlot={centerCubeSlot}
          digitsCorner={settings.showRankBadge !== false && rankBadgePhase && solves.length > 0 ? (
            <RankBadge eventId={event} centis={rankCentis} type="single" country={rankCountry} isZh={isZh} />
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
          {timer.phase === 'inspecting' && inspectionIllegalCount > 0 && (
            <div className="inspection-illegal-warn" title={tr({ zh: 'WCA 4d: 观察期间只允许整体旋转 (x/y/z)，转面会判 DNF', en: 'WCA 4d: only rotations (x/y/z) are legal during inspection — face turns are DNF'
            })}>
              <AlertTriangle size={14} />
              <span>{tr({
                zh: `检测到 ${inspectionIllegalCount} 次违规转面（WCA 应判 DNF）`,
                en: `${inspectionIllegalCount} illegal face turn${inspectionIllegalCount === 1 ? '' : 's'} detected (WCA: DNF)`,
              })}</span>
            </div>
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

        {/* 刚拧完那把的复盘 —— 在文档流里,从下面把计时区顶上去,不遮挡也不用点。
            开下一把即消失(见上面的 phase 副作用)。 */}
        {recapSolve && (
          <SolveRecap
            key={recapSolve.id}
            solve={recapSolve}
            isZh={isZh}
            history={byEvent[recapSolve.event] ?? []}
            onFull={() => {
              const idx = solves.findIndex(s => s.id === recapSolve.id);
              setModalSolve({ s: recapSolve, idx: idx >= 0 ? idx : solves.length - 1 });
            }}
            onDismiss={() => setRecapId(null)}
            onUseScramble={useScramble}
            onReconFeedback={(ok) => updateSolve(recapSolve.id, { reconOk: ok })}
          />
        )}

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

        <TimerDeviceActions
          active={deviceActive}
          connectAriaLabel={tr({ zh: '连接蓝牙设备', en: 'Connect Bluetooth device' })}
          connectLabel={tr({ zh: '连接', en: 'Connect' })}
          microphoneActive={stackmat.status.listening}
          microphoneAriaLabel={tr({ zh: '连接 Stackmat 麦克风计时器', en: 'Connect Stackmat microphone timer' })}
          onConnect={connectExternalBluetooth}
          onMicrophone={connectStackmat}
        />

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
        <TimerStatRail
          ariaExpanded={panelTab != null}
          emptyLabel={tr({ zh: '成绩', en: 'Times' })}
          items={solves.length > 0 ? [
            { value: `${stats.solved}/${stats.count}` },
            { label: 'mean', value: stats.mean },
            { label: tr({ zh: '最佳', en: 'best' }), value: stats.best },
            { label: 'mo3', value: stats.mo3 },
            { label: 'ao5', value: stats.ao5 },
            { label: 'ao12', value: stats.ao12 },
          ] : []}
          onClick={() => setPanelTab(t => (t ? null : 'times'))}
          title={tr({ zh: '打开成绩 / 图表 / 统计', en: 'Open times / chart / stats' })}
        />

      </div>

      {/* ── Side panel: desktop dock / 非桌面整屏 ───────────────
          入口是左下角那块统计(见上);底部导航条已撤掉,工具在顶栏 MoreMenu。
          非桌面宽度整屏铺开,关闭走右上角 × 或 Escape。 */}
      {panelTab && (
        <aside className={`shell-panel${isDesktop ? ' shell-panel--rail' : ' shell-panel--sheet'}`}>
          <div className="shell-panel-tabs">
            <button type="button" className={`shell-panel-tab${panelTab === 'times' ? ' active' : ''}`} onClick={() => setPanelTab('times')}>{tr({ zh: '成绩', en: 'Times'
          })}</button>
            <button type="button" className={`shell-panel-tab${panelTab === 'chart' ? ' active' : ''}`} onClick={() => setPanelTab('chart')}>{tr({ zh: '图表', en: 'Chart'
          })}</button>
            <button type="button" className={`shell-panel-tab${panelTab === 'stats' ? ' active' : ''}`} onClick={() => setPanelTab('stats')}>{tr({ zh: '统计', en: 'Stats'
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
            history={byEvent[modalSolve.s.event] ?? []}
            onUseScramble={useScramble}
            // Two writes because the page reads a *snapshot*: the store keeps
            // the answer, and the copy being rendered has to agree with it or
            // the button won't look pressed.
            onReconFeedback={(ok) => {
              updateSolve(modalSolve.s.id, { reconOk: ok });
              setModalSolve(m => (m ? { ...m, s: { ...m.s, reconOk: ok } } : m));
            }}
            moveTargets={timerHistoryMoveTargets(listSessions(), getActiveSessionId())}
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

      {settingsOpen && <SettingsPanel event={event} onClose={closeSettings} onDataReplaced={() => setByEvent(loadAll())} />}

      {infoToast && (
        <TimerInfoToast
          key={infoToast.sequence}
          message={infoToast.msg}
          onDismiss={() => setInfoToast(null)}
          onUndo={infoToast.undo}
          undoLabel={tr({ zh: '撤销', en: 'Undo' })}
        />
      )}

      {trainerSubsetOpen && <TrainerSubsetModal kind={trainerSubsetOpen} isZh={isZh} onClose={() => setTrainerSubsetOpen(null)} />}

      {bluetoothOpen && (
        <BluetoothModal
          isZh={isZh}
          cube={bluetoothCube}
          connectAttempt={bluetoothConnectAttempt}
          macPrompt={macPrompt}
          onSubmitMac={(mac) => resolveMac(mac)}
          onCancelMac={() => resolveMac(null)}
          onClose={() => {
            if (macResolverRef.current) resolveMac(null);
            setBluetoothOpen(false);
            setBluetoothConnectAttempt(null);
          }}
          // Failures are the modal's job — it knows which step broke and can
          // say so next to the button that started it.
          onConnect={pick => bluetoothCube.connect(pick)}
        />
      )}

      {stackmatOpen && (
        <StackmatModal
          stackmat={stackmat}
          connectAttempt={stackmatConnectAttempt}
          onClose={() => {
            setStackmatOpen(false);
            setStackmatConnectAttempt(null);
          }}
        />
      )}

      {bluetoothTimerOpen && (
        <BluetoothTimerModal
          timer={bluetoothTimer}
          connectAttempt={bluetoothTimerConnectAttempt}
          macPrompt={bluetoothTimerMacPrompt}
          onSubmitMac={resolveBluetoothTimerMac}
          onCancelMac={() => resolveBluetoothTimerMac(null)}
          onClose={() => {
            if (bluetoothTimerMacResolverRef.current) resolveBluetoothTimerMac(null);
            setBluetoothTimerOpen(false);
            setBluetoothTimerConnectAttempt(null);
          }}
        />
      )}

      {statsModalOpen && <StatsModal event={event} solves={solves} isZh={isZh} onClose={() => setStatsModalOpen(false)} />}

      {manualEntryOpen && (
        <ManualEntryModal
          event={event}
          currentScramble={displayScramble}
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

    </div>
  );
}
