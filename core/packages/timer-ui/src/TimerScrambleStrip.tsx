'use client';

import './scramble-hint.css';

import { Check } from 'lucide-react';
import type { SmartCubeScrambleHint } from '@cuberoot/shared/smart-cube/scramble-hint';
import type { TimerScrambleStatusKind } from '@cuberoot/shared/timer';
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export type TimerScrambleHint = SmartCubeScrambleHint;

export interface TimerScrambleVerificationLabels {
  copiedCorrection: string;
  /** Legacy host labels, retained for compatibility but no longer displayed. */
  correction?: string;
  correctionTitle?: string;
  mismatch?: string;
  ready?: string;
}

export interface TimerScrambleNonOptimalLabel {
  label: string;
  title: string;
}

interface TimerScrambleStatusBaseProps {
  kind: TimerScrambleStatusKind;
  message: ReactNode;
  /** Offer an explicit alternative after this empty slot has waited long enough. */
  delayedAction?: Readonly<{
    key: string;
    delayMs: number;
    label: string;
    onSelect: () => void;
  }>;
}

export type TimerScrambleStatusProps = TimerScrambleStatusBaseProps & (
  | Readonly<{ onRetry: () => void; retryLabel: string }>
  | Readonly<{ onRetry?: never; retryLabel?: never }>
);

export interface TimerScrambleStripProps {
  children?: ReactNode;
  editor?: ReactNode;
  className?: string;
  compact?: boolean;
  copied?: boolean;
  copiedLabel: string;
  correctionActive?: boolean;
  fallback?: ReactNode;
  fallbackKind?: 'custom' | 'empty';
  font?: 'lcd' | 'liberation' | 'mono' | 'sans';
  fontScale?: number;
  hint?: TimerScrambleHint | null;
  match?: boolean | null;
  nonOptimal?: TimerScrambleNonOptimalLabel;
  onActivate?: () => void;
  /** Plain scramble presses use the surrounding timer's existing input path. */
  timingEnabled?: boolean;
  scramble: string;
  status?: TimerScrambleStatusProps;
  title?: string;
  verificationLabels: TimerScrambleVerificationLabels;
}

export interface TimerScrambleHintTextProps {
  hint: TimerScrambleHint;
  tailExtra?: ReactNode;
}

function ScrambleMove({ move, state }: { move: string; state: 'done' | 'current' | 'pending' }) {
  const previous = useRef(state);
  const completing = useRef(false);
  if (previous.current !== state) {
    completing.current = previous.current === 'current' && state === 'done';
  }
  useLayoutEffect(() => { previous.current = state; }, [state]);
  return <span className="scramble-move" data-hint={state} data-completing={completing.current || undefined}>{move}</span>;
}

/**
 * The canonical move-by-move scramble text. Keeping the final move and copied
 * check in one relative wrapper means feedback never creates a new wrap point.
 */
export function TimerScrambleHintText({ hint, tailExtra }: TimerScrambleHintTextProps) {
  const moves: Array<{ move: string; state: 'done' | 'current' | 'pending' }> = [
    ...hint.done.map((move) => ({ move, state: 'done' as const })),
    ...(hint.current === null ? [] : [{ move: hint.current, state: 'current' as const }]),
    ...hint.pending.map((move) => ({ move, state: 'pending' as const })),
  ];

  return (
    <>
      {moves.map(({ move, state }, index) => {
        const isLast = index === moves.length - 1;
        const node = <ScrambleMove move={move} state={state} />;
        return (
          <Fragment key={`${index}:${move}`}>
            {index > 0 ? ' ' : null}
            {isLast
              ? <span className="scramble-copied-tail">{node}{tailExtra}</span>
              : node}
          </Fragment>
        );
      })}
    </>
  );
}

/**
 * Cross-platform scramble presentation. Hosts own generation, clipboard and
 * smart-cube state; this component owns the exact DOM, wrapping, font tiers,
 * move highlighting, empty slot and copy/match feedback.
 */
