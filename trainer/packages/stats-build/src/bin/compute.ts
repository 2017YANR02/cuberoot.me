// NOTE: CLI 入口——运行指定统计并输出 JSON
// 用法：npx tsx src/bin/compute.ts <stat_id>
// 示例：npx tsx src/bin/compute.ts current_world_records_by_country
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { closePool } from '../core/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// NOTE: 统计文件注册表——手动添加新统计
// 后续可改为自动扫描 statistics/ 目录
const REGISTRY: Record<string, () => Promise<Record<string, unknown>>> = {
  'current_world_records_by_country': () => import('../statistics/current_world_records_by_country.js'),
  'world_championship_podiums_by_person': () => import('../statistics/world_championship_podiums_by_person.js'),
};

async function main() {
  const statId = process.argv[2];

  if (!statId) {
    console.error('用法: npx tsx src/bin/compute.ts <stat_id>');
    console.error('可用统计:', Object.keys(REGISTRY).join(', '));
    process.exit(1);
  }

  if (!REGISTRY[statId]) {
    console.error(`未知统计: ${statId}`);
    console.error('可用统计:', Object.keys(REGISTRY).join(', '));
    process.exit(1);
  }

  console.log(`正在计算: ${statId}`);
  const startTime = Date.now();

  try {
    // NOTE: 动态导入统计模块，取第一个导出的类
    const mod = await REGISTRY[statId]();
    const StatClass = Object.values(mod).find(
      (v): v is new () => import('../core/statistic.js').Statistic =>
        typeof v === 'function' && v.prototype
    );

    if (!StatClass) {
      throw new Error(`模块 ${statId} 中未找到统计类`);
    }

    const stat = new StatClass();
    const json = await stat.toJson();

    // NOTE: 输出 JSON 到 stats/data/ 目录
    const outputDir = resolve(__dirname, '../../../../../stats/data');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = resolve(outputDir, `${statId}.json`);
    writeFileSync(outputPath, JSON.stringify(json, null, 2), 'utf-8');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`完成: ${outputPath} (${duration}s)`);
  } catch (err) {
    console.error('错误:', err);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
