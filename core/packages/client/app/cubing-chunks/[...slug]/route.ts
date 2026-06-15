import { promises as fs, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// Find cubing's chunks dir by probing several candidate locations:
// - Local dev: walk-up from this file → packages/client/node_modules/cubing/...
// - Vercel function bundle: cwd-relative (project root = client)
// - Standalone w/ outputFileTracingRoot=monorepo: cwd-relative + ../../ host
// First match wins; the helper runs at module-load so all subsequent fs ops
// use a known good absolute path.
function findCubingChunksDir(): { chunks: string; nodeModulesHost: string; tried: string[] } {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cwd = process.cwd();
  // Hoisted layout (npm / Next standalone w/o pnpm) puts cubing directly under node_modules.
  // pnpm layout (Vercel + systemd standalone) puts it under .pnpm/cubing@VER/node_modules/cubing.
  const hoisted = [
    path.resolve(here, "..", "..", "..", "node_modules"),
    path.resolve(cwd, "node_modules"),
    path.resolve(cwd, "..", "..", "node_modules"),
    path.resolve(cwd, "..", "..", "..", "node_modules"),
    path.resolve(cwd, "..", "..", "..", "..", "node_modules"),
  ];
  const tried: string[] = [];
  for (const nm of hoisted) {
    // Direct hoist
    const direct = path.join(nm, "cubing", "dist", "lib", "cubing", "chunks");
    tried.push(direct);
    if (existsSync(direct)) {
      return { chunks: direct, nodeModulesHost: nm, tried };
    }
    // pnpm .pnpm/cubing@.../node_modules/cubing/...
    const pnpmDir = path.join(nm, ".pnpm");
    if (existsSync(pnpmDir)) {
      let entries: string[] = [];
      try { entries = readdirSync(pnpmDir); } catch { /* ignore */ }
      const match = entries.find(e => e.startsWith("cubing@"));
      if (match) {
        const p = path.join(pnpmDir, match, "node_modules", "cubing", "dist", "lib", "cubing", "chunks");
        tried.push(p);
        if (existsSync(p)) {
          return { chunks: p, nodeModulesHost: nm, tried };
        }
      } else {
        tried.push(`${pnpmDir}/.pnpm/cubing@* (no match in ${entries.length} entries)`);
      }
    }
  }
  return {
    chunks: tried[0]!,
    nodeModulesHost: hoisted[0]!,
    tried,
  };
}
const probe = findCubingChunksDir();
const CUBING_CHUNKS_DIR = probe.chunks;
const CLIENT_NEXT_DIR = probe.nodeModulesHost;

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
    // Resolve deps from client/node_modules so esbuild finds cubing's
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
          "cache-control": "public, s-maxage=2592000",
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
  } catch (e) {
    // Diagnostic — surface probe attempts so we can tell what Vercel actually shipped.
    if (new URL(_req.url).searchParams.has("debug")) {
      return new Response(
        JSON.stringify({
          err: String(e),
          tried: probe.tried,
          chunks: CUBING_CHUNKS_DIR,
          cwd: process.cwd(),
          here: path.dirname(fileURLToPath(import.meta.url)),
        }, null, 2),
        { status: 404, headers: { "content-type": "application/json" } },
      );
    }
    return new Response("not found", { status: 404 });
  }
}
