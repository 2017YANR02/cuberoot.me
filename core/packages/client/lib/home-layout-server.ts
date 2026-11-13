import { unstable_cache } from 'next/cache';
import { apiUrl } from './api-base';
import { fetchPublicApi } from './public-api-fetch-server';
import { HOME_LAYOUT_CACHE_TAG, parseHomeLocks, parseHomeOrders, type HomeLayoutSnapshot } from './home-layout';

/** Cache one complete, validated layout, never an empty fallback or half an update.
 * This project uses the existing ISR cache (Cache Components is not enabled).
 * A failed regeneration throws so Next keeps the last successful homepage. */
export const fetchHomeLayout = unstable_cache(async (): Promise<HomeLayoutSnapshot> => {
  const read = async (path: string) => {
    const response = await fetchPublicApi(apiUrl(path), 5000);
    return response.json() as Promise<unknown>;
  };
  const [locks, orders] = await Promise.all([
    read('/v1/nav/home-locks').then(parseHomeLocks),
    read('/v1/nav/home-order').then(parseHomeOrders),
  ]);
  return { locks, orders };
}, ['home-layout-v1'], { revalidate: 60, tags: [HOME_LAYOUT_CACHE_TAG] });
