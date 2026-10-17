import { expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { buildWatchScramble } from '../scripts/build-watch-scramble';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';

it('bundles the ordinary 333 provider without browser transport and keeps generating past ten slots', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'watch-scramble-'));
  try {
    const bundle = join(directory, 'WatchScramble.js');
    await buildWatchScramble(bundle);
    const context: any = { __watchRandomUInt32: () => randomBytes(4).readUInt32LE() };
    runInNewContext(await readFile(bundle, 'utf8'), context);
    const scrambles = new Set<string>();
    for (let n = 0; n < 12; n++) {
      context.WatchScramble.start();
      let value: any;
      for (let i = 0; i < 1000 && !value; i++) {
        await Promise.resolve();
        value = JSON.parse(context.WatchScramble.result());
      }
      expect(value).not.toBeNull();
      expect(value.error).toBeUndefined();
      expect(value.scramble).toMatch(/^[URFDLB](?:2|')?(?: [URFDLB](?:2|')?)*$/);
      expect(value.facelets).toBe(smartCubeTargetFacelets(value.scramble));
      for (const face of 'URFDLB') expect([...value.facelets].filter(c => c === face)).toHaveLength(9);
      scrambles.add(value.scramble);
    }
    expect(scrambles.size).toBe(12);
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 30_000);
