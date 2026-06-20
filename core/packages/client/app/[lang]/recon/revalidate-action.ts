'use server';

import { updateTag } from 'next/cache';
import { reconCacheTag } from '@/lib/recon-seo';

/** Bust the ISR/Data cache for one recon's detail page after a mutation
 *  (submit-form edit, alternative add/edit/delete). Without this the detail
 *  page is served from the 24h ISR cache and shows stale fields (e.g. a TPS
 *  computed from the pre-edit time) until the cache window expires or the user
 *  hard-refreshes. Pair with router.refresh() on the client to also drop the
 *  client Router Cache.
 *
 *  Uses updateTag (not the now-deprecated single-arg revalidateTag): it's the
 *  Server-Action read-your-own-writes primitive — these callers are all client
 *  event handlers invoking this 'use server' action, a valid action context. */
export async function revalidateRecon(id: string | number): Promise<void> {
  updateTag(reconCacheTag(id));
}
