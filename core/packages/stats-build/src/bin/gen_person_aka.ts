// 生成 wca_person_aka 小表的灌库 SQL(名录「含曾用名」口径用)。
// 数据源:WCA dump 的 persons 表 sub_id>1 历史曾用名 + sub_id=1 现名。
// 口径与 stats-build/statistics/name_stats.ts 的 _aka 面板完全一致:
//   former = 去重后、与现名不同的曾用名;combined = `现名(全名) + ' ' + 各曾用名`;aka_len = [...combined].length。
// 全站仅 ~400 人有曾用名,近静态。用法:
//   npx tsx src/bin/gen_person_aka.ts   →  output/wca_person_aka.load.sql
//   scp + psql -f 灌进生产 PG(详见 migration 0053)。
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { RowDataPacket } from 'mysql2';
import { query, closePool } from '../core/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

type NameRow = RowDataPacket & { wca_id: string; name: string };

// SQL 单引号转义(名字里可能有 O'Brien 之类)
const sqlStr = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function main() {
  const current = await query<NameRow[]>('SELECT wca_id, name FROM persons WHERE sub_id = 1');
  const currentName = new Map<string, string>();
  for (const r of current) currentName.set(r.wca_id, r.name);

  const former = await query<NameRow[]>('SELECT wca_id, name FROM persons WHERE sub_id > 1 ORDER BY wca_id, sub_id');
  const formerByWcaId = new Map<string, string[]>();
  for (const r of former) {
    const arr = formerByWcaId.get(r.wca_id) ?? [];
    arr.push(r.name);
    formerByWcaId.set(r.wca_id, arr);
  }

  const rows: { wcaId: string; former: string[]; akaLen: number }[] = [];
  for (const [wcaId, formers] of formerByWcaId) {
    const cur = currentName.get(wcaId);
    if (!cur) continue; // 该 wca_id 无现名行(理论上不该发生)
    const distinct = formers.filter((n, i, a) => n !== cur && a.indexOf(n) === i);
    if (!distinct.length) continue; // 纯改国籍(曾用名 = 现名),跳过
    const combined = `${cur} ${distinct.join(' ')}`;
    rows.push({ wcaId, former: distinct, akaLen: [...combined].length });
  }

  const values = rows
    .map(r => `(${sqlStr(r.wcaId)}, ${sqlStr(JSON.stringify(r.former))}, ${r.akaLen})`)
    .join(',\n');

  const sql = `-- 自动生成:gen_person_aka.ts。${rows.length} 人有曾用名。勿手改。
BEGIN;
TRUNCATE wca_person_aka;
INSERT INTO wca_person_aka (wca_id, former_names, aka_len) VALUES
${values};
COMMIT;
ANALYZE wca_person_aka;
`;

  const outDir = resolve(__dirname, '../../output');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'wca_person_aka.load.sql');
  writeFileSync(outPath, sql, 'utf-8');
  console.log(`完成: ${outPath}  (${rows.length} 行)`);
  await closePool();
}

main().catch(async e => { console.error(e); await closePool(); process.exit(1); });
