import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Self-contained server bundle for systemd `next start`. In a pnpm monorepo
  // Next traces from packages/client-next/ by default and misses .pnpm-linked
  // deps (@swc/helpers, @next/env). Point tracing at the workspace root so the
  // tracer walks node_modules/.pnpm/ properly.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),

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

  // @ffmpeg/ffmpeg 多线程 WASM 需要 cross-origin isolation (SharedArrayBuffer).
  // 全站打开成本低(纯 header),挂个 route 测一下;后续按 path 收窄.
  async headers() {
    return [
      {
        source: "/:path*",
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
      beforeFiles: [],
      afterFiles: [
        // Dev: proxy backend so loadAlg() etc. don't trip CORS from 127.0.0.1.
        // In prod, apiUrl() builds absolute https://api.cuberoot.me URLs directly.
        { source: "/v1/:path*", destination: "https://api.cuberoot.me/v1/:path*" },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
