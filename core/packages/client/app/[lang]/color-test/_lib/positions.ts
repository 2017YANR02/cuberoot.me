import type { CubeFace } from '@/lib/cube-colors';

export type SideDirection = 'left' | 'right';
export type SideFace = Extract<CubeFace, 'R' | 'F' | 'L' | 'B'>;

export interface PositionQuestion {
  reference: SideFace;
  direction: SideDirection;
  answer: SideFace;
}

/** 白色朝上时的侧面循环；下一项就是当前颜色的右边。 */
export const WHITE_TOP_SIDE_ORDER: readonly SideFace[] = ['R', 'F', 'L', 'B'];

export const ALL_POSITION_QUESTIONS: readonly PositionQuestion[] = WHITE_TOP_SIDE_ORDER.flatMap((reference, index) => [
  {
    reference,
    direction: 'right' as const,
    answer: WHITE_TOP_SIDE_ORDER[(index + 1) % WHITE_TOP_SIDE_ORDER.length],
  },
  {
    reference,
    direction: 'left' as const,
    answer: WHITE_TOP_SIDE_ORDER[(index - 1 + WHITE_TOP_SIDE_ORDER.length) % WHITE_TOP_SIDE_ORDER.length],
  },
]);

export function buildPositionRound(rand: () => number = Math.random): PositionQuestion[] {
  const round = [...ALL_POSITION_QUESTIONS];
  for (let i = round.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.max(0, Math.floor(rand() * (i + 1))));
    [round[i], round[j]] = [round[j], round[i]];
  }
  return round;
}
