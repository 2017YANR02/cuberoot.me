'use client';

// 3BLD 练习计时器 (simple BLD timer) — destination of the edge-float "练习计时"
// handoff. Reads the scramble list written to localStorage by FloatTrainer
// (BLD_TIMER_SCRAMBLES_KEY), shows the current scramble + a big spacebar-hold /
// touch timer, records each time, and advances to the next scramble on stop.
//
// Faithful to the upstream timer.html/clock.js intent (hold-to-ready, release to
// start, press to stop) but implemented with the project's useSpaceHoldTimer +
// formatMs, and a self-contained state machine (NO AlgCase / trainer-store
// coupling). State values follow the useSpaceHoldTimer numeric contract:
//   0 NOT_RUNNING / 1 AWAITING_READY / 2 READY / 3 RUNNING / 4 STOPPING.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
} from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSpaceHoldTimer } from '@/hooks/useSpaceHoldTimer';
import { formatMs } from '../../_components/trainer-components';
import { BLD_TIMER_SCRAMBLES_KEY } from '../_components/FloatTrainer';
import '../3bld.css';

const NOT_RUNNING = 0;
const AWAITING_READY = 1;
const READY = 2;
const RUNNING = 3;
const STOPPING = 4;

// Hold duration before the timer arms (matches upstream timer.js 400ms hold).
const HOLD_MS = 400;

interface Solve {
  ms: number;
  scramble: string;
}

