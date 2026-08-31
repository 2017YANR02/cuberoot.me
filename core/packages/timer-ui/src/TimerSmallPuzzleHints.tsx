import type {
  TimerPhase,
  TimerSmallHintEvent,
  TimerSmallPuzzleHintCopy,
} from '@cuberoot/shared/timer';
import {
  solveTimerSmallHints,
  type TimerSmallHintResult,
} from '@cuberoot/puzzle-solvers/timer-small-hints';
import { ChevronRight, Star } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';

export interface TimerSmallPuzzleHintsProps {
  readonly event: TimerSmallHintEvent;
  readonly labels: TimerSmallPuzzleHintCopy;
  readonly phase?: TimerPhase;
  readonly scramble: string;
}

type HintStatus = 'idle' | 'loading' | 'ready' | 'error';

export function TimerSmallPuzzleHints({
  event,
  labels,
  phase = 'idle',
  scramble,
}: TimerSmallPuzzleHintsProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<HintStatus>('idle');
  const [result, setResult] = useState<TimerSmallHintResult | null>(null);
  const bodyId = useId();
  const cacheKey = useMemo(() => `${event}::${scramble}`, [event, scramble]);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setStatus('idle');
      return;
    }
    setResult(null);
    setStatus('loading');
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const next = solveTimerSmallHints(event, scramble);
        if (!cancelled) {
          setResult(next);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cacheKey, event, open, scramble]);

  const minFaceLength = useMemo(() => {
    if (!result || result.faces.length === 0) return null;
    const solved = result.faces
      .map((face) => face.moves.length)
      .filter((length) => length > 0);
    return solved.length > 0 ? Math.min(...solved) : null;
  }, [result]);

  const timing = phase === 'running';

  return (
    <div className="timer-small-hints" data-timing={timing ? 'true' : undefined} data-no-timer>
      <button
        aria-controls={bodyId}
        aria-expanded={open}
        className="timer-small-hints-trigger"
        disabled={timing}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{labels.title}</span>
        <ChevronRight aria-hidden="true" className="timer-small-hints-chevron" data-open={open ? 'true' : undefined} size={13} />
      </button>

      {open && (
        <div
          aria-busy={status === 'loading'}
          className="timer-small-hints-body"
          id={bodyId}
        >
          {status === 'loading' && (
            <p className="timer-small-hints-status" role="status">{labels.computing}</p>
          )}
          {status === 'error' && (
            <p className="timer-small-hints-status" role="alert">{labels.failed}</p>
          )}
          {status === 'ready' && result && (
            <>
              <div className="timer-small-hints-row is-best">
                <span className="timer-small-hints-label">
                  <Star aria-hidden="true" size={12} />
                  {labels.fullSolve}
                </span>
                <span className="timer-small-hints-count">{result.full.length}</span>
                <code className="timer-small-hints-alg">
                  {result.full.moves.length > 0 ? result.full.moves.join(' ') : labels.alreadySolved}
                </code>
              </div>
              <p className="timer-small-hints-section">{labels.perFace}</p>
              {result.faces.map((face) => {
                const best = face.moves.length > 0 && face.moves.length === minFaceLength;
                return (
                  <div className={`timer-small-hints-row${best ? ' is-best' : ''}`} key={face.face}>
                    <span className="timer-small-hints-label">
                      {best && <Star aria-hidden="true" size={11} />}
                      {face.face}
                    </span>
                    <span className="timer-small-hints-count">
                      {face.moves.length > 0 ? face.moves.length : '—'}
                    </span>
                    <code className="timer-small-hints-alg">
                      {face.moves.length > 0 ? face.moves.join(' ') : labels.noSolution}
                    </code>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
