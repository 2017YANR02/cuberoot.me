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
      // max-age 必须给:s-maxage 浏览器不认,且本响应无 Last-Modified/ETag 可协商,
      // 缺 max-age = 每个 worker 每次换池都全量重拉 ~30MB 表(首载分钟级的根因)。
      const cacheControl = ext === '.wasm'
        ? 'no-store'
        : 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400';
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
    // rust-cross 的数据表(*.bin.gz)由 worker 内 fetch() 拉取,能安全跟随跨域 307
    // (static CORS:*)。直接跳转,bytes 不穿过 Vercel Compute —— 否则代理转发是
    // Fast Origin/Data Transfer 的主要消耗(同 /stats 优化)。
    // worker.js / glue / wasm 体积小且须同源加载,仍走下面的代理。
    //
    // 注:client 现在直接把 tablesBase 指向 static(见 rust-cross-client.ts),正常路径
    // 根本不会走到这条 307;它只兜住老缓存里的 worker 和外部直链。既然是兜底,更要给
    // **max-age** —— 只发 s-maxage 时浏览器完全不缓存重定向,每张表白付一个 RTT。
    if (rel.startsWith('solver/rust-cross/tables/')) {
      return new Response(null, {
        status: 307,
        headers: {
          location: `https://static.cuberoot.me/tools/${rel}`,
          'cache-control': 'public, max-age=86400, s-maxage=86400',
        },
      });
    }
    const upstreamUrl = `https://static.cuberoot.me/tools/${rel}`;
    try {
      // Vercel 函数 → 自有 static 源是一跳跨境 server-to-server 请求,会整段不通
      // (实测 undici 默认 10s connect timeout 全部打满)。正常命中在 1s 级,所以
      // 卡 6s 就判死、别把整个函数吊在那儿。
      const upstream = await fetch(upstreamUrl, { signal: AbortSignal.timeout(6000) });
      if (!upstream.ok) return new Response('not found', { status: upstream.status });
      // 已知扩展名优先用我们的映射(尤其 .wasm),纠正 upstream 可能给错的 MIME。
      const ext = path.extname(rel).toLowerCase();
      const ct = CONTENT_TYPE[ext] ?? upstream.headers.get('content-type') ?? 'application/octet-stream';
      const buf = await upstream.arrayBuffer();
      return new Response(buf, {
        headers: { 'content-type': ct, 'cache-control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400' },
      });
    } catch (err) {
      // 回源挂了不要 502(整个 /solver iframe、/cstimer 直接白屏)—— 307 给浏览器,
      // 让它自己直连 static:浏览器这条路一直是通的(客户端本来就直接从 static 拉表),
      // 挂的只有服务端这一跳。代价是该资源变跨域(必须同源的 worker 脚本仍会失败),
      // 但那种情况原本也是 502,不算回退。
      // no-store:这是瞬时故障兜底,绝不能让边缘把降级态缓存住。
      console.error(`[tools] upstream fetch failed: ${upstreamUrl}`, err);
      // 例外 cstimer:它把全部成绩存在 localStorage,换 origin = 用户看到"记录空了",
      // 且故障期间新记的成绩留在 static 那个 origin 上再也找不回来。宁可白屏也不能
      // 让数据分叉 —— 这条保持原来的 502。
      if (rel === 'cstimer' || rel.startsWith('cstimer/')) {
        return new Response('upstream error', { status: 502 });
      }
      return new Response(null, {
        status: 307,
        headers: { location: upstreamUrl, 'cache-control': 'no-store' },
      });
    }
  }
  return new Response('not found', { status: 404 });
}
