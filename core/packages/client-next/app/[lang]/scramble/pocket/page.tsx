'use client';

/**
 * /scramble/pocket — 2x2x2 口袋魔方在线整解最优求解器。
 * Rust pocket_solver(3,674,160 态全空间精确表)→ WASM 零表下载,首查现场 BFS。
 * 支持全 18 面转记号(2x2x2 无中心,D/L/B 经 24 旋转归一,解带整体旋转前缀)。
 */
import {
  PuzzleOptimalSolver,
  type OptimalSolverSpec,
} from '../_components/PuzzleOptimalSolver';

const SPEC: OptimalSolverSpec = {
  event: '222',
  title: { zh: '2x2x2 最优求解', en: '2x2x2 Optimal Solver', zhHant: '2x2x2 最優求解' },
  lead: {
    zh: '任意 2x2x2 打乱的整解最优 HTM 解(全空间 3,674,160 态精确表,最优解至多 11 步)。支持 D / L / B 记号,解可带整体旋转前缀。',
    en: 'Optimal HTM solution for any 2x2x2 scramble (exact full-space table over 3,674,160 states; God\'s number is 11). D / L / B tokens are supported; solutions may start with a whole-cube rotation.',
    zhHant: '任意 2x2x2 打亂的整解最優 HTM 解(全空間 3,674,160 態精確表,最優解至多 11 步)。支援 D / L / B 記號,解可帶整體旋轉字首。',
  },
  metric: 'HTM',
  need: 'pocket',
  solve: (pool, scramble) => pool.solvePocketMoves(scramble),
  tokenRe: /^[URFDLB][2']?$/,
};

export default function PocketOptimalSolverPage() {
  return <PuzzleOptimalSolver spec={SPEC} />;
}
