'use client';

/**
 * /timer — speed-cubing timer (Next.js port, minimal viable build).
 *
 * Implements the core flow:
 *   - Event picker (WCA + custom)
 *   - Random-state scramble via cubing.js
 *   - SPACE / touch hold-and-release timer state machine
 *   - +2 / DNF / delete / comment per solve
 *   - aoN stats (ao5 / ao12 / best ao5 / best single)
 *   - IndexedDB-backed history per event (localStorage fallback)
 *   - Import / export JSON
 *
 * Deferred — too big for this pass; the Vite source ports them across ~130
 * sub-files (1634-line TimerPage.tsx + bluetooth/, sound/, scramble/, etc.):
 *   - Bluetooth smart-cube drivers (gan / giiker / gocube / moyu / qiyi)
 *   - Stackmat decoder (audio jack)
 *   - WCA inspection (countdown + ±2 / DNF auto-penalty)
 *   - Audio cues (metronome / voice / inspection warnings)
 *   - Histogram / trend / heatmap charts
 *   - cstimer JSON import / Speedstacks CSV export
 *   - Reconstruction / SolverHints / drill mode / trainer subset / BLD memo
 *   - 26 modal dialogs (settings / sessions / stats / share / etc.)
 *   - PB toast w/ best-of-best / best-aoN celebration ladders
 *   - Multistage timing (cross / F2L / OLL / PLL splits)
 *
 * Re-enable plan: port each sub-module under app/timer/ and wire incrementally.
 * See packages/client/src/pages/timer/{components,scramble,storage,sound,
 * bluetooth,stackmat,reconstruct,multistage,settings}/ for source layout.
 */

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft, Download, Plus, RefreshCw, Trash2, Upload,
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
import './timer.css';

type Phase = 'idle' | 'holding' | 'ready' | 'running' | 'stopped';

const HOLD_MS = 350;
const TICK_MS = 30;
const EVENT_STORAGE_KEY = 'cuberoot.timer.event';

