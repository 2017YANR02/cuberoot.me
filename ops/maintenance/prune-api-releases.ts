import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const releaseName = /^(?:\d+-\d+-[a-f0-9]{40}|legacy-\d{8}T\d{6}Z-\d+)$/;
const stagingName = /^\.(\d+)-(\d+)-([a-f0-9]{40})\.staging$/;

function releaseRoot(root: string): string {
  const releases = join(root, 'releases');
  if (realpathSync(root) !== root || realpathSync(releases) !== releases) throw new Error('Unsafe release root');
  return releases;
}

function removeManagedDirectory(releases: string, path: string, apply: boolean) {
  if (resolve(path, '..') !== releases || lstatSync(path).isSymbolicLink() || realpathSync(path) !== path) throw new Error('Release changed during cleanup');
  const device = statSync(releases).dev;
  const validate = (dir: string) => {
    if (lstatSync(dir).dev !== device) throw new Error('Refusing to cross a filesystem boundary');
    for (const name of readdirSync(dir)) {
      const child = join(dir, name), stat = lstatSync(child);
      if (stat.dev !== device) throw new Error('Refusing to cross a filesystem boundary');
      if (stat.isDirectory() && !stat.isSymbolicLink()) validate(child);
    }
  };
  validate(path);
  if (apply) rmSync(path, { recursive: true });
}

export function listStaging(root: string): string[] {
  const releases = releaseRoot(root);
  return readdirSync(releases).filter((name) => {
    const stat = lstatSync(join(releases, name));
    return stagingName.test(name) && stat.isDirectory() && !stat.isSymbolicLink() && stat.dev === statSync(releases).dev;
  }).sort();
}

export interface DeploymentAttempt {
  id: number; run_attempt: number; head_sha: string; status: string;
  path: string; head_branch: string; repository: { full_name: string };
}

// Caller serializes with Deploy Core and supplies GitHub's exact attempt status.
// Never infer inactivity from timestamps, absence of an open fd, or run age.
export function pruneStaging(root: string, references: string[], attempts: DeploymentAttempt[], apply = false) {
  const releases = releaseRoot(root);
  const links = () => readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isSymbolicLink()).flatMap((entry) => {
    try { return [realpathSync(join(root, entry.name))]; }
    catch (error) { if (disappeared(error)) return []; throw error; }
  });
  const removed: string[] = [], kept: string[] = [];
  for (const name of listStaging(root)) {
    const [, run, attempt, sha] = stagingName.exec(name)!;
    const path = join(releases, name);
    const evidence = attempts.find((record) => String(record.id) === run && String(record.run_attempt) === attempt
      && record.head_sha === sha && record.status === 'completed' && record.head_branch === 'main'
      && record.path === '.github/workflows/deploy_core.yml' && record.repository.full_name === '2017YANR02/cuberoot.me');
    const used = [...references, ...links()].some((value) => value === path || value.includes(`${path}/`));
    if (!evidence || used) { kept.push(path); continue; }
    removeManagedDirectory(releases, path, apply);
    removed.push(path);
  }
  return { apply, kept, removed };
}

function disappeared(error: unknown): boolean {
  return ['ENOENT', 'ESRCH'].includes((error as NodeJS.ErrnoException).code ?? '');
}

// Read only process paths, never environments (which may contain credentials).
export function processReferences(procRoot = '/proc'): string[] {
  const references: string[] = [];
  for (const pid of readdirSync(procRoot).filter((name) => /^\d+$/.test(name))) {
    const base = join(procRoot, pid);
    try {
      references.push(readFileSync(join(base, 'cmdline'), 'utf8').replaceAll('\0', '\n'));
      references.push(readFileSync(join(base, 'maps'), 'utf8'));
      for (const name of ['cwd', 'exe', ...readdirSync(join(base, 'fd')).map((fd) => `fd/${fd}`)]) {
        try { references.push(readlinkSync(join(base, name))); }
        catch (error) { if (!disappeared(error)) throw error; }
      }
    } catch (error) { if (!disappeared(error)) throw error; }
  }
  return references;
}

export function pruneReleases(root: string, references: string[], apply = false, previous?: string) {
  const releases = releaseRoot(root);
  const active = realpathSync(join(root, 'dist'));
  const owner = (dist: string) => {
    const path = resolve(dist, '..');
    if (resolve(path, '..') !== releases || !releaseName.test(path.slice(releases.length + 1))
      || realpathSync(path) !== path || !statSync(join(path, 'dist/server.bundle.js')).isFile()) {
      throw new Error('Active/rollback release is not a valid managed release');
    }
    return path;
  };
  const protectedPaths = new Set([owner(active)]);
  if (previous) protectedPaths.add(owner(realpathSync(previous)));
  const entries = readdirSync(releases).filter((name) => releaseName.test(name)).map((name) => {
    const path = join(releases, name);
    const stat = lstatSync(path);
    // Never follow a release symlink, delete staging, or include an unknown layout.
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== statSync(releases).dev) return null;
    if (!statSync(join(path, 'dist/server.bundle.js')).isFile()) throw new Error(`Incomplete release: ${name}`);
    return { path, modified: stat.mtimeMs };
  }).filter((entry) => entry !== null).sort((a, b) => b.modified - a.modified || b.path.localeCompare(a.path));
  // Keep two newest alternatives, even when the active release is an older rollback.
  for (const entry of entries.filter((entry) => entry.path !== owner(active)).slice(0, 2)) protectedPaths.add(entry.path);
  for (const entry of entries) {
    if (references.some((value) => value.includes(`${entry.path}/`) || value === entry.path)) protectedPaths.add(entry.path);
  }
  const removed: string[] = [];
  for (const { path } of entries) {
    if (protectedPaths.has(path)) continue;
    if (realpathSync(join(root, 'dist')) !== active) throw new Error('Active release changed; aborting cleanup');
    removeManagedDirectory(releases, path, apply);
    removed.push(path);
  }
  return { apply, kept: [...protectedPaths], removed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg, i) => arg !== '--apply' && arg !== '--previous' && args[i - 1] !== '--previous')) throw new Error('Unknown argument');
  const previousIndex = args.indexOf('--previous');
  if (previousIndex >= 0 && !args[previousIndex + 1]) throw new Error('Missing previous release');
  console.log(JSON.stringify(pruneReleases('/root/core-api', processReferences(), args.includes('--apply'),
    previousIndex < 0 ? undefined : args[previousIndex + 1]), null, 2));
}
