/**
 * 导出 wiki 术语表 DB → client 的 glossary.json(结构化双语活镜像)。
 *
 * 背景:glossary.json 曾是「一次性种子」(0009 导入后就冻结、会与线上 /wiki 漂移),
 * 但它其实是**活的搜索索引**——首页全站搜索(lib/site-search.ts)运行时 import 它。
 * 本脚本把它从死种子改成「随时可从 DB 重生成」的镜像:改完 /wiki 词条后跑一次,
 * 首页搜索 + termbase 参照即与线上一致。
 *
 * 形状(加字段不删字段,site-search 与 /wiki slug 仍用 combined head/body):
 *   { sections: [ { letter, entries: [ { head, body, headEn, headZh, bodyEn, bodyZh, source } ] } ] }
 *
 * 跑法:pnpm --filter @cuberoot/server gen-glossary
 * PG 连接走 src/db/connection.ts 同套 env(DB_HOST/PORT/USER/PASS/NAME)。
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { query, sql } from '../src/db/connection.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '../../client/app/[lang]/wiki/glossary.json');

interface Row {
  letter: string;
  position: number;
  head: string;
  body: string;
  head_en: string | null;
  head_zh: string | null;
  body_en: string | null;
  body_zh: string | null;
  source: string;
}

async function main() {
  const rows = await query<Row>(
    `SELECT letter, position, head, body, head_en, head_zh, body_en, body_zh, source
     FROM wiki_terms
     WHERE deleted_at IS NULL
     ORDER BY letter, position, id`,
  );

  // 未迁移的旧行(结构化列为 null)兜底:combined 塞进 EN 侧,避免 termbase 出现 null
  const structured = (r: Row) => {
    const migrated = r.head_en != null || r.head_zh != null || r.body_en != null || r.body_zh != null;
    return migrated
      ? { headEn: r.head_en ?? '', headZh: r.head_zh ?? '', bodyEn: r.body_en ?? '', bodyZh: r.body_zh ?? '' }
      : { headEn: r.head, headZh: '', bodyEn: r.body, bodyZh: '' };
  };

  const sectionsMap = new Map<string, Array<Record<string, string>>>();
  for (const r of rows) {
    const arr = sectionsMap.get(r.letter) ?? [];
    arr.push({ head: r.head, body: r.body, ...structured(r), source: r.source });
    sectionsMap.set(r.letter, arr);
  }
  const sections = Array.from(sectionsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, entries]) => ({ letter, entries }));

  await writeFile(OUT, JSON.stringify({ sections }, null, 2) + '\n', 'utf8');
  console.log(`✓ 导出 ${rows.length} 条 → ${OUT}`);
  await sql.end({ timeout: 5 });
}

main().catch((e) => { console.error(e); process.exit(1); });
