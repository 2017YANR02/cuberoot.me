/**
 * Native PG puzzles shared by /sim, /scramble/gen and Timer.
 * SuperZ, Dogic and the deep-cut 4×4 octahedron descriptions:
 * https://github.com/cubing/cubing.js/issues/127
 * Original Dino Skewb: https://www.tomvanderzanden.nl/puzzle.php?puz=Dino+Skewb
 * Its two vertex cut depths are the existing Dino and Skewb planes combined.
 * 3x3 + Dino: https://www.tomvanderzanden.nl/puzzle.php?puz=3x3x3+Dino+Cube
 * Combines the uniform 3x3 face cuts with Dino's face diagonals.
 * Lattice, Hyper X, Lattice X, Master Brilic and Master FTO v2 sources and
 * independently checked idealized cuts: sim-add-puzzle/references/native-pg-puzzles.md.
 * These are bounded random-move practice scrambles, not uniform random states.
 */
const CUBE_FACE_CORNER_AXES = [
  ['F', 'B'], ['D', 'U'], ['L', 'R'],
  ['DRF', 'UBL'], ['DFL', 'URB'], ['DBR', 'ULF'], ['DLB', 'UFR'],
] as const;

const CORNER_AXES = CUBE_FACE_CORNER_AXES.slice(3);
const DOGIC_AXES = [
  ['FREGU', 'OKBDN'], ['HIERC', 'MKOPQ'], ['FLACR', 'BKMJS'],
  ['NALPO', 'JGEIS'], ['FUQPL', 'IHDBS'], ['UGJMQ', 'DHCAN'],
] as const;
const OCTAHEDRON_AXES = [
  ['DBRRF', 'UBBBLL'], ['DFLBL', 'URBRBB'], ['DBLBBBR', 'ULFR'],
] as const;
const OCTAHEDRON_FACE_AXES = [
  ['F', 'B'], ['D', 'U'], ['L', 'BR'], ['BL', 'R'],
] as const;
const DODECAHEDRON_FACE_AXES = [
  ['U', 'D'], ['F', 'B'], ['L', 'DR'], ['BL', 'FR'], ['BR', 'FL'], ['R', 'DL'],
] as const;

export const NATIVE_PUZZLES = {
  superz: {
    description: 'c f 0 v 0', zh: '二阶＋斜转', en: 'SuperZ (2×2 + Skewb)', textLabel: 'SuperZ',
    axes: CUBE_FACE_CORNER_AXES, order: 0, layers: 1, scrambleLength: 40, aspect: 4 / 3, visibleFacelets: 48,
  },
  cube3dino: {
    description: 'c f 0.333333333333333 v 0.577350269189626', zh: '三阶＋恐龙', en: '3×3 + Dino', textLabel: '3Dino',
    axes: CUBE_FACE_CORNER_AXES, order: 0, layers: 2, scrambleLength: 40, aspect: 4 / 3, visibleFacelets: 96,
  },
  dogic: {
    description: 'i v 0.562777422255239 v 0.9105929973100289', zh: 'Dogic 二十面体', en: 'Dogic', textLabel: 'Dogic',
    axes: DOGIC_AXES, order: 5, layers: 2, scrambleLength: 60, aspect: 8 / 5, visibleFacelets: 80,
  },
  octahedron4: {
    description: 'o v 0 v 0.86602540378', zh: '四阶八面体', en: '4×4 Octahedron', textLabel: 'Octa4',
    axes: OCTAHEDRON_AXES, order: 4, layers: 2, scrambleLength: 40, aspect: 8 / 5, visibleFacelets: 32,
  },
  dinoskewb: {
    description: 'c v 0 v 0.577350269189626', zh: '恐龙斜转', en: 'Dino Skewb', textLabel: 'DinoSk',
    axes: CORNER_AXES, order: 3, layers: 2, scrambleLength: 40, aspect: 4 / 3, visibleFacelets: 72,
  },
  lattice: {
    description: 'c v 0.577350269189626 v 1.154700538379252', zh: 'Lattice', en: 'Lattice Cube', textLabel: 'Lat',
    axes: CORNER_AXES, order: 3, layers: 3, scrambleLength: 60, aspect: 4 / 3, visibleFacelets: 72,
  },
  hyperx: {
    description: 'c f 0 v 0.275', zh: 'Hyper X', en: 'Hyper X', textLabel: 'HyperX',
    axes: CUBE_FACE_CORNER_AXES, order: 0, layers: 2, axisLayers: [1, 1, 1, 2, 2, 2, 2],
    scrambleLength: 40, aspect: 4 / 3, visibleFacelets: 120,
  },
  latticex: {
    description: 'c f 0 v 0.577350269189626 v 1.154700538379252', zh: 'Lattice X', en: 'Lattice X', textLabel: 'LatX',
    axes: CUBE_FACE_CORNER_AXES, order: 0, layers: 3, axisLayers: [1, 1, 1, 3, 3, 3, 3],
    scrambleLength: 60, aspect: 4 / 3, visibleFacelets: 96,
  },
  masterbrilic: {
    description: 'd f 0.447213595499989 f 0.7888543819998317', zh: 'Master Brilic', en: 'Master Brilic', textLabel: 'MBrilic',
    axes: DODECAHEDRON_FACE_AXES, order: 5, layers: 3, rangeWide: true,
    scrambleLength: 60, aspect: 8 / 5, visibleFacelets: 360,
  },
  masterftov2: {
    description: 'o f 0 f 0.4', zh: '四阶 FTO v2', en: 'Master FTO v2', textLabel: 'FTOv2',
    axes: OCTAHEDRON_FACE_AXES, order: 3, layers: 2, rangeWide: true,
    scrambleLength: 40, aspect: 4 / 3, visibleFacelets: 152,
  },
} as const;

