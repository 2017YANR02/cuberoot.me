/**
 * Seeded PRNG for the sync-seed feature.
 *
 * Two users with the same seed string + the same scramble counter must get
 * identical scrambles. We hash the seed string with FNV-1a → 32-bit uint, mix
 * in the per-call counter, and feed it to xorshift32. Pure JS, no deps.
 */

/** FNV-1a 32-bit hash of an arbitrary string. */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Xorshift32 PRNG. Returns a function producing floats in [0, 1).
 * Seed 0 is forbidden (would degenerate); we substitute 1.
 */
export function xorshift32(seed: number): () => number {
  let x = (seed >>> 0) || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return x / 4294967296;
  };
}

/**
 * Build an RNG for `seed` at the given scramble index. Same (seed, idx) always
 * yields the same number stream. We mix counter into the seed via another FNV
 * step so consecutive scrambles aren't trivially related.
 */
export function rngFor(seed: string, counter: number): () => number {
  const base = fnv1a32(seed);
  // Mix counter: derive a 32-bit value from the counter and combine.
  const ctrHash = fnv1a32(`#${counter}`);
  const combined = (base ^ Math.imul(ctrHash, 0x01000193)) >>> 0;
  return xorshift32(combined);
}
