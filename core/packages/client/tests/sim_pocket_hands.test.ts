import { describe, expect, it } from 'vitest';
import { invertPocketAlg, pocketKeyboardMove, pocketInvalidSpans } from '@/app/[lang]/sim/pocketMoves';
import { atlasCatalog } from '@/app/[lang]/sim/grips/catalog';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { TwistAction } from '@cuberoot/puzzle-render-core/engine/nxn/twister';
import { resolveCaps } from '@/app/[lang]/sim/simCaps';

describe('standard 2×2 hand playback', () => {
  it.each(["U'2", "U2'"])('uses the same signed half-turn for the end anchor of %s', halfTurn => {
    expect(invertPocketAlg(halfTurn)).toBe('U2');
    expect(invertPocketAlg("R" + halfTurn + "F'")).toBe("F U2 R'");
  });

  it('exposes the hands on standard two- through four-layer cubes', () => {
    for (const kind of [2, 3, 4] as const) expect(resolveCaps(kind, 'engine').supports.hands).toBe(true);
    for (const kind of [1, 5, 'mirror2'] as const) expect(resolveCaps(kind, 'engine').supports.hands).toBe(false);
  });

  it('preserves exact draft ranges and distinguishes moves from annotations and comments', () => {
    const draft = "R[R2:Q>M] [U,M2'] e S′ m2 s (R)3U // E\n3Rw 2-4R";
    const spans = pocketInvalidSpans(draft)!;
    expect(spans.map(span => span.text).join('')).toBe(draft);
    expect(spans.filter(span => span.bad).map(span => span.text)).toEqual(["M2'", 'e', 'S′', 'm2', 's', '3Rw', '2-4R']);
  });

  it('accepts pasted wide rotations but offers only faces and rotations as key bindings', () => {
    expect(pocketInvalidSpans("Rw Lw′ r u2 2Rw x y' z2 R2' (U R)3")).toBeNull();
    for (const sign of 'RLUDFBxyz') expect(pocketKeyboardMove(sign)).toBe(true);
    for (const sign of ['M', 'E', 'S', 'r', 'Rw']) expect(pocketKeyboardMove(sign)).toBe(false);
  });
});

it('resolves atlas aliases to the same signed physical layers at each size', () => {
  for (const order of [2, 3, 4] as const) {
    const catalog = atlasCatalog[order], cube = new Cube(order);
    try {
      const signature = (move: string) => cube.table.convert(new TwistAction(move))
        .map(({ group, twist }) => [group.axis, group.layer, twist].join('/')).sort().join(',');
      expect(new Set(catalog.moves.map(signature)).size).toBe(catalog.moves.length);
      expect(catalog.moves.length).toBe(order === 2 ? 36 : order === 3 ? 72 : 120);
      const aliases = order === 2 ? ["Fw2'", 'Uw', "Bw'2", '2Rw'] : ['r', 'Uw', "B'2", '2Rw'];
      if (order === 4) aliases.push('2R', '2-3R', '3u', "4Fw2'");
      for (const alias of aliases) {
        const canonical = catalog.resolve(alias);
        expect(canonical, alias).toBeTruthy();
        expect(signature(canonical!)).toBe(signature(alias));
      }
      for (const invalid of ['0R', '5Rw', 'xyz?', 'Mw']) expect(catalog.resolve(invalid)).toBeNull();
      if (order === 2) expect(catalog.resolve('M')).toBeNull();
    } finally { cube.dispose(); }
  }
});
