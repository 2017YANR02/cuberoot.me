// Dev-only catch-all that serves /stats/* from the repo's stats/ directory,
// mirroring the Vite `serveRepoRoot` plugin. In prod, nginx serves these files
// at /www/wwwroot/toolkit/stats/ so this route is never hit there.
//
// Without this, next.config.ts rewrites /stats/* to https://cuberoot.me/stats/*,
// which is slow (every JSON does an Internet round-trip) and breaks on files
// that exist locally but not on prod (e.g. comp_names_zh.json returning 500).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(rel).toLowerCase();
    const contentType = CONTENT_TYPE[ext] ?? 'application/octet-stream';
    return new Response(new Uint8Array(data), {
      headers: { 'content-type': contentType, 'cache-control': 'no-store' },
    });
  } catch {
    return new Response('not found', { status: 404 });
  }
}
