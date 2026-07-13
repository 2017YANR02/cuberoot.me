import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  pieceGroups, pieceOf, expandToPieces,
  toSrMask, maskKey, maskSupported, srMaskSupported,
} from '@/lib/puzzle-image/puzzle-mask';
import {
  parseMask, formatMask, MASK_COLOR, toRenderMask,
} from '@/lib/puzzle-image/mask-core';
import { renderPyraScrambleSvg, PYRA_DEFAULT_COLORS } from '@/app/[lang]/scramble/gen/_svg/pyraminx_svg';
import { renderSkewbScrambleSvg, SKEWB_DEFAULT_COLORS } from '@/app/[lang]/scramble/gen/_svg/skewb_svg';
import { renderMegaScrambleSvg, DEFAULT_MEGA_COLORS } from '@/app/[lang]/scramble/gen/_svg/mega_svg';
import { renderUnfoldedSvg } from '@/app/[lang]/scramble/gen/_svg/cube_unfolded_svg';
import { invertAlg } from '@/lib/cube3';
import { PyraminxSimulator } from 'sr-puzzlegen/dist/lib/simulator/pyraminx/pyraminxSimulator';
import * as D from './_puzzle_mask_derive';

const CUBE_SIZES = [2, 3, 4, 5, 6, 7];

// ─── DSL ─────────────────────────────────────────────────────────────────

describe('mask DSL', () => {
  it('parses faces, lists and ranges', () => {
    expect([...parseMask('U:0,2;F:3-5')].sort()).toEqual(['F3', 'F4', 'F5', 'U0', 'U2']);
    expect(parseMask('').size).toBe(0);
    expect([...parseMask(' DBR : 10 ')]).toEqual(['DBR10']);
  });

  it('formats sorted + range-collapsed (runs of 3+)', () => {
    expect(formatMask(['F5', 'U2', 'F3', 'U0', 'F4'])).toBe('F:3-5;U:0,2');
    expect(formatMask(['U1', 'U0'])).toBe('U:0,1');
    expect(formatMask([])).toBe('');
  });

  it('round-trips', () => {
    for (const s of ['U:0,2;F:3-5', 'B:0-8', 'DBR:10;U:0', 'D:1,3,5,7', 'L:0-2,4,6-8']) {
      expect(formatMask(parseMask(s))).toBe(formatMask(parseMask(formatMask(parseMask(s)))));
      expect([...parseMask(formatMask(parseMask(s)))].sort()).toEqual([...parseMask(s)].sort());
    }
  });

  it('collapses only runs of 3 or more', () => {
    expect(formatMask(parseMask('U:0-1'))).toBe('U:0,1');
    expect(formatMask(parseMask('U:0-2'))).toBe('U:0-2');
  });
});

// ─── derived table locks ─────────────────────────────────────────────────

describe('piece groups', () => {
  const perms: Record<string, D.PuzzlePerms> = {
    pyraminx: D.pyraPerms(), skewb: D.skewbPerms(), megaminx: D.megaPerms(),
  };
  for (const N of CUBE_SIZES) perms[`cube${N}`] = D.cubePerms(N);

  const fixture = JSON.parse(
    readFileSync('lib/puzzle-image/data/piece-groups.json', 'utf8'),
  ) as Record<string, string[][]>;

  // The shipped table (lib/puzzle-image/data) is the thing under lock: re-derive
  // it from the renderers on every run and compare. Never hand-edit the JSON.
  it('re-derives byte-for-byte from the renderers (shipped-table lock)', () => {
    const derived: Record<string, string[][]> = {};
    for (const [k, p] of Object.entries(perms)) derived[k] = D.derivePieceGroups(p);
    expect(derived).toEqual(fixture);
  });

  it('is closed under every generator (a move maps a piece to a piece)', () => {
    for (const [k, p] of Object.entries(perms)) {
      expect(D.pieceGroupsClosed(p, fixture[k]), k).toBe(true);
    }
  });

  it('matches each puzzle real piece count', () => {
    // pyraminx 4 tips + 4 axials + 6 edges; skewb 6 centers + 8 corners;
    // megaminx 12 centers + 30 edges + 20 corners; NxN corners/edges/centers.
    expect(pieceGroups('pyraminx').length).toBe(14);
    expect(pieceGroups('skewb').length).toBe(14);
    expect(pieceGroups('megaminx').length).toBe(62);
    expect(pieceGroups('cube', 2).length).toBe(8);
    expect(pieceGroups('cube', 3).length).toBe(26);
    expect(pieceGroups('cube', 4).length).toBe(56);
    expect(pieceGroups('cube', 5).length).toBe(98);
    expect(pieceGroups('cube', 7).length).toBe(218);
  });

  it('covers every sticker exactly once', () => {
    const counts: Record<string, number> = {
      pyraminx: 36, skewb: 30, megaminx: 132,
      ...Object.fromEntries(CUBE_SIZES.map((N) => [`cube${N}`, 6 * N * N])),
    };
    for (const [k, n] of Object.entries(counts)) {
      const flat = fixture[k].flat();
      expect(flat.length, k).toBe(n);
      expect(new Set(flat).size, k).toBe(n);
    }
  });

  it('pieceOf / expandToPieces expand a sticker to its whole piece', () => {
    // skewb's notation leaves one corner (3 stickers) untouched by R/U/L/B — it is
    // still one piece, not three centers.
    expect(pieceOf('skewb', 'U3')).toEqual(['F1', 'L2', 'U3']);
    expect(pieceOf('skewb', 'U0')).toEqual(['U0']);   // center
    expect([...expandToPieces('cube', ['U0'], 3)].sort()).toEqual(pieceOf('cube', 'U0', 3));
    expect(pieceOf('cube', 'U0', 3).length).toBe(3);  // a corner
  });
});

