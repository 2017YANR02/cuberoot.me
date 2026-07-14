import { defineConfig, configDefaults } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Next.js 没有 vite，vitest 用自己的 config。`@/*` → 包根，对齐 tsconfig paths。
const root = path.dirname(fileURLToPath(import.meta.url));

// 慢测:一个文件就吃掉全集 99% 的墙钟。测试是按**文件**分线程并行跑的,所以整集耗时 =
// 最慢那一个文件 —— analyzer_worker 一个人 ~257s,其余 115 个文件早在它底下跑完了。
//
// 它不是「证一次就永真」那类(那是 *_solver.test.ts,CI 都不跑),而是 recon 分析器的**回归
// 防线**(锁死 53/7457/42664/21380 这类精确数值),**必须有人跑**。所以分层,不是删:
//   CI          → 跑(workflow 里显式置 RUN_SLOW_TESTS=1),4 分钟花在机器上,一条覆盖不少
//   本地 / AI   → 默认跳过(26s vs 260s),改了 analyzer / worker 才 `pnpm test:slow`
// 这是业界通行的分层:本地只跑够用的,全集交给 CI。
const SLOW_TESTS = ['tests/analyzer_worker.test.ts'];
const runSlow = !!process.env.CI || !!process.env.RUN_SLOW_TESTS;
if (!runSlow) {
  // 每次都吼一声 —— 别让「跳过」变成没人记得的静默行为
  console.log('[vitest] 跳过慢测 analyzer_worker(CI 会跑;本地改了 analyzer 请跑 pnpm test:slow)');
}

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
      ...(runSlow ? [] : SLOW_TESTS),
    ],
    environment: 'node',
    testTimeout: 120_000,
    pool: 'threads',
  },
});
