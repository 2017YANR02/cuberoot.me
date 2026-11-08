import { describe, it, expect } from 'vitest';
import { puzzles } from 'cubing/puzzles';
import { CubeData, Masking, makeMasking, parseAlgorithm, renderFromSimpleQuery } from '@cuberoot/visualcube';
import type { AlgFile } from '@cuberoot/shared/alg';
import fixture from './fixtures/alg-6x6.json';
import { validateStoredAlgCase } from '@/lib/alg_validation';
import { reachesGoal } from '@/lib/alg_goals';
import { caseThumbPlan } from '@/lib/alg_thumb_plan';
import { normalizeAlg } from '@/lib/alg_normalize';

const files = fixture as AlgFile[];
const centers = (i: number) => i >= 6 && i < 30 && i % 6 > 0 && i % 6 < 5;
const sourceColors = 'yogwrb';
function faceColors(alg: string) {
  const cube = new CubeData(6);
  for (const turn of parseAlgorithm(normalizeAlg('6x6', alg))) cube.turn(turn);
  return Object.values(cube.faces).map(face => face.map(n => sourceColors[Math.floor((n - 1) / 36)]));
}

describe('reviewed six-layer algorithm intake', () => {
  it('contains 35 distinct cases and 40 source algorithms', () => {
    expect(files.map(f => [f.set, f.cases.length])).toEqual([['l2e', 3], ['l2c', 32]]);
    expect(files.flatMap(f => f.cases).flatMap(c => c.algs.flat())).toHaveLength(40);
    for (const file of files) {
      const keys = file.cases.map(c => faceColors(c.setup).map(f => f.filter((_, i) => file.set !== 'l2c' || centers(i)).join('')).join('/'));
      expect(new Set(keys).size).toBe(file.cases.length);
    }
  });
  for (const file of files) for (const c of file.cases) {
    it(`${file.set}/${c.name}: source diagram, every alternative, and shared thumbnail`, async () => {
      const faces = faceColors(c.setup);
      faces.forEach((face, f) => face.forEach((color, i) => {
        const corner = [0, 5, 30, 35].includes(i);
        if (file.set === 'l2e' && (centers(i) || corner)) expect(color).toBe(sourceColors[f]);
        if (file.set === 'l2c' && centers(i) && f !== 0 && f !== 2) expect(color).toBe(sourceColors[f]);
      }));
      expect(c.sticker.kind).toBe('face');
      if (c.sticker.kind !== 'face') throw Error('Missing source diagram');
      for (const [key, face] of Object.entries({ us: 0, ur: 1, uf: 2, ul: 4, ub: 5 })) {
        const expected = c.sticker[key as 'us'];
        expect(expected).toHaveLength(36);
        [...expected].forEach((color, i) => { if (color !== 'l') expect(faces[face][i]).toBe(color); });
      }
      for (const entry of c.algs.flat()) {
        expect(await validateStoredAlgCase(c.setup, entry.alg, c.sticker, '6x6', file.set, { fixedOrientation: true })).toEqual({ ok: true, auf: '' });
        faceColors(`${c.setup} ${entry.alg}`).forEach((face, f) => face.forEach((color, i) => {
          if (file.set !== 'l2c' || centers(i)) expect(color).toBe(sourceColors[f]);
        }));
        expect((await validateStoredAlgCase(c.setup, 'R', c.sticker, '6x6', 'l2e', { fixedOrientation: true })).ok).toBe(false);
      }
      const plan = caseThumbPlan({ puzzle: '6x6', set: file.set, sticker: c.sticker, setup: c.setup, alg: c.algs[0][0].alg });
      const five = caseThumbPlan({ puzzle: '5x5', set: file.set, sticker: c.sticker, setup: c.setup, alg: c.algs[0][0].alg });
      expect(plan.renderer).toBe('visualcube');
      if (plan.renderer !== 'visualcube' || five.renderer !== 'visualcube') throw Error('Wrong renderer');
      expect(plan.params).toEqual({ ...five.params, puzzleSize: 6 });
      if (file.set === 'l2c') {
        const mask = new CubeData(6, makeMasking(plan.params.mask as Masking, 6));
        for (const turn of parseAlgorithm(c.setup)) mask.turn(turn);
        mask.faces[0].forEach((value, i) => { if (centers(i)) expect(Boolean(value)).toBe(true); });
      }
      const svg = renderFromSimpleQuery({ alg: c.setup, cubeSize: 6, view: plan.params.view, mask: plan.params.mask, ngs: plan.params.hideGreySides ? '1' : undefined, sch: plan.params.scheme });
      expect(svg).toContain('<svg');
      expect(svg).not.toMatch(/NaN|undefined/);
    });
  }
  it('validates all four center orbits by colour and does not bypass edge goals', async () => {
    const kp = await puzzles['6x6x6'].kpuzzle();
    const centerSolved = kp.defaultPattern().applyAlg('U');
    expect(reachesGoal(centerSolved, kp, '6x6', 'centers', true)).toBe(true);
    expect(reachesGoal(centerSolved, kp, '6x6', 'solve', true)).toBe(false);
    for (const move of ['2R', '3R']) expect(reachesGoal(kp.defaultPattern().applyAlg(move), kp, '6x6', 'centers', true)).toBe(false);
  });
});
