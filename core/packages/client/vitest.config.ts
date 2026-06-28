import { defineConfig, configDefaults } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Next.js 没有 vite，vitest 用自己的 config。`@/*` → 包根，对齐 tsconfig paths。
const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: `${root}/` }],
  },
  test: {
    include: ['tests/**/*.test.ts', 'lib/**/*.test.ts'],
    // 各 puzzle 求解器的正确性/最优性证明(tests/*_solver.test.ts)是确定性的:结果只取决于
    // 求解器代码,「证一次就成立」,没必要每次 push 在 CI 重跑(bic 那条还含 ~104s 全 110 万
    // 状态穷举)。默认从 CI / 常规 `pnpm test` 排除,改了某求解器就本地跑:
    //   pnpm -F @cuberoot/client test:solvers           # 跑全部 *_solver.test.ts
    //   pnpm -F @cuberoot/client test:solvers bic        # 只跑名字含 bic 的
    // (code-solvers-fleet-sync.test.ts 是注册哨兵,不是求解器证明,不匹配此 glob,照常每次跑。)
    exclude: [
      ...configDefaults.exclude,
      ...(process.env.RUN_SOLVER_TESTS ? [] : ['tests/**/*_solver.test.ts']),
    ],
    environment: 'node',
    testTimeout: 120_000,
    pool: 'threads',
  },
});
