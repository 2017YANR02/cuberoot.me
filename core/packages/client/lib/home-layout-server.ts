import { unstable_cache } from 'next/cache';
import { apiUrl } from './api-base';
import { HOME_LAYOUT_CACHE_TAG, parseHomeLocks, parseHomeOrders, type HomeLayoutSnapshot } from './home-layout';

/** Cache one complete, validated layout, never an empty fallback or half an update.
 * This project uses the existing ISR cache (Cache Components is not enabled).
 * A failed regeneration throws so Next keeps the last successful homepage. */
export const fetchHomeLayout = unstable_cache(async (): Promise<HomeLayoutSnapshot> => {
  const read = async (path: string) => {
    const response = await fetch(apiUrl(path), { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Homepage layout HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  };
  const [locks, orders] = await Promise.all([
    read('/v1/nav/home-locks').then(parseHomeLocks),
    read('/v1/nav/home-order').then(parseHomeOrders),
  ]);
  return { locks, orders };
}, ['home-layout-v1'], { revalidate: 60, tags: [HOME_LAYOUT_CACHE_TAG] });
