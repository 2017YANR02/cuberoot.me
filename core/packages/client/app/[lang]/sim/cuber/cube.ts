// Ported from huazhechen/cuber (MIT) — src/cuber/cube.ts
// 高阶优化:cubelets/initials 改 Map<positionIdx, Cubelet>(原 sparse Array 在 N>~100 时浪费),
// 构造从 O(N³) 全量循环改为 O(N²) 表面枚举。
import { GroupTable } from "./group";
import Cubelet from "./cubelet";
import { FACE } from "./define";
import * as THREE from "three";
import Twister, { TwistAction } from "./twister";
import History from "./history";
import tweener from "./tweener";
import InstancedRenderer from "./instanced";

export default class Cube extends THREE.Group {
  public dirty = true;
  public locks: Map<string, Set<number>>;
  /** 当前位置 → cubelet at that position(随旋转更新) */
  public cubelets: Map<number, Cubelet> = new Map();
  /** 原始位置 → cubelet originally created there(永不变,用于 stick 寻址 + 渲染身份) */
  public initials: Map<number, Cubelet> = new Map();
  public table: GroupTable;
  public order: number;
  public callbacks: (() => void)[] = [];
  public history: History;
  public twister: Twister = new Twister(this);
  public instancedRenderer: InstancedRenderer;

  constructor(order: number) {
    super();
    const t0 = performance.now();
    this.order = order;
    this.scale.set(3 / order, 3 / order, 3 / order);
    // surfacePositions inline,直接展开循环避免 closure / generator 开销
    // N≥50 用 Cubelet.createLite (跳过 THREE.Object3D ctor 重活,~600ms 节省)
    const N = order;
    const N2 = N * N;
    const cubeletsMap = this.cubelets;
    const initialsMap = this.initials;
    const useLite = N >= 50;
    const make = useLite
      ? (idx: number) => Cubelet.createLite(order, idx)
      : (idx: number) => new Cubelet(order, idx);
    // U/D faces: full y=0, y=N-1 slabs
    for (let z = 0; z < N; z++) {
      const zN2 = z * N2;
      for (let x = 0; x < N; x++) {
        let positionIdx = x + zN2;
        let cubelet = make(positionIdx);
        cubeletsMap.set(positionIdx, cubelet);
        initialsMap.set(positionIdx, cubelet);
        positionIdx = x + (N - 1) * N + zN2;
        cubelet = make(positionIdx);
        cubeletsMap.set(positionIdx, cubelet);
        initialsMap.set(positionIdx, cubelet);
      }
    }
    // L/R faces: x=0, x=N-1 (skip y=0 / y=N-1)
    for (let z = 0; z < N; z++) {
      const zN2 = z * N2;
      for (let y = 1; y < N - 1; y++) {
        const yN = y * N;
        let positionIdx = yN + zN2;
        let cubelet = make(positionIdx);
        cubeletsMap.set(positionIdx, cubelet);
        initialsMap.set(positionIdx, cubelet);
        positionIdx = (N - 1) + yN + zN2;
        cubelet = make(positionIdx);
        cubeletsMap.set(positionIdx, cubelet);
        initialsMap.set(positionIdx, cubelet);
      }
    }
    // F/B faces: z=0, z=N-1 (skip all 4 edge bands)
    const lastZN2 = (N - 1) * N2;
    for (let y = 1; y < N - 1; y++) {
      const yN = y * N;
      for (let x = 1; x < N - 1; x++) {
        let positionIdx = x + yN;
        let cubelet = make(positionIdx);
        cubeletsMap.set(positionIdx, cubelet);
        initialsMap.set(positionIdx, cubelet);
        positionIdx = x + yN + lastZN2;
        cubelet = make(positionIdx);
        cubeletsMap.set(positionIdx, cubelet);
        initialsMap.set(positionIdx, cubelet);
      }
    }
    const t1 = performance.now();
    this.locks = new Map();
    this.locks.set("x", new Set());
    this.locks.set("y", new Set());
    this.locks.set("z", new Set());
    this.locks.set("a", new Set());
    this.history = new History();
    this.table = new GroupTable(this);
    this.matrixAutoUpdate = false;
    this.updateMatrix();
    const t2 = performance.now();
    this.instancedRenderer = new InstancedRenderer(this);
    const t3 = performance.now();
    this.add(this.instancedRenderer);
    if (order >= 50) {
      console.log(`[Cube ctor N=${order}] cubelets=${(t1 - t0).toFixed(0)}ms groupTable=${(t2 - t1).toFixed(0)}ms instancedRenderer=${(t3 - t2).toFixed(0)}ms total=${(t3 - t0).toFixed(0)}ms`);
    }
  }

