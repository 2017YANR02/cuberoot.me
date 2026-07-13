import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readSpecFromParams, specToParams } from '@/lib/puzzle-image/codec';
import { DEFAULTS, rotationDefaultsFor } from '@/lib/puzzle-image/defaults';
import type { ImageSpec } from '@/lib/puzzle-image/types';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Build a spec, snapping rotations to the puzzle's defaults unless overridden. */
function spec(p: Partial<ImageSpec>): ImageSpec {
  const s: ImageSpec = { ...DEFAULTS, ...p };
  if (p.rotateAxis1 === undefined && p.rotateAngle1 === undefined) {
    const d = rotationDefaultsFor(s);
    s.rotateAxis1 = d.axis1; s.rotateAngle1 = d.angle1;
    s.rotateAxis2 = d.axis2; s.rotateAngle2 = d.angle2;
  }
  return s;
}

const SPECS: Record<string, ImageSpec> = {
  defaults: spec({}),
  'cube 5x5 @512': spec({ cubeSize: 5, imageSize: 512 }),
  'cube alg': spec({ algorithm: "R U R' U'" }),
  'cube case + stage + maskAlg': spec({ algType: 'case', algorithm: "R U R'", stageMask: 'f2l', maskAlg: 'y' }),
  'cube plan + arrows': spec({ cubeView: 'plan', arrows: 'U0U2,U2U8-s10-ff0000', defaultArrowColor: 'red' }),
  'cube custom scheme': spec({
    faceU: '#ffffff', faceR: '#ff8800', faceF: '#00aa00',
    faceD: '#ffff00', faceL: '#dd0000', faceB: '#0000cc',
  }),
  'cube rotated + shell': spec({
    rotateAxis1: 'y', rotateAngle1: 45, rotateAxis2: 'x', rotateAngle2: -20,
    backgroundColor: '#123456', cubeColor: '#ffffff',
    cubeOpacity: 50, stickerOpacity: 80, dist: 8,
  }),
  'cube 2x2 wca net': spec({ cubeSize: 2, cubeView: 'wca' }),
  'sq1 wca case': spec({ puzzleType: 'sq1', puzzleVariant: 'wca', algType: 'case', algorithm: '/(3,3)/(1,0)/' }),
  'megaminx top': spec({ puzzleType: 'megaminx', puzzleVariant: 'top' }),
  'pyraminx iso case': spec({ puzzleType: 'pyraminx', algType: 'case', algorithm: "U R' L R B'" }),
  'skewb net': spec({ puzzleType: 'skewb', puzzleVariant: 'net', algorithm: "R U L' B" }),
};

describe('puzzle-image codec round-trip', () => {
  for (const prefix of ['', 'img_']) {
    for (const [name, s] of Object.entries(SPECS)) {
      it(`prefix="${prefix}" ${name}`, () => {
        expect(readSpecFromParams(specToParams(s, prefix), prefix)).toEqual(s);
      });
    }
  }
});

/** Decoded key=value pairs, order-insensitive (nuqs writes keys in its own order). */
function pairs(sp: URLSearchParams): string[] {
  return [...sp.entries()].map(([k, v]) => `${k}=${v}`).sort();
}

interface Golden { name: string; qs: string; finalUrl: string }

describe('puzzle-image codec — live-page URL contract', () => {
  const golden: Golden[] = JSON.parse(
    readFileSync(path.join(here, 'fixtures/puzzle-image-golden/index.json'), 'utf8'),
  );

  it('has all 28 fixtures', () => {
    expect(golden.length).toBe(28);
  });

  for (const g of golden) {
    it(g.name, () => {
      const emitted = specToParams(readSpecFromParams(new URLSearchParams(g.qs), ''), '');
      const live = new URL(g.finalUrl).searchParams;
      expect(pairs(emitted)).toEqual(pairs(live));
    });
  }
});

describe('puzzle-image codec — prefix isolation', () => {
  it('legacy ?puzzle= alias is honored at prefix ""', () => {
    expect(readSpecFromParams(new URLSearchParams('puzzle=5'), '').cubeSize).toBe(5);
    expect(readSpecFromParams(new URLSearchParams('puzzle=skewb'), '').puzzleType).toBe('skewb');
  });

  it('legacy ?puzzle= alias is IGNORED under a prefix', () => {
    expect(readSpecFromParams(new URLSearchParams('puzzle=5'), 'img_')).toEqual(DEFAULTS);
  });

  it("host page's own puzzle/alg keys do not leak into a prefixed spec", () => {
    expect(readSpecFromParams(new URLSearchParams('puzzle=skewb&alg=R'), 'img_')).toEqual(DEFAULTS);
    // …and the prefixed keys still work alongside them.
    const s = readSpecFromParams(
      new URLSearchParams('puzzle=skewb&alg=R&img_pzl=4&img_alg=U'),
      'img_',
    );
    expect(s.puzzleType).toBe('cube');
    expect(s.cubeSize).toBe(4);
    expect(s.algorithm).toBe('U');
  });

  it('emits prefixed keys only', () => {
    const qs = specToParams(spec({ cubeSize: 4, algorithm: 'U' }), 'img_').toString();
    expect(qs).toBe('img_pzl=4&img_alg=U');
  });
});
