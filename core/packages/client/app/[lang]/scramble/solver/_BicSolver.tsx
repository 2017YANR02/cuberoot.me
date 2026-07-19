'use client';

/**
 * /scramble/solver?event=bic — Bicube(联体魔方)整解最优在线求解器。TIER B(离线精确距离表)。
 *
 * 纯 TS:Bicube(Uwe Meffert 受限 3×3×3)可达态恰 1,108,800 个,但浏览器现场 BFS 整图实测 ~6.4s/~510MB
 * 峰值 → 移动端必崩。故改 TIER B:离线 BFS 一次,把每态精确最优距离按确定性 rank 索引,gzip 成 ~1.8MB 的
 * opt_bic.bin.gz;首次求解时 fetch+inflate(DecompressionStream)→ 常驻 ~10MB 类型化数组(Float64 sorted
 * ranks + Uint8 dist),再梯度下降出可证最短解。无现场 BFS、无 510MB Map。打乱来源复用 /scramble/gen 的
 * cstimer 桥(cstimerScramble('bic')),记号与 cstimer 完全一致(U U' U2 F F' F2 L L' L2 R R' R2,
 * 受 bandaging 门控)。上帝之数 28(面转计步;出处 jaapsch.net)。
 */
import { cstimerScramble } from '@/lib/cstimer-scramble';
import { solveBic, BIC_GODS_NUMBER, type BicSolution } from '@/lib/bicube-solver';
import PuzzleSolverPage, {
  type SolverSpec, METRIC_FIXED_OPTIMAL, badgeGodsNumber, CAVEAT_TITLE_OPTIMAL,
} from './_components/PuzzleSolverPage';

const BIC_TOKEN_RE = /^[UFLR](2|')?$/;
const BIC_NOTE = "U U' U2 F F' F2 L L' L2 R R' R2";

const SPEC: SolverSpec<BicSolution> = {
  event: 'bic',
  titleZh: '联体魔方求解器',
  titleEn: 'Bicube Solver',
  previewSize: 64,
  invocation: { async: true, solve: solveBic, tableErrorMode: true },
  leadText: {
    zh: `联体魔方在线求解:任意打乱的整解最优解(全空间 1,108,800 态离线精确距离表,上帝之数 28,面转计步)。记号 ${BIC_NOTE},与 cstimer 一致(受 bandaging 门控)。`,
    en: `Bicube online solver: the exact optimal solution for any scramble (offline exact-distance table over all 1,108,800 states; God's number is 28 in the face-turn metric). Notation ${BIC_NOTE}, matching cstimer (gated by bandaging).`,
  },
  placeholder: {
    zh: "每行一条打乱,如 U F2 L' R",
    en: "one scramble per line, e.g. U F2 L' R",
  },
  solvingText: { zh: '求解中(首次会加载约 1.8MB 距离表)…', en: 'Solving (the first call loads the ~1.8MB distance table)…' },
  errorNotationText: { zh: `打乱记号无法识别(应为 ${BIC_NOTE})`, en: `Unrecognized notation (expected ${BIC_NOTE})` },
  errorTableText: { zh: '距离表加载失败,请检查网络后重试', en: 'Failed to load the distance table — check your connection and retry' },
  metricLabel: METRIC_FIXED_OPTIMAL,
  badge: badgeGodsNumber(BIC_GODS_NUMBER),
  caveatTitle: CAVEAT_TITLE_OPTIMAL,
  caveatBody: {
    zh: 'Bicube(Uwe Meffert 的受限 3×3×3,角与棱被粘成 2×1×1 块,多数面被 bandaging 锁住)的可达状态恰为 1,108,800 个,每态的精确最优距离已离线算好、压成约 1.8MB 的距离表;浏览器首次求解时加载它(常驻约 10MB),再沿表梯度下降,所以这里给出的是真正的最短解,不是近似。任何打乱最多 28 步可还原(面转计步,出处 jaapsch.net),平均约 18.80 步。',
    en: 'The Bicube (Uwe Meffert\'s bandaged 3×3×3 — a corner and an edge glued into 2×1×1 blocks, most faces locked by bandaging) has exactly 1,108,800 reachable states; the exact optimal distance of every state is precomputed offline into a ~1.8MB table. The browser loads it on the first solve (~10MB resident) and follows it by gradient descent, so every solution here is a true shortest path, not an approximation. Any scramble solves in at most 28 moves (face-turn metric, figure from jaapsch.net), ~18.80 on average.',
  },
  validate: (line) => {
    for (const tok of line.trim().split(/\s+/)) {
      if (tok && !BIC_TOKEN_RE.test(tok)) return tok;
    }
    return null;
  },
  randomOne: () => cstimerScramble('bic'),
};

export default function BicSolverPage() {
  return <PuzzleSolverPage spec={SPEC} />;
}
