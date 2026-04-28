/**
 * /timer — TypeScript reimplementation of csTimer's core flow.
 *
 * v3 (Round 2 integrated):
 *  - Inspection time + audio cues (Web Audio).
 *  - Hide-time mode while running.
 *  - Settings panel (theme/font/colors/sounds/precision/...).
 *  - Cube preview (Round 1C) shown above the timer.
 *  - Histogram + trend charts (Round 1D) in the bottom panel.
 *  - Random-state Kociemba scrambles for 333 (Round 1A) — warmed up on mount.
 *  - Full event library (Round 1B) — BLD/relay/CFOP/training/etc.
 *  - cstimer JSON / CSV / Speedstacks I/O (Round 1E).
 *  - Comment per solve, σ/CV%/ao50/ao1000 stats.
 *  - Fullscreen + mobile touch.
 *  - Keyboard shortcuts: space (timer), Esc (cancel), 1-9 (open recent solve),
 *    Z (undo last solve), digits 2/D (toggle +2 / DNF on last), F (fullscreen),
 *    , (next scramble).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Home, Download, Upload, Trash2, Settings as SettingsIcon, Maximize2, Minimize2, Bluetooth, Mic, BarChart3, Plus, Wrench, ListPlus, Printer, FileText, FileSpreadsheet, AlertTriangle, Target, Crosshair, Keyboard, Link2, Globe, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import MoreMenu, { type MoreMenuItem } from './components/MoreMenu';
import { syncLangToUrl } from '../../i18n';

import { generateScramble, registerScramble } from './scramble';
import { getLastPickedCase, type TrainerKind } from './scramble/training';
import { warmup333, randomState333Sync } from './scramble/kociemba/random_state';
import { useTimer } from './useTimer';
import { formatMs, bestSingle, bestAverageOfN } from './stats';
import type { EventId, Penalty, Solve } from './types';
import { EVENTS, isBldEvent } from './types';
import {
  loadAll,
  saveAll,
  exportJson,
  importJson,
  makeSolve,
  importCstimerJson,
  exportCsv,
  exportSpeedstacks,
} from './storage/db';
import { formatTargetTime, useApplyTheme, useSettings } from './settings';
import { warmupSound } from './sound';
import { useBluetoothCube } from './bluetooth';
import { useAutoReady } from './bluetooth/auto_ready';
import { useStackmat } from './stackmat';
import { useMultiStage } from './multistage';
import { useBldMemo } from './useBldMemo';

import TimerDisplay from './components/TimerDisplay';
import StatsPanel from './components/StatsPanel';
import CaseStatsPanel from './components/CaseStatsPanel';
import HistoryPanel from './components/HistoryPanel';
import SolveModal from './components/SolveModal';
import ReconstructModal from './components/ReconstructModal';
import { decodeReplayParam } from './share/decode';
import { extractReplayParam } from './share/paste_import';
import SettingsPanel from './components/SettingsPanel';
import GoalProgress from './components/GoalProgress';
import PbToast, { type PbKind } from './components/PbToast';
import ShortcutsModal from './components/ShortcutsModal';
import BluetoothModal from './components/BluetoothModal';
import TrainerSubsetModal from './components/TrainerSubsetModal';
import StatsModal from './components/StatsModal';
import ManualEntryModal from './components/ManualEntryModal';
import SolverModal from './components/SolverModal';
import BulkScrambleModal from './components/BulkScrambleModal';
import DrillModal from './components/DrillModal';
import { generateDrillScramble, type DrillType } from './scramble/drill';
import SolverHints from './components/SolverHints';
import { OLL_CASES } from './scramble/algs/oll_cases';
import { PLL_CASES } from './scramble/algs/pll_cases';
import HistogramChart from './components/HistogramChart';
import TrendChart from './components/TrendChart';
import PracticeHeatmap from './components/PracticeHeatmap';
import { CubePreview } from './cube';
import { Cube3D } from './cube3d';
import LiveCubeState from './components/LiveCubeState';
import { getLangQuery } from '../../i18n';

import './timer.css';
import './components/charts.css';
import './components/practice_heatmap.css';

const TRAINER_KINDS = new Set<EventId>(['oll', 'pll', 'coll', 'cmll', 'zbll', 'eg1', 'eg2']);

/** True iff viewport matches the given matchMedia query. Generic hook used by
 *  the breakpoint helpers below — kept inline to avoid a new export. */
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

/** Three coarse breakpoints used to seed default-expanded state for collapsible
 *  sections (cube preview, stats, dist/trend, history, heatmap). Per-section
 *  user toggles are persisted to localStorage and override these defaults. */
type Breakpoint = 'mobile' | 'tablet' | 'desktop';
function useBreakpoint(): Breakpoint {
  const isMobile = useMediaQuery('(max-width: 480px)');
  const isTablet = useMediaQuery('(min-width: 481px) and (max-width: 1024px)');
  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  return 'desktop';
}

/** Persistent expand/collapse state per section. The first read wins:
 *   1. localStorage key `timer.section.<id>.expanded` ("1" / "0") — if set, use it
 *   2. else fall back to `defaultExpanded` (computed by caller from breakpoint).
 *  Toggling writes the new boolean to localStorage. */
function useSectionExpanded(id: string, defaultExpanded: boolean): [boolean, () => void] {
  const storageKey = `timer.section.${id}.expanded`;
  const [expanded, setExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultExpanded;
    const raw = localStorage.getItem(storageKey);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return defaultExpanded;
  });
  const toggle = useCallback(() => {
    setExpanded(prev => {
      const next = !prev;
      try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* quota / private mode */ }
      return next;
    });
  }, [storageKey]);
  return [expanded, toggle];
}

/** True iff the current device exposes a touch surface. Doesn't imply mobile —
 *  hybrid laptops can be both — but it's the right gate for swapping
 *  "Hold Space" → "Tap and hold" copy. Captured once at module init. */
const IS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 0);

