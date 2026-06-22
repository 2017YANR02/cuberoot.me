// NOTE: 批量执行所有统计
// 用法：npx tsx src/bin/compute_all.ts
// 环境变量：
//   STATS_FILTER — 逗号分隔统计 ID（为空=全部）
//   NODE_OPTIONS='--expose-gc --max-old-space-size=6144'
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import { closePool } from '../core/database.js';
import { REGISTRY } from './compute.js';
import { RoundMetric } from '../core/round_metric.js';
import { AoRounds } from '../core/ao_rounds.js';
import { AverageOfX } from '../core/average_of_x.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// NOTE: ALL_MERGED——被聚合页面包含的子统计 ID
// 这些子统计已在 wr_metric / wr_aoxr / average_of 中执行，不单独运行
const MERGED_INTO_METRIC = [
  'wr_single_history', 'wr_average_history',
  'wr_bao5', 'wr_wao5', 'wr_mo5', 'wr_bpa', 'wr_wpa',
  'wr_median', 'wr_best_counting', 'wr_worst_counting', 'wr_worst',
  'wr_variance', 'wr_best_average_ratio',
];
const MERGED_INTO_AOXR = ['wr_ao1r', 'wr_ao2r', 'wr_ao3r', 'wr_ao4r'];
const MERGED_INTO_AVERAGE_OF = [
  'average_of_3', 'average_of_5', 'average_of_12',
  'average_of_25', 'average_of_50', 'average_of_100', 'average_of_1000',
];
const ALL_MERGED = new Set([
  ...MERGED_INTO_METRIC, ...MERGED_INTO_AOXR, ...MERGED_INTO_AVERAGE_OF,
]);

// NOTE: 优先统计——聚合页面排最前，确保缓存及时释放
const PRIORITY_STATS = [
  'wr_newcomer', 'wr_metric', 'wr_aoxr', 'average_of',
  'first_r_is_wr', 'wr_dominance',
];

// NOTE: HEAVY_STATS——这些统计 RSS > 3GB
// 在子进程（child_process.fork）中隔离执行，退出后 OS 回收全部内存
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


// NOTE: fork 隔离执行——在独立子进程中运行统计，退出后 OS 回收全部内存
// 复用 compute.ts 作为子进程入口（已具备独立运行任何统计的能力）
function runIsolated(statId: string): Promise<{ success: boolean }> {
  return new Promise((res) => {
    const workerScript = resolve(__dirname, 'compute.ts');
    const child = fork(workerScript, [statId], {
      // NOTE: stdio 'inherit' 让子进程的 stdout/stderr 直接打印到主进程控制台
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      res({ success: code === 0 });
    });
    child.on('error', () => {
      res({ success: false });
    });
  });
}

// NOTE: 聚合页面完成后清除基类缓存
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

// NOTE: 聚合统计必须在主进程执行（有类级缓存依赖），即使被标记为 HEAVY 也不能隔离
const AGGREGATE_IDS = new Set(Object.keys(AGGREGATE_CACHE_CLEANUP));

// NOTE: 构建执行顺序——优先统计 + 其余（排除 ALL_MERGED）
function buildOrderedIds(): string[] {
  const allIds = Object.keys(REGISTRY);
  const prioritized = PRIORITY_STATS.filter(id => allIds.includes(id));
  const rest = allIds.filter(id => !PRIORITY_STATS.includes(id) && !ALL_MERGED.has(id));
  return [...prioritized, ...rest];
}

