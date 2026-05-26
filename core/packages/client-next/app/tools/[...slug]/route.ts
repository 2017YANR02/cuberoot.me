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
