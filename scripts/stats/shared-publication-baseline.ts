import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { basename, dirname, join, posix } from 'node:path';
import { createInterface } from 'node:readline';
import { managed, owns, validate } from '../wca-data/snapshot.ts';
import { exists, repoRoot, run, wcaDir } from './common.js';
import { parseManifest } from './publish-static.js';

const host = process.env.CUBEROOT_STATIC_HOST ?? 'root@cuberoot';
const sshArgs = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3'];
const remoteRoot = '/root/.local/state/cuberoot/scramble-publish-baselines';
const remotePg = '/root/.local/state/cuberoot/scramble-pg';
const incremental = join(wcaDir, 'incremental');
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const pgManifests = {
  mirror: null, steps: 'pg_wss_manifest.tsv',
  'optimal-333': 'pg_optimal_333_manifest.tsv', 'optimal-puzzle': 'pg_optimal_puzzle_manifest.tsv',
} as const;
type PgGroup = keyof typeof pgManifests;
export type BaselineGroup = PgGroup | 'release' | 'static';
type Receipt = { token: string; manifestFingerprint?: string };
type Checkpoint = { version: string; exportDate: string; archiveHash: string; hashes: string[] };
const isPg = (group: BaselineGroup): group is PgGroup => Object.hasOwn(pgManifests, group);
const isHash = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const isDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

function localFiles(group: BaselineGroup): string[] {
  if (group === 'release') return [join(repoRoot, 'stats/.stats-release-base.json')];
  if (group === 'static') return [join(incremental, 'publish_manifest.sha1')];
  const manifest = pgManifests[group];
  return [join(incremental, `pg_publication_${group}.json`), ...(manifest ? [join(incremental, manifest)] : [])];
}

