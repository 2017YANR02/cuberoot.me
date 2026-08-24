import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderPuzzleIsoSvg, type IsoSvgPuzzle } from '@cuberoot/puzzle-render-core/iso-svg';

const CLIENT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMPATIBILITY_SHIMS = [
  'app/[lang]/sim/engine/CornerTurnCube.ts',
  'app/[lang]/sim/engine/MoveHistory.ts',
  'app/[lang]/sim/engine/TweenTwister.ts',
  'app/[lang]/sim/engine/cornerNotation.ts',
  'app/[lang]/sim/engine/define.ts',
  'app/[lang]/sim/engine/mega/MegaminxCube.ts',
  'app/[lang]/sim/engine/mega/MegaminxTwister.ts',
  'app/[lang]/sim/engine/mega/megaGeometry.ts',
  'app/[lang]/sim/engine/mega/megaState.ts',
  'app/[lang]/sim/engine/pieceAnim.ts',
  'app/[lang]/sim/engine/polytopeCut.ts',
  'app/[lang]/sim/engine/pyra/PyraCube.ts',
  'app/[lang]/sim/engine/pyra/PyraTwister.ts',
  'app/[lang]/sim/engine/pyra/pyraGeometry.ts',
  'app/[lang]/sim/engine/pyra/pyraState.ts',
  'app/[lang]/sim/engine/skewb/SkewbCube.ts',
  'app/[lang]/sim/engine/skewb/SkewbTwister.ts',
  'app/[lang]/sim/engine/skewb/skewbGeometry.ts',
  'app/[lang]/sim/engine/skewb/skewbState.ts',
  'app/[lang]/sim/engine/sq1/Sq1Cube.ts',
  'app/[lang]/sim/engine/sq1/Sq1Twister.ts',
  'app/[lang]/sim/engine/sq1/sq1Colors.ts',
  'app/[lang]/sim/engine/sq1/sq1Geometry.ts',
  'app/[lang]/sim/engine/sq1/sq1State.ts',
  'app/[lang]/sim/engine/stickerGeom.ts',
  'app/[lang]/sim/engine/tweenTiming.ts',
  'app/[lang]/sim/engine/tweener.ts',
  'app/[lang]/sim/sim_svg_export_bsp.ts',
  'app/[lang]/sim/sim_svg_export_schematic.ts',
  'lib/cube-colors.ts',
  'lib/puzzle-geometry/colors.ts',
  'lib/puzzle-image/engine-svg.ts',
  'lib/sim_timing.ts',
  'lib/sq1-stage-mask.ts',
] as const;

const CASES: ReadonlyArray<readonly [IsoSvgPuzzle, string]> = [
  ['sq1', '(1,0)/'],
  ['megaminx', 'R U'],
  ['pyraminx', 'R U'],
  ['skewb', 'R U'],
];

describe('puzzle-render-core Node SVG boundary', () => {
  it('keeps the Client component as an adapter to the canonical renderer', () => {
    const source = readFileSync(join(CLIENT_ROOT, 'components/EnginePuzzleSVG.tsx'), 'utf8');

    expect(source).toContain("import('@cuberoot/puzzle-render-core/iso-svg')");
    expect(source).toContain('return render(kind, forward, undefined, size);');
    expect(source).not.toContain("import('@/app/[lang]/sim/engine/world')");
    expect(source).not.toContain('twister.setup');
    expect(source).not.toContain('exportSimSvgSchematic');
  });

  it('keeps legacy Client locations as re-export-only compatibility shims', () => {
    for (const relativePath of COMPATIBILITY_SHIMS) {
      const lines = readFileSync(join(CLIENT_ROOT, relativePath), 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      expect(lines.length, relativePath).toBeLessThanOrEqual(2);
      expect(lines.every((line) => /^export (?:\*|\{ default \}) from '@cuberoot\/puzzle-render-core\//.test(line)), relativePath)
        .toBe(true);
      expect(lines.join('\n'), relativePath).not.toContain('/client/');
    }
  });

  it.each(CASES)('renders solved and moved %s states without browser globals', (puzzle, alg) => {
    expect(globalThis.document).toBeUndefined();
    const solved = renderPuzzleIsoSvg(puzzle, '', undefined, 128);
    const moved = renderPuzzleIsoSvg(puzzle, alg, undefined, 128);

    expect(solved).toMatch(/^<svg\b/);
    expect(moved).toMatch(/^<svg\b/);
    expect(moved).not.toBe(solved);
  });

  it.each(CASES)('resets cached %s state and view rotation between renders', (puzzle, alg) => {
    const first = renderPuzzleIsoSvg(puzzle, '', undefined, 160);
    const rotated = renderPuzzleIsoSvg(puzzle, alg, 'x:25,y:-30', 160);
    const second = renderPuzzleIsoSvg(puzzle, '', undefined, 160);

    expect(rotated).not.toBe(first);
    expect(second).toBe(first);
  });

  it('rejects invalid viewport sizes', () => {
    expect(renderPuzzleIsoSvg('sq1', '', undefined, 0)).toBeNull();
    expect(renderPuzzleIsoSvg('sq1', '', undefined, Number.NaN)).toBeNull();
  });
});
