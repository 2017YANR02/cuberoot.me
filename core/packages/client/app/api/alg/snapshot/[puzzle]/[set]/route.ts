import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { unstable_cache } from 'next/cache';
import { ALG_CATALOG, type AlgPuzzle } from '@cuberoot/shared/alg';
import { apiUrl } from '@/lib/api-base';

// Public PG-derived snapshots are built with the site and served from its CDN.
// The library always checks the live API in the background; this is a cold-start
// fallback, never the source for admin writes or training validation.
export const runtime = 'nodejs';
export const dynamic = 'force-static';
export const dynamicParams = false;
export const revalidate = 60;
export function generateStaticParams() {
  return Object.entries(ALG_CATALOG).flatMap(([puzzle, sets]) =>
    sets.map(set => ({ puzzle, set: set.slug })));
}
// 1LLL exceeds Next's 2 MB fetch-cache item limit uncompressed. Store the
// compressed public snapshot, not an uncached multi-megabyte JSON response.
const compress = promisify(gzip);
const snapshot = unstable_cache(async (url: string) => {
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await compress(Buffer.from(await response.text()))).toString('base64');
  } catch (cause) {
    // Next annotates errors during rendering; DOMException.message is read-only.
    throw new Error(`Alg snapshot: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
}, ['alg-library-gzip-v1'], { revalidate: 60, tags: ['alg-library'] });

export async function GET(_request: Request, context: { params: Promise<{ puzzle: string; set: string }> }) {
  const { puzzle, set } = await context.params;
  if (!ALG_CATALOG[puzzle as AlgPuzzle] || !/^[a-z0-9][a-z0-9+-]*$/.test(set)) {
    return Response.json({ error: 'Unknown set' }, { status: 404 });
  }
  const body = await snapshot(apiUrl(`/v1/alg/sets/${encodeURIComponent(puzzle)}/${encodeURIComponent(set)}`));
  return new Response(new Uint8Array(Buffer.from(body, 'base64')), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Encoding': 'gzip' },
  });
}
