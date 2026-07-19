'use client';

/**
 * /scramble/solver?event=133 — 1×3×3 Floppy Cube (1×3×3 花型) 在线求解器。
 *
 * 纯 TS,无 worker、无下载表:Floppy 状态空间只有 192 个,整张图在浏览器里 BFS 一次(memoized),
 * 每次求解都是 O(深度) 的最优最短路(上帝之数 8)。打乱来源复用 /scramble/gen 的 cstimer 桥
 * (cstimerScramble('133')),记号与 cstimer 完全一致(R L F B,180° 单转无 '),保证它生成的打乱被正确求解。
 */
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveFloppy, FLOPPY_GODS_NUMBER, type FloppySolution } from '@/lib/floppy-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_OPTIMAL, badgeGodsNumber, CAVEAT_TITLE_OPTIMAL,
} from './_components/PuzzleSolverPage';

const FLOPPY_TOKEN_RE = /^[RLFB]$/i;

const SPEC: SolverSpec<FloppySolution> = {
  event: '133',
  titleZh: '1×3×3 花型求解器',
  titleEn: '1×3×3 Floppy Cube Solver',
  previewSize: 64,
  invocation: { async: false, solve: solveFloppy },
  prewarm: () => { solveFloppy(''); },
  leadText: {
    zh: '1×3×3 花型在线求解:任意打乱的整解最优解(全空间 192 态精确表,每转一面 180° = 一步,上帝之数 8)。记号 R L F B,与 cstimer 一致。',
    en: "1×3×3 Floppy Cube online solver: the exact optimal solution for any scramble (full-space table over 192 states; one 180° face turn = one move, God's number is 8). Notation R L F B, matching cstimer.",
  },
  placeholder: {
    zh: '每行一条打乱,如 R L F B R',
    en: 'one scramble per line, e.g. R L F B R',
  },
  solvingText: { zh: '求解中…', en: 'Solving…' },
  errorNotationText: { zh: '打乱记号无法识别(应为 R L F B)', en: 'Unrecognized notation (expected R L F B)' },
  metricLabel: METRIC_FIXED_OPTIMAL,
  badge: badgeGodsNumber(FLOPPY_GODS_NUMBER),
  caveatTitle: CAVEAT_TITLE_OPTIMAL,
  caveatBody: {
    zh: '1×3×3 花型只有 192 个状态(4 角排列与 4 面翻转绑定),整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 8 步可还原,平均约 4.4 步。',
    en: 'The 1×3×3 Floppy Cube has only 192 states (4 corner permutations bound to 4 face flips), so the whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 8 moves, ~4.4 on average.',
  },
  validate: (line) => {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok && !FLOPPY_TOKEN_RE.test(tok)) return tok;
    }
    return null;
  },
  randomOne: () => cstimerScramble('133'),
};

export default function FloppySolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
