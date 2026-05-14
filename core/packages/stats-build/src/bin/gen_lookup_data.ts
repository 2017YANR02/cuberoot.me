// 生成 stats/person_countries.json + stats/comp_countries.json
// 给前端 personFlagIso2() / compFlagIso2() 用（country_flags.ts loadFlagData）
// NOTE: dump 全部 sub_id=1 选手（~282K，gzip 后 ~700KB，前端懒加载）。
import { writeFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, closePool } from '../core/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATS_DIR = resolve(__dirname, '../../../../../stats');

async function main() {
  // ── person_countries.json: wca_id → iso2 ──
  // NOTE: JOIN countries 直接拿 iso2，省一道前端转换
  console.log('[lookup-data] querying persons...');
  const personRows = await query<any>(
    `SELECT p.wca_id, c.iso2
     FROM persons p
     JOIN countries c ON c.id = p.country_id
     WHERE p.sub_id = 1
     ORDER BY p.wca_id`,
  );
  const personMap: Record<string, string> = {};
  for (const r of personRows) {
    personMap[String(r.wca_id)] = String(r.iso2 || '').toLowerCase();
  }
  const personPath = resolve(STATS_DIR, 'person_countries.json');
  writeFileSync(personPath, JSON.stringify(personMap), 'utf-8');
  console.log(`  person_countries.json: ${personRows.length} persons, ${statSync(personPath).size} bytes`);

  // ── comp_countries.json: comp_id → country_id（string，不是 iso2） ──
  // NOTE: 与历史格式保持一致——前端 compFlagIso2() 内部走 countryToIso2() 二次转换
  console.log('[lookup-data] querying competitions...');
  const compRows = await query<any>(
    `SELECT id, country_id FROM competitions ORDER BY id`,
  );
  const compMap: Record<string, string> = {};
  for (const r of compRows) {
    compMap[String(r.id)] = String(r.country_id);
  }
  const compPath = resolve(STATS_DIR, 'comp_countries.json');
  writeFileSync(compPath, JSON.stringify(compMap, null, 4), 'utf-8');
  console.log(`  comp_countries.json: ${compRows.length} competitions, ${statSync(compPath).size} bytes`);

  await closePool();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
