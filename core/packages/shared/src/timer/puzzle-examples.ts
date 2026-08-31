import type { Scramble222WcaStateType } from './scramble-222';

/** [id, official scramble, optional optimal-equivalent scramble]. */
export type PuzzleExampleSample = [string, string, string?];

/** [competition, event, number, round, group, is-extra]. */
export type PuzzleExampleCompMeta = [string, string, number, string, string, (0 | 1)];

export type PuzzleCountryDist = Partial<Record<
  'bins' | 'binsAlt' | 'binsCubeshape',
  Record<string, Record<string, number>>
>>;

export interface PuzzleMetricExamples {
  bins: Record<string, PuzzleExampleSample[]>;
  countryDist?: Record<string, Record<string, number>>;
}

export interface PuzzleExamplesEntry {
  bins?: Record<string, PuzzleExampleSample[]>;
  binsAlt?: Record<string, PuzzleExampleSample[]>;
  binsCubeshape?: Record<string, PuzzleExampleSample[]>;
  metrics?: Record<string, PuzzleMetricExamples>;
  types?: Partial<Record<Scramble222WcaStateType, PuzzleExampleSample[]>>;
  comps: Record<string, [string, string]>;
  idMeta: Record<string, PuzzleExampleCompMeta>;
  countryDist?: PuzzleCountryDist;
}

export interface PuzzleExamplesJson {
  meta: { generated_at: string };
  puzzles: Record<string, PuzzleExamplesEntry>;
}

/** Shape/data refresh version shared by every consumer of the generated file. */
export const PUZZLE_EXAMPLES_VERSION = '20260821-222-types';

const successfulLoads = new WeakMap<typeof fetch, Map<string, PuzzleExamplesJson>>();

export interface PuzzleExamplesSource {
  /** Host-resolved URL to `/stats/scramble/puzzle_examples.json`. */
  url: string;
  fetcher?: typeof fetch;
}

export function puzzleExamplesVersionedUrl(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${PUZZLE_EXAMPLES_VERSION}`;
}

export async function fetchPuzzleExamples(
  source: PuzzleExamplesSource,
  signal?: AbortSignal,
): Promise<PuzzleExamplesJson> {
  const fetcher = source.fetcher ?? fetch;
  const response = await fetcher(
    puzzleExamplesVersionedUrl(source.url),
    { signal },
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<PuzzleExamplesJson>;
}

/** Cache only successful parsed snapshots, keyed by the injected transport. */
export async function loadPuzzleExamples(
  source: PuzzleExamplesSource,
  signal?: AbortSignal,
): Promise<PuzzleExamplesJson> {
  const fetcher = source.fetcher ?? fetch;
  const byUrl = successfulLoads.get(fetcher);
  const cached = byUrl?.get(source.url);
  if (cached) return cached;
  const loaded = await fetchPuzzleExamples(source, signal);
  const next = byUrl ?? new Map<string, PuzzleExamplesJson>();
  next.set(source.url, loaded);
  if (!byUrl) successfulLoads.set(fetcher, next);
  return loaded;
}
