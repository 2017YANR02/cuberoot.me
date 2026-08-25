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

// ③b 内容涟漪 reconcile:某「已 dump 过」的比赛成绩被改(content_hash 变)→ 其参赛者在该场之后
// (comp_date 更晚)的比赛快照里的 per-person 历史字段会过期。这些字段(personalRecords / 区域纪录
// tag / dense rank pS·pA)全是 tryLoadFromWcaDb 里按 `comp_date < 本场日期` 算的时间冻结量,故只有
// 「改动场之后」的比赛受影响,之前的场次历史窗口不含本次改动 → 不动。把受影响的更晚比赛
// dumped_content_hash 置 NULL,令 content picker 重烤。
//   源只取「已 dump 过 且 content_hash 真变了」的比赛:
//     - 没 dump 过的新比赛不当源(它自身走 listTargets 的 never-dumped 路径,且新比赛在最新日期 →
//       之后没有更晚场次可涟漪;新成绩从不影响更早的旧比赛);
//     - 已被涟漪标 NULL 的比赛也不当源(它是结果不是原因,避免过渡期自我级联放大)。
//   旧逻辑无脑 arm 选手「所有」比赛(含更早的),是这条管道又重又慢的根因;这版用日期下界砍掉白刷。
//   日期取 wca_competitions.start_date(= wca_results_flat.comp_date 的去规范化值,与冻结口径一致),
//   避免对 11M 行 wca_results_flat 做聚合。单条多-CTE 语句完成(连接池下 temp 表跨 query 不可见)。
//   (person_dump_state 表自此弃用,保留不删以便回滚。)
async function reconcileRipple(): Promise<{ armed: number; persons: number; srcComps: number }> {
  const rows = await query<{ armed_comps: string; affected_persons: string; src_comps: string }>(
    `WITH src AS (
       SELECT u.comp_id, c.start_date AS comp_date
         FROM wca_comp_updated_at u
         JOIN comp_dump_state  s ON s.comp_id = u.comp_id
         JOIN wca_competitions c ON c.id      = u.comp_id
        WHERE u.content_hash IS NOT NULL
          AND s.dumped_content_hash IS NOT NULL
          AND u.content_hash <> s.dumped_content_hash
     ),
     person_min AS (
       SELECT pc.wca_id, MIN(src.comp_date) AS min_changed
         FROM src JOIN wca_results_flat pc ON pc.comp_id = src.comp_id
        GROUP BY pc.wca_id
     ),
     ripple AS (
       SELECT DISTINCT px.comp_id
         FROM person_min pm
         JOIN wca_results_flat px ON px.wca_id = pm.wca_id AND px.comp_date > pm.min_changed
     ),
     armed AS (
       UPDATE comp_dump_state SET dumped_content_hash = NULL
        WHERE comp_id IN (SELECT comp_id FROM ripple) AND dumped_content_hash IS NOT NULL
       RETURNING comp_id
     )
     SELECT (SELECT count(*) FROM armed)::text       AS armed_comps,
            (SELECT count(*) FROM person_min)::text  AS affected_persons,
            (SELECT count(*) FROM src)::text         AS src_comps`,
  );
  return {
    armed: Number(rows[0]?.armed_comps ?? 0),
    persons: Number(rows[0]?.affected_persons ?? 0),
    srcComps: Number(rows[0]?.src_comps ?? 0),
  };
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

  // ③b: 默认增量路径先 reconcile 内容涟漪(arm 受改动影响的更晚比赛),再 pick.FORCE/FORCE_SLUGS 定向跑,跳过.
  if (useManifest && !FORCE && FORCE_SLUGS.length === 0) {
    const r = await reconcileRipple();
    console.log(`[reconcile] src_comps=${r.srcComps} affected_persons=${r.persons} armed_comps=${r.armed}`);
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
