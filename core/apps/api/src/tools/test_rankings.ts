/**
 * wca_rankings 冒烟测试 —— 移植自退役 Python test_rankings.py。
 * 跑法(从 core/):pnpm --filter @cuberoot/server exec tsx src/tools/test_rankings.ts
 */
import { RankingCache } from './wca_rankings.js';

async function main(): Promise<void> {
  const cache = new RankingCache();
  console.log('Initializing rankings cache (may take a while)...');
  await cache.updateAll();

  if (!cache.isAvailable()) {
    console.log('Failed to initialize cache');
    return;
  }

  // 假设 WR 是 3.13 (313) → 应返回 1
  console.log(`Result 3.13 rank: ${cache.getWorldRank('333', 'single', 313)}`);
  // 假设 20.00 (2000) → 应 > 100 = null
  console.log(`Result 20.00 rank: ${cache.getWorldRank('333', 'single', 2000)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
