import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, renameSync, symlinkSync, readlinkSync, lstatSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { check, FILES, sha, readBounded, unpack, parseManifest, run, validateDataset, type Manifest } from './common.ts';

const PUBLIC = ['nemesizer', 'persons_search.json.gz'];
function present(path: string) { try { lstatSync(path); return true; } catch { return false; } }
function atomicLink(target: string, path: string) {
  const temp = `${path}.next`;
  if (present(temp)) rmSync(temp);
  symlinkSync(target, temp);
  renameSync(temp, path);
}
function current(root: string) { return readlinkSync(join(root, '.wca-data/current')); }
function journal(root: string) { return join(root, '.wca-data/transaction.json'); }
function readMeta(root: string) { return JSON.parse(readFileSync(join(root, 'nemesizer/meta.json'), 'utf8')); }
function sameMeta(actual: any, expected: any) {
  return actual?.ready === true && ['exportDate', 'generatedAt', 'personCount', 'rankCount'].every(k => actual[k] === expected[k]);
}
async function apiMeta() {
  const res = await fetch('http://127.0.0.1:3001/v1/nemesizer/meta', { signal: AbortSignal.timeout(5_000) });
  return res.ok ? res.json() : null;
}
export async function activateApi(expected: any) {
  if (sameMeta(await apiMeta().catch(() => null), expected)) return;
  // Publishing shares the Actions concurrency group with Deploy Core.
  // Preserve both the deployed code and the process environment.
  run('pm2', ['reload', 'core-api'], { timeout: 120_000 });
  for (let attempt = 0; attempt < 60; attempt++) {
    if (sameMeta(await apiMeta().catch(() => null), expected)) return;
    await sleep(2_000);
  }
  throw new Error('API did not load the expected WCA dataset');
}
export async function verifyStatic(root: string, m: Manifest) {
  const response = await fetch(`https://static.cuberoot.me/stats/persons_search.json.gz?wca=${m.archive.sha256}`, { signal: AbortSignal.timeout(45_000) });
  check(response.ok, `Static search index returned ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const expected = m.files.find(f => f.path === 'persons_search.json.gz')!;
  check(bytes.length === expected.bytes && sha(bytes) === expected.sha256, 'Static search index bytes differ from deployed dataset');
  for (const f of m.files) check(sha(readBounded(join(root, f.path))) === f.sha256, `Live file mismatch: ${f.path}`);
}
export async function rollback(root: string, reload = activateApi) {
  if (!existsSync(journal(root))) return;
  const tx = JSON.parse(readFileSync(journal(root), 'utf8'));
  check(/^(bootstrap|[a-f0-9]{64})$/.test(tx.previous), 'Invalid rollback target');
  atomicLink(`datasets/${tx.previous}`, join(root, '.wca-data/current'));
  await reload(readMeta(root));
  rmSync(journal(root));
}
export async function activate(root: string, archive: string, manifest: Manifest, reload = activateApi, verify = verifyStatic) {
  const m = parseManifest(manifest);
  check(!existsSync(journal(root)), 'Unfinished WCA transaction: recover before another activation');
  const old = validateDataset(root);
  check(m.exportDate >= old.exportDate && Date.parse(m.generatedAt) >= Date.parse(old.generatedAt), 'Refusing dataset older than live data');
  if (m.generatedAt === old.generatedAt) for (const f of m.files) check(sha(readBounded(join(root, f.path))) === f.sha256, 'Same generation differs from live files');
  const base = join(root, '.wca-data');
  mkdirSync(join(base, 'datasets'), { recursive: true });
  const next = join(base, 'datasets', m.archive.sha256);
  if (!existsSync(next)) {
    const staging = `${next}.staging`;
    rmSync(staging, { recursive: true, force: true });
    unpack(archive, m, staging);
    renameSync(staging, next);
  } else for (const f of m.files) check(sha(readBounded(join(next, f.path))) === f.sha256, 'Existing candidate is corrupt');
  if (!present(join(base, 'current'))) {
    // Production-only adoption: never link a worktree to the development checkout.
    check(readdirSync(join(root, 'nemesizer')).sort().join(',') === ['counts.bin.gz', 'meta.json', 'persons.bin.gz', 'ranks.bin.gz'].sort().join(','), 'Unexpected files in legacy Nemesizer directory');
    mkdirSync(join(base, 'datasets/bootstrap/nemesizer'), { recursive: true });
    for (const f of FILES) cpSync(join(root, f), join(base, 'datasets/bootstrap', f));
    atomicLink('datasets/bootstrap', join(base, 'current'));
  }
  const previous = current(root).replace(/^datasets\//, '');
  check(/^(bootstrap|[a-f0-9]{64})$/.test(previous), 'Unmanaged current symlink');
  mkdirSync(join(base, 'legacy'), { recursive: true });
  for (const name of PUBLIC) {
    const path = join(root, name), expected = `.wca-data/current/${name}`;
    if (lstatSync(path).isSymbolicLink()) check(readlinkSync(path) === expected, 'Refusing unmanaged public symlink');
    else {
      const backup = join(base, 'legacy', name);
      check(!present(backup), 'Legacy backup already exists; manual recovery required');
      renameSync(path, backup);
      try { symlinkSync(expected, path); } catch (error) { renameSync(backup, path); throw error; }
    }
  }
  writeFileSync(journal(root), JSON.stringify({ previous, next: m.archive.sha256 }));
  try {
    atomicLink(`datasets/${m.archive.sha256}`, join(base, 'current'));
    await reload(readMeta(root));
    await verify(root, m);
  } catch (error) {
    await rollback(root, reload);
    throw error;
  }
  console.log(JSON.stringify({ activated: m.archive.sha256, exportDate: m.exportDate, generatedAt: m.generatedAt }));
}
export function finalize(root: string, expectedHash: string) {
  check(/^[a-f0-9]{64}$/.test(expectedHash) && current(root) === `datasets/${expectedHash}`, 'Finalization identity mismatch');
  const base = join(root, '.wca-data');
  // Delete only this owner's previous versions, never neighboring static data.
  for (const name of readdirSync(join(base, 'datasets'))) {
    check(/^(bootstrap|[a-f0-9]{64}(\.staging)?)$/.test(name), 'Unexpected managed dataset directory');
    if (name !== expectedHash) rmSync(join(base, 'datasets', name), { recursive: true });
  }
  rmSync(join(base, 'legacy'), { recursive: true, force: true });
  rmSync(journal(root), { force: true });
}
export async function recover(root: string, committedHash: string, reload = activateApi) {
  if (!existsSync(journal(root))) return;
  const tx = JSON.parse(readFileSync(journal(root), 'utf8'));
  if (tx.next === committedHash) finalize(root, committedHash);
  else await rollback(root, reload);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, root, archive, manifestPath] = process.argv.slice(2);
  check(root === '/www/wwwroot/toolkit/stats', 'Production deployment root must be explicit');
  if (command === 'activate') await activate(root, archive, parseManifest(JSON.parse(readFileSync(manifestPath, 'utf8'))));
  else if (command === 'rollback') await rollback(root);
  else if (command === 'finalize') finalize(root, archive);
  else if (command === 'recover') await recover(root, archive);
  else throw new Error('Usage: deploy.ts activate|rollback|finalize /www/wwwroot/toolkit/stats ...');
}
