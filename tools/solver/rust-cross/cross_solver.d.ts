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

/**
 * F2LEO / Pseudo F2LEO 浏览器内求解(count-only)。小表:复用 mt_edge2/edge4/corn/edge
 * + pt_cross(f2leo),pseudo 另现场建 4-seed cross + D-AUF xcross 剪枝表(~18MB)。
 * 不需要 pt_cross_C4E0 / huge 表。
 *
 * **惰性建表**:构造器只存表引用(~0ms),不建剪枝表;首次调到 f2leo / pseudo 时才
 * 各自建一次(~2s,RefCell 缓存)。这样 std-only 的 worker 完全不付这笔钱,且只想看
 * 一个变体时不会顺带建另一个。单线程 wasm 用 RefCell 做内部可变。
 */
export class F2leoSolverWasm {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * 5 张表:pt_cross(f2leo cross 剪枝)+ mt_edge2/edge4/corn/edge(两变体共用)。
     * 仅存引用,不建剪枝表(惰性,见 struct 文档)。
     */
    constructor(pt_cross: Uint8Array, mt_edge2: Uint8Array, mt_edge4: Uint8Array, mt_corn: Uint8Array, mt_edge: Uint8Array);
    /**
     * F2LEO 24 值:[cross×6, xcross×6, xxcross×6, xxxcross×6](6 = 已折叠 z0/z2/z3/z1/x3/x1)。
     */
    solve_f2leo(scramble: string): Uint32Array;
    /**
     * 单阶段 6 值(stage 0=cross/1=xc/2=xxc/3=xxxc)。cross 极快 → UI 先单算 cross 秒出,
     * 深阶段后台补。pseudo=true 走伪变体。
     */
    solve_f2leo_stage(scramble: string, pseudo: boolean, stage: number): Uint32Array;
    /**
     * Pseudo F2LEO 24 值,顺序同上。
     */
    solve_pseudo_f2leo(scramble: string): Uint32Array;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_crosssolverwasm_free: (a: number, b: number) => void;
    readonly __wbg_f2leosolverwasm_free: (a: number, b: number) => void;
    readonly crosssolverwasm_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => number;
    readonly crosssolverwasm_solve: (a: number, b: number, c: number, d: number) => [number, number];
    readonly crosssolverwasm_solve_cumulative: (a: number, b: number, c: number, d: number) => [number, number];
    readonly crosssolverwasm_solve_face: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly crosssolverwasm_solve_moves: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
    readonly f2leosolverwasm_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => number;
    readonly f2leosolverwasm_solve_f2leo: (a: number, b: number, c: number) => [number, number];
    readonly f2leosolverwasm_solve_f2leo_stage: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly f2leosolverwasm_solve_pseudo_f2leo: (a: number, b: number, c: number) => [number, number];
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
