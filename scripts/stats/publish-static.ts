/** Incremental static publisher. A successful remote update is the only point that advances the baseline. */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest } from '../../core/jobs/scramble-stats-build/scramble_manifest.mjs';
import { exists, repoRoot, taskProgress, wcaDir } from './common.js';
import { managed } from '../wca-data/snapshot.ts';
import { withLocalLock } from '../wca-data/local-lock.ts';
import type { StaticChange } from './apply-static.ts';
// Exact puzzle corpora have an independent immutable Release/receipt lifecycle.
const unmanaged = (name: string) => !name.startsWith('./exact-puzzles/') && !managed(`scramble/${name.slice(2)}`);

export type PublishOptions = {
  root?: string; manifest?: string; host?: string; destination?: string;
  dryRun?: boolean; baseline?: boolean; verifyAll?: boolean;
  /** Injected by offline tests. Production uses local tar/scp/ssh. */
  command?: (program: string, args: string[], input?: string) => Promise<void>;
  capture?: (program: string, args: string[], input: string) => Promise<string>;
};

function shellQuote(value: string): string { return `'${value.replaceAll("'", "'\\''")}'`; }
async function capture(program: string, args: string[], input: string): Promise<string> {
  const child = spawn(program, args, { stdio: ['pipe', 'pipe', 'inherit'] });
  const chunks: Buffer[] = [];
  child.stdout.on('data', chunk => chunks.push(chunk));
  child.stdin.on('error', () => { /* Exit status below reports a disconnected remote. */ });
  child.stdin.end(input);
  const exit = await new Promise<number>((done, fail) => { child.once('error', fail); child.once('close', code => done(code ?? 1)); });
  if (exit !== 0) throw new Error(`${program} audit exited with ${exit}`);
  return Buffer.concat(chunks).toString('utf8');
}
export async function command(program: string, args: string[], input?: string): Promise<void> {
  // Match the Release and exact-puzzle packers: --no-xattrs alone still lets
  // macOS tar add AppleDouble sidecars, which the server correctly rejects.
  const child = spawn(program, args, {
    env: { ...process.env, COPYFILE_DISABLE: '1' },
    stdio: [input === undefined ? 'ignore' : 'pipe', 'inherit', 'inherit'],
  });
  if (input !== undefined) child.stdin.end(input, 'utf8');
  const exit = await new Promise<number>((done, fail) => { child.once('error', fail); child.once('close', code => done(code ?? 1)); });
  if (exit !== 0) throw new Error(`${program} exited with ${exit}`);
}

/** GNU/BSD tar lists accept these paths; reject traversal and line breaks before sending to a shell. */
export function parseManifest(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const match = /^([a-fA-F0-9]{40}) [ *](\.\/[^\r\n\\]+)$/.exec(line);
    if (!match) throw new Error(`Invalid SHA1 manifest row: ${line}`);
    const name = match[2];
    if (name.slice(2).split('/').some(part => part === '.' || part === '..' || !part)) throw new Error(`Invalid manifest path: ${name}`);
    if (result.has(name)) throw new Error(`Duplicate manifest path: ${name}`);
    result.set(name, match[1].toLowerCase());
  }
  return result;
}

export async function publishScrambleIncremental(options: PublishOptions = {}): Promise<{ changed: string[]; deleted: string[] }> {
  if (options.dryRun) return publishUnlocked(options);
  const manifest = resolve(options.manifest ?? join(wcaDir, 'incremental', 'publish_manifest.sha1'));
  return withLocalLock(`${manifest}.lock`, () => publishUnlocked(options));
}

