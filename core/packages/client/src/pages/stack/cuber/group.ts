// Ported from huazhechen/cuber (MIT) — src/cuber/group.ts
import Cubelet from "./cubelet";
import { TwistAction } from "./twister";
import Cube from "./cube";
import * as THREE from "three";
import tweener, { Tween } from "./tweener";

export default class CubeGroup extends THREE.Group {
  public static frames = 30;
  public static readonly AXIS_VECTOR: { [key: string]: THREE.Vector3 } = {
    a: new THREE.Vector3(1, 1, 1),
    x: new THREE.Vector3(-1, 0, 0),
    y: new THREE.Vector3(0, -1, 0),
    z: new THREE.Vector3(0, 0, -1),
  };

  cube: Cube;
  cubelets: Cubelet[];
  indices: number[];
  axis: string;
  layer: number;
  private holding = false;
  private tween: Tween | undefined = undefined;

  _angle: number;
  set angle(angle) {
    this._angle = angle;
    this.setRotationFromAxisAngle(CubeGroup.AXIS_VECTOR[this.axis], this._angle);
    this.updateMatrix();
    // per-instance 写 instance matrix,多并发 slice 各自独立 angle 互不影响
    this.cube.instancedRenderer.setSliceAngle(this, angle);
    this.cube.dirty = true;
  }

  get angle(): number {
    return this._angle;
  }

  constructor(cube: Cube, axis: string, layer: number) {
    super();
    this.cube = cube;
    this._angle = 0;
    this.cubelets = [];
    this.indices = [];
    this.matrixAutoUpdate = false;
    this.updateMatrix();
    this.axis = axis;
    this.layer = layer;

    const half = (this.cube.order - 1) / 2;
    const table: { [key: string]: string }[] = [
      {
        x: "R",
        y: "U",
        z: "F",
      },
      {
        x: "L'",
        y: "D'",
        z: "B'",
      },
      {
        x: "M'",
        y: "E'",
        z: "S",
      },
    ];
    let type = 0;
    if (this.layer === half) {
      layer = 0;
      type = 2;
    } else if (this.layer < half) {
      type = 1;
    } else {
      layer = this.cube.order - layer - 1;
    }
    const name = table[type][this.axis];
    this.name = (layer === 0 ? "" : String(layer + 1)) + name;
  }

  cancel(): number {
    if (this.tween) {
      let angle = this.tween.end;
      tweener.cancel(this.tween);
      this.tween = undefined;
      angle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
      return angle;
    }
    return 0;
  }

  finish(): number {
    if (this.tween) {
      const angle = this.tween.end - this.angle;
      tweener.finish(this.tween);
      this.tween = undefined;
      return angle;
    }
    return 0;
  }

  private hold(): boolean {
    const success = this.cube.lock(this.axis, this.layer);
    if (!success) {
      return false;
    }
    this.holding = true;
    for (const i of this.indices) {
      const cubelet = this.cube.cubelets.get(i);
      if (!cubelet) continue;
      this.cubelets.push(cubelet);
      // 渲染走 instancedRenderer; 不再 reparent THREE 节点
    }
    this.cube.instancedRenderer.beginSlice(this);
    return true;
  }

  drag(): boolean {
    while (this.holding) {
      this.angle = -this.finish();
    }
    return this.hold();
  }

