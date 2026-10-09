/**
 * Native PG puzzles shared by /sim, /scramble/gen and Timer.
 * SuperZ, Dogic and the deep-cut 4×4 octahedron descriptions:
 * https://github.com/cubing/cubing.js/issues/127
 * Original Dino Skewb: https://www.tomvanderzanden.nl/puzzle.php?puz=Dino+Skewb
 * Its two vertex cut depths are the existing Dino and Skewb planes combined.
 * These are bounded random-move practice scrambles, not uniform random states.
 */
const SUPERZ_AXES = [
  ['F', 'B'], ['D', 'U'], ['L', 'R'],
  ['DRF', 'UBL'], ['DFL', 'URB'], ['DBR', 'ULF'], ['DLB', 'UFR'],
] as const;

const CORNER_AXES = SUPERZ_AXES.slice(3);
const DOGIC_AXES = [
  ['FREGU', 'OKBDN'], ['HIERC', 'MKOPQ'], ['FLACR', 'BKMJS'],
  ['NALPO', 'JGEIS'], ['FUQPL', 'IHDBS'], ['UGJMQ', 'DHCAN'],
] as const;
const OCTAHEDRON_AXES = [
  ['DBRRF', 'UBBBLL'], ['DFLBL', 'URBRBB'], ['DBLBBBR', 'ULFR'],
] as const;

export const NATIVE_PUZZLES = {
  superz: {
    description: 'c f 0 v 0', zh: '二阶＋斜转', en: 'SuperZ (2×2 + Skewb)', textLabel: 'SuperZ',
    axes: SUPERZ_AXES, order: 0, layers: 1, scrambleLength: 40, aspect: 4 / 3, visibleFacelets: 48,
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
} as const;

export type NativePuzzleId = keyof typeof NATIVE_PUZZLES;
export const NATIVE_PUZZLE_IDS = Object.keys(NATIVE_PUZZLES) as NativePuzzleId[];

export function isNativePuzzleId(id: unknown): id is NativePuzzleId {
  return typeof id === 'string' && Object.hasOwn(NATIVE_PUZZLES, id);
}

/** Legal outer/wide choices with native names; used by manual controls as well. */
export function nativePuzzleMoves(id: NativePuzzleId): { move: string; label: string; order: number }[] {
  const spec = NATIVE_PUZZLES[id];
  return spec.axes.flatMap((pair, axis) => pair.flatMap((family) => {
    const order = id === 'superz' ? axis < 3 ? 4 : 3 : spec.order;
    const moves = spec.layers === 1 ? [family] : [family, `2${family}`, `${family}w`];
    return moves.map((move) => ({ move, label: move, order }));
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
  let previousAxis = -1;
  for (let i = 0; i < spec.scrambleLength; i++) {
    // Alternate mechanism classes so even an extreme deterministic source exercises
    // both cuts. Choose uniformly among axes in each class, then half and power.
    const faceTurn = id === 'superz' && i % 2 === 0;
    const axisCount = id === 'superz' ? faceTurn ? 3 : 4 : spec.axes.length;
    const candidates = Array.from({ length: axisCount }, (_, j) => j + (id === 'superz' && !faceTurn ? 3 : 0))
      .filter((axis) => axis !== previousAxis);
    const axis = candidates[pick(candidates.length)];
    const family = spec.axes[axis][pick(2)];
    // Alternate the shallow and deep cuts. A wide move turns both layers together;
    // single inner slices remain available for manual algorithms and dragging.
    const move = spec.layers > 1 && i % 2 === 1 ? `${family}w` : family;
    const order = id === 'superz' ? faceTurn ? 4 : 3 : spec.order;
    const suffixes = order === 3 ? ['', "'"] : order === 4 ? ['', '2', "'"] : ['', '2', "2'", "'"];
    out.push(move + suffixes[pick(suffixes.length)]);
    previousAxis = axis;
  }
  return out.join(' ');
}
