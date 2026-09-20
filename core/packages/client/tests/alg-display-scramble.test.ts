import { describe, expect, it } from 'vitest';
import { ALG_3X3_TOP_LAYER_SET } from '@cuberoot/shared/alg';
import { CubeData, parseAlgorithm } from '@cuberoot/visualcube';
import { normalizeAlg } from '@/lib/alg_normalize';
import { CASE_VIEW_ANGLES, caseViewSetup, displayCaseAlg, displayCaseAlgHtml, displayCaseScramble, adjacentUEdits, simplifyAdjacentU } from '@/lib/alg_display';
import { algHtmlText, editAlgHtmlText } from '@/lib/alg_html';
import fixtures from './fixtures/alg-ll-scramble-setups.json';

const SUNE = "R U R' U R U2 R'";

function state(alg: string) {
  const cube = new CubeData(3);
  for (const turn of parseAlgorithm(normalizeAlg('3x3', alg))) cube.turn(turn);
  return cube.faces;
}

function topLayer(alg: string) {
  const faces = state(alg);
  return [faces[0], ...[1, 2, 4, 5].map(face => faces[face].slice(0, 3))];
}

describe('last-layer displayed scrambles', () => {
  it('canonicalizes y2 prime everywhere in /alg display text', () => {
    expect(displayCaseScramble('3x3', 'f2l', "y2' L U L' U'")).toBe("y2 L U L' U'");
    expect(displayCaseAlg('3x3', 'f2l', "y2' R U R'")).toBe("y2 R U R'");
    expect(displayCaseAlgHtml('3x3', 'f2l', "<em>y2'</em> R U R'"))
      .toBe("<em>y2</em> R U R'");
  });

  it('reduces consecutive U moves using the puzzle turn order and preserves unaffected finger marks', () => {
    expect(simplifyAdjacentU('3x3', "U U' R U U U' R' U2 U2")).toBe("R U R'");
    expect(simplifyAdjacentU('megaminx', 'U2 U2 R')).toBe("U' R");
    expect(simplifyAdjacentU('pyraminx', 'U U R')).toBe("U' R");
    expect(simplifyAdjacentU('3x3', "Uw U'p (U R U')2")).toBe("Uw U'p (U R U')2");
    const html = "U <u>U'</u> <em>R'</em> U' R <s>U'</s> R' <strong>U2'</strong> R";
    const edited = editAlgHtmlText(html, adjacentUEdits(algHtmlText(html), 4));
    expect(edited.trim()).toBe("<em>R'</em> U' R <s>U'</s> R' <strong>U2'</strong> R");
    expect(editAlgHtmlText('<s>U</s> <em>U</em> R', adjacentUEdits('U U R', 4))).toBe('U2 R');
  });
  it.each([
    [`${SUNE} y`, `${SUNE} U`],
    [`${SUNE} y2`, `${SUNE} U2`],
    [`${SUNE} y'`, `${SUNE} U'`],
    [`${SUNE} (y2') U'`, `${SUNE} U`],
    [`${SUNE} U y'`, SUNE],
    [`${SUNE} y U y2 U'`, `${SUNE} U'`],
  ])('replaces the entire finishing U/y suffix: %s', (input, expected) => {
    expect(displayCaseScramble('3x3', 'oll', input)).toBe(expected);
    expect(topLayer(expected)).toEqual(topLayer(input));
  });

  it('keeps the screenshot case and solved lower layers in the original grip', () => {
    const actual = displayCaseScramble('3x3', 'oll', "R U R' U R U2' R' y'");
    expect(actual).toBe("R U R' U R U2' R' U'");
    const faces = state(actual);
    const solved = state('');
    expect(faces[3]).toEqual(solved[3]);
    for (const face of [1, 2, 4, 5]) expect(faces[face].slice(3)).toEqual(solved[face].slice(3));
  });

  it('uses the existing exhaustive set classification', () => {
    for (const [set, enabled] of Object.entries(ALG_3X3_TOP_LAYER_SET)) {
      expect(displayCaseScramble('3x3', set, `${SUNE} y'`), set)
        .toBe(`${SUNE} ${enabled ? "U'" : "y'"}`);
    }
    for (const puzzle of ['2x2', '4x4', 'sq1', 'megaminx', 'skewb', 'fto']) {
      expect(displayCaseScramble(puzzle, 'oll', `${SUNE} y'`)).toBe(`${SUNE} y'`);
    }
  });

  it('preserves internal rotations, wide moves, slices, and x/z finishes', () => {
    for (const alg of ["y R U R'", "r U R' U' r' F R F'", 'M2 U M2', `${SUNE} x`, `${SUNE} z`, `${SUNE} y Uw`]) {
      expect(displayCaseScramble('3x3', 'oll', alg)).toBe(alg);
    }
    for (const alg of ["r U R' U' r' F R F'", 'M2 U M2 U2 M2 U M2', `y ${SUNE}`, "x R2 D2 R U R' D2 R U' R x'"]) {
      const input = `${alg} y'`;
      expect(topLayer(displayCaseScramble('3x3', 'pll', input))).toEqual(topLayer(input));
    }
    expect(displayCaseScramble('3x3', 'oll', 'R ? y')).toBe('R ? y');
  });

  // Complete OLL (57) and PLL (21) setup corpus from the public API, 2026-09-15.
  // Check sticker identities, not just yellow masks, at every selectable angle.
  it('preserves every top-layer sticker in the full OLL/PLL corpus at all view angles', () => {
    expect(fixtures.filter(c => c.set === 'oll')).toHaveLength(57);
    expect(fixtures.filter(c => c.set === 'pll')).toHaveLength(21);
    for (const c of fixtures) {
      for (const angle of CASE_VIEW_ANGLES) {
        const input = caseViewSetup(c.setup, angle);
        const output = displayCaseScramble('3x3', c.set, input);
        expect(topLayer(output), `${c.name} / ${angle}`).toEqual(topLayer(input));
        expect(output, `${c.name} / ${angle}`).not.toMatch(/\by(?:2'?|')?(?:\s+U(?:2'?|')?)*\s*$/);
      }
    }
  });
});
