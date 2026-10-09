import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { reconCacheTag, RECON_SAME_SCRAMBLE_TAG } from '@/lib/recon-seo';

export const runtime = 'nodejs';

/** API-to-Next webhook. Each production deployment owns its own tag cache. */
export async function POST(request: Request): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store' };
  const secret = process.env.RECON_REVALIDATE_SECRET;
  if (!secret) return Response.json({ error: 'Not configured' }, { status: 503, headers });
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(request.headers.get('authorization') ?? ''), digest(`Bearer ${secret}`))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  }
  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return Response.json({ error: 'Invalid recon id' }, { status: 400, headers });
  }
  // expire: 0 also refreshes the first visitor, rather than serving one stale response.
  revalidateTag(reconCacheTag(id), { expire: 0 });
  revalidateTag(RECON_SAME_SCRAMBLE_TAG, { expire: 0 });
  return Response.json({ revalidated: true }, { headers });
}
