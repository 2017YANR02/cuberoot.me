import type { NextConfig } from "next";
import path from "node:path";
import dns from "node:dns";

// Force IPv4 first for upstream rewrites — node fetch's default IPv6-first
// order causes intermittent `getaddrinfo ENOTFOUND` on api.cuberoot.me proxy
// when AAAA lookup hangs and fails before A is tried. Set at module load so
// it applies to every next dev/build/start invocation.
dns.setDefaultResultOrder("ipv4first");

const isProd = process.env.NODE_ENV === "production";
// VERCEL=1 set by Vercel build env. Vercel's adapter manages output its own
// way; standalone + outputFileTracingRoot break Vercel's Turbopack path
// resolution (vercel/next.js#88579 — doubles path, manifest ENOENT).
const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  // Self-contained server bundle for systemd `next start` on next.cuberoot.me
  // (prod only). In dev, `output: standalone` + `outputFileTracingRoot`
  // pointing at the workspace root makes Turbopack walk the entire monorepo
  // node_modules on every change, which pegs CPU. On Vercel, omit both —
  // Vercel handles bundling/tracing through its own adapter, and standalone
  // conflicts with their Turbopack manifest expectations.
  ...(isProd && !isVercel && {
    output: "standalone" as const,
    outputFileTracingRoot: path.join(__dirname, "../../"),
  }),

  // Dev-only: allow the frp tunnel host (dev.cuberoot.me → frp → 127.0.0.1:3000)
  // to hit /_next/* dev assets + HMR. Next 16 dev blocks cross-origin requests to
  // internal resources unless the origin is listed here (mirrors Vite's
  // server.allowedHosts). Ignored in prod/Vercel.
  allowedDevOrigins: ["dev.cuberoot.me", "*.cuberoot.me"],

  // Tree-shake named exports from large libs that ship a barrel index.
  // three / maplibre-gl / katex re-export hundreds of symbols; importing
  // one barely-used helper drags the whole bundle. This hint tells Next
  // to rewrite imports per-symbol so unused branches drop.
  experimental: {
    optimizePackageImports: ["three", "maplibre-gl", "katex"],
  },

  // Keep trailing slashes intact so /tools/cstimer/ stays as-is and the
  // iframe's relative URLs resolve to /tools/cstimer/css/... not /tools/css/...
  // (matches Vite's serveRepoRoot behavior). Pages without slashes still work
  // because the [...slug] route handler accepts either.
  skipTrailingSlashRedirect: true,

  transpilePackages: ["mp4box", "mediainfo.js"],
  // esbuild ships native binaries + README — Turbopack chokes on .md files.
  // Mark it external so the route handler can require() it at runtime.
  serverExternalPackages: ["esbuild"],
  // cubing.js worker compat: see app/cubing-chunks/[...slug]/route.ts +
  // patches/cubing@0.63.3.patch. Patched cubing chunks point worker URL at
  // /cubing-chunks/search-worker-entry.js, where the route handler
  // esbuild-bundles it into a self-contained ESM (mirroring Vite's worker
  // pre-bundling). Required because Turbopack does not produce
  // worker-runtime-independent bundles for nested module workers.
  //
  // The route handler reads cubing chunks via fs.readFile at runtime, so
  // Next's static import tracer never sees them and they get omitted from
  // both Vercel functions and the systemd standalone bundle. Force-include
  // here. Match resolves from outputFileTracingRoot (monorepo root when
  // standalone, project root on Vercel).
  // Bundle the cubing chunks dir + cubing's siblings (puzzle-geometry / alg referenced
  // via `../puzzle-geometry/index.js`) + runtime npm deps esbuild has to resolve at
  // request time. Without these the route handler's esbuild.build() throws
  // 'Could not resolve "random-uint-below"' and similar.
  // Patterns are relative to outputFileTracingRoot. With pnpm, real files live under
  // node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/; include both layouts so
  // probe path matches whether we're on Vercel or systemd.
  outputFileTracingIncludes: {
    "/cubing-chunks/[...slug]": [
      "../../node_modules/cubing/dist/**",
      "./node_modules/cubing/dist/**",
      "../../node_modules/.pnpm/cubing@*/node_modules/cubing/dist/**",
      "./node_modules/.pnpm/cubing@*/node_modules/cubing/dist/**",
      "../../node_modules/random-uint-below/**",
      "./node_modules/random-uint-below/**",
      "../../node_modules/.pnpm/random-uint-below@*/node_modules/random-uint-below/**",
      "./node_modules/.pnpm/random-uint-below@*/node_modules/random-uint-below/**",
    ],
  },

  // COOP/COEP 只发给真用 SharedArrayBuffer (cubeopt-wasm) 的 /scramble/solver。
  // 历史 nginx 把 analyzer 一起套了 — 但 analyzer 用 classic worker + emscripten
  // (无 SAB),COEP=require-corp 会拦住 /analyze-worker/analyzer.js (Chrome 即使
  // 同源 classic worker 在 COEP 下也要 CORP);跟 Vite dev (无 COEP) 行为不一致。
  // 全站打开会把所有跨域 <img> (WCA 头像) 拦死。
  //
  // ⚠️ 关键 (2026-06-06 修):页面发了 COEP:require-corp 后,该页里 `new Worker()`
  // 加载的**任何 worker 脚本响应自身也必须带 COEP:require-corp**,否则浏览器在
  // cross-origin-isolated 上下文里直接拒绝实例化(opaque error,无 message)。
  // Vite 时代是 server.headers 全站发 COEP=credentialless(连静态 worker 脚本一起带),
  // 所以 worker 能加载;Next 只给页面发 → cubeopt 主 worker (/cubeopt/wasm-worker.js)、
  // 它 import 的 emscripten pthread worker (/cubeopt/cube48opt*.mjs)、以及 kociemba
  // module worker (Turbopack 产到 /_next/static/*) 全部加载失败 → solver 永远卡"忙"。
  // 修法:给这些 worker/资产路径补 COEP:require-corp(同源资产再加 CORP:same-origin)。
  // 注:COEP 响应头只在 require-corp 上下文里当 worker/document 加载时生效,普通
  // 子资源(其它页的 /_next chunk、跨域图)忽略它 → 全站加这头是安全的,不会拦图。
  async headers() {
    const workerAsset = [
      { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    ];
    return [
      // Kill-switch service worker (public/sw.js): never cache, so stale Vite-era
      // clients pick up the self-destruct script on their next update check.
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
      // Long-cache bare public/ assets. Next only auto-immutables hashed
      // /_next/static/*; files served straight from public/ default to
      // `max-age=0, must-revalidate`, so every page navigation re-validates
      // (304) the DeskPet SVG frames (~98 of them), icons, fonts and favicon.
      // Each 304 is a billable Vercel Edge Request — measured at ~22% of all
      // traffic — and is the dominant reason Edge Requests overran the limit
      // while Functions/CPU did not (pure request-count, no compute). One
      // change covers Vercel AND the origin (nginx proxies Next's headers).
      // Art/fonts are content-stable → immutable 1y (rename to bust). Icons /
      // favicon may change → 30d so a new logo propagates without a rename.
      {
        source: "/deskpet/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // /sim 手部 GLB(WebXR generic-hand,第三方内容稳定)→ 30d,换模型时改文件名 bust。
      {
        source: "/sim/hands/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
      {
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
      {
        source: "/_assets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
      {
        source: "/favicon.ico",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
      {
        source: "/beian-badge.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
      {
        source: "/cstimer_logo.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
      {
        source: "/assets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
      // Big content-stable wasm served straight from public/ defaulted to
      // max-age=0 → every /frame-count load 304-revalidated (billable edge
      // request) and risked re-downloading the whole file on a validation miss.
      // Third-party, effectively immutable → cache 30d (rename to bust), like icons.
      {
        source: "/ffmpeg/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
      {
        source: "/MediaInfoModule.wasm",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
      // Analyzer worker bundle (our build artifact, fixed filename → could change
      // on rebuild). Was max-age=0; cache 1 day to kill repeat-visit 304s while a
      // solver fix still propagates within a day. NO COEP here — the analyzer uses
      // a classic worker and require-corp would block it (see headers note above).
      {
        source: "/analyze-worker/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
      // /scramble/solver 现在是统一求解路由(?event= 分发):只有 3×3 cubeopt(event=333
      // 或缺省 event)要 SharedArrayBuffer → 只给它发 COOP/COEP。其余 event(222/pyram/skewb/
      // sq1)是普通文档,绝不能套 COEP(rust-cross worker + 跨域 27MB 表会被 require-corp 拦死)。
      // 故按 query 条件下发:has event=333 或 missing event 才发。跨 333 边界的切换是硬导航
      // (SolveTabs 原生 <a>),每次整页重载按本规则重算 COEP,软导航不会错带/漏带头。
      {
        source: "/:lang(zh|en)?/scramble/solver",
        has: [{ type: "query", key: "event", value: "333" }],
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/:lang(zh|en)?/scramble/solver",
        missing: [{ type: "query", key: "event" }],
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      // cubeopt-wasm: 主 worker + 9 个 emscripten pthread 模块 + .wasm。
      // wasm/mjs 内容稳定 → immutable(同时保留 COEP/CORP);大文件,缓存还省 Origin Transfer。
      {
        source: "/cubeopt/:path*",
        headers: [...workerAsset, { key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // Turbopack/构建产物里的 module worker(kociemba.worker.ts 等)
      { source: "/_next/static/:path*", headers: workerAsset },
      // cubing.js search worker(经 app/cubing-chunks 路由 handler 提供)
      { source: "/cubing-chunks/:path*", headers: workerAsset },
    ];
  },

  // Default rewrites run BEFORE app-router route handlers, which would shadow
  // our local /stats/* and /tools/* catch-alls (app/stats/[...slug]/route.ts).
  // Use the object form with `afterFiles` so route handlers win, and rewrites
  // only kick in if no route matched — but here we want neither: both are
  // catch-alls so route handler always matches; rewrites kept ONLY for /v1/*.
  async rewrites() {
    return {
      beforeFiles: [
        // Legacy WCA OAuth callback URL — registered with WCA as /callback.html.
        // Internal rewrite (not redirect) so the URL bar stays /callback.html and
        // WCA's exact redirect_uri match still passes. Same page as /auth/callback.
        { source: "/callback.html", destination: "/auth/callback" },
        // Person detail: unbounded wcaId space backed by ONE prerendered static
        // shell (app/[lang]/wca/persons/[wcaId] generates only the "_" sentinel).
        // Route every real id to that shell so the page never SSRs per request;
        // the client reads the real id from window.location. URL bar is unchanged
        // (rewrite, not redirect). See persons/[wcaId]/page.tsx.
        { source: "/:lang(en|zh)/wca/persons/:wcaId", destination: "/:lang/wca/persons/_" },
        // Colpi letter-pair detail: same sentinel-shell trick as persons above.
        // Crawlers enumerate the pair space; without this each pair URL burns a
        // function render after every deploy (per-deployment ISR cache reset).
        { source: "/:lang(en|zh)/memo/colpi/:pair", destination: "/:lang/memo/colpi/_" },
        // Recon edit form: same sentinel. Every recon list/detail renders an
        // "edit" <Link> to /recon/submit/<id>; Next prefetched them all, so each
        // id was a MISS function render of an auth-gated, zero-SEO edit form.
        // One static shell backs every id (see recon/submit/[editId]/page.tsx).
        { source: "/:lang(en|zh)/recon/submit/:editId", destination: "/:lang/recon/submit/_" },
        // Forum subforum + thread pages: unbounded id spaces, same sentinel
        // shells (see forum/f/[slug]/page.tsx and forum/t/[id]/page.tsx).
        { source: "/:lang(en|zh)/forum/f/:slug", destination: "/:lang/forum/f/_" },
        { source: "/:lang(en|zh)/forum/t/:id", destination: "/:lang/forum/t/_" },
        // Competition detail: ~17k comps, pure client shell (all data fetched in the
        // browser). Same sentinel trick — one static shell backs every comp slug so a
        // crawler / post-deploy sweep never burns a function render per slug (this was
        // the Function Invocations spike). See wca/comp/[slug]/page.tsx.
        // 负向断言绕开真实静态子页(stats/sources),否则它们也会被吞进哨兵壳
        // (WCA comp id 是 [A-Za-z0-9]+ 且首字母大写年份结尾,不会撞这两个词,但防御性排除)。
        { source: "/:lang(en|zh)/wca/comp/:slug((?!stats$|sources$)[^/]+)", destination: "/:lang/wca/comp/_" },
        // Personal-recon pages: unbounded wcaId space, pure client shell (same latent
        // spike as the comp page above). One static sentinel shell.
        // See recon/person/[wcaId]/page.tsx.
        { source: "/:lang(en|zh)/recon/person/:wcaId", destination: "/:lang/recon/person/_" },
        // Alg per-case metadata detail: pure client shell (loadAlg in the browser). The
        // case space grows with the alg DB (1LLL alone ~4k cases), so route every case to
        // ONE static sentinel shell — no per-case function render on a crawler sweep.
        // See alg/[puzzle]/[set]/case/[name]/page.tsx.
        { source: "/:lang(en|zh)/alg/:puzzle/:set/case/:name", destination: "/:lang/alg/_/_/case/_" },
      ],
      afterFiles: [
        // Dev only: FMC chain solver (vendored cubelib) runs as a local native
        // service on :8099 — proxy /v1/fmc/* to it so ChainExplorer can fetch it
        // without CORS. Must precede the general /v1 rule. In prod this falls
        // through to api.cuberoot.me/v1/fmc/* (nginx routes /v1/fmc → cubelib-server).
        ...(process.env.NODE_ENV === "development"
          ? [{ source: "/v1/fmc/:path*", destination: "http://127.0.0.1:8099/:path*" }]
          : []),
        // Dev only: forum API is served by a locally-run Hono server (:3001)
        // until the routes ship to prod — only /v1/forum goes local, every
        // other /v1 endpoint keeps hitting prod data via the rule below.
        ...(process.env.NODE_ENV === "development"
          ? [{ source: "/v1/forum/:path*", destination: "http://127.0.0.1:3001/v1/forum/:path*" }]
          : []),
        // Dev: proxy backend so loadAlg() etc. don't trip CORS from 127.0.0.1.
        // In prod, apiUrl() builds absolute https://api.cuberoot.me URLs directly.
        { source: "/v1/:path*", destination: "https://api.cuberoot.me/v1/:path*" },
      ],
      fallback: [],
    };
  },

  // 1:1 with packages/client-vite/src/App.tsx <Navigate> redirects. Query strings
  // auto-pass through (e.g. /analyze?lang=zh → /scramble/analyzer?lang=zh).
  // /average → /calc?tab=average merges with any incoming ?lang=zh.
  // permanent: true = 308 (cached forever); these URL renames are stable.
  async redirects() {
    return [
      // Back-compat for the earlier Next port shape /tutorial/p/<slug>; Vite uses /tutorial/<slug>.
      { source: "/tutorial/p/:slug", destination: "/tutorial/:slug", permanent: true },
      { source: "/analyze", destination: "/scramble/analyzer", permanent: true },
      { source: "/average", destination: "/calc?tab=average", permanent: true },
      { source: "/scramble-stats", destination: "/scramble/stats", permanent: true },
      { source: "/gen", destination: "/scramble/gen", permanent: true },
      { source: "/patterns", destination: "/scramble/pattern", permanent: true },
      { source: "/upcoming-comps", destination: "/wca/comp", permanent: true },
      { source: "/theory", destination: "/math", permanent: true },
      { source: "/theory/group", destination: "/math/group", permanent: true },
      { source: "/theory/god", destination: "/math/god", permanent: true },
      { source: "/scramble/god", destination: "/math/god", permanent: true },
      { source: "/code/ts", destination: "/code/language/ts", permanent: true },
      { source: "/code/rust", destination: "/code/language/rust", permanent: true },
      { source: "/code/go", destination: "/code/language/go", permanent: true },
      { source: "/code/python", destination: "/code/language/python", permanent: true },
      { source: "/code/c", destination: "/code/language/c", permanent: true },
      { source: "/code/cpp", destination: "/code/language/cpp", permanent: true },
      { source: "/code/zig", destination: "/code/language/zig", permanent: true },
      { source: "/code/swift", destination: "/code/language/swift", permanent: true },
      { source: "/code/kotlin", destination: "/code/language/kotlin", permanent: true },
      { source: "/code/java", destination: "/code/language/java", permanent: true },
      { source: "/code/javascript", destination: "/code/language/javascript", permanent: true },
      { source: "/code/mojo", destination: "/code/language/mojo", permanent: true },
      { source: "/code/compare", destination: "/code/language/compare", permanent: true },
      { source: "/code/scramble", destination: "/code/language/scramble", permanent: true },
      // /battle is retired — the battle experience lives only at /timer?players=2..4.
      // No redirect: old /battle URLs 404 on purpose.
      // /blog/* → blog.cuberoot.me (双轨:境内 nginx 在主域 vhost ^~ /blog/ alias 直 serve;
      // next.cuberoot.me 没这个 alias,统一跳子域。Vite 由 SPA BlogRedirectFallback 兜底,
      // Next 这里在 next.config 层直接发 redirect。)
      { source: "/blog", destination: "https://blog.cuberoot.me/", permanent: false },
      { source: "/blog/:path*", destination: "https://blog.cuberoot.me/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
