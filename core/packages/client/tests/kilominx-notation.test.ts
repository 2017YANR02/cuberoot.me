import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
import {
  convertKilominxAlg, fromCubingKilominx, toCubingKilominx,
} from '@/lib/kilominx-notation';

const kpuzzle = await puzzles.kilominx.kpuzzle();

// Independently calibrated against csTimer MgmCubie: all 60 corner stickers
// agree for these 12 faces and each of the four nonidentity turn amounts.
const FACE_PAIRS = [
  ['U', 'U'], ['R', 'R'], ['F', 'F'], ['L', 'L'], ['BL', 'BL'], ['BR', 'BR'],
  ['DR', 'FR'], ['DL', 'FL'], ['DBL', 'DL'], ['B', 'B'], ['DBR', 'DR'], ['D', 'D'],
] as const;

describe('Kilominx notation', () => {
  it.each(FACE_PAIRS)('maps csTimer %s to cubing %s without changing turn direction', (from, to) => {
    for (const suffix of ['', '2', "2'", "'"]) {
      const converted = toCubingKilominx(from + suffix);
      expect(converted).toBe(to + suffix);
      expect(fromCubingKilominx(converted)).toBe(from + suffix);
      expect(kpuzzle.algToTransformation(converted).isIdentical(
        kpuzzle.moveToTransformation(to + suffix),
      )).toBe(true);
      expect(kpuzzle.algToTransformation(converted).applyTransformation(
        kpuzzle.algToTransformation(new Alg(to + suffix).invert()),
      ).isIdentityTransformation()).toBe(true);
    }
  });

  it('retains group, commutator and conjugate semantics in both directions', () => {
    const source = " ([DR,DL2'] [DBL:DBR2])2'\n [DR:DL]  ";
    const expected = " ([FR,FL2'] [DL:DR2])2'\n [FR:FL]  ";
    const converted = toCubingKilominx(source);
    expect(converted).toBe(expected);
    expect(fromCubingKilominx(converted)).toBe(source);
    expect(kpuzzle.algToTransformation(converted).isIdentical(
      kpuzzle.algToTransformation(expected),
    )).toBe(true);
    const inverse = toCubingKilominx(new Alg(source).invert().toString());
    expect(kpuzzle.algToTransformation(converted).applyTransformation(
      kpuzzle.algToTransformation(inverse),
    ).isIdentityTransformation()).toBe(true);
  });

  it('preserves whitespace, numeric suffixes and comments verbatim', () => {
    const source = "\tDR12'  DL3\r\n// DR DL DBL DBR\r\n[DBL,DBR] // DL\nDR/* DBL\nDL */ DBR";
    const expected = "\tFR12'  FL3\r\n// DR DL DBL DBR\r\n[DL,DR] // DL\nFR/* DBL\nDL */ DR";
    expect(toCubingKilominx(source)).toBe(expected);
    expect(fromCubingKilominx(expected)).toBe(source);
    expect(toCubingKilominx('DR // DBL at EOF')).toBe('FR // DBL at EOF');
    expect(toCubingKilominx('DR /* unclosed DBL')).toBe('FR /* unclosed DBL');
    const withLineComment = 'DR // DL DBL DBR\nDL';
    expect(kpuzzle.algToTransformation(toCubingKilominx(withLineComment)).isIdentical(
      kpuzzle.algToTransformation('FR FL'),
    )).toBe(true);
  });

  it('leaves Pochmann turns, wide layers and whole rotations unchanged', () => {
    const special = "R++ D-- R-- D++ DRw2' FRw DLv DBLv 2DR 2-3DL2 3DBRw x2 y' z Fv Uv";
    expect(toCubingKilominx(special)).toBe(special);
    expect(fromCubingKilominx(special)).toBe(special);
    expect(kpuzzle.algToTransformation(toCubingKilominx('R++ D--')).isIdentical(
      kpuzzle.algToTransformation("2-3L2' 2-3U2"),
    )).toBe(true);
  });

  it('does not guess the source notation or repair unknown and invalid tokens', () => {
    const original = "DL DR DBL2' // FR FL";
    expect(convertKilominxAlg(original, 'cstimer', 'cstimer')).toBe(original);
    expect(toCubingKilominx(original, 'cubing')).toBe(original);
    expect(fromCubingKilominx(original, 'cubing')).toBe(original);
    expect(toCubingKilominx('DL DR')).toBe('FL FR');
    expect(fromCubingKilominx('DL DR')).toBe('DBL DBR');
    const unknown = "@DR DRfoo DRDL DR2DL DR'' DBL_ constructor FR FL";
    expect(toCubingKilominx(unknown)).toBe(unknown);
    expect(toCubingKilominx('')).toBe('');
    expect(toCubingKilominx('  \n\t')).toBe('  \n\t');
    expect(toCubingKilominx('[DR, ???')).toBe('[FR, ???');
  });

  it('reproduces the calibrated real csTimer scramble corner state', () => {
    // Captured from klmso with seed "kilominx-sim-notation-review-2026".
    // Its converted result was independently compared to MgmCubie on all 60
    // corner stickers. Keep the fixture; do not initialize the random-state solver.
    const source = "DL DBL' D2' DR2' DL2 DR2 L' DBL2' L2 B2 BL2' BR2 U2 BR' BL DBL2 BL2' L2' BL DBL2' BL' DBL BL2' L' BL2' L2' BL2'";
    const converted = toCubingKilominx(source);
    expect(kpuzzle.defaultPattern().applyAlg(converted).patternData.CORNERS).toEqual({
      pieces: [7, 19, 12, 2, 11, 18, 6, 14, 3, 16, 0, 5, 13, 8, 17, 9, 10, 15, 1, 4],
      orientation: [1, 1, 0, 1, 2, 2, 0, 0, 2, 2, 1, 2, 1, 2, 1, 0, 1, 0, 1, 1],
    });
    expect(fromCubingKilominx(converted)).toBe(source);
    expect(kpuzzle.defaultPattern().applyAlg(converted).applyAlg(
      new Alg(converted).invert(),
    ).isIdentical(kpuzzle.defaultPattern())).toBe(true);
  });
});
