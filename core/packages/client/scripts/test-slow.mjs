// 本地跑慢测(vitest.config 的 SLOW_TESTS,目前只有 analyzer_worker.test.ts ~257s)。
// 它默认被排除出 `pnpm test`,CI 独立跑 —— 改了 analyzer / worker 就在本地跑一次这个。
//
//   pnpm -F @cuberoot/client test:slow          # 只跑慢测
//   pnpm -F @cuberoot/client test:slow --all    # 先跑快测,再独占 CPU 跑慢测
import { spawnSync } from 'node:child_process';

const all = process.argv.includes('--all');

function run(targets, runSlow) {
  const env = { ...process.env };
  if (runSlow) env.RUN_SLOW_TESTS = '1';
  else delete env.RUN_SLOW_TESTS;
  return spawnSync('pnpm', ['exec', 'vitest', 'run', ...targets], {
    stdio: 'inherit',
    shell: true,
    env,
  }).status ?? 1;
}

if (all) {
  const fastStatus = run([], false);
  if (fastStatus !== 0) process.exit(fastStatus);
}

process.exit(run(['tests/analyzer_worker.test.ts'], true));
