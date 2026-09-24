import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { assertClone, assertFiles, command, fileSize, filesUnder, git, gitPrint, parseOptions, readUtf8, repoRoot, upstreamDir, versionRecord, writeUtf8 } from './lib.js';

interface Input { root: string; upstream: string; skipPull?: boolean; skipInstall?: boolean }
const basePath = '/tools/blddb';
const required = ['index.html', 'corner/index.html', 'edge/index.html', 'bigbld/wing/index.html', 'nightmare/parity/index.html', 'commutator/index.html', 'checker/index.html', 'sheets/index.html', 'code/index.html', 'settings/index.html', '404.html', 'corner/__next.$d$codeType.__PAGE__.txt', 'nightmare/parity/__next.nightmare.$d$codeType.__PAGE__.txt'];
const dataRequired = ['cornerManmade.json', 'edgeManmade.json', 'parityManmade.json', 'twistsManmade.json', 'flipsManmade.json', 'ltctManmade.json', 'sourceToUrl.json', 'sourceToResult.json', 'algToUrl.json'];
const lines = (text: string) => text.split('\n').map(line => line.trim()).filter(Boolean);
const assertOnlyAgents = (paths: string[], context: string) => { const others = [...new Set(paths)].filter(path => path !== 'AGENTS.md'); if (others.length) throw new Error(`${context} contains unexpected local paths: ${others.join(', ')}`); };
const gitLines = (dir: string, ...args: string[]) => lines(git(dir, ...args));
const patchWrite = (path: string, text: string) => writeUtf8(path, text.replace(/\r\n/g, '\n'));

