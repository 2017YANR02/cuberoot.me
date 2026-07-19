'use client';

/**
 * /scramble/solver?event=sfl — Super Floppy Cube(超薄花型 / Super Floppy)在线求解器。
 *
 * 纯 TS,无 worker、无下载表:Super Floppy 状态空间 3,041,280 个(4 角在 12 位置的排列 11,880 ×
 * 4 个边各 4 朝向 256),整张图在浏览器里 BFS 一次(memoized,整数排名编码 ~0.6s),每次求解都是
 * O(深度) 的最优最短路(上帝之数 13)。打乱来源复用 /scramble/gen 的 cstimer 桥(cstimerScramble
 * ('sfl')),记号与 cstimer 完全一致(R R2 R' L L2 L' U U2 U' D D2 D'),保证它生成的打乱被正确求解。
 */
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveSuperFloppy, SUPERFLOPPY_GODS_NUMBER } from '@/lib/superfloppy-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_OPTIMAL, badgeGodsNumber, CAVEAT_TITLE_OPTIMAL,
} from './_components/PuzzleSolverPage';

const SUPERFLOPPY_TOKEN_RE = /^([RLUD]['2]?)$/;

const SPEC: SolverSpec<ReturnType<typeof solveSuperFloppy>> = {
  event: 'sfl',
  titleZh: 'Super Floppy 求解器',
  titleEn: 'Super Floppy Solver',
  previewSize: 64,
  invocation: { async: false, solve: solveSuperFloppy },
  prewarm: () => { solveSuperFloppy(''); },
  leadText: {
    zh: 'Super Floppy 在线求解:任意打乱的整解最优解(全空间 3,041,280 态精确表,上帝之数 13)。记号 R R2 R’ L L2 L’ U U2 U’ D D2 D’,与 cstimer 一致。',
    en: "Super Floppy online solver: the exact optimal solution for any scramble (full-space table over 3,041,280 states; God's number is 13). Notation R R2 R’ L L2 L’ U U2 U’ D D2 D’, matching cstimer.",
  },
  placeholder: {
    zh: '每行一条打乱,如 R U2 L D R2',
    en: 'one scramble per line, e.g. R U2 L D R2',
  },
  solvingText: { zh: '求解中…', en: 'Solving…' },
  errorNotationText: { zh: '打乱记号无法识别(应为 R R2 R’ L L2 L’ U U2 U’ D D2 D’)', en: 'Unrecognized notation (expected R R2 R’ L L2 L’ U U2 U’ D D2 D’)' },
  metricLabel: METRIC_FIXED_OPTIMAL,
  badge: badgeGodsNumber(SUPERFLOPPY_GODS_NUMBER),
  caveatTitle: CAVEAT_TITLE_OPTIMAL,
  caveatBody: {
    zh: 'Super Floppy 有 3,041,280 个状态(4 角在 12 位置的排列 11,880 × 4 个边各 4 朝向 256),整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 13 步可还原,平均约 9.00 步。',
    en: 'The Super Floppy has 3,041,280 states (11,880 placements of 4 corners over 12 positions × 256 edge orientations), so the whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 13 moves, ~9.00 on average.',
  },
  validate: (line) => {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok && !SUPERFLOPPY_TOKEN_RE.test(tok)) return tok;
    }
    return null;
  },
  randomOne: () => cstimerScramble('sfl'),
};

export default function SuperFloppySolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
