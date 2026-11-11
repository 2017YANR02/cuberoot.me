// Authenticated local control for restart, plus a conservative legacy Mac/Unix migration.
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, realpathSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createConnection } from 'node:net';

const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
const stateFile = (workspace: string) => join(homedir(), '.cuberoot/dev-runtime', createHash('sha256').update(realpathSync(workspace)).digest('hex').slice(0, 20) + '.json');
export function alive(pid: number) {
  try { process.kill(pid, 0); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; }
}
export async function restartManaged(workspace: string) {
  const file = stateFile(workspace);
  if (!existsSync(file)) return;
  const original = readFileSync(file, 'utf8');
  const record = JSON.parse(original) as { pid: number; port: number; token: string };
  if (!Number.isSafeInteger(record.pid) || record.pid < 1 || !Number.isInteger(record.port) || record.port < 1 || record.port > 65535 || !/^[a-f0-9]{64}$/.test(record.token)) throw Error('Invalid development session; inspect its state before restarting.');
  if (alive(record.pid)) {
    try {
      const response = await fetch(`http://127.0.0.1:${record.port}/stop`, { method: 'POST', headers: { Authorization: `Bearer ${record.token}` }, signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw Error('Session did not acknowledge restart');
    } catch { throw Error(`Cannot verify the existing development session (${record.pid}). Stop its original terminal, then run cuberoot again.`); }
    for (let i = 0; i < 100 && alive(record.pid); i++) await pause(100);
    if (alive(record.pid)) throw Error('Previous development session has not exited. Cache was not cleared.');
  }
  if (existsSync(file) && readFileSync(file, 'utf8') === original) unlinkSync(file);
}
export async function registerSession(workspace: string, stop: () => void) {
  const file = stateFile(workspace), token = randomBytes(32).toString('hex');
  mkdirSync(join(homedir(), '.cuberoot/dev-runtime'), { recursive: true, mode: 0o700 });
  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/stop' || request.headers.authorization !== `Bearer ${token}`) { response.writeHead(403).end(); return; }
    response.on('finish', stop); response.end('Stopping');
  });
  await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const record = JSON.stringify({ pid: process.pid, port: (server.address() as { port: number }).port, token });
  try { writeFileSync(file, record, { flag: 'wx', mode: 0o600 }); } catch (error) { server.close(); throw error; }
  const release = () => { server.close(); if (existsSync(file) && readFileSync(file, 'utf8') === record) unlinkSync(file); };
  process.once('exit', release); server.unref();
  return release;
}
type Process = { pid: number; parent: number; command: string };
function processes(): Process[] {
  if (process.platform === 'win32') throw Error('This older service has no restart session. Stop its original terminal once, then run cuberoot again.');
  return execFileSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8' }).trim().split('\n').flatMap(line => {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/); return m ? [{ pid: Number(m[1]), parent: Number(m[2]), command: m[3] }] : [];
  });
}
function cwd(pid: number) {
  try {
    if (process.platform === 'linux') return realpathSync(`/proc/${pid}/cwd`);
    return execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' }).split('\n').find(s => s.startsWith('n'))?.slice(1);
  } catch { return undefined; }
}
async function stopTree(root: Process, rows: Process[]) {
  const selected = new Set([root.pid]);
  for (let changed = true; changed;) { changed = false; for (const row of rows) if (selected.has(row.parent) && !selected.has(row.pid)) { selected.add(row.pid); changed = true; } }
  if (selected.has(process.pid)) throw Error('Refusing to stop the current launcher.');
  const owned = rows.filter(row => selected.has(row.pid));
  console.log(`Stopping previous CubeRoot service (${root.pid})`);
  // Only signal processes whose identity still matches the observed tree.
  const signal = (kind: NodeJS.Signals) => {
    const current = processes();
    for (const row of owned) if (current.some(p => p.pid === row.pid && p.command === row.command)) {
      try { process.kill(row.pid, kind); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
    }
  };
  signal('SIGTERM');
  for (let i = 0; i < 30 && owned.some(p => alive(p.pid)); i++) await pause(100);
  if (owned.some(p => alive(p.pid))) signal('SIGKILL');
  await pause(200);
}
export async function stopLegacyRunner(pid: number, scripts: string[], id: string) {
  const rows = processes(), row = rows.find(p => p.pid === pid);
  if (!row || !/(^|\/)node\s/.test(row.command) || !scripts.some(script => row.command.includes(`${script} run `)) || !new RegExp(`--id ${id}(?:\\s|$)`).test(row.command)) throw Error(`Runner PID ${pid} does not match this preview. No process was stopped.`);
  await stopTree(row, rows);
}
export async function clearPreviousDev(workspace: string, client: string) {
  // Managed sessions are already stopped. Detect only older listeners belonging to this checkout.
  let pids: number[];
  if (process.platform === 'win32') {
    const lines = execFileSync('netstat.exe', ['-ano', '-p', 'tcp'], { encoding: 'utf8' }).split('\n');
    pids = lines.flatMap(line => { const fields = line.trim().split(/\s+/); return fields[0] === 'TCP' && fields[1]?.endsWith(':3000') && fields[3] === 'LISTENING' ? [Number(fields[4])] : []; });
  } else {
    try { pids = execFileSync('lsof', ['-t', '-iTCP:3000', '-sTCP:LISTEN'], { encoding: 'utf8' }).trim().split('\n').map(Number).filter(Boolean); }
    catch (error) { if ((error as { status?: number }).status !== 1) throw error; pids = []; }
  }
  if (pids.length) {
    const rows = processes(), roots = new Map<number, Process>();
    for (const pid of pids) {
      const listener = rows.find(p => p.pid === pid);
      if (!listener || cwd(pid) !== realpathSync(client) || !/next-server|next.*\bdev\b/.test(listener.command)) throw Error(`Port 3000 belongs to an unrecognized service (${pid}); no cache was cleared.`);
      let root = listener, cursor: Process | undefined = listener, development = false;
      while (cursor && cursor.pid > 1) {
        if (/next.*\bdev\b|turbo.*watch.*dev:serve|scripts\/local-dev\.(?:mts|ts)/.test(cursor.command)) {
          const directory = cwd(cursor.pid);
          if (directory === realpathSync(client) || directory === realpathSync(workspace)) { root = cursor; development = true; }
        }
        cursor = rows.find(p => p.pid === cursor!.parent);
      }
      if (!development) throw Error(`Cannot confirm that PID ${pid} is this checkout's development server.`);
      roots.set(root.pid, root);
    }
    for (const root of roots.values()) await stopTree(root, rows);
  }
  const occupied = () => new Promise<boolean>(done => {
    const socket = createConnection({ host: '127.0.0.1', port: 3000 });
    const finish = (value: boolean) => { socket.destroy(); done(value); };
    socket.once('connect', () => finish(true)); socket.once('error', () => finish(false)); socket.setTimeout(1000, () => finish(true));
  });
  for (let i = 0; i < 50 && await occupied(); i++) await pause(100);
  if (await occupied()) throw Error('Port 3000 is still occupied. Cache was not cleared.');
  // Honor the same custom directory as next.config; never delete outside the client workspace.
  const cache = resolve(client, process.env.NEXT_DEV_DIST_DIR || '.next');
  if (!cache.startsWith(resolve(client) + '/') && process.platform !== 'win32') throw Error('Development cache must be inside the client workspace.');
  if (process.platform === 'win32' && !cache.startsWith(resolve(client) + '\\')) throw Error('Development cache must be inside the client workspace.');
  rmSync(cache, { recursive: true, force: true });
  console.log('Cleared Next development cache; starting a fresh service.');
}
