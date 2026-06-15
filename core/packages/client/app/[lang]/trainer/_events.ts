// Trainer URL 第一段 = WCA event code(如 /trainer/333、/trainer/333/pll).
// 兼容 legacy puzzle 名(/trainer/3x3/pll)——resolveAlgPuzzle 两种都吃.
import { ALG_PUZZLES, type AlgPuzzle } from '@cuberoot/shared';

// alg-set puzzle <-> WCA event id
export const PUZZLE_EVENT: Record<AlgPuzzle, string> = {
  '2x2': '222', '3x3': '333', '4x4': '444', '5x5': '555',
  'sq1': 'sq1', 'megaminx': 'minx', 'pyraminx': 'pyram', 'skewb': 'skewb',
};
const EVENT_TO_PUZZLE: Record<string, AlgPuzzle> = Object.fromEntries(
  Object.entries(PUZZLE_EVENT).map(([p, e]) => [e, p as AlgPuzzle]),
);

// URL 第一段 -> AlgPuzzle:接受 event code(333)或 legacy puzzle 名(3x3);非 alg-set(3bld 等)返回 undefined.
export function resolveAlgPuzzle(seg: string): AlgPuzzle | undefined {
  if ((ALG_PUZZLES as readonly string[]).includes(seg)) return seg as AlgPuzzle;
  return EVENT_TO_PUZZLE[seg];
}

// URL 第一段 -> selector 用的 WCA event id(3x3->333, 3bld->333bf, 未知->333).
export function segToEvent(seg: string): string {
  if (seg === '3bld' || seg === '333bf') return '333bf';
  if (Object.prototype.hasOwnProperty.call(EVENT_TO_PUZZLE, seg)) return seg;
  const p = resolveAlgPuzzle(seg);
  return p ? PUZZLE_EVENT[p] : '333';
}
