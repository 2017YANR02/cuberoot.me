// 本地跑慢测(vitest.config 的 SLOW_TESTS,目前只有 analyzer_worker.test.ts ~257s)。
// 它默认被排除出 `pnpm test`,CI 照跑 —— 改了 analyzer / worker 就在本地跑一次这个。
//
//   pnpm -F @cuberoot/client test:slow          # 只跑慢测
//   pnpm -F @cuberoot/client test:slow --all    # 全集(慢测 + 其余),等价于 CI 那一轮
import { spawnSync } from 'node:child_process';

const all = process.argv.includes('--all');
const targets = all ? [] : ['tests/analyzer_worker.test.ts'];

const r = spawnSync('pnpm', ['exec', 'vitest', 'run', ...targets], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, RUN_SLOW_TESTS: '1' },
});
process.exit(r.status ?? 1);
