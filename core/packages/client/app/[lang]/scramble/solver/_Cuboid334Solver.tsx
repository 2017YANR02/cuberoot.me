'use client';

/**
 * /scramble/solver?event=334 — 3×3×4 在线求解器。
 *
 * 纯 TS,无 worker、无下载表。3×3×4 状态空间 ≈ 1.65×10¹⁷(facelet 群阶 2.64×10¹⁸,Schreier-Sims 实算),
 * 太大无法整图 BFS,也没有浏览器可建的强启发让 IDA* 在交互时间内跑到上帝之数。策略 = **两阶段约简**:
 * 阶段一把所有块归约进全 180° 子群(每轨道「进入子群」距离表作可采纳启发),阶段二只用 180° 转还原
 *(每轨道子群小,IDA* 可采纳)。任何打乱都返回一条有界的**近最优**解(`optimal:false`);很浅的态另用
 * 可采纳启发式给出**可证最优**解(`optimal:true`)。不存在「太深」—— 每条真打乱都能解出。求解放进
 * setTimeout 异步执行,期间显示「求解中」spinner。打乱来源复用 cstimer 桥,记号与 cstimer 完全一致
 *(U U' U2 u u' u2 R2 L2 M2 F2 B2 S2)。
 */
import { randomCuboid334Scramble, solveCuboid334, CUBOID334_STATE_COUNT_STR, CUBOID334_GROUP_ORDER_STR, type Cuboid334Solution } from '@/lib/cuboid334-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_TERNARY_OPTIMAL_NEAR, CAVEAT_TITLE_OPTIMAL,
} from './_components/PuzzleSolverPage';

const CUBOID334_TOKEN_RE = /^(U['2]?|u['2]?|[RLMFBS]2)$/;

// random-scramble length for the buttons (cstimer 334 default is long; this mirrors a real scramble).
const RANDOM_LEN = 40;

const SPEC: SolverSpec<Cuboid334Solution> = {
  event: '334',
  titleZh: '3×3×4 求解器',
  titleEn: '3×3×4 Solver',
  previewSize: 64,
  invocation: { async: false, solve: solveCuboid334 },
  leadText: {
    zh: '3×3×4 在线求解:两阶段约简(先把所有块归约进全 180° 子群,再只用 180° 转还原),任何打乱都能解出一条有界的近最优解;很浅的打乱另用可采纳启发式给出可证最优解。记号 U U’ U2 u u’ u2 R2 L2 M2 F2 B2 S2,与 cstimer 一致。',
    en: '3×3×4 online solver: a two-phase reduction (reduce every orbit into the all-180° subgroup, then finish with 180° turns only) returns a bounded near-optimal solution for ANY scramble; very shallow scrambles additionally get a provably optimal solution via an admissible heuristic. Notation U U’ U2 u u’ u2 R2 L2 M2 F2 B2 S2, matching cstimer.',
  },
  placeholder: {
    zh: '每行一条打乱,如 U R2 u2 F2 U',
    en: 'one scramble per line, e.g. U R2 u2 F2 U',
  },
  solvingText: { zh: '求解中…', en: 'Solving…' },
  errorNotationText: { zh: '打乱记号无法识别(应为 U U’ U2 u u’ u2 R2 L2 M2 F2 B2 S2)', en: 'Unrecognized notation (expected U U’ U2 u u’ u2 R2 L2 M2 F2 B2 S2)' },
  metricLabel: METRIC_TERNARY_OPTIMAL_NEAR,
  caveatTitle: CAVEAT_TITLE_OPTIMAL,
  caveatBody: {
    zh: `3×3×4 有约 ${CUBOID334_STATE_COUNT_STR} 个状态(facelet 群阶 ${CUBOID334_GROUP_ORDER_STR},Schreier-Sims 实算),太大无法整图 BFS,浏览器里也建不出足够强的可采纳启发去逼近上帝之数(约 18-20),所以**不是**每条解都最优。采用两阶段约简:先把每个轨道归约进全 180° 子群,再只用 180° 转还原;两阶段各自在自己的小坐标里最优,合起来就是有界的**近最优**解(任何打乱都能解)。很浅的打乱会额外尝试可采纳启发的可证最优解,标为「最优」;其余标为「近最优」。`,
    en: `The 3×3×4 has about ${CUBOID334_STATE_COUNT_STR} states (facelet group order ${CUBOID334_GROUP_ORDER_STR}, computed by Schreier-Sims) — far too many to BFS, and no admissible heuristic strong enough to reach God's number (~18-20) is buildable in the browser, so NOT every solution is optimal. The solver uses a two-phase reduction: first reduce every orbit into the all-180° subgroup, then finish with 180° turns only. Each phase is optimal over its own small coordinate, so the total is a bounded NEAR-OPTIMAL solution (every scramble solves). Very shallow scrambles additionally try an admissible-heuristic optimal solve, labeled "optimal"; the rest are labeled "near-optimal".`,
  },
  validate: (line) => {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok && !CUBOID334_TOKEN_RE.test(tok)) return tok;
    }
    return null;
  },
  randomOne: () => Promise.resolve(randomCuboid334Scramble(RANDOM_LEN)),
};

export default function Cuboid334SolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
