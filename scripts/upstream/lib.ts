import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, copyFileSync, cpSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export type Options = Record<string, string | boolean | string[]>;
export function parseOptions(argv = process.argv.slice(2)): Options {
  const result: Options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('-')) throw new Error(`Unexpected argument: ${arg}`);
    const name = arg.replace(/^-+/, '').replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    if (name.startsWith('no') && name.length > 2 && name[2] === name[2].toUpperCase()) {
      result[name[2].toLowerCase() + name.slice(3)] = false;
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
      const value = argv[++i];
      if (name === 'only') result.only = [...(result.only as string[] ?? []), ...value.split(',').filter(Boolean)];
      else result[name] = value;
    } else result[name] = true;
  }
  return result;
}

export function optionString(options: Options, key: string, fallback?: string): string {
  const value = options[key];
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string') throw new Error(`--${key} requires a value`);
  return value;
}

export function repoRoot(options: Options): string {
  const value = options.repoRoot ?? options.localDir ?? options.projectDir ?? repositoryRoot;
  if (typeof value !== 'string') throw new Error('RepoRoot requires a path');
  const root = resolve(value);
  const missing = ['.git', 'core/pnpm-workspace.yaml', 'tools', 'ops', '.sync'].filter(path => !existsSync(join(root, path)));
  if (missing.length) throw new Error(`RepoRoot is not a complete cuberoot.me checkout: ${root}; missing ${missing.join(', ')}`);
  return root;
}

export function upstreamDir(root: string, key: string, options: Options, legacyKey?: string): string {
  const aliases: Record<string, string> = { cstimer: 'cstimer', solver: 'RubiksSolverDemo', algtrainers: 'mihlefeld-alg-trainers', blddb: 'blddb', recordranks: 'RecordRanks' };
  const envName = `CUBE_UPSTREAM_${key.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_DIR`;
  const override = options.upstreamDir ?? (legacyKey ? options[legacyKey] : undefined) ?? process.env[envName];
  if (override !== undefined) {
    if (typeof override !== 'string') throw new Error(`Invalid ${envName}`);
    return resolve(override);
  }
  const base = process.env.CUBE_UPSTREAM_DIR ? resolve(process.env.CUBE_UPSTREAM_DIR) : resolve(root, '../cube');
  return join(base, aliases[key]);
}

export function assertFiles(root: string, paths: string[]): void {
  const missing = paths.filter(path => !existsSync(join(root, path)));
  if (missing.length) throw new Error(`Missing upstream sync dependencies: ${missing.join(', ')}`);
}

