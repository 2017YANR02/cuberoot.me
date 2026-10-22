import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync, readlinkSync, renameSync, symlinkSync, rmSync, cpSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from './common.ts';
import { archiveDescriptor, hashFile, inventory, unit, unpackSnapshot, validate, type Archive, type Inventory } from './snapshot.ts';
const present = (p: string) => { try { lstatSync(p); return true; } catch { return false; } };
// Production dataset pointers only; never links between development checkouts.
function link(target: string, path: string) { const tmp = path + '.next'; if (present(tmp)) rmSync(tmp); symlinkSync(target, tmp); renameSync(tmp, path); }
const base = (root: string) => join(root, '.stats-data');
const journal = (root: string) => join(base(root), 'transaction.json');
function current(root: string) { return readlinkSync(join(base(root), 'current')).replace(/^datasets\//, ''); }
function safeHash(hash: string) { check(/^(bootstrap|[a-f0-9]{64})$/.test(hash), 'Unmanaged statistics pointer'); return hash; }
function publicTarget(root: string, name: string) { return relative(dirname(join(root, name)), join(base(root), 'current/data', name)); }
function units(m: Inventory) { return [...new Set(m.files.map(f => unit(f.path)))]; }
export function rollbackSnapshot(root: string) {
  if (!existsSync(journal(root))) return;
  const tx = JSON.parse(readFileSync(journal(root), 'utf8'));
  link(`datasets/${safeHash(tx.previous)}`, join(base(root), 'current'));
  for (const name of tx.added) { const p = join(root, name); if (present(p) && lstatSync(p).isSymbolicLink() && readlinkSync(p) === publicTarget(root, name)) rmSync(p); }
  rmSync(journal(root));
}
export function finalizeSnapshot(root: string, hash: string) {
  check(current(root) === safeHash(hash), 'Unexpected active statistics snapshot');
  const m = validate(JSON.parse(readFileSync(join(base(root), 'current/_inventory.json'), 'utf8')));
  if (existsSync(journal(root))) {
    const tx = JSON.parse(readFileSync(journal(root), 'utf8'));
    for (const name of tx.previousUnits) if (!units(m).includes(name)) {
      const p = join(root, name); check(lstatSync(p).isSymbolicLink() && readlinkSync(p) === publicTarget(root, name), 'Refusing to delete unmanaged file'); rmSync(p);
    }
  }
  for (const name of readdirSync(join(base(root), 'datasets'))) { safeHash(name); if (name !== hash) rmSync(join(base(root), 'datasets', name), { recursive: true }); }
  rmSync(join(base(root), 'legacy'), { recursive: true, force: true }); rmSync(journal(root), { force: true });
}
export function recoverSnapshot(root: string, committed: string) {
  if (!existsSync(journal(root))) return;
  const tx = JSON.parse(readFileSync(journal(root), 'utf8'));
  if (tx.next === committed) finalizeSnapshot(root, committed); else rollbackSnapshot(root);
}
export async function activateSnapshot(root: string, archive: string, descriptor: Archive, expected: string, verify = verifySnapshot) {
  const a = archiveDescriptor(descriptor); check(!existsSync(journal(root)), 'Recover unfinished statistics transaction first');
  mkdirSync(join(base(root), 'datasets'), { recursive: true });
  const dest = join(base(root), 'datasets', a.sha256);
  if (present(join(base(root), 'current')) && current(root) === a.sha256) {
    check(expected === a.sha256, 'Unexpected active snapshot');
    await verify(root, validate(JSON.parse(readFileSync(join(dest, '_inventory.json'), 'utf8')))); return;
  }
  if (existsSync(dest)) rmSync(dest, { recursive: true });
  const next = await unpackSnapshot(archive, dest, a); check(next.kind === 'snapshot', 'Cannot activate a patch');
  let previous: Inventory;
  if (!present(join(base(root), 'current'))) {
    check(expected === 'none', 'Release points to a missing server snapshot');
    previous = await inventory(root, next.sourceCommit);
    check(JSON.stringify(previous.files) === JSON.stringify(next.files), 'Bootstrap source changed; export live data again');
    const bootstrap = join(base(root), 'datasets/bootstrap'); mkdirSync(join(bootstrap, 'data'), { recursive: true });
    for (const name of units(previous)) { mkdirSync(dirname(join(bootstrap, 'data', name)), { recursive: true }); cpSync(join(root, name), join(bootstrap, 'data', name), { recursive: true, dereference: true }); }
    writeFileSync(join(bootstrap, '_inventory.json'), JSON.stringify(previous));
    link('datasets/bootstrap', join(base(root), 'current'));
  } else {
    check(current(root) === expected || (current(root) === 'bootstrap' && expected === 'none'), 'Server/Release snapshot mismatch');
    previous = validate(JSON.parse(readFileSync(join(base(root), 'current/_inventory.json'), 'utf8')));
  }
  for (const f of previous.files) check(await hashFile(join(root, f.path)) === f.sha256, `Live data changed outside the publisher: ${f.path}`);
  const previousUnits = units(previous), nextUnits = units(next);
  function checkUnit(path: string, prefix: string) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const rel = `${prefix}/${entry.name}`;
      // Older Mac tar uploads carried AppleDouble sidecars. They are not data;
      // recognize the binary signature rather than ignoring arbitrary hidden files.
      if (entry.isFile() && entry.name.startsWith('._') && lstatSync(join(path, entry.name)).size <= 1048576) {
        const bytes = readFileSync(join(path, entry.name));
        if (bytes.length >= 4 && bytes.readUInt32BE(0) === 0x00051607) continue;
      }
      if (entry.isDirectory()) checkUnit(join(path, entry.name), rel);
      else check(previous.files.some(f => f.path === rel), `Unmanaged file inside statistics unit: ${rel}`);
    }
  }
  for (const name of previousUnits) if (lstatSync(join(root, name)).isDirectory()) checkUnit(join(root, name), name);
  writeFileSync(journal(root), JSON.stringify({ previous: safeHash(current(root)), next: a.sha256, previousUnits, added: nextUnits.filter(n => !previousUnits.includes(n)) }));
  try {
    mkdirSync(join(base(root), 'legacy'), { recursive: true });
    for (const name of nextUnits) {
      const p = join(root, name), target = publicTarget(root, name);
      mkdirSync(dirname(p), { recursive: true });
      if (present(p)) {
        if (lstatSync(p).isSymbolicLink()) { check(readlinkSync(p) === target, 'Unmanaged public statistics symlink'); continue; }
        const backup = join(base(root), 'legacy', name); check(!present(backup), 'Duplicate legacy statistics backup'); mkdirSync(dirname(backup), { recursive: true }); renameSync(p, backup);
        try { symlinkSync(target, p); } catch (error) { renameSync(backup, p); throw error; }
        continue;
      }
      symlinkSync(target, p);
    }
    link(`datasets/${a.sha256}`, join(base(root), 'current'));
    await verify(root, next);
  } catch (error) { rollbackSnapshot(root); throw error; }
}
export async function verifySnapshot(root: string, m: Inventory) {
  for (const f of m.files) check(await hashFile(join(root, f.path)) === f.sha256, `Live statistics checksum mismatch: ${f.path}`);
  for (const name of ['all_past_comps.json', 'all_upcoming_comps.json', 'comp_calendar/index.json', 'scramble/distribution.json', 'world_bests.json']) {
    const f = m.files.find(f => f.path === name); if (!f) continue;
    const r = await fetch(`https://static.cuberoot.me/stats/${name}?snapshot=${f.sha256}`, { signal: AbortSignal.timeout(45000) });
    check(r.ok, `Static ${name}: ${r.status}`);
    const { createHash } = await import('node:crypto'); check(createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex') === f.sha256, `Public statistics mismatch: ${name}`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, root, argument, descriptor, expected] = process.argv.slice(2);
  check(root === '/www/wwwroot/toolkit/stats', 'Explicit production statistics root required');
  if (action === 'activate') await activateSnapshot(root, argument, JSON.parse(readFileSync(descriptor, 'utf8')), expected);
  else if (action === 'recover') recoverSnapshot(root, argument);
  else if (action === 'rollback') rollbackSnapshot(root);
  else if (action === 'finalize') finalizeSnapshot(root, argument);
  else throw new Error('Unknown snapshot deployment action');
}
