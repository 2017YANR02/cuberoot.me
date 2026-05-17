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

  setup(exp: string, reverse = false, times = 1): void {
    this.finish();
    this.cube.reset();
    const node = new TwistNode(exp, reverse, times);
    const list = node.parse();
    // Logic-only fast path: setup 期间画面不渲染中间帧,跳过 InstancedRenderer 的
    // beginSlice/setSliceAngle/endSlice (per slice 大量 Matrix4.clone + 反复改写 moving/static buf),
    // 只更新 cubelet 的逻辑状态 (matrix + cube.cubelets map),末尾一次性 rebuildAll
    // 把 final static 写 GPU。N=50 上 setup 总时长降一个量级。
    const cube = this.cube;
    const order = cube.order;
    const order2 = order * order;
    const half = (order - 1) / 2;
    const SIZE = Cubelet.SIZE;
    const rotQuats = getRotQuats();
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
        const qRot = rotQuats[axisIdx * 4 + t01];
        const slice: Cubelet[] = [];
        const indices = rotate.group.indices;
        for (let i = 0; i < indices.length; i++) {
          const c = cube.cubelets.get(indices[i]);
          if (c) slice.push(c);
        }
        // axis × twist01 整数坐标变换 — 见上方推导。switch 在外层一次,inner 跑纯算术。
        // 90°/180°/270° rotation 都是 axis-aligned permutation + sign,免 trig + Math.round。
        const dispatch = axisIdx * 4 + t01;
        for (let i = 0; i < slice.length; i++) {
          const c = slice[i];
          const v = c._vector;
          const ox = v.x, oy = v.y, oz = v.z;
          let nx = 0, ny = 0, nz = 0;
          switch (dispatch) {
            case 1: nx = ox; ny = oz; nz = -oy; break;                  // x, t=1: (x, z, -y)
            case 2: nx = ox; ny = -oy; nz = -oz; break;                 // x, t=2: (x, -y, -z)
            case 3: nx = ox; ny = -oz; nz = oy; break;                  // x, t=3: (x, -z, y)
            case 5: nx = -oz; ny = oy; nz = ox; break;                  // y, t=1: (-z, y, x)
            case 6: nx = -ox; ny = oy; nz = -oz; break;                 // y, t=2: (-x, y, -z)
            case 7: nx = oz; ny = oy; nz = -ox; break;                  // y, t=3: (z, y, -x)
            case 9: nx = oy; ny = -ox; nz = oz; break;                  // z, t=1: (y, -x, z)
            case 10: nx = -ox; ny = -oy; nz = oz; break;                // z, t=2: (-x, -y, z)
            case 11: nx = -oy; ny = ox; nz = oz; break;                 // z, t=3: (-y, x, z)
          }
          v.x = nx; v.y = ny; v.z = nz;
          c._index = (nz + half) * order2 + (ny + half) * order + (nx + half);
          c.position.x = SIZE * nx;
          c.position.y = SIZE * ny;
          c.position.z = SIZE * nz;
          c.quaternion.premultiply(qRot);  // world-space rotate ≡ premul
          c.updateMatrix();
          cube.cubelets.set(c._index, c);
        }
      }
    }
    cube.instancedRenderer.rebuildAll();
    cube.dirty = true;
    cube.history.clear();
    cube.history.init = exp;
    cube.callback();
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
