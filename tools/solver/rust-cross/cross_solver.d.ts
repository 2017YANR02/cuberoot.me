/* tslint:disable */
/* eslint-disable */

/**
 * 2x2x2 块求解(1 角 + 3 棱)。表最小:mt_edge3 (~743KB) + mt_corn (~1.7KB),
 * 全空间精确距离表构造时现场 BFS(253,440 态,毫秒级)——查长度 O(1),枚举首达即最优。
 * 每视角 = 该底色 4 个贴底块;解前缀 = rot + y^k,`c` = 块标签(URF..DRB)。
 */
export class Block222SolverWasm {
    free(): void;
    [Symbol.dispose](): void;
    constructor(mt_edge3: Uint8Array, mt_corn: Uint8Array);
    /**
     * 6 视角最优步数(每视角 = 4 贴底块最小),顺序对应 ROTS。
     */
    solve(scramble: string): Uint32Array;
    /**
     * 单视角(face 0..5)最优步数。
     */
    solve_face(scramble: string, face: number): number;
    /**
     * 单视角多解 JSON(同 CrossSolverWasm::solve_moves 形状)。4 个贴底块合并枚举,
     * 按长度排序;`m` 前缀 = rot + y^k(1~2 个旋转 token),`c` = 块标签。
     */
    solve_moves(scramble: string, face: number, extra: number, cap: number): string;
}

/**
 * 链式求解器(mallard P3):EO→DR→HTR→[FR]→Finish 一次编排,单 HOME 帧,零表下载。
 * 惰性 ensure:首次 solve_chain 现场建 EOLine/DR(2×~1M)/HTR(2.8MB)/htr2(648KB)
 * 距离表(数秒);fr.enabled 的请求再惰性建 FR 陪集表(更慢,一次性)。
 */
export class ChainSolverWasm {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    /**
     * scramble + 配置 JSON(per-stage {enabled,extra,cap,min,max,axes,excluded} +
     * maxChains,'{}' = 默认)→ {"chains":[{"steps":[{kind,variant,m,len,cum}],
     * "total":N}]}。m = HOME 帧步骤串(无视角前缀)。打乱不可解析或无链 →
     * {"chains":[]} 哨兵;非法配置 JSON 整体回落默认配置。
     */
    solve_chain(scramble: string, config_json: string): string;
}

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
 * EOLine / DR 求解器(全自包含,**零表下载**):eo12/line/co8/slice 微 move 表与
 * 全部距离表现场从内置运动学构建。EOLine 即时构建(~1MB BFS);DR 惰性
 * (两张 ~1M 距离表,首次查询时建)。
 * stage 编号:0=EO 1=EOLine 2=DR。
 */
export class EoDrSolverWasm {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    /**
     * 单视角多解 JSON(同 Block222SolverWasm::solve_moves 形状)。`m` 前缀 =
     * rot + y^k;`c` = 目标标签(EO 轴 "FB" / EOLine "D(FB)" / DR 轴 "UD")。
     */
    solve_moves(scramble: string, stage: number, face: number, extra: number, cap: number): string;
    /**
     * 单阶段 6 视角(stage 0=EO 1=EOLine 2=DR),顺序对应 ROTS。
     * EO/DR 只依赖轴:对面底色列天然同值。
     */
    solve_stage(scramble: string, stage: number): Uint32Array;
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
     * 单格(F2LEO/Pseudo F2LEO × stage × face)多解步骤,返回 JSON {"len","combo","sols"}。
     * pseudo=false → F2LEO,true → Pseudo F2LEO;两者破坏 y 对称(同 eo),最优可能只在 rot·y
     * 帧达成,故步骤前缀用 enumerate_small 返回的真实帧(可能含尾 y,如 "x' y")。
     * stage:0=cross/1=xc/2=xxc/3=xxxc;extra:超出最优步数(0=只最优长度全部解);cap:最多条数。
     */
    solve_moves(scramble: string, pseudo: boolean, face: number, stage: number, extra: number, cap: number): string;
    /**
     * Pseudo F2LEO 24 值,顺序同上。
     */
    solve_pseudo_f2leo(scramble: string): Uint32Array;
}

