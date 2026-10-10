import { describe, expect, it } from 'vitest';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { NATIVE_PUZZLES } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle, parseNativePuzzleAlg } from '@cuberoot/puzzle-solvers/native-puzzle-model';
import { renderNativePuzzleSvg } from '@cuberoot/puzzle-render-core/native-puzzle-svg';

const CASES = [
  { id: 'superz', scramble: "F DRF R' UBL D2 UFR' L DFL' B2 URB", facelets: 48 },
  { id: 'cube3dino', scramble: "F DRF Rw' 2UBL D2 UFRw' 2L DFL' Bv URB", facelets: 96 },
  { id: 'dogic', scramble: "FREGU HIERCw' 2FLACR FREGUv", facelets: 80 },
  { id: 'octahedron4', scramble: "DBRRF DFLBLw' 2DBLBBBR DBRRFv", facelets: 32 },
  { id: 'dinoskewb', scramble: "DRF DFLw' 2DBR DRFv", facelets: 72 },
] as const;

describe.each(CASES)('$id canonical SVG and native 3D sticker correspondence', ({ id, scramble, facelets }) => {
  it('renders every physical sticker once with the native pattern color, including twisted single-sticker centers', () => {
    const pg = getPuzzleGeometryByDesc(NATIVE_PUZZLES[id].description, {
      allMoves: true, orientCenters: true, addRotations: true,
    });
    // Independently read the 3D surface's sticker identities and colors. Its
    // duplicate center orientations supply colors but are not physical polygons.
    const nativeStickers = pg.get3d().stickers;
    const visibleIds = nativeStickers.filter((sticker) => !sticker.isDup)
      .map((sticker) => `${sticker.orbit}-${sticker.ord}-${sticker.ori}`);
    const colors = new Map(nativeStickers.map((sticker) => [
      `${sticker.orbit}-${sticker.ord}-${sticker.ori}`, sticker.color,
    ]));
    const puzzle = nativePuzzleKPuzzle(id);
    const alg = parseNativePuzzleAlg(id, scramble);
    const pattern = puzzle.defaultPattern().applyAlg(alg).patternData;
    const svg = renderNativePuzzleSvg(id, scramble);
    const polygons = [...svg.matchAll(/<polygon data-face="[^"]+" data-piece="([A-Z0-9_]+)-(\d+)-(\d+)" points="[^"]+" fill="([^"]+)"\/>/g)];
    expect(polygons).toHaveLength(facelets);
    expect(polygons.map(([, orbit, piece, orientation]) => `${orbit}-${piece}-${orientation}`).sort())
      .toEqual(visibleIds.sort());
    for (const [, orbit, piece, orientation, fill] of polygons) {
      const state = pattern[orbit];
      const source = state.pieces[Number(piece)];
      const orientationCount = puzzle.definition.orbits.find((entry) => entry.orbitName === orbit)!.numOrientations;
      const sourceOrientation = (Number(orientation) - state.orientation[Number(piece)] + orientationCount) % orientationCount;
      const nativeColor = colors.get(`${orbit}-${source}-${sourceOrientation}`);
      expect(nativeColor, `${id} source ${orbit}-${source}-${sourceOrientation}`).toBeDefined();
      expect(fill, `${id} destination ${orbit}-${piece}-${orientation}`).toBe(nativeColor);
    }
    const solved = renderNativePuzzleSvg(id, '');
    expect(svg).not.toBe(solved);
    expect(renderNativePuzzleSvg(id, `${alg.toString()}\n${alg.invert().toString()}`)).toBe(solved);
  });
});
