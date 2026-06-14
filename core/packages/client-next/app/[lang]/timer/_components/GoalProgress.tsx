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
import type { Solve } from '../_lib/types';
import { countSolvesToday, consecutiveGoalDays } from '../_lib/storage/goals';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

interface Props {
  solves: Solve[];
  goal: number | null | undefined;
  isZh: boolean;
}

export default function GoalProgress({ solves, goal, isZh }: Props) {
  const count = useMemo(() => countSolvesToday(solves), [solves]);
  const validGoal =
    typeof goal === 'number' && Number.isFinite(goal) && goal > 0 ? Math.floor(goal) : null;
  const streak = useMemo(
    () => (validGoal !== null ? consecutiveGoalDays(solves, validGoal) : 0),
    [solves, validGoal],
  );

  // Disabled or "be quiet on first visit": no goal, or 0 solves today AND
  // no solves at all today (fresh open with no scramble taken).
  if (validGoal === null) return null;
  if (count === 0 && solves.length === 0) return null;

  const reached = count >= validGoal;
  const pct = Math.max(0, Math.min(1, count / validGoal));

  const pillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 10px',
    borderRadius: 999,
    border: `1px solid ${reached ? 'rgba(80, 180, 110, 0.55)' : 'rgba(91, 157, 217, 0.35)'}`,
    background: reached ? 'rgba(80, 180, 110, 0.12)' : 'rgba(91, 157, 217, 0.08)',
    color: reached ? '#7fd99a' : '#cde',
    fontFamily: 'ui-monospace, monospace',
    fontSize: 12,
    lineHeight: 1.2,
    fontVariantNumeric: 'tabular-nums',
  };
  const barWrapStyle: React.CSSProperties = {
    width: 60,
    height: 4,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    overflow: 'hidden',
  };
  const barFillStyle: React.CSSProperties = {
    width: `${pct * 100}%`,
    height: '100%',
    background: reached ? '#5cc77a' : '#5b9dd9',
    transition: 'width 200ms ease',
  };
  const flameStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    padding: '2px 6px',
    borderRadius: 999,
    border: '1px solid #5b3a1f',
    background: '#2a1a0d',
    color: '#f0a060',
    fontSize: 11,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  };

  const label = tr({ zh: '今日目标', en: 'today'
});
  const streakLabel = (isZh
      ? `${streak} 天连续达标`
      : `${streak} day${streak === 1 ? '' : 's'} streak`);
  const streakTitle = tr({ zh: '连续每日达成日目标', en: 'Consecutive days hitting the daily goal'
});

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
        title={
          isZh
            ? `今日完成 ${count} / ${validGoal} 次`
            : `${count} of ${validGoal} solves today`
        }
      >
        <span style={{ opacity: 0.8 }}>{label}</span>
        <span>
          {count} / {validGoal}
        </span>
        <span style={barWrapStyle} aria-hidden>
          <span style={barFillStyle} />
        </span>
        {reached && <CheckCircle2 size={12} aria-hidden />}
      </span>
      {streak >= 2 && (
        <span style={flameStyle} title={streakTitle}>
          <Flame size={11} aria-hidden />
          <span>{streakLabel}</span>
        </span>
      )}
    </div>
  );
}
