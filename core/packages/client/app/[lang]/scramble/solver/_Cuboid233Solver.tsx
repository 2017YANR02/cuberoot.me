'use client';

/**
 * /scramble/solver?event=233 — 2×3×3 Domino (233) 在线求解器。
 *
 * 纯 TS,无 worker、无下载表。2×3×3 多米诺状态空间 = 1,625,702,400(8!·8!,角棱奇偶独立),太大无法整图 BFS,
 * 所以每条打乱用 IDA*(迭代加深 A*)+ max(角距离, 棱距离) 可采纳启发式现场求解,得到可证最短解(非近似)。
 * 两张完整模式库(8! 角、8! 棱,各一次 ~0.5s BFS,memoized)给出精确子距离,其 max 是真实距离的下界,
 * 故 IDA* 返回的是真正最短解。随机态平均约 13.7 步,样本最长 16,深态在毫秒到数百毫秒内解出;为防深态
 * 阻塞 UI,求解放进 setTimeout 异步执行,期间显示「求解中」spinner。打乱来源复用 /scramble/gen 的 cstimer
 * 桥(cstimerScramble('233')),记号与 cstimer 完全一致(U U' U2 R2 L2 F2 B2),保证它生成的打乱被正确求解。
 */
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveCuboid233, type Cuboid233Solution } from '@/lib/cuboid233-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_OPTIMAL, CAVEAT_TITLE_OPTIMAL,
} from './_components/PuzzleSolverPage';

const CUBOID233_TOKEN_RE = /^(U['2]?|[RLFB]2)$/;

const SPEC: SolverSpec<Cuboid233Solution> = {
  event: '233',
  titleZh: '2×3×3 多米诺求解器',
  titleEn: '2×3×3 Domino Solver',
  previewSize: 64,
  invocation: { async: false, solve: solveCuboid233 },
  leadText: {
    zh: '2×3×3 多米诺在线求解:每条打乱用 IDA* + max(角距离, 棱距离) 可采纳启发式现场算出整解最优解(可证最短,非近似)。记号 U U’ U2 R2 L2 F2 B2,与 cstimer 一致。',
    en: "2×3×3 Domino online solver: each scramble is solved on demand by IDA* with the admissible max(corner-distance, edge-distance) heuristic, giving the provably shortest solution (not an approximation). Notation U U’ U2 R2 L2 F2 B2, matching cstimer.",
  },
  placeholder: {
    zh: '每行一条打乱,如 U R2 U2 F2 U',
    en: 'one scramble per line, e.g. U R2 U2 F2 U',
  },
  solvingText: { zh: '求解中…', en: 'Solving…' },
  errorNotationText: { zh: '打乱记号无法识别(应为 U U’ U2 R2 L2 F2 B2)', en: 'Unrecognized notation (expected U U’ U2 R2 L2 F2 B2)' },
  metricLabel: METRIC_FIXED_OPTIMAL,
  caveatTitle: CAVEAT_TITLE_OPTIMAL,
  caveatBody: {
    zh: '2×3×3 多米诺有 1,625,702,400 个状态(8 角 × 8 棱,各自由排列,角棱奇偶独立),太大无法整图 BFS,所以这里用 IDA* + max(角距离, 棱距离) 可采纳启发式逐条求解 —— 角、棱各自的精确距离都不超过真实距离,故返回的依然是可证的最短解,不是近似。随机态平均约 13.7 步,样本中最长 16 步。',
    en: 'The 2×3×3 Domino has 1,625,702,400 states (8 corners × 8 edges, each freely permuted, parities independent) — far too many to BFS — so it is solved per-instance by IDA* with the admissible max(corner-distance, edge-distance) heuristic. Since each sub-distance never overestimates the true distance, the returned solution is still a provably shortest path, not an approximation. Random states average ~13.7 moves; the longest seen in a large sample is 16.',
  },
  validate: (line) => {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok && !CUBOID233_TOKEN_RE.test(tok)) return tok;
    }
    return null;
  },
  randomOne: () => cstimerScramble('233'),
};

export default function Cuboid233SolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
