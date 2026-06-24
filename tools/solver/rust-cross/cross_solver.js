/* @ts-self-types="./cross_solver.d.ts" */

/**
 * 2x2x2 块求解(1 角 + 3 棱)。表最小:mt_edge3 (~743KB) + mt_corn (~1.7KB),
 * 全空间精确距离表构造时现场 BFS(253,440 态,毫秒级)——查长度 O(1),枚举首达即最优。
 * 每视角 = 该底色 4 个贴底块;解前缀 = rot + y^k,`c` = 块标签(URF..DRB)。
 */
export class Block222SolverWasm {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        Block222SolverWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_block222solverwasm_free(ptr, 0);
    }
    /**
     * @param {Uint8Array} mt_edge3
     * @param {Uint8Array} mt_corn
     */
    constructor(mt_edge3, mt_corn) {
        const ptr0 = passArray8ToWasm0(mt_edge3, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(mt_corn, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.block222solverwasm_new(ptr0, len0, ptr1, len1);
        this.__wbg_ptr = ret;
        Block222SolverWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 6 视角最优步数(每视角 = 4 贴底块最小),顺序对应 ROTS。
     * @param {string} scramble
     * @returns {Uint32Array}
     */
    solve(scramble) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.block222solverwasm_solve(this.__wbg_ptr, ptr0, len0);
        var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
    /**
     * 单视角(face 0..5)最优步数。
     * @param {string} scramble
     * @param {number} face
     * @returns {number}
     */
    solve_face(scramble, face) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.block222solverwasm_solve_face(this.__wbg_ptr, ptr0, len0, face);
        return ret >>> 0;
    }
    /**
     * 单视角多解 JSON(同 CrossSolverWasm::solve_moves 形状)。4 个贴底块合并枚举,
     * 按长度排序;`m` 前缀 = rot + y^k(1~2 个旋转 token),`c` = 块标签。
     * @param {string} scramble
     * @param {number} face
     * @param {number} extra
     * @param {number} cap
     * @returns {string}
     */
    solve_moves(scramble, face, extra, cap) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.block222solverwasm_solve_moves(this.__wbg_ptr, ptr0, len0, face, extra, cap);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
}
if (Symbol.dispose) Block222SolverWasm.prototype[Symbol.dispose] = Block222SolverWasm.prototype.free;

/**
 * 链式求解器(mallard P3):EO→DR→HTR→[FR]→Finish 一次编排,单 HOME 帧,零表下载。
 * 惰性 ensure:首次 solve_chain 现场建 EOLine/DR(2×~1M)/HTR(2.8MB)/htr2(648KB)
 * 距离表(数秒);fr.enabled 的请求再惰性建 FR 陪集表(更慢,一次性)。
 */
export class ChainSolverWasm {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ChainSolverWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_chainsolverwasm_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.chainsolverwasm_new();
        this.__wbg_ptr = ret;
        ChainSolverWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * scramble + 配置 JSON(per-stage {enabled,extra,cap,min,max,axes,excluded,
     * niss} + maxChains,'{}' = 默认;niss 默认 eo/dr/htr/fr 开、fin 强制关)→
     * {"chains":[{"steps":[{kind,variant,m,len,cum,inv?}],"solution":"...",
     * "total":N}]}。m = 该步 HOME 帧串(无视角前缀);"inv":true = 整步做在
     * inverse 打乱上(NISS-Before);solution = 线性化最终解 N ++ rev_inv(I)
     * (normal 打乱上单序列),total = 其长度;cum = 截至该步总步数 N.len+I.len。
     * excluded 串 = 「累计 N '|' 累计 I」(无 '|' = I 空,向后兼容)。打乱不可
     * 解析或无链 → {"chains":[]} 哨兵;非法配置 JSON 整体回落默认配置。
     * @param {string} scramble
     * @param {string} config_json
     * @returns {string}
     */
    solve_chain(scramble, config_json) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(config_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ret = wasm.chainsolverwasm_solve_chain(this.__wbg_ptr, ptr0, len0, ptr1, len1);
            deferred3_0 = ret[0];
            deferred3_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
}
if (Symbol.dispose) ChainSolverWasm.prototype[Symbol.dispose] = ChainSolverWasm.prototype.free;

/**
 * Cross restricted optimal 求解器(任意受限 54-move 集 + 中心朝向)。
 * 运行时建表(无外部表文件):coord_trans(190080*54)+ center_trans(24*54),
 * 构造即建好。`solve_cross_restricted` 走 BFS,首达即最优。
 */
export class CrossRestrictSolverWasm {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CrossRestrictSolverWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_crossrestrictsolverwasm_free(ptr, 0);
    }
    /**
     * 无需任何表字节,构造时现场建全部 transition 表。
     */
    constructor() {
        const ret = wasm.crossrestrictsolverwasm_new();
        this.__wbg_ptr = ret;
        CrossRestrictSolverWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 受限最优十字求解(从角度 `face` 看的十字),返回空格分隔的步骤串("" = 受限下不可解)。
     * `scramble`:面动打乱串(只认 18 面动名)。
     * `face`:0..5 视角(对应 analyzer 的 ROTS = ["","z2","z'","z","x'","x"]);
     *         等价于 `search_cross(alg, ROTS[face])`,内部走逐 move 共轭。
     * 54-bit allowed mask = (allowed_hi << 32) | allowed_lo(bit m = 1 表示 move m 允许)。
     * `max_rot_count`:整体旋转动(x/y/z)在解里的最大个数。
     * center_offset 固定 = [0](终态中心必须复原)。
     * @param {string} scramble
     * @param {number} face
     * @param {number} allowed_lo
     * @param {number} allowed_hi
     * @param {number} max_rot_count
     * @returns {string}
     */
    solve_cross_restricted(scramble, face, allowed_lo, allowed_hi, max_rot_count) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.crossrestrictsolverwasm_solve_cross_restricted(this.__wbg_ptr, ptr0, len0, face, allowed_lo, allowed_hi, max_rot_count);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * 受限最优十字「多解枚举」(对齐 analyzer「最大数量」):返回 JSON `{len, sols:[{m,c}]}`,
     * 解按长度升序、长度 ∈ [最优, 最优+extra]、最多 `cap` 条;空集 → len = u32::MAX 哨兵。
     * `c` 恒空串(cross 无 F2L 槽)。参数同 `solve_cross_restricted` + extra/cap。
     * @param {string} scramble
     * @param {number} face
     * @param {number} allowed_lo
     * @param {number} allowed_hi
     * @param {number} max_rot_count
     * @param {number} extra
     * @param {number} cap
     * @returns {string}
     */
    solve_cross_restricted_moves(scramble, face, allowed_lo, allowed_hi, max_rot_count, extra, cap) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.crossrestrictsolverwasm_solve_cross_restricted_moves(this.__wbg_ptr, ptr0, len0, face, allowed_lo, allowed_hi, max_rot_count, extra, cap);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
}
if (Symbol.dispose) CrossRestrictSolverWasm.prototype[Symbol.dispose] = CrossRestrictSolverWasm.prototype.free;

export class CrossSolverWasm {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CrossSolverWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_crosssolverwasm_free(ptr, 0);
    }
    /**
     * 用 6 张表的 .bin 字节构造(参数名即所需表)。
     * @param {Uint8Array} pt_cross
     * @param {Uint8Array} pt_cross_c4e0
     * @param {Uint8Array} mt_edge2
     * @param {Uint8Array} mt_edge4
     * @param {Uint8Array} mt_corn
     * @param {Uint8Array} mt_edge
     */
    constructor(pt_cross, pt_cross_c4e0, mt_edge2, mt_edge4, mt_corn, mt_edge) {
        const ptr0 = passArray8ToWasm0(pt_cross, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(pt_cross_c4e0, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(mt_edge2, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArray8ToWasm0(mt_edge4, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passArray8ToWasm0(mt_corn, wasm.__wbindgen_malloc);
        const len4 = WASM_VECTOR_LEN;
        const ptr5 = passArray8ToWasm0(mt_edge, wasm.__wbindgen_malloc);
        const len5 = WASM_VECTOR_LEN;
        const ret = wasm.crosssolverwasm_new(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5);
        this.__wbg_ptr = ret;
        CrossSolverWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 单个变体的 6 视角最优步数(Uint32Array,长度 6)。
     * variant:0=cross,1=xc,2=xxc,3=xxxc,4=xxxxc。
     * 顺序对应 rot ["","z2","z'","z","x'","x"]。
     * @param {string} scramble
     * @param {number} variant
     * @returns {Uint32Array}
     */
    solve(scramble, variant) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.crosssolverwasm_solve(this.__wbg_ptr, ptr0, len0, variant);
        var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
    /**
     * 累计变体:一次返回 cross..variant 全部阶段,长度 (variant+1)*6。
     * 对应 analyzer 的 "cross,x" / "cross,x,xx" / "cross,x,xx,xxx" 选项。
     * @param {string} scramble
     * @param {number} variant
     * @returns {Uint32Array}
     */
    solve_cumulative(scramble, variant) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.crosssolverwasm_solve_cumulative(this.__wbg_ptr, ptr0, len0, variant);
        var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
    /**
     * 单格步数:某变体在某 face(0..5)的最优步数。UI 逐格流式用,
     * 避免慢变体(xxxxc)一次算 6 视角干等。
     * @param {string} scramble
     * @param {number} variant
     * @param {number} face
     * @returns {number}
     */
    solve_face(scramble, variant, face) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.crosssolverwasm_solve_face(this.__wbg_ptr, ptr0, len0, variant, face);
        return ret >>> 0;
    }
    /**
     * 受限步法版 solve_face:`mask` = 18 个 move 的 bitmask(bit m=1 表示 move m 允许)。
     * cross(variant 0)走 CrossSolver masked;xcross/F2L(variant 1..=4)走 XCrossSolver
     * 小表 cascade masked(per-slot pt_cross_C4E0 可采纳下界,XCROSS_MASK_DEPTH 封顶)。
     * 限制下(或深解超界)无解返回 u32::MAX 哨兵(client 显示 '-')。
     * @param {string} scramble
     * @param {number} variant
     * @param {number} face
     * @param {number} mask
     * @returns {number}
     */
    solve_face_masked(scramble, variant, face, mask) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.crosssolverwasm_solve_face_masked(this.__wbg_ptr, ptr0, len0, variant, face, mask);
        return ret >>> 0;
    }
    /**
     * 单格(variant × face)多解步骤,返回 JSON 串。
     * variant:0=cross,1=xc,2=xxc,3=xxxc,4=xxxxc;face:0..5 对应 ROTS。
     * extra:允许超出最优的步数(0=只最优长度全部解);cap:最多收集条数。
     * 解步骤带视角前缀(face>0 时如 "z2 R U ..."),combo 是该格选中的 F2L 槽位。
     * @param {string} scramble
     * @param {number} variant
     * @param {number} face
     * @param {number} extra
     * @param {number} cap
     * @param {string} combo
     * @param {Function} on_sol
     * @returns {string}
     */
    solve_moves(scramble, variant, face, extra, cap, combo, on_sol) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(combo, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ret = wasm.crosssolverwasm_solve_moves(this.__wbg_ptr, ptr0, len0, variant, face, extra, cap, ptr1, len1, on_sol);
            deferred3_0 = ret[0];
            deferred3_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * 受限步法版 solve_moves(同 solve_moves 形状)。cross 走 enumerate_solutions_masked;
     * xcross/F2L(variant 1..=4)走 XCrossSolver enumerate_best_masked / enumerate_combo_masked。
     * 限制下(或深解超界)无解 → len=u32::MAX 哨兵 + 空解集。
     * @param {string} scramble
     * @param {number} variant
     * @param {number} face
     * @param {number} extra
     * @param {number} cap
     * @param {string} combo
     * @param {number} mask
     * @param {Function} on_sol
     * @returns {string}
     */
    solve_moves_masked(scramble, variant, face, extra, cap, combo, mask, on_sol) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(combo, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ret = wasm.crosssolverwasm_solve_moves_masked(this.__wbg_ptr, ptr0, len0, variant, face, extra, cap, ptr1, len1, mask, on_sol);
            deferred3_0 = ret[0];
            deferred3_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
}
if (Symbol.dispose) CrossSolverWasm.prototype[Symbol.dispose] = CrossSolverWasm.prototype.free;

/**
 * 2x2x2 口袋魔方整解最优求解器(全自包含,**零表下载**):3.6MB 全空间精确距离表
 * 首次查询时惰性现场 BFS(lean 构造,不存 132MB 联合移动表,RefCell 缓存)。
 * 任意态都可解(非条件式阶段,无哨兵);支持全 18 面转记号(2x2x2 无中心,
 * D/L/B 与对面只差整体旋转,24 旋转归一到固定 DBL 帧)。度量 HTM,God's number = 11。
 */
export class Cube222SolverWasm {
    static __wrap(ptr) {
        const obj = Object.create(Cube222SolverWasm.prototype);
        obj.__wbg_ptr = ptr;
        Cube222SolverWasmFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        Cube222SolverWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_cube222solverwasm_free(ptr, 0);
    }
    /**
     * 用预算好的全空间距离表(3,674,160 字节)即时构造(秒算:静态资源直载,
     * 跳过现场 BFS)。worker 拉 opt_222.bin.gz 解压后传入。
     * @param {Uint8Array} dist
     * @returns {Cube222SolverWasm}
     */
    static from_dist(dist) {
        const ptr0 = passArray8ToWasm0(dist, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.cube222solverwasm_from_dist(ptr0, len0);
        return Cube222SolverWasm.__wrap(ret);
    }
    constructor() {
        const ret = wasm.cube222solverwasm_new();
        this.__wbg_ptr = ret;
        Cube222SolverWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 整解最优 HTM 步数(0..=11)。
     * @param {string} scramble
     * @returns {number}
     */
    solve(scramble) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.cube222solverwasm_solve(this.__wbg_ptr, ptr0, len0);
        return ret >>> 0;
    }
    /**
     * 一条最优解 JSON(同 Block222SolverWasm::solve_moves 形状,单条):
     * {"len":N,"sols":[{"m":"x y' R U F2 ...","c":""}]}。`m` 前缀 = 整体旋转
     * (打乱含 D/L/B 时归一所需,可为空),`c` 恒空串(整解无槽位/视角语义)。
     * @param {string} scramble
     * @returns {string}
     */
    solve_moves(scramble) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.cube222solverwasm_solve_moves(this.__wbg_ptr, ptr0, len0);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
}
if (Symbol.dispose) Cube222SolverWasm.prototype[Symbol.dispose] = Cube222SolverWasm.prototype.free;

/**
 * EOLine / DR 求解器(全自包含,**零表下载**):eo12/line/co8/slice 微 move 表与
 * 全部距离表现场从内置运动学构建。EOLine 即时构建(~1MB BFS);DR 惰性
 * (两张 ~1M 距离表,首次查询时建)。
 * stage 编号:0=EO 1=EOLine 2=DR。
 */
export class EoDrSolverWasm {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EoDrSolverWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_eodrsolverwasm_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.eodrsolverwasm_new();
        this.__wbg_ptr = ret;
        EoDrSolverWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 单视角多解 JSON(同 Block222SolverWasm::solve_moves 形状)。`m` 前缀 =
     * rot + y^k;`c` = 目标标签(EO 轴 "FB" / EOLine "D(FB)" / DR 轴 "UD")。
     * @param {string} scramble
     * @param {number} stage
     * @param {number} face
     * @param {number} extra
     * @param {number} cap
     * @returns {string}
     */
    solve_moves(scramble, stage, face, extra, cap) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.eodrsolverwasm_solve_moves(this.__wbg_ptr, ptr0, len0, stage, face, extra, cap);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * 单阶段 6 视角(stage 0=EO 1=EOLine 2=DR),顺序对应 ROTS。
     * EO/DR 只依赖轴:对面底色列天然同值。
     * @param {string} scramble
     * @param {number} stage
     * @returns {Uint32Array}
     */
    solve_stage(scramble, stage) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.eodrsolverwasm_solve_stage(this.__wbg_ptr, ptr0, len0, stage);
        var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
}
if (Symbol.dispose) EoDrSolverWasm.prototype[Symbol.dispose] = EoDrSolverWasm.prototype.free;

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
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        F2leoSolverWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_f2leosolverwasm_free(ptr, 0);
    }
    /**
     * 5 张表:pt_cross(f2leo cross 剪枝)+ mt_edge2/edge4/corn/edge(两变体共用)。
     * 仅存引用,不建剪枝表(惰性,见 struct 文档)。
     * @param {Uint8Array} pt_cross
     * @param {Uint8Array} mt_edge2
     * @param {Uint8Array} mt_edge4
     * @param {Uint8Array} mt_corn
     * @param {Uint8Array} mt_edge
     */
    constructor(pt_cross, mt_edge2, mt_edge4, mt_corn, mt_edge) {
        const ptr0 = passArray8ToWasm0(pt_cross, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(mt_edge2, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(mt_edge4, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArray8ToWasm0(mt_corn, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passArray8ToWasm0(mt_edge, wasm.__wbindgen_malloc);
        const len4 = WASM_VECTOR_LEN;
        const ret = wasm.f2leosolverwasm_new(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
        this.__wbg_ptr = ret;
        F2leoSolverWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * F2LEO 24 值:[cross×6, xcross×6, xxcross×6, xxxcross×6](6 = 已折叠 z0/z2/z3/z1/x3/x1)。
     * @param {string} scramble
     * @returns {Uint32Array}
     */
    solve_f2leo(scramble) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.f2leosolverwasm_solve_f2leo(this.__wbg_ptr, ptr0, len0);
        var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
    /**
     * 单阶段 6 值(stage 0=cross/1=xc/2=xxc/3=xxxc)。cross 极快 → UI 先单算 cross 秒出,
     * 深阶段后台补。pseudo=true 走伪变体。
     * @param {string} scramble
     * @param {boolean} pseudo
     * @param {number} stage
     * @returns {Uint32Array}
     */
    solve_f2leo_stage(scramble, pseudo, stage) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.f2leosolverwasm_solve_f2leo_stage(this.__wbg_ptr, ptr0, len0, pseudo, stage);
        var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
    /**
     * 受限步法版 solve_f2leo_stage:`mask` = 18 个 move 的 bitmask。限制下无解的视角
     * 返回 u32::MAX 哨兵(client 显示 '-')。variant_mask_depth(mask) 封顶。
     * @param {string} scramble
     * @param {boolean} pseudo
     * @param {number} stage
     * @param {number} mask
     * @returns {Uint32Array}
     */
    solve_f2leo_stage_masked(scramble, pseudo, stage, mask) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.f2leosolverwasm_solve_f2leo_stage_masked(this.__wbg_ptr, ptr0, len0, pseudo, stage, mask);
        var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
    /**
     * 单格(F2LEO/Pseudo F2LEO × stage × face)多解步骤,返回 JSON {"len","combo","sols"}。
     * pseudo=false → F2LEO,true → Pseudo F2LEO;两者破坏 y 对称(同 eo),最优可能只在 rot·y
     * 帧达成,故步骤前缀用 enumerate_small 返回的真实帧(可能含尾 y,如 "x' y")。
     * stage:0=cross/1=xc/2=xxc/3=xxxc;extra:超出最优步数(0=只最优长度全部解);cap:最多条数。
     * @param {string} scramble
     * @param {boolean} pseudo
     * @param {number} face
     * @param {number} stage
     * @param {number} extra
     * @param {number} cap
     * @param {string} combo
     * @returns {string}
     */
    solve_moves(scramble, pseudo, face, stage, extra, cap, combo) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(combo, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ret = wasm.f2leosolverwasm_solve_moves(this.__wbg_ptr, ptr0, len0, pseudo, face, stage, extra, cap, ptr1, len1);
            deferred3_0 = ret[0];
            deferred3_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * 受限步法版 solve_moves(同形 JSON)。限制下(或超界)无解 → len=u32::MAX 哨兵 + 空解集。
     * @param {string} scramble
     * @param {boolean} pseudo
     * @param {number} face
     * @param {number} stage
     * @param {number} extra
     * @param {number} cap
     * @param {string} combo
     * @param {number} mask
     * @returns {string}
     */
    solve_moves_masked(scramble, pseudo, face, stage, extra, cap, combo, mask) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(combo, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ret = wasm.f2leosolverwasm_solve_moves_masked(this.__wbg_ptr, ptr0, len0, pseudo, face, stage, extra, cap, ptr1, len1, mask);
            deferred3_0 = ret[0];
            deferred3_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * Pseudo F2LEO 24 值,顺序同上。
     * @param {string} scramble
     * @returns {Uint32Array}
     */
    solve_pseudo_f2leo(scramble) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.f2leosolverwasm_solve_pseudo_f2leo(this.__wbg_ptr, ptr0, len0);
        var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
}
if (Symbol.dispose) F2leoSolverWasm.prototype[Symbol.dispose] = F2leoSolverWasm.prototype.free;

/**
 * FR(Floppy Reduction,HTR/G3 → FR)求解器(全自包含,**零表下载**):H=⟨L2,R2,F2,B2⟩
 * 右陪集空间(3456 态)移动表 + 精确距离表全部现场从内置运动学构建,首次查询时惰性
 * BFS(RefCell,~秒级);查长度 O(1),枚举首达即最优。条件式阶段:该视角必须已处于
 * HTR/G3 子群,非 HTR 视角返回 u32::MAX 哨兵。对 y 不变;视角轴 = [UD,UD,LR,LR,FB,FB]。
 */
export class FrSolverWasm {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FrSolverWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_frsolverwasm_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.frsolverwasm_new();
        this.__wbg_ptr = ret;
        FrSolverWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 6 视角最优步数(顺序对应 ROTS);该视角非 HTR = u32::MAX 哨兵。
     * @param {string} scramble
     * @returns {Uint32Array}
     */
    solve(scramble) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.frsolverwasm_solve(this.__wbg_ptr, ptr0, len0);
        var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
    /**
     * 单视角多解 JSON(同 HtrPhase2SolverWasm::solve_moves 形状)。FR 对 y 不变
     * (解全在 yk=0),`m` 前缀 = rot,`c` = 该视角 FR 轴标签(UD/FB/LR,同 DR);
     * 该视角非 HTR = {"len":4294967295,"sols":[]}。
     * @param {string} scramble
     * @param {number} face
     * @param {number} extra
     * @param {number} cap
     * @returns {string}
     */
    solve_moves(scramble, face, extra, cap) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.frsolverwasm_solve_moves(this.__wbg_ptr, ptr0, len0, face, extra, cap);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
}
if (Symbol.dispose) FrSolverWasm.prototype[Symbol.dispose] = FrSolverWasm.prototype.free;

/**
 * HTR phase-2(G3 → solved,只走 6 双转)求解器(全自包含,**零表下载**):角置换/边轨道
 * 移动表与全空间 663,552 态精确距离表(~648KB)全部现场从内置运动学构建,首次查询时惰性
 * BFS(RefCell,~亚秒);查长度 O(1),枚举首达即最优。条件式阶段:该视角必须已处于 HTR/G3
 * 子群,非 HTR 视角返回 u32::MAX 哨兵。对 y 不变。
 */
export class HtrPhase2SolverWasm {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        HtrPhase2SolverWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_htrphase2solverwasm_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.htrphase2solverwasm_new();
        this.__wbg_ptr = ret;
        HtrPhase2SolverWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 6 视角最优步数(顺序对应 ROTS);该视角非 HTR = u32::MAX 哨兵。
     * @param {string} scramble
     * @returns {Uint32Array}
     */
    solve(scramble) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.htrphase2solverwasm_solve(this.__wbg_ptr, ptr0, len0);
        var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
    /**
     * 单视角多解 JSON(同 HtrSolverWasm::solve_moves 形状)。HTR phase-2 对 y 不变
     * (解全在 yk=0),`m` 前缀 = rot,`c` = 轴标签(同 DR,如 "UD");
     * 该视角非 HTR = {"len":4294967295,"sols":[]}。
     * @param {string} scramble
     * @param {number} face
     * @param {number} extra
     * @param {number} cap
     * @returns {string}
     */
    solve_moves(scramble, face, extra, cap) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.htrphase2solverwasm_solve_moves(this.__wbg_ptr, ptr0, len0, face, extra, cap);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
}
if (Symbol.dispose) HtrPhase2SolverWasm.prototype[Symbol.dispose] = HtrPhase2SolverWasm.prototype.free;

/**
 * HTR(Thistlethwaite DR→HTR)求解器(全自包含,**零表下载**):角置换/轨道移动表与
 * 全空间 2,822,400 态精确距离表(~2.8MB)全部现场从内置运动学构建,首次查询时惰性 BFS
 * (RefCell,~秒级);查长度 O(1),枚举首达即最优。条件式阶段:该视角(UD 轴)必须已
 * 处于 DR,非 DR 视角返回 u32::MAX 哨兵。HTR 仅依赖轴:对面底色同值,且对 y 不变。
 */
export class HtrSolverWasm {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        HtrSolverWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_htrsolverwasm_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.htrsolverwasm_new();
        this.__wbg_ptr = ret;
        HtrSolverWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 6 视角最优步数(顺序对应 ROTS);该视角非 DR = u32::MAX 哨兵。
     * @param {string} scramble
     * @returns {Uint32Array}
     */
    solve(scramble) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.htrsolverwasm_solve(this.__wbg_ptr, ptr0, len0);
        var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
    /**
     * 单视角多解 JSON(同 Block222SolverWasm::solve_moves 形状)。HTR 对 y 不变
     * (解全在 yk=0),`m` 前缀 = rot,`c` = 轴标签(同 DR,如 "UD");
     * 该视角非 DR = {"len":4294967295,"sols":[]}。
     * @param {string} scramble
     * @param {number} face
     * @param {number} extra
     * @param {number} cap
     * @returns {string}
     */
    solve_moves(scramble, face, extra, cap) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.htrsolverwasm_solve_moves(this.__wbg_ptr, ptr0, len0, face, extra, cap);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
}
if (Symbol.dispose) HtrSolverWasm.prototype[Symbol.dispose] = HtrSolverWasm.prototype.free;

/**
 * Pyraminx(金字塔)整解最优求解器(全自包含,**零表下载**):0.9MB 核心全空间
 * 精确距离表首次查询时惰性现场 BFS(lean 构造,不存 29.9MB 联合移动表,RefCell
 * 缓存)。吃全 WCA pyram 记号(大写 U/L/R/B 核心 + 小写 u/l/r/b 顶点,可带 '/2,
 * 阶 3 下 X2 = X');非法记号抛 JS 异常。口径(精确):总 HTM = 核心查表最优 +
 * #错位 tips。God's number 核心 11 / 含 tips 15。
 */
export class PyraminxSolverWasm {
    static __wrap(ptr) {
        const obj = Object.create(PyraminxSolverWasm.prototype);
        obj.__wbg_ptr = ptr;
        PyraminxSolverWasmFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PyraminxSolverWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_pyraminxsolverwasm_free(ptr, 0);
    }
    /**
     * 用预算好的核心全空间距离表(933,120 字节)即时构造(秒算:静态资源直载,
     * 跳过现场 BFS)。worker 拉 opt_pyraminx.bin.gz 解压后传入。
     * @param {Uint8Array} dist
     * @returns {PyraminxSolverWasm}
     */
    static from_dist(dist) {
        const ptr0 = passArray8ToWasm0(dist, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.pyraminxsolverwasm_from_dist(ptr0, len0);
        return PyraminxSolverWasm.__wrap(ret);
    }
    constructor() {
        const ret = wasm.pyraminxsolverwasm_new();
        this.__wbg_ptr = ret;
        PyraminxSolverWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 整解最优 HTM 步数(0..=15,含 tips)。非法记号 → Err(JS 异常)。
     * @param {string} scramble
     * @returns {number}
     */
    solve(scramble) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.pyraminxsolverwasm_solve(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
    /**
     * 一条最优解 JSON(同 Cube222SolverWasm::solve_moves 形状,单条):
     * {"len":N,"sols":[{"m":"U L' B ... r b'","c":""}]}。`m` = 核心大写解 +
     * 小写 tip 收尾(无整体旋转前缀),`c` 恒空串。非法记号 → Err(JS 异常)。
     * @param {string} scramble
     * @returns {string}
     */
    solve_moves(scramble) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.pyraminxsolverwasm_solve_moves(this.__wbg_ptr, ptr0, len0);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
}
if (Symbol.dispose) PyraminxSolverWasm.prototype[Symbol.dispose] = PyraminxSolverWasm.prototype.free;

/**
 * Roux 第一块(方块 / 1x2x3 / 双 1x2x3)+ Petrus(2x2x2 / 2x2x3)组合求解器。4 张小表:
 * mt_edge3 (~743KB) + mt_corn2 (~36KB) + mt_edge2 (~38KB) + mt_corn (~1.7KB)。
 * FB 方块与 2x2x2 全表构造时即建(微型/毫秒级);1x2x3 全表(5,322,240 态)与
 * 2x2x3 启发式表惰性构建(首次相关查询现场 BFS,~秒级);2x2x3 与 f2b 共享 1x2x3 表
 * (f2b 零额外构建:同一张表 y2 共轭双查 IDA*)。
 * stage 编号:0=FB 方块 1=1x2x3 2=2x2x2 3=2x2x3 4=双 1x2x3(f2b)。
 */
export class Roux223SolverWasm {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        Roux223SolverWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_roux223solverwasm_free(ptr, 0);
    }
    /**
     * @param {Uint8Array} mt_edge3
     * @param {Uint8Array} mt_corn2
     * @param {Uint8Array} mt_edge2
     * @param {Uint8Array} mt_corn
     */
    constructor(mt_edge3, mt_corn2, mt_edge2, mt_corn) {
        const ptr0 = passArray8ToWasm0(mt_edge3, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(mt_corn2, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(mt_edge2, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArray8ToWasm0(mt_corn, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.roux223solverwasm_new(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
        this.__wbg_ptr = ret;
        Roux223SolverWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 单视角多解 JSON(同 Block222SolverWasm::solve_moves 形状)。`m` 前缀 =
     * rot + y^k;`c` = 目标标签(方块 "DBL-L" / 1x2x3 "DL" / 2x2x2 角名 / 2x2x3 棱名 /
     * f2b "D(LR)" 块对)。
     * @param {string} scramble
     * @param {number} stage
     * @param {number} face
     * @param {number} extra
     * @param {number} cap
     * @returns {string}
     */
    solve_moves(scramble, stage, face, extra, cap) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.roux223solverwasm_solve_moves(this.__wbg_ptr, ptr0, len0, stage, face, extra, cap);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * 单阶段 6 视角(stage 0=FB方块 1=1x2x3 2=2x2x2 3=2x2x3 4=双1x2x3),顺序对应 ROTS。
     * @param {string} scramble
     * @param {number} stage
     * @returns {Uint32Array}
     */
    solve_stage(scramble, stage) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.roux223solverwasm_solve_stage(this.__wbg_ptr, ptr0, len0, stage);
        var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
}
if (Symbol.dispose) Roux223SolverWasm.prototype[Symbol.dispose] = Roux223SolverWasm.prototype.free;

/**
 * Skewb(斜转)整解最优求解器(全自包含,**零表下载**):3.0MB 全空间
 * (3,149,280 态)精确距离表首次查询时惰性现场 BFS(转移件级 decode/apply/encode,
 * 无联合移动表,RefCell 缓存)。吃全 WCA skewb 记号(U/L/R/B,后缀 '/2/2',
 * 阶 3 下 X2 = X');非法记号抛 JS 异常。God's number = 11。
 */
export class SkewbSolverWasm {
    static __wrap(ptr) {
        const obj = Object.create(SkewbSolverWasm.prototype);
        obj.__wbg_ptr = ptr;
        SkewbSolverWasmFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SkewbSolverWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_skewbsolverwasm_free(ptr, 0);
    }
    /**
     * 用预算好的全空间距离表(3,149,280 字节)即时构造(秒算:静态资源直载,
     * 跳过现场 BFS)。worker 拉 opt_skewb.bin.gz 解压后传入。
     * @param {Uint8Array} dist
     * @returns {SkewbSolverWasm}
     */
    static from_dist(dist) {
        const ptr0 = passArray8ToWasm0(dist, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.skewbsolverwasm_from_dist(ptr0, len0);
        return SkewbSolverWasm.__wrap(ret);
    }
    constructor() {
        const ret = wasm.skewbsolverwasm_new();
        this.__wbg_ptr = ret;
        SkewbSolverWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 整解最优步数(0..=11,每 120° 一步)。非法记号 → Err(JS 异常)。
     * @param {string} scramble
     * @returns {number}
     */
    solve(scramble) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.skewbsolverwasm_solve(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] >>> 0;
    }
    /**
     * 一条最优解 JSON(同 Cube222SolverWasm::solve_moves 形状,单条):
     * {"len":N,"sols":[{"m":"U L' B ...","c":""}]}。`m` = 最优解序列
     * (无整体旋转前缀),`c` 恒空串。非法记号 → Err(JS 异常)。
     * @param {string} scramble
     * @returns {string}
     */
    solve_moves(scramble) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.skewbsolverwasm_solve_moves(this.__wbg_ptr, ptr0, len0);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
}
if (Symbol.dispose) SkewbSolverWasm.prototype[Symbol.dispose] = SkewbSolverWasm.prototype.free;

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
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        VariantSolverWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_variantsolverwasm_free(ptr, 0);
    }
    /**
     * 12 表:pair 用 mt_edge4/corn/edge + pt_cross_ins_C4 + pt_pair_C4E0 + pt_cross_C4E0;
     * eo 另用 pt_cross + pt_ep4eo12 + mt_edge2 + mt_eo12 + mt_eo12_alt + mt_ep4。
     * 仅存引用,惰性建 solver。(pseudo / pseudo_pair 接入时再扩。)
     * @param {Uint8Array} pt_cross_c4e0
     * @param {Uint8Array} pt_cross_ins_c4
     * @param {Uint8Array} pt_pair_c4e0
     * @param {Uint8Array} mt_edge4
     * @param {Uint8Array} mt_corn
     * @param {Uint8Array} mt_edge
     * @param {Uint8Array} pt_cross
     * @param {Uint8Array} pt_ep4eo12
     * @param {Uint8Array} mt_edge2
     * @param {Uint8Array} mt_eo12
     * @param {Uint8Array} mt_eo12_alt
     * @param {Uint8Array} mt_ep4
     * @param {Uint8Array} pt_pscross
     */
    constructor(pt_cross_c4e0, pt_cross_ins_c4, pt_pair_c4e0, mt_edge4, mt_corn, mt_edge, pt_cross, pt_ep4eo12, mt_edge2, mt_eo12, mt_eo12_alt, mt_ep4, pt_pscross) {
        const ptr0 = passArray8ToWasm0(pt_cross_c4e0, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(pt_cross_ins_c4, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(pt_pair_c4e0, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArray8ToWasm0(mt_edge4, wasm.__wbindgen_malloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passArray8ToWasm0(mt_corn, wasm.__wbindgen_malloc);
        const len4 = WASM_VECTOR_LEN;
        const ptr5 = passArray8ToWasm0(mt_edge, wasm.__wbindgen_malloc);
        const len5 = WASM_VECTOR_LEN;
        const ptr6 = passArray8ToWasm0(pt_cross, wasm.__wbindgen_malloc);
        const len6 = WASM_VECTOR_LEN;
        const ptr7 = passArray8ToWasm0(pt_ep4eo12, wasm.__wbindgen_malloc);
        const len7 = WASM_VECTOR_LEN;
        const ptr8 = passArray8ToWasm0(mt_edge2, wasm.__wbindgen_malloc);
        const len8 = WASM_VECTOR_LEN;
        const ptr9 = passArray8ToWasm0(mt_eo12, wasm.__wbindgen_malloc);
        const len9 = WASM_VECTOR_LEN;
        const ptr10 = passArray8ToWasm0(mt_eo12_alt, wasm.__wbindgen_malloc);
        const len10 = WASM_VECTOR_LEN;
        const ptr11 = passArray8ToWasm0(mt_ep4, wasm.__wbindgen_malloc);
        const len11 = WASM_VECTOR_LEN;
        const ptr12 = passArray8ToWasm0(pt_pscross, wasm.__wbindgen_malloc);
        const len12 = WASM_VECTOR_LEN;
        const ret = wasm.variantsolverwasm_new(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, ptr6, len6, ptr7, len7, ptr8, len8, ptr9, len9, ptr10, len10, ptr11, len11, ptr12, len12);
        this.__wbg_ptr = ret;
        VariantSolverWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 整变体 24(pair/pseudo/pseudo_pair,4 阶段)/ 30(eo,5 阶段)值 × 6 视角(物理面序 z0/z2/z3/z1/x3/x1)。
     * @param {string} scramble
     * @param {number} variant
     * @returns {Uint32Array}
     */
    solve(scramble, variant) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.variantsolverwasm_solve(this.__wbg_ptr, ptr0, len0, variant);
        var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
    /**
     * 单格(variant × stage × face)多解步骤,返回 JSON 串(同 CrossSolverWasm::solve_moves 形状
     * {"len","combo","sols"})。variant:0=pair,1=eo,2=pseudo,3=pseudo_pair;stage:0=cross 系起。
     * extra:超出最优的步数(0=只最优长度全部解);cap:最多收集条数。
     * 步骤带视角前缀:多数变体即 ROTS[face];**eo** 因破坏 y 对称,最优可能只在 rot·y 帧达成,
     * 故前缀用 enumerate_small 返回的真实帧(可能形如 "x' y",含两个旋转 token)。
     * `combo`:固定已解 xcross 槽集(or18「槽位」,空=自动);`base`:自由对槽(or18「基态」,
     * 仅 pair/pseudo_pair 用,-1=自动),eo/pseudo 忽略。
     * @param {string} scramble
     * @param {number} variant
     * @param {number} face
     * @param {number} stage
     * @param {number} extra
     * @param {number} cap
     * @param {string} combo
     * @param {number} base
     * @returns {string}
     */
    solve_moves(scramble, variant, face, stage, extra, cap, combo, base) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(combo, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ret = wasm.variantsolverwasm_solve_moves(this.__wbg_ptr, ptr0, len0, variant, face, stage, extra, cap, ptr1, len1, base);
            deferred3_0 = ret[0];
            deferred3_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * 受限步法版 solve_moves(同形 JSON)。限制下(或超界)无解 → len=u32::MAX 哨兵 + 空解集。
     * @param {string} scramble
     * @param {number} variant
     * @param {number} face
     * @param {number} stage
     * @param {number} extra
     * @param {number} cap
     * @param {string} combo
     * @param {number} base
     * @param {number} mask
     * @returns {string}
     */
    solve_moves_masked(scramble, variant, face, stage, extra, cap, combo, base, mask) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(combo, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ret = wasm.variantsolverwasm_solve_moves_masked(this.__wbg_ptr, ptr0, len0, variant, face, stage, extra, cap, ptr1, len1, base, mask);
            deferred3_0 = ret[0];
            deferred3_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * 单阶段 6 值。两遍 UI:先 cross(stage 0)秒出,深阶段后台补。
     * @param {string} scramble
     * @param {number} variant
     * @param {number} stage
     * @returns {Uint32Array}
     */
    solve_stage(scramble, variant, stage) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.variantsolverwasm_solve_stage(this.__wbg_ptr, ptr0, len0, variant, stage);
        var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
    /**
     * 受限步法版 solve_stage(单阶段 6 视角)。`mask` = 18 个 move 的 bitmask;限制下无解的
     * 视角返回 u32::MAX 哨兵(client 显示 '-')。variant_mask_depth(mask) 封顶。
     * @param {string} scramble
     * @param {number} variant
     * @param {number} stage
     * @param {number} mask
     * @returns {Uint32Array}
     */
    solve_stage_masked(scramble, variant, stage, mask) {
        const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.variantsolverwasm_solve_stage_masked(this.__wbg_ptr, ptr0, len0, variant, stage, mask);
        var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
}
if (Symbol.dispose) VariantSolverWasm.prototype[Symbol.dispose] = VariantSolverWasm.prototype.free;

/**
 * XCross restricted optimal 求解器(任意受限 54-move 集 + 中心朝向追踪)。
 * 运行时建表(无外部表文件):物理 54-move cross/corner/edge/center transition + 双 PDB
 * (cross 190080、pair 576,均按受限 move 集现场建、**中心移出表只在搜索态追踪**),IDA*
 * h=max(两 PDB)可采纳。每次受限集建表 ≈0.3s(原 4.56M 的 1/24)。与 CrossRestrictSolverWasm
 * 同样**零下载成本**:用到才在 worker 现场建表。
 */
export class XCrossRestrictSolverWasm {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        XCrossRestrictSolverWasmFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_xcrossrestrictsolverwasm_free(ptr, 0);
    }
    /**
     * 无需任何表字节,构造时现场建全部 transition 表(~41MB RAM,~110ms,仅 worker 内存)。
     */
    constructor() {
        const ret = wasm.xcrossrestrictsolverwasm_new();
        this.__wbg_ptr = ret;
        XCrossRestrictSolverWasmFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 6 视角受限最优网格(PDB 只建一次,6 视角 × C(4,k) 组合共用),返回 JSON 数组
     * `[l0,l1,l2,l3,l4,l5]`,-1 = 真无解 / -2 = 限制过宽未在预算内判定。每格 = 该面在「k 对组合」
     * 上的最小步数(`k`=同时归位的 F2L 对数:1 xcross / 2 xxcross / 3 xxxcross / 4 F2L)。
     * 54-bit allowed mask = (allowed_hi << 32) | allowed_lo;`max_rot_count` = 解里整体旋转动上限。
     * @param {string} scramble
     * @param {number} allowed_lo
     * @param {number} allowed_hi
     * @param {number} max_rot_count
     * @param {number} k
     * @returns {string}
     */
    solve_xcross_restricted_grid(scramble, allowed_lo, allowed_hi, max_rot_count, k) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.xcrossrestrictsolverwasm_solve_xcross_restricted_grid(this.__wbg_ptr, ptr0, len0, allowed_lo, allowed_hi, max_rot_count, k);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * 受限最优「多解枚举」:返回 JSON `{len, sols:[{m,c}]}`,解按长度升序、长度 ∈ [最优, 最优+extra]、
     * 最多 `cap` 条;空集 → len = u32::MAX 哨兵。`c` 恒空串(阶段已隐含对数,组合由槽位下拉指定)。
     * `k` = 同时归位的 F2L 对数;`combo` = 逗号分隔的固定槽集(空串=自动枚举全部 C(4,k) 组合)。
     * @param {string} scramble
     * @param {number} face
     * @param {number} allowed_lo
     * @param {number} allowed_hi
     * @param {number} max_rot_count
     * @param {number} extra
     * @param {number} cap
     * @param {number} k
     * @param {string} combo
     * @param {Function} on_sol
     * @returns {string}
     */
    solve_xcross_restricted_moves(scramble, face, allowed_lo, allowed_hi, max_rot_count, extra, cap, k, combo, on_sol) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(combo, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            const ret = wasm.xcrossrestrictsolverwasm_solve_xcross_restricted_moves(this.__wbg_ptr, ptr0, len0, face, allowed_lo, allowed_hi, max_rot_count, extra, cap, k, ptr1, len1, on_sol);
            deferred3_0 = ret[0];
            deferred3_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
}
if (Symbol.dispose) XCrossRestrictSolverWasm.prototype[Symbol.dispose] = XCrossRestrictSolverWasm.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_ef53bc310eb298a0: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg___wbindgen_throw_1506f2235d1bdba0: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_6e37a87ff352da3d: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            const ret = arg0.call(arg1, arg2, arg3, arg4);
            return ret;
        }, arguments); },
        __wbindgen_cast_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./cross_solver_bg.js": import0,
    };
}

const Block222SolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_block222solverwasm_free(ptr, 1));
const ChainSolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_chainsolverwasm_free(ptr, 1));
const CrossRestrictSolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_crossrestrictsolverwasm_free(ptr, 1));
const CrossSolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_crosssolverwasm_free(ptr, 1));
const Cube222SolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_cube222solverwasm_free(ptr, 1));
const EoDrSolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_eodrsolverwasm_free(ptr, 1));
const F2leoSolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_f2leosolverwasm_free(ptr, 1));
const FrSolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_frsolverwasm_free(ptr, 1));
const HtrPhase2SolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_htrphase2solverwasm_free(ptr, 1));
const HtrSolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_htrsolverwasm_free(ptr, 1));
const PyraminxSolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_pyraminxsolverwasm_free(ptr, 1));
const Roux223SolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_roux223solverwasm_free(ptr, 1));
const SkewbSolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_skewbsolverwasm_free(ptr, 1));
const VariantSolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_variantsolverwasm_free(ptr, 1));
const XCrossRestrictSolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_xcrossrestrictsolverwasm_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('cross_solver_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
