// 非 3x3 puzzle 难度分布页「点某步数 → 看该步数真实比赛打乱」示例 — 数据契约 + 加载路径。
// 生产端:scramble-stats-build/src/build_puzzle_examples.ts(改 shape 必须两处同步 + bump V)。
import { statsUrl } from '@/lib/stats-base';

export type PuzzleExampleSample = [string, string, string?]; // [id, scramble, optScramble?]
// [compId, eventId, scrambleNum, roundType, group, isExtra(0|1)] — 与 3x3 ExampleCompMeta 对齐
export type PuzzleExampleCompMeta = [string, string, number, string, string, (0 | 1)];

export interface PuzzleExamplesEntry {
  bins: Record<string, PuzzleExampleSample[]>;   // 主口径步数 -> 示例打乱(每 bin K 条)
  binsAlt?: Record<string, PuzzleExampleSample[]>; // 备选口径分桶(sq1: slash;前端切口径时用)
  comps: Record<string, [string, string]>;       // compId -> [比赛名, 日期串]
  idMeta: Record<string, PuzzleExampleCompMeta>;  // id -> 比赛元数据
}

export interface PuzzleExamplesJson {
  meta: { generated_at: string };
  puzzles: Record<string, PuzzleExamplesEntry>; // key = puzzle 名(pocket / pyraminx / skewb)
}

// shape 变更或数据全量重灌时 bump(防缓存旧 JSON)
const V = '20260614opt';

export async function fetchPuzzleExamples(): Promise<PuzzleExamplesJson> {
  const r = await fetch(statsUrl('/stats/scramble/puzzle_examples.json') + `?v=${V}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<PuzzleExamplesJson>;
}
