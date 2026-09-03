import { CUBE_OPPOSITE_FACE, type CubeFace } from '@/lib/cube-colors';
import { CUBE_ORIENTATIONS, orientedFaceColors } from '@/lib/cube-orientation';

export type PositionRelation = 'left' | 'right' | 'opposite';
export type SideFace = CubeFace;

export interface PositionQuestion {
  reference: SideFace;
  direction: PositionRelation;
  answer: SideFace;
}

const SIDE_GEOMETRY_ORDER: readonly CubeFace[] = ['R', 'F', 'L', 'B'];

/** 指定颜色朝上时的侧面循环；下一项就是当前颜色的右边。 */
export function sideOrderForTop(top: CubeFace): SideFace[] {
  const orientation = CUBE_ORIENTATIONS.find(({ value }) => orientedFaceColors(value).U === top);
  const shown = orientedFaceColors(orientation?.value ?? '');
  return SIDE_GEOMETRY_ORDER.map((face) => shown[face]);
}

export const WHITE_TOP_SIDE_ORDER: readonly SideFace[] = sideOrderForTop('U');

export function positionQuestionsForTop(top: CubeFace): PositionQuestion[] {
  const sideOrder = sideOrderForTop(top);
  const sideQuestions = sideOrder.flatMap((reference, index) => [
    {
      reference,
      direction: 'right' as const,
      answer: sideOrder[(index + 1) % sideOrder.length],
    },
    {
      reference,
      direction: 'left' as const,
      answer: sideOrder[(index - 1 + sideOrder.length) % sideOrder.length],
    },
  ]);
  const oppositeQuestions = sideOrder.map((reference) => ({
    reference,
    direction: 'opposite' as const,
    answer: CUBE_OPPOSITE_FACE[reference],
  }));
  return [...sideQuestions, ...oppositeQuestions];
}

export const ALL_POSITION_QUESTIONS: readonly PositionQuestion[] = positionQuestionsForTop('U');

export function buildPositionRound(top: CubeFace = 'U', rand: () => number = Math.random): PositionQuestion[] {
  const round = positionQuestionsForTop(top);
  for (let i = round.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.max(0, Math.floor(rand() * (i + 1))));
    [round[i], round[j]] = [round[j], round[i]];
  }
  return round;
}
