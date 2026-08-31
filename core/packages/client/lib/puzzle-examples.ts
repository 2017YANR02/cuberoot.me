// Compatibility entry point for Web callers. The generated-data contract and
// fetch version are shared with Capacitor so rare 2x2 true-scramble buckets
// cannot drift between hosts.
import {
  fetchPuzzleExamples as fetchSharedPuzzleExamples,
  loadPuzzleExamples as loadSharedPuzzleExamples,
} from '@cuberoot/shared/timer';
import { statsUrl } from '@/lib/stats-base';

const source = (fetcher: typeof fetch) => ({
  fetcher,
  url: statsUrl('/stats/scramble/puzzle_examples.json'),
});

export function fetchPuzzleExamples(
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
) {
  return fetchSharedPuzzleExamples(source(fetcher), signal);
}

export function loadPuzzleExamples(
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
) {
  return loadSharedPuzzleExamples(source(fetcher), signal);
}

export {
  PUZZLE_EXAMPLES_VERSION,
  type PuzzleCountryDist,
  type PuzzleExampleCompMeta,
  type PuzzleExampleSample,
  type PuzzleExamplesEntry,
  type PuzzleExamplesJson,
  type PuzzleMetricExamples,
} from '@cuberoot/shared/timer';