export function syncBlddb({ root, upstream, skipPull = false, skipInstall = false }: Input): void {
  assertFiles(root, ['scripts/upstream/sync-blddb.ts', 'scripts/upstream/lib.ts', '.sync/blddb_postprocess.mjs', 'docs/generated-artifacts.json']);
  assertClone(upstream);
  const primary = { head: git(upstream, 'rev-parse', '--verify', 'HEAD'), status: git(upstream, 'status', '--porcelain=v1', '--untracked-files=all'), stash: git(upstream, 'stash', 'list', '--format=%H') };
  assertOnlyAgents([
    ...gitLines(upstream, 'diff', '--name-only'), ...gitLines(upstream, 'diff', '--cached', '--name-only'),
    ...gitLines(upstream, 'ls-files', '--others', '--exclude-standard'),
  ], 'BLDDB working tree');
  const remoteRef = 'refs/remotes/origin/v2';
  if (!skipPull) gitPrint(upstream, 'fetch', '--no-tags', 'origin', `+refs/heads/v2:${remoteRef}`);
  const sourceCommit = git(upstream, 'rev-parse', '--verify', `${remoteRef}^{commit}`);
  assertOnlyAgents(gitLines(upstream, 'log', '--format=', '--name-only', `${remoteRef}..HEAD`), 'BLDDB local-only commits');
  const parent = join(root, '.tmp/upstream');
  const source = join(parent, `blddb-${randomUUID()}`);
  const staging = join(root, '.tmp', `blddb-sync-${randomUUID()}`);
  const candidate = join(staging, 'candidate');
  const previous = join(staging, 'previous');
  const target = join(root, 'tools/blddb');
  let worktreeAdded = false;
  let previousMoved = false;
  mkdirSync(parent, { recursive: true });
  try {
    gitPrint(upstream, 'worktree', 'add', '--detach', source, sourceCommit);
    worktreeAdded = true;
    if (git(source, 'rev-parse', '--verify', 'HEAD') !== sourceCommit) throw new Error('BLDDB detached worktree source drifted');
    if (!skipInstall || !existsSync(join(source, 'node_modules'))) command('npm', ['install', '--no-audit', '--no-fund'], { cwd: source });
    const nextConfig = join(source, 'next.config.js');
    const server = join(source, 'src/i18n/server.ts');
    const nextEnv = join(source, 'next-env.d.ts');
    const backups = new Map<string, string>([[nextConfig, readUtf8(nextConfig)], [server, readUtf8(server)], [nextEnv, readUtf8(nextEnv)]]);
    try {
      patchWrite(nextConfig, `/** @type {import('next').NextConfig} */\n// PATCHED by cuberoot.me/scripts/upstream/sync-blddb.ts for static export.\nconst nextConfig = {\n  output: "export",\n  basePath: "${basePath}",\n  trailingSlash: true,\n  images: { unoptimized: true },\n};\nmodule.exports = nextConfig;\n`);
      let i18n = backups.get(server)!.replace(/\r\n/g, '\n');
      const importAnchor = 'import { cookies } from "next/headers";';
      const bodyAnchor = '  const cookieStore = cookies();\n  return (await cookieStore).get("i18next")?.value as Locales;';
      if (!i18n.includes(importAnchor) || !i18n.includes(bodyAnchor)) throw new Error('BLDDB i18n/server.ts patch anchors changed');
      i18n = i18n.replace(importAnchor + '\n', '').replace(bodyAnchor, '  // PATCHED: static export has no request context.\n  return undefined as unknown as Locales;');
      patchWrite(server, i18n);
      let imageHits = 0;
      for (const file of filesUnder(join(source, 'src')).filter(path => /\.tsx?$/.test(path))) {
        const original = readUtf8(file);
        const matches = original.match(/(["']|\()\/images\//g);
        if (!matches?.length) continue;
        backups.set(file, original);
        patchWrite(file, original.replace(/(["']|\()\/images\//g, `$1${basePath}/images/`));
        imageHits += matches.length;
      }
      if (!imageHits) throw new Error('BLDDB image patch matched no /images/ references');
      const out = join(source, 'out');
      rmSync(out, { recursive: true, force: true });
      command('npm', ['run', 'build'], { cwd: source });
    } finally { for (const [path, original] of backups) writeUtf8(path, original); }
    const out = join(source, 'out');
    const nextDirs = filesUnder(out).map(path => { const parts = relative(out, path).split(sep); const position = parts.findIndex(part => part.startsWith('__next')); return position >= 0 ? join(out, ...parts.slice(0, position + 1)) : undefined; }).filter((value): value is string => Boolean(value));
    for (const dir of [...new Set(nextDirs)].sort((a, b) => b.length - a.length)) {
      if (!existsSync(dir)) continue;
      const folderName = relative(join(dir, '..'), dir);
      for (const file of filesUnder(dir)) {
        const flattened = `${folderName}.${relative(dir, file).split(sep).join('.')}`;
        renameSync(file, join(dir, '..', flattened));
      }
      rmSync(dir, { recursive: true, force: true });
    }
    const missing = required.filter(path => !existsSync(join(out, path)));
    if (missing.length) throw new Error(`BLDDB export missing files: ${missing.join(', ')}`);
    const home = readUtf8(join(out, 'index.html'));
    if (!home.includes(`${basePath}/_next/`) || /(?<!blddb)"\/images\//.test(home)) throw new Error('BLDDB basePath or image patch failed');
    const data = join(out, 'data');
    if (existsSync(data)) {
      for (const file of filesUnder(data)) if (/Nightmare/.test(file)) rmSync(file, { force: true });
      rmSync(join(data, 'nightmare'), { recursive: true, force: true });
      const missingData = dataRequired.filter(path => !existsSync(join(data, path)));
      if (missingData.length) throw new Error(`BLDDB data missing: ${missingData.join(', ')}`);
    }
    mkdirSync(staging, { recursive: true });
    cpSync(out, candidate, { recursive: true });
    cpSync(join(source, 'LICENSE'), join(candidate, 'LICENSE'));
    command('node', [join(root, '.sync/blddb_postprocess.mjs'), '--upstream', source, '--repo', root, '--data-dir', join(candidate, 'data')]);
    versionRecord(root, 'tools.blddb', source, join(candidate, 'UPSTREAM.txt'));
    const missingCandidate = ['index.html', 'LICENSE', 'UPSTREAM.txt', 'data/cornerManmade.json'].filter(path => !existsSync(join(candidate, path)));
    if (missingCandidate.length) throw new Error(`BLDDB candidate incomplete: ${missingCandidate.join(', ')}`);
    if (!readUtf8(join(candidate, 'UPSTREAM.txt')).split('\n').includes(`Commit: ${sourceCommit}`)) throw new Error('BLDDB provenance does not match detached source');
    if (git(source, 'status', '--porcelain=v1', '--untracked-files=no')) throw new Error('BLDDB build modified tracked source files');
    try {
      if (existsSync(target)) { renameSync(target, previous); previousMoved = true; }
      renameSync(candidate, target);
    } catch (error) {
      if (previousMoved && !existsSync(target)) renameSync(previous, target);
      throw new Error(`BLDDB publication failed: ${String(error)}`);
    }
    rmSync(previous, { recursive: true, force: true });
    console.log(`BLDDB synced: ${filesUnder(target).length} files, ${(fileSize(target) / 2 ** 20).toFixed(1)} MiB; CubeRoot changes remain uncommitted`);
  } finally {
    if (worktreeAdded) gitPrint(upstream, 'worktree', 'remove', '--force', source);
    rmSync(source, { recursive: true, force: true });
    if (!existsSync(previous)) rmSync(staging, { recursive: true, force: true });
    const after = { head: git(upstream, 'rev-parse', '--verify', 'HEAD'), status: git(upstream, 'status', '--porcelain=v1', '--untracked-files=all'), stash: git(upstream, 'stash', 'list', '--format=%H') };
    if (JSON.stringify(after) !== JSON.stringify(primary)) throw new Error('BLDDB primary clone HEAD, status, or stash changed');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseOptions(); const root = repoRoot(options);
  assertFiles(root, ['scripts/upstream/sync-blddb.ts', 'scripts/upstream/lib.ts', '.sync/blddb_postprocess.mjs']);
  if (options.validateOnly) console.log('BLDDB sync validated');
  else syncBlddb({ root, upstream: upstreamDir(root, 'blddb', options, 'blddbDir'), skipPull: Boolean(options.skipPull), skipInstall: Boolean(options.skipInstall) });
}
