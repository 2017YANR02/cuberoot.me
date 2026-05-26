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

  // Dev fallback: /stats/* and /tools/* are static assets served from the repo root
  // by the Vite plugin `serveRepoRoot`. Next has no equivalent yet, so rewrite to
  // the production host. In prod, nginx serves these from /www/wwwroot/toolkit.
  async rewrites() {
    return [
      { source: "/stats/:path*", destination: "https://cuberoot.me/stats/:path*" },
      { source: "/tools/:path*", destination: "https://cuberoot.me/tools/:path*" },
      // Dev: proxy backend so loadAlg() etc. don't trip CORS from 127.0.0.1.
      // In prod, apiUrl() builds absolute https://api.cuberoot.me URLs directly.
      { source: "/v1/:path*", destination: "https://api.cuberoot.me/v1/:path*" },
    ];
  },
};

export default nextConfig;
