// Ported from huazhechen/cuber (MIT) — src/cuber/twister.ts
import * as THREE from "three";
import Cube from "./cube";
import Cubelet from "./cubelet";
import tweener from "../tweener";
import { timing } from "../tweenTiming";
import initStackKernel, { apply_rotates as stackKernelApplyRotates, apply_rotates_no_flat as stackKernelApplyRotatesNoFlat } from "@cuberoot/stack-kernel";
import { ensureWorkerInit, workerApply } from "./setup_worker_client";

// Stack kernel (WASM):内层 rotate apply loop。模块初始化时 fire-and-forget,
// init 完前 setup() 退回纯 JS 路径。N=200 用户场景 ~6s,kernel 目标降到 1s 量级。
let STACK_KERNEL_READY = false;
initStackKernel().then(() => { STACK_KERNEL_READY = true; }).catch((e) => {
  console.warn('[stack-kernel] init failed, falling back to JS path:', e);
});

// Per-cube group indices registry,setup() 每次复用。flat = 拍平的 cube.table.groups[axis][layer].indices,
// offsets[groupId+1]-offsets[groupId] = 该 group 的 indices 长度。groupId = axisIdx*N + layer。
type GroupRegistry = { flat: Int32Array; offsets: Uint32Array };
const groupRegistryCache = new WeakMap<Cube, GroupRegistry>();
function getGroupRegistry(cube: Cube): GroupRegistry {
  let reg = groupRegistryCache.get(cube);
  if (reg) return reg;
  const N = cube.order;
  const groups = cube.table.groups;
  const offsets = new Uint32Array(3 * N + 1);
  let total = 0;
  for (let a = 0; a < 3; a++) {
    const axisKey = a === 0 ? 'x' : a === 1 ? 'y' : 'z';
    const arr = groups[axisKey];
    for (let l = 0; l < N; l++) {
      offsets[a * N + l] = total;
      total += arr[l].indices.length;
    }
  }
  offsets[3 * N] = total;
  const flat = new Int32Array(total);
  let p = 0;
  for (let a = 0; a < 3; a++) {
    const axisKey = a === 0 ? 'x' : a === 1 ? 'y' : 'z';
    const arr = groups[axisKey];
    for (let l = 0; l < N; l++) {
      const indices = arr[l].indices;
      for (let i = 0; i < indices.length; i++) flat[p++] = indices[i];
    }
  }
  reg = { flat, offsets };
  groupRegistryCache.set(cube, reg);
  return reg;
}

// setupAsync 用:cube 初始 (solved) 状态的 typed array snapshot。
// 每次 setupAsync 起手 .set() 复位 working vec/flat,跳掉 cube.reset(true) 的 ~200ms (N=200)。
type InitialState = {
  vecX: Float32Array;
  vecY: Float32Array;
  vecZ: Float32Array;
  cubeletByInst: Cubelet[];
  flat: Int32Array;
};
const initialStateCache = new WeakMap<Cube, InitialState>();
function getInitialState(cube: Cube): InitialState {
  let s = initialStateCache.get(cube);
  if (s) return s;
  const visCount = cube.instancedRenderer.instanceToInitial.length;
  const order = cube.order;
  const order2 = order * order;
  const totalPos = order * order2;
  const half = (order - 1) / 2;
  const vecX = new Float32Array(visCount);
  const vecY = new Float32Array(visCount);
  const vecZ = new Float32Array(visCount);
  const cubeletByInst: Cubelet[] = new Array(visCount);
  const flat = new Int32Array(totalPos);
  for (const c of cube.initials.values()) {
    const idx = c.initial;  // 永不变 — 解码即初始位置
    const x = (idx % order) - half;
    const y = Math.floor((idx % order2) / order) - half;
    const z = Math.floor(idx / order2) - half;
    const inst = c._instIdx;
    vecX[inst] = x; vecY[inst] = y; vecZ[inst] = z;
    cubeletByInst[inst] = c;
    flat[idx] = inst + 1;
  }
  s = { vecX, vecY, vecZ, cubeletByInst, flat };
  initialStateCache.set(cube, s);
  return s;
}

