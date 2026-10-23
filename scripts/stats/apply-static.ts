/** Server-side application under the publisher's flock; no network or database access. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type StaticChange = { path: string; before: string | null; after: string | null };
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function filePath(root: string, relative: string): string {
  check(relative.startsWith('./') && !/[\r\n\\]/.test(relative), 'Invalid static path');
  const parts = relative.slice(2).split('/');
  check(parts.every(part => part && part !== '.' && part !== '..'), 'Invalid static path');
  let path = root;
  for (const [index, part] of parts.entries()) {
    path = join(path, part);
    try {
      const stat = lstatSync(path);
      check(!stat.isSymbolicLink() && (index === parts.length - 1 ? stat.isFile() : stat.isDirectory()), `Unmanaged static path: ${relative}`);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return path;
}
async function hash(path: string): Promise<string | null> {
  if (!existsSync(path)) return null;
  const digest = createHash('sha1');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}

export async function applyStaticDelta(root: string, archive: string | null, changes: StaticChange[]): Promise<void> {
  check(Array.isArray(changes) && new Set(changes.map(c => c.path)).size === changes.length, 'Invalid static changes');
  check(lstatSync(root).isDirectory() && !lstatSync(root).isSymbolicLink(), 'Static destination must be a real directory');
  const current = new Map<string, string | null>();
  // Validate the complete batch before touching any live file. Replays are safe.
  for (const c of changes) {
    check([c.before, c.after].every(value => value === null || /^[a-f0-9]{40}$/.test(value)), 'Invalid static checksum');
    const actual = await hash(filePath(root, c.path)); current.set(c.path, actual);
    check(actual === c.before || actual === c.after, `Concurrent static update: ${c.path}; live content differs from the last successful publication. Preserve local outputs and restore a matching publication baseline before retrying.`);
  }
  const updates = changes.filter(c => c.after !== null);
  const updatePaths = new Set(updates.map(c => c.path));
  const stage = mkdtempSync(join(root, '.scramble-publish-'));
  try {
    if (updates.length) {
      check(archive, 'Missing static archive');
      const options = { encoding: 'utf8' as const, maxBuffer: 64 * 1024 * 1024 };
      const names = execFileSync('tar', ['-tzf', archive], options).split('\n').filter(Boolean);
      const types = execFileSync('tar', ['-tvzf', archive], options).split('\n').filter(Boolean);
      check(names.length === updates.length && new Set(names).size === names.length
        && names.every(name => updatePaths.has(name)) && types.every(type => type.startsWith('-')), 'Unexpected static archive member or link');
      execFileSync('tar', ['-xzf', archive, '-C', stage, '--no-same-owner', '--no-same-permissions']);
      for (const c of updates) check(await hash(filePath(stage, c.path)) === c.after, `Static source changed during upload: ${c.path}`);
    }
    for (const c of changes) {
      if (current.get(c.path) === c.after) continue;
      const target = filePath(root, c.path);
      if (c.after === null) rmSync(target, { force: true });
      else {
        mkdirSync(dirname(target), { recursive: true });
        // stage is on the destination filesystem, so readers see a complete file.
        renameSync(filePath(stage, c.path), target);
      }
    }
  } finally { rmSync(stage, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [root, archive] = process.argv.slice(2);
  check(root?.startsWith('/') && archive, 'Usage: apply-static.ts DESTINATION ARCHIVE|-');
  await applyStaticDelta(root, archive === '-' ? null : archive, JSON.parse(readFileSync(0, 'utf8')));
}
