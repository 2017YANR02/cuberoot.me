import {
  CUBE_OPPOSITE_FACE,
  type CubeFace,
} from '@/lib/cube-colors';

export type ColorRelation = 'opposite' | 'adjacent';

export interface ColorPair {
  first: CubeFace;
  second: CubeFace;
  relation: ColorRelation;
}

export const CUBE_COLOR_FACES: readonly CubeFace[] = ['U', 'D', 'F', 'B', 'L', 'R'];

/** 相同颜色不构成色对；其余颜色不是对色就是邻色。 */
export function getColorRelation(first: CubeFace, second: CubeFace): ColorRelation | null {
  if (first === second) return null;
  return CUBE_OPPOSITE_FACE[first] === second ? 'opposite' : 'adjacent';
}

/** 六色任取两色共有 C(6, 2) = 15 组，每组只出现一次。 */
export const ALL_COLOR_PAIRS: readonly ColorPair[] = CUBE_COLOR_FACES.flatMap((first, i) =>
  CUBE_COLOR_FACES.slice(i + 1).map((second) => ({
    first,
    second,
    relation: getColorRelation(first, second) as ColorRelation,
  })),
);

/** 洗牌只复制数组，不改动全局题库；rand 可注入以便测试。 */
export function buildColorRound(rand: () => number = Math.random): ColorPair[] {
  const round = [...ALL_COLOR_PAIRS];
  for (let i = round.length - 1; i > 0; i -= 1) {
    const raw = Math.floor(rand() * (i + 1));
    const j = Math.min(i, Math.max(0, raw));
    [round[i], round[j]] = [round[j], round[i]];
  }
  return round;
}
