// Data contract for the precomputed scramble optimal / near-optimal length
// distributions served from stats/scramble/dist_<event>.json (produced by
// scramble-stats-build/src/build_puzzle_sampled_dist.ts).
//
// Previously copy-pasted verbatim into ~18 *DistView components; single source
// now. Changing the shape means bumping the per-view cache-busting `V` and the
// builder together.

export interface DistJson {
  event: string;
  label: string;
  sampleCount: number;
  scrambleLen: number;
  quality: string;
  histogram: Record<string, number>; // length -> count (sum === sampleCount)
  mean: number;
  median: number;
  min: number;
  max: number;
  maxBound?: number;
  optimalCount?: number;
  stateCountStr?: string;
  groupOrderStr?: string;
  generatedSamples: { length: number; scramble: string; optimal: boolean }[];
  generated_at: string;
}