export default function TimerPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);
  useDocumentTitle('计时器', 'Timer');

  const [event, setEvent] = useState<EventId>('333');
  const [scramble, setScramble] = useState<string>('');
  const [scrambling, setScrambling] = useState<boolean>(false);
  const [solves, setSolves] = useState<Solve[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [displayMs, setDisplayMs] = useState(0);
  const [modalSolveId, setModalSolveId] = useState<string | null>(null);
  const [pb, setPb] = useState<string | null>(null);

  const phaseRef = useRef<Phase>('idle');
  const startTsRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const setPhaseSafe = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  // Restore last event on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(EVENT_STORAGE_KEY);
      if (saved && EVENTS.some((e) => e.id === saved)) setEvent(saved as EventId);
    } catch { /* ignore */ }
  }, []);

  // Persist event on change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(EVENT_STORAGE_KEY, event); } catch { /* ignore */ }
  }, [event]);

  // Load solves on event change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadSolves(event);
      if (!cancelled) setSolves(list);
    })();
    return () => { cancelled = true; };
  }, [event]);

  // Generate scramble on event change.
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

  useEffect(() => {
    refreshScramble();
  }, [refreshScramble]);

  // ── Timer state machine ────────────────────────────────────────────────────

  const stopTick = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const stopHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const onPressDown = useCallback(() => {
    const cur = phaseRef.current;
    if (cur === 'running') {
      // Stop the timer.
      stopTick();
      const final = performance.now() - startTsRef.current;
      setDisplayMs(final);
      lastTimeRef.current = final;
      setPhaseSafe('stopped');

      const solve = makeSolve({ event, scramble, timeMs: final });
      void addSolve(solve);
      setSolves((prev) => [...prev, solve]);
      // Auto-roll next scramble.
      void refreshScramble();

      // PB toast?
      const prevBest = bestSingle(solves);
      if (prevBest == null || final < prevBest) {
        setPb(t('个人最佳!', 'Personal best!'));
        window.setTimeout(() => setPb(null), 2400);
      }
      return;
    }
    if (cur === 'idle' || cur === 'stopped') {
      setPhaseSafe('holding');
      stopHoldTimer();
      holdTimerRef.current = window.setTimeout(() => {
        if (phaseRef.current === 'holding') setPhaseSafe('ready');
      }, HOLD_MS);
    }
  }, [stopTick, setPhaseSafe, stopHoldTimer, event, scramble, refreshScramble, solves, t]);

  const onPressUp = useCallback(() => {
    const cur = phaseRef.current;
    if (cur === 'ready') {
      stopHoldTimer();
      setDisplayMs(0);
      startTsRef.current = performance.now();
      setPhaseSafe('running');
      stopTick();
      tickRef.current = window.setInterval(() => {
        setDisplayMs(performance.now() - startTsRef.current);
      }, TICK_MS);
      return;
    }
    if (cur === 'holding') {
      stopHoldTimer();
      setPhaseSafe(lastTimeRef.current !== null ? 'stopped' : 'idle');
    }
  }, [setPhaseSafe, stopHoldTimer, stopTick]);

  // Keyboard.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      onPressDown();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      e.preventDefault();
      onPressUp();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onPressDown, onPressUp]);

  // Cleanup.
  useEffect(() => () => {
    stopTick();
    stopHoldTimer();
  }, [stopTick, stopHoldTimer]);

  // Touch.
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    onPressDown();
  }, [onPressDown]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    onPressUp();
  }, [onPressUp]);

  // ── Solve actions ──────────────────────────────────────────────────────────

  const setSolvePenalty = useCallback(async (id: string, penalty: Penalty) => {
    const ix = solves.findIndex((s) => s.id === id);
    if (ix < 0) return;
    const next = { ...solves[ix], penalty };
    const newList = [...solves];
    newList[ix] = next;
    setSolves(newList);
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
    lastTimeRef.current = null;
    setDisplayMs(0);
    setPhaseSafe('idle');
  }, [event, setPhaseSafe, t]);

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

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // ── Display ─────────────────────────────────────────────────────────────────

  const displayText = useMemo(() => {
    if (phase === 'running') return formatMs(displayMs, 2);
    if (phase === 'holding' || phase === 'ready') return formatMs(0, 2);
    if (phase === 'stopped' && lastTimeRef.current != null) {
      return formatMs(lastTimeRef.current, 2);
    }
    return formatMs(0, 2);
  }, [phase, displayMs]);

  const ao5 = useMemo(() => averageOfN(solves, 5), [solves]);
  const ao12 = useMemo(() => averageOfN(solves, 12), [solves]);
  const bestAo5 = useMemo(() => bestAverageOfN(solves, 5), [solves]);
  const single = useMemo(() => bestSingle(solves), [solves]);

  const lastSolves = useMemo(() => solves.slice(-50).reverse(), [solves]);
  const modalSolve = useMemo(
    () => solves.find((s) => s.id === modalSolveId) ?? null,
    [solves, modalSolveId],
  );

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
        <button
          type="button"
          className="tmr-action-btn"
          onClick={() => void refreshScramble()}
          disabled={scrambling}
          title={t('换一个打乱', 'New scramble')}
        >
          <RefreshCw size={14} />
        </button>
        <button
          type="button"
          className="tmr-action-btn"
          onClick={handleExport}
          title={t('导出 JSON', 'Export JSON')}
        >
          <Download size={14} />
        </button>
        <button
          type="button"
          className="tmr-action-btn"
          onClick={handleImport}
          title={t('导入 JSON', 'Import JSON')}
        >
          <Upload size={14} />
        </button>
        <button
          type="button"
          className="tmr-action-btn"
          onClick={handleClearAll}
          title={t('清空当前项目', 'Clear event')}
        >
          <Trash2 size={14} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <LangToggle variant="inline" />
        <ThemeToggle />
      </header>

      <div className="tmr-scramble">
        <div className="tmr-scramble-row">
          <span className="tmr-scramble-text">
            {scrambling ? t('打乱中…', 'Scrambling…') : (scramble || t('无打乱', 'No scramble'))}
          </span>
        </div>
      </div>

      <div
        className={`tmr-stage ${phase}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={(e) => {
          // Don't intercept clicks on header buttons; only the stage area.
          if (e.button !== 0) return;
          onPressDown();
        }}
        onMouseUp={(e) => {
          if (e.button !== 0) return;
          onPressUp();
        }}
        role="button"
        tabIndex={0}
      >
        <div className="tmr-display">{displayText}</div>
        <div className="tmr-stage-hint">
          {phase === 'idle' && t('按住空格 / 触摸开始', 'Hold SPACE / tap to start')}
          {phase === 'holding' && t('继续按住…', 'Keep holding…')}
          {phase === 'ready' && t('松开开始!', 'Release to start!')}
          {phase === 'running' && t('再按一下停止', 'Press to stop')}
          {phase === 'stopped' && t('点击成绩查看 / 添加 +2 DNF', 'Click chip below to edit / add +2 DNF')}
        </div>
      </div>

      <div className="tmr-stats-bar">
        <Stat label={t('当前', 'Current')} val={lastTimeRef.current} />
        <Stat label={t('ao5', 'ao5')} val={ao5} />
        <Stat label={t('ao12', 'ao12')} val={ao12} />
        <Stat label={t('单次最快', 'Best')} val={single} />
        <Stat label={t('最佳 ao5', 'Best ao5')} val={bestAo5} />
        <Stat label={t('数量', 'Count')} val={solves.length} suffix={t(' 次', '')} format="num" />
      </div>

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
                <span style={{ opacity: 0.6, fontSize: 11 }}>
                  #{solves.length - i}
                </span>
                <span>
                  {isDnf ? 'DNF' : formatMs(eff, 2)}
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
          onClose={() => setModalSolveId(null)}
          onSetPenalty={(p) => setSolvePenalty(modalSolve.id, p)}
          onSetComment={(c) => setSolveComment(modalSolve.id, c)}
          onDelete={() => {
            void removeSolve(modalSolve.id);
            setModalSolveId(null);
          }}
        />
      )}

      {pb && <div className="tmr-pb-toast">{pb}</div>}

      <ManualAddBar event={event} scramble={scramble} onAdd={(timeMs) => {
        const solve = makeSolve({ event, scramble, timeMs });
        void addSolve(solve);
        setSolves((prev) => [...prev, solve]);
      }} isZh={isZh} />
    </div>
  );
}

function Stat({
  label, val, suffix, format,
}: {
  label: string;
  val: number | null | undefined;
  suffix?: string;
  format?: 'time' | 'num';
}) {
  let display = '—';
  if (val != null && Number.isFinite(val)) {
    if (format === 'num') display = String(val);
    else display = formatMs(val as number, 2);
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
  solve, isZh, onClose, onSetPenalty, onSetComment, onDelete,
}: {
  solve: Solve;
  isZh: boolean;
  onClose: () => void;
  onSetPenalty: (p: Penalty) => void;
  onSetComment: (c: string) => void;
  onDelete: () => void;
}) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [comment, setComment] = useState(solve.comment ?? '');
  useEffect(() => { setComment(solve.comment ?? ''); }, [solve.id, solve.comment]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="tmr-solve-modal-backdrop" onClick={onClose}>
      <div className="tmr-solve-modal" onClick={(e) => e.stopPropagation()}>
        <h3>
          {formatMs(effectiveMs(solve), 2)}
          {solve.penalty === '+2' ? ' (+2)' : ''}
          {solve.penalty === 'DNF' ? ' DNF' : ''}
        </h3>
        <pre className="scramble">{solve.scramble || t('无打乱', '(no scramble)')}</pre>
        <div className="tmr-solve-modal-row">
          <button
            type="button"
            className="tmr-action-btn"
            aria-pressed={solve.penalty === 'ok'}
            onClick={() => onSetPenalty('ok')}
          >OK</button>
          <button
            type="button"
            className="tmr-action-btn"
            aria-pressed={solve.penalty === '+2'}
            onClick={() => onSetPenalty('+2')}
          >+2</button>
          <button
            type="button"
            className="tmr-action-btn"
            aria-pressed={solve.penalty === 'DNF'}
            onClick={() => onSetPenalty('DNF')}
          >DNF</button>
        </div>
        <textarea
          placeholder={t('备注 (可选)', 'Comment (optional)')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => onSetComment(comment)}
        />
        <div className="tmr-solve-modal-actions">
          <button type="button" className="tmr-action-btn" onClick={onDelete}>
            <Trash2 size={13} /> {t('删除', 'Delete')}
          </button>
          <button type="button" className="tmr-action-btn" onClick={onClose}>
            {t('关闭', 'Close')}
          </button>
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
        <button
          type="button"
          className="tmr-action-btn"
          onClick={() => setOpen(true)}
        >
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
      <button type="button" className="tmr-action-btn" onClick={submit}>
        {t('保存', 'Save')}
      </button>
      <button type="button" className="tmr-action-btn" onClick={() => setOpen(false)}>
        {t('取消', 'Cancel')}
      </button>
    </div>
  );
}

/** "12.34" / "1:23.45" / "DNF" → ms. */
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
