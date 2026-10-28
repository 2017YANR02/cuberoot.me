// /stats/* handler:
// - Dev: published snapshots by default; explicit local mode reads repo stats/.
// - Self-hosted prod (nginx): never hit here, nginx ^~ /stats/ location returns first.
// - Vercel prod: stats/ NOT bundled (only core/packages/client is deployed)
//   → fall back to fetching from static.cuberoot.me which serves stats from
//   /www/wwwroot/toolkit/stats/ via nginx (CORS: *).
// (Without this, /stats/all_upcoming_comps.json etc. 404 on Vercel.)

import { createReadStream, promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { usesLocalStats, PUBLISHED_STATS_ORIGIN } from '@cuberoot/shared/stats-base';

// app/stats/[...slug]/route.ts → 6 levels up = repo root, then 'stats'
// (cuberoot.me/core/packages/client/app/stats/[...slug] → cuberoot.me/stats)
// process.cwd() is unreliable across dev/build; anchor on this file's URL.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATS_DIR = path.resolve(HERE, '..', '..', '..', '..', '..', '..', 'stats');

const CONTENT_TYPE: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.gz': 'application/gzip',
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const rel = slug.join('/');
  if (rel.includes('..') || path.isAbsolute(rel)) {
    return new Response('forbidden', { status: 403 });
  }
  const filePath = path.join(STATS_DIR, rel);
  const localStats = usesLocalStats();
  const publishedDev = process.env.NODE_ENV === 'development' && !localStats;
  const ext = path.extname(rel).toLowerCase();
  const contentType = CONTENT_TYPE[ext] ?? 'application/octet-stream';
  const headers: Record<string, string> = {
    'content-type': contentType,
    // Dev: never cache — stats JSON is regenerated locally and SWR would keep
    // serving stale data (e.g. an old scramble-length histogram). Prod/Vercel
    // keep the CDN-friendly SWR policy (self-hosted prod serves via nginx, not here).
    'cache-control': process.env.NODE_ENV === 'development'
      ? 'no-store'
      : 'public, s-maxage=3600, stale-while-revalidate=86400',
  };
  // 强制下载:逐 bin 采样 txt(downloads/)+「下载全部」全量 gz(bundles/)。
  const isExactCorpus = /^scramble\/exact-puzzles\/[a-z0-9_-]+\/[a-f0-9]{64}\/(?:all\.csv|depth-\d+\.txt)\.gz$/.test(rel);
  const isForcedDownload = rel.startsWith('scramble/downloads/') || rel.startsWith('scramble/bundles/') || isExactCorpus;
  if (isForcedDownload) {
    const base = path.basename(rel);
    headers['content-disposition'] = `attachment; filename="${base}"`;
  }

  // Also cover direct /stats links. Existing local files must not silently
  // override the published source selected by the developer.
  if (publishedDev) return publishedResponse();

  try {
    if (isExactCorpus) {
      const info = await fs.stat(filePath);
      if (!info.isFile()) return new Response('not found', { status: 404 });
      headers['content-length'] = String(info.size);
      if (!localStats) headers['cache-control'] = 'public, max-age=31536000, immutable';
      const stream = Readable.toWeb(createReadStream(filePath, { highWaterMark: 65536 }));
      return new Response(stream as ReadableStream<Uint8Array>, { headers });
    }
    const data = await fs.readFile(filePath);
    return new Response(new Uint8Array(data), { headers });
  } catch (error) {
    if (localStats) {
      const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
      console.error(`[stats] local ${missing ? 'file missing' : 'read failed'}: stats/${rel}`);
      return Response.json({ error: missing ? 'LOCAL_STATS_NOT_FOUND' : 'LOCAL_STATS_READ_FAILED', path: `/stats/${rel}`, source: 'local' }, {
        status: missing ? 404 : 500, headers: { 'cache-control': 'no-store' },
      });
    }
    return publishedResponse();
  }

  async function publishedResponse(): Promise<Response> {
    const upstreamUrl = `${PUBLISHED_STATS_ORIGIN}/stats/${rel}${new URL(_req.url).search}`;
    // Per-bin sample txt (downloads/*): small — proxy from static on miss in BOTH dev
    // (no local copy) and Vercel (stats/ not bundled), preserving content-disposition
    // (static nginx doesn't set it). Both live ONLY on static (not committed).
    if (rel.startsWith('scramble/downloads/')) {
      try {
        // 跨境回源不通时会把 undici 默认 10s connect timeout 打满,6s 判死。
        const upstream = await fetch(upstreamUrl, { signal: AbortSignal.timeout(6000) });
        if (!upstream.ok) return new Response('not found', { status: upstream.status });
        const buf = await upstream.arrayBuffer();
        return new Response(buf, { headers });
      } catch (err) {
        // 同 /tools:回源挂了改 307 直连 static(浏览器那条路是通的),别 502。
        // 代价是丢 content-disposition(static 不发),文件名退化 —— 但能下到东西。
        console.error('[stats] upstream fetch failed:', upstreamUrl, err);
        return new Response(null, {
          status: 307,
          headers: { location: upstreamUrl, 'cache-control': 'no-store' },
        });
      }
    }
    // Full bundles (~30MB gz) + all other stats on miss: redirect to static so the
    // bytes never traverse Compute (the dominant Fast Origin Transfer cost / 502
    // timeouts). A .gz downloads regardless of content-disposition. Bundles redirect
    // in published development mode too. Explicit local mode never falls back.
    if (publishedDev || process.env.VERCEL === '1' || rel.startsWith('scramble/bundles/') || isExactCorpus) {
      return new Response(null, {
        status: 307,
        headers: { location: upstreamUrl, 'cache-control': publishedDev ? 'no-store' : 'public, s-maxage=86400' },
      });
    }
    return new Response('not found', { status: 404 });
  }
}