export function command(file: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; allow?: number[]; quiet?: boolean } = {}): string {
  const result = spawnSync(file, args, { cwd: options.cwd, env: options.env, encoding: 'utf8', shell: process.platform === 'win32' && /^(npm|pnpm)$/.test(file) });
  if (!options.quiet && result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (!options.allow?.includes(result.status ?? -1) && result.status !== 0) throw new Error(`${file} ${args.join(' ')} failed (${result.status})`);
  return result.stdout.trim();
}
export function git(dir: string, ...args: string[]): string { return command('git', ['-C', dir, ...args], { quiet: true }); }
export function gitPrint(dir: string, ...args: string[]): string { return command('git', ['-C', dir, ...args]); }
export function gitAncestor(dir: string, ancestor: string, descendant: string): boolean {
  const result = spawnSync('git', ['-C', dir, 'merge-base', '--is-ancestor', ancestor, descendant], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error(`git merge-base failed (${result.status}): ${result.stderr}`);
}
export function stash(dir: string, message: string): string | undefined {
  if (!git(dir, 'status', '--porcelain')) return undefined;
  const previous = git(dir, 'stash', 'list', '-1', '--format=%H');
  git(dir, 'stash', 'push', '--include-untracked', '-q', '-m', message);
  const created = git(dir, 'stash', 'list', '-1', '--format=%H');
  if (!created || created === previous) throw new Error('Working tree changed but no new stash was created');
  return created;
}
export function restoreStash(dir: string, commit: string): void {
  if (git(dir, 'stash', 'list', '-1', '--format=%H') !== commit) throw new Error(`Stash stack changed; changes remain at ${commit}`);
  gitPrint(dir, 'stash', 'pop');
}
export function filesUnder(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap(item => item.isDirectory() ? filesUnder(join(root, item.name)) : item.isFile() ? [join(root, item.name)] : []);
}
export function sameFile(a: string, b: string): boolean {
  if (!existsSync(b)) return false;
  const hash = (path: string) => createHash('md5').update(readFileSync(path)).digest('hex');
  return hash(a) === hash(b);
}
export function copyChanged(src: string, dest: string, dryRun = false): boolean {
  if (sameFile(src, dest)) return false;
  if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(src, dest); }
  return true;
}
export function syncDirectory(src: string, dest: string, dryRun = false): void {
  if (dryRun) return;
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
}
export function writeUtf8(path: string, data: string): void { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data, 'utf8'); }
export function readUtf8(path: string): string { return readFileSync(path, 'utf8'); }
export function gaInlineCode(id: string): string {
  return `\t<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>\n\t<script>\n\t\twindow.dataLayer = window.dataLayer || [];\n\t\tfunction gtag() { dataLayer.push(arguments); }\n\t\tgtag('js', new Date());\n\t\tgtag('config', '${id}');\n\t</script>`;
}

export function versionRecord(root: string, id: string, clone: string, output?: string): void {
  const ledger = JSON.parse(readUtf8(join(root, 'docs/generated-artifacts.json'))) as { artifacts: Array<any> };
  const matches = ledger.artifacts.filter(item => item.id === id);
  if (matches.length !== 1) throw new Error(`Expected one artifact ${id}; found ${matches.length}`);
  const artifact = matches[0];
  if (artifact.versionRecord?.format !== 'structured-v1' || !artifact.versionRecord.path || !artifact.source?.url || !artifact.source?.ref?.type || !artifact.source?.ref?.value || !artifact.license?.spdx) throw new Error(`${id} metadata incomplete`);
  if (!existsSync(join(clone, '.git'))) throw new Error(`${clone} is not a git clone`);
  const normalize = (url: string) => url.trim().replace(/\/$/, '').replace(/\.git$/, '').toLowerCase();
  const origin = git(clone, 'remote', 'get-url', 'origin');
  if (normalize(origin) !== normalize(artifact.source.url)) throw new Error(`${id} origin mismatch: ${origin}`);
  const sha = git(clone, 'rev-parse', '--verify', 'HEAD');
  if (!/^[a-f\d]{40}$/i.test(sha)) throw new Error(`${id} invalid HEAD: ${sha}`);
  const date = git(clone, 'show', '-s', '--format=%cI', 'HEAD');
  const recordPath = resolve(root, output ?? artifact.versionRecord.path);
  if (!recordPath.startsWith(resolve(root) + sep)) throw new Error(`${id} version record escapes repository: ${recordPath}`);
  const lines = ['# Generated from docs/generated-artifacts.json. Do not edit.', `Artifact: ${id}`, `Source: ${artifact.source.url}`, `Ref: ${artifact.source.ref.type} ${artifact.source.ref.value}`, `Commit: ${sha}`, `Date: ${date}`, `License: ${artifact.license.spdx}`, 'Patch owners:', ...artifact.patchOwner.map((value: string) => `- ${value}`), 'Outputs:', ...artifact.outputs.map((value: string) => `- ${value}`)];
  writeUtf8(recordPath, lines.join('\n') + '\n');
}
export function assertClone(path: string): void { if (!existsSync(join(path, '.git'))) throw new Error(`Not a git clone: ${path}`); }
export function relativeSlash(root: string, file: string): string { return relative(root, file).split(sep).join('/'); }
export function fileSize(root: string): number { return filesUnder(root).reduce((sum, file) => sum + statSync(file).size, 0); }
