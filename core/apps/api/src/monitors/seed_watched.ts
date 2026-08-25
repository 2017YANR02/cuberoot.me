/**
 * 关注选手一次性导入脚本 —— 手动跑,服务器不启动它。
 *
 * 权威名单已进 git:committed migration `0025_seed_watched_persons.sql`(部署自动 seed
 * watched_persons 表),正常无需手跑本脚本。仅当要从外部 JSON({ "选手名": "2009ZEMD01" })
 * 临时重灌时用,必须显式传文件路径。每条 upsert 进 watched_persons(wca_id 主键,match_key = 名字 / CJK key)。
 *
 * 用法:
 *   node --env-file=.env dist/monitors/seed_watched.js <path/to/watched_ids.json>
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { query } from '../db/connection.js';

export async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) {
    console.error('[seed-watched] usage: seed_watched.js <path/to/watched_ids.json> (权威名单见 migration 0025)');
    process.exit(1);
  }
  const raw = readFileSync(path, 'utf-8');
  const map = JSON.parse(raw) as Record<string, string>;

  let n = 0;
  for (const [name, wcaId] of Object.entries(map)) {
    if (!wcaId) continue;
    await query(
      `INSERT INTO watched_persons (wca_id, match_key)
       VALUES (?, ?)
       ON CONFLICT (wca_id) DO UPDATE SET match_key = EXCLUDED.match_key`,
      [wcaId, name],
    );
    n++;
  }
  console.log(`[seed-watched] upserted ${n} watched persons from ${path}`);
}

// 直接 node 调用时执行(import 时不跑)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('[seed-watched] failed:', e);
      process.exit(1);
    });
}
