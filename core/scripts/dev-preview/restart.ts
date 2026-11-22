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
type Process = { pid: number; parent: number; uid: number; started: string; command: string };
function processes(): Process[] {
  if (process.platform === 'win32') throw Error('This older service has no restart session. Stop its original terminal once, then run cuberoot again.');
  // macOS localizes lstart, including the number of fields in the date.
  const output = execFileSync('ps', ['-axww', '-o', 'uid=,pid=,ppid=,lstart=,command='], {
    encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' },
  });
  return output.trim().split('\n').flatMap(line => {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+\s+\S+\s+\d+\s+\S+\s+\d+)\s+(.+)$/);
    return m ? [{ uid: Number(m[1]), pid: Number(m[2]), parent: Number(m[3]), started: m[4], command: m[5] }] : [];
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
  const owned = rows.filter(row => selected.has(row.pid) && row.uid === process.getuid?.());
  console.log(`Stopping previous CubeRoot service (${root.pid})`);
  // Only signal processes whose identity still matches the observed tree.
  const sameProcess = (a: Process, b: Process) => a.pid === b.pid && a.uid === b.uid && a.started === b.started && a.command === b.command;
  const signal = (kind: NodeJS.Signals) => {
    const current = processes();
    for (const row of owned) if (current.some(p => sameProcess(p, row))) {
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
  if (!row || row.uid !== process.getuid?.() || !/(^|\/)node\s/.test(row.command) || !scripts.some(script => row.command.includes(`${script} run `)) || !new RegExp(`--id ${id}(?:\\s|$)`).test(row.command)) throw Error(`Runner PID ${pid} does not match this preview. No process was stopped.`);
  await stopTree(row, rows);
}

export async function stopOrphanedPreviewTunnel(args: string[]) {
  if (process.platform === 'win32') return;
  const rows = processes();
  const command = ['ssh', ...args].join(' ');
  for (const row of rows) {
    if (row.parent === 1 && row.uid === process.getuid?.() && row.command === command) await stopTree(row, rows);
  }
}

function listeningPids(): number[] {
  if (process.platform === 'win32') {
    const lines = execFileSync('netstat.exe', ['-ano', '-p', 'tcp'], { encoding: 'utf8' }).split('\n');
    return lines.flatMap(line => { const fields = line.trim().split(/\s+/); return fields[0] === 'TCP' && fields[1]?.endsWith(':3000') && fields[3] === 'LISTENING' ? [Number(fields[4])] : []; });
  }
  try { return execFileSync('lsof', ['-nP', '-t', '-iTCP:3000', '-sTCP:LISTEN'], { encoding: 'utf8' }).trim().split('\n').map(Number).filter(Boolean); }
  catch (error) { if ((error as { status?: number }).status !== 1) throw error; return []; }
}

const clientWatch = /^(?:(?:\S*\/)?node\s+)?(?:\S*\/)?turbo watch dev:serve\s+.*--filter(?:=|\s+)@cuberoot\/client(?:\s|$)/;
const defaultNextWatch = /^(?:\S*\/)?node\s+(?:\S*\/)?next-dev\.mts$/;

async function stopPreviousDev(workspace: string, client: string) {
  const pids = listeningPids();
  if (process.platform === 'win32' && !pids.length) return;
  const rows = processes();
  const byPid = new Map(rows.map(row => [row.pid, row]));
  const roots = new Map<number, Process>();
  const user = process.getuid?.();
  const directories = new Map<number, string | undefined>();
  const directory = (pid: number) => {
    if (!directories.has(pid)) directories.set(pid, cwd(pid));
    return directories.get(pid);
  };
  const checkoutWatch = (row: Process) => row.uid === user && (
    (clientWatch.test(row.command) && [workspace, client].includes(directory(row.pid) ?? '')) ||
    (defaultNextWatch.test(row.command) && directory(row.pid) === client)
  );
  const findRoot = (row: Process) => {
    let root: Process | undefined;
    for (let cursor: Process | undefined = row; cursor && cursor.pid > 1 && cursor.uid === user; cursor = byPid.get(cursor.parent)) {
      if (checkoutWatch(cursor) || (/next.*\bdev\b|scripts\/local-dev\.(?:mts|ts)/.test(cursor.command)
        && [workspace, client].includes(directory(cursor.pid) ?? ''))) root = cursor;
    }
    return root;
  };
  for (const pid of pids) {
    const listener = byPid.get(pid);
    if (!listener && !alive(pid)) continue;
    const isNext = listener && listener.uid === user && /next-server|next.*\bdev\b/.test(listener.command);
    const listenerDir = isNext ? directory(pid) : undefined;
    if (isNext && !listenerDir && !alive(pid)) continue;
    if (!listener || listenerDir !== client) {
      throw Error(`Port 3000 belongs to an unrecognized service (${pid}); no cache was cleared.`);
    }
    const root = findRoot(listener);
    if (!root) throw Error(`Cannot confirm that PID ${pid} is this checkout's development server.`);
    roots.set(root.pid, root);
  }
  // A watcher can be rebuilding while its Next child isn't listening yet.
  for (const row of rows) {
    if (!checkoutWatch(row)) continue;
    const root = findRoot(row) ?? row;
    roots.set(root.pid, root);
  }
  for (const root of roots.values()) await stopTree(root, rows);
}

export async function clearPreviousDev(workspace: string, client: string) {
  const workspaceDir = realpathSync(workspace), clientDir = realpathSync(client);
  await stopPreviousDev(workspaceDir, clientDir);
  const occupied = () => new Promise<boolean>(done => {
    const socket = createConnection({ host: '127.0.0.1', port: 3000 });
    const finish = (value: boolean) => { socket.destroy(); done(value); };
    socket.once('connect', () => finish(true)); socket.once('error', () => finish(false)); socket.setTimeout(1000, () => finish(true));
  });
  for (let i = 0; i < 10 && await occupied(); i++) {
    await stopPreviousDev(workspaceDir, clientDir);
    await pause(500);
  }
  if (await occupied()) throw Error('Port 3000 is still occupied. Cache was not cleared.');
  // Honor the same custom directory as next.config; never delete outside the client workspace.
  const cache = resolve(client, process.env.NEXT_DEV_DIST_DIR || '.next');
  if (!cache.startsWith(resolve(client) + '/') && process.platform !== 'win32') throw Error('Development cache must be inside the client workspace.');
  if (process.platform === 'win32' && !cache.startsWith(resolve(client) + '\\')) throw Error('Development cache must be inside the client workspace.');
  rmSync(cache, { recursive: true, force: true });
  console.log('Cleared Next development cache; starting a fresh service.');
}
