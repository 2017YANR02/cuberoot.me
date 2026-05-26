'use client';

/**
 * /timer — speed-cubing timer (Next.js port).
 *
 * Feature parity v1: SPACE-hold + WCA inspection (15s + auto +2 / DNF), Web
 * Audio cues + voice cues, BLD memo split (Enter), histogram + ao5/ao12 trend
 * charts, PB toast (single / ao5 / ao12), settings modal, session manager,
 * scramble lock + offset, cstimer JSON import, manual entry, JSON export /
 * import, comments + penalties per solve.
 *
 * TODO — deferred features (kept in the original Vite TimerPage.tsx, 1634
 * lines, but not ported in this pass):
 *   - Bluetooth smart-cube drivers (gan / giiker / gocube / moyu / qiyi):
 *     Web Bluetooth doesn't work in non-localhost prod from a vanilla web
 *     context anyway, and the driver layer is ~6 files × 200 LOC each.
 *   - Stackmat decoder (Web Audio input from a headphone jack).
 *   - CFOP case-stats + multistage (cross / F2L / OLL / PLL splits) — depends
 *     on the analyzer worker, separate Phase 4 effort.
 *   - Drill mode / trainer subset modals.
 *   - Practice heatmap, hour-by-hour chart, scatter chart.
 *   - Reconstruction modal + WCA records overlay.
 *   - 3D cube preview + live cube state.
 *   - cstimer CSV export, Speedstacks CSV.
 *   - Multi-stage timing (cross / F2L / OLL / PLL split keys).
 *   - PB ladder + best-of-best celebration toasts.
 */

import {
  type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  BarChart3, ChevronLeft, Download, FileJson, ListPlus, Plus, RefreshCw,
  Settings as SettingsIcon, Trash2, Upload, Wrench,
} from 'lucide-react';
import LangToggle from '@/components/LangToggle';
import ThemeToggle from '@/components/ThemeToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  EVENTS, type EventId, type Penalty, type Solve,
  addSolve, clearEvent, deleteSolve, effectiveMs, exportAllJson,
  importJson, loadSolves, makeSolve, updateSolve,
} from './timer-db';
import { generateScramble } from './timer-scramble';
import { averageOfN, bestAverageOfN, bestSingle, formatMs } from './timer-stats';
import { useTimer, type SolveResult } from './useTimer';
import { useBldMemo, isBldEvent } from './useBldMemo';
import { getSettings, updateSettings, useTimerSettings } from './timer-settings';
import { play, setSoundSettings, warmupSound } from './timer-sound';
import HistogramChart from './components/HistogramChart';
import TrendChart from './components/TrendChart';
import PbToast, { type PbKind } from './components/PbToast';
import SettingsModal from './components/SettingsModal';
import StatsModal from './components/StatsModal';
import CstimerImportModal from './components/CstimerImportModal';
import ScrambleControlsModal from './components/ScrambleControlsModal';
import SessionManagerModal from './components/SessionManagerModal';
import './timer.css';
// Charts CSS pulled here so the SVGs in StatsModal also pick it up without a
// duplicate import.
import './components/charts.css';

const EVENT_STORAGE_KEY = 'cuberoot.timer.event';

