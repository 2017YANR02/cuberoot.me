'use client';

/**
 * /scramble/pyraminx — 金字塔(Pyraminx)在线整解最优求解器。
 * Rust pyraminx_solver(核心 933,120 态全空间精确表 + 错位 tips 精确加法口径)
 * → WASM 零表下载,首查现场 BFS(0.9MB)。吃全 WCA pyram 记号(大写核心 + 小写 tips)。
 */
import {
  PuzzleOptimalSolver,
  type OptimalSolverSpec,
} from '../_components/PuzzleOptimalSolver';

const SPEC: OptimalSolverSpec = {
  event: 'pyram',
  title: { zh: '金字塔最优求解', en: 'Pyraminx Optimal Solver', zhHant: '金字塔最優求解' },
  lead: {
    zh: '任意金字塔打乱的整解最优 HTM 解(核心全空间 933,120 态精确表 + 顶点精确口径,最优解至多 15 步)。支持全 WCA 记号:大写 U / L / R / B 与小写顶点 u / l / r / b。',
    en: 'Optimal HTM solution for any Pyraminx scramble (exact full-space table over 933,120 core states plus exact tip accounting; God\'s number is 15 including tips). Full WCA notation supported: uppercase U / L / R / B and lowercase tips u / l / r / b.',
    zhHant: '任意金字塔打亂的整解最優 HTM 解(核心全空間 933,120 態精確表 + 頂點精確口徑,最優解至多 15 步)。支援全 WCA 記號:大寫 U / L / R / B 與小寫頂點 u / l / r / b。',
  },
  metric: 'HTM',
  need: 'pyraminx',
  solve: (pool, scramble) => pool.solvePyraminxMoves(scramble),
  tokenRe: /^[URLBurlb]['2]?$/,
  placeholder: {
    zh: "输入打乱,如 R U R' B' U' l b",
    en: "Enter a scramble, e.g. R U R' B' U' l b",
    zhHant: "輸入打亂,如 R U R' B' U' l b",
  },
};

export default function PyraminxOptimalSolverPage() {
  return <PuzzleOptimalSolver spec={SPEC} />;
}
