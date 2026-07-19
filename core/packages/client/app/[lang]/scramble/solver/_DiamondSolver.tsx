'use client';

/**
 * /scramble/solver?event=dmd — Diamond(钻石,八面体面转)在线求解器。
 *
 * 纯 TS,无 worker、无下载表:Diamond 是八面体面转(8 个三角面、每面 4 个三角小贴纸 = 32 贴纸,
 * 状态 = 32 位置换排列),4 个面转每个 order 3。可达状态空间 138,240 个,整张图在浏览器里 BFS
 * 一次(memoized),每次求解都是 O(深度) 的最优最短路(cstimer 计步上帝之数 10,平均约 6.69 步)。
 * 打乱来源复用 /scramble/gen 的 cstimer 桥(cstimerScramble('dmd')),记号与 cstimer 完全一致
 *(U U' R R' L L' F F'),保证它生成的打乱被正确求解。
 */
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveDiamond, DIAMOND_GODS_NUMBER } from '@/lib/diamond-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_OPTIMAL, badgeGodsNumber, CAVEAT_TITLE_OPTIMAL,
} from './_components/PuzzleSolverPage';

const DIAMOND_TOKEN_RE = /^[URLF]'?$/;
const DIAMOND_NOTE = "U U' R R' L L' F F'";

const SPEC: SolverSpec<ReturnType<typeof solveDiamond>> = {
  event: 'dmd',
  titleZh: '钻石求解器',
  titleEn: 'Diamond Solver',
  previewSize: 64,
  invocation: { async: false, solve: solveDiamond },
  prewarm: () => { solveDiamond(''); },
  leadText: {
    zh: `钻石(八面体)在线求解:任意打乱的整解最优解(全空间 138,240 态精确表,上帝之数 10)。记号 ${DIAMOND_NOTE},与 cstimer 一致。`,
    en: `Diamond (octahedron) online solver: the exact optimal solution for any scramble (full-space table over 138,240 states; God's number is 10). Notation ${DIAMOND_NOTE}, matching cstimer.`,
  },
  placeholder: {
    zh: "每行一条打乱,如 U R' F L'",
    en: "one scramble per line, e.g. U R' F L'",
  },
  solvingText: { zh: '求解中…', en: 'Solving…' },
  errorNotationText: { zh: `打乱记号无法识别(应为 ${DIAMOND_NOTE})`, en: `Unrecognized notation (expected ${DIAMOND_NOTE})` },
  metricLabel: METRIC_FIXED_OPTIMAL,
  badge: badgeGodsNumber(DIAMOND_GODS_NUMBER),
  caveatTitle: CAVEAT_TITLE_OPTIMAL,
  caveatBody: {
    zh: '钻石是八面体面转(8 个三角面、每面 4 个三角小贴纸 = 32 贴纸,4 个 90° 面转每个 order 3),可达状态共 138,240 个,整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 10 步可还原,平均约 6.69 步。',
    en: 'The Diamond is an octahedron face-turner (8 triangular faces, 4 triangular sub-stickers each = 32 stickers, 4 face turns each of order 3) with 138,240 reachable states, so the whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 10 moves, ~6.69 on average.',
  },
  validate: (line) => {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok && !DIAMOND_TOKEN_RE.test(tok)) return tok;
    }
    return null;
  },
  randomOne: () => cstimerScramble('dmd'),
};

export default function DiamondSolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
