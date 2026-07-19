// 约束守卫:/scramble/solver 的 "puzzle-optimal" 求解器页一律走共享基座
// app/[lang]/scramble/solver/_components/PuzzleSolverPage.tsx(config 驱动的 SolverSpec +
// 一行 <PuzzleSolverPage spec={SPEC} />),不许再各自手搓 SolveState/reqRef/renderSingle 那套
// ~130 行样板(28 个求解器已折叠掉,历史上是复制粘贴重灾区)。
//
// 这是 ratchet:BESPOKE 锁住"合法不走基座"的白名单。目前只剩 2 个真异形:
//   _Cube3Solver — 1331 行旗舰 3×3 最优器,自带大量自定义 UI,不套基座
//   _Sq1Solver   — 带自定义可视化,结构与单行族不同
// 新写的 _XxxSolver.tsx 若没 import PuzzleSolverPage,集合就变 → CI 红。两条出路:
//   ① 它其实是单行族 → 照 _IvySolver.tsx 迁到 SolverSpec + 基座(集合不变,推荐);
//   ② 它真是异形(自定义 UI)→ 把文件名加进 BESPOKE(改白名单当 review 信号)。
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SOLVER_DIR = join(ROOT, 'app', '[lang]', 'scramble', 'solver');

// 合法"不走基座"的异形求解器(自定义 UI,与单行 puzzle-optimal 族不同)。
const BESPOKE = ['_Cube3Solver.tsx', '_Sq1Solver.tsx'];

describe('scramble/solver — puzzle-optimal pages share PuzzleSolverPage base', () => {
  it('every _*Solver.tsx imports PuzzleSolverPage except the known bespoke set', () => {
    const files = readdirSync(SOLVER_DIR)
      .filter((n) => /^_.*Solver\.tsx$/.test(n))
      .sort();

    const notShared = files.filter(
      (n) => !readFileSync(join(SOLVER_DIR, n), 'utf8').includes('PuzzleSolverPage'),
    );

    expect(
      notShared.sort(),
      `Solvers not on the shared base: ${notShared.join(', ') || '(none)'}.\n` +
        `Expected exactly the bespoke set: ${BESPOKE.join(', ')}.\n` +
        `A new single-line solver should migrate onto PuzzleSolverPage (see _IvySolver.tsx); ` +
        `a genuinely bespoke one should be added to BESPOKE in this test (review signal).`,
    ).toEqual([...BESPOKE].sort());
  });
});