export default function TimerPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);
  useDocumentTitle('计时器', 'Timer');

  const settings = useTimerSettings();

  // Keep the sound module in sync with settings.
  useEffect(() => {
    setSoundSettings({
      enabled: settings.soundsEnabled,
      volume: settings.volume,
      voiceInspection: settings.voiceInspection,
    });
  }, [settings.soundsEnabled, settings.volume, settings.voiceInspection]);

  const [event, setEvent] = useState<EventId>('333');
  const [scramble, setScramble] = useState<string>('');
  const [scrambling, setScrambling] = useState<boolean>(false);
  const [scrambleLocked, setScrambleLocked] = useState<boolean>(false);
  const [solves, setSolves] = useState<Solve[]>([]);
  const [modalSolveId, setModalSolveId] = useState<string | null>(null);
  const [pb, setPb] = useState<{ kind: PbKind; value: string } | null>(null);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showCstimerImport, setShowCstimerImport] = useState(false);
  const [showScrambleControls, setShowScrambleControls] = useState(false);
  const [showSessions, setShowSessions] = useState(false);

  // ── Solve recording (called by useTimer.onSolve) ──────────────────────────

  const handleStopped = useCallback((res: SolveResult) => {
    const penalty: Penalty = res.autoPenalty;
    const solve = makeSolve({
      event,
      scramble,
      timeMs: res.timeMs,
      penalty,
    });
    const memoExtract = bldMemoRef.current?.extractFinal();
    const finalSolve: Solve = memoExtract ? { ...solve, memoMs: memoExtract.memoMs } : solve;

    void addSolve(finalSolve);
    setSolves((prev) => {
      const next = [...prev, finalSolve];
      // PB detection — uses the *next* list (includes the just-recorded solve).
      if (settings.pbToast) {
        const eff = effectiveMs(finalSolve);
        const prevBest = bestSingle(prev);
        if (Number.isFinite(eff) && (prevBest == null || eff < prevBest)) {
          setPb({ kind: 'single', value: formatMs(eff, settings.precision) });
        } else {
          // ao5 / ao12 PB?
          for (const n of [5, 12] as const) {
            const newAo = averageOfN(next, n);
            const prevBestAo = bestAverageOfN(prev, n);
            if (newAo !== null && Number.isFinite(newAo) && (prevBestAo == null || newAo < prevBestAo)) {
              setPb({ kind: n === 5 ? 'ao5' : 'ao12', value: formatMs(newAo, settings.precision) });
              break;
            }
          }
        }
      }
      return next;
    });

    // Roll next scramble unless locked.
    if (!scrambleLocked) void refreshScramble();
  }, [event, scramble, scrambleLocked, settings.pbToast, settings.precision]);

  const timer = useTimer(handleStopped);
  const bldMemoEnabled = settings.bldMemo && isBldEvent(event);
  const bldMemo = useBldMemo({
    phase: timer.phase,
    displayMs: timer.displayMs,
    enabled: bldMemoEnabled,
  });
  const bldMemoRef = useRef(bldMemo);
  useEffect(() => { bldMemoRef.current = bldMemo; }, [bldMemo]);

  // ── Persistence ───────────────────────────────────────────────────────────

  // Restore last event on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(EVENT_STORAGE_KEY);
      if (saved && EVENTS.some((e) => e.id === saved)) setEvent(saved as EventId);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(EVENT_STORAGE_KEY, event); } catch { /* ignore */ }
  }, [event]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadSolves(event);
      if (!cancelled) setSolves(list);
    })();
    return () => { cancelled = true; };
  }, [event]);

  // ── Scramble lifecycle ────────────────────────────────────────────────────

  const refreshScramble = useCallback(async () => {
    setScrambling(true);
    try {
      const s = await generateScramble(event);
      setScramble(s);
    } catch (err) {
      console.warn('[timer] scramble failed', err);
      setScramble('');
    } finally {
      setScrambling(false);
    }
  }, [event]);

  // First scramble + refresh when event changes (and not locked).
  const eventRef = useRef(event);
  useEffect(() => {
    if (eventRef.current !== event) {
      eventRef.current = event;
      void refreshScramble();
      timer.reset();
    } else if (!scramble) {
      void refreshScramble();
    }
  }, [event, refreshScramble, scramble, timer]);

  const handleSkip = useCallback(async (n: number) => {
    for (let i = 0; i < Math.max(0, n - 1); i++) {
      try { await generateScramble(event); } catch { /* ignore */ }
    }
    await refreshScramble();
  }, [event, refreshScramble]);

  // ── Keyboard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showSettings || showStats || showCstimerImport || showScrambleControls || showSessions || modalSolveId) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      if (e.code === 'Enter' && bldMemoEnabled && timer.phase === 'running') {
        e.preventDefault();
        bldMemoRef.current?.markMemo();
        return;
      }
      if (e.code !== 'Space') return;
      if (e.repeat) { e.preventDefault(); return; }
      e.preventDefault();
      warmupSound();
      timer.onPressDown();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (showSettings || showStats || showCstimerImport || showScrambleControls || showSessions || modalSolveId) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.code !== 'Space') return;
      e.preventDefault();
      timer.onPressUp();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [bldMemoEnabled, modalSolveId, showCstimerImport, showScrambleControls, showSessions, showSettings, showStats, timer]);

  // ── Solve actions ─────────────────────────────────────────────────────────

  const setSolvePenalty = useCallback(async (id: string, penalty: Penalty) => {
    const ix = solves.findIndex((s) => s.id === id);
    if (ix < 0) return;
    const next = { ...solves[ix], penalty };
    const newList = [...solves];
    newList[ix] = next;
    setSolves(newList);
    if (penalty !== 'ok') play('penalty');
    await updateSolve(next);
  }, [solves]);

  const removeSolve = useCallback(async (id: string) => {
    setSolves((prev) => prev.filter((s) => s.id !== id));
    await deleteSolve(id);
  }, []);

  const setSolveComment = useCallback(async (id: string, comment: string) => {
    const ix = solves.findIndex((s) => s.id === id);
    if (ix < 0) return;
    const next = { ...solves[ix], comment };
    const newList = [...solves];
    newList[ix] = next;
    setSolves(newList);
    await updateSolve(next);
  }, [solves]);

  const handleClearAll = useCallback(async () => {
    if (!window.confirm(t('清空当前项目的所有成绩?', 'Clear all solves for this event?'))) return;
    await clearEvent(event);
    setSolves([]);
    timer.reset();
  }, [event, timer, t]);

  const handleExport = useCallback(async () => {
    const json = await exportAllJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuberoot-timer-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImport = useCallback(() => fileInputRef.current?.click(), []);

  const handleFile = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    try {
      const n = await importJson(text);
      const list = await loadSolves(event);
      setSolves(list);
      window.alert(t(`已导入 ${n} 条成绩`, `Imported ${n} solves`));
    } catch (err) {
      window.alert(t('导入失败: ', 'Import failed: ') + (err as Error).message);
    }
  }, [event, t]);

  const handleCstimerImported = useCallback(async (_byEvent: Map<string, Solve[]>) => {
    const list = await loadSolves(event);
    setSolves(list);
  }, [event]);

  // ── Display ───────────────────────────────────────────────────────────────

  const phase = timer.phase;
  const displayText = useMemo(() => {
    if (phase === 'inspecting') {
      const remaining = Math.max(0, settings.inspection - Math.floor(timer.inspectionDisplayMs / 1000));
      return String(remaining);
    }
    if (phase === 'running' && settings.hideTime) return '…';
    if (phase === 'running') return formatMs(timer.displayMs, settings.precision);
    if (phase === 'holding' || phase === 'ready') return formatMs(0, settings.precision);
    if (timer.lastMs !== null) return formatMs(timer.lastMs, settings.precision);
    return formatMs(0, settings.precision);
  }, [phase, timer.displayMs, timer.inspectionDisplayMs, timer.lastMs, settings.inspection, settings.precision, settings.hideTime]);

  const stageHint = useMemo(() => {
    switch (phase) {
      case 'idle': return t('按住空格 / 触摸开始', 'Hold SPACE / tap to start');
      case 'inspecting': return t('再按一下开始按住', 'Press again to start holding');
      case 'holding': return t('继续按住…', 'Keep holding…');
      case 'ready': return t('松开开始!', 'Release to start!');
      case 'running': return bldMemoEnabled
        ? t('Enter 标记记忆完成 · 按一下停止', 'Enter marks memo · press to stop')
        : t('再按一下停止', 'Press to stop');
      case 'stopped': return t('点击成绩查看 / 添加 +2 DNF', 'Click chip below to edit / add +2 DNF');
      default: return '';
    }
  }, [phase, bldMemoEnabled, t]);

  const ao5 = useMemo(() => averageOfN(solves, 5), [solves]);
  const ao12 = useMemo(() => averageOfN(solves, 12), [solves]);
  const bestAo5 = useMemo(() => bestAverageOfN(solves, 5), [solves]);
  const single = useMemo(() => bestSingle(solves), [solves]);

  const lastSolves = useMemo(() => solves.slice(-50).reverse(), [solves]);
  const modalSolve = useMemo(
    () => solves.find((s) => s.id === modalSolveId) ?? null,
    [solves, modalSolveId],
  );

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    warmupSound();
    timer.onPressDown();
  }, [timer]);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    timer.onPressUp();
  }, [timer]);

  return (
    <div className="tmr-page">
      <header className="tmr-header">
        <Link href="/" className="tmr-back" aria-label={t('返回', 'Back')}>
          <ChevronLeft size={18} />
        </Link>
        <h1>{t('计时器', 'Timer')}</h1>
        <select
          className="tmr-event-select"
          value={event}
          onChange={(e) => setEvent(e.target.value as EventId)}
          aria-label={t('项目', 'Event')}
        >
          {EVENTS.map((e) => (
            <option key={e.id} value={e.id}>
              {isZh ? e.nameZh : e.nameEn}
            </option>
          ))}
        </select>
        <button type="button" className="tmr-action-btn" onClick={() => setShowSessions(true)} title={t('会话', 'Sessions')}>
          <ListPlus size={14} />
        </button>
        <button
          type="button"
          className="tmr-action-btn"
          onClick={() => void refreshScramble()}
          disabled={scrambling}
          title={t('换一个打乱', 'New scramble')}
        >
          <RefreshCw size={14} />
        </button>
        <button type="button" className="tmr-action-btn" onClick={() => setShowScrambleControls(true)} title={t('打乱控制', 'Scramble controls')}>
          <Wrench size={14} />
        </button>
        <button type="button" className="tmr-action-btn" onClick={() => setShowStats(true)} title={t('统计', 'Stats')}>
          <BarChart3 size={14} />
        </button>
        <button type="button" className="tmr-action-btn" onClick={() => setShowCstimerImport(true)} title={t('cstimer 导入', 'cstimer import')}>
          <FileJson size={14} />
        </button>
        <button type="button" className="tmr-action-btn" onClick={handleExport} title={t('导出 JSON', 'Export JSON')}>
          <Download size={14} />
        </button>
        <button type="button" className="tmr-action-btn" onClick={handleImport} title={t('导入 JSON', 'Import JSON')}>
          <Upload size={14} />
        </button>
        <button type="button" className="tmr-action-btn" onClick={handleClearAll} title={t('清空当前项目', 'Clear event')}>
          <Trash2 size={14} />
        </button>
        <button type="button" className="tmr-action-btn" onClick={() => setShowSettings(true)} title={t('设置', 'Settings')}>
          <SettingsIcon size={14} />
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFile} style={{ display: 'none' }} />
        <LangToggle variant="inline" />
        <ThemeToggle />
      </header>

      <div className="tmr-scramble">
        <div className="tmr-scramble-row">
          <span className="tmr-scramble-text">
            {scrambling ? t('打乱中…', 'Scrambling…') : (scramble || t('无打乱', 'No scramble'))}
          </span>
          {scrambleLocked && <span className="tmr-scramble-lock">{t('已锁定', 'Locked')}</span>}
        </div>
      </div>

      <div
        className={`tmr-stage ${phase}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={(e) => { if (e.button === 0) { warmupSound(); timer.onPressDown(); } }}
        onMouseUp={(e) => { if (e.button === 0) timer.onPressUp(); }}
        role="button"
        tabIndex={0}
      >
        <div className={`tmr-display ${phase === 'inspecting' ? 'inspecting' : ''}`}>{displayText}</div>
        {bldMemoEnabled && bldMemo.memoMs !== undefined && (
          <div className="tmr-memo-split">
            {t('记忆', 'Memo')}: {formatMs(bldMemo.memoMs, settings.precision)}
          </div>
        )}
        <div className="tmr-stage-hint">{stageHint}</div>
      </div>

      <div className="tmr-stats-bar">
        <Stat label={t('当前', 'Current')} val={timer.lastMs} precision={settings.precision} />
        <Stat label="ao5" val={ao5} precision={settings.precision} />
        <Stat label="ao12" val={ao12} precision={settings.precision} />
        <Stat label={t('单次最快', 'Best')} val={single} precision={settings.precision} />
        <Stat label={t('最佳 ao5', 'Best ao5')} val={bestAo5} precision={settings.precision} />
        <Stat label={t('数量', 'Count')} val={solves.length} suffix={t(' 次', '')} format="num" precision={settings.precision} />
      </div>

      {settings.showCharts && (
        <section className="tmr-charts-section">
          <div className="tmr-chart-block">
            <h3>{t('分布', 'Distribution')}</h3>
            <HistogramChart solves={solves} isZh={isZh} />
          </div>
          <div className="tmr-chart-block">
            <h3>{t('趋势', 'Trend')}</h3>
            <TrendChart solves={solves} isZh={isZh} />
          </div>
        </section>
      )}

      <section className="tmr-history">
        <h2>{t('最近成绩', 'Recent solves')}</h2>
        <div className="tmr-history-list">
          {lastSolves.length === 0 && (
            <span style={{ fontSize: 13, opacity: 0.6 }}>{t('暂无', 'None yet')}</span>
          )}
          {lastSolves.map((s, i) => {
            const eff = effectiveMs(s);
            const isDnf = s.penalty === 'DNF';
            const isPlus2 = s.penalty === '+2';
            return (
              <button
                key={s.id}
                type="button"
                className={'tmr-solve-chip' + (isDnf ? ' dnf' : '') + (isPlus2 ? ' plus2' : '')}
                onClick={() => setModalSolveId(s.id)}
                title={s.scramble}
              >
                <span style={{ opacity: 0.6, fontSize: 11 }}>#{solves.length - i}</span>
                <span>
                  {isDnf ? 'DNF' : formatMs(eff, settings.precision)}
                  {isPlus2 ? '+' : ''}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {modalSolve && (
        <SolveModal
          solve={modalSolve}
          isZh={isZh}
          precision={settings.precision}
          onClose={() => setModalSolveId(null)}
          onSetPenalty={(p) => setSolvePenalty(modalSolve.id, p)}
          onSetComment={(c) => setSolveComment(modalSolve.id, c)}
          onDelete={() => { void removeSolve(modalSolve.id); setModalSolveId(null); }}
        />
      )}

      {pb && (
        <PbToast
          kind={pb.kind}
          value={pb.value}
          isZh={isZh}
          onClose={() => setPb(null)}
        />
      )}

      <ManualAddBar
        event={event}
        scramble={scramble}
        onAdd={(timeMs) => {
          const solve = makeSolve({ event, scramble, timeMs });
          void addSolve(solve);
          setSolves((prev) => [...prev, solve]);
        }}
        isZh={isZh}
      />

      {showSettings && <SettingsModal isZh={isZh} onClose={() => setShowSettings(false)} />}
      {showStats && <StatsModal solves={solves} isZh={isZh} onClose={() => setShowStats(false)} />}
      {showCstimerImport && (
        <CstimerImportModal
          isZh={isZh}
          onClose={() => setShowCstimerImport(false)}
          onImported={handleCstimerImported}
        />
      )}
      {showScrambleControls && (
        <ScrambleControlsModal
          isZh={isZh}
          locked={scrambleLocked}
          onSetLocked={setScrambleLocked}
          onSkip={(n) => void handleSkip(n)}
          onClose={() => setShowScrambleControls(false)}
        />
      )}
      {showSessions && (
        <SessionManagerModal
          isZh={isZh}
          currentEvent={event}
          onPickEvent={setEvent}
          onClose={() => setShowSessions(false)}
        />
      )}
    </div>
  );
}

function Stat({
  label, val, suffix, format, precision,
}: {
  label: string;
  val: number | null | undefined;
  suffix?: string;
  format?: 'time' | 'num';
  precision: 2 | 3;
}) {
  let display = '—';
  if (val != null && Number.isFinite(val)) {
    if (format === 'num') display = String(val);
    else display = formatMs(val as number, precision);
  } else if (val === Infinity) {
    display = 'DNF';
  }
  return (
    <div className="tmr-stat">
      <span className="tmr-stat-label">{label}</span>
      <span className="tmr-stat-val">{display}{suffix ?? ''}</span>
    </div>
  );
}

function SolveModal({
  solve, isZh, precision, onClose, onSetPenalty, onSetComment, onDelete,
}: {
  solve: Solve;
  isZh: boolean;
  precision: 2 | 3;
  onClose: () => void;
  onSetPenalty: (p: Penalty) => void;
  onSetComment: (c: string) => void;
  onDelete: () => void;
}) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [comment, setComment] = useState(solve.comment ?? '');
  useEffect(() => { setComment(solve.comment ?? ''); }, [solve.id, solve.comment]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="tmr-modal-backdrop" onClick={onClose}>
      <div className="tmr-modal" onClick={(e) => e.stopPropagation()}>
        <h3>
          {formatMs(effectiveMs(solve), precision)}
          {solve.penalty === '+2' ? ' (+2)' : ''}
          {solve.penalty === 'DNF' ? ' DNF' : ''}
        </h3>
        {solve.memoMs !== undefined && (
          <p style={{ fontSize: 12, opacity: 0.7, margin: '0 0 8px' }}>
            {t('记忆', 'Memo')}: {formatMs(solve.memoMs, precision)} ·
            {' '}{t('执行', 'Exec')}: {formatMs(Math.max(0, solve.timeMs - solve.memoMs), precision)}
          </p>
        )}
        <pre className="scramble">{solve.scramble || t('无打乱', '(no scramble)')}</pre>
        <div className="tmr-modal-row">
          <button type="button" className="tmr-action-btn" aria-pressed={solve.penalty === 'ok'} onClick={() => onSetPenalty('ok')}>OK</button>
          <button type="button" className="tmr-action-btn" aria-pressed={solve.penalty === '+2'} onClick={() => onSetPenalty('+2')}>+2</button>
          <button type="button" className="tmr-action-btn" aria-pressed={solve.penalty === 'DNF'} onClick={() => onSetPenalty('DNF')}>DNF</button>
        </div>
        <textarea
          placeholder={t('备注 (可选)', 'Comment (optional)')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => onSetComment(comment)}
        />
        <div className="tmr-modal-foot">
          <button type="button" className="tmr-action-btn" onClick={onDelete}>
            <Trash2 size={13} /> {t('删除', 'Delete')}
          </button>
          <button type="button" className="tmr-action-btn" onClick={onClose}>{t('关闭', 'Close')}</button>
        </div>
      </div>
    </div>
  );
}

function ManualAddBar({
  event, scramble, onAdd, isZh,
}: {
  event: EventId;
  scramble: string;
  onAdd: (timeMs: number) => void;
  isZh: boolean;
}) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');

  const submit = () => {
    const ms = parseTimeInput(input);
    if (ms == null) return;
    onAdd(ms);
    setInput('');
    setOpen(false);
  };

  if (!open) {
    return (
      <div style={{ padding: '0 16px 24px' }}>
        <button type="button" className="tmr-action-btn" onClick={() => setOpen(true)}>
          <Plus size={13} /> {t('手动添加成绩', 'Add solve manually')}
        </button>
        <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.5 }}>
          {t(`项目: ${event}`, `Event: ${event}`)} {scramble ? '· ' + (isZh ? '使用当前打乱' : 'will use current scramble') : ''}
        </span>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', gap: 8 }}>
      <input
        type="text"
        autoFocus
        value={input}
        placeholder={t('如 12.34 或 1:23.45', 'e.g. 12.34 or 1:23.45')}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') setOpen(false);
        }}
        style={{
          flex: 1,
          padding: '6px 10px',
          border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
          borderRadius: 6,
          font: 'inherit',
          background: 'transparent',
          color: 'inherit',
        }}
      />
      <button type="button" className="tmr-action-btn" onClick={submit}>{t('保存', 'Save')}</button>
      <button type="button" className="tmr-action-btn" onClick={() => setOpen(false)}>{t('取消', 'Cancel')}</button>
    </div>
  );
}

function parseTimeInput(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  if (/^dnf$/i.test(trimmed)) return null;
  const colon = trimmed.indexOf(':');
  if (colon >= 0) {
    const min = Number(trimmed.slice(0, colon));
    const sec = Number(trimmed.slice(colon + 1));
    if (!Number.isFinite(min) || !Number.isFinite(sec)) return null;
    return Math.round((min * 60 + sec) * 1000);
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1000);
}

// Re-export to ensure the warmup helper isn't tree-shaken away from the bundle
// (Settings/test sanity check).
export { warmupSound, getSettings, updateSettings };