/**
 * FR(Floppy Reduction,HTR/G3 → FR)求解器(全自包含,**零表下载**):H=⟨L2,R2,F2,B2⟩
 * 右陪集空间(3456 态)移动表 + 精确距离表全部现场从内置运动学构建,首次查询时惰性
 * BFS(RefCell,~秒级);查长度 O(1),枚举首达即最优。条件式阶段:该视角必须已处于
 * HTR/G3 子群,非 HTR 视角返回 u32::MAX 哨兵。对 y 不变;视角轴 = [UD,UD,LR,LR,FB,FB]。
 */
export class FrSolverWasm {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    /**
     * 6 视角最优步数(顺序对应 ROTS);该视角非 HTR = u32::MAX 哨兵。
     */
    solve(scramble: string): Uint32Array;
    /**
     * 单视角多解 JSON(同 HtrPhase2SolverWasm::solve_moves 形状)。FR 对 y 不变
     * (解全在 yk=0),`m` 前缀 = rot,`c` = 该视角 FR 轴标签(UD/FB/LR,同 DR);
     * 该视角非 HTR = {"len":4294967295,"sols":[]}。
     */
    solve_moves(scramble: string, face: number, extra: number, cap: number): string;
}

/**
 * HTR phase-2(G3 → solved,只走 6 双转)求解器(全自包含,**零表下载**):角置换/边轨道
 * 移动表与全空间 663,552 态精确距离表(~648KB)全部现场从内置运动学构建,首次查询时惰性
 * BFS(RefCell,~亚秒);查长度 O(1),枚举首达即最优。条件式阶段:该视角必须已处于 HTR/G3
 * 子群,非 HTR 视角返回 u32::MAX 哨兵。对 y 不变。
 */
export class HtrPhase2SolverWasm {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    /**
     * 6 视角最优步数(顺序对应 ROTS);该视角非 HTR = u32::MAX 哨兵。
     */
    solve(scramble: string): Uint32Array;
    /**
     * 单视角多解 JSON(同 HtrSolverWasm::solve_moves 形状)。HTR phase-2 对 y 不变
     * (解全在 yk=0),`m` 前缀 = rot,`c` = 轴标签(同 DR,如 "UD");
     * 该视角非 HTR = {"len":4294967295,"sols":[]}。
     */
    solve_moves(scramble: string, face: number, extra: number, cap: number): string;
}

/**
 * HTR(Thistlethwaite DR→HTR)求解器(全自包含,**零表下载**):角置换/轨道移动表与
 * 全空间 2,822,400 态精确距离表(~2.8MB)全部现场从内置运动学构建,首次查询时惰性 BFS
 * (RefCell,~秒级);查长度 O(1),枚举首达即最优。条件式阶段:该视角(UD 轴)必须已
 * 处于 DR,非 DR 视角返回 u32::MAX 哨兵。HTR 仅依赖轴:对面底色同值,且对 y 不变。
 */
export class HtrSolverWasm {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    /**
     * 6 视角最优步数(顺序对应 ROTS);该视角非 DR = u32::MAX 哨兵。
     */
    solve(scramble: string): Uint32Array;
    /**
     * 单视角多解 JSON(同 Block222SolverWasm::solve_moves 形状)。HTR 对 y 不变
     * (解全在 yk=0),`m` 前缀 = rot,`c` = 轴标签(同 DR,如 "UD");
     * 该视角非 DR = {"len":4294967295,"sols":[]}。
     */
    solve_moves(scramble: string, face: number, extra: number, cap: number): string;
}

/**
 * 2x2x2 口袋魔方整解最优求解器(全自包含,**零表下载**):3.6MB 全空间精确距离表
 * 首次查询时惰性现场 BFS(lean 构造,不存 132MB 联合移动表,RefCell 缓存)。
 * 任意态都可解(非条件式阶段,无哨兵);支持全 18 面转记号(2x2x2 无中心,
 * D/L/B 与对面只差整体旋转,24 旋转归一到固定 DBL 帧)。度量 HTM,God's number = 11。
 */
export class PocketSolverWasm {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    /**
     * 整解最优 HTM 步数(0..=11)。
     */
    solve(scramble: string): number;
    /**
     * 一条最优解 JSON(同 Block222SolverWasm::solve_moves 形状,单条):
     * {"len":N,"sols":[{"m":"x y' R U F2 ...","c":""}]}。`m` 前缀 = 整体旋转
     * (打乱含 D/L/B 时归一所需,可为空),`c` 恒空串(整解无槽位/视角语义)。
     */
    solve_moves(scramble: string): string;
}

