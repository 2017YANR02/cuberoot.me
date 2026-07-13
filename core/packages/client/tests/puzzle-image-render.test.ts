/**
 * Node-level lock for lib/puzzle-image/{render,arrows}.ts.
 *
 * The browser gate (scripts/verify_puzzle_image_golden.cjs, 28/28) still drives
 * /visualcube, which runs its OWN private copy of this logic — so it proves
 * nothing about the lib until the shell lands. This file closes that gap now:
 * the same query strings go through `readSpecFromParams` → `renderSpecSvg`, and
 * the output is locked byte-for-byte.
 *
 * Two locks, on purpose:
 *   1. toBe() against tests/fixtures/puzzle-image-lib/*.svg — the regression lock.
 *   2. equality with the PRE-migration browser golden (fixtures/puzzle-image-golden)
 *      after DOM-serialization normalization — the cross-oracle. All 18 pure-path
 *      cases are byte-identical to what the live page rendered before the
 *      extraction, i.e. the lib really is the same renderer.
 *
 * The normalization is exactly the difference between a raw renderer string and
 * the same string round-tripped through `innerHTML`:
 *   - `<rect …/>` is re-serialized as `<rect …></rect>`
 *   - a space before the self-close (`<rect … />`, which sq1_svg emits) is dropped
 * Nothing else — no attribute reordering, no number reformatting.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readSpecFromParams } from '@/lib/puzzle-image/codec';
import { DEFAULTS } from '@/lib/puzzle-image/defaults';
import { renderSpecSvg, domRenderKindOf, srKindOf, type DomRenderKind } from '@/lib/puzzle-image/render';
import { buildArrowEntry, appendArrow } from '@/lib/puzzle-image/arrows';
import { MASK_COLOR, formatMask } from '@/lib/puzzle-image/mask-core';
import { pieceOf } from '@/lib/puzzle-image/puzzle-mask';
import type { ImageSpec } from '@/lib/puzzle-image/types';

interface Golden { name: string; qs: string }
const INDEX: Golden[] = JSON.parse(
  readFileSync('tests/fixtures/puzzle-image-golden/index.json', 'utf8'),
);

/** The specs a pure renderer serves — everything else needs the DOM. */
const PURE = [
  'cube-normal', 'cube-normal-alg', 'cube-plan', 'cube-trans', 'cube-net-5',
  'cube-wca-4', 'cube-arrows', 'cube-scheme', 'cube-stage-oll', 'cube-stage-f2l-y',
  'cube-rot', 'cube-shell', 'cube-size-512', 'cube-2x2-ff', 'cube-4x4-yau',
  'sq1-wca', 'pyra-wca', 'skewb-wca',
];

/** …and the ten the host component owns, with the renderer that owns each. */
const DOM: Record<string, DomRenderKind> = {
  'cube-net-3': 'net-paint-3x3',
  'sq1-iso': 'sr-puzzlegen',
  'sq1-iso-case': 'sr-puzzlegen',
  'sq1-iso-case-renderfail': 'sr-puzzlegen',
  'mega-iso': 'sr-puzzlegen',
  'mega-top': 'sr-puzzlegen',
  'pyra-iso': 'sr-puzzlegen',
  'skewb-iso': 'sr-puzzlegen',
  'skewb-top': 'sr-puzzlegen',
  'skewb-net': 'skewb-net-display',
};

const specOf = (qs: string) => readSpecFromParams(new URLSearchParams(qs), '');
const render = (qs: string) => renderSpecSvg(specOf(qs));

/** raw renderer string ⇄ `innerHTML` round-trip (see the file header). */
const normalize = (svg: string) => svg
  .replace(/><\/(path|rect|polygon|circle|line|ellipse|polyline|use|image|stop)>/g, '/>')
  .replace(/\s+\/>/g, '/>');

