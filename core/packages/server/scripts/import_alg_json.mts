#!/usr/bin/env tsx
/**
 * Import all 41 `core/packages/shared/data/alg_*.json` files into the
 * `alg_sets` + `alg_cases` PG tables. One-shot, idempotent (TRUNCATE first).
 *
 * Usage (from core/): pnpm --filter @cuberoot/server exec tsx scripts/import_alg_json.mts
 *   PG connection from env: DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', 'shared', 'data');

interface AlgEntry { alg: string; altId?: string; ytId?: string }
type AlgSticker =
  | { kind: 'face'; us: string; ub: string; uf: string; ul: string; ur: string }
  | { kind: 'f2l'; fl: string }
  | { kind: 'raw'; tag: string; attrs: Record<string, string> };
interface AlgCase {
  name: string;
  subgroup: string;
  setup: string;
  standard?: string;
  sticker: AlgSticker;
  algs: AlgEntry[][];
  oriNames?: string[];
  trainerKey?: string;
}
interface AlgFile {
  scrapedAt: string;
  source: string;
  puzzle: string;
  set: string;
  cases: AlgCase[];
}

const sql = postgres({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'recon_user',
  password: process.env.DB_PASS || '314159',
  database: process.env.DB_NAME || 'recon_db',
  max: 5,
});

async function main() {
  const files = readdirSync(dataDir).filter(f => /^alg_[\w-]+\.json$/.test(f)).sort();
  console.log(`Found ${files.length} alg JSON files`);

  // Idempotent: clear before re-import
  await sql`TRUNCATE alg_cases, alg_sets RESTART IDENTITY CASCADE`;

  let totalCases = 0;
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(dataDir, file), 'utf8')) as AlgFile;
    const { puzzle, set, source, scrapedAt, cases } = raw;

    await sql`
      INSERT INTO alg_sets (puzzle, set_slug, source, scraped_at)
      VALUES (${puzzle}, ${set}, ${source ?? null}, ${scrapedAt ?? null})
    `;

    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      await sql`
        INSERT INTO alg_cases (
          puzzle, set_slug, position, case_name, subgroup, setup, standard,
          sticker, algs, ori_names, trainer_key
        ) VALUES (
          ${puzzle}, ${set}, ${i}, ${c.name}, ${c.subgroup ?? ''},
          ${c.setup ?? ''}, ${c.standard ?? null},
          ${sql.json(c.sticker)}, ${sql.json(c.algs)},
          ${c.oriNames ? sql.json(c.oriNames) : null},
          ${c.trainerKey ?? null}
        )
      `;
    }
    totalCases += cases.length;
    console.log(`  ${file.padEnd(38)} → ${puzzle}/${set} (${cases.length} cases)`);
  }

  // Sanity check
  const [setsRow] = await sql`SELECT COUNT(*) AS n FROM alg_sets`;
  const [casesRow] = await sql`SELECT COUNT(*) AS n FROM alg_cases`;
  console.log(`\n✓ alg_sets: ${setsRow.n} rows`);
  console.log(`✓ alg_cases: ${casesRow.n} rows (${totalCases} expected)`);

  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
