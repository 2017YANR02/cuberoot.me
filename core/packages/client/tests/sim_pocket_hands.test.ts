import { describe, expect, it } from 'vitest';
import { invertPocketAlg, pocketKeyboardMove, pocketInvalidSpans } from '@/app/[lang]/sim/pocketMoves';
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