export type NativePuzzleId = keyof typeof NATIVE_PUZZLES;
export const NATIVE_PUZZLE_IDS = Object.keys(NATIVE_PUZZLES) as NativePuzzleId[];

export function isNativePuzzleId(id: unknown): id is NativePuzzleId {
  return typeof id === 'string' && Object.hasOwn(NATIVE_PUZZLES, id);
}

export type NativePuzzleMoveDepth = 'outer' | 'inner' | 'inner3' | 'wide' | 'wide3';
type NativePuzzleSpec = typeof NATIVE_PUZZLES[NativePuzzleId];

function axisLayerCount(spec: NativePuzzleSpec, axis: number): number {
  return 'axisLayers' in spec ? spec.axisLayers[axis] : spec.layers;
}

function wideMove(spec: NativePuzzleSpec, family: string, layers: number): string {
  // FaceRenamingMapper accepts explicit ranges for FTO/dodecahedral faces,
  // while a suffixed w is not a valid external family on those native models.
  return 'rangeWide' in spec ? `1-${layers}${family}` : `${layers === 2 ? '' : layers}${family}w`;
}

/** Independent single slices and wide choices, with their physical axis/depth. */
export function nativePuzzleMoves(id: NativePuzzleId): {
  move: string; label: string; family: string; order: number; depth: NativePuzzleMoveDepth;
}[] {
  const spec = NATIVE_PUZZLES[id];
  return spec.axes.flatMap((pair, axis) => pair.flatMap((family) => {
    // order 0 denotes this cube's face (first three axes) + corner mechanisms.
    const order = spec.order === 0 ? axis < 3 ? 4 : 3 : spec.order;
    const choices: { move: string; depth: NativePuzzleMoveDepth }[] = [{ move: family, depth: 'outer' }];
    const layers = axisLayerCount(spec, axis);
    for (let layer = 2; layer <= layers; layer++) {
      choices.push({ move: `${layer}${family}`, depth: layer === 2 ? 'inner' : 'inner3' });
      choices.push({ move: wideMove(spec, family, layer), depth: layer === 2 ? 'wide' : 'wide3' });
    }
    return choices.map(({ move, depth }) => ({ move, label: move, family, order, depth }));
  }));
}

export function generateNativePuzzleScramble(id: NativePuzzleId, random: () => number = Math.random): string {
  const spec = NATIVE_PUZZLES[id];
  const pick = (size: number): number => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('Random source must return a number in [0, 1)');
    return Math.floor(value * size);
  };
  const out: string[] = [];
  const mixedOrder = spec.order === 0;
  let previousAxis = -1;
  for (let i = 0; i < spec.scrambleLength; i++) {
    // Alternate mechanism classes so even an extreme deterministic source exercises
    // both cuts. Choose uniformly among axes in each class, then half and power.
    const faceTurn = mixedOrder && i % 2 === 0;
    const axisCount = mixedOrder ? faceTurn ? 3 : 4 : spec.axes.length;
    const candidates = Array.from({ length: axisCount }, (_, j) => j + (mixedOrder && !faceTurn ? 3 : 0))
      .filter((axis) => axis !== previousAxis);
    const axis = candidates[pick(candidates.length)];
    const family = spec.axes[axis][pick(2)];
    // Cycle every supported cut depth within each mechanism class. Hybrid cubes
    // can have only two face halves but three/five corner layers; never offer a
    // face-wide move there. Existing one/two-depth puzzles retain their sequence.
    const layer = 1 + (mixedOrder ? Math.floor(i / 2) : i) % axisLayerCount(spec, axis);
    const move = layer === 1 ? family : wideMove(spec, family, layer);
    const order = mixedOrder ? faceTurn ? 4 : 3 : spec.order;
    const suffixes = order === 3 ? ['', "'"] : order === 4 ? ['', '2', "'"] : ['', '2', "2'", "'"];
    out.push(move + suffixes[pick(suffixes.length)]);
    previousAxis = axis;
  }
  return out.join(' ');
}
