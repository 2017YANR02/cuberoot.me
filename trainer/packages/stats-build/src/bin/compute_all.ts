// NOTE: 批量执行所有统计——与 Ruby compute_all.rb 等价
// 用法：npx tsx src/bin/compute_all.ts
// 环境变量：
//   STATS_FILTER — 逗号分隔统计 ID（为空=全部）
//   NODE_OPTIONS='--expose-gc --max-old-space-size=6144'
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { closePool } from '../core/database.js';
import { REGISTRY } from './compute.js';
import { RoundMetric } from '../core/round_metric.js';
import { AoRounds } from '../core/ao_rounds.js';
import { AverageOfX } from '../core/average_of_x.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// NOTE: 与 Ruby index.rb ALL_MERGED 一致——被聚合页面包含的子统计 ID
// 这些子统计已在 wr_metric / wr_aoxr / average_of 中执行，不单独运行
const MERGED_INTO_METRIC = [
  'wr_single_history', 'wr_average_history',
  'wr_bao5', 'wr_wao5', 'wr_mo5', 'wr_bpa', 'wr_wpa',
  'wr_median', 'wr_best_counting', 'wr_worst_counting', 'wr_worst',
  'wr_variance', 'wr_best_average_ratio',
  'mbf_average',
];
const MERGED_INTO_AOXR = ['wr_ao1r', 'wr_ao2r', 'wr_ao3r', 'wr_ao4r'];
const MERGED_INTO_AVERAGE_OF = [
  'average_of_3', 'average_of_5', 'average_of_12',
  'average_of_25', 'average_of_50', 'average_of_100', 'average_of_1000',
];
const ALL_MERGED = new Set([
  ...MERGED_INTO_METRIC, ...MERGED_INTO_AOXR, ...MERGED_INTO_AVERAGE_OF,
]);

// NOTE: 与 Ruby PRIORITY_STATS 一致——聚合页面排最前，确保缓存及时释放
const PRIORITY_STATS = [
  'wr_newcomer', 'wr_metric', 'wr_aoxr', 'average_of',
  'wr_current', 'first_r_is_wr', 'wr_dominance',
];

// NOTE: 与 Ruby HEAVY_STATS 一致——这些统计 RSS > 3GB，但 TS 版串行执行不需分离
// 保留此列表仅用于日志标记
const HEAVY_STATS = new Set([
  'longest_streak_of_podiums',
  'longest_streak_of_personal_records',
  'wr_dominance',
  'best_result_off_podium',
  'consecutive_sub_5_average',
  'wr_newcomer',
  'most_completed_solves',
  'most_competitions_before_winning',
  'smallest_diff_between_single_and_average',
  'most_frequent_results',
  'moving_average',
]);

// NOTE: 与 Ruby AGGREGATE_CACHE_CLEANUP 对应——聚合页面完成后清除基类缓存
// 结构：statId -> 清理函数
const AGGREGATE_CACHE_CLEANUP: Record<string, () => void> = {
  'wr_metric':  () => {
    RoundMetric.clearPrecomputed();
    console.log('  [Memory] Cleared RoundMetric precomputed rankings');
  },
  'wr_aoxr':    () => {
    AoRounds.clearPrecomputed();
    console.log('  [Memory] Cleared AoRounds precomputed cache');
  },
  'average_of': () => {
    AverageOfX.clearSharedCache();
    console.log('  [Memory] Cleared AverageOfX shared query cache');
  },
};

// NOTE: 构建执行顺序——优先统计 + 其余（排除 ALL_MERGED）
function buildOrderedIds(): string[] {
  const allIds = Object.keys(REGISTRY);
  const prioritized = PRIORITY_STATS.filter(id => allIds.includes(id));
  const rest = allIds.filter(id => !PRIORITY_STATS.includes(id) && !ALL_MERGED.has(id));
  return [...prioritized, ...rest];
}

async function main() {
  const outputDir = resolve(__dirname, '../../../../../stats/data');
  mkdirSync(outputDir, { recursive: true });

  let orderedIds = buildOrderedIds();

  // NOTE: 支持 STATS_FILTER 环境变量——与 Ruby 一致
  const filter = process.env['STATS_FILTER'];
  if (filter && filter.trim()) {
    const filterIds = filter.split(',').map(s => s.trim());
    orderedIds = orderedIds.filter(id => filterIds.includes(id));
    console.log(`STATS_FILTER active: ${filterIds.join(', ')} (${orderedIds.length} matched)`);
  }

  console.log(`Computing ${orderedIds.length} statistics (serial)`);
  const totalStart = Date.now();
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < orderedIds.length; i++) {
    const statId = orderedIds[i];
    const startTime = Date.now();

    try {
      // NOTE: 动态导入统计模块，取第一个导出的类
      const mod = await REGISTRY[statId]();
      const StatClass = Object.values(mod).find(
        (v): v is new () => import('../core/statistic.js').Statistic =>
          typeof v === 'function' && v.prototype
      );

      if (!StatClass) throw new Error(`模块 ${statId} 中未找到统计类`);

      let stat: InstanceType<typeof StatClass> | null = new StatClass();
      let json: Record<string, unknown> | null = await stat.toJson() as unknown as Record<string, unknown>;

      // NOTE: 照搬 Ruby — 释放实例 + GC
      stat = null;
      if (global.gc) global.gc();

      const outputPath = resolve(outputDir, `${statId}.json`);
      writeFileSync(outputPath, JSON.stringify(json, null, 2), 'utf-8');

      // NOTE: JSON 字符串化完成后释放
      json = null;
      if (global.gc) global.gc();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const mem = Math.round(process.memoryUsage.rss() / 1024 / 1024);
      const tag = HEAVY_STATS.has(statId) ? ' [HEAVY]' : '';
      // NOTE: 与 Ruby 日志格式对齐
      console.log(`  [${i + 1}/${orderedIds.length}] ${statId.padEnd(50)} ${duration.padStart(6)}s  [${mem}MB]${tag}`);
      passed++;
    } catch (err) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`  [${i + 1}/${orderedIds.length}] ${statId.padEnd(50)} ${duration.padStart(6)}s  FAILED`);
      console.error(`    ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }

    // NOTE: 聚合统计完成后清除基类缓存——与 Ruby AGGREGATE_CACHE_CLEANUP 对应
    if (AGGREGATE_CACHE_CLEANUP[statId]) {
      AGGREGATE_CACHE_CLEANUP[statId]();
      if (global.gc) global.gc();
    }
  }

  const totalDuration = ((Date.now() - totalStart) / 1000).toFixed(1);
  console.log(`\nDone: ${passed} passed, ${failed} failed (${totalDuration}s total)`);

  await closePool();

  if (failed > 0) process.exit(1);
}

main();
