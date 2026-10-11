/** Run as the Mac account being authorized, never as root. No inbound HTTP listener. */
import { readFile, writeFile, rename, mkdir, unlink, lstat, copyFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { normalizeRemoteKey, REMOTE_CONNECTION } from '@cuberoot/shared/remote-access';

const begin = '# BEGIN CUBEROOT REMOTE ACCESS';
const end = '# END CUBEROOT REMOTE ACCESS';
type Key = { id: string; public_key: string };

export function reconcileKeys(current: string, keys: Key[]): string {
  if (!Array.isArray(keys) || keys.length > 200) throw Error('Invalid key snapshot');
  const ids = new Set<string>(), publicKeys = new Set<string>();
  const lines = keys.map(k => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(k.id) || ids.has(k.id)) throw Error('Invalid request id');
    ids.add(k.id);
    const key = normalizeRemoteKey(k.public_key);
    if (publicKeys.has(key)) throw Error('Duplicate key');
    publicKeys.add(key);
    return `${key} cuberoot-request-${k.id}`;
  });
  const starts = current.split(begin).length - 1, ends = current.split(end).length - 1;
  if (starts !== ends || starts > 1) throw Error('Ambiguous managed block; refusing to edit');
  const a = current.indexOf(begin), b = current.indexOf(end);
  if (starts && (b < a || (a > 0 && current[a - 1] !== '\n') || (current[b + end.length] && current[b + end.length] !== '\n'))) throw Error('Malformed managed block');
  const suffixStart = b + end.length + (current[b + end.length] === '\n' ? 1 : 0);
  const outside = starts ? current.slice(0, a) + current.slice(suffixStart) : current;
  for (const line of outside.split('\n')) {
    if (line.trim().startsWith('#')) continue;
    for (const key of publicKeys) if (line.split(/\s+/).includes(key.split(' ')[1])) throw Error('Key already authorized outside managed block');
  }
  const block = `${begin}\n${lines.join('\n')}${lines.length ? '\n' : ''}${end}\n`;
  return starts ? current.slice(0, a) + block + current.slice(suffixStart) : current + (current && !current.endsWith('\n') ? '\n' : '') + block;
}

export async function syncHost(configPath = join(homedir(), '.config/cuberoot-remote/host.json')) {
  if (process.platform !== 'darwin' || homedir() !== '/Users/eula') throw Error('This agent is for the registered Mac host only');
  const configStat = await lstat(configPath);
  if (!configStat.isFile() || configStat.isSymbolicLink() || (configStat.mode & 0o077)) throw Error('Host config must be an owner-only regular file');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  if (typeof config.token !== 'string' || config.token.length < 32) throw Error('Missing host token');
  if (config.api !== 'https://api.cuberoot.me') throw Error('Unexpected API origin');
  const fingerprint = execFileSync('ssh-keygen', ['-lf', '/etc/ssh/ssh_host_ed25519_key.pub'], { encoding: 'utf8' }).split(/\s+/)[1];
  if (fingerprint !== REMOTE_CONNECTION.fingerprint) throw Error('Wrong SSH host');
  const folder = join(homedir(), '.ssh');
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const lock = join(folder, '.cuberoot-remote.lock');
  await writeFile(lock, String(process.pid), { flag: 'wx', mode: 0o600 });
  const headers = { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' };
  const api = async (path: string, init: RequestInit = {}) => {
    const r = await fetch(config.api + '/v1/remote-access/host/' + path, { ...init, headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw Error(`Host sync HTTP ${r.status}`);
    return r.json();
  };
  try {
    const snapshot = await api('keys');
    if (!/^[a-f0-9]{64}$/.test(snapshot.revision)) throw Error('Invalid revision');
    const path = join(folder, 'authorized_keys');
    const stat = await lstat(path).catch((e: NodeJS.ErrnoException) => { if (e.code !== 'ENOENT') throw e; return null; });
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw Error('Unexpected authorized_keys type');
    const previous = stat ? await readFile(path, 'utf8') : '';
    const next = reconcileKeys(previous, snapshot.keys);
    if (next !== previous) {
      if (stat) await copyFile(path, `${path}.backup-${Date.now()}`);
      const temp = `${path}.cuberoot-${process.pid}`;
      await writeFile(temp, next, { flag: 'wx', mode: 0o600 });
      try {
        if (stat && await readFile(path, 'utf8') !== previous) throw Error('authorized_keys changed during sync');
        await rename(temp, path);
      } catch (e) { await unlink(temp).catch(() => {}); throw e; }
    }
    // Verify the exact bytes before acknowledging activation or revocation.
    if (await readFile(path, 'utf8') !== next) throw Error('Key write did not persist');
    await api('applied', { method: 'POST', body: JSON.stringify({ revision: snapshot.revision }) });
    console.log('Remote access approvals synchronized.');
  } finally { await unlink(lock); }
}

async function install() {
  if (process.platform !== 'darwin' || homedir() !== '/Users/eula') throw Error('Install on the registered Mac only');
  const folder = join(homedir(), '.config/cuberoot-remote');
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const path = join(folder, 'host.json');
  const token = process.env.REMOTE_ACCESS_HOST_TOKEN;
  if (!token || token.length < 32) throw Error('Provide the API’s dedicated REMOTE_ACCESS_HOST_TOKEN in the environment');
  // Never silently rotate an existing credential.
  try { await writeFile(path, JSON.stringify({ api: 'https://api.cuberoot.me', token }), { flag: 'wx', mode: 0o600 }); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    if (JSON.parse(await readFile(path, 'utf8')).token !== token) throw Error('Existing host token differs; refusing to overwrite');
  }
  // Verify the API, target fingerprint and write permissions before registering startup.
  await syncHost(path);
  const plistFolder = join(homedir(), 'Library/LaunchAgents');
  await mkdir(plistFolder, { recursive: true });
  const plist = join(plistFolder, 'me.cuberoot.remote-access.plist');
  const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const log = join(folder, 'sync.log');
  await writeFile(log, '', { flag: 'a', mode: 0o600 });
  const script = fileURLToPath(import.meta.url);
  await writeFile(plist, `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
<key>Label</key><string>me.cuberoot.remote-access</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(script)}</string></array>
<key>RunAtLoad</key><true/><key>StartInterval</key><integer>30</integer>
<key>StandardOutPath</key><string>${xml(log)}</string><key>StandardErrorPath</key><string>${xml(log)}</string>
</dict></plist>`, { mode: 0o600 });
  const domain = `gui/${process.getuid!()}`;
  try { execFileSync('launchctl', ['bootout', `${domain}/me.cuberoot.remote-access`], { stdio: 'ignore' }); } catch { /* First installation. */ }
  execFileSync('launchctl', ['bootstrap', domain, plist]);
  console.log('Login startup registered; reboot not tested.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (process.argv.includes('--install') ? install() : syncHost()).catch(e => { console.error(e instanceof Error ? e.message : 'Host sync failed'); process.exitCode = 1; });
}