async function publishUnlocked(options: PublishOptions): Promise<{ changed: string[]; deleted: string[] }> {
  const root = resolve(options.root ?? join(repoRoot, 'stats', 'scramble'));
  const manifest = resolve(options.manifest ?? join(wcaDir, 'incremental', 'publish_manifest.sha1'));
  const host = options.host ?? process.env.CUBEROOT_STATIC_HOST ?? 'root@cuberoot';
  const destination = options.destination ?? posix.join(process.env.CUBEROOT_STATIC_STATS_DIR ?? '/www/wwwroot/toolkit/stats', 'scramble');
  if (!destination.startsWith('/') || /[\r\n]/.test(host + destination)) throw new Error('Invalid publish host or destination');
  const exec = options.command ?? command;
  const scratch = await mkdtemp(join(tmpdir(), 'scramble-publish-'));
  const current = join(scratch, 'current.sha1');
  const remote = `/tmp/cuberoot-scramble-${randomUUID()}.tgz`;
  const remoteScript = `${remote}.ts`;
  let uploadedScript = false;
  try {
    const realCache = `${manifest}.cache.json`;
    const cache = options.dryRun ? join(scratch, 'cache.json') : realCache;
    if (options.dryRun && await exists(realCache)) await copyFile(realCache, cache);
    await buildManifest({ root, cache, output: current, force: options.verifyAll,
      progress: state => {
        if (state.phase === 'hashing' || state.phase === 'saving' || state.phase === 'done')
          taskProgress('static:manifest', state.checked, state.total);
      },
    });
    const now = new Map([...parseManifest(await readFile(current, 'utf8'))].filter(([name]) => unmanaged(name)));
    const currentText = [...now].map(([name, hash]) => `${hash}  ${name}\n`).join('');
    const save = async () => {
      await mkdir(dirname(manifest), { recursive: true });
      const temp = `${manifest}.${process.pid}.tmp`;
      await writeFile(temp, currentText);
      await rename(temp, manifest);
    };
    const previous = await exists(manifest) ? new Map([...parseManifest(await readFile(manifest, 'utf8'))].filter(([name]) => unmanaged(name))) : null;
    const candidates: StaticChange[] = [...new Set([...now.keys(), ...(previous?.keys() ?? [])])]
      .map(path => ({ path, before: previous?.get(path) ?? null, after: now.get(path) ?? null }));
    let changes = candidates.filter(c => c.before !== c.after);
    const audit = async (expected: StaticChange[]) => {
      const output = await (options.capture ?? capture)('ssh', [host,
        `flock -w 120 /tmp/cuberoot-scramble-static.lock node ${shellQuote(remoteScript)} ${shellQuote(destination)} --audit`], JSON.stringify(expected));
      const result: StaticChange[] = JSON.parse(output);
      const byPath = new Map(expected.map(c => [c.path, c]));
      if (!Array.isArray(result) || new Set(result.map(c => c.path)).size !== result.length
        || result.some(c => !byPath.has(c.path) || c.after !== byPath.get(c.path)!.after
          || (c.before !== null && c.before !== byPath.get(c.path)!.before))) throw new Error('Invalid remote audit result');
      return result;
    };
    if (!options.dryRun) {
      await exec('scp', [fileURLToPath(new URL('./apply-static.ts', import.meta.url)), `${host}:${remoteScript}`]);
      uploadedScript = true;
      console.log(`[audit] checking ${candidates.length} remote files`);
      changes = await audit(candidates);
    }
    const changed = changes.filter(c => c.after !== null).map(c => c.path);
    const deleted = changes.filter(c => c.after === null).map(c => c.path);
    if (options.baseline && !options.dryRun) {
      if (changes.length) throw new Error('Cannot establish baseline: remote files do not match local data. Publish to repair first.');
      await save();
      return { changed: [], deleted: [] };
    }
    console.log(`[publish] changed ${changed.length}, deleted ${deleted.length}, baseline ${previous ? 'present' : 'missing'}`);
    if (options.dryRun) return { changed, deleted };
    const transferTotal = 1 + (changed.length ? 2 : 0) + (changed.length || deleted.length ? 2 : 0);
    let transferred = 0;
    const advance = () => taskProgress('static:transfer', ++transferred, transferTotal);
    taskProgress('static:transfer', 0, transferTotal);

    if (changed.length) {
      const list = join(scratch, 'changed.txt');
      const archive = join(scratch, 'delta.tgz');
      await writeFile(list, `${changed.join('\n')}\n`);
      await exec('tar', ['--no-xattrs', '-czf', archive, '-C', root, '-T', list]);
      advance();
      await exec('scp', [archive, `${host}:${remote}`]);
      advance();
    }
    if (changed.length || deleted.length) {
      advance();
      // Check expected hashes and apply the entire delta under one server lock.
      const apply = `node ${shellQuote(remoteScript)} ${shellQuote(destination)} ${shellQuote(changed.length ? remote : '-')}`;
      await exec('ssh', [host, `flock -w 120 /tmp/cuberoot-scramble-static.lock ${apply}`], JSON.stringify(changes));
      advance();
    }
    const remaining = await audit(candidates.map(c => ({ ...c, before: c.after })));
    if (remaining.length) throw new Error(`Remote verification failed: ${remaining.length} files still missing`);
    console.log(`[audit] verified ${now.size} remote files; publication baseline may advance`);
    await save();
    advance();
    return { changed, deleted };
  } finally {
    if (uploadedScript) await exec('ssh', [host, `rm -f -- ${shellQuote(remote)} ${shellQuote(remoteScript)}`]).catch(error => console.warn('Remote temporary cleanup failed', error));
    await rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const known = new Set(['--dry-run', '--baseline', '--verify-all', '--publish']);
  if (args.some(arg => !known.has(arg)) || (!args.includes('--dry-run') && !args.includes('--baseline') && !args.includes('--publish')))
    throw new Error('Specify --dry-run, --baseline, or --publish');
  void publishScrambleIncremental({ dryRun: args.includes('--dry-run'), baseline: args.includes('--baseline'), verifyAll: args.includes('--verify-all') })
    .catch(error => { console.error(error); process.exitCode = 1; });
}
