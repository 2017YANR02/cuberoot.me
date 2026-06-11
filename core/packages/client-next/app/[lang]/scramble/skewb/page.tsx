'use client';

/**
 * /scramble/skewb — 斜转(Skewb)在线整解最优求解器。
 * Rust skewb_solver(全空间 3,149,280 态精确距离表)→ WASM 零表下载,
 * 首查现场 BFS(3.0MB)。吃全 WCA skewb 记号(U/L/R/B ± ',每步 ±120°)。
 */
import {
  PuzzleOptimalSolver,
  type OptimalSolverSpec,
} from '../_components/PuzzleOptimalSolver';

const SPEC: OptimalSolverSpec = {
  event: 'skewb',
  title: { zh: '斜转最优求解', en: 'Skewb Optimal Solver', zhHant: '斜轉最優求解' },
  lead: {
    zh: '任意斜转打乱的整解最优解(全空间 3,149,280 态精确表,每 120° 转一步,最优解至多 11 步)。支持全 WCA 记号:U / L / R / B,可带 \'。',
    en: "Optimal solution for any Skewb scramble (exact full-space table over 3,149,280 states; one move per 120° turn, God's number is 11). Full WCA notation supported: U / L / R / B with optional '.",
    zhHant: '任意斜轉打亂的整解最優解(全空間 3,149,280 態精確表,每 120° 轉一步,最優解至多 11 步)。支援全 WCA 記號:U / L / R / B,可帶 \'。',
  },
  metric: 'HTM',
  need: 'skewb',
  solve: (pool, scramble) => pool.solveSkewbMoves(scramble),
  tokenRe: /^[ULRB]['2]?$/,
  placeholder: {
    zh: "输入打乱,如 U L' R B' U' R L",
    en: "Enter a scramble, e.g. U L' R B' U' R L",
    zhHant: "輸入打亂,如 U L' R B' U' R L",
  },
};

export default function SkewbOptimalSolverPage() {
  return <PuzzleOptimalSolver spec={SPEC} />;
}