describe('sr index map', () => {
  const fixture = JSON.parse(
    readFileSync('lib/puzzle-image/data/sr-index-map.json', 'utf8'),
  ) as Record<string, Record<string, [string, number]>>;

  it('re-derives from the two libraries permutations, and is UNIQUE', () => {
    const pyra = D.deriveSrMap(D.pyraPerms(), D.srPyraPerms(),
      { U: 'U', L: 'L', R: 'R', B: 'B', u: 'u', l: 'l', r: 'r', b: 'b' });
    expect(pyra).not.toBeNull();
    expect(pyra!.solutions).toBe(1);
    expect(pyra!.map).toEqual(fixture.pyraminx);

    const skewb = D.deriveSrMap(D.skewbPerms(), D.srSkewbPerms(), { R: 'R', U: 'U', L: 'L', B: 'B' });
    expect(skewb).not.toBeNull();
    expect(skewb!.solutions).toBe(1);
    expect(skewb!.map).toEqual(fixture.skewb);

    // megaminx face names differ between the libraries; the generator map is
    // derived from the adjacency graph anchored at U/F, and only the non-mirror
    // candidate can conjugate a clockwise turn to a clockwise turn.
    const mc = D.megaPerms(); const ms = D.srMegaPerms();
    const solved = D.deriveMegaGenMap(mc, ms)
      .map((gm) => D.deriveSrMap(mc, ms, gm))
      .filter((r) => r !== null);
    expect(solved.length).toBe(1);
    expect(solved[0]!.solutions).toBe(1);
    expect(solved[0]!.map).toEqual(fixture.megaminx);
  });

  it('is a bijection onto sr sticker slots', () => {
    for (const [k, table] of Object.entries(fixture)) {
      const slots = Object.values(table).map(([f, i]) => `${f}#${i}`);
      expect(new Set(slots).size, k).toBe(slots.length);
    }
  });

  it('toSrMask groups canonical ids by sr face', () => {
    // pyraminx canonical face F is sr face `left` (sr names its own frame).
    expect(toSrMask('pyraminx', ['F0', 'F1'])).toEqual({ left: [6, 8] });
    expect(toSrMask('sq1', ['U0'])).toBeUndefined();
    expect(toSrMask('cube', ['U0'])).toBeUndefined();
  });

  it('end-to-end: sr grays the SAME piece our net does, after the same alg', () => {
    // Replays exactly what <PuzzleSVG> hands sr (mask via toSrMask, then alg) and
    // drives sr's own simulator — which is what its renderer paints from. The masked
    // slots must land on φ(canonical masked slots), i.e. the same physical piece.
    const piece = pieceOf('pyraminx', 'F5');                 // the D2/F5 edge
    const alg = "R U' L B R' l r b";
    const sim = new PyraminxSimulator();
    const srMask = toSrMask('pyraminx', piece)!;
    for (const [face, idx] of Object.entries(srMask)) {
      for (const i of idx) sim.setValue(face, i, 'mask');    // sr's applyMask()
    }
    sim.alg(alg);                                            // sr's applyAlgorithm(), in that order
    const vals = sim.getValues() as Record<string, string[]>;
    const grayedSr = new Set<string>();
    for (const [face, arr] of Object.entries(vals)) {
      arr.forEach((v, i) => { if (v === 'mask') grayedSr.add(`${face}#${i}`); });
    }
    // where OUR renderer put the gray, mapped into sr's slots
    const ours = ['D8', 'L8'];                               // from the net test above
    const expectedSr = new Set(ours.map((sid) => {
      const [f, i] = fixture.pyraminx[sid];
      return `${f}#${i}`;
    }));
    expect(grayedSr).toEqual(expectedSr);
  });
});