/**
 * Roux 第一块(方块 / 1x2x3 / 双 1x2x3)+ Petrus(2x2x2 / 2x2x3)组合求解器。4 张小表:
 * mt_edge3 (~743KB) + mt_corn2 (~36KB) + mt_edge2 (~38KB) + mt_corn (~1.7KB)。
 * FB 方块与 2x2x2 全表构造时即建(微型/毫秒级);1x2x3 全表(5,322,240 态)与
 * 2x2x3 启发式表惰性构建(首次相关查询现场 BFS,~秒级);2x2x3 与 f2b 共享 1x2x3 表
 * (f2b 零额外构建:同一张表 y2 共轭双查 IDA*)。
 * stage 编号:0=FB 方块 1=1x2x3 2=2x2x2 3=2x2x3 4=双 1x2x3(f2b)。
 */
export class Roux223SolverWasm {
    free(): void;
    [Symbol.dispose](): void;
    constructor(mt_edge3: Uint8Array, mt_corn2: Uint8Array, mt_edge2: Uint8Array, mt_corn: Uint8Array);
    /**
     * 单视角多解 JSON(同 Block222SolverWasm::solve_moves 形状)。`m` 前缀 =
     * rot + y^k;`c` = 目标标签(方块 "DBL-L" / 1x2x3 "DL" / 2x2x2 角名 / 2x2x3 棱名 /
     * f2b "D(LR)" 块对)。
     */
    solve_moves(scramble: string, stage: number, face: number, extra: number, cap: number): string;
    /**
     * 单阶段 6 视角(stage 0=FB方块 1=1x2x3 2=2x2x2 3=2x2x3 4=双1x2x3),顺序对应 ROTS。
     */
    solve_stage(scramble: string, stage: number): Uint32Array;
}

/**
 * 其余 comp 变体的浏览器小表求解(count-only,逐格 bit-exact 对照大表/huge 路径)。
 * pair / eo / pseudo / pseudo_pair —— 各自 native analyzer 用 ~10GB+ huge 表「联合」
 * 验证多槽是否解出,wasm 装不下;这里复用各 solver 的 `*_small` cascade:显式逐槽
 * 追踪 + per-slot 小表(pt_cross_C4E0 等)既作可采纳下界又作 goal 验证,IDA* 首达即最优。
 * 惰性按变体建(RefCell),只想看一个变体不顺带建别的。
 *
 * variant 编号:0=pair,1=eo,2=pseudo,3=pseudo_pair(后三个待接)。
 */
