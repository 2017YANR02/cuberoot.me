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
  contentHash: string | null;  // 成绩内容指纹;null = manifest 缺(legacy fallback 路径)
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
  // FORCE_SLUGS:无视一切,直接 dump,从 manifest 取 content_hash(没有就 null)
  if (FORCE_SLUGS.length > 0) {
    if (!useManifest) return FORCE_SLUGS.map(s => ({ slug: s, contentHash: null }));
    const placeholders = FORCE_SLUGS.map(() => '?').join(',');
    const rows = await query<{ comp_id: string; content_hash: string }>(
      `SELECT comp_id, content_hash FROM wca_comp_updated_at WHERE comp_id IN (${placeholders})`,
      FORCE_SLUGS,
    );
    const found = new Map(rows.map(r => [r.comp_id, r.content_hash]));
    return FORCE_SLUGS.map(s => ({ slug: s, contentHash: found.get(s) ?? null }));
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
    return rows.map(r => ({ slug: r.id, contentHash: null }));
  }

  // FORCE:走 manifest 拿 content_hash,但忽略 comp_dump_state 比对
  if (FORCE) {
    const rows = await query<{ comp_id: string; content_hash: string }>(
      `SELECT u.comp_id, u.content_hash
         FROM wca_comp_updated_at u
         JOIN wca_competitions c ON c.id = u.comp_id
        WHERE c.end_date < CURRENT_DATE - (? || ' days')::interval
        ORDER BY c.end_date DESC
        ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}`,
      [String(CUTOFF_DAYS)],
    );
    return rows.map(r => ({ slug: r.comp_id, contentHash: r.content_hash }));
  }

  // 默认增量:LEFT JOIN state,只挑「内容指纹变了 / 没 dump 过 / 还没记过 hash」的.
  // 比的是成绩内容指纹(content_hash),WCA 批量重戳 updated_at 不会让 hash 变 → 不再误触发.
  const rows = await query<{ comp_id: string; content_hash: string }>(
    `SELECT u.comp_id, u.content_hash
       FROM wca_comp_updated_at u
       JOIN wca_competitions c ON c.id = u.comp_id
       LEFT JOIN comp_dump_state s ON s.comp_id = u.comp_id
      WHERE c.end_date < CURRENT_DATE - (? || ' days')::interval
        AND u.content_hash IS NOT NULL
        AND (s.comp_id IS NULL OR s.dumped_content_hash IS NULL OR u.content_hash <> s.dumped_content_hash)
      ORDER BY c.end_date DESC
      ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}`,
    [String(CUTOFF_DAYS)],
  );
  return rows.map(r => ({ slug: r.comp_id, contentHash: r.content_hash }));
}

async function upsertState(slug: string, contentHash: string): Promise<void> {
  await query(
    `INSERT INTO comp_dump_state (comp_id, dumped_content_hash, dumped_at)
       VALUES (?, ?, NOW())
       ON CONFLICT (comp_id) DO UPDATE SET
         dumped_content_hash = EXCLUDED.dumped_content_hash,
         dumped_at = NOW()`,
    [slug, contentHash],
  );
}

// ③b PR 涟漪 reconcile:某选手成绩变 → 其所有比赛的「当时是否 PR」标记会变,而那些比赛
// 自身成绩行没动(content_hash 不变)→ content 增量抓不到。这里从 wca_results_top 算
// per-person PR 指纹(PG 13 无 crc32/bit_xor,用 sum(hashtextextended)),指纹变了的选手 →
// 把其所有比赛 dumped_content_hash 置 NULL,令 content picker 重烤。单条多-CTE 语句完成
// (连接池下 temp 表跨 query 不可见,故不用 temp)。person_dump_state 缺 = migration 没应用 → 跳过.
async function reconcilePersonRipple(): Promise<{ changed: number; armed: number }> {
  const exists = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM information_schema.tables
       WHERE table_schema='public' AND table_name='person_dump_state'`,
  );
  if (Number(exists[0]?.cnt ?? 0) === 0) return { changed: 0, armed: 0 };

  const rows = await query<{ armed_comps: string; changed_persons: string }>(
    `WITH pf AS (
       SELECT wca_id AS person_id,
              sum(hashtextextended(concat_ws('|', event_id, is_avg, value), 0)) AS pr_hash
         FROM wca_results_top GROUP BY wca_id
     ),
     changed AS (
       SELECT pf.person_id, pf.pr_hash FROM pf
       LEFT JOIN person_dump_state s ON s.person_id = pf.person_id
       WHERE s.person_id IS NULL OR s.dumped_pr_hash IS DISTINCT FROM pf.pr_hash
     ),
     ripple AS (
       SELECT DISTINCT comp_id FROM wca_results_top
        WHERE wca_id IN (SELECT person_id FROM changed)
     ),
     armed AS (
       UPDATE comp_dump_state SET dumped_content_hash = NULL
        WHERE comp_id IN (SELECT comp_id FROM ripple) AND dumped_content_hash IS NOT NULL
       RETURNING comp_id
     ),
     up AS (
       INSERT INTO person_dump_state (person_id, dumped_pr_hash, reconciled_at)
       SELECT person_id, pr_hash, NOW() FROM changed
       ON CONFLICT (person_id) DO UPDATE SET dumped_pr_hash = EXCLUDED.dumped_pr_hash, reconciled_at = NOW()
       RETURNING 1
     )
     SELECT (SELECT count(*) FROM armed)::text  AS armed_comps,
            (SELECT count(*) FROM changed)::text AS changed_persons`,
  );
  return { changed: Number(rows[0]?.changed_persons ?? 0), armed: Number(rows[0]?.armed_comps ?? 0) };
}

async function dumpOne(
  target: Target,
  useManifest: boolean,
): Promise<{ slug: string; ok: boolean; bytes?: number; ms?: number; err?: string; skipped?: boolean }> {
  const { slug, contentHash } = target;
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
    if (useManifest && contentHash) {
      await upsertState(slug, contentHash);
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

  // ③b: 默认增量路径先 reconcile PR 涟漪(arm 受影响比赛),再 pick.FORCE/FORCE_SLUGS 是定向跑,跳过.
  if (useManifest && !FORCE && FORCE_SLUGS.length === 0) {
    const r = await reconcilePersonRipple();
    console.log(`[reconcile] changed_persons=${r.changed} armed_comps=${r.armed}`);
  }

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
