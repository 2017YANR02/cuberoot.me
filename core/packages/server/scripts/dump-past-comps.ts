/**
 * Dump past-comp snapshots → static JSON for client fast-path.
 *
 * 输出 `OUTPUT_DIR/<wcaId>.json`,一场一文件,~50-300KB raw / ~15-50KB gz。
 * 增量:文件已存在则 skip。FORCE=1 强制全 redump。
 *
 * Env:
 *   OUTPUT_DIR    输出目录(默认 ./dump-output)
 *   CONCURRENCY   并发数(默认 4)
 *   CUTOFF_DAYS   过去多少天前的比赛才 dump(默认 7,给 WCA 收录留时间)
 *   LIMIT         只跑前 N 场(0=不限,默认 0)
 *   FORCE         1=忽略已有文件,全量 redump
 *   FORCE_SLUGS   逗号分隔 slug 列表,只 dump 这些
 *
 * 跑法:
 *   tsx packages/server/scripts/dump-past-comps.ts
 *
 * PG 连接走 src/db/connection.ts 同套 env(DB_HOST/PORT/USER/PASS/NAME)。
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { query, sql } from '../src/db/connection.js';
import { tryLoadFromWcaDb } from '../src/routes/cubing_live.js';

const OUTPUT_DIR = process.env.OUTPUT_DIR || './dump-output';
const CONCURRENCY = Number(process.env.CONCURRENCY) || 4;
const CUTOFF_DAYS = Number(process.env.CUTOFF_DAYS) || 7;
const LIMIT = Number(process.env.LIMIT) || 0;
const FORCE = process.env.FORCE === '1';
const FORCE_SLUGS = (process.env.FORCE_SLUGS || '').split(',').map(s => s.trim()).filter(Boolean);

async function existsFile(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function listTargetSlugs(): Promise<string[]> {
  if (FORCE_SLUGS.length > 0) return FORCE_SLUGS;
  const rows = await query<{ id: string }>(
    `SELECT id FROM wca_competitions
      WHERE end_date < CURRENT_DATE - (? || ' days')::interval
      ORDER BY end_date DESC
      ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}`,
    [String(CUTOFF_DAYS)],
  );
  return rows.map(r => r.id);
}

async function dumpOne(slug: string): Promise<{ slug: string; ok: boolean; bytes?: number; ms?: number; err?: string; skipped?: boolean }> {
  const path = join(OUTPUT_DIR, `${slug}.json`);
  if (!FORCE && await existsFile(path)) {
    return { slug, ok: true, skipped: true };
  }
  const t0 = Date.now();
  try {
    const data = await tryLoadFromWcaDb(slug);
    if (!data) return { slug, ok: false, err: 'no wca_db data' };
    const json = JSON.stringify(data);
    await writeFile(path, json);
    return { slug, ok: true, bytes: json.length, ms: Date.now() - t0 };
  } catch (e) {
    return { slug, ok: false, err: (e as Error).message, ms: Date.now() - t0 };
  }
}

async function main() {
  console.log(`[dump] config: OUTPUT_DIR=${OUTPUT_DIR} CONCURRENCY=${CONCURRENCY} CUTOFF_DAYS=${CUTOFF_DAYS} LIMIT=${LIMIT || 'unlimited'} FORCE=${FORCE}`);
  await mkdir(OUTPUT_DIR, { recursive: true });

  const slugs = await listTargetSlugs();
  console.log(`[dump] candidates: ${slugs.length}`);

  const queue = [...slugs];
  let done = 0, ok = 0, fail = 0, skipped = 0, totalBytes = 0, totalMs = 0;
  const failures: { slug: string; err: string }[] = [];
  const t0 = Date.now();

  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const slug = queue.shift();
      if (!slug) break;
      const r = await dumpOne(slug);
      done++;
      if (r.skipped) { skipped++; }
      else if (r.ok) { ok++; totalBytes += r.bytes!; totalMs += r.ms!; }
      else { fail++; failures.push({ slug, err: r.err! }); }
      if (done % 50 === 0) {
        const wall = (Date.now() - t0) / 1000;
        const rate = done / wall;
        console.log(`[dump] ${done}/${slugs.length} (ok=${ok} skip=${skipped} fail=${fail}) ${(totalBytes/1024/1024).toFixed(1)}MB ${rate.toFixed(1)}/s elapsed=${wall.toFixed(0)}s`);
      }
    }
  }));

  const wall = (Date.now() - t0) / 1000;
  console.log(`\n[dump] DONE in ${wall.toFixed(0)}s`);
  console.log(`  ok=${ok}  skipped=${skipped}  fail=${fail}`);
  console.log(`  bytes=${(totalBytes/1024/1024).toFixed(1)}MB  avg=${ok > 0 ? Math.round(totalBytes/ok/1024) : 0}KB/comp  avg-ms=${ok > 0 ? Math.round(totalMs/ok) : 0}ms`);
  if (failures.length > 0) {
    console.log(`\n[dump] failures (${failures.length}):`);
    for (const f of failures.slice(0, 20)) console.log(`  ${f.slug}: ${f.err}`);
    if (failures.length > 20) console.log(`  ... +${failures.length - 20} more`);
  }
  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
