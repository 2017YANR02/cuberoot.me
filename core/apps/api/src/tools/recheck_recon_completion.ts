/** Production maintenance: dry-run by default; deployed after API health checks. */
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import postgres from 'postgres';
import { databaseSettings } from '../db/settings.js';
import { planReconCompletionUpdate, type CompletionRow } from '../utils/recon_completion_backfill.js';
import { revalidateReconPages } from '../utils/recon_revalidate.js';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--apply' && !arg.startsWith('--backup-dir='))) throw new Error('Unknown argument');
const apply = args.includes('--apply');
const backupDir = resolve(args.find(arg => arg.startsWith('--backup-dir='))?.slice(13) ?? '.local-data/recon-completion');
const pendingPath = join(backupDir, 'pending-cache.json');
// Keep the advisory-lock session alive while refreshing remote page caches.
const sql = postgres({ ...databaseSettings(), max: 1, connect_timeout: 10, idle_timeout: 0 });
const deadline = Date.now() + 300_000;
function guard() {
  if (Date.now() > deadline || process.memoryUsage().rss > 768 * 1024 * 1024) throw new Error('Recheck resource limit reached');
}
function save(path: string, value: unknown, exclusive = false) {
  const target = exclusive ? path : `${path}.next-${process.pid}`;
  writeFileSync(target, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: exclusive ? 'wx' : 'w', flush: true });
  if (!exclusive) renameSync(target, path);
}

try {
  const [lock] = await sql`SELECT pg_try_advisory_lock(2967, 20261113) AS acquired`;
  if (!lock.acquired) throw new Error('Another reconstruction recheck is running');
  if (apply && (!process.env.RECON_REVALIDATE_SECRET || !process.env.RECON_REVALIDATE_URLS?.trim())) {
    throw new Error('Next cache invalidation must be configured before applying');
  }
  const rows = await sql<CompletionRow[]>`SELECT id, event, record_type, optimal_scramble,
    wca_scramble, scramble, solution, completion_status, unsolved_reason FROM recons ORDER BY id`;
  const changes: NonNullable<Awaited<ReturnType<typeof planReconCompletionUpdate>>>[] = [];
  for (const row of rows) {
    guard();
    const change = await planReconCompletionUpdate(row);
    if (change) changes.push(change);
  }
  const transitions: Record<string, number> = {};
  for (const change of changes) {
    const key = `${change.before.completion_status}->${change.after.completion_status}`;
    transitions[key] = (transitions[key] ?? 0) + 1;
  }
  console.log(JSON.stringify({ apply, checked: rows.length, changes: changes.length, transitions }));
  if (apply) {
    mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
    const backup = join(backupDir, `${stamp}.json`);
    save(backup, { createdAt: new Date().toISOString(), changes }, true);
    const pending = new Set<number>(existsSync(pendingPath) ? JSON.parse(readFileSync(pendingPath, 'utf8')) : []);
    changes.forEach(change => pending.add(change.before.id));
    // Persist before the transaction: a process interruption cannot lose cache work.
    save(pendingPath, [...pending]);
    const applied = await sql.begin(async tx => {
      await tx`SET LOCAL lock_timeout = '5s'`;
      await tx`SET LOCAL statement_timeout = '30s'`;
      const ids: number[] = [];
      for (const { before, after } of changes) {
        guard();
        // Compare every input and previous derived field, preserving concurrent edits.
        const updated = await tx`UPDATE recons SET completion_status = ${after.completion_status},
          unsolved_reason = ${after.unsolved_reason}
          WHERE id = ${before.id} AND to_jsonb(recons) @> ${tx.json(before as never)}::jsonb
          RETURNING id`;
        if (updated.length) ids.push(before.id);
      }
      return ids;
    });
    save(join(backupDir, `${stamp}.result.json`), { applied, skipped: changes.filter(c => !applied.includes(c.before.id)).map(c => c.before.id) }, true);
    const ids = [...pending];
    for (let i = 0; i < ids.length; i += 4) {
      guard();
      await Promise.all(ids.slice(i, i + 4).map(id => revalidateReconPages(id, { strict: true })));
      ids.slice(i, i + 4).forEach(id => pending.delete(id));
      save(pendingPath, [...pending]);
    }
    console.log(JSON.stringify({ applied: applied.length, skipped: changes.length - applied.length, backup, cacheRefreshed: ids.length }));
    if (changes.length !== applied.length) throw new Error('Concurrent reconstruction edits skipped; rerun the recheck');
  }
} finally {
  await sql.end({ timeout: 5 });
}
