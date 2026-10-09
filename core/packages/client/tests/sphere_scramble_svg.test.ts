import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { CUBE_FILL } from '@cuberoot/puzzle-render-core/support/cube-colors';
import { renderCubeNetSvg } from '@cuberoot/puzzle-render-core/support/cube-net-svg';
import { renderUnfoldedSvgForEvent } from '@cuberoot/shared/cube-unfolded-svg';

const require = createRequire(import.meta.url);

afterEach(() => vi.unstubAllGlobals());

/** The /sim setup path is independent of the public renderer's instant turns. */
function simulatorNet(scramble: string): string {
  const cube = new Cube(3, 'sphere');
  try {
    cube.twister.setup(scramble);
    return renderCubeNetSvg({ serialized: cube.serialize(), order: 3, faceColors: CUBE_FILL });
  } finally { cube.dispose(); }
}

describe('shared sphere scramble SVG', () => {
  it('imports and renders without requesting an animation frame or browser globals', async () => {
    const raf = vi.fn(() => { throw new Error('static SVG must not start an animation loop'); });
    vi.stubGlobal('requestAnimationFrame', raf);
    expect(globalThis.document).toBeUndefined();
    // Next app-ssr consumes the Node entry too. A flattened worker URL here
    // points into dist/ and made real pages fail to compile with HTTP 500.
    const nodeBundle = readFileSync(require.resolve('@cuberoot/puzzle-render-core/sphere-svg'), 'utf8');
    expect(nodeBundle).not.toMatch(/new URL\([^)]*setup\.worker/);
    const { renderSphereScrambleSvg } = await import('@cuberoot/puzzle-render-core/sphere-svg');
    expect(renderSphereScrambleSvg('')).toMatch(/^<svg\b[^>]*viewBox="0 0 13 9.8"/);
    expect(renderSphereScrambleSvg('R U2')?.match(/<rect\b/g)).toHaveLength(54);
    expect(raf).not.toHaveBeenCalled();
  });

  it('matches the existing 3x3 net for all six faces and a full scramble', async () => {
    const { renderSphereScrambleSvg } = await import('@cuberoot/puzzle-render-core/sphere-svg');
    for (const scramble of ['', 'R', "L'", 'B2', 'D', 'U', 'F', "R U R' F2 D L2 U' B R2 F' U2"]) {
      expect(renderSphereScrambleSvg(scramble), scramble).toBe(renderUnfoldedSvgForEvent('333', scramble));
    }
  });

  it.each([
    "R U R' F2 D L2 U' B R2 F' U2",
    "M E' S2 r u' f2 l d2 b' x y' z2",
    "Rw Uw' Fw2 Dw' Lw Bw2 2R 3L 2-3U 2-3d 3Rw2 2Lw' m e2 s'",
  ])('unfolds the actual simulator state without dropping supported moves: %s', async (scramble) => {
    const { renderSphereScrambleSvg } = await import('@cuberoot/puzzle-render-core/sphere-svg');
    expect(renderSphereScrambleSvg(scramble)).toBe(simulatorNet(scramble));
  });

  it('keeps solved input, comments, full turns and state resets exact', async () => {
    const { renderSphereScrambleSvg } = await import('@cuberoot/puzzle-render-core/sphere-svg');
    const solved = renderSphereScrambleSvg('');
    expect(renderSphereScrambleSvg("R U R' U'")).not.toBe(solved);
    expect(renderSphereScrambleSvg(' \n // solved')).toBe(solved);
    expect(renderSphereScrambleSvg('R4 U8 x4')).toBe(solved);
    expect(renderSphereScrambleSvg("R U // F is a comment\nR’")).toBe(renderSphereScrambleSvg("R U R'"));
    expect(renderSphereScrambleSvg('')).toBe(solved);
  });

  it('rejects the entire input when a token or layer is unsupported', async () => {
    const { renderSphereScrambleSvg } = await import('@cuberoot/puzzle-render-core/sphere-svg');
    for (const scramble of ['R potato U', 'R++', '4Rw', '0R', '3-2R', '2M', 'xw', "R''", '[R,U]', '(R U', 'R999999999999999999999']) {
      expect(renderSphereScrambleSvg(scramble), scramble).toBeNull();
    }
  });
});