// setup fast-path 用的 12 个预算 Quaternion (3 axis × twist mod 4)。
// 跳掉每 cubelet `q.setFromAxisAngle()` 的三角 — N=50 setup 累加 ~3000万次省到 0。
// Lazy:CubeGroup 跟本文件循环 import,模块 init 时 CubeGroup.AXIS_VECTOR 还没 ready。
let PRECOMPUTED_ROT_QUATS: THREE.Quaternion[] | null = null;
function getRotQuats(): THREE.Quaternion[] {
  if (PRECOMPUTED_ROT_QUATS) return PRECOMPUTED_ROT_QUATS;
  const axes: [number, number, number][] = [[-1, 0, 0], [0, -1, 0], [0, 0, -1]];
  const tmp = new THREE.Vector3();
  const out: THREE.Quaternion[] = [];
  for (let a = 0; a < 3; a++) {
    tmp.set(axes[a][0], axes[a][1], axes[a][2]);
    for (let t = 0; t < 4; t++) {
      const q = new THREE.Quaternion();
      q.setFromAxisAngle(tmp, (Math.PI / 2) * t);
      out.push(q);
    }
  }
  PRECOMPUTED_ROT_QUATS = out;
  return out;
}

// Cube rotation group 24 个元素 → 24 个 quaternion + (24 × 12) compose table。
// setup 内 cubelet 用 rotIdx (0..23) 替 quaternion 累积,跳掉 16M 次 ~16-op
// quaternion.premultiply,末尾 sync 一次 (32k 次 quaternion.copy)。
let CUBE_ROT_QUATS: THREE.Quaternion[] | null = null;
let CUBE_COMPOSE: Uint8Array | null = null;  // composeIdx[oldRotIdx*12 + dispatch] = newRotIdx
function getCubeRotTables(): { quats: THREE.Quaternion[]; compose: Uint8Array } {
  if (CUBE_ROT_QUATS) return { quats: CUBE_ROT_QUATS, compose: CUBE_COMPOSE! };
  const rotQuats = getRotQuats();
  const quats: THREE.Quaternion[] = [new THREE.Quaternion(0, 0, 0, 1)];
  const keyToIdx = new Map<string, number>();
  // 一个 rotation 对应 ±q 两种 quaternion 表示;BFS 时把 -q 也 alias 到同一 idx
  function quatKey(q: THREE.Quaternion): string {
    const r = (v: number) => Math.round(v * 100000);
    return `${r(q.x)},${r(q.y)},${r(q.z)},${r(q.w)}`;
  }
  function regKey(q: THREE.Quaternion, idx: number): void {
    keyToIdx.set(quatKey(q), idx);
    const tmp = new THREE.Quaternion(-q.x, -q.y, -q.z, -q.w);
    keyToIdx.set(quatKey(tmp), idx);
  }
  regKey(quats[0], 0);
  const triples: number[] = [];  // (oldIdx, dispatch, newIdx) triples
  const queue = [0];
  const work = new THREE.Quaternion();
  while (queue.length > 0) {
    const oldIdx = queue.shift()!;
    for (let dispatch = 1; dispatch < 12; dispatch++) {
      const t01 = dispatch & 3;
      if (t01 === 0) continue;  // identity 跳过
      const qRot = rotQuats[(dispatch >> 2) * 4 + t01];
      work.copy(quats[oldIdx]).premultiply(qRot);
      let newIdx = keyToIdx.get(quatKey(work));
      if (newIdx === undefined) {
        newIdx = quats.length;
        const q = work.clone();
        quats.push(q);
        regKey(q, newIdx);
        queue.push(newIdx);
      }
      triples.push(oldIdx, dispatch, newIdx);
    }
  }
  const compose = new Uint8Array(quats.length * 12);
  for (let i = 0; i < triples.length; i += 3) {
    compose[triples[i] * 12 + triples[i + 1]] = triples[i + 2];
  }
  CUBE_ROT_QUATS = quats;
  CUBE_COMPOSE = compose;
  return { quats, compose };
}

