/**
 * 关注选手一次性导入脚本 —— 手动跑,服务器不启动它。
 *
 * 生产灌库是一次性操作:关注名单是个人偏好、不进 git(从本机 gitignore 的
 * D:\cube\wca-monitor\watched_wca_ids_cache.json 读,形如 { "选手名": "2009ZEMD01" })。
 * 每条 upsert 进 watched_persons(wca_id 主键,match_key = 名字 / CJK key)。
 *
 * 用法:
 *   node --env-file=.env dist/monitors/seed_watched.js [path/to/watched_wca_ids_cache.json]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { query } from '../db/connection.js';

const DEFAULT_PATH = 'D:\\cube\\wca-monitor\\watched_wca_ids_cache.json';

export async function main(): Promise<void> {
  const path = process.argv[2] || DEFAULT_PATH;
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
