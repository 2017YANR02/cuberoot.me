// 输出 stats/data/persons_search.json.gz —— 给前端 WcaPersonPicker 做本地索引
// 紧凑数组：[[wcaId, name, iso2], ...]，按 wca_id 升序
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';
import { query, closePool } from '../core/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, '../../../../../stats/data');
const OUTPUT_FILE = resolve(OUTPUT_DIR, 'persons_search.json.gz');

async function main() {
  console.log('[persons-search] querying persons + countries...');
  const rows = await query<any>(
    `SELECT p.wca_id, p.name, c.iso2
     FROM persons p
     JOIN countries c ON c.id = p.country_id
     WHERE p.sub_id = 1
     ORDER BY p.wca_id`,
  );
  console.log(`[persons-search] ${rows.length} persons`);

  const arr: Array<[string, string, string]> = rows.map((r: any) => [
    String(r.wca_id),
    String(r.name),
    String(r.iso2 || '').toLowerCase(),
  ]);

  const json = JSON.stringify(arr);
  const gz = gzipSync(Buffer.from(json, 'utf-8'), { level: 9 });

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, gz);

  console.log(`[persons-search] raw ${(json.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[persons-search] gzip ${(gz.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[persons-search] wrote ${OUTPUT_FILE}`);

  await closePool();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