export class TwistAction {
  sign: string;
  reverse: boolean;
  times: number;
  constructor(exp: string, reverse = false, times = 1) {
    const values = exp.match(/([\*\#~;.#xyz]|[0123456789-]*[bsfdeulmr][w]*)('?)(\d*)('?)/i);
    if (values) {
      exp = values[1];
      reverse = reverse !== ((values[2] + values[4]).length == 1);
      times = times * (values[3].length == 0 ? 1 : parseInt(values[3]));
    }
    if (/[XYZ]/.test(exp)) {
      exp = exp.toLowerCase();
    }
    if (/[Ww]/.test(exp)) {
      exp = exp.toUpperCase();
      exp = exp.replace("W", "w");
    }
    this.sign = exp;
    this.reverse = reverse;
    this.times = times;
  }

  get value(): string {
    if (this.times == 0) {
      return "";
    }
    return this.sign + (this.times == 1 ? "" : String(this.times)) + (this.reverse ? "'" : "");
  }
}

export class TwistNode {
  static AFFIX = "'Ww0123456789-";
  children: TwistNode[];
  twist: TwistAction;
  static SPLIT_SEGMENT(exp: string): string[] {
    const list = [];
    let buffer = "";
    let stack = 0;
    let ready = false;
    let note = false;
    for (let i = 0; i < exp.length; i++) {
      const c = exp.charAt(i);
      if (c === " " && buffer.length == 0) {
        continue;
      }
      if (c === "/" && exp.charAt(i + 1) === "/") {
        i++;
        note = true;
        continue;
      }
      if (c === "\n") {
        note = false;
        continue;
      }
      if (note) {
        continue;
      }
      if (TwistNode.AFFIX.indexOf(c) >= 0) {
        buffer = buffer.concat(c);
        continue;
      }
      if (buffer.length > 0 && stack == 0 && ready) {
        list.push(buffer);
        buffer = "";
        i--;
        ready = false;
        continue;
      }
      if (c === "(" || c === "[") {
        buffer = buffer.concat(c);
        stack++;
        continue;
      }
      if (c === ")" || c === "]") {
        buffer = buffer.concat(c);
        stack--;
        continue;
      }
      ready = true;
      buffer = buffer.concat(c);
    }
    if (buffer.length > 0) {
      list.push(buffer);
    }
    return list;
  }

  static SPLIT_BRACKET(exp: string): string[] {
    const list = [];
    let buffer = "";
    let stack = 0;
    for (let i = 0; i < exp.length; i++) {
      const c = exp.charAt(i);
      if (stack == 0 && (c === "," || c === ":")) {
        list.push(buffer);
        list.push(c);
        buffer = "";
        continue;
      }
      if (c === "(" || c === "[") {
        buffer = buffer.concat(c);
        stack++;
        continue;
      }
      if (c === ")" || c === "]") {
        buffer = buffer.concat(c);
        stack--;
        continue;
      }
      buffer = buffer.concat(c);
    }
    if (buffer.length > 0) {
      list.push(buffer);
    }
    return list;
  }

  constructor(exp: string, reverse = false, times = 1) {
    this.children = [];
    exp = exp.replace(/[‘＇’]/g, "'");
    if (exp.match(/^([\*\#~;.#xyz]|[0123456789-]*[bsfdeulmr][w]*)$/gi)) {
      this.twist = new TwistAction(exp, reverse, times);
      return;
    }
    this.twist = new TwistAction("", reverse, times);
    if (exp.length == 0) {
      return;
    }
    const list = TwistNode.SPLIT_SEGMENT(exp);
    for (const item of list) {
      let values;
      values = item.match(/^\[(.+[:|,].+)\]$/i);
      if (values) {
        const parts = TwistNode.SPLIT_BRACKET(values[1]);
        switch (parts[1]) {
          case ",":
            this.children.push(new TwistNode(parts[0], false, 1));
            this.children.push(new TwistNode(parts[2], false, 1));
            this.children.push(new TwistNode(parts[0], true, 1));
            this.children.push(new TwistNode(parts[2], true, 1));
            break;
          case ":":
            this.children.push(new TwistNode(parts[0], false, 1));
            this.children.push(new TwistNode(parts[2], false, 1));
            this.children.push(new TwistNode(parts[0], true, 1));
            break;
          default:
            break;
        }
        continue;
      }
      values = item.match(/^(\[.+[:|,].+\])('?)(\d*)('?)$/i);
      if (values === null) {
        values = item.match(/^\((.+)\)('?)(\d*)('?)$/i);
      }
      if (values === null) {
        values = item.match(/([\*\#~;.#xyz]|[0123456789-]*[bsfdeulmr][w]*)('?)(\d*)('?)/i);
      }
      if (null === values) {
        continue;
      }
      const reverseFlag = (values[2] + values[4]).length == 1;
      const timesNum = values[3].length == 0 ? 1 : parseInt(values[3]);
      this.children.push(new TwistNode(values[1], reverseFlag, timesNum));
    }
  }

  parse(reverse = false): TwistAction[] {
    reverse = this.twist.reverse !== reverse;
    const result: TwistAction[] = [];
    if (0 !== this.children.length) {
      for (let i = 0; i < this.twist.times; i++) {
        for (let j = 0; j < this.children.length; j++) {
          let n;
          if (reverse) {
            n = this.children[this.children.length - j - 1];
          } else {
            n = this.children[j];
          }
          const list = n.parse(reverse);
          for (const element of list) {
            result.push(element);
          }
        }
      }
    } else if (this.twist.sign != "" && !this.twist.sign.startsWith("//")) {
      const action = new TwistAction(this.twist.sign, reverse, this.twist.times);
      result.push(action);
    }
    return result;
  }
}

export default class Twister {
  private cube: Cube;
  private queue: TwistAction[] = [];
  // 在 undo / redo 内部 twist 时为 true,避免误清空 redo 栈
  public suppressRedoClear = false;
  constructor(cube: Cube) {
    this.cube = cube;
    this.cube.callbacks.push(this.update);
  }

  scrambler(): string {
    let result = "";
    const exps = [];
    let last = -1;
    const actions = ["U", "D", "R", "L", "F", "B"];
    let axis = -1;
    for (let i = 0; i < 3 * 3 * this.cube.order; i++) {
      const exp: (string | number)[] = [];
      while (axis == last) {
        axis = Math.floor(Math.random() * 3);
      }
      const side = Math.floor(Math.random() * 2);
      const action = actions[axis * 2 + side];
      const prefix = Math.ceil(Math.random() * Math.floor(this.cube.order / 2));
      if (prefix !== 1) {
        exp.push(prefix);
      }
      exp.push(action);
      const suffix = Math.random();
      if (suffix < 0.4) {
        exp.push("2");
      } else if (suffix < 0.7) {
        exp.push("'");
      }
      exps.push(exp.join(""));
      last = axis;
    }
    result = exps.join(" ");
    return result;
  }

  get length(): number {
    return this.queue.length;
  }

  finish(): void {
    while (this.queue.length > 0) {
      tweener.finish();
    }
    tweener.finish();
  }

  /** true = 设置面板「动画」关:撤销 / 重做也瞬切(fast),不播放转动动画。手动转 / 拖层 / 单击
   *  各自路径已单独走 fast;这条只管 undo/redo(它们在 twister 内部硬编了 fast=false)。 */
  public instantTurns = false;

  /** 上一次 setup() 同步 CPU 耗时,DEV bench 用。0 = 还没跑过。 */
  public lastSetupCpuMs = 0;
  /** sub-bench: 各阶段耗时,DEV 用。{finish,reset,parse,loop,rebuild,total} ms */
  public lastSetupParts: { finish: number; reset: number; parse: number; loop: number; rebuild: number } = { finish: 0, reset: 0, parse: 0, loop: 0, rebuild: 0 };

  setup(exp: string, reverse = false, times = 1): void {
    const TBENCH0 = performance.now();
    // 放弃待播放队列:setup 紧接着 reset 再整体重应用,逐步 replay 这些 move 纯属浪费 —— 而且
    // 高阶宽转 replay 会逐层 hold()(每层建/刷扇形),450 步打乱能卡死整页。清空后 finish 只收尾活动补间。
    this.queue.length = 0;
    this.finish();
    const T1 = performance.now();
    this.cube.reset(true);
    const T2 = performance.now();
    const node = new TwistNode(exp, reverse, times);
    const list = node.parse();
    const T3 = performance.now();
    // Logic-only fast path: setup 期间画面不渲染中间帧,跳过 InstancedRenderer 的
    // beginSlice/setSliceAngle/endSlice (per slice 大量 Matrix4.clone + 反复改写 moving/static buf),
    // 只更新 cubelet 的逻辑状态 (matrix + cube.cubelets map),末尾一次性 rebuildAll
    // 把 final static 写 GPU。N=50 上 setup 总时长降一个量级。
    const cube = this.cube;
    const order = cube.order;
    const order2 = order * order;
    const half = (order - 1) / 2;
    const SIZE = Cubelet.SIZE;
    const { quats: cubeRotQuats, compose: cubeCompose } = getCubeRotTables();
    // Flat 数组替 cube.cubelets Map 作为 setup 内 hot path:V8 array indexed get/set
    // ~2-3x 比 Map.get/set 快。N=75 → 421k slot × 8B = 3.4MB,N=250 60MB
    // (用户主流 N<=100 时 OK)。
    const visCount = cube.instancedRenderer.instanceToInitial.length;
    // SoA: cubelet._vector 不在 hot loop 直接读写 (Vector3 object 寻址 2 层),
    // 改用 3 个 Float32Array indexed by _instIdx,内存连续 + TypedArray IC 命中率高。
    const vecX = new Float32Array(visCount);
    const vecY = new Float32Array(visCount);
    const vecZ = new Float32Array(visCount);
    const cubeletByInst: Cubelet[] = new Array(visCount);
    for (const c of cube.initials.values()) {
      const v = c._vector;
      const i = c._instIdx;
      vecX[i] = v.x; vecY[i] = v.y; vecZ[i] = v.z;
      cubeletByInst[i] = c;
    }
    // Flat 数组替 cube.cubelets Map,存 instIdx + 1 (0 = empty)。
    const totalPos = order * order2;
    const flat = new Int32Array(totalPos);
    for (const c of cube.cubelets.values()) flat[c._index] = c._instIdx + 1;
    // Per-cubelet rotIdx 累加器 (Uint8Array indexed by _instIdx)。
    const rotIdx = new Uint8Array(visCount);  // 默认 0 = identity
    // 预分配 slice instIdx 缓冲 (face slab 最大 = N²),28k slice 复用避免 alloc。
    const sliceInsts = new Int32Array(order2);
    // 特殊 sign 极罕见;含则退回纯 JS 路径(WASM kernel 不支持 lock-aware twist)。
    let hasSpecial = false;
    for (const action of list) {
      if (action.sign === "#" || action.sign === "*" || action.sign === "." || action.sign === ";" || action.sign === "~") {
        hasSpecial = true; break;
      }
    }
    // bench flag: window.__STACK_KERNEL_WASM = false 强制走 JS 对比。
    const wasmEnabled = (window as unknown as { __STACK_KERNEL_WASM?: boolean }).__STACK_KERNEL_WASM ?? true;
    if (STACK_KERNEL_READY && wasmEnabled && !hasSpecial) {
      // 批量收集所有 rotate 的 (dispatch, groupId),一次 WASM 调用。
      const N = order;
      const reg = getGroupRegistry(cube);
      // 上限估算:每个 action 最多 N rotates (xyz 整体转),通常 ≤ N/2。
      // 用 ArrayBuffer + 动态扩容避免预分配过头。
      let cap = list.length * 4;  // 初始猜
      let rotatesDesc = new Uint32Array(cap * 2);
      let rCount = 0;
      const ensureCap = (need: number) => {
        if (need <= cap) return;
        while (cap < need) cap *= 2;
        const next = new Uint32Array(cap * 2);
        next.set(rotatesDesc.subarray(0, rCount * 2));
        rotatesDesc = next;
      };
      for (const action of list) {
        const rotates = cube.table.convert(action);
        for (const rotate of rotates) {
          const axisKey = rotate.group.axis;
          const axisIdx = axisKey === 'x' ? 0 : axisKey === 'y' ? 1 : axisKey === 'z' ? 2 : -1;
          if (axisIdx < 0) continue;
          const t01 = ((rotate.twist % 4) + 4) % 4;
          if (t01 === 0) continue;
          const dispatch = axisIdx * 4 + t01;
          const groupId = axisIdx * N + rotate.group.layer;
          ensureCap(rCount + 1);
          rotatesDesc[rCount * 2] = dispatch;
          rotatesDesc[rCount * 2 + 1] = groupId;
          rCount++;
        }
      }
      // 诊断:__STACK_KERNEL_NO_FLAT = true 切到 no_flat variant (跳 flat 读写,
      // cube state 一定错,只用来量 flat 操作的成本上限,验证 perSlab 是否值得做)。
      const noFlat = (window as unknown as { __STACK_KERNEL_NO_FLAT?: boolean }).__STACK_KERNEL_NO_FLAT === true;
      const fn = noFlat ? stackKernelApplyRotatesNoFlat : stackKernelApplyRotates;
      fn(
        rotatesDesc.subarray(0, rCount * 2),
        reg.flat,
        reg.offsets,
        vecX, vecY, vecZ,
        rotIdx,
        flat,
        sliceInsts,
        cubeCompose,
        order,
      );
    } else {
      for (const action of list) {
        if (action.sign === "#" || action.sign === "*" || action.sign === "." || action.sign === ";" || action.sign === "~") {
          this.twist(action, true, true);
          continue;
        }
        const rotates = cube.table.convert(action);
        for (const rotate of rotates) {
          const axisKey = rotate.group.axis;
          const axisIdx = axisKey === 'x' ? 0 : axisKey === 'y' ? 1 : axisKey === 'z' ? 2 : -1;
          if (axisIdx < 0) continue;
          const t01 = ((rotate.twist % 4) + 4) % 4;
          if (t01 === 0) continue;
          const indices = rotate.group.indices;
          // group.indices 都是 exist cubelet 位置,rotation 在 slab 内 permute,
          // 所以 flat[pos] 总有值 (instIdx+1)。直接拿 typed array,免 if/push。
          const sliceLen = indices.length;
          for (let i = 0; i < sliceLen; i++) {
            sliceInsts[i] = flat[indices[i]] - 1;  // instIdx (0..visCount-1)
          }
          // axis × twist01 整数坐标变换。
          const dispatch = axisIdx * 4 + t01;
          for (let i = 0; i < sliceLen; i++) {
            const instIdx = sliceInsts[i];
            const ox = vecX[instIdx], oy = vecY[instIdx], oz = vecZ[instIdx];
            let nx = 0, ny = 0, nz = 0;
            switch (dispatch) {
              case 1: nx = ox; ny = oz; nz = -oy; break;
              case 2: nx = ox; ny = -oy; nz = -oz; break;
              case 3: nx = ox; ny = -oz; nz = oy; break;
              case 5: nx = -oz; ny = oy; nz = ox; break;
              case 6: nx = -ox; ny = oy; nz = -oz; break;
              case 7: nx = oz; ny = oy; nz = -ox; break;
              case 9: nx = oy; ny = -ox; nz = oz; break;
              case 10: nx = -ox; ny = -oy; nz = oz; break;
              case 11: nx = -oy; ny = ox; nz = oz; break;
            }
            vecX[instIdx] = nx; vecY[instIdx] = ny; vecZ[instIdx] = nz;
            flat[(nz + half) * order2 + (ny + half) * order + (nx + half)] = instIdx + 1;
            rotIdx[instIdx] = cubeCompose[rotIdx[instIdx] * 12 + dispatch];
          }
        }
      }
    }
    // 末尾一次性 sweep:从 vecX/Y/Z + rotIdx 算最终 _vector / _index / position / quaternion,
    // 重建 cubelets Map,compose matrix。
    cube.cubelets.clear();
    for (let i = 0; i < visCount; i++) {
      const c = cubeletByInst[i];
      const fx = vecX[i], fy = vecY[i], fz = vecZ[i];
      c._vector.x = fx; c._vector.y = fy; c._vector.z = fz;
      c._index = (fz + half) * order2 + (fy + half) * order + (fx + half);
      c.position.x = SIZE * fx;
      c.position.y = SIZE * fy;
      c.position.z = SIZE * fz;
      cube.cubelets.set(c._index, c);
      const q = cubeRotQuats[rotIdx[i]];
      c.quaternion.set(q.x, q.y, q.z, q.w);
      c.updateMatrix();
    }
    const T4 = performance.now();
    cube.instancedRenderer.rebuildAll();
    cube.dirty = true;
    cube.history.clear();
    cube.history.init = exp;
    cube.callback();
    const T5 = performance.now();
    this.lastSetupCpuMs = T5 - TBENCH0;
    this.lastSetupParts = {
      finish: T1 - TBENCH0,
      reset: T2 - T1,
      parse: T3 - T2,
      loop: T4 - T3,
      rebuild: T5 - T4,
    };
  }

  /**
   * setupAsync: 把 hot loop 甩到 Worker 跑,主线程在 worker 算的几秒里 UI 60fps 不卡。
   *  - 跳过 cube.reset(true) (~200ms @ N=200):直接用 cached InitialState .copy 起手
   *  - parse + rotatesDesc 收集仍在主线程 (~50ms @ N=200)
   *  - postMessage 到 worker, await 几秒
   *  - end sweep + rebuildAll 仍在主线程 (~500ms @ N=200) — 这部分仍卡,后续可分帧 chunk
   *  - 兜底:特殊 sign / WASM 没 ready → 退回同步 setup()
   *
   * API: 返回 Promise<void>。caller 必须 await,期间 UI 自由。
   */
  async setupAsync(exp: string, reverse = false, times = 1): Promise<void> {
    const TBENCH0 = performance.now();
    this.queue.length = 0;  // 同 setup():放弃待播队列,避免高阶宽转 replay 卡死(详见 setup 注释)
    this.finish();
    const T1 = performance.now();
    const node = new TwistNode(exp, reverse, times);
    const list = node.parse();
    const T3 = performance.now();

    // 特殊 sign 走同步 fallback。罕见 (用户用 # / * / . / ~ / ; 这些 setup 内嵌指令)。
    let hasSpecial = false;
    for (const action of list) {
      if (action.sign === "#" || action.sign === "*" || action.sign === "." || action.sign === ";" || action.sign === "~") {
        hasSpecial = true; break;
      }
    }
    const wasmEnabled = (window as unknown as { __STACK_KERNEL_WASM?: boolean }).__STACK_KERNEL_WASM ?? true;
    if (!STACK_KERNEL_READY || !wasmEnabled || hasSpecial) {
      this.setup(exp, reverse, times);
      return;
    }

    const cube = this.cube;
    const order = cube.order;
    const order2 = order * order;
    const half = (order - 1) / 2;
    const SIZE = Cubelet.SIZE;
    const { quats: cubeRotQuats, compose: cubeCompose } = getCubeRotTables();
    const reg = getGroupRegistry(cube);
    const init = getInitialState(cube);
    const visCount = init.cubeletByInst.length;

    // 收集 rotatesDesc (跟 setup() WASM path 同)
    const N = order;
    let cap = list.length * 4;
    let rotatesDesc = new Uint32Array(cap * 2);
    let rCount = 0;
    const ensureCap = (need: number) => {
      if (need <= cap) return;
      while (cap < need) cap *= 2;
      const next = new Uint32Array(cap * 2);
      next.set(rotatesDesc.subarray(0, rCount * 2));
      rotatesDesc = next;
    };
    for (const action of list) {
      const rotates = cube.table.convert(action);
      for (const rotate of rotates) {
        const axisKey = rotate.group.axis;
        const axisIdx = axisKey === 'x' ? 0 : axisKey === 'y' ? 1 : axisKey === 'z' ? 2 : -1;
        if (axisIdx < 0) continue;
        const t01 = ((rotate.twist % 4) + 4) % 4;
        if (t01 === 0) continue;
        const dispatch = axisIdx * 4 + t01;
        const groupId = axisIdx * N + rotate.group.layer;
        ensureCap(rCount + 1);
        rotatesDesc[rCount * 2] = dispatch;
        rotatesDesc[rCount * 2 + 1] = groupId;
        rCount++;
      }
    }

    // worker init (per order, 第一次几十 ms 给 worker 灌 groupRegistry + initialFlat)
    await ensureWorkerInit(cube, cubeCompose, reg.flat, reg.offsets, init.flat);

    // 准备 working typed arrays — 从 cached initial state 复制 (跳过 cube.reset)
    const vecX = new Float32Array(init.vecX);
    const vecY = new Float32Array(init.vecY);
    const vecZ = new Float32Array(init.vecZ);
    const rotIdx = new Uint8Array(visCount);  // all zeros = identity

    const T_PREP = performance.now();

    // ★ 整个 hot loop 在 worker 异步执行,主线程这段时间空闲
    const res = await workerApply(N, rotatesDesc.subarray(0, rCount * 2), vecX, vecY, vecZ, rotIdx);

    const T_WORKER = performance.now();

    // End sweep — 写回 cubelet 对象 + 重建 cube.cubelets map
    const rX = res.vecX, rY = res.vecY, rZ = res.vecZ, rRotIdx = res.rotIdx;
    cube.cubelets.clear();
    for (let i = 0; i < visCount; i++) {
      const c = init.cubeletByInst[i];
      const fx = rX[i], fy = rY[i], fz = rZ[i];
      c._vector.x = fx; c._vector.y = fy; c._vector.z = fz;
      c._index = (fz + half) * order2 + (fy + half) * order + (fx + half);
      c.position.x = SIZE * fx;
      c.position.y = SIZE * fy;
      c.position.z = SIZE * fz;
      cube.cubelets.set(c._index, c);
      const q = cubeRotQuats[rRotIdx[i]];
      c.quaternion.set(q.x, q.y, q.z, q.w);
      c.updateMatrix();
    }
    const T_SWEEP = performance.now();
    cube.instancedRenderer.rebuildAll();
    cube.dirty = true;
    cube.history.clear();
    cube.history.init = exp;
    cube.callback();
    const T_END = performance.now();

    this.lastSetupCpuMs = T_END - TBENCH0;
    this.lastSetupParts = {
      finish: T1 - TBENCH0,
      reset: 0,
      parse: T3 - T1,
      loop: T_WORKER - T_PREP,  // 含 worker 异步等待 + transfer
      rebuild: T_END - T_SWEEP,
    };
  }

  push(exp: string, reverse = false, times = 1): void {
    const node = new TwistNode(exp, reverse, times);
    const list = node.parse();
    if (list.length == 0) {
      return;
    }
    for (const action of list) {
      this.queue.push(action);
    }
    this.update();
  }

  update = (): void => {
    while (true) {
      const action = this.queue.shift();
      if (action == undefined) {
        return;
      }
      const success = this.twist(action, false, false);
      if (!success) {
        this.queue.unshift(action);
        return;
      }
    }
  };

  twist(action: TwistAction, fast: boolean, force: boolean): boolean {
    let success = false;
    if (action.sign == "#") {
      this.setup("");
      return true;
    }
    if (action.sign == "*") {
      const exp = this.scrambler();
      this.setup(exp);
      return true;
    }
    if (action.sign == "." || action.sign == "~") {
      if (fast || force) {
        this.cube.callback();
        return true;
      }
      success = this.cube.lock("a", 1);
      if (success) {
        tweener.tween(0, 1, timing.frames * action.times, (value: number) => {
          if (value == 1) {
            this.cube.unlock("a", 1);
            this.cube.callback();
            return true;
          }
          return false;
        });
      }
      return success;
    }
    if (action.sign == ";") {
      if (fast || force) {
        this.cube.callback();
        return true;
      }
      success = this.cube.lock("a", 1);
      if (success) {
        this.cube.unlock("a", 1);
        this.cube.callback();
      }
      return success;
    }
    const list = this.cube.table.convert(action);
    if (list.length == 0) {
      return true;
    }
    for (const rotate of list) {
      success = rotate.group.twist((Math.PI / 2) * rotate.twist, fast);
      while (!success && force) {
        tweener.finish();
        success = rotate.group.twist((Math.PI / 2) * rotate.twist, fast);
      }
    }
    if (success) {
      this.cube.record(action);
      // 用户主动 twist (非 undo/redo 内部) 清空 redo 栈
      if (!this.suppressRedoClear) {
        this.cube.history.redoStack = [];
      }
    }
    return success;
  }

  undo(): void {
    if (this.cube.history.length == 0) {
      return;
    }
    const last = this.cube.history.last;
    // 保存原 action 以便 redo
    const original = new TwistAction(last.sign, last.reverse, 1);
    this.cube.history.redoStack.push(original);
    const reverse = new TwistAction(last.sign, !last.reverse, 1);
    this.suppressRedoClear = true;
    this.twist(reverse, this.instantTurns, true);
    this.suppressRedoClear = false;
  }

  redo(): void {
    const action = this.cube.history.redoStack.pop();
    if (!action) {
      return;
    }
    this.suppressRedoClear = true;
    this.twist(action, this.instantTurns, true);
    this.suppressRedoClear = false;
  }
}
