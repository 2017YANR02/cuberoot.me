// /stats/* handler:
// - Local dev (next dev): serves from repo's stats/ directory.
// - Self-hosted prod (nginx): never hit here, nginx ^~ /stats/ location returns first.
// - Vercel prod: stats/ NOT bundled (only core/packages/client-next is deployed)
//   → fall back to fetching from static.cuberoot.me which serves stats from
//   /www/wwwroot/toolkit/stats/ via nginx (CORS: *).
// (Without this, /stats/all_upcoming_comps.json etc. 404 on Vercel.)

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERCEL_STATS_FALLBACK = 'https://static.cuberoot.me/stats/';

// app/stats/[...slug]/route.ts → 6 levels up = repo root, then 'stats'
// (cuberoot.me/core/packages/client-next/app/stats/[...slug] → cuberoot.me/stats)
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
  if (rel.startsWith('scramble/downloads/')) {
    const base = path.basename(rel);
    headers['content-disposition'] = `attachment; filename="${base}"`;
  }

  try {
    const data = await fs.readFile(filePath);
    return new Response(new Uint8Array(data), { headers });
  } catch {
    // On Vercel, stats/ isn't bundled. Redirect the client straight to
    // static.cuberoot.me so the bytes never traverse Vercel Compute — proxying
    // them (esp. all_past_comps.json 5.5MB / person_countries.json 5MB) is the
    // dominant Fast Origin Transfer cost and was timing the function out (502).
    // Exception: forced-download files keep the proxy so content-disposition
    // survives (static nginx doesn't set it).
    if (process.env.VERCEL === '1') {
      const upstreamUrl = VERCEL_STATS_FALLBACK + rel;
      if (rel.startsWith('scramble/downloads/')) {
        try {
          const upstream = await fetch(upstreamUrl);
          if (!upstream.ok) return new Response('not found', { status: upstream.status });
          const buf = await upstream.arrayBuffer();
          return new Response(buf, { headers });
        } catch {
          return new Response('upstream error', { status: 502 });
        }
      }
      return new Response(null, {
        status: 307,
        headers: { location: upstreamUrl, 'cache-control': 'public, s-maxage=86400' },
      });
    }
    return new Response('not found', { status: 404 });
  }
}