describe('renderSpecSvg — dispatch', () => {
  it('splits the 28 golden specs into 18 pure + 10 DOM-bound', () => {
    const pure = INDEX.filter((g) => renderSpecSvg(specOf(g.qs)) !== null).map((g) => g.name);
    expect(pure).toEqual(PURE);
    expect(INDEX.length - pure.length).toBe(Object.keys(DOM).length);
  });

  for (const [name, kind] of Object.entries(DOM)) {
    it(`${name} → ${kind}`, () => {
      const g = INDEX.find((x) => x.name === name)!;
      const s = specOf(g.qs);
      expect(renderSpecSvg(s)).toBeNull();
      expect(domRenderKindOf(s)).toBe(kind);
    });
  }

  it('srKindOf maps the non-cube iso/top specs onto the sr kinds', () => {
    expect(srKindOf('megaminx', 'top')).toBe('megaminx-top');
    expect(srKindOf('megaminx', 'iso')).toBe('megaminx');
    expect(srKindOf('skewb', 'top')).toBe('skewb-top');
    expect(srKindOf('pyraminx', 'iso')).toBe('pyraminx');
    expect(srKindOf('sq1', 'iso')).toBe('sq1');
    expect(srKindOf('cube', 'iso')).toBeNull();      // NxN never goes through sr
    expect(srKindOf('skewb', 'net')).toBeNull();     // scramble-display owns it
  });
});

describe('renderSpecSvg — byte lock', () => {
  for (const name of PURE) {
    it(name, () => {
      const g = INDEX.find((x) => x.name === name)!;
      const svg = render(g.qs)!;
      expect(svg).toBe(readFileSync(`tests/fixtures/puzzle-image-lib/${name}.svg`, 'utf8'));
      // cross-oracle: identical to what the live page rendered BEFORE the extraction
      expect(normalize(svg))
        .toBe(normalize(readFileSync(`tests/fixtures/puzzle-image-golden/${name}.svg`, 'utf8')));
    });
  }
});

// ─── the spec's own mask (ImageSpec.stickerMask / .maskColor) ────────────

const spec = (p: Partial<ImageSpec>): ImageSpec => ({ ...DEFAULTS, ...p });
const grays = (svg: string, color = MASK_COLOR) => (svg.match(new RegExp(color, 'g')) ?? []).length;

describe('renderSpecSvg — stickerMask is wired to every pure renderer', () => {
  it('NxN iso: the mask rides the piece through the alg (via stickerColors)', () => {
    const corner = pieceOf('cube', 'U8', 3);                      // UFR, 3 stickers
    expect([...corner].sort()).toEqual(['F2', 'R0', 'U8']);
    const s = spec({ stickerMask: formatMask(corner) });
    // the iso view draws only the three visible faces (U/R/F) — solved, the whole
    // UFR corner is on screen
    expect(grays(renderSpecSvg(s)!)).toBe(3);
    // after the alg the piece moved to ULF, whose L sticker faces away: 2 of 3 are
    // still drawn. Piece conservation over ALL six faces is asserted on the net
    // below (and in puzzle-mask.test.ts).
    const moved = renderSpecSvg({ ...s, algorithm: "R U R' U'" })!;
    expect(grays(moved)).toBe(2);
    expect(moved).not.toBe(renderSpecSvg(s)!);
  });

  it('NxN net: every sticker of the piece survives the alg (all six faces drawn)', () => {
    const corner = pieceOf('cube', 'U24', 5);                     // 5x5 UFR corner
    expect(corner.length).toBe(3);
    const s = spec({ cubeSize: 5, cubeView: 'net', stickerMask: formatMask(corner) });
    expect(grays(renderSpecSvg(s)!)).toBe(3);
    expect(grays(renderSpecSvg({ ...s, algorithm: "R U R' F2 Rw U" })!)).toBe(3);
  });

  it('NxN: no mask ⇒ no stickerColors ⇒ byte-identical to the unmasked golden', () => {
    expect(renderSpecSvg(spec({ stickerMask: '' })))
      .toBe(readFileSync('tests/fixtures/puzzle-image-lib/cube-normal.svg', 'utf8'));
  });

  it('NxN: a stage mask WINS over a sticker mask on overlap', () => {
    // makeStickerColors order: stickerColors seeds → stage mask overwrites with
    // maskColor → the alg permutes. So an overlapping sticker takes the stage's
    // color, never the sticker mask's.
    const own = '#ff00ff';
    const shown = renderSpecSvg(spec({ stageMask: 'll', stickerMask: 'U:4', maskColor: own }))!;
    expect(grays(shown, own)).toBe(1);   // U center is KEPT by the LL stage → our color survives
    const eaten = renderSpecSvg(spec({ stageMask: 'll', stickerMask: 'F:4', maskColor: own }))!;
    expect(grays(eaten, own)).toBe(0);   // F center is masked BY the stage → stage wins
  });

  it("NxN: maskColor 'transparent' hides the sticker instead of graying it", () => {
    const plain = renderSpecSvg(spec({}))!;
    const hidden = renderSpecSvg(spec({ stickerMask: 'U:4', maskColor: 'transparent' }))!;
    expect(hidden).not.toContain('transparent');
    const count = (s: string) => (s.match(/<polygon/g) ?? []).length;
    expect(count(hidden)).toBe(count(plain) - 1);
  });

  it('tnoodle unfolded: cube net / pyraminx / skewb / megaminx all honour it', () => {
    const net = renderSpecSvg(spec({ cubeSize: 5, cubeView: 'net', stickerMask: 'U:0,1' }))!;
    expect(grays(net)).toBe(2);

    const pyra = renderSpecSvg(spec({
      puzzleType: 'pyraminx', puzzleVariant: 'wca', stickerMask: 'F:5;D:2',
    }))!;
    expect(grays(pyra)).toBe(2);

    const skewb = renderSpecSvg(spec({
      puzzleType: 'skewb', puzzleVariant: 'wca', stickerMask: 'U:1;R:3;B:2',
    }))!;
    expect(grays(skewb)).toBe(3);

    const mega = renderSpecSvg(spec({
      puzzleType: 'megaminx', puzzleVariant: 'wca', stickerMask: 'U:0,1',
    }))!;
    expect(grays(mega)).toBe(2);
  });

  it('tnoodle unfolded: the mask travels with the piece', () => {
    const edge = pieceOf('pyraminx', 'F5');                        // D2/F5
    const mask = { puzzleType: 'pyraminx' as const, puzzleVariant: 'wca' as const, stickerMask: 'D:2;F:5' };
    expect(edge).toEqual(['D2', 'F5']);
    const solved = renderSpecSvg(spec(mask))!;
    const turned = renderSpecSvg(spec({ ...mask, algorithm: 'L' }))!;
    expect(grays(solved)).toBe(2);
    expect(grays(turned)).toBe(2);
    expect(turned).not.toBe(solved);                               // it sits somewhere else now
  });
});

