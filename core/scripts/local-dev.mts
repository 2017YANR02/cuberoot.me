// Shared foreground entry for localhost, existing FRP, and per-device SSH previews.
// Default: stop this checkout's previous session, clear its cache and start fresh.
import { spawn, execFileSync, type StdioOptions } from 'node:child_process';
import { createConnection } from 'node:net';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { resolveWorkspacePath } from './resolve-workspace-path.mjs';
import { restartManaged, registerSession, clearPreviousDev } from './dev-preview/restart.ts';
export { restartManaged, registerSession, clearPreviousDev, stopLegacyRunner } from './dev-preview/restart.ts';

const core = resolve(import.meta.dirname, '..');
const localUrl = 'http://127.0.0.1:3000/zh';
function listening(): Promise<boolean> {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port: 3000 });
    const finish = (value: boolean) => { socket.destroy(); resolve(value); };
    socket.once('connect', () => finish(true)); socket.once('error', () => finish(false));
    socket.setTimeout(2000, () => finish(true));
  });
}
export function openBrowser(url: string) {
  const child = process.platform === 'darwin' ? spawn('open', [url], { stdio: 'ignore' })
    : spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { stdio: 'ignore' });
  child.on('error', () => console.log(`Open ${url} in your browser.`));
}
export async function healthy(url: string, timeout = 8000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  return response.status === 200 && (await response.text()).includes('CubeRoot');
}
export function prepareLocalDev(workspace: string, stdio: StdioOptions = 'inherit') {
  const client = join(workspace, resolveWorkspacePath('@cuberoot/client', workspace));
  const next = join(client, 'node_modules/next/dist/bin/next');
  const turbo = join(workspace, 'node_modules/turbo/bin/turbo');
  if (!existsSync(next) || !existsSync(turbo)) throw Error('Dependencies missing. Run pnpm install in core.');
  // Reuse the existing asset generators; do not duplicate their implementation.
  for (const args of [
    ['--import', 'tsx', 'packages/client/scripts/build-cube-history.ts'],
    ['scripts/copy-maplibre-assets.mts'],
    ['scripts/build-cubing-worker.mjs', 'packages/client/public/cubing-chunks'],
  ]) execFileSync(process.execPath, args, { cwd: workspace, stdio, timeout: 120000 });
  return { command: process.execPath, args: [turbo, 'watch', 'dev:serve', '--filter=@cuberoot/client', '--concurrency=2', '--ui=stream', '--env-mode=loose'], cwd: workspace };
}
export async function main() {
  const { values } = parseArgs({ options: { url: { type: 'string' }, preview: { type: 'string' }, reuse: { type: 'boolean' } } });
  if (values.preview) {
    const runner = spawn(process.execPath, [join(core, 'scripts/dev-preview/client.ts'), 'run', '--id', values.preview, '--open', ...(values.reuse ? [] : ['--restart'])], { stdio: 'inherit' });
    runner.on('error', error => { console.error(error.message); process.exitCode = 1; });
    runner.on('exit', code => { process.exitCode = code ?? 1; });
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(signal, () => {
      if (process.platform !== 'win32' || signal !== 'SIGINT') runner.kill(signal);
    });
    return;
  }
  const url = values.url ?? localUrl;
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw Error('Invalid preview URL');
  if (values.reuse && await listening()) {
    if (!await healthy(localUrl).catch(() => false)) throw Error('Port 3000 is in use or still starting. No process was stopped. Check the existing terminal.');
    if (url !== localUrl && !await healthy(url).catch(() => false)) throw Error(`Local CubeRoot is running, but the preview is unavailable: ${url}. Check the existing tunnel.`);
    console.log(`Reusing the running CubeRoot server: ${url}`); openBrowser(url); return;
  }
  await restartManaged(core);
  let ended = false;
  let child: ReturnType<typeof spawn> | undefined;
  let release: (() => void) | undefined;
  function stop() {
    ended = true;
    if (!child?.pid) { release?.(); return; }
    try {
      if (process.platform === 'win32') execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-child.pid, 'SIGTERM');
    } catch { /* Only the process tree started here is targeted. */ }
  }
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.once(signal, stop);
  release = await registerSession(core, stop);
  try {
    await clearPreviousDev(core, join(core, resolveWorkspacePath('@cuberoot/client', core)));
    if (ended) return;
    const command = prepareLocalDev(core);
    if (ended) return;
    if (await listening()) throw Error('Port 3000 became occupied during startup. Inspect the existing service before retrying.');
    child = spawn(command.command, command.args, {
      cwd: command.cwd, stdio: 'inherit', detached: process.platform !== 'win32',
    });
    child.once('error', error => { ended = true; release?.(); console.error(error.message); process.exitCode = 1; });
    child.once('exit', code => { ended = true; release?.(); process.exitCode = code ?? 0; });
    console.log(`Starting ${url} — keep this terminal open; Ctrl+C stops this server.`);
    for (let i = 0; i < 90 && !ended; i++) {
      if (await healthy(localUrl).catch(() => false) && (url === localUrl || await healthy(url).catch(() => false))) { if (!ended) openBrowser(url); return; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!ended) console.log(`Still waiting for the page. Check the startup output and open ${url} manually when ready.`);
  } catch (error) { stop(); release(); throw error; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
