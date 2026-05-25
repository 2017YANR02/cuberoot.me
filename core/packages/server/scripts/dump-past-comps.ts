/**
 * Dump past-comp snapshots → static JSON for client fast-path.
 *
 * 输出 `OUTPUT_DIR/<wcaId>.json`,一场一文件,~50-300KB raw / ~15-50KB gz。
 *
 * 增量决策:
 *   - 优先走 wca_comp_updated_at(stats.yml 每天灌)+ comp_dump_state(本脚本维护)的
 *     watermark 对比:src_max_updated_at > dumped_max_updated_at → redump,否则 skip。
 *   - 这是 100% 一致路径:WCA 改任何 Results row → Results.updated_at bump →
 *     wca_comp_updated_at 跳 → 本脚本检测到 → 重 dump。
 *   - 兜底:首次部署 stats.yml 还没跑出 wca_comp_updated_at 时,回退到
 *     "文件存在就 skip"老逻辑,避免空 manifest 导致 cron 一直挂。
 *
 * Env:
 *   OUTPUT_DIR    输出目录(默认 ./dump-output)
 *   CONCURRENCY   并发数(默认 4)
 *   CUTOFF_DAYS   过去多少天前的比赛才 dump(默认 7,给 WCA 收录留时间)
 *   LIMIT         只跑前 N 场(0=不限,默认 0)
 *   FORCE         1=忽略 watermark/skip,全量 redump
 *   FORCE_SLUGS   逗号分隔 slug 列表,只 dump 这些(也忽略 watermark/skip)
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

interface Target {
  slug: string;
  srcMaxUpdatedAt: string | null;  // null = manifest 缺(legacy fallback 路径)
}

async function existsFile(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function hasManifestTable(): Promise<boolean> {
  // 两张表都得在:wca_comp_updated_at (stats.yml 灌) + comp_dump_state (migration 建).
  // 任何一张缺 → 部署还没收拢,回退 legacy 文件存在性逻辑避免 SQL 报错。
  const rows = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('wca_comp_updated_at', 'comp_dump_state')`,
  );
  return Number(rows[0]?.cnt ?? 0) === 2;
}

async function listTargets(useManifest: boolean): Promise<Target[]> {
  // FORCE_SLUGS:无视一切,直接 dump,从 manifest 取 watermark(没有就 null)
  if (FORCE_SLUGS.length > 0) {
    if (!useManifest) return FORCE_SLUGS.map(s => ({ slug: s, srcMaxUpdatedAt: null }));
    const placeholders = FORCE_SLUGS.map(() => '?').join(',');
    const rows = await query<{ comp_id: string; src_max_updated_at: string }>(
      `SELECT comp_id, src_max_updated_at FROM wca_comp_updated_at WHERE comp_id IN (${placeholders})`,
      FORCE_SLUGS,
    );
    const found = new Map(rows.map(r => [r.comp_id, r.src_max_updated_at]));
    return FORCE_SLUGS.map(s => ({ slug: s, srcMaxUpdatedAt: found.get(s) ?? null }));
  }

  // Legacy fallback:manifest 表不存在,用 wca_competitions + 文件存在性
  if (!useManifest) {
    const rows = await query<{ id: string }>(
      `SELECT id FROM wca_competitions
        WHERE end_date < CURRENT_DATE - (? || ' days')::interval
        ORDER BY end_date DESC
        ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}`,
      [String(CUTOFF_DAYS)],
    );
    return rows.map(r => ({ slug: r.id, srcMaxUpdatedAt: null }));
  }

  // FORCE:走 manifest 拿 watermark,但忽略 comp_dump_state 比对
  if (FORCE) {
    const rows = await query<{ comp_id: string; src_max_updated_at: string }>(
      `SELECT u.comp_id, u.src_max_updated_at
         FROM wca_comp_updated_at u
         JOIN wca_competitions c ON c.id = u.comp_id
        WHERE c.end_date < CURRENT_DATE - (? || ' days')::interval
        ORDER BY c.end_date DESC
        ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}`,
      [String(CUTOFF_DAYS)],
    );
    return rows.map(r => ({ slug: r.comp_id, srcMaxUpdatedAt: r.src_max_updated_at }));
  }

  // 默认 100% 一致增量:LEFT JOIN state,只挑变了的 / 没 dump 过的
  const rows = await query<{ comp_id: string; src_max_updated_at: string }>(
    `SELECT u.comp_id, u.src_max_updated_at
       FROM wca_comp_updated_at u
       JOIN wca_competitions c ON c.id = u.comp_id
       LEFT JOIN comp_dump_state s ON s.comp_id = u.comp_id
      WHERE c.end_date < CURRENT_DATE - (? || ' days')::interval
        AND (s.comp_id IS NULL OR u.src_max_updated_at > s.dumped_max_updated_at)
      ORDER BY c.end_date DESC
      ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}`,
    [String(CUTOFF_DAYS)],
  );
  return rows.map(r => ({ slug: r.comp_id, srcMaxUpdatedAt: r.src_max_updated_at }));
}

async function upsertState(slug: string, srcMaxUpdatedAt: string): Promise<void> {
  await query(
    `INSERT INTO comp_dump_state (comp_id, dumped_max_updated_at, dumped_at)
       VALUES (?, ?, NOW())
       ON CONFLICT (comp_id) DO UPDATE SET
         dumped_max_updated_at = EXCLUDED.dumped_max_updated_at,
         dumped_at = NOW()`,
    [slug, srcMaxUpdatedAt],
  );
}

async function dumpOne(
  target: Target,
  useManifest: boolean,
): Promise<{ slug: string; ok: boolean; bytes?: number; ms?: number; err?: string; skipped?: boolean }> {
  const { slug, srcMaxUpdatedAt } = target;
  const path = join(OUTPUT_DIR, `${slug}.json`);

  // Legacy fallback 路径:沿用文件存在性 skip
  if (!useManifest && !FORCE && FORCE_SLUGS.length === 0) {
    if (await existsFile(path)) return { slug, ok: true, skipped: true };
  }

  const t0 = Date.now();
  try {
    const data = await tryLoadFromWcaDb(slug);
    if (!data) return { slug, ok: false, err: 'no wca_db data' };
    const json = JSON.stringify(data);
    await writeFile(path, json);
    if (useManifest && srcMaxUpdatedAt) {
      await upsertState(slug, srcMaxUpdatedAt);
    }
    return { slug, ok: true, bytes: json.length, ms: Date.now() - t0 };
  } catch (e) {
    return { slug, ok: false, err: (e as Error).message, ms: Date.now() - t0 };
  }
}

async function main() {
  console.log(`[dump] config: OUTPUT_DIR=${OUTPUT_DIR} CONCURRENCY=${CONCURRENCY} CUTOFF_DAYS=${CUTOFF_DAYS} LIMIT=${LIMIT || 'unlimited'} FORCE=${FORCE} FORCE_SLUGS=${FORCE_SLUGS.length}`);
  await mkdir(OUTPUT_DIR, { recursive: true });

  const useManifest = await hasManifestTable();
  console.log(`[dump] picker: ${useManifest ? 'watermark (wca_comp_updated_at + comp_dump_state)' : 'legacy (file-exists skip)'}`);

  const targets = await listTargets(useManifest);
  console.log(`[dump] candidates: ${targets.length}`);

  const queue = [...targets];
  let done = 0, ok = 0, fail = 0, skipped = 0, totalBytes = 0, totalMs = 0;
  const failures: { slug: string; err: string }[] = [];
  const t0 = Date.now();

  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const target = queue.shift();
      if (!target) break;
      const r = await dumpOne(target, useManifest);
      done++;
      if (r.skipped) { skipped++; }
      else if (r.ok) { ok++; totalBytes += r.bytes!; totalMs += r.ms!; }
      else { fail++; failures.push({ slug: target.slug, err: r.err! }); }
      if (done % 50 === 0) {
        const wall = (Date.now() - t0) / 1000;
        const rate = done / wall;
        console.log(`[dump] ${done}/${targets.length} (ok=${ok} skip=${skipped} fail=${fail}) ${(totalBytes/1024/1024).toFixed(1)}MB ${rate.toFixed(1)}/s elapsed=${wall.toFixed(0)}s`);
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
