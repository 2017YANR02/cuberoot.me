/**
 * 一把智能魔方成绩的三个「手感」数字:步数(STM)、手速(TPS)、流畅。
 *
 * 报告页每次只算一把,可以走完整的复盘链路(切分 + 识别 + 参考解法,IDA* 要几十到
 * 一百多毫秒)。要对一天、一年的成绩求平均就不行了 —— 这里只走**不用搜索**的那几步:
 *
 *   htmMoves()      合并同面连击(`R R` → `R2`,`R R'` 整段丢掉)   O(n)
 *   humanizeStream()把相对面那几对认成中层(动态规划,不搜索)      O(n × 表)
 *   turningSplit()  按间隔切「在转」和「在停」                      O(n log n)
 *
 * 三个数的口径和报告顶上那一排**必须一样**,否则「详情里 55 步、统计里 57 步」这种
 * 对不上的账没人查得清:
 *
 *   步数 = STM  —— 一个中层记一个记号,转体记零(见 recon_text.ts 的 `stm`)。
 *   TPS  = STM ÷ 这把的用时(不是首手到末手 —— 和详情页的 `slices.executionMs`
 *          同一个分母)。
 *   流畅 = 在转的时间 ÷ 首手到末手(quality.ts 的 `turningSplit`)。
 *
 * 没有动作流的成绩(手动计时、老数据)返回 null:它们对这三个数没有发言权,平均里
 * 也不该占分母。
 */

import { htmMoves } from './reconstruct/htm';
import { humanizeStream } from './reconstruct/humanize';
import { turningSplit } from './reconstruct/quality';
import type { Solve } from './types';
import { effectiveMs } from './types';

export interface SolveMetrics {
  /** 谱子上数得出来的记号数。 */
  stm: number;
  /** STM ÷ 用时(秒)。 */
  tps: number;
  /** 在转的时间占这把的比例,0-100。时间戳不可用时 null。 */
  fluency: number | null;
}

/**
 * 算过的存下来 —— 「总」那一档要横扫全部历史,而同一把的三个数永远不变(动作流是
 * 写死在成绩里的)。key 用成绩 id;成绩被删了缓存跟着失效没关系,它只占几十字节。
 */
const cache = new Map<string, SolveMetrics | null>();

export function solveMetrics(s: Solve): SolveMetrics | null {
  const hit = cache.get(s.id);
  if (hit !== undefined) return hit;
  const out = computeSolveMetrics(s);
  cache.set(s.id, out);
  return out;
}

function computeSolveMetrics(s: Solve): SolveMetrics | null {
  const moves = s.moves;
  if (!moves || moves.length < 2) return null;
  // DNF/DNS 的用时是 Infinity,除出来的 TPS 没有意义;这种把整条排除。
  const ms = effectiveMs(s);
  if (!Number.isFinite(ms) || ms <= 0) return null;

  const counted = htmMoves(moves);
  if (counted.length === 0) return null;
  const { merges } = humanizeStream(counted);
  const stm = counted.length - merges;

  const span = moves[moves.length - 1].ts - moves[0].ts;
  const split = turningSplit(moves, span);

  return {
    stm,
    tps: stm / (ms / 1000),
    fluency: split ? (split.turningMs / span) * 100 : null,
  };
}

export interface SolveMetricsAverage {
  /** 有动作流、进了平均的把数。0 = 这一段里没有智能魔方成绩。 */
  n: number;
  stm: number | null;
  tps: number | null;
  /** 时间戳可用的那些把的平均;`n` 里可能有几把没有它。 */
  fluency: number | null;
}

/** 一段成绩的三个平均。没有一把带动作流时三个都是 null。 */
export function averageSolveMetrics(solves: Solve[]): SolveMetricsAverage {
  let n = 0;
  let stm = 0;
  let tps = 0;
  let fluency = 0;
  let fluencyN = 0;
  for (const s of solves) {
    const m = solveMetrics(s);
    if (!m) continue;
    n += 1;
    stm += m.stm;
    tps += m.tps;
    if (m.fluency !== null) { fluency += m.fluency; fluencyN += 1; }
  }
  if (n === 0) return { n: 0, stm: null, tps: null, fluency: null };
  return {
    n,
    stm: stm / n,
    tps: tps / n,
    fluency: fluencyN > 0 ? fluency / fluencyN : null,
  };
}