  callback(): void {
    for (const lock of this.locks.values()) {
      if (lock.size > 0) {
        return;
      }
    }
    for (const cb of this.callbacks) {
      cb();
    }
  }

  /** True while any layer is mid-twist (a lock is held). Cleared on drop().
   *  Playback uses this to serialize moves — a new turn waits until the current
   *  one fully finishes, including same-axis / same-face turns that lock() would
   *  otherwise let run in parallel (or that group.twist would cancel+restart). */
  get busy(): boolean {
    for (const lock of this.locks.values()) {
      if (lock.size > 0) return true;
    }
    return false;
  }

  lock(axis: string, layer: number): boolean {
    if (this.locks.get("a")?.has(1)) {
      return false;
    }
    const tmp = this.locks.get(axis);
    if (tmp == undefined) {
      return false;
    }
    for (const lock of this.locks.values()) {
      if (lock != tmp && lock.size > 0) {
        return false;
      }
    }
    tmp.add(layer);
    return true;
  }

  unlock(axis: string, layer: number): void {
    const tmp = this.locks.get(axis);
    tmp?.delete(layer);
  }

  record(action: TwistAction): void {
    this.history.record(action);
  }

  get complete(): boolean {
    const complete = [FACE.U, FACE.D, FACE.L, FACE.R, FACE.F, FACE.B].every((face) => {
      const group = this.table.face(String(FACE[face as 0 | 1 | 2 | 3 | 4 | 5]));
      if (!group) {
        throw Error();
      }
      const first = this.cubelets.get(group.indices[0]);
      if (!first) return true;  // shouldn't happen for face groups
      const color = first.getFace(face as FACE);
      if (this.arrow) {
        const q1 = first.rotation;
        return group.indices.every((idx) => {
          const c = this.cubelets.get(idx);
          if (!c) return true;
          const q2 = c.rotation;
          return color == c.getFace(face as FACE) && (q1.x - q2.x) ** 2 + (q1.y - q2.y) ** 2 + (q1.z - q2.z) ** 2 < 0.1;
        });
      } else {
        return group.indices.every((idx) => {
          const c = this.cubelets.get(idx);
          if (!c) return true;
          return color == c.getFace(face as FACE);
        });
      }
    });
    return complete;
  }

  index(value: number): number {
    return this.initials.get(value)?.index ?? value;
  }

  public _arrow = false;
  set arrow(value: boolean) {
    this._arrow = value;
    this.instancedRenderer.arrow = value;
  }

  get arrow(): boolean {
    return this._arrow;
  }

  /** 释放 GPU 资源 + 清自己内部引用,防 world.cubes[] 切阶累积导致 OOM。
   * 调用后 cube 不可再用 — 调用方应同时从 scene + cubes[] 摘除。 */
  dispose(): void {
    this.instancedRenderer.dispose();
    this.cubelets.clear();
    this.initials.clear();
    this.locks.clear();
    this.callbacks.length = 0;
    // 断 group ↔ cube 循环引用 (groups[axis][layer].cube 指回来)
    for (const axis of ['x', 'y', 'z']) {
      const arr = this.table.groups[axis];
      if (arr) for (const g of arr) (g as unknown as { cube: Cube | null }).cube = null;
    }
  }

