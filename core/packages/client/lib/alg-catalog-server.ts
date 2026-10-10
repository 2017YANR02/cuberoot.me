import { apiUrl } from './api-base';
import { prepareAlgCatalog } from './alg-catalog';
import type { AlgCatalogSnapshot, AlgPuzzle } from '@cuberoot/shared/alg';

/** Cached HTML includes the cover states; browser validation also covers SQL edits
 * and a missed invalidation notification on either independently deployed host. */
export async function fetchAlgCatalog(puzzle: AlgPuzzle) {
  try {
    const response = await fetch(apiUrl(`/v1/alg/sets/${puzzle}/catalog?v=1`), {
      next: { revalidate: 60, tags: ['alg-catalog'] },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Alg catalog HTTP ${response.status}`);
    const snapshot = await response.json() as AlgCatalogSnapshot;
    return await prepareAlgCatalog(snapshot);
  } catch (error) {
    console.error('alg catalog prerender failed', puzzle, error);
    // A failed ISR refresh must not overwrite valid HTML with an empty catalog.
    // Next retains the last successful render when regeneration throws.
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
      throw error;
    }
    // Builds can precede the API rollout; development also keeps its shell usable.
    return null;
  }
}
