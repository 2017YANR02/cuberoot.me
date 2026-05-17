// Ported from huazhechen/cuber (MIT) — src/cuber/twister.ts
import * as THREE from "three";
import Cube from "./cube";
import Cubelet from "./cubelet";
import tweener from "./tweener";
import CubeGroup from "./group";

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

  /** 上一次 setup() 同步 CPU 耗时,DEV bench 用。0 = 还没跑过。 */
  public lastSetupCpuMs = 0;
  /** sub-bench: 各阶段耗时,DEV 用。{finish,reset,parse,loop,rebuild,total} ms */
  public lastSetupParts: { finish: number; reset: number; parse: number; loop: number; rebuild: number } = { finish: 0, reset: 0, parse: 0, loop: 0, rebuild: 0 };

  setup(exp: string, reverse = false, times = 1): void {
    const TBENCH0 = performance.now();
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
    for (const action of list) {
      // 特殊 sign (#/*/./~/;) 包含递归 setup / lock-aware callback 等复杂语义,
      // 在 setup 输入里极罕见,直接退回普通 twist 路径。
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
        tweener.tween(0, 1, CubeGroup.frames * action.times, (value: number) => {
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
    this.twist(reverse, false, true);
    this.suppressRedoClear = false;
  }

  redo(): void {
    const action = this.cube.history.redoStack.pop();
    if (!action) {
      return;
    }
    this.suppressRedoClear = true;
    this.twist(action, false, true);
    this.suppressRedoClear = false;
  }
}
