import { cpSync, existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertClone, assertFiles, git, gitPrint, parseOptions, readUtf8, repoRoot, upstreamDir, versionRecord } from './lib.js';

interface Input { root: string; upstream: string; skipPull?: boolean }
const libraries = ['utillib', 'isaac', 'mathlib', 'grouplib', 'poly3dlib', 'pat3x3', 'min2phase'];
const required: Record<string, string[]> = { 'scramble_sq1_new.js': ['solveScramble', 'selfCheck'], 'pyraminx.js': ['solveScramble'], 'redi.js': ['solveScramble'] };
const lf = (text: string) => text.replace(/\r\n/g, '\n');

export function syncCstimerScramble({ root, upstream, skipPull = false }: Input): void {
  assertFiles(root, ['scripts/upstream/sync-cstimer-scramble.ts', 'scripts/upstream/lib.ts', 'docs/generated-artifacts.json']);
  assertClone(upstream);
  if (!skipPull) gitPrint(upstream, 'pull', '--ff-only', 'origin', 'master');
  const dest = join(root, 'tools/cstimer-scramble');
  const record = readUtf8(join(dest, 'UPSTREAM.txt'));
  const base = /Commit:\s+(\w+)/.exec(record)?.[1];
  if (!base || git(upstream, 'cat-file', '-t', base) !== 'commit') throw new Error('Cannot determine valid csTimer merge base from UPSTREAM.txt');
  const pairs = [
    ...libraries.map(name => ({ source: `src/js/lib/${name}.js`, target: join(dest, 'lib', `${name}.js`) })),
    ...readdirSync(join(upstream, 'src/js/scramble')).filter(name => name.endsWith('.js')).map(name => ({ source: `src/js/scramble/${name}`, target: join(dest, 'scramble', name) })),
  ];
  const scratch = mkdtempSync(join(tmpdir(), 'cstimer-sync-'));
  const pending: Array<{ source: string; target: string }> = [];
  const conflicts: string[] = [];
  let merged = 0, copied = 0;
  try {
    for (const [index, pair] of pairs.entries()) {
      const theirs = join(upstream, pair.source);
      if (!existsSync(pair.target) || !git(upstream, 'ls-tree', '--name-only', base, '--', pair.source)) {
        pending.push({ source: theirs, target: pair.target }); copied++; continue;
      }
      const oursFile = join(scratch, `${index}.${basename(pair.target)}.ours`);
      const baseFile = join(scratch, `${index}.${basename(pair.target)}.base`);
      const theirsFile = join(scratch, `${index}.${basename(pair.target)}.theirs`);
      writeFileSync(oursFile, lf(readUtf8(pair.target)), 'utf8');
      writeFileSync(baseFile, lf(execFileSync('git', ['-C', upstream, 'show', `${base}:${pair.source}`], { encoding: 'utf8' })), 'utf8');
      writeFileSync(theirsFile, lf(readUtf8(theirs)), 'utf8');
      const result = spawnSync('git', ['merge-file', '-L', 'cuberoot.me', '-L', 'upstream (last sync)', '-L', 'upstream (new)', oursFile, baseFile, theirsFile], { encoding: 'utf8' });
      if (result.error) throw result.error;
      if (result.status === null || result.status > 127 || result.status < 0) throw new Error(`git merge-file failed for ${pair.source}: ${result.stderr}`);
      if (result.status > 0) { conflicts.push(pair.source); continue; }
      pending.push({ source: oursFile, target: pair.target }); merged++;
    }
    if (conflicts.length) throw new Error(`csTimer merge conflicts (repository unchanged): ${conflicts.join(', ')}`);
    for (const [file, symbols] of Object.entries(required)) {
      const pendingFile = pending.find(item => item.target === join(dest, 'scramble', file));
      if (!pendingFile) throw new Error(`csTimer required scramble source missing: ${file}`);
      const contents = readUtf8(pendingFile.source);
      for (const symbol of symbols) if (!new RegExp(`${symbol}\\s*:\\s*${symbol}`).test(contents)) throw new Error(`CubeRoot export would be lost: ${file} -> ${symbol}`);
    }
    for (const pair of pending) { mkdirSync(dirname(pair.target), { recursive: true }); cpSync(pair.source, pair.target, { force: true }); }
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  cpSync(join(upstream, 'LICENSE'), join(dest, 'LICENSE'), { force: true });
  versionRecord(root, 'tools.cstimer-scramble', upstream);
  console.log(`csTimer scramble synced: merged ${merged}, copied ${copied}; CubeRoot changes remain uncommitted`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseOptions(); const root = repoRoot(options);
  assertFiles(root, ['scripts/upstream/sync-cstimer-scramble.ts', 'scripts/upstream/lib.ts']);
  if (options.validateOnly) console.log('csTimer scramble sync validated');
  else syncCstimerScramble({ root, upstream: upstreamDir(root, 'cstimer', options, 'cstimerDir'), skipPull: Boolean(options.skipPull) });
}
