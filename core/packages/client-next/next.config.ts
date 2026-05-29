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

  // Dev-only: allow the frp tunnel / Tailscale hosts to hit /_next/* dev assets
  // + HMR. Next 16 dev blocks cross-origin requests to internal resources unless
  // the origin is listed here (mirrors Vite's server.allowedHosts). Ignored in
  // prod/Vercel. dev.cuberoot.me → frp → 127.0.0.1:3000; *.ts.net → Tailscale.
  allowedDevOrigins: ["dev.cuberoot.me", "*.cuberoot.me", "*.ts.net"],

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
  async headers() {
    return [
      {
        source: "/:lang(zh|en)?/scramble/solver",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
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
      ],
      afterFiles: [
        // Dev: proxy backend so loadAlg() etc. don't trip CORS from 127.0.0.1.
        // In prod, apiUrl() builds absolute https://api.cuberoot.me URLs directly.
        { source: "/v1/:path*", destination: "https://api.cuberoot.me/v1/:path*" },
      ],
      fallback: [],
    };
  },

  // 1:1 with packages/client/src/App.tsx <Navigate> redirects. Query strings
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
      { source: "/upcoming-comps", destination: "/wca/calendar", permanent: true },
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
      // /blog/* → blog.cuberoot.me (双轨:境内 nginx 在主域 vhost ^~ /blog/ alias 直 serve;
      // next.cuberoot.me 没这个 alias,统一跳子域。Vite 由 SPA BlogRedirectFallback 兜底,
      // Next 这里在 next.config 层直接发 redirect。)
      { source: "/blog", destination: "https://blog.cuberoot.me/", permanent: false },
      { source: "/blog/:path*", destination: "https://blog.cuberoot.me/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
