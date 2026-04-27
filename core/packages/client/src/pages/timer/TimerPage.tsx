/**
 * /timer — TypeScript reimplementation of csTimer's core flow.
 *
 * Features (v1):
 *  - Random-move scrambles for major events (2x2 ~ 7x7 / pyra / skewb / sq1 / mega / clock)
 *  - WCA-style spacebar / touch hold-to-start timer (550ms hold, red→green)
 *  - Per-event sessions stored in localStorage; create / rename / delete
 *  - Solve history with penalty (+2/DNF/OK), edit, delete
 *  - Stats: best, worst, mean, ao5/12/100, best ao5/12/100
 *  - JSON import / export
 *  - i18n (zh/en) via useTranslation + isZh ternaries
 *
 * Out of scope (intentionally) for v1:
 *  - Random-state (Kociemba) scrambles
 *  - 2D/3D cube preview
 *  - Bluetooth cube / smartcube support
 *  - Cloud sync
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Home, Download, Upload, Trash2, Plus, Edit2 } from 'lucide-react';
import LangToggle from '../../components/LangToggle';

import { generateScramble } from './scramble';
import { useTimer } from './useTimer';
import type { EventId, Penalty, Session, Solve } from './types';
import { EVENTS } from './types';
import {
  loadAll,
  saveAll,
  newSession,
  defaultSessionsForFreshDb,
  exportJson,
  importJson,
  makeSolve,
} from './storage/db';

import TimerDisplay from './components/TimerDisplay';
import StatsPanel from './components/StatsPanel';
import HistoryPanel from './components/HistoryPanel';
import SolveModal from './components/SolveModal';
import { getLangQuery } from '../../i18n';

import './timer.css';

export default function TimerPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  // ── State: sessions + active selection ─────────────────────────
  const [sessions, setSessions] = useState<Session[]>(() => {
    const loaded = loadAll().sessions;
    return loaded.length > 0 ? loaded : defaultSessionsForFreshDb();
  });
  const [active, setActive] = useState<Record<string, string>>(() => loadAll().active);

  // Single source of truth for persistence: write whenever sessions/active change.
  // This avoids stale-closure races inside individual mutation callbacks.
  useEffect(() => {
    saveAll(sessions, active);
  }, [sessions, active]);

  const [event, setEvent] = useState<EventId>(() => {
    const stored = localStorage.getItem('cuberoot-timer.event');
    const valid = EVENTS.some(e => e.id === stored);
    return valid ? (stored as EventId) : '333';
  });

  useEffect(() => {
    localStorage.setItem('cuberoot-timer.event', event);
  }, [event]);

  const sessionsForEvent = useMemo(
    () => sessions.filter(s => s.event === event),
    [sessions, event],
  );

  // Auto-create a session when the event has none. Functional updater + length
  // guard inside the setter prevents the race where two concurrent renders
  // both observe length === 0 and each create a session.
  useEffect(() => {
    if (sessionsForEvent.length > 0) return;
    setSessions(prev => {
      const have = prev.some(s => s.event === event);
      if (have) return prev;
      const fresh = newSession(event, isZh ? '会话 1' : 'Session 1');
      // Active id for the event is set in a paired setter below.
      setActive(prevActive => ({ ...prevActive, [event]: fresh.id }));
      return [...prev, fresh];
    });
  }, [event, isZh, sessionsForEvent.length]);

  const activeSessionId = active[event] ?? sessionsForEvent[0]?.id;
  const activeSession = useMemo(
    () => sessions.find(s => s.id === activeSessionId) ?? sessionsForEvent[0],
    [sessions, activeSessionId, sessionsForEvent],
  );

  const setActiveSession = useCallback((id: string) => {
    setActive(prev => ({ ...prev, [event]: id }));
  }, [event]);

  // ── Scramble ────────────────────────────────────────────────────
  // Effect-driven scramble: re-generate whenever the event changes. The
  // initial render uses `useState` with `generateScramble(event)` only via
  // `useEffect`, so no double-generate on mount.
  const [scramble, setScramble] = useState('');
  useEffect(() => {
    setScramble(generateScramble(event));
  }, [event]);
  const nextScramble = useCallback(() => {
    setScramble(generateScramble(event));
  }, [event]);

  // ── Solve recording ─────────────────────────────────────────────
  const [lastPenalty, setLastPenalty] = useState<Penalty | null>(null);
  const scrambleAtStartRef = useRef<string>(scramble);
  // Active session id, accessed from a stable record callback below.
  const activeSessionIdRef = useRef<string | undefined>(activeSession?.id);
  activeSessionIdRef.current = activeSession?.id;

  const recordSolve = useCallback((timeMs: number) => {
    const sid = activeSessionIdRef.current;
    if (!sid) return;
    const solve = makeSolve({
      timeMs,
      scramble: scrambleAtStartRef.current,
      event,
      penalty: 'ok',
    });
    setLastPenalty('ok');
    setSessions(prev => prev.map(s =>
      s.id === sid ? { ...s, solves: [...s.solves, solve] } : s,
    ));
    nextScramble();
  }, [event, nextScramble]);

  const timer = useTimer(recordSolve);

  // Capture the scramble the user actually solved against. Lock it in any phase
  // before the timer is running so quick "stopped → press → restart" flows
  // still record against the freshly generated scramble.
  useEffect(() => {
    if (timer.phase !== 'running') {
      scrambleAtStartRef.current = scramble;
    }
  }, [timer.phase, scramble]);

  // ── Keyboard / pointer wiring ───────────────────────────────────
  // The timer handle's onPressDown / onPressUp / reset are stable (built with
  // empty-ish deps inside useTimer), so we depend on those concrete callbacks
  // rather than the whole `timer` object — preventing re-attachment on every
  // displayMs tick.
  const { onPressDown, onPressUp, reset } = timer;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        onPressDown();
      } else if (e.code === 'Escape') {
        reset();
      }
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
  }, [onPressDown, onPressUp, reset]);

  // Touch handlers on the timer-center
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    onPressDown();
  }, [onPressDown]);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    onPressUp();
  }, [onPressUp]);

  // ── Solve actions (penalty, delete) ─────────────────────────────
  const updateSolve = useCallback((solveId: string, patch: Partial<Solve>) => {
    const sid = activeSessionIdRef.current;
    if (!sid) return;
    setSessions(prev => prev.map(s => {
      if (s.id !== sid) return s;
      return { ...s, solves: s.solves.map(sv => sv.id === solveId ? { ...sv, ...patch } : sv) };
    }));
  }, []);

  const deleteSolve = useCallback((solveId: string) => {
    const sid = activeSessionIdRef.current;
    if (!sid) return;
    setSessions(prev => prev.map(s => {
      if (s.id !== sid) return s;
      return { ...s, solves: s.solves.filter(sv => sv.id !== solveId) };
    }));
  }, []);

  // Quick-action: change penalty of last solve (the one we just recorded).
  const changeLastPenalty = useCallback((p: Penalty) => {
    const last = activeSession?.solves[activeSession.solves.length - 1];
    if (!last) return;
    updateSolve(last.id, { penalty: p });
    setLastPenalty(p);
  }, [activeSession, updateSolve]);

  const deleteLastSolve = useCallback(() => {
    const last = activeSession?.solves[activeSession.solves.length - 1];
    if (!last) return;
    if (!confirm(isZh ? '删除最后一次成绩？' : 'Delete last solve?')) return;
    deleteSolve(last.id);
    setLastPenalty(null);
  }, [activeSession, deleteSolve, isZh]);

  // ── Modal ───────────────────────────────────────────────────────
  const [modalSolve, setModalSolve] = useState<{ s: Solve; idx: number } | null>(null);

  // ── Session management ─────────────────────────────────────────
  const createSession = useCallback(() => {
    const name = prompt(isZh ? '新会话名称：' : 'New session name:', isZh ? `会话 ${sessionsForEvent.length + 1}` : `Session ${sessionsForEvent.length + 1}`);
    if (!name) return;
    const fresh = newSession(event, name);
    setSessions(prev => [...prev, fresh]);
    setActive(prev => ({ ...prev, [event]: fresh.id }));
  }, [event, isZh, sessionsForEvent.length]);

  const renameSession = useCallback(() => {
    if (!activeSession) return;
    const name = prompt(isZh ? '重命名会话：' : 'Rename session:', activeSession.name);
    if (!name) return;
    const sid = activeSession.id;
    setSessions(prev => prev.map(s => s.id === sid ? { ...s, name } : s));
  }, [activeSession, isZh]);

  const deleteSession = useCallback(() => {
    if (!activeSession) return;
    if (!confirm(
      isZh
        ? `删除会话「${activeSession.name}」及其所有 ${activeSession.solves.length} 次成绩？`
        : `Delete session "${activeSession.name}" and all ${activeSession.solves.length} solves?`,
    )) return;
    const sid = activeSession.id;
    setSessions(prev => prev.filter(s => s.id !== sid));
    setActive(prev => {
      const next = { ...prev };
      delete next[event];
      return next;
    });
  }, [activeSession, event, isZh]);

  const clearSession = useCallback(() => {
    if (!activeSession) return;
    if (!confirm(isZh ? `清空会话「${activeSession.name}」的所有成绩？` : `Clear all solves in "${activeSession.name}"?`)) return;
    const sid = activeSession.id;
    setSessions(prev => prev.map(s => s.id === sid ? { ...s, solves: [] } : s));
    setLastPenalty(null);
  }, [activeSession, isZh]);

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

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const ok = importJson(String(reader.result));
        if (!ok) {
          alert(isZh ? '导入失败：文件格式无效。' : 'Import failed: invalid file.');
          return;
        }
        const cur = loadAll();
        setSessions(cur.sessions);
        setActive(cur.active);
      };
      reader.readAsText(file);
    };
    input.click();
  }, [isZh]);

  // ── Render ──────────────────────────────────────────────────────
  const solves = activeSession?.solves ?? [];

  return (
    <div className="timer-root">
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
            {EVENTS.map(ev => (
              <option key={ev.id} value={ev.id}>{isZh ? ev.nameZh : ev.nameEn}</option>
            ))}
          </select>
          <select
            value={activeSession?.id ?? ''}
            onChange={(e) => setActiveSession(e.target.value)}
            title={isZh ? '会话' : 'Session'}
          >
            {sessionsForEvent.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.solves.length})
              </option>
            ))}
          </select>
          <button className="tb-btn" onClick={createSession} title={isZh ? '新建会话' : 'New session'}>
            <Plus size={14} />
          </button>
          <button className="tb-btn" onClick={renameSession} title={isZh ? '重命名' : 'Rename'}>
            <Edit2 size={14} />
          </button>
          <button
            className="tb-btn danger"
            onClick={deleteSession}
            title={isZh ? '删除会话' : 'Delete session'}
            disabled={sessionsForEvent.length <= 1}
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div className="right">
          <button className="tb-btn" onClick={handleImport} title={isZh ? '导入' : 'Import'}>
            <Upload size={14} />
          </button>
          <button className="tb-btn" onClick={handleExport} title={isZh ? '导出' : 'Export'}>
            <Download size={14} />
          </button>
          <button className="tb-btn" onClick={clearSession} title={isZh ? '清空当前会话' : 'Clear session'}>
            {isZh ? '清空' : 'Clear'}
          </button>
          <LangToggle />
        </div>
      </div>

      <div
        className="scramble-strip"
        onClick={nextScramble}
        title={isZh ? '点击换一个打乱' : 'Click to refresh'}
      >
        {scramble || <span className="scramble-empty">—</span>}
      </div>

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
          lastPenalty={timer.phase === 'stopped' ? lastPenalty : null}
        />
        {timer.phase === 'idle' && (
          <div className="timer-hint">
            {isZh
              ? <>按住 <code>空格</code> 进入准备，松开开始计时</>
              : <>Hold <code>Space</code> to ready, release to start</>}
          </div>
        )}
        {timer.phase === 'holding' && (
          <div className="timer-hint">
            {isZh ? '继续按住…' : 'Keep holding…'}
          </div>
        )}
        {timer.phase === 'ready' && (
          <div className="timer-hint">
            {isZh ? '准备好了！松开开始' : 'Ready! Release to go'}
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

      <div className="timer-bottom">
        <StatsPanel solves={solves} isZh={isZh} />
        <HistoryPanel
          solves={solves}
          isZh={isZh}
          onRowClick={(s, idx) => setModalSolve({ s, idx })}
        />
      </div>

      {modalSolve && (
        <SolveModal
          solve={modalSolve.s}
          index={modalSolve.idx}
          isZh={isZh}
          onClose={() => setModalSolve(null)}
          onChangePenalty={(p) => {
            updateSolve(modalSolve.s.id, { penalty: p });
            setModalSolve({ ...modalSolve, s: { ...modalSolve.s, penalty: p } });
            // If this is the last solve, also update lastPenalty so quick-action stays in sync.
            if (modalSolve.idx === solves.length - 1) setLastPenalty(p);
          }}
          onDelete={() => {
            deleteSolve(modalSolve.s.id);
            setModalSolve(null);
            if (modalSolve.idx === solves.length - 1) setLastPenalty(null);
          }}
        />
      )}
    </div>
  );
}
