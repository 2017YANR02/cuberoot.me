import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const AUDIO_URL = /^(?:\/music\/library\/)(tracks\/[0-9a-f]{64}\.(?:mp3|m4a|flac|wav))$/;
const TRACK_ID = /^[0-9a-f]{64}$/;
export class StaticMusicLibraryBusy extends Error {}

function allowMissing(error: unknown): null {
  if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
  throw error;
}

let localQueue: Promise<unknown> = Promise.resolve();

async function withManifestLock<T>(root: string, run: () => Promise<T>): Promise<T> {
  if (process.platform !== 'linux') {
    const result = localQueue.then(run);
    localQueue = result.catch(() => {});
    return result;
  }
  // Lock the open file description. The kernel holds the lock until Node
  // closes its copy of the descriptor or exits.
  const lock = await fs.open(path.join(root, '.manifest.lock'), 'a', 0o600);
  try {
    const child = spawn('flock', ['-x', '-w', '5', '3'], { stdio: ['ignore', 'ignore', 'ignore', lock.fd] });
    const [status] = await once(child, 'exit');
    if (status !== 0) throw new StaticMusicLibraryBusy('Music library is busy');
    return await run();
  } finally {
    await lock.close();
  }
}

async function writeAtomic(file: string, contents: string, mode: number): Promise<void> {
  const pending = `${file}.${randomUUID()}.part`;
  const handle = await fs.open(pending, 'wx', mode);
  try {
    try {
      await handle.writeFile(contents);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(pending, file);
  } catch (error) {
    await fs.unlink(pending).catch(() => {});
    throw error;
  }
}

type StaticTrack = { id: string; src: string };
type Manifest = { version: 1; tracks: StaticTrack[] };

/** A per-track record lets a retry finish an interrupted file removal. */
export async function purgeStaticMusicTrack(libraryRoot: string, id: string): Promise<boolean> {
  if (!TRACK_ID.test(id)) throw new Error('Validation failed: invalid static track id');
  const root = await fs.realpath(libraryRoot);
  return withManifestLock(root, async () => {
    const manifestPath = path.join(root, 'manifest.v1.json');
    const tracksDir = path.join(root, 'tracks');
    const removedDir = path.join(root, '.removed-tracks');
    if (!(await fs.lstat(manifestPath)).isFile() || !(await fs.lstat(tracksDir)).isDirectory()) {
      throw new Error('Invalid music library layout');
    }
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as Manifest;
    if (manifest.version !== 1 || !Array.isArray(manifest.tracks)) throw new Error('Invalid music manifest');
    const track = manifest.tracks.find((entry) => entry.id === id);

    await fs.mkdir(removedDir, { recursive: true, mode: 0o700 });
    if (!(await fs.lstat(removedDir)).isDirectory()) throw new Error('Invalid music retirement directory');
    const recordPath = path.join(removedDir, id);
    const record = await fs.lstat(recordPath).catch(allowMissing);
    if (record && !record.isFile()) throw new Error('Invalid music retirement record');
    const recorded = record ? await fs.readFile(recordPath, 'utf8') : null;
    if (!track && recorded === null) return false;
    if (track && recorded !== null && track.src !== recorded) throw new Error('Music retirement conflicts with the current manifest');

    const src = track?.src ?? recorded ?? '';
    const relative = AUDIO_URL.exec(src)?.[1];
    if (!relative) throw new Error('Invalid static music path');
    const audioPath = path.join(root, relative);
    const audio = await fs.lstat(audioPath).catch(allowMissing);
    if (audio && !audio.isFile()) throw new Error('Invalid static music file');
    const tracks = manifest.tracks.filter((entry) => entry.id !== id);
    if (recorded === null) await writeAtomic(recordPath, src, 0o600);
    if (track) await writeAtomic(manifestPath, JSON.stringify({ ...manifest, tracks }, null, 2) + '\n', 0o644);
    if (audio && !tracks.some((entry) => entry.src === src)) await fs.unlink(audioPath);
    return true;
  });
}
