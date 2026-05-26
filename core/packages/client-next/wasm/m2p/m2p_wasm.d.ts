/* tslint:disable */
/* eslint-disable */

export class Min2Phase {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Apply a WCA scramble to an existing facelet state. Useful for
     * verifying a solution by applying it back to the scrambled cube.
     */
    applyMoves(facelets: string, scramble: string): string;
    /**
     * Convert WCA scramble string ("R U R'") to 54-char facelet string.
     */
    fromScramble(scramble: string): string;
    /**
     * Length of the last solution (in moves).
     */
    lastLength(): number;
    /**
     * Number of phase-2 probes used by the last solve.
     */
    lastProbes(): number;
    /**
     * Build with full pruning tables. ~80-150ms in WASM (slower than native).
     */
    constructor();
    /**
     * Continue searching for shorter solutions after a previous solve().
     * Same forward-solution semantics as `solve`.
     */
    next(probe_max: number, probe_min: number): string;
    /**
     * Generate a uniformly-random cube as a 54-char facelet string.
     */
    randomCube(): string;
    /**
     * Solve a 54-char facelet string with max_depth=21, probe_max=100_000.
     * Returns the FORWARD solution (apply it to the input cube to reach
     * solved). Throws on parse / verify / probe-limit errors.
     */
    solve(facelets: string): string;
    /**
     * Solve with custom parameters.
     */
    solveEx(facelets: string, max_depth: number, probe_max: number, probe_min: number, verbose_bits: number): string;
    /**
     * Super-flip state — known 20-move-optimal hard case.
     */
    superFlip(): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_min2phase_free: (a: number, b: number) => void;
    readonly min2phase_applyMoves: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly min2phase_fromScramble: (a: number, b: number, c: number) => [number, number];
    readonly min2phase_lastLength: (a: number) => number;
    readonly min2phase_lastProbes: (a: number) => number;
    readonly min2phase_new: () => number;
    readonly min2phase_next: (a: number, b: number, c: number) => [number, number, number, number];
    readonly min2phase_randomCube: (a: number) => [number, number];
    readonly min2phase_solve: (a: number, b: number, c: number) => [number, number, number, number];
    readonly min2phase_solveEx: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly min2phase_superFlip: (a: number) => [number, number];
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