  drop(): void {
    this.holding = false;
    this.tween = undefined;
    const ir = this.cube.instancedRenderer as unknown as {
      useShaderSlice?: boolean;
      lookupCompTable?: (turnIdx: number, fromRot: number) => number;
      turnIdxFor?: (axis: string, angle: number) => number;
    };
    if (ir.useShaderSlice && ir.lookupCompTable && ir.turnIdxFor) {
      // rotIdx fast path: per-cubelet quaternion update via 24-entry lookup.
      // Face turns are ALSO position permutations (no trig). Per turnIdx, the
      // vector transformation is a simple swap+negate. Drop turnIdx is one of 9
      // (3 axes × ±90° + 180°). Dispatch via switch on turnIdx.
      const turnIdx = ir.turnIdxFor(this.axis, this.angle);
      const compLookup = ir.lookupCompTable;
      const half = (this.cube.order - 1) / 2;
      const N = this.cubelets.length;
      const order = this.cube.order;
      const order2 = order * order;
      const cubelets = this.cubelets;
      // Pre-branch on turnIdx so the inner loop is straight-line code.
      switch (turnIdx) {
        case 0: { // x +90°: (vx, vy, vz) → (vx, vz, -vy)
          for (let i = N - 1; i >= 0; i--) {
            const c = cubelets[i]; c._rotIdx = compLookup(0, c._rotIdx);
            const v = c._vector; const vy = v.y, vz = v.z;
            v.y = vz; v.z = -vy;
            const ix = (v.x + half + 0.5) | 0, iy = (vz + half + 0.5) | 0, iz = (-vy + half + 0.5) | 0;
            const newIndex = iz * order2 + iy * order + ix;
            c._index = newIndex; this.cube.cubelets.set(newIndex, c);
          } break;
        }
        case 1: { // x +180°: (vx, vy, vz) → (vx, -vy, -vz)
          for (let i = N - 1; i >= 0; i--) {
            const c = cubelets[i]; c._rotIdx = compLookup(1, c._rotIdx);
            const v = c._vector; const vy = v.y, vz = v.z;
            v.y = -vy; v.z = -vz;
            const ix = (v.x + half + 0.5) | 0, iy = (-vy + half + 0.5) | 0, iz = (-vz + half + 0.5) | 0;
            const newIndex = iz * order2 + iy * order + ix;
            c._index = newIndex; this.cube.cubelets.set(newIndex, c);
          } break;
        }
        case 2: { // x -90°: (vx, vy, vz) → (vx, -vz, vy)
          for (let i = N - 1; i >= 0; i--) {
            const c = cubelets[i]; c._rotIdx = compLookup(2, c._rotIdx);
            const v = c._vector; const vy = v.y, vz = v.z;
            v.y = -vz; v.z = vy;
            const ix = (v.x + half + 0.5) | 0, iy = (-vz + half + 0.5) | 0, iz = (vy + half + 0.5) | 0;
            const newIndex = iz * order2 + iy * order + ix;
            c._index = newIndex; this.cube.cubelets.set(newIndex, c);
          } break;
        }
        case 3: { // y +90°: (vx, vy, vz) → (-vz, vy, vx)
          for (let i = N - 1; i >= 0; i--) {
            const c = cubelets[i]; c._rotIdx = compLookup(3, c._rotIdx);
            const v = c._vector; const vx = v.x, vz = v.z;
            v.x = -vz; v.z = vx;
            const ix = (-vz + half + 0.5) | 0, iy = (v.y + half + 0.5) | 0, iz = (vx + half + 0.5) | 0;
            const newIndex = iz * order2 + iy * order + ix;
            c._index = newIndex; this.cube.cubelets.set(newIndex, c);
          } break;
        }
        case 4: { // y +180°: (vx, vy, vz) → (-vx, vy, -vz)
          for (let i = N - 1; i >= 0; i--) {
            const c = cubelets[i]; c._rotIdx = compLookup(4, c._rotIdx);
            const v = c._vector; const vx = v.x, vz = v.z;
            v.x = -vx; v.z = -vz;
            const ix = (-vx + half + 0.5) | 0, iy = (v.y + half + 0.5) | 0, iz = (-vz + half + 0.5) | 0;
            const newIndex = iz * order2 + iy * order + ix;
            c._index = newIndex; this.cube.cubelets.set(newIndex, c);
          } break;
        }
        case 5: { // y -90°: (vx, vy, vz) → (vz, vy, -vx)
          for (let i = N - 1; i >= 0; i--) {
            const c = cubelets[i]; c._rotIdx = compLookup(5, c._rotIdx);
            const v = c._vector; const vx = v.x, vz = v.z;
            v.x = vz; v.z = -vx;
            const ix = (vz + half + 0.5) | 0, iy = (v.y + half + 0.5) | 0, iz = (-vx + half + 0.5) | 0;
            const newIndex = iz * order2 + iy * order + ix;
            c._index = newIndex; this.cube.cubelets.set(newIndex, c);
          } break;
        }
        case 6: { // z +90°: (vx, vy, vz) → (vy, -vx, vz)
          for (let i = N - 1; i >= 0; i--) {
            const c = cubelets[i]; c._rotIdx = compLookup(6, c._rotIdx);
            const v = c._vector; const vx = v.x, vy = v.y;
            v.x = vy; v.y = -vx;
            const ix = (vy + half + 0.5) | 0, iy = (-vx + half + 0.5) | 0, iz = (v.z + half + 0.5) | 0;
            const newIndex = iz * order2 + iy * order + ix;
            c._index = newIndex; this.cube.cubelets.set(newIndex, c);
          } break;
        }
        case 7: { // z +180°: (vx, vy, vz) → (-vx, -vy, vz)
          for (let i = N - 1; i >= 0; i--) {
            const c = cubelets[i]; c._rotIdx = compLookup(7, c._rotIdx);
            const v = c._vector; const vx = v.x, vy = v.y;
            v.x = -vx; v.y = -vy;
            const ix = (-vx + half + 0.5) | 0, iy = (-vy + half + 0.5) | 0, iz = (v.z + half + 0.5) | 0;
            const newIndex = iz * order2 + iy * order + ix;
            c._index = newIndex; this.cube.cubelets.set(newIndex, c);
          } break;
        }
        case 8: { // z -90°: (vx, vy, vz) → (-vy, vx, vz)
          for (let i = N - 1; i >= 0; i--) {
            const c = cubelets[i]; c._rotIdx = compLookup(8, c._rotIdx);
            const v = c._vector; const vx = v.x, vy = v.y;
            v.x = -vy; v.y = vx;
            const ix = (-vy + half + 0.5) | 0, iy = (vx + half + 0.5) | 0, iz = (v.z + half + 0.5) | 0;
            const newIndex = iz * order2 + iy * order + ix;
            c._index = newIndex; this.cube.cubelets.set(newIndex, c);
          } break;
        }
      }
      cubelets.length = 0;
      this.cube.dirty = true;
      this.cube.instancedRenderer.endSlice(this);
      this.angle = 0;
      this.cube.unlock(this.axis, this.layer);
      this.cube.callback();
      return;
    }
    while (true) {
      const cubelet = this.cubelets.pop();
      if (undefined === cubelet) {
        break;
      }
      this.rotate(cubelet);
      this.cube.cubelets.set(cubelet.index, cubelet);
    }
    this.cube.dirty = true;
    this.cube.instancedRenderer.endSlice(this);
    this.angle = 0;
    this.cube.unlock(this.axis, this.layer);
    this.cube.callback();
  }

