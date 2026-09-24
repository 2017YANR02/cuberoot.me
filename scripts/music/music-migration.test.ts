import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileSha256 } from './music-shared.js';
import { prepareMusic, parseOptions } from './prepare-music.js';
import { main as publishMain, REMOTE_SCRIPTS, validateMusicLibrary, verifyPublicContract } from './publish-music.js';
import { conservativeCategory, exactLyricsTitleMatch } from './music-classify.js';

test('prepare is read-only on source, conservative, resumable, and publish validation is local-only', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cuberoot-music-migration-'));
  const source = join(root, 'source');
  const stage = join(root, 'stage');
  mkdirSync(join(source, 'Kenny G'), { recursive: true });
  const song = join(source, 'Kenny G', 'Song.wav');
  writeFileSync(song, 'fixture audio bytes');
  writeFileSync(join(source, 'Kenny G', 'Song.lrc'), '[00:00.00]Fixture lyrics\n');
  writeFileSync(join(source, 'Kenny G', 'Cover.jpg'), 'fixture cover bytes');
  const probe = join(root, 'mock-ffprobe.mjs');
  writeFileSync(probe, `process.stdout.write(JSON.stringify({ streams: [{ codec_type: 'audio', codec_name: 'pcm_s16le' }], format: { duration: '3.000', tags: { title: 'Song', artist: 'Kenny G', genre: 'Jazz' } } }));\n`);
  const args = ['--source-root', source, '--staging-root', stage, '--ffprobe', probe];
  try {
    const sourceHash = await fileSha256(song);
    await prepareMusic(parseOptions([...args, '--plan']));
    assert.equal(existsSync(stage), false);
    await prepareMusic(parseOptions(args));
    const library = join(stage, 'library');
    const first = await validateMusicLibrary(library);
    await publishMain(['--library', library]);
    assert.equal(first.tracks.length, 1);
    assert.equal(first.assets.length, 3);
    assert.equal(first.tracks[0].genre, 'jazz');
    assert.match(first.tracks[0].lyrics ?? '', /\/lyrics\/[a-f0-9]{64}\.lrc$/);
    assert.match(first.tracks[0].cover ?? '', /\/covers\/[a-f0-9]{64}\.jpg$/);
    const manifestBytes = readFileSync(join(library, 'manifest.v1.json'));
    await prepareMusic(parseOptions(args));
    assert.deepEqual(readFileSync(join(library, 'manifest.v1.json')), manifestBytes);
    assert.equal(await fileSha256(song), sourceHash);
    const corrupted = join(library, 'tracks', first.tracks[0].src.split('/').at(-1)!);
    writeFileSync(corrupted, 'corrupted');
    await assert.rejects(validateMusicLibrary(library), /SHA-256 does not match/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('classification and sidecar matching do not guess from ambiguous names', () => {
  assert.deepEqual(conservativeCategory({ relativePath: 'Kenny G/Song.wav' }), { id: 'jazz', source: 'explicit-top-directory' });
  assert.deepEqual(conservativeCategory({ relativePath: 'Other/Untitled.wav' }), { id: 'unclassified', source: 'none' });
  assert.equal(exactLyricsTitleMatch('Kenny G/01 Kenny G - Song.lrc', { relativePath: 'Kenny G/Song.wav', title: 'Song', artist: 'Kenny G' }), true);
  assert.equal(exactLyricsTitleMatch('Other/Song remix.lrc', { relativePath: 'Other/Song.wav', title: 'Song' }), false);
});

test('remote publish shell fragments parse and rollback restores the previous manifest', { skip: process.platform === 'win32' }, () => {
  for (const [name, script] of Object.entries(REMOTE_SCRIPTS)) {
    const check = spawnSync('sh', ['-n'], { input: script, encoding: 'utf8' });
    assert.equal(check.status, 0, `${name}: ${check.stderr}`);
  }
  const root = mkdtempSync(join(tmpdir(), 'cuberoot-music-rollback-'));
  try {
    const live = join(root, 'live'), stage = join(root, 'stage');
    mkdirSync(live); mkdirSync(stage);
    writeFileSync(join(live, 'manifest.v1.json'), 'bad candidate');
    writeFileSync(join(stage, 'manifest.v1.previous.json'), 'prior release');
    const script = REMOTE_SCRIPTS.rollback.replaceAll('__LIVE__', live).replaceAll('__STAGE__', stage);
    const result = spawnSync('sh', ['-c', script], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(live, 'manifest.v1.json'), 'utf8'), 'prior release');
    assert.equal(readFileSync(join(stage, 'manifest.v1.failed.json'), 'utf8'), 'bad candidate');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('public HTTP contract verifies manifest hash, CORS, range, and cache headers', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cuberoot-music-http-'));
  const audio = Buffer.from('sample audio bytes');
  const hash = createHash('sha256').update(audio).digest('hex');
  const audioPath = `/music/library/tracks/${hash}.wav`;
  mkdirSync(join(root, 'tracks'));
  writeFileSync(join(root, 'tracks', `${hash}.wav`), audio);
  const manifest = Buffer.from(JSON.stringify({ version: 1, tracks: [{ id: hash, title: 'Sample', duration: 3, src: audioPath }] }));
  writeFileSync(join(root, 'manifest.v1.json'), manifest);
  const server = createServer((request, response) => {
    if (request.url === '/music/library/manifest.v1.json') {
      response.writeHead(200, { 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
      response.end(manifest);
    } else if (request.url === audioPath && request.method === 'HEAD') {
      response.writeHead(200, { 'Accept-Ranges': 'bytes' }); response.end();
    } else if (request.url === audioPath && request.headers.range === 'bytes=0-1') {
      response.writeHead(206, {
        'Content-Range': `bytes 0-1/${audio.length}`,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Range, ETag, Last-Modified',
      });
      response.end(audio.subarray(0, 2));
    } else { response.writeHead(404); response.end(); }
  });
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a local TCP listener.');
    const library = await validateMusicLibrary(root);
    await verifyPublicContract(library, new URL(`http://127.0.0.1:${address.port}`));
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
});
