'use client';

/**
 * RoundPanel — inline pill row for the round simulation.
 *
 * Purely presentational: props in, callbacks out. It reads no settings, no
 * storage and no URL state; the caller owns `config`, the round's solve slice
 * and the target. Renders nothing when the round sim is off.
 *
 *   2/5 · ao5 · in progress 9.12 · BPA 8.44 / WPA 10.31 · beat 9.50: need ≤ 9.87
 *
 * Visual language is GoalProgress's pill (same geometry: inline-flex, 3px 10px,
 * 999px radius, 12px mono, tabular-nums) with the hardcoded rgba/hex swapped
 * for theme tokens. It sits inside `.shell-undersurface` next to that pill, so
 * it deliberately has no card of its own.
 */

import { RotateCcw } from 'lucide-react';
import { timerRoundProgress, type Solve, type EventId, type RoundConfig, type TimerSettingCopy } from '@cuberoot/shared/timer';

export interface RoundPanelProps {
  localize(copy: TimerSettingCopy): string;
  /** The round's attempts, oldest → newest — the slice for THIS round only. */
  solves: Solve[];
  /** Round configuration. Renders nothing while `config.on` is false. */
  config: RoundConfig;
  /** Target to chase, in ms. null / undefined hides the target pill. */
  targetMs?: number | null;
  /** Event id — only used to render FMC as move counts. */
  event?: EventId;
  /** Time precision, matching `settings.precision`. Defaults to 2 (cs). */
  precision?: 0 | 1 | 2 | 3;
  /** Shown as a "new round" button once the round is over. Omit to hide it. */
  onReset?: () => void;
}

type Tone = 'muted' | 'info' | 'success' | 'warn';

const TONES: Record<Tone, { border: string; background: string; color: string }> = {
  muted: {
    border: 'color-mix(in srgb, var(--foreground) 18%, transparent)',
    background: 'var(--shell-chip, color-mix(in srgb, var(--foreground) 5%, transparent))',
    color: 'var(--muted-foreground)',
  },
  info: {
    border: 'color-mix(in srgb, var(--signal-info) 35%, transparent)',
    background: 'color-mix(in srgb, var(--signal-info) 8%, transparent)',
    color: 'var(--foreground)',
  },
  success: {
    border: 'color-mix(in srgb, var(--signal-success) 55%, transparent)',
    background: 'color-mix(in srgb, var(--signal-success) 12%, transparent)',
    color: 'var(--signal-success)',
  },
  warn: {
    border: 'color-mix(in srgb, var(--signal-warning) 55%, transparent)',
    background: 'color-mix(in srgb, var(--signal-warning) 12%, transparent)',
    color: 'var(--signal-warning)',
  },
};

function pillStyle(tone: Tone): React.CSSProperties {
  const t = TONES[tone];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 10px',
    borderRadius: 999,
    border: `1px solid ${t.border}`,
    background: t.background,
    color: t.color,
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    lineHeight: 1.2,
    fontVariantNumeric: 'tabular-nums',
    // CJK labels must never be clipped or wrapped mid-token on a phone; the
    // row wraps between pills instead (see the wrapper's flexWrap).
    whiteSpace: 'nowrap',
    maxWidth: 'max-content',
  };
}

export function TimerRoundPanel({
  localize: tr,
  solves,
  config,
  targetMs = null,
  event,
  precision = 2,
  onReset,
}: RoundPanelProps) {
  const panel = timerRoundProgress(solves, config, targetMs, event, precision, tr);
  if (!panel) return null;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, margin: '6px 0', flexWrap: 'wrap' }}>
      <span style={pillStyle(panel.tone)} title={panel.title}>
        <span>{panel.count}</span>
        <span style={{ opacity: 0.75 }}>{panel.format}</span>
        <span style={{ opacity: 0.75 }}>{panel.status}</span>
        <span>{panel.value}</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }} title={panel.attemptsTitle}>
        {panel.attempts.map(attempt => (
          <span key={attempt.index} title={attempt.title || undefined} style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.2,
            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
            color: attempt.overLimit ? 'var(--destructive)' : attempt.state === 'done' ? 'var(--foreground)' : 'var(--faint-foreground)',
            opacity: attempt.state === 'ineligible' ? 0.55 : undefined,
            textDecoration: attempt.state === 'ineligible' ? 'line-through' : undefined,
          }}>{attempt.value}</span>
        ))}
      </span>
      {panel.projection && <span style={pillStyle('muted')}>
        <span>{panel.projection.best}</span><span style={{ opacity: 0.5 }}>/</span><span>{panel.projection.worst}</span>
      </span>}
      {panel.cutoff && <span style={pillStyle('muted')} title={panel.cutoff.title}>{panel.cutoff.label}</span>}
      {panel.budget && <span style={pillStyle('muted')} title={panel.budget.title}>{panel.budget.label}</span>}
      {panel.targetLabel && <span style={pillStyle(panel.targetTone)}>{panel.targetLabel}</span>}
      {panel.reset && onReset && <button type="button" onClick={onReset}
        style={{ ...pillStyle('muted'), cursor: 'pointer', color: 'var(--foreground)' }}>
        <RotateCcw size={11} aria-hidden />
        <span>{panel.reset}</span>
      </button>}
    </div>
  );
}
