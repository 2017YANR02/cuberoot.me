/**
 * 3x3 random-state scrambler backed by min2phase-rust WASM.
 *
 * Same Kociemba two-phase family as cubing.js's `randomScrambleForEvent('333')`,
 * different implementation: cs0x7f's algorithm (bit-packed 4-bit pruning tables
 * + 3-axis search + pre-moves), ported to Rust + LTO release.
 *
 * The WASM bundle lives in /m2p/ (copied from the min2phase-rust repo's
 * pkg/ output). Lazy-loaded the first time `m2pScramble333()` is called so
 * /scramble/gen visitors who stay on the default (cubing.js) never pay for
 * its ~120 KB download + ~100 ms table-init.
 */

interface Min2Phase {
  solve(facelets: string): string;
  solveEx(facelets: string, maxDepth: number, probeMax: number, probeMin: number, verboseBits: number): string;
  randomCube(): string;
  fromScramble(scramble: string): string;
  applyMoves(state: string, scramble: string): string;
  lastLength(): number;
  free(): void;
}

interface Module {
  default(input?: string): Promise<unknown>;
  Min2Phase: new () => Min2Phase;
}

const INVERSE_SOLUTION = 0x2;

let modulePromise: Promise<Module> | null = null;
let instancePromise: Promise<Min2Phase> | null = null;

function loadModule(): Promise<Module> {
  if (modulePromise) return modulePromise;
  modulePromise = (async () => {
    // /m2p/* is served as-is from packages/client/public/m2p/. We MUST keep
    // Vite out of the transform pipeline (it would append ?import and try
    // to rewrite the wasm-bindgen glue), so the dynamic import is wrapped
    // in a Function constructor that Vite's static analysis can't see.
    const importFn = new Function('u', 'return import(u)') as (u: string) => Promise<Module>;
    const mod = await importFn('/m2p/m2p_wasm.js');
    await mod.default('/m2p/m2p_wasm_bg.wasm');
    return mod;
  })();
  return modulePromise;
}

function getInstance(): Promise<Min2Phase> {
  if (instancePromise) return instancePromise;
  instancePromise = (async () => {
    const mod = await loadModule();
    return new mod.Min2Phase(); // Tables::build(true) — ~100 ms in WASM
  })();
  return instancePromise;
}

/** Generate one WCA-spec random-state 3x3 scramble (~20.6 moves avg, max 21). */
export async function m2pScramble333(): Promise<string> {
  const m = await getInstance();
  const facelets = m.randomCube();
  // INVERSE_SOLUTION returns the scramble that takes a solved cube TO the
  // random state — i.e. the user-facing scramble.
  const scramble = m.solveEx(facelets, 21, 100_000, 0, INVERSE_SOLUTION);
  return scramble.trim();
}

/** Fire-and-forget warmup: kicks off the WASM fetch + table build so the
 *  first real scramble call has zero perceived latency. Safe to call from
 *  effects on /scramble/gen mount. */
export function prewarmM2p(): void {
  getInstance().catch(() => { /* swallow; next real call will surface error */ });
}

/** For the benchmark page — peek at how many moves the last scramble used.
 *  Length is set by `solveEx`, so call between scrambles. */
export async function m2pLastLength(): Promise<number> {
  const m = await getInstance();
  return m.lastLength();
}