  twist(angle: number, fast: boolean): boolean {
    if (this.holding) {
      angle = angle + this.cancel();
    } else {
      const success = this.hold();
      if (!success) {
        return false;
      }
      this.angle = 0;
    }

    angle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
    if (fast) {
      this.angle = angle;
    }
    const delta = angle - this.angle;
    if (Math.abs(this.angle - angle) < 1e-6) {
      this.drop();
    } else {
      const d = Math.abs(delta) / (Math.PI / 2);
      const duration = CubeGroup.frames * (2 - 2 / (d + 1));
      this.tween = tweener.tween(this.angle, angle, duration, (value: number) => {
        this.angle = value;
        if (Math.abs(this.angle - angle) < 1e-6) {
          this.drop();
          return true;
        }
        return false;
      });
    }
    return true;
  }

  rotate(cubelet: Cubelet): void {
    cubelet.rotateOnWorldAxis(CubeGroup.AXIS_VECTOR[this.axis], this.angle);
    cubelet.vector = cubelet.vector.applyAxisAngle(CubeGroup.AXIS_VECTOR[this.axis], this.angle);
    // Shader 模式 (instancedRenderer.useShaderSlice) 下不 read cubelet.matrix
    // (shader 读 cubelet.quaternion 写到 aOrientation),省 62500 次 matrix.compose。
    if (!(this.cube.instancedRenderer as unknown as { useShaderSlice?: boolean }).useShaderSlice) {
      cubelet.updateMatrix();
    }
  }
}

export class RotateAction {
  group: CubeGroup;
  twist: number;
  constructor(group: CubeGroup, twist: number) {
    this.group = group;
    this.twist = twist;
  }
}

export class GroupTable {
  private order: number;
  groups: { [key: string]: CubeGroup[] };

  constructor(cube: Cube) {
    this.order = cube.order;
    this.groups = {};
    for (const axis of ["x", "y", "z"]) {
      const list: CubeGroup[] = [];
      for (let layer = 0; layer < this.order; layer++) {
        const g = new CubeGroup(cube, axis, layer);
        list[layer] = g;
      }
      this.groups[axis] = list;
    }
    for (const cubelet of cube.initials.values()) {
      if (!cubelet.exist) {
        continue;
      }
      const index = cubelet.initial;
      let axis: string;
      let layer: number;
      let group: CubeGroup;

      axis = "x";
      layer = index % this.order;
      group = this.groups[axis][layer];
      group.indices.push(cubelet.index);

      axis = "y";
      layer = Math.floor((index % (this.order * this.order)) / this.order);
      group = this.groups[axis][layer];
      group.indices.push(cubelet.index);

      axis = "z";
      layer = Math.floor(index / (this.order * this.order));
      group = this.groups[axis][layer];
      group.indices.push(cubelet.index);
    }
  }

