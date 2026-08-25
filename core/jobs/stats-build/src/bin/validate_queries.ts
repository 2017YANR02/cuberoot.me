// NOTE: 用 EXPLAIN 校验所有 stat 的 SQL 语法,不实际执行查询
// 用法: npx tsx src/bin/validate_queries.ts
// 目的: 快速捕获 MySQL 8 保留字、列名拼错、表名拼错等只有运行时才暴露的错误
import { getPool, closePool } from '../core/database.js';
import { REGISTRY } from './compute.js';
import type { Statistic } from '../core/statistic.js';

interface Failure {
  statId: string;
  error: string;
}

async function explain(sql: string): Promise<void> {
  const p = getPool();
  await p.query(`EXPLAIN ${sql}`);
}

async function main(): Promise<void> {
  const failures: Failure[] = [];
  const skipped: string[] = [];
  let passed = 0;

  const ids = Object.keys(REGISTRY);
  console.log(`Validating ${ids.length} stat queries via EXPLAIN...\n`);

  for (const statId of ids) {
    try {
      const mod = await REGISTRY[statId]();
      const StatClass = Object.values(mod).find(
        (v): v is new () => Statistic =>
          typeof v === 'function' && (v as { prototype?: unknown }).prototype != null
      );
      if (!StatClass) {
        failures.push({ statId, error: '未找到统计类' });
        continue;
      }

      const stat = new StatClass();
      const sql = stat.query();

      if (!sql || !sql.trim()) {
        skipped.push(statId);
        console.log(`  ⊘ ${statId} (empty query — base class loops per-event)`);
        continue;
      }

      await explain(sql);
      passed++;
      console.log(`  ✓ ${statId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ statId, error: msg });
      console.log(`  ✗ ${statId}\n      ${msg.split('\n')[0]}`);
    }
  }

  console.log(
    `\nDone: ${passed} passed, ${failures.length} failed, ${skipped.length} skipped (${ids.length} total)`
  );

  if (failures.length > 0) {
    console.error('\n失败详情:');
    for (const f of failures) {
      console.error(`\n[${f.statId}]`);
      console.error(f.error);
    }
    await closePool();
    process.exit(1);
  }

  await closePool();
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  await closePool();
  process.exit(1);
});
