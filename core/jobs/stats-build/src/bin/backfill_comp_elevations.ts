// NOTE: 一次性回填:给已提交的 stats/all_past_comps.json + all_upcoming_comps.json 就地补 elevation 字段,
// 并建全量坐标缓存 stats/comp_elevations.json。之后 CI 的 gen_all_comps / fetch_upcoming_comps
// 重新生成时缓存全命中,只有新场馆才发 API 请求。缓存误删时重跑本脚本即可重建。
//
// 用法：npx tsx src/bin/backfill_comp_elevations.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enrichCompElevations } from '../elevation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../../../../');
const CACHE_PATH = resolve(ROOT_DIR, 'stats/comp_elevations.json');

interface CompLike {
  latitude_degrees?: number | null;
  longitude_degrees?: number | null;
  elevation?: number;
}

async function backfill(relPath: string): Promise<number> {
  const path = resolve(ROOT_DIR, relPath);
  const comps = JSON.parse(readFileSync(path, 'utf-8')) as CompLike[];
  const { failed } = await enrichCompElevations(comps, CACHE_PATH);
  writeFileSync(path, JSON.stringify(comps), 'utf-8');
  console.log(`[ELEV] 已回写 ${relPath} (${comps.length} 场)`);
  return failed;
}

async function main(): Promise<void> {
  let remaining = 0;
  // upcoming 在前:列表默认视图最先看到未来比赛,且它只有几百个坐标;
  // past 1.7 万场放后面,配额(5000 坐标/时)耗尽就留给下一轮
  remaining += await backfill('stats/all_upcoming_comps.json');
  remaining += await backfill('stats/all_past_comps.json');
  // ASCII 标记供外层循环判断是否收工(API 有小时/日配额,一轮可能跑不完)
  console.log(`ELEV_REMAINING=${remaining}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
