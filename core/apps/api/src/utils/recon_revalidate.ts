/** Invalidate every independently deployed Next cache after a committed write.
 * Destinations are operator configuration, never supplied by an HTTP caller. */
export async function revalidateReconPages(id: string | number): Promise<void> {
  return revalidateContentPages('recon', id);
}

export async function revalidateContentPages(kind: 'recon' | 'forum', id?: string | number): Promise<void> {
  const secret = process.env.RECON_REVALIDATE_SECRET;
  const urls = (process.env.RECON_REVALIDATE_URLS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (!secret || urls.length === 0) {
    console.warn('[recon-cache] invalidation is not configured');
    return;
  }
  await Promise.all(urls.map(async url => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, ...(id !== undefined ? { id: String(id) } : {}) }),
          signal: AbortSignal.timeout(3000),
          redirect: 'error',
        });
        if (response.ok && (await response.json()).revalidated === true) return;
      } catch {
        // A failed notification must not turn an already committed save into an error.
      }
    }
    console.error('[recon-cache] invalidation failed', { id: String(id), url });
  }));
}
