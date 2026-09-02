'use client';

import { Check } from 'lucide-react';
import type { SmartCubeScrambleHint } from '@cuberoot/shared/smart-cube/scramble-hint';
import type { TimerScrambleStatusKind } from '@cuberoot/shared/timer';
import {
  Fragment,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export type TimerScrambleHint = SmartCubeScrambleHint;

export interface TimerScrambleVerificationLabels {
  copiedCorrection: string;
  correction: string;
  correctionTitle: string;
  mismatch: string;
  ready: string;
}

export interface TimerScrambleNonOptimalLabel {
  label: string;
  title: string;
}

interface TimerScrambleStatusBaseProps {
  kind: TimerScrambleStatusKind;
  message: ReactNode;
}

export type TimerScrambleStatusProps = TimerScrambleStatusBaseProps & (
  | Readonly<{ onRetry: () => void; retryLabel: string }>
  | Readonly<{ onRetry?: never; retryLabel?: never }>
);

export interface TimerScrambleStripProps {
  children?: ReactNode;
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
  scramble: string;
  status?: TimerScrambleStatusProps;
  title?: string;
  verificationLabels: TimerScrambleVerificationLabels;
}

export interface TimerScrambleHintTextProps {
  hint: TimerScrambleHint;
  tailExtra?: ReactNode;
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
        const node = <span className="scramble-move" data-hint={state}>{move}</span>;
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
  scramble,
  status,
  title,
  verificationLabels,
}: TimerScrambleStripProps) {
  const liveHint = hint && !hint.complete ? hint : null;
  const copiedCheck = copied && !correctionActive
    ? <Check className="scramble-copied-check" aria-label={copiedLabel} />
    : null;
  const style = { '--scramble-scale': fontScale } as CSSProperties;

  const stripActivate = status?.onRetry ? undefined : onActivate;
  const activateFromKeyboard = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.target !== event.currentTarget
      || !stripActivate
      || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    stripActivate();
  };

  return (
    <div
      aria-busy={status?.kind === 'loading' ? 'true' : undefined}
      className={`scramble-strip sf-${font}${compact ? ' compact' : ''}${className ? ` ${className}` : ''}`}
      data-scramble-match={match === null ? undefined : match ? 'ok' : 'off'}
      data-interactive={stripActivate ? 'true' : undefined}
      style={style}
      title={title}
    >
      <span
        className="scramble-text"
        onClick={stripActivate}
        onKeyDown={activateFromKeyboard}
        role={stripActivate ? 'button' : undefined}
        tabIndex={stripActivate ? 0 : undefined}
      >
        {scramble
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
            : fallback}
      </span>

      {liveHint
        ? correctionActive && (
            <>
              <span
                className="scramble-verify"
                data-ok="fix"
                title={verificationLabels.correctionTitle}
              >
                {verificationLabels.correction}
              </span>
              {copied && (
                <span className="scramble-verify" data-ok="true">
                  {verificationLabels.copiedCorrection}
                </span>
              )}
            </>
          )
        : match !== null && (
            <span className="scramble-verify" data-ok={match ? 'true' : 'false'}>
              {match ? verificationLabels.ready : verificationLabels.mismatch}
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
}: TimerScrambleStatusProps) {
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
  const head = splitAt >= 0 ? scramble.slice(0, splitAt + 1) : '';
  const tail = splitAt >= 0 ? scramble.slice(splitAt + 1) : scramble;
  return <>{head}<span className="scramble-copied-tail">{tail}{tailExtra}</span></>;
}
