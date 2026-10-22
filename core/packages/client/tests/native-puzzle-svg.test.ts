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
  { id: 'lattice', scramble: "DRF 2DFL 3DBR' DLBw 3UFRw' UBLv", facelets: 72 },
  { id: 'hyperx', scramble: "F U' 2DRF DFLw' R2 UFRv", facelets: 120 },
  { id: 'latticex', scramble: "F UFR 2DFL 3DBR' DLBw 3UFRw' Rv", facelets: 96 },
  { id: 'masterbrilic', scramble: "U 2F 3BL' 1-2R 1-3BR2' Dv", facelets: 360 },
  { id: 'masterftov2', scramble: "F 2U' 1-2BL Rv", facelets: 152 },
  { id: 'quadx', scramble: "UF 2FL' DRw UBv", facelets: 126 },
  { id: 'dinoocta', scramble: "F 2U' 1-2BL Rv", facelets: 80 },
  { id: 'fto5', scramble: "F 2U' 3L 1-2BL 1-3D' Rv", facelets: 200 },
  { id: 'eto', scramble: "FD 2FL' BLDw URv", facelets: 104 },
  { id: 'radiocrystal', scramble: "R 2L' Gw Uv", facelets: 300 },
  { id: 'cube3skewb', scramble: "F DRF 2U Lw' UFRv", facelets: 126 },
  { id: 'heliskewb', scramble: "DRF DF 2FL' DBw UFRv", facelets: 48 },
  { id: 'comboctahedron', scramble: "F B 2U 1-2BL D_BR_R_F 2D_F_L_BL 3U_L_F_R' 1-3U_B_BL_L D_BR_R_Fv", facelets: 72 },
  { id: 'circoradiolarian', scramble: "R 2L' Gw Uv", facelets: 300 },
  { id: 'radiojewel', scramble: "R 2L' Gw Uv [F, U] Rw'", facelets: 320 },
  { id: 'radioweb', scramble: "R 2L' Gw Uv [F, U] Rw'", facelets: 440 },
  { id: 'radiojam', scramble: "R 2L' Gw Uv [F, U] Rw'", facelets: 440 },
  { id: 'catscradle', scramble: "R 2L' Gw Uv [F, U] Rw'", facelets: 380 },
  { id: 'radiocanon', scramble: "R 2L' Gw Uv [F, U] Rw'", facelets: 320 },
  { id: 'icosababyface', scramble: "FREGU 2HIERC' FLACRw NALPOv", facelets: 20 },
  { id: 'cube2heli', scramble: "F DF 2DF' FLw U2 2UB' Fv DFv", facelets: 48 },
  { id: 'cube3heli', scramble: "F DF 2U' FLw Rw2 2UB' Fv DFv", facelets: 168 },
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
