'use client';

/**
 * /scramble/solver?event=ivy — Ivy Cube (枫叶魔方) 在线求解器。
 *
 * 纯 TS,无 worker、无下载表:Ivy 状态空间只有 29,160 个,整张图在浏览器里 BFS 一次(memoized),
 * 每次求解都是 O(深度) 的最优最短路(上帝之数 8)。打乱来源复用 /scramble/gen 的 cstimer 桥
 * (cstimerScramble('ivy')),记号与 cstimer 完全一致(R L D B,带 '),保证它生成的打乱被正确求解。
 */
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveIvy, IVY_GODS_NUMBER } from '@/lib/ivy-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_OPTIMAL, badgeGodsNumber, CAVEAT_TITLE_OPTIMAL,
} from './_components/PuzzleSolverPage';

const IVY_TOKEN_RE = /^[RLDB]'?$/i;

const SPEC: SolverSpec<ReturnType<typeof solveIvy>> = {
  event: 'ivy',
  titleZh: '枫叶魔方求解器',
  titleEn: 'Ivy Cube Solver',
  previewSize: 64,
  invocation: { async: false, solve: solveIvy },
  prewarm: () => { solveIvy(''); },
  leadText: {
    zh: '枫叶魔方在线求解:任意打乱的整解最优解(全空间 29,160 态精确表,每次转一个角 = 一步,上帝之数 8)。记号 R L D B,可带 \',与 cstimer 一致。',
    en: "Ivy Cube online solver: the exact optimal solution for any scramble (full-space table over 29,160 states; one corner twist = one move, God's number is 8). Notation R L D B with optional ', matching cstimer.",
  },
  placeholder: {
    zh: "每行一条打乱,如 R L' D B' R'",
    en: "one scramble per line, e.g. R L' D B' R'",
  },
  solvingText: { zh: '求解中…', en: 'Solving…' },
  errorNotationText: { zh: '打乱记号无法识别(应为 R L D B,可带 \')', en: "Unrecognized notation (expected R L D B with optional ')" },
  metricLabel: METRIC_FIXED_OPTIMAL,
  badge: badgeGodsNumber(IVY_GODS_NUMBER),
  caveatTitle: CAVEAT_TITLE_OPTIMAL,
  caveatBody: {
    zh: '枫叶魔方只有 29,160 个状态(81 角向 × 360 中心偶排列),整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 8 步可还原,平均约 5.7 步。',
    en: 'The Ivy Cube has only 29,160 states (81 corner-orientations × 360 even center-permutations), so the whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 8 moves, ~5.7 on average.',
  },
  validate: (line) => {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok && !IVY_TOKEN_RE.test(tok)) return tok;
    }
    return null;
  },
  randomOne: () => cstimerScramble('ivy'),
};

export default function IvySolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
