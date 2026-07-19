'use client';

/**
 * /scramble/solver?event=8p — 8-Puzzle (八数码) 在线求解器。
 *
 * 纯 TS,无 worker、无下载表:8 数码状态空间只有 9!/2 = 181,440 个,整张图在浏览器里 BFS 一次
 * (memoized),每次求解都是 O(深度) 的最优最短路(上帝之数 31,均值约 21.97)。打乱来源复用
 * /scramble/gen 的 cstimer 桥(cstimerScramble('8p')),记号与 cstimer 完全一致(U D L R,空格
 * 滑动方向,可带次数 D2),保证它生成的打乱被正确求解。预览是数字格(非魔方网)。
 */
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveSlide8, SLIDE8_GODS_NUMBER } from '@/lib/slide8-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_OPTIMAL, badgeGodsNumber, CAVEAT_TITLE_OPTIMAL,
} from './_components/PuzzleSolverPage';

const SLIDE8_TOKEN_RE = /^([UDLR])(\d+)?$/;

const SPEC: SolverSpec<ReturnType<typeof solveSlide8>> = {
  event: '8p',
  titleZh: '八数码求解器',
  titleEn: '8-Puzzle Solver',
  previewSize: 64,
  invocation: { async: false, solve: solveSlide8 },
  prewarm: () => { solveSlide8(''); },
  leadText: {
    zh: '八数码(8-Puzzle)在线求解:任意打乱的整解最优解(全空间 181,440 态精确表,上帝之数 31)。记号 U D L R 表示空格滑动方向,与 cstimer 一致。',
    en: "8-Puzzle online solver: the exact optimal solution for any scramble (full-space table over 181,440 states; God's number is 31). Notation U D L R = the direction the blank slides, matching cstimer.",
  },
  placeholder: {
    zh: '每行一条打乱,如 U R2 D L U',
    en: 'one scramble per line, e.g. U R2 D L U',
  },
  solvingText: { zh: '求解中…', en: 'Solving…' },
  errorNotationText: { zh: '打乱记号无法识别(应为 U D L R,可带次数如 D2)', en: 'Unrecognized notation (expected U D L R, optionally with a count like D2)' },
  metricLabel: METRIC_FIXED_OPTIMAL,
  badge: badgeGodsNumber(SLIDE8_GODS_NUMBER),
  caveatTitle: CAVEAT_TITLE_OPTIMAL,
  caveatBody: {
    zh: '八数码只有 181,440 个状态(9 格排列 9! 的一半),整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 31 步可还原,平均约 21.97 步。',
    en: 'The 8-Puzzle has only 181,440 states (half of all 9! cell permutations), so the whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 31 moves, ~21.97 on average.',
  },
  validate: (line) => {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok && !SLIDE8_TOKEN_RE.test(tok)) return tok;
    }
    return null;
  },
  randomOne: () => cstimerScramble('8p'),
};

export default function Slide8SolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
