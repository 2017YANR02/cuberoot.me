/**
 * /timer — TypeScript reimplementation of csTimer's core flow.
 *
 * v2 (no sessions): solves are stored as a flat list per event id. Switch the
 * event picker to change the visible list. To clear a list, use the toolbar
 * "Clear" action.
 *
 * Round 2 will fold in: inspection time + audio cues, hidden-time mode,
 * settings panel (theme/colors/font/sounds), σ/CV%/ao50/ao1000, comment per
 * solve, fullscreen + mobile touch, keyboard shortcuts (digit nav / Z undo /
 * Enter for comment / +2 / DNF / del modifiers), and integrating Round 1
 * outputs (cube preview, charts, Kociemba, expanded events, cstimer-JSON
 * import).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Home, Download, Upload, Trash2 } from 'lucide-react';
import LangToggle from '../../components/LangToggle';

import { generateScramble } from './scramble';
import { useTimer } from './useTimer';
import type { EventId, Penalty, Solve } from './types';
import { EVENTS } from './types';
import {
  loadAll,
  saveAll,
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

  // ── State: per-event solve lists ────────────────────────────────
  const [byEvent, setByEvent] = useState<Record<string, Solve[]>>(() => loadAll());

  // Persist whenever data changes — single source of truth for writes.
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

  // ── Scramble ────────────────────────────────────────────────────
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

  const recordSolve = useCallback((timeMs: number) => {
    const solve = makeSolve({
      timeMs,
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
  }, [event, nextScramble]);

  const timer = useTimer(recordSolve);

  // Lock in the scramble the user is about to solve. Updated in any phase
  // before the timer is actually running.
  useEffect(() => {
    if (timer.phase !== 'running') {
      scrambleAtStartRef.current = scramble;
    }
  }, [timer.phase, scramble]);

  // ── Keyboard wiring (stable callbacks → no listener thrash) ─────
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

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
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
    if (!confirm(isZh
      ? `清空当前项目「${EVENTS.find(e => e.id === event)?.nameZh}」的所有 ${solves.length} 次成绩？`
      : `Clear all ${solves.length} solves of "${EVENTS.find(e => e.id === event)?.nameEn}"?`,
    )) return;
    setByEvent(prev => ({ ...prev, [event]: [] }));
    setLastPenalty(null);
  }, [event, isZh, solves.length]);

  // ── Modal ───────────────────────────────────────────────────────
  const [modalSolve, setModalSolve] = useState<{ s: Solve; idx: number } | null>(null);

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
        setByEvent(loadAll());
      };
      reader.readAsText(file);
    };
    input.click();
  }, [isZh]);

  // ── Render ──────────────────────────────────────────────────────
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
          <button className="tb-btn" onClick={handleImport} title={isZh ? '导入' : 'Import'}>
            <Upload size={14} />
          </button>
          <button className="tb-btn" onClick={handleExport} title={isZh ? '导出' : 'Export'}>
            <Download size={14} />
          </button>
          <button
            className="tb-btn danger"
            onClick={clearAll}
            disabled={!solves.length}
            title={isZh ? '清空' : 'Clear'}
          >
            <Trash2 size={14} />
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
            {isZh ? <>按住 <code>空格</code> 进入准备，松开开始计时</> : <>Hold <code>Space</code> to ready, release to start</>}
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
