/* tslint:disable */
/* eslint-disable */

export function apply_rotates(rotates_desc: Uint32Array, group_indices_flat: Int32Array, group_indices_offsets: Uint32Array, vec_x: Float32Array, vec_y: Float32Array, vec_z: Float32Array, rot_idx: Uint8Array, flat: Int32Array, slice_insts: Int32Array, cube_compose: Uint8Array, order: number): void;

export function apply_rotates_no_flat(rotates_desc: Uint32Array, group_indices_flat: Int32Array, group_indices_offsets: Uint32Array, vec_x: Float32Array, vec_y: Float32Array, vec_z: Float32Array, rot_idx: Uint8Array, flat: Int32Array, slice_insts: Int32Array, cube_compose: Uint8Array, order: number): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly apply_rotates: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: any, j: number, k: number, l: any, m: number, n: number, o: any, p: number, q: number, r: any, s: number, t: number, u: any, v: number, w: number, x: any, y: number, z: number, a1: number) => void;
    readonly apply_rotates_no_flat: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: any, j: number, k: number, l: any, m: number, n: number, o: any, p: number, q: number, r: any, s: number, t: number, u: any, v: number, w: number, x: any, y: number, z: number, a1: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
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
