/**
 * OLL autofill must not depend on the user's cross colour.
 *
 * The old fingerprint table was built from the default yellow-cross frame.
 * A valid white-cross OLL 8 from a real reconstruction had a different raw
 * sticker fingerprint, so the UI incorrectly reported that the formula library
 * had no match even though its OLL algorithm solved the state.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@cuberoot/shared/alg', () => ({
  loadAlg: vi.fn(async () => ({
    puzzle: '3x3',
    set: 'oll',
    cases: [{
      name: 'OLL 8',
      algs: [[{ alg: "R U2 R' U2 R' F R F'" }]],
    }],
  })),
}));

import { invertAlg, patternFromAlg } from '@/lib/cube3';
import { lookupOllAlgs } from '@/lib/oll_lookup';
import { crossOnDRotation, detectStage } from '@/lib/stage_detect';

const OLL_8 = "R U2 R' U2 R' F R F'";

async function canonicalPattern(alg: string) {
  const raw = await patternFromAlg(alg);
  const rot = await crossOnDRotation(raw);
  return { raw, canonical: rot ? raw.applyAlg(rot) : raw };
}

describe('recon OLL lookup', () => {
  it('finds the OLL formula for the reported white-cross reconstruction', async () => {
    const scramble = "F' U D' B R2 F U2 F' U2 L B2 L' D2 F2 D2 R2 D2 L F2 L' B";
    const beforeOll = [
      'x2',
      'U L2 F R2 U F2',
      "L' U L y' U L U' L'",
      "U L' U' L U2 L' U L",
      "R U' R' U R U' R'",
    ].join(' ');
    const { raw, canonical } = await canonicalPattern(`${scramble} ${beforeOll}`);

    const stage = await detectStage(raw);
    expect(stage.stage).toBe('f2l');
    expect(stage.crossFaceHome).toBe(0);

    const entries = await lookupOllAlgs(canonical);
    expect(entries.some(entry => entry.caseName === 'OLL 8')).toBe(true);
    for (const entry of entries) {
      expect(['oll', 'solved']).toContain((await detectStage(canonical.applyAlg(entry.alg))).stage);
    }
  });

  it('keeps a default-frame fingerprint hit when the formula really works', async () => {
    const raw = await patternFromAlg(invertAlg(OLL_8));
    expect((await detectStage(raw)).stage).toBe('f2l');

    const entries = await lookupOllAlgs(raw);
    expect(entries.some(entry => entry.caseName === 'OLL 8')).toBe(true);
    for (const entry of entries) {
      expect(['oll', 'solved']).toContain((await detectStage(raw.applyAlg(entry.alg))).stage);
    }
  });

  it('does not return a cross-colour fingerprint collision as a valid formula', async () => {
    const { raw, canonical } = await canonicalPattern(`z ${invertAlg(OLL_8)}`);
    expect((await detectStage(raw)).stage).toBe('f2l');
    expect(await lookupOllAlgs(canonical)).toEqual([]);
  });
});
