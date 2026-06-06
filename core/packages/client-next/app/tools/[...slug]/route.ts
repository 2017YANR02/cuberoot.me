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
  '.mjs': 'application/javascript; charset=utf-8',
  // WebAssembly 必须以 application/wasm 返回,否则浏览器的 instantiateStreaming
  // 拒绝编译、退回更慢的 instantiate(rust-cross glue 的 cross_solver_bg.wasm)。
  '.wasm': 'application/wasm',
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
      // .wasm 不走 stale-while-revalidate 缓存:一旦某次以错 MIME 缓存,SWR 每次都先
      // 把旧的(错 MIME)喂给 worker、后台才更新,要 reload 多次才自愈。dev 下 wasm 仅
      // 343KB,本地直取无感,no-store 杜绝 MIME 污染复发。其余资源(尤其 52MB 表)照常缓存。
      const cacheControl = ext === '.wasm'
        ? 'no-store'
        : 'public, s-maxage=86400, stale-while-revalidate=86400';
      return new Response(new Uint8Array(data), {
        headers: { 'content-type': contentType, 'cache-control': cacheControl },
      });
    } catch {
      // try next candidate
    }
  }
  // On Vercel, tools/ isn't bundled — fall back to static.cuberoot.me which
  // serves these via nginx with CORS:* (matches stats route handler pattern).
  if (process.env.VERCEL === '1') {
    // rust-cross 的数据表(*.bin.gz,~27MB/冷加载)由 worker 内 fetch() 拉取,
    // 能安全跟随跨域 307(static CORS:*)。直接跳转,bytes 不穿过 Vercel Compute
    // —— 否则代理转发是 Fast Origin/Data Transfer 的主要消耗(同 /stats 优化)。
    // worker.js / glue / wasm 体积小且须同源加载,仍走下面的代理。
    if (rel.startsWith('solver/rust-cross/tables/')) {
      return new Response(null, {
        status: 307,
        headers: { location: `https://static.cuberoot.me/tools/${rel}`, 'cache-control': 'public, s-maxage=86400' },
      });
    }
    try {
      const upstream = await fetch(`https://static.cuberoot.me/tools/${rel}`);
      if (!upstream.ok) return new Response('not found', { status: upstream.status });
      // 已知扩展名优先用我们的映射(尤其 .wasm),纠正 upstream 可能给错的 MIME。
      const ext = path.extname(rel).toLowerCase();
      const ct = CONTENT_TYPE[ext] ?? upstream.headers.get('content-type') ?? 'application/octet-stream';
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