export default function BldTimerPage(): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('盲拧练习计时', 'BLD Practice Timer');

  const [scrambles, setScrambles] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [solves, setSolves] = useState<Solve[]>([]);

  const [timerState, setTimerState] = useState(NOT_RUNNING);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [lastMs, setLastMs] = useState(0);

  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the handed-off scramble list on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BLD_TIMER_SCRAMBLES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setScrambles(parsed.filter((s): s is string => typeof s === 'string'));
        }
      }
    } catch {
      /* corrupt / unavailable storage — start empty */
    }
  }, []);

  // rAF clock while running.
  useEffect(() => {
    if (timerState !== RUNNING) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timerState]);

  const clearHold = useCallback(() => {
    if (holdTimeout.current) {
      clearTimeout(holdTimeout.current);
      holdTimeout.current = null;
    }
  }, []);

  // ── state machine driving useSpaceHoldTimer ──
  const getTimerReady = useCallback((delayMs: number) => {
    setTimerState(AWAITING_READY);
    clearHold();
    holdTimeout.current = setTimeout(() => {
      setTimerState((s) => (s === AWAITING_READY ? READY : s));
    }, delayMs);
  }, [clearHold]);

  const startTimer = useCallback(() => {
    clearHold();
    const t = Date.now();
    setStartedAt(t);
    setNow(t);
    setTimerState(RUNNING);
  }, [clearHold]);

  const advance = useCallback(() => {
    setIdx((i) => (scrambles.length > 0 ? (i + 1) % scrambles.length : 0));
  }, [scrambles.length]);

  const stopTimer = useCallback(() => {
    const elapsed = Date.now() - startedAt;
    setLastMs(elapsed);
    setSolves((prev) => [
      ...prev,
      { ms: elapsed, scramble: scrambles[idx] ?? '' },
    ]);
    setTimerState(STOPPING);
    advance();
  }, [startedAt, scrambles, idx, advance]);

  const setNotRunning = useCallback(() => {
    clearHold();
    setTimerState(NOT_RUNNING);
  }, [clearHold]);

  const { onTouchStart, onTouchEnd } = useSpaceHoldTimer({
    state: timerState,
    delayMs: HOLD_MS,
    getTimerReady,
    startTimer,
    stopTimer,
    setNotRunning,
  });

  useEffect(() => () => clearHold(), [clearHold]);

  const displayMs =
    timerState === RUNNING ? now - startedAt :
    timerState === READY || timerState === AWAITING_READY ? 0 :
    lastMs;

  const stateCls =
    timerState === AWAITING_READY ? 'is-awaiting' :
    timerState === READY ? 'is-ready' :
    timerState === RUNNING ? 'is-running' :
    timerState === STOPPING ? 'is-stopping' :
    'is-idle';

  const idle = timerState === NOT_RUNNING || timerState === STOPPING;

  const currentScramble = scrambles[idx] ?? '';

  const goPrev = () => {
    if (!idle || scrambles.length === 0) return;
    setIdx((i) => (i - 1 + scrambles.length) % scrambles.length);
  };
  const goNext = () => {
    if (!idle || scrambles.length === 0) return;
    advance();
  };

  const clearSolves = () => {
    if (typeof window !== 'undefined' && !window.confirm(isZh ? '清空所有成绩?' : 'Clear all solves?')) return;
    setSolves([]);
    setLastMs(0);
  };

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>{isZh ? '盲拧练习计时' : 'BLD Practice Timer'}</h1>
        <span className="bld-spacer" />
        <Link href="/trainer/3bld/edge-float" className="bld-btn">
          {isZh ? '返回浮动训练' : 'Back to float trainer'}
        </Link>
      </div>

      {scrambles.length === 0 ? (
        <div className="bld-section">
          <div className="bld-scramble-empty">
            {isZh
              ? '暂无打乱。请先在「棱块浮动训练」生成打乱并点击「练习计时」。'
              : 'No scrambles loaded. Generate scrambles in the Edge Float trainer and click "Practice timer".'}
          </div>
        </div>
      ) : (
        <>
          <div
            className="bld-timer-stage"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="bld-timer-scr-head">
              <button
                type="button"
                className="bld-timer-nav"
                onClick={goPrev}
                disabled={!idle}
                aria-label={isZh ? '上一条' : 'Previous'}
              >
                <ChevronLeft size={18} />
              </button>
              <span className="bld-timer-counter">
                {idx + 1} / {scrambles.length}
              </span>
              <button
                type="button"
                className="bld-timer-nav"
                onClick={goNext}
                disabled={!idle}
                aria-label={isZh ? '下一条' : 'Next'}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="bld-timer-scramble">{currentScramble}</div>

            <div className={`bld-timer-display ${stateCls}`}>
              {formatMs(displayMs)}
            </div>

            <div className="bld-timer-help">
              {isZh
                ? '按住空格 / 长按屏幕预备，松开开始,再按停止。'
                : 'Hold Space / touch to ready, release to start, press to stop.'}
            </div>
          </div>

          <div className="bld-section bld-timer-results">
            <div className="bld-helper-row-head">
              <span className="bld-section-title">
                {isZh ? '成绩' : 'Results'} ({solves.length})
              </span>
              {solves.length > 0 && (
                <button type="button" className="bld-btn bld-btn-ghost bld-helper-random" onClick={clearSolves}>
                  <Trash2 size={14} />
                  {isZh ? '清空' : 'Clear'}
                </button>
              )}
            </div>

            {solves.length === 0 ? (
              <div className="bld-scramble-empty">{isZh ? '暂无成绩' : 'No solves yet'}</div>
            ) : (
              <ol className="bld-scramble-list">
                {solves.map((s, i) => (
                  <li key={i} className="bld-scramble-item">
                    <span className="bld-scramble-idx">{i + 1}.</span>
                    <span className="bld-scramble-text" style={{ fontWeight: 700 }}>
                      {formatMs(s.ms)}
                    </span>
                    <span className="bld-spacer" />
                    <span className="bld-scramble-text" style={{ opacity: 0.7, flex: '1 1 100%' }}>
                      {s.scramble}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="bld-section">
            <button
              type="button"
              className="bld-btn"
              onClick={() => {
                setIdx(0);
                setLastMs(0);
              }}
              disabled={!idle}
            >
              <RotateCcw size={15} />
              {isZh ? '回到第一条' : 'Back to first'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
