/**
 * 一次性:生成 migration 0080_wiki_backfill_bilingual.sql —— 把 713 条 seed 词条的
 * 中英混排 head/body 拆成结构化 head_en/head_zh/body_en/body_zh。
 *
 * **从 DB 自身的 combined head/body 拆**(不是从 glossary.json),因为 DB 是真源:
 * glossary.json 曾与 DB 漂移(如某 URL 的 www 前缀),从 DB 拆保证 0080 的结构化值
 * 与该行 combined 值自洽,且在任何由 0009 种子过的库(本地/线上)上都一致。
 *
 * 幂等:0080 只 UPDATE 四个新列(不碰 combined),按 (source='seed', letter, position) 定位。
 * 跑法:pnpm --filter @cuberoot/server gen-wiki-backfill(需连到已跑过 0009 的库)。
 * 产出后:apply 0080 → pnpm gen-glossary 导出结构化 glossary.json。
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { query, sql } from '../src/db/connection.js';
import { splitTerm } from './lib/wiki-bilingual.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '../migrations/0080_wiki_backfill_bilingual.sql');
const TAG = '$wcbf$';

interface Row { letter: string; position: number; head: string; body: string }

async function main() {
  const rows = await query<Row>(
    `SELECT letter, position, head, body FROM wiki_terms
     WHERE source='seed' ORDER BY letter, position, id`,
  );

  const updates: string[] = [];
  for (const r of rows) {
    const { headEn, headZh, bodyEn, bodyZh } = splitTerm(r.head, r.body);
    for (const v of [headEn, headZh, bodyEn, bodyZh]) {
      if (v.includes(TAG)) throw new Error(`dollar-quote tag ${TAG} collides in: ${r.head}`);
    }
    const q = (v: string) => `${TAG}${v}${TAG}`;
    updates.push(
      `UPDATE wiki_terms SET head_en=${q(headEn)}, head_zh=${q(headZh)}, ` +
      `body_en=${q(bodyEn)}, body_zh=${q(bodyZh)} ` +
      `WHERE source='seed' AND letter='${r.letter}' AND position=${r.position};`,
    );
  }

  const out = `-- 0080_wiki_backfill_bilingual.sql
-- 一次性回填:把 seed 词条的中英混排 head/body 拆进 0079 新增的
-- head_en/head_zh/body_en/body_zh 结构化列。原 head/body 原样保留(搜索/slug/兜底)。
-- 由 packages/server/scripts/gen-wiki-backfill.ts 从 DB 自身 combined 值生成,勿手改。
-- 拆分规则见 scripts/lib/wiki-bilingual.mjs(首汉字切分,实测 713 条零误拆)。

${updates.join('\n')}
`;
  await writeFile(OUT, out, 'utf8');
  console.log(`✓ 生成 ${OUT} (${updates.length} UPDATE)`);
  await sql.end({ timeout: 5 });
}

main().catch((e) => { console.error(e); process.exit(1); });
