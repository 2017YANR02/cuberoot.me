/* @ts-self-types="./cross_solver.d.ts" */

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
     * 单格(variant × face)多解步骤,返回 JSON 串。
     * variant:0=cross,1=xc,2=xxc,3=xxxc,4=xxxxc;face:0..5 对应 ROTS。
     * extra:允许超出最优的步数(0=只最优长度全部解);cap:最多收集条数。
     * 解步骤带视角前缀(face>0 时如 "z2 R U ..."),combo 是该格选中的 F2L 槽位。
     * @param {string} scramble
     * @param {number} variant
     * @param {number} face
     * @param {number} extra
     * @param {number} cap
     * @returns {string}
     */
    solve_moves(scramble, variant, face, extra, cap) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passStringToWasm0(scramble, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.crosssolverwasm_solve_moves(this.__wbg_ptr, ptr0, len0, variant, face, extra, cap);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
}
if (Symbol.dispose) CrossSolverWasm.prototype[Symbol.dispose] = CrossSolverWasm.prototype.free;

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
}
if (Symbol.dispose) VariantSolverWasm.prototype[Symbol.dispose] = VariantSolverWasm.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_1506f2235d1bdba0: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
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

const CrossSolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_crosssolverwasm_free(ptr, 1));
const F2leoSolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_f2leosolverwasm_free(ptr, 1));
const VariantSolverWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_variantsolverwasm_free(ptr, 1));

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
