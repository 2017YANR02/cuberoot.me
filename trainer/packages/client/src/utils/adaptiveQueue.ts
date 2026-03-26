/**
 * @module adaptiveQueue
 * 自适应训练队列 — 基于上一轮表现分层重复（最慢→4次，次慢→3次…）。
 */
import type { AlgCase } from '@cuberoot/shared';

interface CaseResult {
  caseId: string;
  timeMs: number;
}

/**
 * 自适应队列生成算法（参考 Roman- 的 evalResultsToNewQueue）
 *
 * 基于上一轮结果，慢的 case 重复更多次：
 * - worst 15% → 重复 4 次
 * - next 15%  → 重复 3 次
 * - next 20%  → 重复 2 次
 * - remaining → 1 次
 * - 未尝试的 case → 1 次
 *
 * 最后打乱顺序返回
 */
export function buildAdaptiveQueue(
  allCases: AlgCase[],
  results: CaseResult[],
): AlgCase[] {
  if (results.length === 0) {
    // 首次训练，随机打乱全部选中 case
    return shuffle([...allCases]);
  }

  // 按平均时间排序（慢到快）
  const avgTimePerCase = new Map<string, number>();
  const countPerCase = new Map<string, number>();

  for (const r of results) {
    const prev = avgTimePerCase.get(r.caseId) ?? 0;
    const cnt = (countPerCase.get(r.caseId) ?? 0) + 1;
    avgTimePerCase.set(r.caseId, prev + (r.timeMs - prev) / cnt);
    countPerCase.set(r.caseId, cnt);
  }

  // 以平均时间降序排列已练习的 case
  const practiced = [...avgTimePerCase.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const n = practiced.length;
  const queue: string[] = [];

  for (let i = 0; i < n; i++) {
    const ratio = i / n;
    let repeat: number;
    if (ratio < 0.15) repeat = 4;       // worst 15%
    else if (ratio < 0.30) repeat = 3;  // next 15%
    else if (ratio < 0.50) repeat = 2;  // next 20%
    else repeat = 1;                    // remaining

    for (let r = 0; r < repeat; r++) {
      queue.push(practiced[i]);
    }
  }

  // 未尝试的 case 各加 1 次
  const practicedSet = new Set(practiced);
  for (const c of allCases) {
    if (!practicedSet.has(c.id)) {
      queue.push(c.id);
    }
  }

  // ID → AlgCase 映射
  const caseMap = new Map(allCases.map((c) => [c.id, c]));
  const result = queue
    .map((id) => caseMap.get(id))
    .filter((c): c is AlgCase => c !== undefined);

  return shuffle(result);
}

/** Fisher-Yates 洗牌 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