export class VariantSolverWasm {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * 12 表:pair 用 mt_edge4/corn/edge + pt_cross_ins_C4 + pt_pair_C4E0 + pt_cross_C4E0;
     * eo 另用 pt_cross + pt_ep4eo12 + mt_edge2 + mt_eo12 + mt_eo12_alt + mt_ep4。
     * 仅存引用,惰性建 solver。(pseudo / pseudo_pair 接入时再扩。)
     */
    constructor(pt_cross_c4e0: Uint8Array, pt_cross_ins_c4: Uint8Array, pt_pair_c4e0: Uint8Array, mt_edge4: Uint8Array, mt_corn: Uint8Array, mt_edge: Uint8Array, pt_cross: Uint8Array, pt_ep4eo12: Uint8Array, mt_edge2: Uint8Array, mt_eo12: Uint8Array, mt_eo12_alt: Uint8Array, mt_ep4: Uint8Array, pt_pscross: Uint8Array);
    /**
     * 整变体 24(pair/pseudo/pseudo_pair,4 阶段)/ 30(eo,5 阶段)值 × 6 视角(物理面序 z0/z2/z3/z1/x3/x1)。
     */
    solve(scramble: string, variant: number): Uint32Array;
    /**
     * 单格(variant × stage × face)多解步骤,返回 JSON 串(同 CrossSolverWasm::solve_moves 形状
     * {"len","combo","sols"})。variant:0=pair,1=eo,2=pseudo,3=pseudo_pair;stage:0=cross 系起。
     * extra:超出最优的步数(0=只最优长度全部解);cap:最多收集条数。
     * 步骤带视角前缀:多数变体即 ROTS[face];**eo** 因破坏 y 对称,最优可能只在 rot·y 帧达成,
     * 故前缀用 enumerate_small 返回的真实帧(可能形如 "x' y",含两个旋转 token)。
     */
    solve_moves(scramble: string, variant: number, face: number, stage: number, extra: number, cap: number): string;
    /**
     * 单阶段 6 值。两遍 UI:先 cross(stage 0)秒出,深阶段后台补。
     */
    solve_stage(scramble: string, variant: number, stage: number): Uint32Array;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_block222solverwasm_free: (a: number, b: number) => void;
    readonly __wbg_chainsolverwasm_free: (a: number, b: number) => void;
    readonly __wbg_crosssolverwasm_free: (a: number, b: number) => void;
    readonly __wbg_eodrsolverwasm_free: (a: number, b: number) => void;
    readonly __wbg_f2leosolverwasm_free: (a: number, b: number) => void;
    readonly __wbg_frsolverwasm_free: (a: number, b: number) => void;
    readonly __wbg_htrphase2solverwasm_free: (a: number, b: number) => void;
    readonly __wbg_htrsolverwasm_free: (a: number, b: number) => void;
    readonly __wbg_pocketsolverwasm_free: (a: number, b: number) => void;
    readonly __wbg_roux223solverwasm_free: (a: number, b: number) => void;
    readonly __wbg_variantsolverwasm_free: (a: number, b: number) => void;
    readonly block222solverwasm_new: (a: number, b: number, c: number, d: number) => number;
    readonly block222solverwasm_solve: (a: number, b: number, c: number) => [number, number];
    readonly block222solverwasm_solve_face: (a: number, b: number, c: number, d: number) => number;
    readonly block222solverwasm_solve_moves: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly chainsolverwasm_new: () => number;
    readonly chainsolverwasm_solve_chain: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly crosssolverwasm_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => number;
    readonly crosssolverwasm_solve: (a: number, b: number, c: number, d: number) => [number, number];
    readonly crosssolverwasm_solve_cumulative: (a: number, b: number, c: number, d: number) => [number, number];
    readonly crosssolverwasm_solve_face: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly crosssolverwasm_solve_moves: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
    readonly eodrsolverwasm_new: () => number;
    readonly eodrsolverwasm_solve_moves: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
    readonly eodrsolverwasm_solve_stage: (a: number, b: number, c: number, d: number) => [number, number];
    readonly f2leosolverwasm_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => number;
    readonly f2leosolverwasm_solve_f2leo: (a: number, b: number, c: number) => [number, number];
    readonly f2leosolverwasm_solve_f2leo_stage: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly f2leosolverwasm_solve_moves: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
    readonly f2leosolverwasm_solve_pseudo_f2leo: (a: number, b: number, c: number) => [number, number];
    readonly frsolverwasm_new: () => number;
    readonly frsolverwasm_solve: (a: number, b: number, c: number) => [number, number];
    readonly frsolverwasm_solve_moves: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly htrphase2solverwasm_new: () => number;
    readonly htrphase2solverwasm_solve: (a: number, b: number, c: number) => [number, number];
    readonly htrphase2solverwasm_solve_moves: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly htrsolverwasm_new: () => number;
    readonly htrsolverwasm_solve: (a: number, b: number, c: number) => [number, number];
    readonly htrsolverwasm_solve_moves: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly pocketsolverwasm_new: () => number;
    readonly pocketsolverwasm_solve: (a: number, b: number, c: number) => number;
    readonly pocketsolverwasm_solve_moves: (a: number, b: number, c: number) => [number, number];
    readonly roux223solverwasm_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
    readonly roux223solverwasm_solve_moves: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
    readonly roux223solverwasm_solve_stage: (a: number, b: number, c: number, d: number) => [number, number];
    readonly variantsolverwasm_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number, y: number, z: number) => number;
    readonly variantsolverwasm_solve: (a: number, b: number, c: number, d: number) => [number, number];
    readonly variantsolverwasm_solve_moves: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
    readonly variantsolverwasm_solve_stage: (a: number, b: number, c: number, d: number, e: number) => [number, number];
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
