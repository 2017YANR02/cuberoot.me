import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { purgeStaticMusicTrack } from '../src/utils/music_static_library.js';

const first = 'a'.repeat(64);
const second = 'b'.repeat(64);
const firstName = `${first}.m4a`;
const secondName = `${second}.m4a`;
const track = (id: string, name: string) => ({ id, src: `/music/library/tracks/${name}` });
let root: string;

async function writeManifest(tracks: ReturnType<typeof track>[]) {
  await fs.writeFile(path.join(root, 'manifest.v1.json'), JSON.stringify({ version: 1, tracks }));
}

async function readTracks() {
  return JSON.parse(await fs.readFile(path.join(root, 'manifest.v1.json'), 'utf8')).tracks;
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), 'cuberoot-music-delete-'));
  await fs.mkdir(path.join(root, 'tracks'));
  await fs.writeFile(path.join(root, 'tracks', firstName), 'first audio');
  await fs.writeFile(path.join(root, 'tracks', secondName), 'second audio');
});

afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

describe('permanent static music removal', () => {
  it('serializes two deletions and leaves their retries safe', async () => {
    await writeManifest([track(first, firstName), track(second, secondName)]);
    expect(await Promise.all([purgeStaticMusicTrack(root, first), purgeStaticMusicTrack(root, second)])).toEqual([true, true]);
    expect(await readTracks()).toEqual([]);
    expect(await fs.readdir(path.join(root, 'tracks'))).toEqual([]);
    expect(await purgeStaticMusicTrack(root, first)).toBe(true);
  });

  it('keeps shared audio until its last track is removed', async () => {
    await writeManifest([track(first, firstName), track(second, firstName)]);
    expect(await purgeStaticMusicTrack(root, first)).toBe(true);
    expect(await readTracks()).toEqual([track(second, firstName)]);
    expect(await fs.readFile(path.join(root, 'tracks', firstName), 'utf8')).toBe('first audio');
    expect(await purgeStaticMusicTrack(root, second)).toBe(true);
    expect(await fs.readdir(path.join(root, 'tracks'))).toEqual([secondName]);
  });

  it('resumes after the manifest changed but its audio still exists', async () => {
    await writeManifest([track(second, secondName)]);
    await fs.mkdir(path.join(root, '.removed-tracks'));
    await fs.writeFile(path.join(root, '.removed-tracks', first), track(first, firstName).src);
    expect(await purgeStaticMusicTrack(root, first)).toBe(true);
    expect(await readTracks()).toEqual([track(second, secondName)]);
    expect(await fs.readdir(path.join(root, 'tracks'))).toEqual([secondName]);
  });
});
