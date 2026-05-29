/* tslint:disable */
/* eslint-disable */

export class CrossSolverWasm {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * 用 6 张表的 .bin 字节构造(参数名即所需表)。
     */
    constructor(pt_cross: Uint8Array, pt_cross_c4e0: Uint8Array, mt_edge2: Uint8Array, mt_edge4: Uint8Array, mt_corn: Uint8Array, mt_edge: Uint8Array);
    /**
     * 单个变体的 6 视角最优步数(Uint32Array,长度 6)。
     * variant:0=cross,1=xc,2=xxc,3=xxxc,4=xxxxc。
     * 顺序对应 rot ["","z2","z'","z","x'","x"]。
     */
    solve(scramble: string, variant: number): Uint32Array;
    /**
     * 累计变体:一次返回 cross..variant 全部阶段,长度 (variant+1)*6。
     * 对应 analyzer 的 "cross,x" / "cross,x,xx" / "cross,x,xx,xxx" 选项。
     */
    solve_cumulative(scramble: string, variant: number): Uint32Array;
    /**
     * 单格步数:某变体在某 face(0..5)的最优步数。UI 逐格流式用,
     * 避免慢变体(xxxxc)一次算 6 视角干等。
     */
    solve_face(scramble: string, variant: number, face: number): number;
    /**
     * 单格(variant × face)多解步骤,返回 JSON 串。
     * variant:0=cross,1=xc,2=xxc,3=xxxc,4=xxxxc;face:0..5 对应 ROTS。
     * extra:允许超出最优的步数(0=只最优长度全部解);cap:最多收集条数。
     * 解步骤带视角前缀(face>0 时如 "z2 R U ..."),combo 是该格选中的 F2L 槽位。
     */
    solve_moves(scramble: string, variant: number, face: number, extra: number, cap: number): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_crosssolverwasm_free: (a: number, b: number) => void;
    readonly crosssolverwasm_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => number;
    readonly crosssolverwasm_solve: (a: number, b: number, c: number, d: number) => [number, number];
    readonly crosssolverwasm_solve_cumulative: (a: number, b: number, c: number, d: number) => [number, number];
    readonly crosssolverwasm_solve_face: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly crosssolverwasm_solve_moves: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
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