// ─── arrows DSL ──────────────────────────────────────────────────────────

describe('arrow entries', () => {
  it('builds a PHP-visualcube entry', () => {
    expect(buildArrowEntry({ face: 'U', from: 0, to: 2, cubeSize: 3 })).toBe('U0U2');
    expect(buildArrowEntry({
      face: 'U', from: 0, to: 2, pass: 4, scale: 10, influence: 5, color: '#ff0000', cubeSize: 3,
    })).toBe('U0U2U4-s10-i5-ff0000');
    expect(buildArrowEntry({ face: 'F', from: 0, to: 8, color: 'red', cubeSize: 3 })).toBe('F0F8-red');
  });

  it('drops out-of-face indices (the page treated that as a no-op)', () => {
    expect(buildArrowEntry({ face: 'U', from: 0, to: 9, cubeSize: 3 })).toBe('');
    expect(buildArrowEntry({ face: 'U', from: -1, to: 2, cubeSize: 3 })).toBe('');
    expect(buildArrowEntry({ face: 'U', from: 0, to: 9, cubeSize: 4 })).toBe('U0U9');
    // an out-of-face PASS is dropped, the arrow itself survives
    expect(buildArrowEntry({ face: 'U', from: 0, to: 2, pass: 99, cubeSize: 3 })).toBe('U0U2');
  });

  it('appends onto the arw string', () => {
    expect(appendArrow('', 'U0U2')).toBe('U0U2');
    expect(appendArrow('U0U2', 'U2U8')).toBe('U0U2,U2U8');
    expect(appendArrow('U0U2', '')).toBe('U0U2');   // empty entry = no-op
  });

  it('the arw string round-trips into the golden render', () => {
    const arw = appendArrow(
      buildArrowEntry({ face: 'U', from: 0, to: 2, cubeSize: 3 }),
      buildArrowEntry({ face: 'U', from: 2, to: 8, scale: 10, color: '#ff0000', cubeSize: 3 }),
    );
    expect(arw).toBe('U0U2,U2U8-s10-ff0000');       // exactly the cube-arrows fixture's arw=
    const svg = renderSpecSvg(spec({ algorithm: "R U R' U'", arrows: arw, defaultArrowColor: 'red' }))!;
    expect(svg).toBe(readFileSync('tests/fixtures/puzzle-image-lib/cube-arrows.svg', 'utf8'));
  });
});
