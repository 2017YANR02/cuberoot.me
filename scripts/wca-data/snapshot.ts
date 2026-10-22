/** Latest-only generated statistics. Binary WCA exports retain their existing manifest. */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { Writable } from 'node:stream';
import { dirname, join } from 'node:path';
import { check, run } from './common.ts';
export const DIRECTORIES = ['top10_history', 'records', 'historical', 'sor_over_time', 'record_place_details_v1', 'record_place_details_v2', 'prediction', 'comp_city', 'comp_calendar'];
export const SCRAMBLE_DIRECTORIES = ['downloads', 'examples_avg', 'examples_stage', 'wca_cross'];
export const UPCOMING = ['upcoming_comps.json', 'all_upcoming_comps.json', 'cn_upcoming_registrations.json', 'comp_names_zh.json', 'comp_elevations.json'];
export const BASELINE = '.stats-release-base.json';
export type Owner = 'wca' | 'upcoming' | 'elevations' | 'scramble' | 'world-bests';
export type FileRecord = { path: string; bytes: number; sha256: string };
export type Inventory = { schema: 1; kind: 'snapshot' | 'patch'; sourceCommit: string; generatedAt: string; files: FileRecord[]; owner?: Owner; changes?: { path: string; before: string | null; after: string | null }[] };
export type Archive = { name: string; bytes: number; sha256: string };
const MAX_ARCHIVE = 512 * 1024 * 1024, MAX_EXPANDED = 2 * 1024 * 1024 * 1024, MAX_FILE = 128 * 1024 * 1024;
export function managed(path: string): boolean {
  if (!/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(path) || path.split('/').some(p => p === '.' || p === '..' || !p)) return false;
  const parts = path.split('/');
  if (parts.length === 1) return path.endsWith('.json');
  if (DIRECTORIES.includes(parts[0])) return path.endsWith('.json');
  return parts[0] === 'scramble' && ((parts.length === 2 && /\.(json|json\.gz)$/.test(path)) || (SCRAMBLE_DIRECTORIES.includes(parts[1]) && /\.(json|txt)$/.test(path)));
}
export function owns(owner: Owner, path: string): boolean {
  if (!managed(path) || path.startsWith('comp_calendar/')) return false;
  // Both calendar producers enrich the same append-only coordinate cache.
  if (path === 'comp_elevations.json') return ['wca', 'upcoming', 'elevations'].includes(owner);
  if (owner === 'scramble') return path.startsWith('scramble/');
  if (owner === 'world-bests') return path === 'world_bests.json';
  if (owner === 'upcoming') return UPCOMING.includes(path);
  if (owner === 'elevations') return ['all_past_comps.json', 'all_upcoming_comps.json', 'comp_elevations.json'].includes(path);
  return owner === 'wca' && !path.startsWith('scramble/') && !UPCOMING.includes(path) && path !== 'world_bests.json';
}
export function unit(path: string) { return path.startsWith('scramble/') ? path.split('/').slice(0, 2).join('/') : path.split('/')[0]; }
export async function hashFile(path: string) { const h = createHash('sha256'); for await (const chunk of createReadStream(path)) h.update(chunk); return h.digest('hex'); }
export function paths(root: string): string[] {
  const result: string[] = [];
  function walk(directory: string, prefix: string) {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (entry.name.startsWith('.')) continue;
      const st = statSync(join(root, path));
      if (st.isDirectory()) {
        if ((!prefix && (DIRECTORIES.includes(entry.name) || entry.name === 'scramble')) || (prefix === 'scramble/' && SCRAMBLE_DIRECTORIES.includes(entry.name)) || (prefix && prefix !== 'scramble/')) walk(join(root, path), path + '/');
      } else if (managed(path)) { check(st.isFile() && st.size <= MAX_FILE, `Invalid statistics file: ${path}`); result.push(path); }
    }
  }
  walk(root, ''); return result.sort();
}
export async function inventory(root: string, sourceCommit: string): Promise<Inventory> {
  const files: FileRecord[] = [];
  for (const path of paths(root)) files.push({ path, bytes: statSync(join(root, path)).size, sha256: await hashFile(join(root, path)) });
  return validate({ schema: 1, kind: 'snapshot', sourceCommit, generatedAt: new Date().toISOString(), files });
}
export function validate(value: unknown): Inventory {
  const m = value as Inventory;
  check(m?.schema === 1 && ['snapshot', 'patch'].includes(m.kind) && /^[a-f0-9]{40}$/.test(m.sourceCommit) && Number.isFinite(Date.parse(m.generatedAt)), 'Invalid statistics inventory');
  check(Array.isArray(m.files) && m.files.length <= 20000 && new Set(m.files.map(f => f.path)).size === m.files.length, 'Invalid file inventory');
  for (const f of m.files) check(managed(f.path) && Number.isSafeInteger(f.bytes) && f.bytes >= 0 && f.bytes <= MAX_FILE && /^[a-f0-9]{64}$/.test(f.sha256), 'Invalid file record');
  check(m.files.reduce((n, f) => n + f.bytes, 0) < MAX_EXPANDED, 'Statistics snapshot is too large');
  if (m.kind === 'patch') {
    check(['wca', 'upcoming', 'elevations', 'scramble', 'world-bests'].includes(m.owner!), 'Invalid statistics owner');
    check(Array.isArray(m.changes) && m.changes.length <= 20000 && new Set(m.changes.map(c => c.path)).size === m.changes.length, 'Invalid change inventory');
    for (const c of m.changes) check(owns(m.owner!, c.path) && [c.before, c.after].every(h => h === null || /^[a-f0-9]{64}$/.test(h)) && c.before !== c.after, 'Invalid owner/change');
    const updates = m.changes.filter(c => c.after !== null);
    check(updates.length === m.files.length && m.files.every(f => updates.some(c => c.path === f.path && c.after === f.sha256)), 'Patch contents do not match changes');
  }
  return m;
}
export function patch(base: Inventory, next: Inventory, owner: Owner): Inventory {
  validate(base); validate(next);
  const old = new Map(base.files.filter(f => owns(owner, f.path)).map(f => [f.path, f.sha256]));
  const now = new Map(next.files.filter(f => owns(owner, f.path)).map(f => [f.path, f.sha256]));
  const changes = [...new Set([...old.keys(), ...now.keys()])].sort().filter(p => old.get(p) !== now.get(p)).map(path => ({ path, before: old.get(path) ?? null, after: now.get(path) ?? null }));
  return validate({ ...next, kind: 'patch', owner, changes, files: next.files.filter(f => changes.some(c => c.path === f.path && c.after !== null)) });
}
export function applyPatch(root: string, latest: Inventory, change: Inventory, source: string) {
  validate(change); check(change.kind === 'patch', 'Expected patch');
  const previous = new Map(latest.files.map(f => [f.path, f.sha256]));
  let elevations: string | undefined;
  // Check every precondition before modifying even one file. Identical replay is safe.
  for (const c of change.changes!) {
    if (c.path === 'comp_elevations.json') {
      check(c.after !== null, 'The shared elevation cache is append-only');
      const current = existsSync(join(root, c.path)) ? JSON.parse(readFileSync(join(root, c.path), 'utf8')) : {};
      const proposed = JSON.parse(readFileSync(join(source, 'data', c.path), 'utf8'));
      for (const cache of [current, proposed]) {
        check(cache && typeof cache === 'object' && !Array.isArray(cache), 'Invalid elevation cache');
        for (const [key, value] of Object.entries(cache)) check(/^-?\d+\.\d{4},-?\d+\.\d{4}$/.test(key) && Number.isSafeInteger(value), 'Invalid elevation entry');
      }
      for (const [key, value] of Object.entries(proposed)) check(!(key in current) || current[key] === value, `Concurrent elevation correction: ${key}`);
      elevations = JSON.stringify(Object.fromEntries(Object.entries({ ...current, ...proposed }).sort(([a], [b]) => a.localeCompare(b))));
    } else check((previous.get(c.path) ?? null) === c.before || (previous.get(c.path) ?? null) === c.after, `Concurrent update to ${c.path}; hydrate the latest data and regenerate this owner before retrying`);
  }
  for (const c of change.changes!) {
    if (c.path === 'comp_elevations.json') writeFileSync(join(root, c.path), elevations!);
    else if (c.after === null) rmSync(join(root, c.path), { force: true });
    else { mkdirSync(dirname(join(root, c.path)), { recursive: true }); cpSync(join(source, 'data', c.path), join(root, c.path)); }
  }
}
export async function packSnapshot(root: string, manifest: Inventory, out: string): Promise<Archive> {
  validate(manifest); const stage = join(out, 'packing'); mkdirSync(stage, { recursive: true });
  writeFileSync(join(stage, '_inventory.json'), JSON.stringify(manifest));
  for (const f of manifest.files) { const dest = join(stage, 'data', f.path); mkdirSync(dirname(dest), { recursive: true }); cpSync(join(root, f.path), dest); check(await hashFile(dest) === f.sha256, `Source changed during packing: ${f.path}`); }
  const names = ['_inventory.json', ...manifest.files.map(f => `data/${f.path}`)];
  const list = join(out, 'members.txt'); writeFileSync(list, names.join('\n') + '\n');
  const file = join(out, 'archive.tgz');
  run('tar', ['--format=ustar', '-czf', file, '-C', stage, '-T', list], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
  const sha256 = await hashFile(file), bytes = statSync(file).size;
  check(bytes <= MAX_ARCHIVE, 'Statistics archive is too large');
  const name = `stats-${manifest.kind}-${sha256}.tgz`; cpSync(file, join(out, name));
  rmSync(stage, { recursive: true }); return { name, bytes, sha256 };
}
export function archiveDescriptor(value: unknown): Archive {
  const a = value as Archive;
  check(a && /^[a-f0-9]{64}$/.test(a.sha256) && a.name === `stats-snapshot-${a.sha256}.tgz` && Number.isSafeInteger(a.bytes) && a.bytes > 0 && a.bytes <= MAX_ARCHIVE, 'Invalid snapshot descriptor'); return a;
}
export async function unpackSnapshot(file: string, destination: string, expected?: Archive): Promise<Inventory> {
  check(statSync(file).size <= MAX_ARCHIVE, 'Archive exceeds compressed size limit');
  if (expected) check(statSync(file).size === expected.bytes && await hashFile(file) === expected.sha256, 'Statistics archive checksum mismatch');
  // Bound expansion before tar can write anything. Listing alone does not prevent a gzip bomb.
  let expanded = 0;
  await pipeline(createReadStream(file), createGunzip(), new Writable({ write(chunk, _enc, done) { expanded += chunk.length; done(expanded > MAX_EXPANDED ? new Error('Archive exceeds expanded size limit') : undefined); } }));
  const names = run('tar', ['-tzf', file], { maxBuffer: 8 * 1024 * 1024 }).split('\n');
  const types = run('tar', ['-tvzf', file], { maxBuffer: 8 * 1024 * 1024 }).split('\n');
  check(names.length <= 20001 && new Set(names).size === names.length && names.includes('_inventory.json') && names.every(n => n === '_inventory.json' || (n.startsWith('data/') && managed(n.slice(5)))) && types.every(t => t.startsWith('-')), 'Unexpected archive member or link');
  mkdirSync(destination, { recursive: true }); check(readdirSync(destination).length === 0, 'Extraction destination must be empty');
  run('tar', ['-xzf', file, '-C', destination, '--no-same-owner', '--no-same-permissions']);
  check(statSync(join(destination, '_inventory.json')).size < 8 * 1024 * 1024, 'Oversized inventory');
  const manifest = validate(JSON.parse(readFileSync(join(destination, '_inventory.json'), 'utf8')));
  check(names.length === manifest.files.length + 1, 'Archive file count mismatch');
  for (const f of manifest.files) { const path = join(destination, 'data', f.path); check(names.includes(`data/${f.path}`) && statSync(path).size === f.bytes && await hashFile(path) === f.sha256, `Invalid extracted file: ${f.path}`); }
  return manifest;
}
