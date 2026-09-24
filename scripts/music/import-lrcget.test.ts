import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { inspectLrc, run } from './import-lrcget.js';

test('timestamp, encoding, and instrumental boundaries', () => {
  for (const [payload, status] of [
    ['[offset:500]\n[00:01.20][00:03]Hello', 'synced'], ['[au: instrumental]', 'instrumental'],
    ['[00:13]Too late', 'review'], ['[offset:-2000]\n[00:01]Negative', 'review'],
    ['[00:99]Invalid seconds', 'review'], ['Plain lyrics', 'review'],
  ]) assert.equal(inspectLrc(Buffer.from(payload), 10)[0], status);
  assert.equal(inspectLrc(Buffer.from([255]), 10)[0], 'review');
});

test('apply preserves media and is idempotent', () => {
  const parent = mkdtempSync(path.join(tmpdir(), 'cuberoot-lrcget-'));
  const root = path.join(parent, 'library');
  mkdirSync(path.join(root, 'tracks'), { recursive: true });
  const tracks = Array.from({ length: 3 }, (_, i) => ({ id: String(i), title: 'Song', duration: 10, src: `/music/library/tracks/${i.toString(16).padStart(64, '0')}.mp3`, lyrics: '/music/library/lyrics/old.lrc', cover: '/cover.jpg' }));
  const manifest = path.join(root, 'manifest.v1.json');
  const original = Buffer.from(JSON.stringify({ version: 1, tracks }));
  writeFileSync(manifest, original);
  const audio = path.join(root, 'tracks', `${'0'.repeat(64)}.mp3`);
  writeFileSync(audio, 'unchanged audio');
  writeFileSync(path.join(root, 'tracks', `${'0'.repeat(64)}.lrc`), '[00:01]Hello');
  writeFileSync(path.join(root, 'tracks', `${'1'.padStart(64, '0')}.lrc`), '[au: instrumental]');
  assert.deepEqual(run(root).counts, { synced: 1, instrumental: 1, missing: 1 });
  assert.ok(readFileSync(manifest).equals(original));
  run(root, true);
  const first = readFileSync(manifest);
  const output = JSON.parse(first.toString()).tracks;
  assert.ok(!('lyrics' in output[1]) && !('lyrics' in output[2]));
  assert.equal(readFileSync(audio, 'utf8'), 'unchanged audio');
  const backup = readdirSync(path.join(parent, 'inventory')).filter(name => name.startsWith('manifest-before-'));
  assert.equal(backup.length, 1);
  assert.ok(readFileSync(path.join(parent, 'inventory', backup[0])).equals(original));
  run(root, true);
  assert.ok(readFileSync(manifest).equals(first));
});
