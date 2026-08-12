const FACES = ['U', 'D', 'L', 'R', 'F', 'B'] as const;
const SUFFIXES = ['', "'", '2'] as const;

const AXIS: Record<(typeof FACES)[number], number> = {
  U: 0,
  D: 0,
  L: 1,
  R: 1,
  F: 2,
  B: 2,
};

function randomIndex(length: number, rng: () => number): number {
  const value = rng();
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return length - 1;
  return Math.floor(value * length);
}

/**
 * Generates the lightweight 20-move 3x3 scramble used by CubeRoot's timer.
 *
 * The candidate set is filtered before sampling, so even a deterministic or
 * stuck RNG cannot emit the same face twice or three moves on one axis.
 */
export function scramble333(rng: () => number): string {
  const moves: string[] = [];
  let lastFace: (typeof FACES)[number] | undefined;
  let previousAxisFace: (typeof FACES)[number] | undefined;

  for (let index = 0; index < 20; index++) {
    const candidates = FACES.filter((face) => (
      face !== lastFace
      && !(lastFace !== undefined && AXIS[face] === AXIS[lastFace] && face === previousAxisFace)
    ));
    const face = candidates[randomIndex(candidates.length, rng)];
    const suffix = SUFFIXES[randomIndex(SUFFIXES.length, rng)];
    moves.push(`${face}${suffix}`);
    previousAxisFace = lastFace !== undefined && AXIS[face] === AXIS[lastFace]
      ? lastFace
      : undefined;
    lastFace = face;
  }

  return moves.join(' ');
}
