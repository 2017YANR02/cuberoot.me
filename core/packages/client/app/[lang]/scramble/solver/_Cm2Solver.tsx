'use client';

/**
 * /scramble/solver?event=cm2 — Cmetrick Mini(Cmetrick Mini)在线求解器。
 *
 * 纯 TS,无 worker、无下载表:Cmetrick Mini 状态空间 165,888 个(4 个球各 24 种朝向,齿轮联动有
 * 奇偶限制 = 24⁴/2),整张图在浏览器里 BFS 一次(memoized),每次求解都是 O(深度) 的最优最短路
 *(cstimer 计步上帝之数 10)。打乱来源复用 /scramble/gen 的 cstimer 桥(cstimerScramble('cm2')),
 * 记号与 cstimer 完全一致(U< U> U2 D< D> D2 R^ Rv R2 L^ Lv L2),保证它生成的打乱被正确求解。
 */
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveCm2, CM2_GODS_NUMBER } from '@/lib/cm2-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_OPTIMAL, badgeGodsNumber, CAVEAT_TITLE_OPTIMAL,
} from './_components/PuzzleSolverPage';

const CM2_TOKEN_RE = /^(U<|U>|U2|D<|D>|D2|R\^|Rv|R2|L\^|Lv|L2)$/;
const CM2_NOTE = 'U< U> U2 D< D> D2 R^ Rv R2 L^ Lv L2';

const SPEC: SolverSpec<ReturnType<typeof solveCm2>> = {
  event: 'cm2',
  titleZh: 'Cmetrick Mini 求解器',
  titleEn: 'Cmetrick Mini Solver',
  previewSize: 64,
  invocation: { async: false, solve: solveCm2 },
  prewarm: () => { solveCm2(''); },
  leadText: {
    zh: `Cmetrick Mini 在线求解:任意打乱的整解最优解(全空间 165,888 态精确表,上帝之数 10)。记号 ${CM2_NOTE},与 cstimer 一致。`,
    en: `Cmetrick Mini online solver: the exact optimal solution for any scramble (full-space table over 165,888 states; God's number is 10). Notation ${CM2_NOTE}, matching cstimer.`,
  },
  placeholder: {
    zh: '每行一条打乱,如 U< R^ D2 L>',
    en: 'one scramble per line, e.g. U< R^ D2 L>',
  },
  solvingText: { zh: '求解中…', en: 'Solving…' },
  errorNotationText: { zh: `打乱记号无法识别(应为 ${CM2_NOTE})`, en: `Unrecognized notation (expected ${CM2_NOTE})` },
  metricLabel: METRIC_FIXED_OPTIMAL,
  badge: badgeGodsNumber(CM2_GODS_NUMBER),
  caveatTitle: CAVEAT_TITLE_OPTIMAL,
  caveatBody: {
    zh: 'Cmetrick Mini 有 165,888 个状态(4 个球各 24 种朝向,齿轮联动有奇偶限制 = 24⁴/2),整张图可在浏览器里一次性 BFS,所以这里给出的是真正的最短解,不是近似。任何打乱最多 10 步可还原,平均约 7.33 步。',
    en: 'The Cmetrick Mini has 165,888 states (4 balls of 24 orientations each, halved by the gears’ parity restriction = 24⁴/2), so the whole graph is BFS-ed in the browser and every solution here is a true shortest path, not an approximation. Any scramble solves in at most 10 moves, ~7.33 on average.',
  },
  validate: (line) => {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok && !CM2_TOKEN_RE.test(tok)) return tok;
    }
    return null;
  },
  randomOne: () => cstimerScramble('cm2'),
};

export default function Cm2SolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