// ─── capability gates ────────────────────────────────────────────────────

describe('capabilities', () => {
  it('gates sq1 off', () => {
    expect(maskSupported('sq1')).toBe(false);
    expect(srMaskSupported('sq1')).toBe(false);
    for (const p of ['pyraminx', 'skewb', 'megaminx'] as const) {
      expect(maskSupported(p)).toBe(true);
    }
    expect(srMaskSupported('cube')).toBe(false); // PuzzleSVG never renders NxN through sr
  });

  it('tells the truth about which cube sizes really have a table', () => {
    for (const N of CUBE_SIZES) expect(maskSupported('cube', N), `cube${N}`).toBe(true);
    for (const N of [1, 8, 9, 10]) expect(maskSupported('cube', N), `cube${N}`).toBe(false);
    expect(maskKey('cube', 3)).toBe('cube3');
    expect(maskKey('cube', 8)).toBeNull();
    expect(maskKey('cube')).toBeNull();            // no default N — an unstated size is unknown
    expect(maskKey('sq1')).toBeNull();
  });

  it('fails loudly instead of degrading to a one-sticker piece', () => {
    // the old default (cubeSize = 3) made a 4x4 id resolve to a lone sticker
    expect(() => pieceOf('cube', 'U12', 3)).toThrow(/not on cube3/);
    expect(() => pieceOf('cube', 'U0', 8)).toThrow(/no derived piece table/);
    expect(() => pieceGroups('cube', 8)).toThrow(/no derived piece table/);
    expect(() => expandToPieces('cube', ['U0'], 8)).toThrow(/no derived piece table/);
    expect(() => pieceOf('sq1', 'U0', 3)).toThrow(/no derived piece table/);
    // ...and the 4x4 id resolves correctly once the size is stated
    expect(pieceOf('cube', 'U12', 4).length).toBe(3);
  });
});

// ─── renderers: additive + piece semantics ───────────────────────────────

