import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readSpecFromParams, specToParams, type CodecOptions, type InheritedFields } from '@/lib/puzzle-image/codec';
import {
  DEFAULTS, rotationDefaultsFor, resetRotationsForPuzzle, snapRotationOnVariantBoundary,
} from '@/lib/puzzle-image/defaults';
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

describe('rotation boundaries — the two are NOT the same function', () => {
  // page.tsx: the puzzle-TYPE buttons reset unconditionally; the VARIANT buttons
  // snap only when the angles are still the defaults. Both live in defaults.ts so
  // the shell cannot pick the wrong one by accident.
  const dialled = spec({ puzzleType: 'megaminx', rotateAxis1: 'y', rotateAngle1: 17, rotateAxis2: 'x', rotateAngle2: 3 });

  it('puzzle-type switch throws a hand-dialled rotation away', () => {
    const next = resetRotationsForPuzzle(dialled, { puzzleType: 'pyraminx' });
    expect(next.puzzleType).toBe('pyraminx');
    expect([next.rotateAxis1, next.rotateAngle1, next.rotateAxis2, next.rotateAngle2])
      .toEqual(['y', 60, 'x', -60]);   // pyraminx defaults
  });

  it('puzzle-type switch also lands on the defaults when nothing was dialled', () => {
    const next = resetRotationsForPuzzle(spec({}), { puzzleType: 'skewb' });
    expect([next.rotateAxis1, next.rotateAngle1, next.rotateAxis2, next.rotateAngle2])
      .toEqual(['y', 45, 'x', 34]);
  });

  it('variant switch KEEPS a hand-dialled rotation', () => {
    const next = snapRotationOnVariantBoundary(dialled, { puzzleVariant: 'top' });
    expect([next.rotateAxis1, next.rotateAngle1, next.rotateAxis2, next.rotateAngle2])
      .toEqual(['y', 17, 'x', 3]);
  });

  it('variant switch snaps when the rotation is still the default', () => {
    const clean = spec({ puzzleType: 'skewb' });                       // y45 x34
    const next = snapRotationOnVariantBoundary(clean, { puzzleVariant: 'top' });
    expect([next.rotateAxis1, next.rotateAngle1, next.rotateAxis2, next.rotateAngle2])
      .toEqual(['y', 0, 'x', 0]);                                      // skewb-top defaults
  });
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

describe('puzzle-image codec — panel mode (host owns the puzzle)', () => {
  // /sim mounts the studio with the sim's own `puzzle=` as the single puzzle source, so
  // the codec neither reads nor writes `pzl`, and the host puzzle is injected before the
  // puzzle-dependent parses (`view`, rotation defaults). This is what removed the
  // "img_pzl written but not honored" clobber the workflow reviewers flagged.
  const megaOpts: CodecOptions = { puzzle: { puzzleType: 'megaminx', cubeSize: 3 } };
  const pyraOpts: CodecOptions = { puzzle: { puzzleType: 'pyraminx', cubeSize: 3 } };
  const cubeOpts: CodecOptions = { puzzle: { puzzleType: 'cube', cubeSize: 3 } };
  const cube5Opts: CodecOptions = { puzzle: { puzzleType: 'cube', cubeSize: 5 } };

  it('never writes pzl — not for a non-cube puzzle', () => {
    const qs = specToParams(spec({ puzzleType: 'megaminx', puzzleVariant: 'top' }), 'img_', megaOpts).toString();
    expect(qs).not.toContain('img_pzl');
    expect(qs).toContain('img_view=top');
  });

  it('never writes pzl — not even for a non-default cube size', () => {
    const qs = specToParams(spec({ cubeSize: 5, imageSize: 512 }), 'img_', cube5Opts).toString();
    expect(qs).not.toContain('img_pzl');
    expect(qs).toContain('img_size=512');
  });

  it('the injected host puzzle wins over a stray img_pzl in the URL', () => {
    const s = readSpecFromParams(new URLSearchParams('img_pzl=3&img_view=top'), 'img_', megaOpts);
    expect(s.puzzleType).toBe('megaminx');
    expect(s.cubeSize).toBe(3);
    expect(s.puzzleVariant).toBe('top');   // view parsed against megaminx, not cube
  });

  it('parses `view` against the injected puzzle (wca → variant vs cubeView)', () => {
    const asCube = readSpecFromParams(new URLSearchParams('img_view=wca'), 'img_', cubeOpts);
    expect(asCube.cubeView).toBe('wca');
    expect(asCube.puzzleVariant).toBe(DEFAULTS.puzzleVariant);
    const asPyra = readSpecFromParams(new URLSearchParams('img_view=wca'), 'img_', pyraOpts);
    expect(asPyra.puzzleVariant).toBe('wca');
    expect(asPyra.cubeView).toBe(DEFAULTS.cubeView);
  });

  it('rotation defaults come from the injected puzzle on a cold link', () => {
    const s = readSpecFromParams(new URLSearchParams(''), 'img_', pyraOpts);
    expect([s.rotateAxis1, s.rotateAngle1, s.rotateAxis2, s.rotateAngle2]).toEqual(['y', 60, 'x', -60]);
  });

  it('round-trips a non-cube spec — the puzzle survives via injection, not pzl', () => {
    const s = spec({ puzzleType: 'pyraminx', algType: 'case', algorithm: "U R' L R B'" });
    const back = readSpecFromParams(specToParams(s, 'img_', pyraOpts), 'img_', pyraOpts);
    expect(back).toEqual(s);
  });
});

describe('puzzle-image codec — panel mode (host owns alg + colour scheme)', () => {
  // /sim also drops the studio's 公式 / 六面配色 controls: the sim's own alg + scheme
  // are injected via `inherit`, so the codec neither reads a stray `alg`/`case`/`sch`
  // nor emits one (no second copy of the sim's `alg`/`setup` under `img_*`).
  const inherit: InheritedFields = {
    algType: 'alg', algorithm: "R U R'",
    faceU: '#111111', faceR: '#222222', faceF: '#333333',
    faceD: '#444444', faceL: '#555555', faceB: '#666666',
  };
  const opts: CodecOptions = { puzzle: { puzzleType: 'cube', cubeSize: 3 }, inherit };

  it('injects the host alg + scheme, overriding any stray img_ keys', () => {
    const s = readSpecFromParams(
      new URLSearchParams('img_case=U2&img_sch=#a,#b,#c,#d,#e,#f'), 'img_', opts,
    );
    expect(s.algType).toBe('alg');
    expect(s.algorithm).toBe("R U R'");
    expect(s.faceU).toBe('#111111');
    expect(s.faceB).toBe('#666666');
  });

  it('never emits alg / case / sch — they are host-owned', () => {
    const s = spec({ algType: 'case', algorithm: 'U2', faceU: '#abcdef' });
    const qs = specToParams(s, 'img_', opts).toString();
    expect(qs).not.toContain('img_alg');
    expect(qs).not.toContain('img_case');
    expect(qs).not.toContain('img_sch');
  });

  it('still emits the image-specific keys (view / size / mask) and never pzl', () => {
    const s = spec({ cubeView: 'plan', imageSize: 128, stageMask: 'oll' });
    const qs = specToParams(s, 'img_', opts).toString();
    expect(qs).toContain('img_view=plan');
    expect(qs).toContain('img_size=128');
    expect(qs).toContain('img_stage=oll');
    expect(qs).not.toContain('img_pzl');
  });
});