async function hashFile(path: string, algorithm = 'sha256'): Promise<string> {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function fileHashes(paths: string[]): Promise<string[]> {
  return Promise.all(paths.map(path => hashFile(path)));
}

function sameHashes(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((hash, index) => hash === right[index]);
}

async function localArtifactHash(path: string, algorithm: string): Promise<string | undefined> {
  try {
    if (!(await lstat(path)).isFile()) throw Error(`Expected a regular statistics artifact: ${path}`);
    return await hashFile(path, algorithm);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

async function capture(command: string): Promise<string> {
  const child = spawn('ssh', [...sshArgs, host, command], { stdio: ['ignore', 'pipe', 'inherit'] });
  const closed = once(child, 'close');
  let result = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { result += chunk; });
  const [code] = await closed;
  if (code !== 0) throw Error('Could not read shared statistics publication state');
  return result;
}

/** One daily publisher across both Macs. The server releases the lock if heartbeats stop. */
export async function withSharedPublicationLock<T>(work: (assertHeld: () => void) => Promise<T>): Promise<T> {
  const lease = 'printf "ready\\n"; while IFS= read -r -t 90; do :; done';
  const child = spawn('ssh', [...sshArgs, '-T', host, `flock -n /tmp/cuberoot-scramble-publication.lock bash -c ${quote(lease)}`],
    { stdio: ['pipe', 'pipe', 'inherit'] });
  const closed = once(child, 'close');
  const lines = createInterface({ input: child.stdout });
  let alive = true;
  child.on('close', () => { alive = false; });
  child.stdin.on('error', () => { alive = false; });
  const assertHeld = () => { if (!alive) throw Error('Shared statistics publication lock disconnected; keep local results and retry publication after checking its baseline'); };
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    const first = await Promise.race([once(lines, 'line').then(([line]) => line), closed.then(() => null)]);
    if (first !== 'ready') throw Error('Could not acquire the shared statistics publication lock. Check SSH or an active run on the other machine.');
    const ping = () => { if (alive) child.stdin.write('keepalive\n'); };
    ping(); heartbeat = setInterval(ping, 15_000);
    const result = await work(assertHeld);
    assertHeld();
    return result;
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    child.stdin.end();
    lines.close();
    await closed;
  }
}

async function checkpoint(group: BaselineGroup): Promise<Checkpoint | undefined> {
  const path = `${remoteRoot}/${group}.json`;
  const raw = await capture(`if test -f ${quote(path)}; then cat ${quote(path)}; fi`);
  if (!raw.trim()) return;
  const value = JSON.parse(raw) as Checkpoint;
  if (!isHash(value.version) || !isHash(value.archiveHash) || !isDate(value.exportDate) ||
      !Array.isArray(value.hashes) || value.hashes.length !== localFiles(group).length || !value.hashes.every(isHash) ||
      value.version !== digest(JSON.stringify([value.exportDate, value.hashes]))) throw Error(`Invalid shared statistics baseline for ${group}`);
  return value;
}

async function pgToken(group: PgGroup): Promise<string | undefined> {
  const receipt = `${remotePg}/${group}`;
  const pending = `${receipt}.pending.json`, current = `${receipt}.json`;
  const raw = await capture(`if test -f ${quote(pending)}; then exit 3; fi; if test -f ${quote(current)}; then cat ${quote(current)}; fi`);
  if (!raw.trim()) return;
  const { token } = JSON.parse(raw) as { token: string | null };
  if (token === null) return;
  if (!isHash(token)) throw Error(`Invalid live PG token for ${group}`);
  return token;
}

async function matchesPg(paths: string[], token: string): Promise<boolean> {
  if (!(await Promise.all(paths.map(exists))).every(Boolean)) return false;
  const receipt = JSON.parse(await readFile(paths[0], 'utf8')) as Receipt;
  if (receipt.token !== token) return false;
  return paths.length === 1 ? receipt.manifestFingerprint === undefined :
    receipt.manifestFingerprint === digest(JSON.stringify(['', [await hashFile(paths[1])]]));
}

async function scratch(): Promise<string> {
  const directory = join(repoRoot, '.tmp/cache');
  await mkdir(directory, { recursive: true });
  return mkdtemp(join(directory, 'scramble-baseline-'));
}

type ArtifactChange = { path: string; before?: string; after?: string };
export function baselineArtifactChanges(before: Map<string, string>, after: Map<string, string>): ArtifactChange[] {
  return [...new Set([...before.keys(), ...after.keys()])].filter(path => before.get(path) !== after.get(path))
    .map(path => ({ path, before: before.get(path), after: after.get(path) }));
}

export function baselineArtifactAction(change: ArtifactChange, local?: string): 'keep' | 'fetch' | 'archive' {
  if (local === change.after) return 'keep';
  if (local !== undefined && local !== change.before) throw Error(`Local statistics artifact has unpublished changes: ${change.path}`);
  return change.after === undefined ? 'archive' : 'fetch';
}

async function artifactHashes(group: 'release' | 'static', file: string): Promise<Map<string, string>> {
  if (!await exists(file)) return new Map();
  const content = await readFile(file, 'utf8');
  if (group === 'release') return new Map(validate(JSON.parse(content)).files.filter(item => owns('scramble', item.path)).map(item => [item.path, item.sha256]));
  return new Map([...parseManifest(content)].map(([path, hash]): [string, string] => [path.slice(2), hash])
    .filter(([path]) => !path.startsWith('exact-puzzles/') && !managed(`scramble/${path}`)));
}

/** Changing the baseline alone would turn older files into apparent updates. */
async function refreshArtifacts(group: 'release' | 'static', previous: string, shared: string, directory: string, assertHeld: () => void): Promise<void> {
  const [before, after] = await Promise.all([artifactHashes(group, previous), artifactHashes(group, shared)]);
  const changes = baselineArtifactChanges(before, after);
  if (!changes.length) return;
  const localRoot = join(repoRoot, group === 'release' ? 'stats' : 'stats/scramble');
  const remote = group === 'release' ? '/www/wwwroot/toolkit/stats/.stats-data/current/data' :
    posix.join(process.env.CUBEROOT_STATIC_STATS_DIR ?? '/www/wwwroot/toolkit/stats', 'scramble');
  const algorithm = group === 'release' ? 'sha256' : 'sha1';
  const staged = join(directory, 'artifacts');
  const plan = [];
  for (let offset = 0; offset < changes.length; offset += 48) {
    const batch = await Promise.all(changes.slice(offset, offset + 48).map(async change => {
      const path = join(localRoot, change.path);
      const local = await localArtifactHash(path, algorithm);
      return { ...change, local, action: baselineArtifactAction(change, local) };
    }));
    plan.push(...batch.filter(entry => entry.action !== 'keep'));
  }
  const fetch = plan.filter(entry => entry.action === 'fetch');
  if (fetch.length) {
    const list = join(directory, 'artifacts.txt');
    await writeFile(list, `${fetch.map(entry => entry.path).join('\n')}\n`);
    await mkdir(staged);
    await run('rsync', ['-rt', '--timeout=90', `--files-from=${list}`, '-e', `ssh ${sshArgs.join(' ')}`, `${host}:${remote}/`, `${staged}/`], repoRoot);
    for (const entry of fetch) {
      const path = join(staged, entry.path);
      if (!(await lstat(path)).isFile() || await hashFile(path, algorithm) !== entry.after)
        throw Error(`Online artifact changed during shared baseline refresh: ${entry.path}`);
    }
  }
  const archive = join(repoRoot, '.local-data', 'scramble-published-artifact-archive', randomUUID());
  for (const entry of plan) {
    assertHeld();
    const target = join(localRoot, entry.path);
    const local = await localArtifactHash(target, algorithm);
    if (local !== entry.local) throw Error(`Local statistics artifact changed during baseline refresh: ${entry.path}`);
    if (entry.action === 'archive') {
      const backup = join(archive, entry.path);
      await mkdir(dirname(backup), { recursive: true });
      await rename(target, backup);
    } else {
      await mkdir(dirname(target), { recursive: true });
      await rename(join(staged, entry.path), target);
    }
  }
  console.log(`[基线] ${group} 已同步 ${fetch.length} 份线上产物，归档 ${plan.length - fetch.length} 份旧产物`);
}

async function install(group: BaselineGroup, source: string[], targets: string[]): Promise<void> {
  for (const [index, target] of targets.entries()) {
    await mkdir(dirname(target), { recursive: true });
    const temp = `${target}.${randomUUID()}.next`;
    try {
      if (group === 'release' && await exists(target)) {
        const prior = validate(JSON.parse(await readFile(target, 'utf8')));
        const shared = validate(JSON.parse(await readFile(source[index], 'utf8')));
        const files = [...prior.files.filter(f => !owns('scramble', f.path)), ...shared.files.filter(f => owns('scramble', f.path))];
        await writeFile(temp, JSON.stringify({ ...shared, files }));
      } else {
        await copyFile(source[index], temp);
      }
      await rename(temp, target);
    } finally { await rm(temp, { force: true }); }
  }
}

export async function restoreSharedBaseline(group: BaselineGroup, assertHeld: () => void): Promise<void> {
  const files = localFiles(group);
  const token = isPg(group) ? await pgToken(group) : undefined;
  if (token && await matchesPg(files, token)) return;
  const saved = await checkpoint(group);
  if (!saved) {
    if (token) throw Error(`Shared PG baseline for ${group} is unavailable; finish the previous publication on its original machine to save it.`);
    return;
  }
  if (isPg(group) && !token) throw Error(`Shared ${group} baseline has no corresponding live PG receipt`);
  if (!isPg(group) && (await Promise.all(files.map(exists))).every(Boolean) && sameHashes(await fileHashes(files), saved.hashes)) return;
  const directory = await scratch();
  try {
    const archive = join(directory, 'baseline.tgz');
    await run('scp', [...sshArgs, `${host}:${remoteRoot}/${group}.${saved.version}.tgz`, archive], repoRoot);
    if (await hashFile(archive) !== saved.archiveHash) throw Error(`Shared baseline archive checksum mismatch for ${group}`);
    const names = files.map(path => basename(path));
    await run('tar', ['-xzf', archive, '-C', directory, ...names], repoRoot);
    const extracted = names.map(name => join(directory, name));
    for (const path of extracted) if (!(await lstat(path)).isFile()) throw Error('Shared baseline must contain regular files');
    if (!sameHashes(await fileHashes(extracted), saved.hashes) || (token && !await matchesPg(extracted, token)))
      throw Error(`Shared baseline for ${group} differs from the last live publication; finish the previous publication on its original machine.`);
    assertHeld();
    if (group === 'release' || group === 'static') await refreshArtifacts(group, files[0], extracted[0], directory, assertHeld);
    await install(group, extracted, files);
    console.log(`[基线] ${group} 已从服务器同步（${saved.exportDate}）`);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export async function assertPublicationDate(groups: BaselineGroup[], exportDate: string): Promise<void> {
  if (!isDate(exportDate)) throw Error('Invalid WCA export date for statistics publication');
  for (const group of groups) {
    const saved = await checkpoint(group);
    if (saved && saved.exportDate > exportDate) throw Error(`WCA export ${exportDate} predates the published ${group} baseline ${saved.exportDate}`);
  }
}

export async function saveSharedBaseline(group: BaselineGroup, exportDate: string, assertHeld: () => void): Promise<void> {
  if (!isDate(exportDate)) throw Error('Invalid WCA export date for shared statistics baseline');
  const files = localFiles(group);
  if (!(await Promise.all(files.map(exists))).every(Boolean)) return;
  if (isPg(group)) {
    const token = await pgToken(group);
    if (!token || !await matchesPg(files, token)) throw Error(`Cannot share ${group}: local baseline differs from the live PG receipt`);
  }
  const prior = await checkpoint(group);
  if (prior && prior.exportDate > exportDate) throw Error(`Cannot share an older ${group} baseline`);
  const hashes = await fileHashes(files);
  const version = digest(JSON.stringify([exportDate, hashes]));
  if (prior?.version === version) return;
  const directory = await scratch();
  const staging = `${remoteRoot}/.incoming-${randomUUID()}`;
  try {
    for (const path of files) await copyFile(path, join(directory, basename(path)));
    if (!sameHashes(await fileHashes(files.map(path => join(directory, basename(path)))), hashes)) throw Error(`Local baseline changed while staging ${group}`);
    const archive = join(directory, 'baseline.tgz');
    await run('tar', ['-czf', archive, '--no-xattrs', '-C', directory, ...files.map(path => basename(path))], repoRoot,
      { ...process.env, COPYFILE_DISABLE: '1' });
    const data: Checkpoint = { version, exportDate, archiveHash: await hashFile(archive), hashes };
    const metadata = join(directory, 'baseline.json');
    await writeFile(metadata, JSON.stringify(data));
    assertHeld();
    await run('ssh', [...sshArgs, host, `umask 077; mkdir -p ${quote(remoteRoot)} && mkdir ${quote(staging)}`], repoRoot);
    await run('scp', [...sshArgs, archive, metadata, `${host}:${staging}/`], repoRoot);
    assertHeld();
    const checksum = quote(`${data.archiveHash}  baseline.tgz`);
    const old = prior ? `rm -f -- ${quote(`${remoteRoot}/${group}.${prior.version}.tgz`)}` : ':';
    await run('ssh', [...sshArgs, host, `set -e; cd ${quote(staging)}; printf '%s\\n' ${checksum} | sha256sum -c -; mv baseline.tgz ${quote(`${remoteRoot}/${group}.${version}.tgz`)}; mv baseline.json ${quote(`${remoteRoot}/${group}.json`)}; ${old}`], repoRoot);
    console.log(`[基线] ${group} 已保存到服务器（${exportDate}）`);
  } finally {
    await run('ssh', [...sshArgs, host, `rm -rf -- ${quote(staging)}`], repoRoot).catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
}
