'use client';

/**
 * GoalProgress — small inline pill that shows today's solve count vs. the
 * user-configured daily goal. Renders nothing when the goal is disabled.
 *
 * When `count >= goal` the pill turns green and shows a check-mark.
 * If the user has hit the goal for ≥ 2 consecutive days a small flame
 * badge appears next to the pill with the streak length.
 */

import { useMemo } from 'react';
import { CheckCircle2, Flame } from 'lucide-react';
import type { Solve } from '@cuberoot/shared/timer';
import { localizeTimerGoalProgress, timerGoalProgress } from '@cuberoot/shared/timer';
import type { TimerSettingCopy } from '@cuberoot/shared/timer';

interface Props {
  solves: Solve[];
  goal: number | null | undefined;
  localize(copy: TimerSettingCopy): string;
}

export function TimerGoalProgress({ solves, goal, localize: tr }: Props) {
  const progress = useMemo(() => timerGoalProgress(solves, goal), [solves, goal]);
  const view = localizeTimerGoalProgress(progress, tr);
  if (!view) return null;
  const { count, goal: validGoal, reached, percent, label, title, streakLabel, streakTitle } = view;
  const pillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 10px',
    borderRadius: 999,
    border: `1px solid ${reached ? 'color-mix(in srgb, var(--signal-success) 55%, transparent)' : 'color-mix(in srgb, var(--signal-info) 35%, transparent)'}`,
    background: reached ? 'color-mix(in srgb, var(--signal-success) 12%, transparent)' : 'color-mix(in srgb, var(--signal-info) 8%, transparent)',
    color: reached ? 'var(--signal-success)' : 'var(--foreground)',
    fontFamily: 'ui-monospace, monospace',
    fontSize: 12,
    lineHeight: 1.2,
    fontVariantNumeric: 'tabular-nums',
  };
  const barWrapStyle: React.CSSProperties = {
    width: 60,
    height: 4,
    background: 'color-mix(in srgb, var(--foreground) 8%, transparent)',
    borderRadius: 999,
    overflow: 'hidden',
  };
  const barFillStyle: React.CSSProperties = {
    width: `${percent}%`,
    height: '100%',
    background: reached ? 'var(--signal-success)' : 'var(--signal-info)',

  };
  const flameStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    padding: '2px 6px',
    borderRadius: 999,
    border: '1px solid var(--border-default)',
    background: 'var(--muted)',
    color: 'var(--signal-warning)',
    fontSize: 11,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        margin: '6px 0',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={pillStyle}
        title={title}
      >
        <span style={{ opacity: 0.8 }}>{label}</span>
        <span>
          {count} / {validGoal}
        </span>
        <span style={barWrapStyle} aria-hidden>
          <span style={{ ...barFillStyle, display: 'block' }} />
        </span>
        {reached && <CheckCircle2 size={12} aria-hidden />}
      </span>
      {streakLabel && (
        <span style={flameStyle} title={streakTitle}>
          <Flame size={11} aria-hidden />
          <span>{streakLabel}</span>
        </span>
      )}
    </div>
  );
}
