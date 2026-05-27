import { promises as fs } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";

// Resolve cubing's chunks dir via createRequire so it works regardless of
// where Next/Vercel places the route handler (was using a relative
// fileURLToPath(import.meta.url) walk-up which silently 404s on Vercel
// when the lambda bundle layout differs from local).
const req = createRequire(import.meta.url);
// cubing/package.json gives an absolute path to cubing's root anywhere on disk.
const CUBING_PKG_JSON = req.resolve("cubing/package.json");
const CUBING_ROOT = path.dirname(CUBING_PKG_JSON);
const CUBING_CHUNKS_DIR = path.join(CUBING_ROOT, "dist", "lib", "cubing", "chunks");
const CLIENT_NEXT_DIR = path.resolve(CUBING_ROOT, "..", ".."); // for esbuild absWorkingDir (node_modules host)

const CONTENT_TYPE: Record<string, string> = {
  ".js": "application/javascript; charset=UTF-8",
  ".map": "application/json; charset=UTF-8",
  ".wasm": "application/wasm",
};

// Cubing's search-worker-entry.js (and its sibling chunks it transitively
// imports) contain bare module specifiers like "random-uint-below" and
// "cubing/alg" that browser-native ESM cannot resolve in a `type:"module"`
// Worker. Vite handles this by bundling workers via esbuild at build time.
// Turbopack bundles them into the main chunk graph but those bundled chunks
// depend on Turbopack's runtime — which workers don't have. So we mirror Vite:
// when the worker entry is fetched, esbuild it on-the-fly into one
// self-contained ESM file with all deps inlined.
const bundleCache = new Map<string, { mtimeMs: number; body: string }>();

async function bundleWorkerEntry(absPath: string): Promise<string> {
  const stat = await fs.stat(absPath);
  const cached = bundleCache.get(absPath);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.body;
  const result = await build({
    entryPoints: [absPath],
    bundle: true,
    format: "esm",
    target: "es2022",
    write: false,
    platform: "browser",
    // Resolve deps from client-next/node_modules so esbuild finds cubing's
    // peer dependencies (random-uint-below, cubing/*, three/src/*).
    absWorkingDir: CLIENT_NEXT_DIR,
    logLevel: "silent",
    // Strip "use strict" / source map comments etc; keep output small.
    legalComments: "none",
    minify: false,
  });
  const body = result.outputFiles[0]!.text;
  bundleCache.set(absPath, { mtimeMs: stat.mtimeMs, body });
  return body;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await ctx.params;
  const rel = slug.join("/");
  if (rel.includes("..") || path.isAbsolute(rel)) {
    return new Response("forbidden", { status: 403 });
  }
  const ext = path.extname(rel);
  const ct = CONTENT_TYPE[ext];
  if (!ct) return new Response("unsupported", { status: 415 });
  const absPath = path.join(CUBING_CHUNKS_DIR, rel);
  try {
    // The worker entry gets esbuild-bundled; everything else (e.g. .map files,
    // direct sibling-chunk fetches if anyone ever needs them) is served raw.
    if (rel === "search-worker-entry.js") {
      const body = await bundleWorkerEntry(absPath);
      return new Response(body, {
        headers: {
          "content-type": ct,
          "cache-control": "no-store",
          "cross-origin-resource-policy": "same-origin",
          "cross-origin-embedder-policy": "require-corp",
        },
      });
    }
    const data = await fs.readFile(absPath);
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": ct,
        "cache-control": "public, max-age=31536000, immutable",
        "cross-origin-resource-policy": "same-origin",
        "cross-origin-embedder-policy": "require-corp",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
