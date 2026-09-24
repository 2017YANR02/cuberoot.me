/** Incremental static publisher. A successful remote update is the only point that advances the baseline. */
import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest } from '../../core/jobs/scramble-stats-build/scramble_manifest.mjs';
import { exists, repoRoot, wcaDir } from './common.js';

export type PublishOptions = {
  root?: string; manifest?: string; host?: string; destination?: string;
  dryRun?: boolean; baseline?: boolean; verifyAll?: boolean;
  /** Injected by offline tests. Production uses local tar/scp/ssh. */
  command?: (program: string, args: string[], input?: string) => Promise<void>;
};

function shellQuote(value: string): string { return `'${value.replaceAll("'", "'\\''")}'`; }
async function command(program: string, args: string[], input?: string): Promise<void> {
  const child = spawn(program, args, { stdio: [input === undefined ? 'ignore' : 'pipe', 'inherit', 'inherit'] });
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
  const root = resolve(options.root ?? join(repoRoot, 'stats', 'scramble'));
  const manifest = resolve(options.manifest ?? join(wcaDir, 'incremental', 'publish_manifest.sha1'));
  const host = options.host ?? process.env.CUBEROOT_STATIC_HOST ?? 'root@cuberoot';
  const destination = options.destination ?? posix.join(process.env.CUBEROOT_STATIC_STATS_DIR ?? '/www/wwwroot/toolkit/stats', 'scramble');
  if (!destination.startsWith('/') || /[\r\n]/.test(host + destination)) throw new Error('Invalid publish host or destination');
  const exec = options.command ?? command;
  const scratch = await mkdtemp(join(tmpdir(), 'scramble-publish-'));
  const current = join(scratch, 'current.sha1');
  try {
    const realCache = `${manifest}.cache.json`;
    const cache = options.dryRun ? join(scratch, 'cache.json') : realCache;
    if (options.dryRun && await exists(realCache)) await copyFile(realCache, cache);
    await buildManifest({ root, cache, output: current, force: options.verifyAll });
    const currentText = await readFile(current, 'utf8');
    const now = parseManifest(currentText);
    const save = async () => {
      await mkdir(dirname(manifest), { recursive: true });
      const temp = `${manifest}.${process.pid}.tmp`;
      await writeFile(temp, currentText);
      await rename(temp, manifest);
    };
    if (options.baseline) {
      if (!options.dryRun) await save();
      console.log(`[baseline] ${now.size} files${options.dryRun ? ' (dry-run)' : ''}`);
      return { changed: [...now.keys()], deleted: [] };
    }
    const previous = await exists(manifest) ? parseManifest(await readFile(manifest, 'utf8')) : null;
    const changed = [...now].filter(([name, hash]) => previous?.get(name) !== hash).map(([name]) => name);
    const deleted = previous ? [...previous.keys()].filter(name => !now.has(name)) : [];
    console.log(`[publish] changed ${changed.length}, deleted ${deleted.length}, baseline ${previous ? 'present' : 'missing'}`);
    if (options.dryRun) return { changed, deleted };
    if (!previous) {
      const archive = join(scratch, 'full.tgz');
      const remote = '/tmp/_scramble_full.tgz';
      const parent = posix.dirname(destination);
      await exec('tar', ['--exclude=scramble/steps/wca_scramble_steps.csv', '-czf', archive, '-C', dirname(root), 'scramble']);
      await exec('scp', [archive, `${host}:${remote}`]);
      await exec('ssh', [host, `set -e; cd ${shellQuote(parent)}; rm -rf scramble.new scramble.prev; mkdir scramble.new; tar -xzf ${shellQuote(remote)} -C scramble.new --strip-components=1; if [ -d scramble ]; then mv scramble scramble.prev; fi; mv scramble.new scramble; rm -rf scramble.prev ${shellQuote(remote)}`]);
    } else {
      if (changed.length) {
        const list = join(scratch, 'changed.txt');
        const archive = join(scratch, 'delta.tgz');
        const remote = '/tmp/_scramble_delta.tgz';
        await writeFile(list, `${changed.join('\n')}\n`);
        await exec('tar', ['-czf', archive, '-C', root, '-T', list]);
        await exec('scp', [archive, `${host}:${remote}`]);
        await exec('ssh', [host, `set -e; cd ${shellQuote(destination)}; tar -xzf ${shellQuote(remote)}; rm -f ${shellQuote(remote)}`]);
      }
      if (deleted.length) {
        await exec('ssh', [host, `cd ${shellQuote(destination)} && xargs -d '\\n' -r rm -f --`], `${deleted.join('\n')}\n`);
      }
    }
    await save();
    return { changed, deleted };
  } finally {
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
