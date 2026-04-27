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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Home, Download, Upload, Trash2, Settings as SettingsIcon, Maximize2, Minimize2, Bluetooth, Mic, HelpCircle, BarChart3, Plus, Wrench, ListPlus, Printer, FileText, FileSpreadsheet } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import MoreMenu, { type MoreMenuItem } from './components/MoreMenu';

import { generateScramble, registerScramble } from './scramble';
import { getLastPickedCase, type TrainerKind } from './scramble/training';
import { warmup333, randomState333Sync } from './scramble/kociemba/random_state';
import { useTimer } from './useTimer';
import { formatMs } from './stats';
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
import { useApplyTheme, useSettings } from './settings';
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
import SettingsPanel from './components/SettingsPanel';
import ShortcutsModal from './components/ShortcutsModal';
import BluetoothModal from './components/BluetoothModal';
import TrainerSubsetModal from './components/TrainerSubsetModal';
import StatsModal from './components/StatsModal';
import ManualEntryModal from './components/ManualEntryModal';
import SolverModal from './components/SolverModal';
import BulkScrambleModal from './components/BulkScrambleModal';
import SolverHints from './components/SolverHints';
import { OLL_CASES } from './scramble/algs/oll_cases';
import { PLL_CASES } from './scramble/algs/pll_cases';
import HistogramChart from './components/HistogramChart';
import TrendChart from './components/TrendChart';
import PracticeHeatmap from './components/PracticeHeatmap';
import { CubePreview } from './cube';
import { Cube3D } from './cube3d';
import { getLangQuery } from '../../i18n';

import './timer.css';
import './components/charts.css';
import './components/practice_heatmap.css';

const TRAINER_KINDS = new Set<EventId>(['oll', 'pll', 'coll', 'cmll', 'zbll', 'eg1', 'eg2']);

export default function TimerPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const settings = useSettings();
  useApplyTheme();

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

  // ── Scramble ────────────────────────────────────────────────────
  // Derived from (event, nonce, kociembaReady) — the nonce bumps regenerate;
  // kociembaReady forces a regen when 3x3 swaps from random-move to
  // random-state. ESLint thinks the latter two are unused since `generateScramble`
  // doesn't reference them, but the dispatcher's REG mutates over time so a
  // memo keyed only on `event` would miss the swap. Suppression is intentional.
  const [scrambleNonce, setScrambleNonce] = useState(0);
  const scramble = useMemo(
    () => generateScramble(event),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event, scrambleNonce, kociembaReady],
  );
  const nextScramble = useCallback(() => {
    setScrambleNonce(n => n + 1);
  }, []);

  // ── Solve recording ─────────────────────────────────────────────
  const [lastPenalty, setLastPenalty] = useState<Penalty | null>(null);
  // Snapshot taken whenever phase is NOT running. recordSolve reads these
  // so changing event mid-solve doesn't desync solve.event / scramble / caseId.
  const scrambleAtStartRef = useRef<string>(scramble);
  const eventAtStartRef = useRef<EventId>(event);
  const caseIdAtStartRef = useRef<string | null>(null);

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
    setLastPenalty(res.autoPenalty);
    setByEvent(prev => ({
      ...prev,
      [ev]: [...(prev[ev] ?? []), solve],
    }));
    nextScramble();
  }, [nextScramble, settings.multiStage, settings.bldMemo]);

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
  const timerCenterRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = timerCenterRef.current;
    if (!el) return;
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      warmupSound();
      onPressDown();
    };
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      onPressUp();
    };
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: false });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onPressDown, onPressUp]);

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

  // ── Modal ───────────────────────────────────────────────────────
  const [modalSolve, setModalSolve] = useState<{ s: Solve; idx: number } | null>(null);

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
    modalSolve !== null;
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
  const moreItems = useMemo<MoreMenuItem[]>(() => [
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
  ], [isZh, handleImport, handleExport, handleExportCsv, handleExportSs, clearAll, solves.length]);

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
            className={`tb-btn ${stackmat.status.listening ? 'connected' : ''}`}
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
          <button className="tb-btn" onClick={() => setStatsModalOpen(true)} title={isZh ? '完整统计' : 'Full stats'}>
            <BarChart3 size={14} />
          </button>
          <button className="tb-btn" onClick={() => setSettingsOpen(true)} title={isZh ? '设置' : 'Settings'}>
            <SettingsIcon size={14} />
          </button>
          <button className="tb-btn" onClick={() => setShortcutsOpen(true)} title={isZh ? '快捷键' : 'Shortcuts'}>
            <HelpCircle size={14} />
          </button>
          <button className="tb-btn" onClick={toggleFullscreen} title={isZh ? '全屏' : 'Fullscreen'}>
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <MoreMenu items={moreItems} isZh={isZh} />
          <LangToggle />
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
        <div className="timer-cube-preview">
          {settings.use3D
            ? <Cube3D event={event} scramble={scramble} size={200} colors={settings.colors} />
            : <CubePreview event={event} scramble={scramble} size={14} colors={settings.colors} />}
        </div>
      )}

      <div
        className="timer-center"
        ref={timerCenterRef}
        onMouseDown={onPressDown}
        onMouseUp={onPressUp}
      >
        <TimerDisplay
          phase={timer.phase}
          displayMs={timer.displayMs}
          inspectionDisplayMs={timer.inspectionDisplayMs}
          lastPenalty={timer.phase === 'stopped' ? lastPenalty : null}
        />
        {timer.phase === 'idle' && (
          <div className="timer-hint">
            {isZh ? <>按住 <code>空格</code> {settings.inspection > 0 ? '开始观察' : '进入准备'}</> : <>Hold <code>Space</code> to {settings.inspection > 0 ? 'inspect' : 'ready'}</>}
          </div>
        )}
        {timer.phase === 'inspecting' && (
          <div className="timer-hint">
            {isZh ? '观察中… 再按空格开始上手' : 'Inspecting… press space again to grip'}
          </div>
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

      <div className={`timer-bottom ${settings.showCharts ? 'with-charts' : ''}`}>
        <StatsPanel solves={solves} isZh={isZh} event={event} />
        <CaseStatsPanel event={event} solves={solves} isZh={isZh} />
        {settings.showCharts && (
          <div className="charts-panel">
            <h3>{isZh ? '分布' : 'Distribution'}</h3>
            <HistogramChart solves={solves} isZh={isZh} width={300} height={120} />
            <h3>{isZh ? '趋势' : 'Trend'}</h3>
            <TrendChart solves={solves} isZh={isZh} width={300} height={140} />
          </div>
        )}
        <HistoryPanel
          solves={solves}
          isZh={isZh}
          onRowClick={(s, idx) => setModalSolve({ s, idx })}
        />
      </div>

      {settings.showHeatmap && solves.length > 0 && (
        <div className="timer-heatmap-row">
          <PracticeHeatmap solves={solves} isZh={isZh} cellSize={11} />
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
          />
        );
      })()}

      {settingsOpen && (
        <SettingsPanel isZh={isZh} onClose={() => setSettingsOpen(false)} />
      )}

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
