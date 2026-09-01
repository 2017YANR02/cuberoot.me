/**
 * 容错地把**一个**记号作用到状态上。
 *
 * 整个 reconstruct 层只有这一份「宽容的」记号应用:动作流是从硬件流里重建的,
 * 里面可能混进宽层简写、整体旋转、乃至解不开的垃圾;走到一半抛异常等于丢掉整把,
 * 所以认不出的记号原样跳过,状态不动。
 *
 * 单独成模块(而不是留在 `reconstruct/stage_segments.ts` 里)是为了断依赖环:
 * `reconstruct/orient.ts` 要用它,而 `stage_segments.ts` 要用 `orient.ts`。
 */

import type { CubeFaces } from './state';
import { applyMoves } from './state';
import { parseScramble } from '@cuberoot/puzzle-solvers/cube-moves';

export function applyOneToken(prev: CubeFaces, token: string): CubeFaces {
  const trimmed = token.trim();
  if (!trimmed) return prev;
  try {
    const parsed = parseScramble(trimmed);
    if (parsed.length === 0) return prev;
    return applyMoves(prev, 3, parsed);
  } catch {
    return prev;
  }
}
