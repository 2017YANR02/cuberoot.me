// 本地跑各 puzzle 求解器证明(tests/*_solver.test.ts)。这一族默认被 vitest.config 按
// RUN_SOLVER_TESTS 排除出 CI(确定性证明,改了求解器才需要重跑),这里设上该 env 再跑。
//
//   pnpm -F @cuberoot/client test:solvers           # 全部
//   pnpm -F @cuberoot/client test:solvers bic        # 只跑名字含 bic 的(vitest 文件名过滤)
//   pnpm -F @cuberoot/client test:solvers sq1 cuboid # 多个过滤
import { spawnSync } from 'node:child_process';

const filters = process.argv.slice(2);
const targets = filters.length ? filters : ['tests/**/*_solver.test.ts'];

const r = spawnSync('pnpm', ['exec', 'vitest', 'run', ...targets], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, RUN_SOLVER_TESTS: '1' },
});
process.exit(r.status ?? 1);