export function TimerScrambleStrip({
  children,
  editor,
  className,
  compact = false,
  copied = false,
  copiedLabel,
  correctionActive = false,
  fallback = '—',
  fallbackKind = 'empty',
  font = 'liberation',
  fontScale = 1,
  hint,
  match = null,
  nonOptimal,
  onActivate,
  timingEnabled = true,
  scramble,
  status,
  title,
  verificationLabels,
}: TimerScrambleStripProps) {
  // Keep the final completed move mounted when guidance reports a match, so
  // its feedback can finish before the timer starts or the scramble changes.
  const previousHint = useRef<{ scramble: string; hint: TimerScrambleHint } | null>(null);
  if (previousHint.current?.scramble !== scramble) previousHint.current = null;
  if (hint && !hint.complete) previousHint.current = { scramble, hint };
  else if (match !== true) previousHint.current = null;
  const previous = previousHint.current?.hint;
  const completedMoves = previous && [...previous.done, ...(previous.current === null ? [] : [previous.current]), ...previous.pending];
  const completedHint = match === true && completedMoves && completedMoves.join(' ') === scramble.trim().replace(/\s+/g, ' ')
    ? { done: completedMoves, current: null, pending: [], complete: true }
    : null;
  const liveHint = hint && !hint.complete ? hint : completedHint;
  const copiedCheck = copied && !correctionActive
    ? <Check className="scramble-copied-check" aria-label={copiedLabel} />
    : null;
  // Preserve the user's preferred size for short scrambles; reduce long ones
  // smoothly instead of making the move list an independently scrolling view.
  const displayedScramble = liveHint
    ? [...liveHint.done, ...(liveHint.current === null ? [] : [liveHint.current]), ...liveHint.pending].join(' ')
    : scramble;
  const lengthScale = Math.min(1, Math.sqrt(80 / Math.max(1, displayedScramble.length)));
  const style = {
    '--scramble-scale': fontScale,
    '--scramble-length-scale': lengthScale,
  } as CSSProperties;

  const stripActivate = editor || status?.onRetry || status?.delayedAction ? undefined : onActivate;
  const activateFromKeyboard = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.target !== event.currentTarget
      || !stripActivate
      || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    event.stopPropagation();
    stripActivate();
  };

  return (
    <div
      aria-busy={status?.kind === 'loading' ? 'true' : undefined}
      className={`scramble-strip sf-${font}${compact ? ' compact' : ''}${className ? ` ${className}` : ''}`}
      data-scramble-match={match === null ? undefined : match ? 'ok' : 'off'}
      data-interactive={stripActivate ? 'true' : undefined}
      data-no-timer={!!editor || !timingEnabled || stripActivate || status ? true : undefined}
      style={style}
      title={title}
    >
      <span
        className="scramble-text"
        onClick={stripActivate}
        onKeyDown={activateFromKeyboard}
        onKeyUp={(event) => {
          if (stripActivate && (event.key === 'Enter' || event.key === ' ')) event.stopPropagation();
        }}
        role={stripActivate ? 'button' : undefined}
        tabIndex={stripActivate ? 0 : undefined}
      >
        {editor ?? (scramble
          ? <>
              <span className="scramble-moves">
                {liveHint
                  ? <TimerScrambleHintText hint={liveHint} tailExtra={copiedCheck} />
                  : <TimerScramblePlainText scramble={scramble} tailExtra={copiedCheck} />}
              </span>
              {nonOptimal && (
                <span className="scramble-nonopt" data-no-timer title={nonOptimal.title}>
                  {nonOptimal.label}
                </span>
              )}
            </>
          : status
            ? <TimerScrambleStatus {...status} />
          : fallbackKind === 'empty'
            ? <span className="scramble-empty">{fallback}</span>
            : fallback)}
      </span>

      {liveHint && correctionActive && copied && (
        <span className="scramble-verify" data-ok="true">
          {verificationLabels.copiedCorrection}
        </span>
      )}

      {children}
    </div>
  );
}

/** The single loading/error/empty surface used by Web and installed clients. */
export function TimerScrambleStatus({
  kind,
  message,
  onRetry,
  retryLabel,
  delayedAction,
}: TimerScrambleStatusProps) {
  const [elapsedKey, setElapsedKey] = useState<string | null>(null);
  const actionKey = delayedAction?.key;
  const delayMs = delayedAction?.delayMs;
  useEffect(() => {
    setElapsedKey(null);
    if (kind !== 'loading' || actionKey === undefined || delayMs === undefined) return;
    const timeout = setTimeout(() => setElapsedKey(actionKey), delayMs);
    return () => clearTimeout(timeout);
  }, [kind, actionKey, delayMs]);

  return (
    <span className={`scramble-status is-${kind}`}>
      <span
        aria-live={kind === 'error' || kind === 'unsupported' ? undefined : 'polite'}
        className="scramble-status-message"
        role={kind === 'error' || kind === 'unsupported' ? 'alert' : 'status'}
      >
        {kind === 'loading' && <span aria-hidden="true" className="scramble-status-spinner" />}
        <span>{message}</span>
      </span>
      {onRetry && retryLabel && (
        <button
          className="scramble-status-retry"
          data-no-timer
          onClick={(event) => {
            event.stopPropagation();
            onRetry();
          }}
          type="button"
        >{retryLabel}</button>
      )}
      {kind === 'loading' && delayedAction && elapsedKey === delayedAction.key && (
        <button
          className="scramble-status-retry"
          data-no-timer
          onClick={(event) => {
            event.stopPropagation();
            delayedAction.onSelect();
          }}
          type="button"
        >{delayedAction.label}</button>
      )}
    </span>
  );
}

function TimerScramblePlainText({
  scramble,
  tailExtra,
}: {
  scramble: string;
  tailExtra?: ReactNode;
}) {
  const splitAt = scramble.lastIndexOf(' ');
  if (splitAt < 0) return <>{scramble}{tailExtra}</>;
  const head = scramble.slice(0, splitAt + 1);
  const tail = scramble.slice(splitAt + 1);
  return <>{head}<span className="scramble-copied-tail">{tail}{tailExtra}</span></>;
}
