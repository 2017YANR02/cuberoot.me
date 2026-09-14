/** Values emitted by the Rust stage solver when a face cannot be solved. */
export const DAISY_UNAVAILABLE_FACE = 0xffffffff;

/**
 * The Rust solver's face order is D/U/L/R/F/B. The LBL lesson intentionally
 * renders yellow on top and white on the bottom (`yogwrb`), so index 0 (the
 * solver's D→U target) is the conventional white-petals-around-yellow daisy
 * in this lesson's viewing orientation.
 */
export const DAISY_WHITE_AROUND_YELLOW_FACE = 0;

/** Keep the lesson usable when the random-state worker cannot initialize. */
export function resolveDaisyScramble(primary: string | null | undefined, fallback: string): string {
  return primary?.trim() || fallback.trim();
}

/** Choose the shortest usable daisy orientation returned by the stage solver. */
export function selectBestDaisyFace(scores: readonly (number | null | undefined)[]): number | null {
  let bestFace: number | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  scores.forEach((score, face) => {
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score >= DAISY_UNAVAILABLE_FACE) return;
    if (score < bestScore) {
      bestScore = score;
      bestFace = face;
    }
  });
  return bestFace;
}

/** Keep the guided lesson on the conventional white daisy, even if another colour is shorter. */
export function selectWhiteDaisyFace(scores: readonly (number | null | undefined)[]): number | null {
  const score = scores[DAISY_WHITE_AROUND_YELLOW_FACE];
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score >= DAISY_UNAVAILABLE_FACE) return null;
  return DAISY_WHITE_AROUND_YELLOW_FACE;
}

/**
 * The daisy solver may prefix a solution with whole-cube rotations that select
 * the most convenient view. Fold those rotations into the setup so the lesson
 * starts from the solver's working orientation and only animates face turns.
 */
export function buildDaisyPlayback(scramble: string, solution: string): { setup: string; alg: string; displayAlg: string } {
  const setupBase = scramble.trim();
  const displayAlg = solution.trim().split(/\s+/).filter(Boolean).join(' ');
  const tokens = displayAlg.split(/\s+/).filter(Boolean);
  let split = 0;
  while (split < tokens.length && /^[xyz][2']?$/.test(tokens[split])) split++;
  const leadingRotations = tokens.slice(0, split).join(' ');
  const body = tokens.slice(split).join(' ');
  return {
    setup: [setupBase, leadingRotations].filter(Boolean).join(' '),
    alg: body || displayAlg,
    displayAlg,
  };
}