export default function TimerPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const settings = useSettings();
  useApplyTheme();

  // ── Layout breakpoint + collapsible sections ────────────────────
  // Breakpoint drives toolbar consolidation (mobile-only Mic/Stats/Lang move
  // into More) and the *defaults* for each collapsible section. User toggles
  // are persisted per-section in localStorage and override defaults.
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'mobile';
  // Default-expanded table — applies to all platforms.
  //                          mobile  tablet  desktop
  // Stats panel              ✗       ✓       ✓
  // Distribution / Trend     ✗       ✗       ✓
  // History                  ✗       ✓       ✓
  // Practice heatmap         ✗       ✓ if ≥30 solves else ✗   ✓   (computed below — needs `solves`)
  // Cube preview             ✓       ✓       ✓   (Eye toggle inverts)
  const defaultStatsExpanded = breakpoint !== 'mobile';
  const defaultChartsExpanded = breakpoint === 'desktop';
  const defaultHistoryExpanded = breakpoint !== 'mobile';

  const [statsExpanded, toggleStats] = useSectionExpanded('stats', defaultStatsExpanded);
  const [chartsExpanded, toggleCharts] = useSectionExpanded('charts', defaultChartsExpanded);
  const [historyExpanded, toggleHistory] = useSectionExpanded('history', defaultHistoryExpanded);

  // Cube preview Eye toggle — universal across breakpoints.
  // Stored as a single boolean ("1" hidden / "0" visible).
  const [previewHidden, setPreviewHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // Migrate legacy mobile-only key → unified key on first read.
    const legacy = localStorage.getItem('timer.mobilePreviewHidden');
    if (legacy !== null && localStorage.getItem('timer.preview.hidden') === null) {
      try { localStorage.setItem('timer.preview.hidden', legacy); } catch { /* ignore */ }
    }
    return localStorage.getItem('timer.preview.hidden') === '1';
  });
  useEffect(() => {
    try { localStorage.setItem('timer.preview.hidden', previewHidden ? '1' : '0'); } catch { /* ignore */ }
  }, [previewHidden]);

  // ── State: per-event solve lists ────────────────────────────────
  const [byEvent, setByEvent] = useState<Record<string, Solve[]>>(() => loadAll());

  useEffect(() => {
    saveAll(byEvent);
  }, [byEvent]);

  const [event, setEvent] = useState<EventId>(() => {
    const stored = localStorage.getItem('cuberoot-timer.event');
    const valid = EVENTS.some(e => e.id === stored);
    return valid ? (stored as EventId) : '333';
  });
  useEffect(() => {
    localStorage.setItem('cuberoot-timer.event', event);
  }, [event]);

  const solves = useMemo(() => byEvent[event] ?? [], [byEvent, event]);

  // Heatmap default-expanded depends on solve count for the tablet breakpoint.
  const heatmapDenseThreshold = 30;
  const defaultHeatmapExpanded =
    breakpoint === 'desktop'
      ? true
      : breakpoint === 'tablet'
        ? solves.length >= heatmapDenseThreshold
        : false;
  const [heatmapExpanded, toggleHeatmap] = useSectionExpanded('heatmap', defaultHeatmapExpanded);

  // ── Kociemba warmup (3x3 random-state) ─────────────────────────
  const [kociembaReady, setKociembaReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    warmup333().then(() => {
      if (cancelled) return;
      // Override the random-move 333 generator with random-state.
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
  // When set, the active event's scramble generator is overridden to always
  // produce a setup that lands on the chosen OLL/PLL case after cross+F2L.
  // Cleared automatically when the user switches event.
  const [drillTarget, setDrillTarget] = useState<{ type: DrillType; id: string } | null>(null);
  const [drillModalOpen, setDrillModalOpen] = useState(false);
  // Drill makes sense only on events whose solve method ends with OLL/PLL.
  // We allow it on the obvious 3x3 family + the OLL/PLL trainers themselves.
  const drillAllowed = ['333', '333oh', '333fm', 'oll', 'pll'].includes(event);
  // Clear drill when switching to an event where drill isn't applicable.
  useEffect(() => {
    if (!drillAllowed && drillTarget) setDrillTarget(null);
  }, [drillAllowed, drillTarget]);

  // ── Scramble ────────────────────────────────────────────────────
  // Derived from (event, nonce, kociembaReady, drillTarget) — the nonce bumps
  // regenerate; kociembaReady forces a regen when 3x3 swaps from random-move
  // to random-state. ESLint thinks the latter are unused since
  // `generateScramble` doesn't reference them, but the dispatcher's REG
  // mutates over time so a memo keyed only on `event` would miss the swap.
  // Suppression is intentional.
  const [scrambleNonce, setScrambleNonce] = useState(0);
  const scramble = useMemo(
    () => {
      if (drillTarget && drillAllowed) {
        const ds = generateDrillScramble(drillTarget.type, drillTarget.id);
        if (ds) return ds.scramble;
      }
      return generateScramble(event);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event, scrambleNonce, kociembaReady, drillTarget, drillAllowed],
  );
  const nextScramble = useCallback(() => {
    setScrambleNonce(n => n + 1);
  }, []);

  // ── Solve recording ─────────────────────────────────────────────
  const [lastPenalty, setLastPenalty] = useState<Penalty | null>(null);
  // PB celebration toast — set when a freshly recorded solve produces a new
  // best single / ao5 / ao12 for the current event.
  const [pbToast, setPbToast] = useState<{ kind: PbKind; value: string } | null>(null);
  // Mirror byEvent into a ref so recordSolve can read pre-state without
  // becoming dependent on byEvent (which would re-bind useTimer's callback
  // every solve).
  const byEventRef = useRef(byEvent);
  useEffect(() => { byEventRef.current = byEvent; }, [byEvent]);
  // Mirror pbToast setting too so recordSolve sees the live value.
  const pbToastEnabledRef = useRef(settings.pbToast);
  useEffect(() => { pbToastEnabledRef.current = settings.pbToast; }, [settings.pbToast]);
  // Snapshot taken whenever phase is NOT running. recordSolve reads these
  // so changing event mid-solve doesn't desync solve.event / scramble / caseId.
  const scrambleAtStartRef = useRef<string>(scramble);
  const eventAtStartRef = useRef<EventId>(event);
  const caseIdAtStartRef = useRef<string | null>(null);
  // Bluetooth move recording: cleared on every solve start, populated by the
  // bluetoothSubscribers fan-out below, and attached to the Solve in
  // recordSolve. ts is rebased to (move.ts - solveStartTsRef) so it matches
  // the solve's internal clock (0 = timer phase became 'running').
  const movesRef = useRef<Array<{ m: string; ts: number }>>([]);
  const solveStartTsRef = useRef<number>(0);

  // Multistage CFOP timer is created BELOW useTimer (so it can read the live
  // phase/displayMs), but recordSolve needs to call extractFinal() at stop
  // time. Bridge with a ref that's filled after multiStage is constructed.
  const isNxNEvent = ['222','333','444','555','666','777','333oh','333fm'].includes(event);
  const multiStageActive = settings.multiStage && isNxNEvent;
  const bldMemoActive = settings.bldMemo && isBldEvent(event);
  const multiStageRef = useRef<ReturnType<typeof useMultiStage> | null>(null);
  const bldMemoRef = useRef<ReturnType<typeof useBldMemo> | null>(null);

  const recordSolve = useCallback((res: { timeMs: number; inspectionMs: number; autoPenalty: 'ok' | '+2' | 'DNF' }) => {
    const ev = eventAtStartRef.current;
    // Recompute the active flags from the SNAPSHOT event, not the live one,
    // so changing event mid-solve doesn't attach the wrong split data.
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

    // PB detection — compare bestSingle / bestAo5 / bestAo12 before/after.
    if (pbToastEnabledRef.current) {
      const before = byEventRef.current[ev] ?? [];
      const after = [...before, solve];
      const beforeSingle = bestSingle(before);
      const afterSingle = bestSingle(after);
      const beforeAo5 = bestAverageOfN(before, 5);
      const afterAo5 = bestAverageOfN(after, 5);
      const beforeAo12 = bestAverageOfN(before, 12);
      const afterAo12 = bestAverageOfN(after, 12);
      // A "new PB" requires:
      //   - the new value is finite, AND
      //   - either there was no prior PB, or the new value is strictly better.
      // Order of priority: ao12 > ao5 > single (broader windows are more
      // significant — only one toast per solve).
      const isNew = (b: number | null, a: number | null): boolean =>
        a !== null && Number.isFinite(a) && (b === null || !Number.isFinite(b) || a < b);
      let kind: PbKind | null = null;
      let value: number | null = null;
      if (isNew(beforeAo12, afterAo12))      { kind = 'ao12';   value = afterAo12; }
      else if (isNew(beforeAo5, afterAo5))   { kind = 'ao5';    value = afterAo5; }
      else if (isNew(beforeSingle, afterSingle)) { kind = 'single'; value = afterSingle; }
      if (kind && value !== null) {
        setPbToast({ kind, value: formatMs(value, settings.precision) });
      }
    }

    setByEvent(prev => ({
      ...prev,
      [ev]: [...(prev[ev] ?? []), solve],
    }));
    nextScramble();
  }, [nextScramble, settings.multiStage, settings.bldMemo, settings.precision]);

  const timer = useTimer(recordSolve);

  const multiStage = useMultiStage({
    phase: timer.phase,
    displayMs: timer.displayMs,
    enabled: multiStageActive,
  });
  useEffect(() => { multiStageRef.current = multiStage; }, [multiStage]);

  const bldMemo = useBldMemo({
    phase: timer.phase,
    displayMs: timer.displayMs,
    enabled: bldMemoActive,
  });
  useEffect(() => { bldMemoRef.current = bldMemo; }, [bldMemo]);

  useEffect(() => {
    if (timer.phase !== 'running') {
      scrambleAtStartRef.current = scramble;
      eventAtStartRef.current = event;
      caseIdAtStartRef.current = TRAINER_KINDS.has(event)
        ? getLastPickedCase(event as TrainerKind)
        : null;
    } else {
      // Phase entered 'running' — reset bluetooth move recording so each
      // solve starts with a fresh stream. solveStartTsRef rebases ts to
      // "ms since timer start" (matches solve.timeMs's clock).
      movesRef.current = [];
      solveStartTsRef.current = performance.now();
    }
  }, [timer.phase, scramble, event]);

  // ── Bluetooth smart cube: auto-stop timer when cube solved ──────
  const phaseSnapshotRef = useRef(timer.phase);
  useEffect(() => { phaseSnapshotRef.current = timer.phase; }, [timer.phase]);
  // Bluetooth move stream feeds CFOP stage detection: after each move, ask
  // the cube for its current facelet state and let multistage decide if a
  // stage just transitioned.
  const consumeFacesRef = useRef<(faces: import('./cube/state').CubeFaces) => void>(() => {});
  useEffect(() => { consumeFacesRef.current = multiStage.consumeFromState; }, [multiStage.consumeFromState]);

  // Local broadcast: any hook needing the bluetooth move stream registers
  // here. We don't want to duplicate the bluetooth subscription itself
  // (drivers only emit once per move), so the single onMove callback below
  // fans out to every subscriber.
  const bluetoothSubscribersRef = useRef<Set<(m: string, ts: number) => void>>(new Set());

  const bluetoothCube = useBluetoothCube({
    onMove: (move: string, ts: number) => {
      // Pull live state from the bluetooth tracker and feed multistage.
      const faces = bluetoothCubeRef.current?.getFaces();
      if (faces) consumeFacesRef.current(faces);
      // Broadcast to local subscribers (auto-ready, etc.).
      for (const sub of bluetoothSubscribersRef.current) {
        try { sub(move, ts); } catch (err) { console.error('[bt-broadcast]', err); }
      }
    },
    onSolved: () => {
      if (phaseSnapshotRef.current === 'running') {
        // Press-down stops the timer (same code path as space-bar tap).
        timer.onPressDown();
      }
    },
  });

  // Bluetooth auto-ready: when enabled, simulate a press-down to kick off the
  // inspection / hold cycle without the user touching the spacebar.
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
  // Self-ref so the onMove callback can reach getFaces() without a stale
  // closure. We populate it after the hook returns each render.
  const bluetoothCubeRef = useRef<typeof bluetoothCube | null>(null);
  useEffect(() => { bluetoothCubeRef.current = bluetoothCube; }, [bluetoothCube]);

  // Record moves for solve reconstruction. We subscribe once on mount; the
  // recorder gates on phase via phaseSnapshotRef so inspection-time / idle
  // moves are dropped. ts is rebased to (now - solveStartTsRef) so it lives
  // on the same clock as solve.timeMs.
  useEffect(() => {
    const subs = bluetoothSubscribersRef.current;
    const recorder = (m: string, ts: number) => {
      if (phaseSnapshotRef.current !== 'running') return;
      movesRef.current.push({ m, ts: ts - solveStartTsRef.current });
    };
    subs.add(recorder);
    return () => { subs.delete(recorder); };
  }, []);

  // ── Live cube-state mirror ─────────────────────────────────────
  // Tiny corner panel that re-renders Cube3D after every BLE move, so the
  // user can sanity-check that the physical cube matches what the timer
  // thinks it should be. Cleared whenever the scramble changes (which also
  // covers solve recording — recordSolve calls nextScramble()).
  const [liveMoves, setLiveMoves] = useState<string[]>([]);
  useEffect(() => {
    setLiveMoves([]);
  }, [scramble]);
  useEffect(() => {
    const subs = bluetoothSubscribersRef.current;
    const mirror = (m: string) => {
      setLiveMoves(prev => [...prev, m]);
    };
    subs.add(mirror);
    return () => { subs.delete(mirror); };
  }, []);

  // ── WCA inspection-phase move classification ───────────────────
  // Per WCA Reg 4d / A4: cube rotations (x/y/z) are legal during inspection;
  // any face turn or slice triggers a DNF if observed by a delegate. We only
  // *inform* the user — auto-DNF is a judge call we don't enforce.
  // Rotations match: x/y/z [' 2]?  (case-insensitive, no wide qualifier).
  // Anything else with a face letter (U/D/F/B/L/R, with or without lowercase
  // wide / `w` suffix) or slice (M/E/S) counts as illegal.
  const [inspectionIllegalCount, setInspectionIllegalCount] = useState(0);
  const inspectionIllegalCountRef = useRef(0);
  useEffect(() => { inspectionIllegalCountRef.current = inspectionIllegalCount; }, [inspectionIllegalCount]);
  // Reset the counter every time inspection starts fresh.
  const prevPhaseRef = useRef(timer.phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (timer.phase === 'inspecting' && prev !== 'inspecting' && prev !== 'holding') {
      // Entering inspection from idle/stopped — reset. (holding/inspecting
      // ping-pongs while the user holds-then-releases too early; preserve.)
      inspectionIllegalCountRef.current = 0;
      setInspectionIllegalCount(0);
    }
    prevPhaseRef.current = timer.phase;
  }, [timer.phase]);
  // Subscribe to the bluetooth move stream during inspection.
  useEffect(() => {
    const subs = bluetoothSubscribersRef.current;
    const inspector = (m: string) => {
      const ph = phaseSnapshotRef.current;
      if (ph !== 'inspecting' && ph !== 'holding' && ph !== 'ready') return;
      // Strip leading whitespace and any trailing modifiers; we only care
      // about the base letter to classify.
      const trimmed = m.trim();
      if (!trimmed) return;
      // Rotation: x / y / z, optionally followed by ' or 2 (no wide-style
      // letters, no extra prefix).
      if (/^[xyzXYZ][2']?$/.test(trimmed)) return;
      // Anything else that contains a face/slice letter is WCA-illegal.
      if (/[UDFBLRMESudfblr]/.test(trimmed)) {
        setInspectionIllegalCount(c => c + 1);
      }
    };
    subs.add(inspector);
    return () => { subs.delete(inspector); };
  }, []);

  // ── Stackmat: when external stop fires, record the solve directly ─
  const stackmatRecordRef = useRef<((ms: number) => void) | null>(null);
  stackmatRecordRef.current = (ms: number) => {
    // Record-as-solve regardless of internal phase. Bypass useTimer.
    const solve = makeSolve({
      timeMs: ms,
      scramble: scrambleAtStartRef.current,
      event,
      penalty: 'ok',
    });
    setLastPenalty('ok');
    setByEvent(prev => ({
      ...prev,
      [event]: [...(prev[event] ?? []), solve],
    }));
    nextScramble();
  };
  const stackmat = useStackmat({
    onStop: (ms) => stackmatRecordRef.current?.(ms),
  });

  // ── Keyboard wiring ────────────────────────────────────────────
  const { onPressDown, onPressUp, reset } = timer;
  // Solves change every solve — keep them in a ref so we don't rebuild the
  // keydown listener on every recorded time. Mutators (updateSolve, etc.) are
  // already useCallback-stable enough that adding them as deps is fine.
  const solvesRef = useRef(solves);
  useEffect(() => { solvesRef.current = solves; }, [solves]);

  // Native touch listeners with { passive: false } — React 18 binds JSX
  // onTouchStart/End as passive by default, so e.preventDefault() inside them
  // is ignored on iOS and the page scrolls under the finger.
  //
  // Also: on hybrid touchscreens, tapping fires touchstart/touchend AND a
  // synthetic mousedown/mouseup ~50–300ms later. preventDefault() suppresses
  // synth on most browsers, but we belt-and-suspenders this with a "touch is
  // primary" lockout so the JSX onMouseDown/onMouseUp on .timer-center skips
  // when a recent touch already drove the state machine.
  //
  // touchcancel: if the system steals the gesture (alert popup, OS gesture,
  // multi-touch upgraded to a system swipe), we'd be stuck in 'holding' /
  // 'ready' forever — treat it like a touchend so onPressUp un-stuck-s us.
  const timerCenterRef = useRef<HTMLDivElement | null>(null);
  const touchActiveRef = useRef(false);
  const lastTouchEndTsRef = useRef(0);
  // Returns true if the event target is an interactive child (button, link,
  // input, contenteditable) — those should NOT trigger the timer. Lets the
  // BLD memo button, +2/DNF/Delete quick actions, and any future toolbar
  // surfaces inside .timer-center keep working without driving onPressDown.
  const shouldIgnoreTimerTarget = useCallback((target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return target.closest('button, a, input, textarea, select, [contenteditable="true"], [data-no-timer]') !== null;
  }, []);
  useEffect(() => {
    const el = timerCenterRef.current;
    if (!el) return;
    const handleTouchStart = (e: TouchEvent) => {
      if (shouldIgnoreTimerTarget(e.target)) return;
      e.preventDefault();
      touchActiveRef.current = true;
      warmupSound();
      onPressDown();
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchActiveRef.current) return;
      e.preventDefault();
      touchActiveRef.current = false;
      lastTouchEndTsRef.current = performance.now();
      onPressUp();
    };
    const handleTouchCancel = () => {
      // System interrupted the gesture — release as if user lifted finger so
      // 'holding' / 'ready' / 'running' don't get stuck.
      if (!touchActiveRef.current) return;
      touchActiveRef.current = false;
      lastTouchEndTsRef.current = performance.now();
      onPressUp();
    };
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: false });
    el.addEventListener('touchcancel', handleTouchCancel, { passive: false });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [onPressDown, onPressUp, shouldIgnoreTimerTarget]);

  // Mouse handlers wrap onPressDown/onPressUp so synthetic mouse events that
  // fire after a touch tap (≤700ms window covers slow iOS / Bluefy) don't
  // double-trigger. Also gate on event.target so child buttons stay isolated.
  const onCenterMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (touchActiveRef.current) return;
    if (performance.now() - lastTouchEndTsRef.current < 700) return;
    if (shouldIgnoreTimerTarget(e.target)) return;
    onPressDown();
  }, [onPressDown, shouldIgnoreTimerTarget]);
  const onCenterMouseUp = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (touchActiveRef.current) return;
    if (performance.now() - lastTouchEndTsRef.current < 700) return;
    if (shouldIgnoreTimerTarget(e.target)) return;
    onPressUp();
  }, [onPressUp, shouldIgnoreTimerTarget]);

  // ── Solve mutators ──────────────────────────────────────────────
  const updateSolve = useCallback((solveId: string, patch: Partial<Solve>) => {
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

  const deleteLastSolve = useCallback(() => {
    const last = solves[solves.length - 1];
    if (!last) return;
    if (!confirm(isZh ? '删除最后一次成绩？' : 'Delete last solve?')) return;
    deleteSolve(last.id);
    setLastPenalty(null);
  }, [solves, deleteSolve, isZh]);

  const clearAll = useCallback(() => {
    if (!solves.length) return;
    const evName = EVENTS.find(e => e.id === event);
    if (!confirm(isZh
      ? `清空当前项目「${evName?.nameZh}」的所有 ${solves.length} 次成绩？`
      : `Clear all ${solves.length} solves of "${evName?.nameEn}"?`,
    )) return;
    setByEvent(prev => ({ ...prev, [event]: [] }));
    setLastPenalty(null);
  }, [event, isZh, solves.length]);

  // ── Target-time (time-attack) ──────────────────────────────────
  // Per-event target. null/0/non-finite → indicator is hidden entirely.
  const targetMs = useMemo<number | null>(() => {
    const v = settings.targetMsByEvent?.[event];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
  }, [settings.targetMsByEvent, event]);
  const isOvershot = timer.phase === 'running' && targetMs !== null && timer.displayMs > targetMs;
  // Post-stop 1s pulse: 'good' if final time <= target, 'bad' otherwise. Only
  // triggers on the rising edge from non-stopped → stopped while a target is
  // set; cleared after 1s. Doesn't mutate the recorded solve.
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

  // ── Modal ───────────────────────────────────────────────────────
  const [modalSolve, setModalSolve] = useState<{ s: Solve; idx: number } | null>(null);
  const [reconstructSolve, setReconstructSolve] = useState<Solve | null>(null);

  // ── ?replay=<base64url> deep-link: synthesise an ephemeral Solve and open
  // the ReconstructModal. Strip the param after mount so refresh doesn't
  // re-open. The synthesised solve never enters byEvent, so it isn't saved.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('replay');
    if (!raw) return;
    const decoded = decodeReplayParam(raw);
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
    history.replaceState(null, '', window.location.pathname);
  }, []);

  // Paste-replay-URL handler: prompts the user, extracts the `replay` token
  // from any of the supported input shapes, decodes, and opens the same
  // ReconstructModal — without persisting the solve to history.
  const handlePasteReplay = useCallback(() => {
    const raw = window.prompt(
      isZh
        ? '粘贴 replay URL 或 token：'
        : 'Paste a replay URL or token:',
      '',
    );
    if (raw === null) return; // user cancelled
    const param = extractReplayParam(raw);
    if (!param) {
      alert(isZh ? '未识别为 replay URL。' : 'Not a recognizable replay URL.');
      return;
    }
    const decoded = decodeReplayParam(param);
    if (!decoded) {
      alert(isZh ? 'replay 数据无法解码。' : 'Failed to decode replay payload.');
      return;
    }
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
    } catch {
      // Some browsers reject without user gesture; quietly ignore.
    }
  }, []);
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // ── Keyboard shortcuts (registered after all mutators are defined) ─
  const phaseRef = useRef(timer.phase);
  useEffect(() => { phaseRef.current = timer.phase; }, [timer.phase]);
  // Gate global keyboard while any modal is open — each modal owns its own
  // Esc handler, and we don't want space to start the timer or 1/2/3 to flip
  // penalties while the user is interacting with a modal.
  const anyModalOpen =
    settingsOpen || shortcutsOpen || bluetoothOpen ||
    trainerSubsetOpen !== null || statsModalOpen ||
    manualEntryOpen || solverOpen || bulkScrambleOpen ||
    drillModalOpen ||
    modalSolve !== null || reconstructSolve !== null;
  const anyModalOpenRef = useRef(anyModalOpen);
  useEffect(() => { anyModalOpenRef.current = anyModalOpen; }, [anyModalOpen]);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (anyModalOpenRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        warmupSound();
        onPressDown();
        return;
      }
      if (e.code === 'Escape') {
        reset();
        return;
      }

      // Multi-stage marks: 1/2/3 during a running solve.
      const ph = phaseRef.current;
      if (ph === 'running' && multiStageActive) {
        if (e.code === 'Digit1' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          multiStageRef.current?.markStage('cross');
          return;
        }
        if (e.code === 'Digit2' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          multiStageRef.current?.markStage('f2l');
          return;
        }
        if (e.code === 'Digit3' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          multiStageRef.current?.markStage('oll');
          return;
        }
      }

      // BLD memo split: Enter while running.
      if (ph === 'running' && bldMemoActive && e.code === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        bldMemoRef.current?.markMemo();
        return;
      }

      // Block other shortcuts while the timer is mid-cycle.
      if (ph === 'holding' || ph === 'ready' || ph === 'running' || ph === 'inspecting') return;

      const cur = solvesRef.current;
      const last = cur[cur.length - 1];

      if (e.code === 'KeyZ' && !e.ctrlKey && !e.metaKey) {
        if (last) { deleteSolve(last.id); setLastPenalty(null); }
        return;
      }
      if (e.code === 'Digit2' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (last) {
          const p: Penalty = last.penalty === '+2' ? 'ok' : '+2';
          updateSolve(last.id, { penalty: p }); setLastPenalty(p);
        }
        return;
      }
      if (e.code === 'KeyD') {
        if (last) {
          const p: Penalty = last.penalty === 'DNF' ? 'ok' : 'DNF';
          updateSolve(last.id, { penalty: p }); setLastPenalty(p);
        }
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
      if (e.code === 'KeyF') { toggleFullscreen(); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (anyModalOpenRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        onPressUp();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onPressDown, onPressUp, reset, updateSolve, deleteSolve, nextScramble, toggleFullscreen, multiStageActive, bldMemoActive]);

  // ── Import / export ────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const json = exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuberoot-timer-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportCsv = useCallback(() => {
    const csv = exportCsv(byEvent);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuberoot-timer-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [byEvent]);

  const handleExportSs = useCallback(() => {
    const txt = exportSpeedstacks(solves);
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuberoot-timer-${event}-${new Date().toISOString().slice(0, 10)}.ss.txt`;
    a.click();
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
        // Try our native format first, then cstimer JSON.
        if (importJson(text)) {
          setByEvent(loadAll());
          return;
        }
        const cs = importCstimerJson(text);
        if (cs) {
          setByEvent(prev => {
            const merged = { ...prev };
            for (const [evId, list] of Object.entries(cs)) {
              merged[evId] = [...(merged[evId] ?? []), ...list].sort((a, b) => a.ts - b.ts);
            }
            return merged;
          });
          alert(isZh ? `从 cstimer 导入了 ${Object.values(cs).reduce((n, l) => n + l.length, 0)} 次成绩。` : `Imported ${Object.values(cs).reduce((n, l) => n + l.length, 0)} solves from cstimer.`);
          return;
        }
        alert(isZh ? '导入失败：文件格式无效。' : 'Import failed: invalid file.');
      };
      reader.readAsText(file);
    };
    input.click();
  }, [isZh]);

  // ── More menu items (collapsed toolbar overflow) ───────────────
  // Drill / Shortcuts / Fullscreen are also surfaced here so the mobile
  // (≤480px) layout — which hides those tb-btns to reduce clutter — still
  // exposes them via the More menu. On mobile we additionally fold Mic /
  // Stats / Language into the menu since the toolbar can't fit them.
  const moreItems = useMemo<MoreMenuItem[]>(() => [
    ...(isMobile ? [
      {
        icon: <Mic size={14} />,
        label: stackmat.status.listening
          ? (isZh ? 'Stackmat 监听中（点击停止）' : 'Stackmat listening (stop)')
          : (isZh ? '启用 Stackmat（麦克风）' : 'Enable Stackmat (mic)'),
        onClick: async () => {
          if (stackmat.status.listening) {
            stackmat.stop();
          } else {
            try {
              await stackmat.start();
            } catch (err) {
              alert(isZh ? `麦克风启用失败：${(err as Error).message}` : `Mic error: ${(err as Error).message}`);
            }
          }
        },
      },
      {
        icon: <BarChart3 size={14} />,
        label: isZh ? '统计' : 'Stats',
        onClick: () => setStatsModalOpen(true),
      },
      {
        icon: <Globe size={14} />,
        label: isZh ? '语言：EN' : 'Language: 中文',
        onClick: () => {
          const next = isZh ? 'en' : 'zh';
          i18n.changeLanguage(next);
          syncLangToUrl(next);
        },
      },
    ] : []),
    ...(drillAllowed && !drillTarget ? [{
      icon: <Crosshair size={14} />,
      label: isZh ? '专项练习' : 'Drill mode',
      onClick: () => setDrillModalOpen(true),
    }] : []),
    {
      icon: <Keyboard size={14} />,
      label: isZh ? '快捷键' : 'Shortcuts',
      onClick: () => setShortcutsOpen(true),
    },
    {
      icon: fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />,
      label: isZh ? '全屏' : 'Fullscreen',
      onClick: toggleFullscreen,
    },
    {
      icon: <Upload size={14} />,
      label: isZh ? '导入（自动识别 cstimer JSON）' : 'Import (auto-detects cstimer JSON)',
      onClick: handleImport,
    },
    {
      icon: <Download size={14} />,
      label: isZh ? '导出 JSON' : 'Export JSON',
      onClick: handleExport,
    },
    {
      icon: <FileSpreadsheet size={14} />,
      label: isZh ? '导出 CSV' : 'Export CSV',
      onClick: handleExportCsv,
    },
    {
      icon: <FileText size={14} />,
      label: isZh ? '导出 Speedstacks' : 'Export Speedstacks',
      onClick: handleExportSs,
    },
    {
      icon: <Plus size={14} />,
      label: isZh ? '手动录入' : 'Manual entry',
      onClick: () => setManualEntryOpen(true),
    },
    {
      icon: <Link2 size={14} />,
      label: isZh ? '粘贴 replay 链接' : 'Paste replay URL',
      onClick: handlePasteReplay,
    },
    {
      icon: <Wrench size={14} />,
      label: isZh ? '通用求解器' : 'Solver',
      onClick: () => setSolverOpen(true),
    },
    {
      icon: <ListPlus size={14} />,
      label: isZh ? '批量打乱' : 'Bulk scrambles',
      onClick: () => setBulkScrambleOpen(true),
    },
    {
      icon: <Printer size={14} />,
      label: isZh ? '打印' : 'Print',
      onClick: () => window.print(),
    },
    {
      icon: <Trash2 size={14} />,
      label: isZh ? '清空当前项目' : 'Clear current event',
      onClick: clearAll,
      danger: true,
      disabled: !solves.length,
    },
  ], [isZh, handleImport, handleExport, handleExportCsv, handleExportSs, clearAll, solves.length, drillAllowed, drillTarget, fullscreen, toggleFullscreen, handlePasteReplay, isMobile, stackmat, i18n]);

  // Flattened across-event solve list for the daily-goal pill.
  // Goal counts every solve regardless of event — matches the "X solves/day"
  // intent. Memoised on byEvent so the pill doesn't recompute per render.
  const allSolves = useMemo(() => {
    const out: Solve[] = [];
    for (const list of Object.values(byEvent)) out.push(...list);
    return out;
  }, [byEvent]);

  // ── Render ──────────────────────────────────────────────────────
  const eventInfoCurrent = EVENTS.find(e => e.id === event);
  const printEventName = eventInfoCurrent ? (isZh ? eventInfoCurrent.nameZh : eventInfoCurrent.nameEn) : event;

  return (
    <div className={`timer-root ${fullscreen ? 'fullscreen' : ''} ${settings.hideAllUiWhileRunning && timer.phase === 'running' ? 'ui-hidden' : ''}`}>
      <div className="print-only-header">
        <h1>{isZh ? '魔方计时器 — ' : 'Cube Timer — '}{printEventName}</h1>
        <div className="print-meta">{new Date().toLocaleString()} · {solves.length} {isZh ? '次' : 'solves'}</div>
      </div>
      <div className="timer-topbar">
        <div className="left">
          <Link className="home-link" to={`/${getLangQuery()}`} title={isZh ? '返回首页' : 'Home'}>
            <Home size={16} style={{ verticalAlign: 'middle' }} />
          </Link>
          <select
            value={event}
            onChange={(e) => setEvent(e.target.value as EventId)}
            title={isZh ? '项目' : 'Event'}
          >
            {(['wca', 'puzzle', 'bld', 'relay', 'cfop', 'll', 'misc'] as const).map(group => (
              <optgroup key={group} label={groupLabel(group, isZh)}>
                {EVENTS.filter(ev => ev.group === group).map(ev => (
                  <option key={ev.id} value={ev.id}>{isZh ? ev.nameZh : ev.nameEn}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="right">
          <button
            className={`tb-btn ${bluetoothCube.status.connected ? 'connected' : ''}`}
            onClick={() => setBluetoothOpen(true)}
            title={bluetoothCube.status.connected
              ? (isZh ? `已连接 ${bluetoothCube.status.deviceName}` : `Connected: ${bluetoothCube.status.deviceName}`)
              : (isZh ? '智能魔方（iOS 用 Bluefy）' : 'Smart cube (use Bluefy on iOS)')}
          >
            <Bluetooth size={14} />
          </button>
          <button
            className={`tb-btn ${stackmat.status.listening ? 'connected' : 'tb-mobile-hide'}`}
            onClick={async () => {
              if (stackmat.status.listening) {
                stackmat.stop();
              } else {
                try {
                  await stackmat.start();
                } catch (err) {
                  alert(isZh ? `麦克风启用失败：${(err as Error).message}` : `Mic error: ${(err as Error).message}`);
                }
              }
            }}
            title={stackmat.status.listening
              ? (isZh ? `Stackmat 监听中（点击停止）` : 'Stackmat listening (click to stop)')
              : (isZh ? '启用 Stackmat（麦克风）' : 'Enable Stackmat (microphone)')}
          >
            <Mic size={14} />
          </button>
          {drillAllowed && (
            <button
              className={`tb-btn tb-btn-drill ${drillTarget ? 'connected' : 'tb-mobile-hide'}`}
              onClick={() => setDrillModalOpen(true)}
              title={drillTarget
                ? (isZh ? `专项练习中：${drillTarget.id}` : `Drill: ${drillTarget.id}`)
                : (isZh ? '专项练习（指定 OLL/PLL 公式）' : 'Drill mode (target an OLL/PLL case)')}
            >
              <Crosshair size={14} />
            </button>
          )}
          <button className="tb-btn tb-mobile-hide" onClick={() => setStatsModalOpen(true)} title={isZh ? '完整统计' : 'Full stats'}>
            <BarChart3 size={14} />
          </button>
          <button className="tb-btn" onClick={() => setSettingsOpen(true)} title={isZh ? '设置' : 'Settings'}>
            <SettingsIcon size={14} />
          </button>
          <MoreMenu items={moreItems} isZh={isZh} />
          <span className="tb-mobile-hide" style={{ display: 'inline-flex' }}>
            <LangToggle />
          </span>
        </div>
      </div>

      <div
        className={`scramble-strip ${settings.compactScramble ? 'compact' : ''}`}
        onClick={() => {
          const action = settings.scrambleClickAction;
          if (action === 'none') return;
          if (action === 'copy') {
            try { void navigator.clipboard.writeText(scramble); } catch { /* ignore */ }
            return;
          }
          nextScramble();
        }}
        title={
          settings.scrambleClickAction === 'copy'
            ? (isZh ? '点击复制打乱' : 'Click to copy')
            : settings.scrambleClickAction === 'none'
              ? (isZh ? '点击无操作' : 'Click disabled')
              : (isZh ? '点击换一个打乱' : 'Click to refresh')
        }
      >
        {scramble || <span className="scramble-empty">—</span>}
      </div>

      <div className="timer-goal-row" style={{ textAlign: 'center', padding: '0 12px' }}>
        <GoalProgress solves={allSolves} goal={settings.dailySolveGoal ?? null} isZh={isZh} />
      </div>

      {event === '333' && <SolverHints scramble={scramble} isZh={isZh} />}

      {(event === 'oll' || event === 'pll') && (() => {
        const total = event === 'oll' ? OLL_CASES.length : PLL_CASES.length;
        const subset = event === 'oll' ? settings.ollSubset : settings.pllSubset;
        const sel = subset && subset.length > 0 ? subset.length : null;
        return (
          <div className="trainer-subset-row">
            <button
              type="button"
              className="trainer-subset-btn"
              onClick={() => setTrainerSubsetOpen(event === 'oll' ? 'oll' : 'pll')}
              title={isZh ? '选择训练子集' : 'Pick training subset'}
            >
              {sel !== null
                ? (isZh ? `子集 (${sel}/${total})` : `Subset (${sel}/${total})`)
                : (isZh ? `全部 (${total})` : `All (${total})`)}
            </button>
          </div>
        );
      })()}

      {settings.showCubePreview && (
        <div className={`timer-cube-preview-wrap${previewHidden ? ' hidden' : ''}`}>
          <button
            type="button"
            className="cube-preview-toggle"
            onClick={() => setPreviewHidden(h => !h)}
            title={previewHidden
              ? (isZh ? '显示打乱预览' : 'Show preview')
              : (isZh ? '隐藏打乱预览' : 'Hide preview')}
          >
            {previewHidden ? <Eye size={12} /> : <EyeOff size={12} />}
            <span>{previewHidden
              ? (isZh ? '显示预览' : 'Show preview')
              : (isZh ? '隐藏预览' : 'Hide preview')}</span>
          </button>
          {!previewHidden && (
            <div className="timer-cube-preview">
              {settings.use3D
                ? <Cube3D event={event} scramble={scramble} size={200} colors={settings.colors} />
                : <CubePreview event={event} scramble={scramble} size={14} colors={settings.colors} />}
            </div>
          )}
        </div>
      )}

      <div
        className={`timer-center${isOvershot ? ' target-overshot' : ''}${stopPulse ? ` target-pulse-${stopPulse}` : ''}`}
        ref={timerCenterRef}
        onMouseDown={onCenterMouseDown}
        onMouseUp={onCenterMouseUp}
      >
        <TimerDisplay
          phase={timer.phase}
          displayMs={timer.displayMs}
          inspectionDisplayMs={timer.inspectionDisplayMs}
          lastPenalty={timer.phase === 'stopped' ? lastPenalty : null}
        />
        {timer.phase === 'running' && targetMs !== null && (
          <div className={`timer-target-indicator${isOvershot ? ' overshot' : ''}`}>
            <Target size={12} />
            <span className="target-label">
              {isZh ? '目标' : 'target'} {formatTargetTime(targetMs)}
            </span>
            <span className="target-sep">·</span>
            <span className="target-delta">
              {(() => {
                // delta = target - current. Negative = overshot (past target);
                // positive = on pace (still under target). Show literal sign
                // so users see "-1.23s" once they cross.
                const deltaMs = targetMs - timer.displayMs;
                const sign = deltaMs >= 0 ? '+' : '-';
                const absMs = Math.abs(deltaMs);
                return `${sign}${(absMs / 1000).toFixed(2)}s`;
              })()}
            </span>
          </div>
        )}
        {timer.phase === 'idle' && (
          <div className="timer-hint">
            {IS_TOUCH
              ? (isZh
                  ? <>按住屏幕{settings.inspection > 0 ? '开始观察' : '进入准备'}</>
                  : <>Tap and hold to {settings.inspection > 0 ? 'inspect' : 'ready'}</>)
              : (isZh
                  ? <>按住 <code>空格</code> {settings.inspection > 0 ? '开始观察' : '进入准备'}</>
                  : <>Hold <code>Space</code> to {settings.inspection > 0 ? 'inspect' : 'ready'}</>)}
          </div>
        )}
        {timer.phase === 'inspecting' && (
          <>
            <div className="timer-hint">
              {isZh ? '观察中… 再按空格开始上手' : 'Inspecting… press space again to grip'}
            </div>
            {inspectionIllegalCount > 0 && (
              <div
                className="inspection-illegal-warn"
                title={isZh
                  ? 'WCA 4d: 观察期间只允许整体旋转 (x/y/z)，转面会判 DNF'
                  : 'WCA 4d: only rotations (x/y/z) are legal during inspection — face turns are DNF'}
              >
                <AlertTriangle size={14} />
                <span>
                  {isZh
                    ? `检测到 ${inspectionIllegalCount} 次违规转面（WCA 应判 DNF）`
                    : `${inspectionIllegalCount} illegal face turn${inspectionIllegalCount === 1 ? '' : 's'} detected (WCA: DNF)`}
                </span>
              </div>
            )}
          </>
        )}
        {timer.phase === 'holding' && (
          <div className="timer-hint">{isZh ? '继续按住…' : 'Keep holding…'}</div>
        )}
        {timer.phase === 'ready' && (
          <div className="timer-hint">{isZh ? '准备好了！松开开始' : 'Ready! Release to go'}</div>
        )}
        {timer.phase === 'running' && multiStageActive && (
          <div className="timer-stage-splits">
            <span className={`stage-chip ${multiStage.liveStages.cross !== undefined ? 'done' : ''}`}>
              {isZh ? '十字' : 'Cross'}{multiStage.liveStages.cross !== undefined ? ` ${formatMs(multiStage.liveStages.cross)}` : ''}
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
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); bldMemoRef.current?.markMemo(); }}
              >
                {isZh ? '记忆中… 按 Enter 或点这里' : 'Memo… press Enter or tap'}
              </button>
            ) : (
              <>
                <span className="stage-chip done">
                  {isZh ? '记忆' : 'Memo'} {formatMs(bldMemo.memoMs)}
                </span>
                <span className="stage-chip">
                  {isZh ? '执行中…' : 'Executing…'}
                </span>
              </>
            )}
          </div>
        )}
        {timer.phase === 'stopped' && solves.length > 0 && (
          <div className="timer-quick-actions">
            <button
              className={`qa-btn ${lastPenalty === '+2' ? 'active' : ''}`}
              onClick={() => changeLastPenalty(lastPenalty === '+2' ? 'ok' : '+2')}
            >
              +2
            </button>
            <button
              className={`qa-btn ${lastPenalty === 'DNF' ? 'active' : ''}`}
              onClick={() => changeLastPenalty(lastPenalty === 'DNF' ? 'ok' : 'DNF')}
            >
              DNF
            </button>
            <button className="qa-btn danger" onClick={deleteLastSolve}>
              {isZh ? '删除' : 'Delete'}
            </button>
            <button className="qa-btn" onClick={nextScramble}>
              {isZh ? '换打乱' : 'Next'}
            </button>
          </div>
        )}
      </div>

      <div className={`timer-bottom ${settings.showCharts ? 'with-charts' : ''} bp-${breakpoint}`}>
        <CollapseSection
          title={isZh ? '统计' : 'Stats'}
          collapsed={!statsExpanded}
          onToggle={toggleStats}
        >
          <StatsPanel solves={solves} isZh={isZh} event={event} />
          <CaseStatsPanel event={event} solves={solves} isZh={isZh} />
        </CollapseSection>
        {settings.showCharts && (
          <CollapseSection
            title={isZh ? '分布' : 'Distribution'}
            collapsed={!chartsExpanded}
            onToggle={toggleCharts}
          >
            <div className="charts-panel">
              <h3>{isZh ? '分布' : 'Distribution'}</h3>
              <HistogramChart solves={solves} isZh={isZh} width={300} height={120} />
              <h3>{isZh ? '趋势' : 'Trend'}</h3>
              <TrendChart solves={solves} isZh={isZh} width={300} height={140} />
            </div>
          </CollapseSection>
        )}
        <CollapseSection
          title={isZh ? '历史' : 'History'}
          badge={solves.length > 0 ? String(solves.length) : undefined}
          collapsed={!historyExpanded}
          onToggle={toggleHistory}
        >
          <HistoryPanel
            solves={solves}
            isZh={isZh}
            onRowClick={(s, idx) => setModalSolve({ s, idx })}
          />
        </CollapseSection>
      </div>

      {settings.showHeatmap && solves.length > 0 && (
        <div className="timer-heatmap-row">
          <CollapseSection
            title={isZh ? '练习日历' : 'Practice heatmap'}
            collapsed={!heatmapExpanded}
            onToggle={toggleHeatmap}
          >
            <PracticeHeatmap solves={solves} isZh={isZh} cellSize={11} />
          </CollapseSection>
        </div>
      )}

      {modalSolve && (() => {
        // Re-locate the solve by id so insert/delete elsewhere doesn't desync
        // the captured idx — `isLatest` must reflect the current array.
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
            onDelete={() => {
              deleteSolve(modalSolve.s.id);
              setModalSolve(null);
              if (isLatest) setLastPenalty(null);
            }}
            onOpenReconstruct={() => setReconstructSolve(modalSolve.s)}
          />
        );
      })()}

      {reconstructSolve && (
        <ReconstructModal
          key={reconstructSolve.id}
          solve={reconstructSolve}
          isZh={isZh}
          onClose={() => setReconstructSolve(null)}
          history={byEvent[reconstructSolve.event] ?? []}
        />
      )}

      {settingsOpen && (
        <SettingsPanel isZh={isZh} event={event} onClose={() => setSettingsOpen(false)} />
      )}

      <PbToast
        kind={pbToast?.kind ?? null}
        value={pbToast?.value ?? ''}
        isZh={isZh}
        onClose={() => setPbToast(null)}
      />

      {shortcutsOpen && (
        <ShortcutsModal isZh={isZh} onClose={() => setShortcutsOpen(false)} />
      )}

      {trainerSubsetOpen && (
        <TrainerSubsetModal
          kind={trainerSubsetOpen}
          isZh={isZh}
          onClose={() => setTrainerSubsetOpen(null)}
        />
      )}

      {bluetoothOpen && (
        <BluetoothModal
          isZh={isZh}
          cube={bluetoothCube}
          onClose={() => setBluetoothOpen(false)}
          onConnect={async () => {
            try {
              await bluetoothCube.connect();
            } catch (err) {
              const msg = (err as Error).message ?? String(err);
              if (msg !== 'NO_WEB_BLUETOOTH') {
                alert(isZh ? `连接失败：${msg}` : `Connection failed: ${msg}`);
              }
              // For NO_WEB_BLUETOOTH the modal already shows env advice — silent.
            }
          }}
        />
      )}

      {statsModalOpen && (
        <StatsModal
          event={event}
          solves={solves}
          isZh={isZh}
          onClose={() => setStatsModalOpen(false)}
        />
      )}

      {manualEntryOpen && (
        <ManualEntryModal
          event={event}
          currentScramble={scramble}
          isZh={isZh}
          onClose={() => setManualEntryOpen(false)}
          onSubmit={(solve) => {
            setByEvent(prev => ({
              ...prev,
              [solve.event]: [...(prev[solve.event] ?? []), solve],
            }));
            setLastPenalty(solve.penalty);
            setManualEntryOpen(false);
          }}
        />
      )}

      {solverOpen && (
        <SolverModal
          isZh={isZh}
          onClose={() => setSolverOpen(false)}
        />
      )}

      {bulkScrambleOpen && (
        <BulkScrambleModal
          defaultEvent={event}
          isZh={isZh}
          onClose={() => setBulkScrambleOpen(false)}
        />
      )}

      {drillModalOpen && (
        <DrillModal
          isZh={isZh}
          activeCase={drillTarget}
          initialType={event === 'pll' ? 'pll' : 'oll'}
          onPick={(type, id) => {
            setDrillTarget({ type, id });
            // Force a fresh scramble for the just-picked case.
            setScrambleNonce(n => n + 1);
          }}
          onExit={() => setDrillTarget(null)}
          onClose={() => setDrillModalOpen(false)}
        />
      )}

      {bluetoothCube.status.connected && (
        <div
          className="timer-live-cube"
          title={isZh ? '智能魔方实时状态（每次拧动同步）' : 'Live smart-cube state (updates per move)'}
        >
          <LiveCubeState
            event={event}
            scramble={scramble}
            moves={liveMoves}
            size={120}
          />
        </div>
      )}
    </div>
  );
}

/** Universal accordion wrapper for the bottom-panel sections. Header is a
 *  tap target (≥44px) showing the section name + optional badge (e.g. solve
 *  count); body is fully unmounted while collapsed so charts don't paint
 *  offscreen. Default-expanded state is computed by the caller from the
 *  current breakpoint; user toggles are persisted via useSectionExpanded. */
function CollapseSection({
  title,
  collapsed,
  onToggle,
  badge,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`timer-collapse${collapsed ? ' collapsed' : ''}`}>
      <button
        type="button"
        className="timer-collapse-header"
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        <span className="timer-collapse-title">{title}</span>
        {badge && <span className="timer-collapse-badge">{badge}</span>}
      </button>
      {!collapsed && <div className="timer-collapse-body">{children}</div>}
    </div>
  );
}

function groupLabel(g: 'wca' | 'bld' | 'relay' | 'puzzle' | 'cfop' | 'll' | 'misc', isZh: boolean): string {
  const labels: Record<string, [string, string]> = {
    wca:    ['WCA',          'WCA'],
    bld:    ['Blindfolded',  '盲拧'],
    relay:  ['Relay',        '接力'],
    puzzle: ['Other puzzles','其他魔方'],
    cfop:   ['CFOP step',    'CFOP 步骤'],
    ll:     ['Last layer',   '末层训练'],
    misc:   ['Misc',         '其他'],
  };
  const pair = labels[g] ?? [g, g];
  return isZh ? pair[1] : pair[0];
}