describe('renderer masking', () => {
  const SCRAMBLE_PYRA = "R U' L B R' l r b";

  it('no-mask output is byte-identical to the pre-mask golden', () => {
    // fixtures/puzzle-image-golden/* are byte-exact snapshots of what /visualcube
    // rendered BEFORE this change (see scripts/verify_puzzle_image_golden.cjs).
    // They were captured as DOM innerHTML, which expands `<path/>` to `<path></path>`
    // — the only difference from the raw renderer string. Normalise that, and the
    // bytes must match exactly: proof the state-model swap (color index → sticker
    // id) plus the new optional params are purely additive.
    const golden = (name: string) => readFileSync(`tests/fixtures/puzzle-image-golden/${name}.svg`, 'utf8')
      .replace(/><\/(path|rect)>/g, '/>');
    // /visualcube passes `case`, which the page inverts before rendering.
    expect(renderPyraScrambleSvg(invertAlg("U R' L R B'"), PYRA_DEFAULT_COLORS)).toBe(golden('pyra-wca'));
    expect(renderSkewbScrambleSvg(invertAlg("R U L' B"), SKEWB_DEFAULT_COLORS)).toBe(golden('skewb-wca'));
    expect(renderUnfoldedSvg(5, '')).toBe(golden('cube-net-5'));
  });

  it('an empty mask changes nothing', () => {
    const plain = renderPyraScrambleSvg(SCRAMBLE_PYRA, PYRA_DEFAULT_COLORS);
    expect(renderPyraScrambleSvg(SCRAMBLE_PYRA, PYRA_DEFAULT_COLORS, {})).toBe(plain);
    expect(renderPyraScrambleSvg(SCRAMBLE_PYRA, PYRA_DEFAULT_COLORS, {
      mask: { ids: new Set<string>(), color: MASK_COLOR },
    })).toBe(plain);
    expect(toRenderMask('')).toBeUndefined();
  });

  it('stickerIds only appear when asked for', () => {
    expect(renderPyraScrambleSvg(SCRAMBLE_PYRA, PYRA_DEFAULT_COLORS)).not.toContain('data-sid');
    const withIds = renderPyraScrambleSvg('', PYRA_DEFAULT_COLORS, { stickerIds: true });
    expect(withIds).toContain('data-sid="F0"');
    expect(withIds).toContain('data-sid="R8"');
    expect((withIds.match(/data-sid=/g) ?? []).length).toBe(36);
  });

  /** Masked sticker POSITIONS in the rendered net (via the data-sid annotation). */
  const pyraMaskedAt = (piece: string[], scramble: string): string[] => {
    const mask = { ids: new Set(piece), color: MASK_COLOR };
    const svg = renderPyraScrambleSvg(scramble, PYRA_DEFAULT_COLORS, { mask, stickerIds: true });
    return [...svg.matchAll(/fill="([^"]+)" data-sid="([^"]+)"/g)]
      .filter((m) => m[1] === MASK_COLOR).map((m) => m[2]).sort();
  };

  it('pyraminx: the mask follows the PIECE through the scramble', () => {
    const edge = pieceOf('pyraminx', 'F5');            // the F/D edge, 2 stickers
    expect(edge).toEqual(['D2', 'F5']);
    const mask = { ids: new Set(edge), color: MASK_COLOR };

    const solved = renderPyraScrambleSvg('', PYRA_DEFAULT_COLORS, { mask });
    const scrambled = renderPyraScrambleSvg(SCRAMBLE_PYRA, PYRA_DEFAULT_COLORS, { mask });
    const count = (s: string) => (s.match(/#404040/g) ?? []).length;

    // same number of gray stickers before and after — the piece is carried, not repainted
    expect(count(solved)).toBe(2);
    expect(count(scrambled)).toBe(2);
    expect(scrambled).not.toBe(solved);                // ...and it sits somewhere else

    expect(pyraMaskedAt(edge, '')).toEqual(['D2', 'F5']);        // at home
    expect(pyraMaskedAt(edge, 'L')).toEqual(['D8', 'L8']);       // L carries it away
    expect(pyraMaskedAt(edge, SCRAMBLE_PYRA)).toEqual(['D8', 'L8']);
    // the landing slots are exactly ONE whole piece, not two halves of two pieces
    expect(pieceOf('pyraminx', 'D8')).toEqual(['D8', 'L8']);

    // a tip and an axial only ever twist in place — no move relocates them
    expect(pyraMaskedAt(pieceOf('pyraminx', 'F0'), SCRAMBLE_PYRA)).toEqual(['F0', 'L3', 'R0']);
    expect(pyraMaskedAt(pieceOf('pyraminx', 'F1'), SCRAMBLE_PYRA)).toEqual(['F1', 'L4', 'R1']);
  });

  it('pyraminx: rendered SVG baseline for one concrete masked case', () => {
    // Byte baseline — mask the D2/F5 edge, then turn L (which relocates it to D8/L8).
    // Changing the renderer or the mask semantics must change this file, on purpose,
    // as the review signal.
    const mask = { ids: new Set(pieceOf('pyraminx', 'F5')), color: MASK_COLOR };
    const svg = renderPyraScrambleSvg('L', PYRA_DEFAULT_COLORS, { mask });
    expect(svg).toBe(readFileSync('tests/fixtures/puzzle-mask/pyra-edge-D2F5-L.svg', 'utf8'));
  });

  it('cube net: the mask follows the piece', () => {
    const piece = pieceOf('cube', 'U8', 3);            // a corner
    expect(piece.length).toBe(3);
    const mask = { ids: new Set(piece), color: MASK_COLOR };
    const grayCount = (s: string) => (s.match(/#404040/g) ?? []).length;
    expect(grayCount(renderUnfoldedSvg(3, '', { mask }))).toBe(3);
    expect(grayCount(renderUnfoldedSvg(3, "R U R' U' F2 L D", { mask }))).toBe(3);

    const at = (scramble: string) => [...renderUnfoldedSvg(3, scramble, { mask, stickerIds: true })
      .matchAll(/fill="([^"]+)" data-sid="([^"]+)"/g)]
      .filter((m) => m[1] === '#404040').map((m) => m[2]).sort();
    expect(at('')).toEqual(['F2', 'R0', 'U8']);        // the UFR corner
    expect(at('R')).toEqual(['B0', 'R2', 'U2']);       // R sends it to UBR
    expect(pieceOf('cube', 'U2', 3)).toEqual(['B0', 'R2', 'U2']);
  });

  it('skewb / megaminx: the mask follows the piece', () => {
    const sk = { ids: new Set(pieceOf('skewb', 'U1')), color: MASK_COLOR };
    const gray = (s: string) => (s.match(/#404040/g) ?? []).length;
    expect(gray(renderSkewbScrambleSvg('', SKEWB_DEFAULT_COLORS, { mask: sk }))).toBe(3);
    expect(gray(renderSkewbScrambleSvg("R U L' B R'", SKEWB_DEFAULT_COLORS, { mask: sk }))).toBe(3);

    const mg = { ids: new Set(pieceOf('megaminx', 'U0')), color: MASK_COLOR };
    expect(pieceOf('megaminx', 'U0').length).toBe(3);
    expect(gray(renderMegaScrambleSvg('', DEFAULT_MEGA_COLORS, { mask: mg }))).toBe(3);
    expect(gray(renderMegaScrambleSvg("R++ D-- U R-- D++ U'", DEFAULT_MEGA_COLORS, { mask: mg }))).toBe(3);
  });
});
