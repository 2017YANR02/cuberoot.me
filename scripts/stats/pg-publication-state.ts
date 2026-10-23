/** Remote receipt/journal used while holding cuberoot-scramble-pg.lock. */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type PgPublication = { domain: string; before: string | null; after: string };
const validHash = (hash: unknown) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash);
function paths(root: string, domain: string) {
  if (!/^(optimal-333|optimal-puzzle|steps|mirror)$/.test(domain)) throw new Error('Invalid PG publication domain');
  return { current: join(root, `${domain}.json`), pending: join(root, `${domain}.pending.json`) };
}
function atomic(path: string, value: unknown) {
  const temporary = `${path}.${randomUUID()}.next`;
  writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 }); renameSync(temporary, path);
}

export async function applyPgPublication(root: string, request: PgPublication, apply: () => void | Promise<void>, verifyInitial?: () => 'match' | 'empty' | 'different', ensure?: () => void | Promise<void>): Promise<'applied' | 'replayed'> {
  if (!(request.before === null || validHash(request.before)) || !validHash(request.after)) throw new Error('Invalid PG publication token');
  const files = paths(root, request.domain);
  if (!existsSync(files.current)) {
    if (existsSync(files.pending)) throw new Error(`Unfinished PG publication for ${request.domain}; restore its receipt before recovery`);
    const verified = request.before === null ? verifyInitial?.() : undefined;
    if (verified !== 'match' && verified !== 'empty') throw new Error(`PG publication baseline is not initialized for ${request.domain}; the full local candidate must equal the live database, or the domain must be empty. Restore the last published CSV/layout/rare files and rerun --publish-only to register a verified baseline before applying new results.`);
    mkdirSync(root, { recursive: true });
    atomic(files.current, { token: verified === 'match' ? request.after : null });
  }
  const current = JSON.parse(readFileSync(files.current, 'utf8')) as { token: string | null };
  if (!(current.token === null || validHash(current.token))) throw new Error('Invalid PG publication receipt');
  if (existsSync(files.pending)) {
    const pending = JSON.parse(readFileSync(files.pending, 'utf8')) as PgPublication;
    if (pending.domain !== request.domain || pending.before !== request.before || pending.after !== request.after)
      throw new Error(`Unfinished PG publication for ${request.domain}; retry that exact saved candidate before publishing another generation.`);
  }
  if (current.token === request.after) { await ensure?.(); rmSync(files.pending, { force: true }); return 'replayed'; }
  if (current.token !== request.before) throw new Error(`Concurrent PG publication for ${request.domain}; the server no longer matches this local publication baseline.`);
  // Save before SQL: an unknown commit outcome must block other candidates.
  atomic(files.pending, request);
  await apply();
  atomic(files.current, { token: request.after });
  await ensure?.();
  rmSync(files.pending, { force: true });
  return 'applied';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [root] = process.argv.slice(2);
  if (root !== '/root/.local/state/cuberoot/scramble-pg') throw new Error('Explicit PG publication state root required');
  const input = JSON.parse(readFileSync(0, 'utf8')) as { request: PgPublication; apply: string; verify?: string; ensure?: string };
  const verify = input.verify ? () => {
    const result = spawnSync('sh', ['-c', input.verify!], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    if (result.status !== 0) throw new Error(`PG baseline verification failed: ${result.stderr}`);
    const status = result.stdout.trim();
    if (!['match', 'empty', 'different'].includes(status)) throw new Error('Invalid PG baseline verification result');
    return status as 'match' | 'empty' | 'different';
  } : undefined;
  const execute = (command: string) => {
    const result = spawnSync('sh', ['-c', command], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error('PG apply did not confirm success; exact candidate and journal retained for retry');
  };
  await applyPgPublication(root, input.request, () => execute(input.apply), verify, input.ensure ? () => execute(input.ensure!) : undefined);
}
