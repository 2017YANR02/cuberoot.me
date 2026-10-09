import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync, copyFileSync, openSync, closeSync, unlinkSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { parseArgs } from 'node:util';
import { createConnection } from 'node:net';
import { publicKey, slug } from './model.ts';
import { launchAgentXml, taskXml } from './autostart.ts';

interface Profile { version: number; id: string; host: string; sshPort: number; sshUser: string; localPort: number; remotePort: number; url: string; hostKey: string; publicKey: string; repo: string }
const { values: v, positionals } = parseArgs({ allowPositionals: true, options: {
  id: { type: 'string' }, profile: { type: 'string' }, repo: { type: 'string' }, state: { type: 'string' },
} });
const command = positionals[0] ?? 'help';
const id = v.id ? slug(v.id, 59) : '';
const dir = resolve(v.state ?? join(homedir(), '.cuberoot', 'dev-preview', id));
const keyPath = join(dir, 'id_ed25519'), profilePath = join(dir, 'profile.json'), knownHosts = join(dir, 'known_hosts');
const logPath = join(dir, 'service.log');
const log = (s: string) => { const line = `${new Date().toISOString()} ${s}\n`; process.stdout.write(line); appendFileSync(logPath, line); };

function profile(): Profile {
  const p: Profile = JSON.parse(readFileSync(profilePath, 'utf8')); validateProfile(p); return p;
}
function validateProfile(p: Profile) {
  if (p.version !== 1 || p.id !== id || p.host !== '47.97.30.181' || p.sshPort !== 22
    || !/^crdev-[a-f0-9]{12}$/.test(p.sshUser) || p.localPort !== 3000
    || !Number.isInteger(p.remotePort) || p.remotePort < 7105 || p.remotePort > 7199
    || p.url !== `https://dev-${id}.cuberoot.me/zh`) throw Error('Invalid connection profile');
  publicKey(p.hostKey); publicKey(p.publicKey);
  if (p.publicKey !== publicKey(readFileSync(keyPath + '.pub', 'utf8'))) throw Error('Profile does not match this device key');
}
function secure(path: string, directory = false) {
  if (process.platform !== 'win32') { chmodSync(path, directory ? 0o700 : 0o600); return; }
  const user = execFileSync('whoami.exe', [], { encoding: 'utf8' }).trim();
  // Replace inherited ACLs; do not grant other users permission to read private keys.
  execFileSync('icacls.exe', [path, '/inheritance:r', '/grant:r', `${user}:${directory ? '(OI)(CI)F' : 'F'}`], { stdio: 'pipe' });
}
const sshArgs = (p: Profile) => ['-F', process.platform === 'win32' ? 'NUL' : '/dev/null', '-NT', '-i', keyPath,
  '-p', String(p.sshPort), '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes',
  '-o', `UserKnownHostsFile=${knownHosts}`, '-o', 'ExitOnForwardFailure=yes', '-o', 'ConnectTimeout=10',
  '-o', 'ServerAliveInterval=20', '-o', 'ServerAliveCountMax=3', '-R', `127.0.0.1:${p.remotePort}:127.0.0.1:${p.localPort}`, `${p.sshUser}@${p.host}`];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function listening(port: number) {
  return new Promise<boolean>(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(2000); socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false)); socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
}
async function localCheck(p: Profile) {
  const r = await fetch(`http://127.0.0.1:${p.localPort}/zh`, { signal: AbortSignal.timeout(45_000) });
  if (r.status !== 200 || !(await r.text()).includes('CubeRoot')) throw Error('Port 3000 is not serving a healthy CubeRoot page; existing service was not touched');
}
function child(command: string, args: string[], cwd?: string) {
  const fd = openSync(logPath, 'a', 0o600);
  const p = spawn(command, args, { cwd, stdio: ['ignore', fd, fd], windowsHide: true, detached: process.platform !== 'win32' });
  closeSync(fd); return p;
}
function stopChild(p?: ChildProcess) {
  if (!p?.pid || p.exitCode !== null) return;
  try {
    if (process.platform === 'win32') execFileSync('taskkill.exe', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-p.pid, 'SIGTERM');
  } catch { /* Already exited. Only children created by this runner are targeted. */ }
}
async function run() {
  const p = profile(), lock = join(dir, 'runner.pid');
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, 'utf8'));
    if (!Number.isInteger(pid) || pid < 1) throw Error('Invalid runner lock; inspect it');
    let alive = false; try { process.kill(pid, 0); alive = true; } catch { /* stale */ }
    if (alive) throw Error(`Runner already active or PID reused (${pid}); inspect before restarting`);
    unlinkSync(lock);
  }
  writeFileSync(lock, String(process.pid), { flag: 'wx', mode: 0o600 });
  let dev: ChildProcess | undefined, tunnel: ChildProcess | undefined, stopped = false;
  const cleanup = () => { stopped = true; stopChild(tunnel); stopChild(dev); if (existsSync(lock)) unlinkSync(lock); };
  process.once('SIGTERM', () => { cleanup(); process.exit(0); });
  process.once('SIGINT', () => { cleanup(); process.exit(0); });
  try {
    if (!(await listening(p.localPort))) {
      const core = join(p.repo, 'core'), client = join(core, 'packages', 'client');
      const next = join(client, 'node_modules', 'next', 'dist', 'bin', 'next');
      if (!existsSync(next)) throw Error('Dependencies missing: run pnpm install in core first');
      execFileSync(process.execPath, [join(core, 'scripts', 'build-cubing-worker.mjs'), 'packages/client/public/cubing-chunks'], { cwd: core, stdio: 'pipe', timeout: 120_000 });
      // Bypass predev-clean: this runner must never kill an existing port owner.
      dev = child(process.execPath, [next, 'dev', '-H', '127.0.0.1', '-p', String(p.localPort)], client);
      dev.on('error', e => log(`Next failed: ${e.message}`));
      for (let i = 0; i < 90 && !(await listening(p.localPort)); i++) {
        if (dev.exitCode !== null) throw Error('Next exited; inspect service.log');
        await delay(1000);
      }
      dev.once('exit', () => { if (!stopped) { log('Managed Next exited; stopping tunnel'); cleanup(); process.exit(1); } });
    }
    await localCheck(p); log(`Local service ready. Connecting ${p.url}`);
    while (!stopped) {
      tunnel = child('ssh', sshArgs(p));
      const code = await new Promise<number | null>(resolve => {
        tunnel!.once('error', e => { log(`SSH error: ${e.message}`); resolve(1); });
        tunnel!.once('exit', resolve);
      });
      if (!stopped) { log(`SSH exited (${code}); retrying in 10 seconds`); await delay(10_000); }
    }
  } finally { cleanup(); }
}
function install() {
  const p = profile();
  for (const f of ['client.ts', 'model.ts', 'autostart.ts']) {
    const source = join(dirname(fileURLToPath(import.meta.url)), f), dest = join(dir, f);
    if (resolve(source) !== resolve(dest)) copyFileSync(source, dest);
  }
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}\n');
  const args = [join(dir, 'client.ts'), 'run', '--id', id, '--state', dir];
  if (process.platform === 'darwin') {
    const label = `me.cuberoot.dev.${id}`, dest = join(homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
    const data = launchAgentXml(label, process.execPath, args, process.env.PATH ?? '/usr/bin:/bin', dir);
    mkdirSync(dirname(dest), { recursive: true });
    if (existsSync(dest) && readFileSync(dest, 'utf8') !== data) throw Error('Existing LaunchAgent differs; stop it and review before replacing');
    writeFileSync(dest, data); execFileSync('plutil', ['-lint', dest]);
    const target = `gui/${process.getuid!()}`;
    let loaded = false; try { execFileSync('launchctl', ['print', `${target}/${label}`], { stdio: 'pipe' }); loaded = true; } catch { /* not installed */ }
    if (!loaded) execFileSync('launchctl', ['bootstrap', target, dest]);
    console.log(`Installed ${label}. Logs: ${dir}`);
  } else if (process.platform === 'win32') {
    const task = `CubeRootDev-${id}`, user = execFileSync('whoami.exe', [], { encoding: 'utf8' }).trim();
    const file = join(dir, 'task.xml');
    // XML avoids cmd/PowerShell quoting and stores no password. Task runs only as this logged-in user.
    const data = taskXml(process.execPath, args, user, p.repo);
    writeFileSync(file, '\ufeff' + data, 'utf16le');
    execFileSync('schtasks.exe', ['/Create', '/TN', task, '/XML', file, '/F'], { stdio: 'inherit' });
    execFileSync('schtasks.exe', ['/Run', '/TN', task], { stdio: 'inherit' });
    console.log(`Installed ${task}. Logs: ${dir}`);
  } else throw Error('Autostart supports macOS and Windows; use run elsewhere');
}
async function main() {
  if (command === 'help') { console.log('Node 24+ required. client.ts init --id OWNER-DEVICE | configure --id ID --profile CONNECTION.json --repo REPO | run --id ID | install --id ID | check --id ID'); return; }
  if (!id || id.length > 59 || Number(process.versions.node.split('.')[0]) < 24) throw Error('Node 24+ and --id OWNER-DEVICE required');
  mkdirSync(dir, { recursive: true, mode: 0o700 }); secure(dir, true);
  if (command === 'init') {
    if (!existsSync(keyPath)) execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', keyPath, '-C', `cuberoot-dev-${id}`]);
    secure(keyPath);
    const request = { version: 1, id, publicKey: publicKey(readFileSync(keyPath + '.pub', 'utf8')) };
    const path = join(dir, 'request.json'); writeFileSync(path, JSON.stringify(request, null, 2) + '\n', { mode: 0o600 });
    console.log(`Send only this public request to the administrator: ${path}`); return;
  }
  if (command === 'configure') {
    if (!v.profile || !v.repo) throw Error('--profile and --repo required');
    const p: Profile = { ...JSON.parse(readFileSync(resolve(v.profile), 'utf8')), repo: resolve(v.repo) };
    validateProfile(p);
    const pkg = JSON.parse(readFileSync(join(p.repo, 'core', 'packages', 'client', 'package.json'), 'utf8'));
    if (pkg.name !== '@cuberoot/client') throw Error('Wrong repository');
    writeFileSync(knownHosts, `${p.host} ${publicKey(p.hostKey)}\n`, { mode: 0o600 });
    writeFileSync(profilePath, JSON.stringify(p, null, 2) + '\n', { mode: 0o600 });
    secure(profilePath); secure(knownHosts); console.log(`Configured ${p.url}. Next: run or install`); return;
  }
  if (command === 'run') { await run(); return; }
  if (command === 'install') { install(); return; }
  if (command === 'check') {
    const p = profile(); await localCheck(p);
    const response = await fetch(p.url, { signal: AbortSignal.timeout(45_000) });
    if (response.status !== 200 || !(await response.text()).includes('CubeRoot')) throw Error('Public preview failed');
    console.log(`Local and HTTPS preview passed: ${p.url}`); return;
  }
  throw Error(`Unknown command: ${command}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
