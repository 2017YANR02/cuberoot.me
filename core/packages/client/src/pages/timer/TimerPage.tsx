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
  mutate,
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

  // Persist initial state if we filled in defaults.
  useEffect(() => {
    const cur = loadAll();
    if (cur.sessions.length === 0) {
      mutate(db => {
        db.sessions = sessions;
        db.active = active;
      });
    }
    // intentionally only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Auto-create a session when the event has none.
  useEffect(() => {
    if (sessionsForEvent.length === 0) {
      const fresh = newSession(event, isZh ? '会话 1' : 'Session 1');
      const next = [...sessions, fresh];
      setSessions(next);
      const newActive = { ...active, [event]: fresh.id };
      setActive(newActive);
      mutate(db => { db.sessions = next; db.active = newActive; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, sessionsForEvent.length]);

  const activeSessionId = active[event] ?? sessionsForEvent[0]?.id;
  const activeSession = useMemo(
    () => sessions.find(s => s.id === activeSessionId) ?? sessionsForEvent[0],
    [sessions, activeSessionId, sessionsForEvent],
  );

  const setActiveSession = useCallback((id: string) => {
    const next = { ...active, [event]: id };
    setActive(next);
    mutate(db => { db.active = next; });
  }, [active, event]);

  // ── Scramble ────────────────────────────────────────────────────
  const [scramble, setScramble] = useState(() => generateScramble(event));
  const nextScramble = useCallback(() => {
    setScramble(generateScramble(event));
  }, [event]);

  // Regenerate scramble whenever event changes.
  useEffect(() => {
    setScramble(generateScramble(event));
  }, [event]);

  // ── Solve recording ─────────────────────────────────────────────
  const [lastPenalty, setLastPenalty] = useState<Penalty | null>(null);
  const scrambleAtStartRef = useRef<string>(scramble);

  const recordSolve = useCallback((timeMs: number) => {
    if (!activeSession) return;
    const solve = makeSolve({
      timeMs,
      scramble: scrambleAtStartRef.current,
      event,
      penalty: 'ok',
    });
    setLastPenalty('ok');
    const next = sessions.map(s =>
      s.id === activeSession.id ? { ...s, solves: [...s.solves, solve] } : s,
    );
    setSessions(next);
    mutate(db => { db.sessions = next; });
    nextScramble();
  }, [activeSession, sessions, event, nextScramble]);

  const timer = useTimer(recordSolve);

  // Capture the scramble the user actually solved against, before pressing space.
  useEffect(() => {
    if (timer.phase === 'holding' || timer.phase === 'idle') {
      scrambleAtStartRef.current = scramble;
    }
  }, [timer.phase, scramble]);

  // ── Keyboard / pointer wiring ───────────────────────────────────
  // We bind to the whole document so the user can type from anywhere on the page.
  // Repeat keys are filtered (a held-down spacebar fires keydown repeatedly).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      // Allow inputs (modal etc.) to type without triggering timer.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        timer.onPressDown();
      } else if (e.code === 'Escape') {
        // Cancel current solve attempt
        timer.reset();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        timer.onPressUp();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [timer]);

  // Touch handlers on the timer-center
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    timer.onPressDown();
  }, [timer]);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    timer.onPressUp();
  }, [timer]);
  const onMouseDown = useCallback(() => {
    timer.onPressDown();
  }, [timer]);
  const onMouseUp = useCallback(() => {
    timer.onPressUp();
  }, [timer]);

  // ── Solve actions (penalty, delete) ─────────────────────────────
  const updateSolve = useCallback((solveId: string, patch: Partial<Solve>) => {
    if (!activeSession) return;
    const next = sessions.map(s => {
      if (s.id !== activeSession.id) return s;
      return { ...s, solves: s.solves.map(sv => sv.id === solveId ? { ...sv, ...patch } : sv) };
    });
    setSessions(next);
    mutate(db => { db.sessions = next; });
  }, [activeSession, sessions]);

  const deleteSolve = useCallback((solveId: string) => {
    if (!activeSession) return;
    const next = sessions.map(s => {
      if (s.id !== activeSession.id) return s;
      return { ...s, solves: s.solves.filter(sv => sv.id !== solveId) };
    });
    setSessions(next);
    mutate(db => { db.sessions = next; });
  }, [activeSession, sessions]);

  // Quick-action: change penalty of last solve (the one we just recorded).
  const changeLastPenalty = useCallback((p: Penalty) => {
    if (!activeSession) return;
    const last = activeSession.solves[activeSession.solves.length - 1];
    if (!last) return;
    updateSolve(last.id, { penalty: p });
    setLastPenalty(p);
  }, [activeSession, updateSolve]);

  const deleteLastSolve = useCallback(() => {
    if (!activeSession) return;
    const last = activeSession.solves[activeSession.solves.length - 1];
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
    const next = [...sessions, fresh];
    setSessions(next);
    const newActive = { ...active, [event]: fresh.id };
    setActive(newActive);
    mutate(db => { db.sessions = next; db.active = newActive; });
  }, [active, event, isZh, sessions, sessionsForEvent.length]);

  const renameSession = useCallback(() => {
    if (!activeSession) return;
    const name = prompt(isZh ? '重命名会话：' : 'Rename session:', activeSession.name);
    if (!name) return;
    const next = sessions.map(s => s.id === activeSession.id ? { ...s, name } : s);
    setSessions(next);
    mutate(db => { db.sessions = next; });
  }, [activeSession, isZh, sessions]);

  const deleteSession = useCallback(() => {
    if (!activeSession) return;
    if (!confirm(
      isZh
        ? `删除会话「${activeSession.name}」及其所有 ${activeSession.solves.length} 次成绩？`
        : `Delete session "${activeSession.name}" and all ${activeSession.solves.length} solves?`,
    )) return;
    const next = sessions.filter(s => s.id !== activeSession.id);
    setSessions(next);
    const newActive = { ...active };
    delete newActive[event];
    setActive(newActive);
    mutate(db => { db.sessions = next; db.active = newActive; });
  }, [active, activeSession, event, isZh, sessions]);

  const clearSession = useCallback(() => {
    if (!activeSession) return;
    if (!confirm(isZh ? `清空会话「${activeSession.name}」的所有成绩？` : `Clear all solves in "${activeSession.name}"?`)) return;
    const next = sessions.map(s => s.id === activeSession.id ? { ...s, solves: [] } : s);
    setSessions(next);
    mutate(db => { db.sessions = next; });
    setLastPenalty(null);
  }, [activeSession, isZh, sessions]);

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
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
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
