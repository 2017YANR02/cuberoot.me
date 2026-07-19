'use client';

/**
 * /scramble/solver?event=223 — 2×2×3 Tower (2×2×3) 在线求解器。
 *
 * 纯 TS,无 worker、无下载表:2×2×3 状态空间只有 241,920 个(8 角排列 40,320 × 中层 3 排列 6),
 * 整张图在浏览器里 BFS 一次(memoized,~0.2s),每次求解都是 O(深度) 的最优最短路(上帝之数 14)。
 * 打乱来源复用 /scramble/gen 的 cstimer 桥(cstimerScramble('223')),记号与 cstimer 完全一致
 * (U U' U2 D D' D2 R2 F2),保证它生成的打乱被正确求解。
 */
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveCuboid223, CUBOID223_GODS_NUMBER, type Cuboid223Solution } from '@/lib/cuboid223-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_OPTIMAL, badgeGodsNumber, CAVEAT_TITLE_OPTIMAL,
} from './_components/PuzzleSolverPage';

const CUBOID223_TOKEN_RE = /^([UD]['2]?|[RF]2)$/;

const SPEC: SolverSpec<Cuboid223Solution> = {
  event: '223',
  titleZh: '2×2×3 求解器',
  titleEn: '2×2×3 Tower Solver',
  previewSize: 64,
  invocation: { async: false, solve: solveCuboid223 },
  prewarm: () => { solveCuboid223(''); },
  leadText: {
    zh: '2×2×3 在线求解:任意打乱的整解最优解(全空间 241,920 态精确表,上帝之数 14)。记号 U U2 U’ D D2 D’ R2 F2,与 cstimer 一致。',
    en: "2×2×3 Tower online solver: the exact optimal solution for any scramble (full-space table over 241,920 states; God's number is 14). Notation U U2 U’ D D2 D’ R2 F2, matching cstimer.",
  },
  placeholder: {
    zh: '每行一条打乱,如 U R2 F2 U2 D',
    en: 'one scramble per line, e.g. U R2 F2 U2 D',
  },
  solvingText: { zh: '求解中…', en: 'Solving…' },
  errorNotationText: { zh: '打乱记号无法识别(应为 U U2 U’ D D2 D’ R2 F2)', en: 'Unrecognized notation (expected U U2 U’ D D2 D’ R2 F2)' },
  metricLabel: METRIC_FIXED_OPTIMAL,
  badge: badgeGodsNumber(CUBOID223_GODS_NUMBER),
  caveatTitle: CAVEAT_TITLE_OPTIMAL,
  caveatBody: {
    zh: '2×2×3 只有 241,920 个状态(8 角自由排列 40,320 × 中层 3 个排列 6),整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 14 步可还原,平均约 9.74 步。',
    en: 'The 2×2×3 Tower has only 241,920 states (8 freely-permuted corners × 6 middle-layer permutations), so the whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 14 moves, ~9.74 on average.',
  },
  validate: (line) => {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok && !CUBOID223_TOKEN_RE.test(tok)) return tok;
    }
    return null;
  },
  randomOne: () => cstimerScramble('223'),
};

export default function Cuboid223SolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
