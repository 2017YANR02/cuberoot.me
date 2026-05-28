// Dev-only catch-all that serves /tools/* from the repo root's tools/ directory,
// mirroring Vite's `serveRepoRoot` plugin. See app/stats/[...slug]/route.ts for
// the same pattern + rationale.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// app/tools/[...slug]/route.ts → 6 levels up = repo root, then 'tools'
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = path.resolve(HERE, '..', '..', '..', '..', '..', '..', 'tools');

const CONTENT_TYPE: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
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
  const filePath = path.join(TOOLS_DIR, rel);
  const candidates = path.extname(rel) ? [filePath] : [filePath, path.join(filePath, 'index.html')];
  for (const candidate of candidates) {
    try {
      const data = await fs.readFile(candidate);
      const ext = path.extname(candidate).toLowerCase();
      const contentType = CONTENT_TYPE[ext] ?? 'application/octet-stream';
      return new Response(new Uint8Array(data), {
        headers: { 'content-type': contentType, 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=86400' },
      });
    } catch {
      // try next candidate
    }
  }
  // On Vercel, tools/ isn't bundled — fall back to static.cuberoot.me which
  // serves these via nginx with CORS:* (matches stats route handler pattern).
  if (process.env.VERCEL === '1') {
    try {
      const upstream = await fetch(`https://static.cuberoot.me/tools/${rel}`);
      if (!upstream.ok) return new Response('not found', { status: upstream.status });
      const ct = upstream.headers.get('content-type') ?? 'application/octet-stream';
      const buf = await upstream.arrayBuffer();
      return new Response(buf, {
        headers: { 'content-type': ct, 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=86400' },
      });
    } catch {
      return new Response('upstream error', { status: 502 });
    }
  }
  return new Response('not found', { status: 404 });
}
