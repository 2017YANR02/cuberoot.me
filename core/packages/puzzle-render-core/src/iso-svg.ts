import { canonicalSq1Alg } from '@cuberoot/shared/sq1-notation';
import { parseViewRotations } from '@cuberoot/shared/sr-rotations';
import { HeadlessWorld, type HeadlessPuzzleKind } from './headless-world';
import { exportSimSvgSchematic, hasSchematicFacelets } from './schematic';
import { sizeEngineSvg } from './support/engine-svg';

export type IsoSvgPuzzle = HeadlessPuzzleKind;

const worlds = new Map<IsoSvgPuzzle, HeadlessWorld>();

function worldFor(puzzle: IsoSvgPuzzle): HeadlessWorld {
  let world = worlds.get(puzzle);
  if (!world) {
    world = new HeadlessWorld(puzzle);
    worlds.set(puzzle, world);
  }
  return world;
}

/** Render a four-puzzle engine state as a self-sized SVG without browser globals. */
export function renderPuzzleIsoSvg(
  puzzle: IsoSvgPuzzle,
  alg: string,
  rotationsParam: string | undefined,
  size: number,
): string | null {
  if (!Number.isFinite(size) || size < 1) return null;
  const viewport = Math.round(size);
  const world = worldFor(puzzle);

  world.scene.rotation.set(Math.PI / 6, -Math.PI / 4 + Math.PI / 16, 0);
  for (const rotation of parseViewRotations(rotationsParam).slice(0, 2)) {
    const radians = (rotation.angle * Math.PI) / 180;
    if (rotation.axis === 'x') world.scene.rotation.x += radians;
    else if (rotation.axis === 'y') world.scene.rotation.y += radians;
    else world.scene.rotation.z += radians;
  }
  world.scene.updateMatrix();
  world.width = viewport;
  world.height = viewport;
  world.resize();

  const trimmed = (alg ?? '').trim();
  const normalized = puzzle === 'sq1' && trimmed ? canonicalSq1Alg(trimmed) : trimmed;
  world.cube.twister.setup(normalized);
  world.cube.twister.finish();
  world.scene.updateMatrixWorld(true);

  if (!hasSchematicFacelets(world.scene)) return null;
  return sizeEngineSvg(exportSimSvgSchematic({
    world,
    inset: 0.15,
    bodyColor: '#000000',
    bodyOpacity: 100,
    stickerOpacity: 100,
  }), viewport);
}
