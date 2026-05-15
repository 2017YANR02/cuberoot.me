// Ported from huazhechen/cuber (MIT) — src/cuber/cube.ts
import { GroupTable } from "./group";
import Cubelet from "./cubelet";
import { FACE } from "./define";
import * as THREE from "three";
import Twister, { TwistAction } from "./twister";
import History from "./history";
import tweener from "./tweener";

export default class Cube extends THREE.Group {
  public dirty = true;
  public locks: Map<string, Set<number>>;
  public cubelets: Cubelet[] = [];
  public initials: Cubelet[] = [];
  public table: GroupTable;
  public order: number;
  public callbacks: (() => void)[] = [];
  public history: History;
  public twister: Twister = new Twister(this);

  constructor(order: number) {
    super();
    this.order = order;
    this.scale.set(3 / order, 3 / order, 3 / order);
    for (let i = 0; i < order * order * order; i++) {
      const cubelet = new Cubelet(order, i);
      this.cubelets.push(cubelet);
      this.initials.push(cubelet);
      if (cubelet.exist) {
        this.add(cubelet);
      }
    }
    this.locks = new Map();
    this.locks.set("x", new Set());
    this.locks.set("y", new Set());
    this.locks.set("z", new Set());
    this.locks.set("a", new Set());
    this.history = new History();
    this.table = new GroupTable(this);
    this.matrixAutoUpdate = false;
    this.updateMatrix();
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
      let cubelet = this.cubelets[group.indices[0]];
      const color = cubelet.getFace(face as FACE);
      if (this.arrow) {
        const q1 = this.cubelets[group.indices[0]].rotation;
        const same = group.indices.every((idx) => {
          cubelet = this.cubelets[idx];
          const q2 = cubelet.rotation;
          return color == cubelet.getFace(face as FACE) && (q1.x - q2.x) ** 2 + (q1.y - q2.y) ** 2 + (q1.z - q2.z) ** 2 < 0.1;
        });
        return same;
      } else {
        const same = group.indices.every((idx) => {
          cubelet = this.cubelets[idx];
          return color == cubelet.getFace(face as FACE);
        });
        return same;
      }
    });
    return complete;
  }

  index(value: number): number {
    return this.initials[value].index;
  }

  public _arrow = false;
  set arrow(value: boolean) {
    this._arrow = value;
    for (const cubelet of this.cubelets) {
      cubelet.arrow = value;
    }
  }

  get arrow(): boolean {
    return this._arrow;
  }

  reset(): void {
    tweener.finish();
    for (const cubelet of this.cubelets) {
      cubelet.setRotationFromEuler(new THREE.Euler(0, 0, 0));
      cubelet.index = cubelet.initial;
      cubelet.updateMatrix();
    }
    this.cubelets.sort((left, right) => {
      return left.index - right.index;
    });
  }

  stick(index: number, face: number, value: string): void {
    const cubelet = this.initials[index];
    if (!cubelet) {
      throw Error("invalid cubelet index: " + index);
    }
    cubelet.stick(face, value);
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
        this.initials[idx].stick(face as FACE, "");
      }
      const indexes = strip[key];
      if (indexes == undefined) {
        continue;
      }
      for (const idx of indexes) {
        const cubelet = this.initials[idx];
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
        const color = this.cubelets[idx].getColor(FACE.U);
        result.push(color);
      }
    }

    x = this.order - 1;
    for (y = this.order - 1; y >= 0; y--) {
      for (z = this.order - 1; z >= 0; z--) {
        const idx = z * this.order * this.order + y * this.order + x;
        const color = this.cubelets[idx].getColor(FACE.R);
        result.push(color);
      }
    }

    z = this.order - 1;
    for (y = this.order - 1; y >= 0; y--) {
      for (x = 0; x < this.order; x++) {
        const idx = z * this.order * this.order + y * this.order + x;
        const color = this.cubelets[idx].getColor(FACE.F);
        result.push(color);
      }
    }

    y = 0;
    for (z = this.order - 1; z >= 0; z--) {
      for (x = 0; x < this.order; x++) {
        const idx = z * this.order * this.order + y * this.order + x;
        const color = this.cubelets[idx].getColor(FACE.D);
        result.push(color);
      }
    }

    x = 0;
    for (y = this.order - 1; y >= 0; y--) {
      for (z = 0; z < this.order; z++) {
        const idx = z * this.order * this.order + y * this.order + x;
        const color = this.cubelets[idx].getColor(FACE.L);
        result.push(color);
      }
    }

    z = 0;
    for (y = this.order - 1; y >= 0; y--) {
      for (x = this.order - 1; x >= 0; x--) {
        const idx = z * this.order * this.order + y * this.order + x;
        const color = this.cubelets[idx].getColor(FACE.B);
        result.push(color);
      }
    }
    return result.join("");
  }
}
