// Local frontend only. Never run predev-clean or stop an existing port owner.
import { spawn, execFileSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { resolveWorkspacePath } from './resolve-workspace-path.mjs';

const core = resolve(import.meta.dirname, '..');
const client = join(core, resolveWorkspacePath('@cuberoot/client', core));
const url = 'http://127.0.0.1:3000/zh';
function listening(): Promise<boolean> {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port: 3000 });
    const finish = (value: boolean) => { socket.destroy(); resolve(value); };
    socket.once('connect', () => finish(true)); socket.once('error', () => finish(false));
    socket.setTimeout(2000, () => finish(true));
  });
}
function openBrowser() {
  const child = process.platform === 'darwin' ? spawn('open', [url], { stdio: 'ignore' })
    : spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { stdio: 'ignore' });
  child.on('error', () => console.log(`Open ${url} in your browser.`));
}
async function healthy() {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  return response.ok && (await response.text()).includes('CubeRoot');
}
async function main() {
  if (await listening()) {
    if (!await healthy().catch(() => false)) throw Error('Port 3000 is in use or still starting. No process was stopped. Check the existing terminal.');
    console.log(`Reusing the running CubeRoot server: ${url}`); openBrowser(); return;
  }
  const next = join(client, 'node_modules/next/dist/bin/next');
  const turbo = join(core, 'node_modules/turbo/bin/turbo');
  if (!existsSync(next) || !existsSync(turbo)) throw Error('Dependencies missing. Run pnpm install in core.');
  // Reuse the existing asset generators; do not duplicate their implementation.
  for (const args of [
    ['--import', 'tsx', 'packages/client/scripts/build-cube-history.ts'],
    ['scripts/copy-maplibre-assets.mts'],
    ['scripts/build-cubing-worker.mjs', 'packages/client/public/cubing-chunks'],
  ]) execFileSync(process.execPath, args, { cwd: core, stdio: 'inherit' });
  if (await listening()) throw Error('Port 3000 became occupied. Run cuberoot again to reuse it.');
  const child = spawn(process.execPath, [turbo, 'watch', 'dev:serve', '--filter=@cuberoot/client', '--concurrency=2', '--ui=stream', '--env-mode=loose'], {
    cwd: core, stdio: 'inherit', detached: process.platform !== 'win32',
  });
  let ended = false;
  function stop() {
    if (ended || !child.pid) return;
    try {
      if (process.platform === 'win32') execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-child.pid, 'SIGTERM');
    } catch { /* Only the process tree started here is targeted. */ }
  }
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, stop);
  child.once('error', error => { ended = true; console.error(error.message); process.exitCode = 1; });
  child.once('exit', code => { ended = true; process.exitCode = code ?? 0; });
  console.log(`Starting ${url} — keep this terminal open; Ctrl+C stops this server.`);
  for (let i = 0; i < 90 && !ended; i++) {
    if (await healthy().catch(() => false)) { if (!ended) openBrowser(); return; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ended) console.log(`Still waiting for the page. Check the startup output and open ${url} manually when ready.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
