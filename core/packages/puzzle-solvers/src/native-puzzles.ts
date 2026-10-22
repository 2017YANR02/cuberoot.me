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
 * Quad-X, Dino Octa, 5-layer FTO, ETO and Radio Crystal use the same
 * reference's independent plane constructions and shape-preserving moves.
 * 3×3 + Skewb, Helicopter Skewb, Comboctahedron, Circo-Radiolarian and
 * Deep-Cut Icosahedron use the reference's full mixed-axis/deep-cut models.
 * 3×3 + Helicopter combines uniform third-depth face cuts with the planar
 * Helicopter cuts through adjacent face centers (Jaap's helicopter.htm).
 * Radio Jewel (Radiolarian 7): Jason Smith's original face-turning icosahedron,
 * with exact depth 5 - 2 sqrt(5), independently specified in Hyperspeedcube.
 * See the native-pg-puzzles reference for the sources and non-jumbling scope.
 * These are bounded random-move practice scrambles, not uniform random states.
 */
const CUBE_FACE_CORNER_AXES = [
  ['F', 'B'], ['D', 'U'], ['L', 'R'],
  ['DRF', 'UBL'], ['DFL', 'URB'], ['DBR', 'ULF'], ['DLB', 'UFR'],
] as const;

const CORNER_AXES = CUBE_FACE_CORNER_AXES.slice(3);
const CUBE_EDGE_AXES = [
  ['DF', 'UB'], ['FL', 'BR'], ['DB', 'UF'],
  ['DL', 'UR'], ['BL', 'FR'], ['UL', 'DR'],
] as const;
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
// Adding FTO face cuts activates FaceRenamingMapper for all Comboctahedron
// axes. Keep its canonical separators: raw BB becomes external B, and the
// drag adapter looks up the complete mapped family, not an unseparated alias.
const COMBOCTAHEDRON_AXES = [
  ...OCTAHEDRON_FACE_AXES,
  ['D_BR_R_F', 'U_B_BL_L'], ['D_F_L_BL', 'U_R_BR_B'], ['D_BL_B_BR', 'U_L_F_R'],
] as const;
const OCTAHEDRON_EDGE_AXES = [
  ['FD', 'UBB'], ['FL', 'BRBB'], ['BLD', 'UR'],
  ['FR', 'BLBB'], ['UL', 'BRD'], ['BLL', 'BRR'],
] as const;
const ICOSAHEDRON_FACE_AXES = [
  ['R', 'K'], ['L', 'S'], ['G', 'N'], ['U', 'D'], ['H', 'Q'],
  ['C', 'M'], ['I', 'P'], ['O', 'E'], ['F', 'B'], ['A', 'J'],
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
  quadx: {
    description: 'c e 0.47140452079103173', zh: 'Quad-X', en: 'Quad-X', textLabel: 'QuadX',
    axes: CUBE_EDGE_AXES, order: 2, layers: 2, scrambleLength: 60, aspect: 4 / 3, visibleFacelets: 126,
  },
  dinoocta: {
    description: 'o f 0.5', zh: '恐龙八面体', en: 'Dino Octa', textLabel: 'DinoOct',
    axes: OCTAHEDRON_FACE_AXES, order: 3, layers: 2, rangeWide: true,
    scrambleLength: 40, aspect: 4 / 3, visibleFacelets: 80,
  },
  fto5: {
    description: 'o f 0.2 f 0.6', zh: '五阶 FTO', en: '5-layer FTO', textLabel: 'FTO5',
    axes: OCTAHEDRON_FACE_AXES, order: 3, layers: 3, rangeWide: true,
    scrambleLength: 60, aspect: 4 / 3, visibleFacelets: 200,
  },
  fto6: {
    description: 'o f 0 f 0.3333333333333333 f 0.6666666666666666', zh: '六阶 FTO', en: '6-layer FTO', textLabel: 'FTO6',
    axes: OCTAHEDRON_FACE_AXES, order: 3, layers: 3, rangeWide: true,
    scrambleLength: 72, aspect: 4 / 3, visibleFacelets: 288,
  },
  eto: {
    description: 'o e 0.6123724356957945', zh: 'ETO 棱转八面体', en: "Eitan's ETO", textLabel: 'ETO',
    axes: OCTAHEDRON_EDGE_AXES, order: 2, layers: 2, scrambleLength: 60, aspect: 4 / 3, visibleFacelets: 104,
  },
  radiocrystal: {
    description: 'i f 0.3333333333333333', zh: 'Radio Crystal', en: 'Radio Crystal', textLabel: 'RadioCr',
    axes: ICOSAHEDRON_FACE_AXES, order: 3, layers: 2, scrambleLength: 60, aspect: 8 / 5, visibleFacelets: 300,
  },
  cube3skewb: {
    description: 'c f 0.333333333333333 v 0', zh: '三阶＋斜转', en: '3×3 + Skewb', textLabel: '3Skewb',
    axes: CUBE_FACE_CORNER_AXES, order: 0, axisOrders: [4, 4, 4, 3, 3, 3, 3],
    layers: 2, axisLayers: [2, 2, 2, 1, 1, 1, 1],
    scrambleLength: 40, aspect: 4 / 3, visibleFacelets: 126,
  },
  heliskewb: {
    description: 'c v 0 e 0.7071067811865476', zh: '直升机斜转', en: 'Helicopter Skewb', textLabel: 'HeliSk',
    axes: [...CORNER_AXES, ...CUBE_EDGE_AXES], order: 0, axisOrders: [3, 3, 3, 3, 2, 2, 2, 2, 2, 2],
    layers: 2, axisLayers: [1, 1, 1, 1, 2, 2, 2, 2, 2, 2],
    scrambleLength: 60, aspect: 4 / 3, visibleFacelets: 48,
  },
  comboctahedron: {
    description: 'o f 0.333333333333333 v 0.5773502691896258 v 1.1547005383792517', zh: 'Comboctahedron', en: 'Comboctahedron', textLabel: 'Combo',
    axes: COMBOCTAHEDRON_AXES, order: 0, axisOrders: [3, 3, 3, 3, 4, 4, 4],
    layers: 3, axisLayers: [2, 2, 2, 2, 3, 3, 3], rangeWide: true,
    scrambleLength: 60, aspect: 4 / 3, visibleFacelets: 72,
  },
  circoradiolarian: {
    description: 'i f 0.7453559924999299', zh: 'Circo-Radiolarian', en: 'Circo-Radiolarian', textLabel: 'Circo',
    axes: ICOSAHEDRON_FACE_AXES, order: 3, layers: 2, scrambleLength: 60, aspect: 8 / 5, visibleFacelets: 300,
  },
  icosababyface: {
    description: 'i v 0.562777422255239', zh: '深切角转二十面体', en: 'Deep-Cut Icosahedron', textLabel: 'Icosa',
    axes: DOGIC_AXES, order: 5, layers: 2, scrambleLength: 40, aspect: 8 / 5, visibleFacelets: 20,
  },
  // A planar 2x2 / Helicopter combination, not a curved retail reproduction.
  // Central face cuts add legal half-cube turns without new visible seams.
  cube2heli: {
    description: 'c f 0 e 0.7071067811865476',
    zh: '二阶＋直升机', en: '2×2 + Helicopter', textLabel: '2Heli',
    axes: [...CUBE_FACE_CORNER_AXES.slice(0, 3), ...CUBE_EDGE_AXES], order: 0,
    axisOrders: [4, 4, 4, 2, 2, 2, 2, 2, 2],
    layers: 2, axisLayers: [1, 1, 1, 2, 2, 2, 2, 2, 2],
    scrambleLength: 40, aspect: 4 / 3, visibleFacelets: 48,
  },
  cube3heli: {
    description: 'c f 0.333333333333333 e 0.7071067811865476', zh: '三阶＋直升机', en: '3×3 + Helicopter', textLabel: '3Heli',
    axes: [...CUBE_FACE_CORNER_AXES.slice(0, 3), ...CUBE_EDGE_AXES],
    order: 0, axisOrders: [4, 4, 4, 2, 2, 2, 2, 2, 2],
    layers: 2, scrambleLength: 60, aspect: 4 / 3, visibleFacelets: 168,
  },
  radiojewel: {
    description: 'i f 0.5278640450004204', zh: 'Radio Jewel', en: 'Radio Jewel', textLabel: 'Jewel',
    axes: ICOSAHEDRON_FACE_AXES, order: 3, layers: 2,
    scrambleLength: 60, aspect: 8 / 5, visibleFacelets: 320,
  },
  // Jason Smith's Radiolarian 6. Hyperspeedcube radio06 uses 5 - 2 sqrt(5) + 0.02;
  // unlike Radio Jewel, the wings remain visible. See references/radio-web.md.
  radioweb: {
    description: 'i f 0.5478640450004204', zh: 'Radio Web', en: 'Radio Web', textLabel: 'Web',
    axes: ICOSAHEDRON_FACE_AXES, order: 3, layers: 2,
    scrambleLength: 60, aspect: 8 / 5, visibleFacelets: 440,
  },
  // Jason Smith's Radiolarian 5; Hyperspeedcube radio05 uses phi^2/(2+phi^2).
  // Preserve this critical depth: nearby cuts have a different face partition.
  catscradle: {
    description: 'i f 0.566915270681799', zh: 'Cat’s Cradle', en: 'Cat’s Cradle', textLabel: 'Cradle',
    axes: ICOSAHEDRON_FACE_AXES, order: 3, layers: 2,
    scrambleLength: 60, aspect: 8 / 5, visibleFacelets: 380,
  },
  // Jason Smith's fixed-center Radiolarian 1.5; Hyperspeedcube radio01_5
  // uses h = 0.77. Keep the twenty face centers and standard non-jumbling turns.
  radiocanon: {
    description: 'i f 0.77', zh: 'Radio Canon', en: 'Radio Canon', textLabel: 'Canon',
    axes: ICOSAHEDRON_FACE_AXES, order: 3, layers: 2,
    scrambleLength: 60, aspect: 8 / 5, visibleFacelets: 320,
  },
  // Radio Jam (Radiolarian 8): Hyperspeedcube radio08 uses radio7 - 0.06.
  // The unused radio8 constant in that source is NOT this model's cut depth.
  radiojam: {
    description: 'i f 0.4678640450004204', zh: 'Radio Jam', en: 'Radio Jam', textLabel: 'Jam',
    axes: ICOSAHEDRON_FACE_AXES, order: 3, layers: 2,
    scrambleLength: 60, aspect: 8 / 5, visibleFacelets: 440,
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

function axisTurnOrder(spec: NativePuzzleSpec, axis: number): number {
  if ('axisOrders' in spec) return spec.axisOrders[axis];
  // Preserve the original face/corner convention for existing mixed cubes.
  return spec.order === 0 ? axis < 3 ? 4 : 3 : spec.order;
}

/** Cycle the distinct mechanisms in catalog order, independently of axis count. */
function scrambleAxisGroups(spec: NativePuzzleSpec): number[][] {
  const groups = new Map<number, number[]>();
  spec.axes.forEach((_, axis) => {
    const order = axisTurnOrder(spec, axis);
    const group = groups.get(order);
    if (group) group.push(axis);
    else groups.set(order, [axis]);
  });
  return [...groups.values()];
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
    const order = axisTurnOrder(spec, axis);
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
  const axisGroups = scrambleAxisGroups(spec);
  let previousAxis = -1;
  for (let i = 0; i < spec.scrambleLength; i++) {
    // Alternate mechanism classes so even an extreme deterministic source exercises
    // both cuts. Choose uniformly among axes in each class, then half and power.
    const candidates = axisGroups[i % axisGroups.length].filter((axis) => axis !== previousAxis);
    const axis = candidates[pick(candidates.length)];
    const family = spec.axes[axis][pick(2)];
    // Cycle every supported cut depth within each mechanism class. Hybrid cubes
    // can have only two face halves but three/five corner layers; never offer a
    // face-wide move there. Existing one/two-depth puzzles retain their sequence.
    const layer = 1 + Math.floor(i / axisGroups.length) % axisLayerCount(spec, axis);
    const move = layer === 1 ? family : wideMove(spec, family, layer);
    const order = axisTurnOrder(spec, axis);
    // Half-turn axes retain both animation directions but never a 360° identity.
    const suffixes = order === 2 || order === 3 ? ['', "'"] : order === 4 ? ['', '2', "'"] : ['', '2', "2'", "'"];
    out.push(move + suffixes[pick(suffixes.length)]);
    previousAxis = axis;
  }
  return out.join(' ');
}