  reset(skipRebuild = false): void {
    tweener.finish();
    // 每个 cubelet 复位:旋转归零、index 设回 initial、矩阵刷新。
    // 然后重建 cubelets map(key 应为 cubelet.index, 复位后等于 initial)。
    this.cubelets.clear();
    for (const cubelet of this.initials.values()) {
      cubelet.setRotationFromEuler(new THREE.Euler(0, 0, 0));
      cubelet.index = cubelet.initial;
      cubelet.updateMatrix();
      this.cubelets.set(cubelet.index, cubelet);
    }
    // setup 内调时传 true:末尾自己 rebuildAll,这里跳一次省 ~50ms@N=75。
    if (!skipRebuild) this.instancedRenderer.rebuildAll();
  }

  stick(index: number, face: number, value: string): void {
    const cubelet = this.initials.get(index);
    if (!cubelet) {
      throw Error("invalid cubelet index: " + index);
    }
    cubelet.stick(face, value);
    this.instancedRenderer.applyStick(cubelet.initial, face, value);
    this.dirty = true;
  }

  strip(strip: { [face: string]: number[] | undefined }): void {
    for (const face of [FACE.L, FACE.R, FACE.D, FACE.U, FACE.B, FACE.F]) {
      const key = String(FACE[face as 0 | 1 | 2 | 3 | 4 | 5]);
      const group = this.table.face(key);
      if (!group) {
        throw Error();
      }
      for (const idx of group.indices) {
        this.initials.get(idx)?.stick(face as FACE, "");
      }
      const indexes = strip[key];
      if (indexes == undefined) {
        continue;
      }
      for (const idx of indexes) {
        const cubelet = this.initials.get(idx);
        if (!cubelet) {
          throw Error("invalid cubelet index: " + idx);
        }
        cubelet.stick(face as FACE, "remove");
      }
    }
    this.dirty = true;
  }

  serialize(): string {
    const result: string[] = [];
    let x, y, z;

    y = this.order - 1;
    for (z = 0; z < this.order; z++) {
      for (x = 0; x < this.order; x++) {
        const idx = z * this.order * this.order + y * this.order + x;
        result.push(this.cubelets.get(idx)?.getColor(FACE.U) ?? "?");
      }
    }

    x = this.order - 1;
    for (y = this.order - 1; y >= 0; y--) {
      for (z = this.order - 1; z >= 0; z--) {
        const idx = z * this.order * this.order + y * this.order + x;
        result.push(this.cubelets.get(idx)?.getColor(FACE.R) ?? "?");
      }
    }

    z = this.order - 1;
    for (y = this.order - 1; y >= 0; y--) {
      for (x = 0; x < this.order; x++) {
        const idx = z * this.order * this.order + y * this.order + x;
        result.push(this.cubelets.get(idx)?.getColor(FACE.F) ?? "?");
      }
    }

    y = 0;
    for (z = this.order - 1; z >= 0; z--) {
      for (x = 0; x < this.order; x++) {
        const idx = z * this.order * this.order + y * this.order + x;
        result.push(this.cubelets.get(idx)?.getColor(FACE.D) ?? "?");
      }
    }

    x = 0;
    for (y = this.order - 1; y >= 0; y--) {
      for (z = 0; z < this.order; z++) {
        const idx = z * this.order * this.order + y * this.order + x;
        result.push(this.cubelets.get(idx)?.getColor(FACE.L) ?? "?");
      }
    }

    z = 0;
    for (y = this.order - 1; y >= 0; y--) {
      for (x = this.order - 1; x >= 0; x--) {
        const idx = z * this.order * this.order + y * this.order + x;
        result.push(this.cubelets.get(idx)?.getColor(FACE.B) ?? "?");
      }
    }
    return result.join("");
  }
}
