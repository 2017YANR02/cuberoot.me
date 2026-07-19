'use client';

/**
 * /scramble/solver?event=ufo — UFO(UFO 魔方)在线求解器。
 *
 * 纯 TS,无 worker、无下载表:UFO 状态空间 60,480 个(3 球各 8 个八分体 = 24 件,6 位转盘),整张图
 * 在浏览器里 BFS 一次(memoized,<50ms),每次求解都是 O(深度) 的最优最短路(上帝之数 10)。打乱来源
 * 复用 /scramble/gen 的 cstimer 桥(cstimerScramble('ufo')),记号与 cstimer 完全一致(A B C U U' U2'
 * U2 U3),保证它生成的打乱被正确求解。
 */
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveUfo, UFO_GODS_NUMBER } from '@/lib/ufo-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_OPTIMAL, badgeGodsNumber, CAVEAT_TITLE_OPTIMAL,
} from './_components/PuzzleSolverPage';

const UFO_TOKEN_RE = /^(A|B|C|U|U'|U2|U2'|U3)$/;

const SPEC: SolverSpec<ReturnType<typeof solveUfo>> = {
  event: 'ufo',
  titleZh: 'UFO 求解器',
  titleEn: 'UFO Solver',
  previewSize: 64,
  invocation: { async: false, solve: solveUfo },
  prewarm: () => { solveUfo(''); },
  leadText: {
    zh: 'UFO 在线求解:任意打乱的整解最优解(全空间 60,480 态精确表,上帝之数 10)。记号 A B C U U’ U2’ U2 U3,与 cstimer 一致。',
    en: "UFO online solver: the exact optimal solution for any scramble (full-space table over 60,480 states; God's number is 10). Notation A B C U U’ U2’ U2 U3, matching cstimer.",
  },
  placeholder: {
    zh: '每行一条打乱,如 A U B U2 C',
    en: 'one scramble per line, e.g. A U B U2 C',
  },
  solvingText: { zh: '求解中…', en: 'Solving…' },
  errorNotationText: { zh: '打乱记号无法识别(应为 A B C U U’ U2’ U2 U3)', en: 'Unrecognized notation (expected A B C U U’ U2’ U2 U3)' },
  metricLabel: METRIC_FIXED_OPTIMAL,
  badge: badgeGodsNumber(UFO_GODS_NUMBER),
  caveatTitle: CAVEAT_TITLE_OPTIMAL,
  caveatBody: {
    zh: 'UFO 有 60,480 个状态(3 球各 8 个八分体 = 24 件,6 位转盘),整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 10 步可还原,平均约 7.74 步。',
    en: 'The UFO has 60,480 states (3 balls of 8 octants = 24 pieces, on a 6-position wheel), so the whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 10 moves, ~7.74 on average.',
  },
  validate: (line) => {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok && !UFO_TOKEN_RE.test(tok)) return tok;
    }
    return null;
  },
  randomOne: () => cstimerScramble('ufo'),
};

export default function UfoSolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
