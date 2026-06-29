// Regression for the first-stage cross autofill (recon_first_stage).
//
// The bug: the autofill read the inspection bottom colour off a cubing.js
// KPattern, but cubing.js composes whole-cube rotations with the OPPOSITE
// convention to the cube renderer + Rust cross engine (which share cross-solver's
// ROT_FACE_PERM tables). For an x-tilted inspection like `x z`, the renderer
// shows RED on the bottom (D), yet cubing.js computed green/orange — so the
// autofill suggested a wrong-colour cross (and carried a stray z'/x' prefix).
//
// The fix routes bottom-colour detection through cross-solver's `bottomColorIdx`
// (render/engine convention). This locks the exact regression: same scramble,
// six inspection rotations, including #23 (`z`) and #24 (`x z`).
//
// Home colour codes: 0=White 1=Red 2=Green 3=Orange 4=Blue 5=Yellow.
import { describe, it, expect } from 'vitest';
import { bottomColorIdx } from '@/lib/cross-solver';

// The two disputed reconstructions share this scramble; only inspection differs.
const SCRAMBLE = "B' U' D2 F' U' B L' B L' F2 U R2 B2 U F2 R2 D' R'";

describe('first-stage autofill bottom colour (render/engine convention)', () => {
  it.each([
    ['(no inspection)', '', 5], // yellow stays on D
    ['z   — #23 works', 'z', 1], // red
    ['x z — #24 was broken (cubing.js read green/orange)', 'x z', 1], // red
    ['x', 'x', 4], // blue
    ["x'", "x'", 2], // green
    ['x2', 'x2', 0], // white
  ])('inspection %s → bottom colour %i', (_label, insp, expected) => {
    const eff = `${SCRAMBLE} ${insp}`.trim();
    expect(bottomColorIdx(eff)).toBe(expected);
  });

  // bottomColorIdx tracks orientation from rotations/wide moves only, so face
  // turns must not change the bottom colour — a bare inspection gives the same.
  it('ignores face turns: bottom colour depends only on rotation tokens', () => {
    expect(bottomColorIdx('x z')).toBe(bottomColorIdx(`${SCRAMBLE} x z`));
  });
});
