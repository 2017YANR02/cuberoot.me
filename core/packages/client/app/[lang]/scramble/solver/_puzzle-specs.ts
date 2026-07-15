import type { OptimalSolverSpec } from '../_components/PuzzleOptimalSolver';

// 非 3×3 puzzle 的求解器配置(原 /scramble/{pocket,pyraminx,skewb}/page.tsx 各自的 SPEC)。
// 三个 puzzle 共用 PuzzleOptimalSolver(Rust WASM 全空间精确表,无 COEP),现一并合进统一的
// /scramble/solver?event= 路由,由 dispatcher 按 event 选 spec。3×3(cubeopt/COEP)与 SQ1
// (纯 TS)各有独立组件,不在此表。
export const SPEC_BY_EVENT: Record<string, OptimalSolverSpec> = {
  '222': {
    event: '222',
    title: { zh: '2x2x2 最优求解', en: '2x2x2 Optimal Solver' },
    lead: {
      zh: '任意 2x2x2 打乱的整解最优 HTM 解(全空间 3,674,160 态精确表,最优解至多 11 步)。支持 D / L / B 记号,解可带整体旋转前缀。',
      en: 'Optimal HTM solution for any 2x2x2 scramble (exact full-space table over 3,674,160 states; God\'s number is 11). D / L / B tokens are supported; solutions may start with a whole-cube rotation.',
    },
    metric: 'HTM',
    need: '222',
    solve: (pool, scramble) => pool.solveCube222Moves(scramble),
    tokenRe: /^[URFDLB][2']?$/,
  },
  pyram: {
    event: 'pyram',
    title: { zh: '金字塔最优求解', en: 'Pyraminx Optimal Solver' },
    lead: {
      zh: '任意金字塔打乱的整解最优 HTM 解(核心全空间 933,120 态精确表 + 顶点精确口径,最优解至多 15 步)。支持全 WCA 记号:大写 U / L / R / B 与小写顶点 u / l / r / b。',
      en: 'Optimal HTM solution for any Pyraminx scramble (exact full-space table over 933,120 core states plus exact tip accounting; God\'s number is 15 including tips). Full WCA notation supported: uppercase U / L / R / B and lowercase tips u / l / r / b.',
    },
    metric: 'HTM',
    need: 'pyraminx',
    solve: (pool, scramble) => pool.solvePyraminxMoves(scramble),
    tokenRe: /^[URLBurlb]['2]?$/,
  },
  skewb: {
    event: 'skewb',
    title: { zh: '斜转最优求解', en: 'Skewb Optimal Solver' },
    lead: {
      zh: '任意斜转打乱的整解最优解(全空间 3,149,280 态精确表,每 120° 转一步,最优解至多 11 步)。支持全 WCA 记号:U / L / R / B,可带 \'。',
      en: "Optimal solution for any Skewb scramble (exact full-space table over 3,149,280 states; one move per 120° turn, God's number is 11). Full WCA notation supported: U / L / R / B with optional '.",
    },
    metric: 'HTM',
    need: 'skewb',
    solve: (pool, scramble) => pool.solveSkewbMoves(scramble),
    tokenRe: /^[ULRB]['2]?$/,
  },
};