  private static AXIS_MAP: { [key: string]: string } = {
    R: "x",
    L: "-x",
    U: "y",
    D: "-y",
    F: "z",
    B: "-z",
    M: "-x",
    E: "-y",
    S: "z",
  };

  face(face: string): CubeGroup {
    let layer = 0;
    let sign = GroupTable.AXIS_MAP[face];
    if (sign.length == 2) {
      sign = sign[1];
    } else {
      layer = this.order - 1;
    }
    return this.groups[sign][layer];
  }

  convert(action: TwistAction): RotateAction[] {
    const result: RotateAction[] = [];
    let sign = action.sign;
    if (sign.match(/.[Ww]/)) {
      sign = sign.toLowerCase().replace("w", "");
    }
    if (/[XYZ]/.test(sign)) {
      sign = sign.toLowerCase();
    }
    let group: CubeGroup;
    let twist: number = action.times * (action.reverse ? -1 : 1);
    let layer: number;
    if (sign.length === 1) {
      switch (sign) {
        case "x":
        case "y":
        case "z":
          for (let l = 0; l < this.order; l++) {
            group = this.groups[sign][l];
            result.push(new RotateAction(group, twist));
          }
          return result;
        case "R":
        case "U":
        case "F":
        case "L":
        case "D":
        case "B":
          layer = 0;
          sign = GroupTable.AXIS_MAP[sign.toUpperCase()];
          if (sign.length == 2) {
            twist = -twist;
            sign = sign[1];
          } else {
            layer = this.order - 1;
          }
          group = this.groups[sign][layer];
          result.push(new RotateAction(group, twist));
          return result;
        case "r":
        case "u":
        case "f":
        case "l":
        case "d":
        case "b":
          layer = 0;
          sign = GroupTable.AXIS_MAP[sign.toUpperCase()];
          if (sign.length == 2) {
            twist = -twist;
            sign = sign[1];
          } else {
            layer = this.order - 2;
          }
          group = this.groups[sign][layer];
          result.push(new RotateAction(group, twist));
          group = this.groups[sign][layer + 1];
          result.push(new RotateAction(group, twist));
          return result;
        case "E":
        case "M":
        case "S":
          layer = Math.floor((this.order - 1) / 2);
          sign = GroupTable.AXIS_MAP[sign.toUpperCase()];
          if (sign.length == 2) {
            twist = -twist;
            sign = sign[1];
          }
          group = this.groups[sign][layer];
          result.push(new RotateAction(group, twist));
          if (this.order % 2 == 0) {
            group = this.groups[sign][layer + 1];
            result.push(new RotateAction(group, twist));
          }
          return result;
        case "e":
        case "m":
        case "s":
          sign = GroupTable.AXIS_MAP[sign.toUpperCase()];
          if (sign.length == 2) {
            twist = -twist;
            sign = sign[1];
          }
          for (let l = 1; l < this.order - 1; l++) {
            group = this.groups[sign][l];
            result.push(new RotateAction(group, twist));
          }
          return result;
      }
    } else {
      const list = sign.match(/([0123456789]*)(-?)([0123456789]*)([lrudfb])/i);
      if (list == null) {
        return result;
      }
      let from = Number(list[1]);
      let to = Number(list[3]);
      if (Number.isNaN(to) || to === 0) {
        if (/[lrudfb]/.test(list[4])) {
          to = 1;
        } else {
          to = from;
        }
      }
      if (from > this.order) {
        from = this.order;
      }
      if (to > this.order) {
        to = this.order;
      }
      sign = GroupTable.AXIS_MAP[list[4].toUpperCase()];
      if (sign.length == 2) {
        twist = -twist;
        sign = sign[1];
      } else {
        from = this.order - from + 1;
        to = this.order - to + 1;
      }
      if (from > to) {
        [from, to] = [to, from];
      }
      for (let l = from - 1; l < to; l++) {
        group = this.groups[sign][l];
        result.push(new RotateAction(group, twist));
      }
    }
    return result;
  }
}
