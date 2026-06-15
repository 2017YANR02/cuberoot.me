/**
 * 3x3 random-state scrambler backed by min2phase-rust WASM.
 *
 * Same Kociemba two-phase family as cubing.js's `randomScrambleForEvent('333')`,
 * different implementation: cs0x7f's algorithm (bit-packed 4-bit pruning tables
 * + 3-axis search + pre-moves), ported to Rust + LTO release.
 *
 * The wasm-pack glue + .wasm live in src/wasm/m2p/ — Vite bundles both into
 * the route's lazy chunk and fingerprints the .wasm filename for cache
 * busting. `init()` takes the URL we pass it via Vite's `?url` import.
 *
 * Earlier iteration shipped the assets in public/m2p/ and dynamic-imported
 * the glue, but the `new Function('return import(...)')` Vite-evasion hack
 * we used to avoid Vite's dev-time ?import transform was unreliable on
 * mobile Safari (clicks would hang on first solve). Letting Vite handle
 * both files works uniformly.
 */
import init, { Min2Phase as Min2PhaseClass } from '../wasm/m2p/m2p_wasm';
const wasmUrl = new URL('../wasm/m2p/m2p_wasm_bg.wasm', import.meta.url);

const INVERSE_SOLUTION = 0x2;

let instancePromise: Promise<Min2PhaseClass> | null = null;

function getInstance(): Promise<Min2PhaseClass> {
  if (instancePromise) return instancePromise;
  instancePromise = (async () => {
    await init({ module_or_path: wasmUrl.href });
    return new Min2PhaseClass();
  })();
  return instancePromise;
}

/** Generate one WCA-spec random-state 3x3 scramble (~20.6 moves avg, max 21). */
export async function m2pScramble333(): Promise<string> {
  const m = await getInstance();
  const facelets = m.randomCube();
  return m.solveEx(facelets, 21, 100_000, 0, INVERSE_SOLUTION).trim();
}

/** Fire-and-forget warmup: kicks off WASM fetch + Tables build so the first
 *  real scramble call has zero perceived latency. Safe from effects on
 *  /scramble/gen mount. */
export function prewarmM2p(): void {
  getInstance().catch(() => { /* swallow; next real call will surface error */ });
}