async function main() {
  const outputDir = resolve(__dirname, '../../../../../stats');
  mkdirSync(outputDir, { recursive: true });

  let orderedIds = buildOrderedIds();

  // NOTE: 支持 STATS_FILTER 环境变量
  const filter = process.env['STATS_FILTER'];
  if (filter && filter.trim()) {
    const filterIds = filter.split(',').map(s => s.trim());
    orderedIds = orderedIds.filter(id => filterIds.includes(id));
    console.log(`STATS_FILTER active: ${filterIds.join(', ')} (${orderedIds.length} matched)`);
  }

  // 并行度:opt-in via PARALLEL=N。默认 1 = 原串行行为。聚合 stat (wr_metric/wr_aoxr/
  // average_of) 有类级缓存依赖必须保持串行,这里只并行 priority 段之后的"light rest"。
  const parallel = Math.max(1, Math.min(8, Number(process.env['PARALLEL'] || '1') || 1));

  const totalStart = Date.now();
  let passed = 0;
  let failed = 0;
  let doneCount = 0;
  const total = orderedIds.length;

  type RunOutcome = { success: boolean; isHeavy: boolean; duration: string; mem: number; tag: string };

  async function runOne(statId: string): Promise<RunOutcome> {
    const startTime = Date.now();
    const isHeavy = HEAVY_STATS.has(statId);
    const shouldIsolate = isHeavy && !AGGREGATE_IDS.has(statId);

    if (shouldIsolate) {
      const { success } = await runIsolated(statId);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const mem = Math.round(process.memoryUsage.rss() / 1024 / 1024);
      return { success, isHeavy, duration, mem, tag: ' [HEAVY:isolated]' };
    }
    try {
      const mod = await REGISTRY[statId]();
      const StatClass = Object.values(mod).find(
        (v): v is new () => import('../core/statistic.js').Statistic =>
          typeof v === 'function' && v.prototype
      );
      if (!StatClass) throw new Error(`模块 ${statId} 中未找到统计类`);

      let stat: InstanceType<typeof StatClass> | null = new StatClass();
      let json: Record<string, unknown> | null = await stat.toJson() as unknown as Record<string, unknown>;
      stat = null;
      if (global.gc) global.gc();

      const outputPath = resolve(outputDir, `${statId}.json`);
      writeFileSync(outputPath, JSON.stringify(json, null, 2), 'utf-8');
      json = null;
      if (global.gc) global.gc();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const mem = Math.round(process.memoryUsage.rss() / 1024 / 1024);
      return { success: true, isHeavy, duration, mem, tag: isHeavy ? ' [HEAVY]' : '' };
    } catch (err) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`    ${err instanceof Error ? err.message : String(err)}`);
      return { success: false, isHeavy, duration, mem: 0, tag: ' FAILED' };
    }
  }

  async function execAndLog(statId: string): Promise<void> {
    const out = await runOne(statId);
    doneCount += 1;
    if (out.success) {
      console.log(`  [${doneCount}/${total}] ${statId.padEnd(50)} ${out.duration.padStart(6)}s  [${out.mem}MB]${out.tag}`);
      passed++;
    } else {
      console.error(`  [${doneCount}/${total}] ${statId.padEnd(50)} ${out.duration.padStart(6)}s ${out.tag}`);
      failed++;
    }
    if (AGGREGATE_CACHE_CLEANUP[statId]) {
      AGGREGATE_CACHE_CLEANUP[statId]();
      if (global.gc) global.gc();
    }
  }

  // priority + aggregate 段:必须串行
  const prioritySet = new Set(PRIORITY_STATS);
  const prioritySeq = orderedIds.filter(id => prioritySet.has(id));
  const restIds = orderedIds.filter(id => !prioritySet.has(id));

  console.log(`Computing ${total} statistics (priority serial ${prioritySeq.length}, rest parallel=${parallel} × ${restIds.length})`);

  for (const id of prioritySeq) {
    await execAndLog(id);
  }

  // rest:opt-in 并行,默认串行。pLimit 微型实现避免新依赖。
  if (parallel <= 1) {
    for (const id of restIds) await execAndLog(id);
  } else {
    let cursor = 0;
    const workers: Promise<void>[] = [];
    const next = async (): Promise<void> => {
      while (cursor < restIds.length) {
        const i = cursor++;
        await execAndLog(restIds[i]);
      }
    };
    for (let w = 0; w < parallel; w++) workers.push(next());
    await Promise.all(workers);
  }

  const totalDuration = ((Date.now() - totalStart) / 1000).toFixed(1);
  console.log(`\nDone: ${passed} passed, ${failed} failed (${totalDuration}s total)`);

  await closePool();

  if (failed > 0) process.exit(1);
}

main();
