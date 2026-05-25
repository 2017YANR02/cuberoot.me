import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // POC: frame-count 用 mp4box.js (cjs/esm 混) + @ffmpeg/* (worker + WASM) + mediainfo.js.
  // Turbopack 大多数情况能直接处理,有问题时把包名放进来强制走 transpile.
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
};

export default nextConfig;
