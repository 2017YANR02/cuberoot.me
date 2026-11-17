// Next/Tailwind can retain failed import/exports resolution after a file appears.
// Structural changes restart only our child; ordinary edits stay with Fast Refresh.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, watch, type FSWatcher } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { resolveWorkspacePath } from './resolve-workspace-path.mjs';

const sourceDirs = new Set(['src', 'app', 'pages', 'components', 'hooks', 'lib', 'i18n', 'data', 'types', 'public', 'wasm', 'styles', 'contexts', 'utils']);
const ignored = (name: string) => name.startsWith('.') || ['node_modules', 'dist', 'target', 'coverage'].includes(name);

export function clientWorkspaces(core: string): string[] {
  const roots = new Set<string>();
  function visit(name: string) {
    const root = join(core, resolveWorkspacePath(name, core));
    if (roots.has(root)) return;
    roots.add(root);
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    for (const [dep, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      if (typeof version === 'string' && version.startsWith('workspace:')) visit(dep);
    }
  }
  visit('@cuberoot/client');
  return [...roots];
}

export function structureSnapshot(roots: string[]): string {
  const entries: string[] = [];
  function walk(root: string, nested: boolean) {
    for (const item of readdirSync(root, { withFileTypes: true })) {
      if (ignored(item.name)) continue;
      const path = join(root, item.name);
      if (item.isDirectory()) {
        if (nested || sourceDirs.has(item.name)) { entries.push(path + '/'); walk(path, true); }
      } else if (item.isFile()) {
        if (!nested && (item.name === 'next-env.d.ts' || !/\.(?:[cm]?[jt]sx?|css|scss|sass|less|json)$/.test(item.name))) continue;
        entries.push(path);
        if (!nested && item.name === 'package.json') entries.push(readFileSync(path, 'utf8'));
      }
    }
  }
  for (const root of roots) walk(root, false);
  return entries.sort().join('\n');
}

export function watchStructure(getRoots: () => string[], changed: () => void, failed: (error: Error) => void, delay = 700) {
  let watchers: FSWatcher[] = [], timer: ReturnType<typeof setTimeout> | undefined, closed = false;
  let roots = getRoots(), snapshot = structureSnapshot(roots);
  function schedule() {
    if (closed) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        // Read after the batch settles, so atomic saves do not look like removals.
        const nextRoots = getRoots(), next = structureSnapshot(nextRoots);
        if (next === snapshot) return;
        roots = nextRoots; snapshot = next; attach(); changed();
      } catch (error) {
        // A package.json can be briefly incomplete during an editor save.
        if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === 'ENOENT') schedule();
        else failed(error as Error);
      }
    }, delay);
  }
  function attach() {
    watchers.forEach(w => w.close()); watchers = [];
    for (const root of roots) {
      const add = (path: string, recursive: boolean) => {
        const watcher = watch(path, { recursive }, (event, name) => {
          if (name && String(name).split(/[\\/]/).some(ignored)) return;
          if (event === 'rename' || !name || String(name) === 'package.json') schedule();
        });
        watcher.on('error', failed); watchers.push(watcher);
      };
      add(root, false);
      for (const name of sourceDirs) if (existsSync(join(root, name))) add(join(root, name), true);
    }
  }
  attach();
  return () => { closed = true; clearTimeout(timer); watchers.forEach(w => w.close()); };
}

export async function runNextDev(options: { client?: string; roots?: () => string[]; args?: string[] } = {}) {
  const core = resolve(import.meta.dirname, '..');
  const client = options.client ?? join(core, resolveWorkspacePath('@cuberoot/client', core));
  const require = createRequire(join(client, 'package.json'));
  const nextBin = require.resolve('next/dist/bin/next');
  const dist = resolve(client, process.env.NEXT_DEV_DIST_DIR || '.next');
  if (!dist.startsWith(client + sep)) throw Error('Development cache must be inside the client workspace');
  let child: ChildProcess | undefined, stopping = false, restarting = false, pending = false;
  const args = options.args ?? process.argv.slice(2);
  function launch() {
    child = spawn(process.execPath, [nextBin, 'dev', ...(args.length ? args : ['-H', '127.0.0.1', '-p', '3000'])], {
      cwd: client, stdio: 'inherit', detached: process.platform !== 'win32',
    });
    child.once('error', fail);
    child.once('exit', code => {
      if (!restarting && !stopping) { stopping = true; close(); process.exitCode = code ?? 1; }
    });
  }
  async function stopChild() {
    const current = child;
    if (!current?.pid || current.exitCode !== null || current.signalCode !== null) return;
    const exited = new Promise<void>(done => current.once('exit', () => done()));
    function signal(force: boolean) {
      try {
        if (process.platform === 'win32') execFileSync('taskkill.exe', ['/PID', String(current!.pid), '/T', ...(force ? ['/F'] : [])], { stdio: 'ignore' });
        else process.kill(-current!.pid!, force ? 'SIGKILL' : 'SIGTERM');
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH' && process.platform !== 'win32') throw error; }
    }
    signal(false);
    const timeout = setTimeout(() => signal(true), 8000);
    await exited; clearTimeout(timeout);
  }
  async function restart() {
    pending = true;
    if (restarting || stopping) return;
    restarting = true;
    try {
      while (pending && !stopping) {
        pending = false;
        console.log('[dev-structure] Source files or package metadata changed; refreshing Next resolution.');
        await stopChild();
        if (stopping) break;
        // The child is gone before invalidation. Preserve production output.
        await rm(join(dist, 'dev'), { recursive: true, force: true });
        if (!stopping) launch();
      }
    } catch (error) { fail(error as Error); }
    finally { restarting = false; }
  }
  function fail(error: Error) { console.error(error); process.exitCode = 1; void shutdown(); }
  async function shutdown() {
    if (stopping) return;
    stopping = true; close(); await stopChild();
  }
  const close = watchStructure(options.roots ?? (() => clientWorkspaces(core)), () => void restart(), fail);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.once(signal, () => void shutdown());
  launch();
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runNextDev().catch(error => { console.error(error); process.exitCode = 1; });
}
