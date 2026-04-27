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
import { Home, Download, Upload, Trash2, Settings as SettingsIcon, Maximize2, Minimize2 } from 'lucide-react';
import LangToggle from '../../components/LangToggle';

import { generateScramble, registerScramble } from './scramble';
import { warmup333, randomState333Sync } from './scramble/kociemba/random_state';
import { useTimer } from './useTimer';
import type { EventId, Penalty, Solve } from './types';
import { EVENTS } from './types';
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

import TimerDisplay from './components/TimerDisplay';
import StatsPanel from './components/StatsPanel';
import HistoryPanel from './components/HistoryPanel';
import SolveModal from './components/SolveModal';
import SettingsPanel from './components/SettingsPanel';
import HistogramChart from './components/HistogramChart';
import TrendChart from './components/TrendChart';
import { CubePreview } from './cube';
import { getLangQuery } from '../../i18n';

import './timer.css';
import './components/charts.css';

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
  const scrambleAtStartRef = useRef<string>(scramble);

  const recordSolve = useCallback((res: { timeMs: number; inspectionMs: number; autoPenalty: 'ok' | '+2' | 'DNF' }) => {
    const solve = makeSolve({
      timeMs: res.timeMs,
      scramble: scrambleAtStartRef.current,
      event,
      penalty: res.autoPenalty,
    });
    setLastPenalty(res.autoPenalty);
    setByEvent(prev => ({
      ...prev,
      [event]: [...(prev[event] ?? []), solve],
    }));
    nextScramble();
  }, [event, nextScramble]);

  const timer = useTimer(recordSolve);

  useEffect(() => {
    if (timer.phase !== 'running') {
      scrambleAtStartRef.current = scramble;
    }
  }, [timer.phase, scramble]);

  // ── Keyboard wiring ────────────────────────────────────────────
  const { onPressDown, onPressUp, reset } = timer;
  // Solves change every solve — keep them in a ref so we don't rebuild the
  // keydown listener on every recorded time. Mutators (updateSolve, etc.) are
  // already useCallback-stable enough that adding them as deps is fine.
  const solvesRef = useRef(solves);
  useEffect(() => { solvesRef.current = solves; }, [solves]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    warmupSound();
    onPressDown();
  }, [onPressDown]);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    onPressUp();
  }, [onPressUp]);

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
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
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

      // Block other shortcuts while the timer is mid-cycle.
      const ph = phaseRef.current;
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
  }, [onPressDown, onPressUp, reset, updateSolve, deleteSolve, nextScramble, toggleFullscreen]);

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

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className={`timer-root ${fullscreen ? 'fullscreen' : ''}`}>
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
          <button className="tb-btn" onClick={handleImport} title={isZh ? '导入（自动识别 cstimer JSON）' : 'Import (auto-detects cstimer JSON)'}>
            <Upload size={14} />
          </button>
          <button className="tb-btn" onClick={handleExport} title={isZh ? '导出 JSON' : 'Export JSON'}>
            <Download size={14} />
          </button>
          <button className="tb-btn" onClick={handleExportCsv} title={isZh ? '导出 CSV' : 'Export CSV'}>
            CSV
          </button>
          <button className="tb-btn" onClick={handleExportSs} title={isZh ? '导出 Speedstacks 文本' : 'Export Speedstacks'}>
            SS
          </button>
          <button
            className="tb-btn danger"
            onClick={clearAll}
            disabled={!solves.length}
            title={isZh ? '清空当前项目' : 'Clear current event'}
          >
            <Trash2 size={14} />
          </button>
          <button className="tb-btn" onClick={() => setSettingsOpen(true)} title={isZh ? '设置' : 'Settings'}>
            <SettingsIcon size={14} />
          </button>
          <button className="tb-btn" onClick={toggleFullscreen} title={isZh ? '全屏' : 'Fullscreen'}>
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <LangToggle />
        </div>
      </div>

      <div
        className={`scramble-strip ${settings.compactScramble ? 'compact' : ''}`}
        onClick={nextScramble}
        title={isZh ? '点击换一个打乱' : 'Click to refresh'}
      >
        {scramble || <span className="scramble-empty">—</span>}
      </div>

      {settings.showCubePreview && (
        <div className="timer-cube-preview">
          <CubePreview
            event={event}
            scramble={scramble}
            size={14}
            colors={settings.colors}
          />
        </div>
      )}

      <div
        className="timer-center"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
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
        <StatsPanel solves={solves} isZh={isZh} />
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

      {modalSolve && (
        <SolveModal
          key={modalSolve.s.id}
          solve={modalSolve.s}
          index={modalSolve.idx}
          isZh={isZh}
          onClose={() => setModalSolve(null)}
          onChangePenalty={(p) => {
            updateSolve(modalSolve.s.id, { penalty: p });
            setModalSolve({ ...modalSolve, s: { ...modalSolve.s, penalty: p } });
            if (modalSolve.idx === solves.length - 1) setLastPenalty(p);
          }}
          onChangeComment={(text) => {
            updateSolve(modalSolve.s.id, { comment: text });
            setModalSolve({ ...modalSolve, s: { ...modalSolve.s, comment: text } });
          }}
          onDelete={() => {
            deleteSolve(modalSolve.s.id);
            setModalSolve(null);
            if (modalSolve.idx === solves.length - 1) setLastPenalty(null);
          }}
        />
      )}

      {settingsOpen && (
        <SettingsPanel isZh={isZh} onClose={() => setSettingsOpen(false)} />
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
