import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import type { AlgSticker } from '@cuberoot/shared';
import { validateAlgCase } from '@/lib/alg_validation';
import { displayAlg } from '@/lib/alg_display';

const FACE: AlgSticker = { kind: 'face', us: '', ub: '', uf: '', ul: '', ur: '' };
const inv = (a: string) => new Alg(a).invert().toString();

/** T-perm, standing in for "any last-layer alg" throughout. */
const BODY = "R U R' U' R' F R2 U' R' U' R U R' F'";

describe('the identity the leading-y rewrite rests on', () => {
  // y = U · Dw', and Dw commutes with any alg whose net element is a U-layer permutation
  // composed with a y-axis rotation. Hence  S·U^k·A·U^-k == (S·y^k·A)·y^-k  — the rewritten
  // alg reaches the SAME state, off by one whole-cube rotation. It needs no notion of what
  // "solved" means for the set, which is what makes it safe for OLL/COLL/CMLL/OLLCP too.
  it('U^k + unchanged body + U^-k == y^k + body, up to a whole-cube rotation', async () => {
    const solved = (await cube3x3x3.kpuzzle()).defaultPattern();
    const ROTS = ['', 'y', 'y2', "y'", 'x', "x'", 'x2', 'z', "z'"];
    const LL_ALGS = [
      "R U R' U R U2 R'", // Sune
      'M2 U M2 U2 M2 U M2', // H-perm — slices
      "r U R' U' r' F R F'", // OLL 45 — wide, net element still U-layer only
      "R U R' U' R' F R F' y", // net y rotation — commutes with Dw anyway, so still fine
      BODY,
    ];
    for (const [lead, pre, post] of [['y', 'U', "U'"], ['y2', 'U2', 'U2'], ["y'", "U'", 'U']] as const) {
      for (const body of LL_ALGS) {
        const orig = solved.applyAlg(new Alg(`${lead} ${body}`));
        const rewritten = solved.applyAlg(new Alg(`${pre} ${body} ${post}`));
        const witness = ROTS.find(r => (r ? rewritten.applyAlg(r) : rewritten).isIdentical(orig));
        expect(witness, `${lead} ${body}`).toBe(lead); // and the rotation is exactly y^k
      }
    }
  });

  it('fails exactly when the body carries a net x/z rotation', async () => {
    const solved = (await cube3x3x3.kpuzzle()).defaultPattern();
    // Aa-perm executed on the side — the x means "U" no longer names the layer the alg started on.
    const body = "x R' U R' D2 R U' R' D2 R2";
    const orig = solved.applyAlg(new Alg(`y' ${body}`));
    const rewritten = solved.applyAlg(new Alg(`U' ${body} U`));
    const ROTS: string[] = [];
    for (const a of ['', 'x', 'x2', "x'", 'z', "z'"]) for (const b of ['', 'y', 'y2', "y'"]) ROTS.push(`${a} ${b}`.trim());
    expect(ROTS.some(r => (r ? rewritten.applyAlg(r) : rewritten).isIdentical(orig))).toBe(false);
  });
});

describe('validateAlgCase — the stored alg carries its finishing AUF', () => {
  it.each([
    ['y', 'U', "U'"],
    ['y2', 'U2', 'U2'],
    ["y'", "U'", 'U'],
  ])('accepts the rewrite of a %s-led alg', async (lead, pre, post) => {
    const setup = inv(`${lead} ${BODY}`);
    expect(await validateAlgCase(setup, `${pre} ${BODY} ${post}`, FACE, '3x3')).toEqual({ ok: true });
  });

  it('rejects the rewrite with its finishing AUF dropped — it no longer solves', async () => {
    const r = await validateAlgCase(inv(`y ${BODY}`), `U ${BODY}`, FACE, '3x3');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('没有还原');
  });

  // The old rule ("any trailing U is a redundant AUF") made the only correct form of an
  // AUF-needing alg unstorable. It is gone for face sets — and provably not needed: a U turn
  // is not a whole-cube rotation, so `setup + A` and `setup + A + U` cannot both solve. Any
  // trailing U that survives the solve check is load-bearing by construction.
  it('accepts a trailing U that is load-bearing', async () => {
    expect(await validateAlgCase(inv(`${BODY} U`), `${BODY} U`, FACE, '3x3')).toEqual({ ok: true });
  });

  it('rejects a trailing U that is not, via the solve check', async () => {
    const r = await validateAlgCase(inv(BODY), `${BODY} U`, FACE, '3x3');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('没有还原');
  });

  it('still rejects an alg that no AUF can rescue', async () => {
    expect((await validateAlgCase(inv(BODY), "R U R' U'", FACE, '3x3')).ok).toBe(false);
  });

  // F2L is the mirror image: its goal ignores the last layer entirely, so a U turn can never
  // change the verdict — a trailing U there is always pure noise, and still gets rejected.
  it('still rejects a trailing AUF on an F2L alg, where it is always redundant', async () => {
    const F2L: AlgSticker = { kind: 'f2l', fl: '' };
    const pair = "U R U' R'";
    expect(await validateAlgCase(inv(pair), pair, F2L, '3x3')).toEqual({ ok: true });
    const r = await validateAlgCase(inv(pair), `${pair} U`, F2L, '3x3');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('多余的 AUF');
  });
});

describe('displayAlg', () => {
  it('hides the finishing AUF', () => {
    expect(displayAlg("U R U R' U' R' F R F' U'")).toBe("U R U R' U' R' F R F'");
    expect(displayAlg("R U R' U R U2 R' U2")).toBe("R U R' U R U2 R'");
    expect(displayAlg("F R U R' U' F' (U)")).toBe("F R U R' U' F'");
  });

  it('leaves an alg with no trailing AUF alone', () => {
    expect(displayAlg("R U R' U R U2 R'")).toBe("R U R' U R U2 R'");
    expect(displayAlg('M2 U M2 U2 M2 U M2')).toBe('M2 U M2 U2 M2 U M2');
    expect(displayAlg("R U R' U' R' F R F' y")).toBe("R U R' U' R' F R F' y");
  });

  it('does not mistake a wide U for an AUF', () => {
    expect(displayAlg("R U R' Uw")).toBe("R U R' Uw");
    expect(displayAlg("R U R' u")).toBe("R U R' u");
    expect(displayAlg("R U R' u'")).toBe("R U R' u'");
  });

  it('preserves everything before the AUF byte for byte', () => {
    // grip marks, parens and `=` markers must survive — this is a string op, not a re-parse.
    expect(displayAlg("=y2 R·U↑R' U'")).toBe("=y2 R·U↑R'");
    expect(displayAlg("(R U R') (U' R' F R F') U2")).toBe("(R U R') (U' R' F R F')");
  });

  it('never strips an alg down to nothing', () => {
    expect(displayAlg('U')).toBe('U');
    expect(displayAlg('')).toBe('');
  });
});
