// Stats for scramble optimal / near-optimal length distributions.
// Extracted from the ~11 inline `function stats(counts)` copies that lived in
// the scramble/stats *DistView components — single source now.

export interface DistStats {
  mean: number;
  median: number;
  mode: number;
  min: number;
  max: number;
}

/**
 * Recompute mean / median / mode from a `{length: count}` histogram.
 * Used by the JS-baked family, whose distribution ships in the solver module.
 */
export function computeStats(counts: Record<string, number>): DistStats | null {
  const entries = Object.entries(counts)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return null;
  let total = 0, sum = 0, mode = entries[0][0], modeN = 0;
  for (const [x, v] of entries) { total += v; sum += x * v; if (v > modeN) { modeN = v; mode = x; } }
  const pct = (p: number) => {
    const t = total * p; let c = 0;
    for (const [x, v] of entries) { c += v; if (c >= t) return x; }
    return entries[entries.length - 1][0];
  };
  return {
    mean: total > 0 ? sum / total : 0,
    median: pct(0.5),
    mode,
    min: entries[0][0],
    max: entries[entries.length - 1][0],
  };
}

/**
 * Just the mode of a histogram, with a fallback for the empty case. The
 * JSON-fetched family takes authoritative mean / median from the precomputed
 * JSON and only needs the mode computed locally.
 */
export function modeOf(counts: Record<string, number>, fallback: number): number {
  let mode = fallback, modeN = 0;
  for (const [len, n] of Object.entries(counts)) if (n > modeN) { modeN = n; mode = Number(len); }
  return mode;
}
