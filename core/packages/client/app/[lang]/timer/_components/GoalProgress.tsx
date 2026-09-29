'use client';
import { TimerGoalProgress } from '@cuberoot/timer-ui';
import type { Solve } from '@cuberoot/shared/timer';
import { tr } from '@/i18n/tr';
export default function GoalProgress({ solves, goal }: { solves: Solve[]; goal: number | null | undefined; isZh: boolean }) {
  return <TimerGoalProgress solves={solves} goal={goal} localize={tr} />;
}