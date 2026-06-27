// Ported from huazhechen/cuber (MIT) — src/cuber/group.ts
import Cubelet from "./cubelet";
import { TwistAction } from "./twister";
import Cube from "./cube";
import * as THREE from "three";
import tweener, { Tween } from "../tweener";
import { timing } from "../tweenTiming";
import { buildPanelFan, colorPanelFan } from "./panelFan";

export default class CubeGroup extends THREE.Group {
  public static readonly AXIS_VECTOR: { [key: string]: THREE.Vector3 } = {
    a: new THREE.Vector3(1, 1, 1),
    x: new THREE.Vector3(-1, 0, 0),
    y: new THREE.Vector3(0, -1, 0),
    z: new THREE.Vector3(0, 0, -1),
  };

  /** 点击/拖动 cubelet 推导宽层 notation + 对应 groups 的 layer 列表。
   * 规则:点击位置到 axis 两端外层的最小深度 = wide 宽度;靠近哪一端就从那一端起算。
   *  - width === N: 整体转 ("x" / "y" / "z")
   *  - width === 1, fromLow: 单层外层 ("L'" / "D'" / "B'") — apostrophe 让正 angle 对应正确 notation
   *  - width === 1, !fromLow: 单层外层 ("R" / "U" / "F")
   *  - width === 2: "Rw" / "Lw'" / "Uw" / "Dw'" / "Fw" / "Bw'"
   *  - width >= 3: "3Rw" / "5Lw'" 等
   *
   * 返回的 sign 已经把"用户拖出正 angle"对应的 notation 算好,
   * caller 直接 `new TwistAction(sign, angle<0, times)` 即可。 */
  static wideFromClick(axis: string, layer: number, N: number): { sign: string; layers: number[] } {
    const depthLow = layer;
    const depthHigh = N - 1 - layer;
    const fromLow = depthLow <= depthHigh;
    const width = fromLow ? layer + 1 : N - layer;
    const layers: number[] = [];
    let sign: string;
    if (width === N) {
      for (let l = 0; l < N; l++) layers.push(l);
      sign = axis;
    } else if (fromLow) {
      for (let l = 0; l < width; l++) layers.push(l);
      const letter = axis === 'x' ? 'L' : axis === 'y' ? 'D' : 'B';
      if (width === 1) sign = letter + "'";
      else if (width === 2) sign = letter + "w'";
      else sign = width + letter + "w'";
    } else {
      for (let l = N - width; l < N; l++) layers.push(l);
      const letter = axis === 'x' ? 'R' : axis === 'y' ? 'U' : 'F';
      if (width === 1) sign = letter;
      else if (width === 2) sign = letter + 'w';
      else sign = width + letter + 'w';
    }
    return { sign, layers };
  }

  cube: Cube;
  cubelets: Cubelet[];
  indices: number[];
  axis: string;
  layer: number;
  private holding = false;
  private tween: Tween | undefined = undefined;
  private panel: THREE.Mesh | undefined = undefined;
  /** 原核专用的扇形彩色横截面几何(惰性建,每层一份);非原核走 Cubelet._PANEL 深色盒。 */
  private fanGeo: THREE.BufferGeometry | undefined = undefined;
  private boxScale = new THREE.Vector3(1, 1, 1);
  private axisIdx = 0;

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

    // Inner-layer occluder panel: super-order cube 只造 surface cubelet,中层 slice = ring 空环,
    // 旋转中透过 ring 内部能看到背景/对面。挂一片薄板填满 ring 内部,跟 group 旋转一起转。
    // outer layer (layer 0 / N-1) 已是 full plane 不需要。
    // 默认隐藏,只在 hold()→drop() 之间 (该 group 实际在转) 才显示;
    // 静止时 panel 一直藏着,避免 xyz 整体转时另外两轴的静止 panel 戳穿外表面。
    this.axisIdx = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    const N = this.cube.order;
    // Mirror cube fills the central cavity with a real center cubie (see cube.ts), so it
    // needs no panel. The uniform panelFan/_PANEL would not match the non-uniform layer
    // (it pokes out as thin wedges in raw/single-colour mode), so skip it entirely here.
    if (layer > 0 && layer < N - 1 && !this.cube.isMirror) {
      const S = Cubelet.SIZE;
      const span = (N - 2) * S - 1;  // 留 0.5 防 z-fight 撞 perimeter cubelet
      const thick = S - 1;
      const panel = new THREE.Mesh(Cubelet._PANEL, Cubelet._PANEL_MAT);
      const offset = (layer - (N - 1) / 2) * S;
      if (axis === "x") { panel.scale.set(thick, span, span); panel.position.x = offset; }
      else if (axis === "y") { panel.scale.set(span, thick, span); panel.position.y = offset; }
      else { panel.scale.set(span, span, thick); panel.position.z = offset; }
      this.boxScale.copy(panel.scale);  // 深色盒用的 scale;切扇形横截面时 scale=1(几何已 bake 真实尺寸)
      panel.frustumCulled = false;
      panel.visible = false;
      this.panel = panel;
      this.add(panel);
    }

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
    // 占位板挡中空。原核(任意阶)→ 切到扇形彩色横截面(按该层四周块当前色刷,跟打乱态),
    // 超高阶填空壳中心、中低阶盖掉 inner box 露出的深色中心,所有 nxn 转层切面都五彩;
    // 非原核 → 用 Cubelet._PANEL 深色盒(普通阶看不见、超高阶非原核为深色占位)。
    if (this.panel) {
      const ir = this.cube.instancedRenderer;
      if (ir.rawCore) {
        if (!this.fanGeo) this.fanGeo = buildPanelFan(this.cube.order, this.axisIdx);
        colorPanelFan(this.fanGeo, this.cube, this.axisIdx, this.layer);
        if (this.panel.geometry !== this.fanGeo) { this.panel.geometry = this.fanGeo; this.panel.scale.set(1, 1, 1); }
        this.panel.material = Cubelet._PANEL_FAN_MAT;  // 带 polygonOffset,盖过方形块顶/inner box 出斜条纹
      } else {
        if (this.panel.geometry !== Cubelet._PANEL) { this.panel.geometry = Cubelet._PANEL; this.panel.scale.copy(this.boxScale); }
        this.panel.material = Cubelet._PANEL_MAT;       // 深色盒,无 offset,不戳穿实心块
      }
      this.panel.visible = true;
    }
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
    if (this.panel) this.panel.visible = false;
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
      const duration = timing.frames * (2 - 2 / (d + 1));
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
    cubelet.updateMatrix();
  }

  /** 释放本 group 惰性建的扇形横截面几何(cube.dispose 时调,防切阶累积 GPU 内存)。 */
  disposeFan(): void {
    this.fanGeo?.dispose();
    this.fanGeo = undefined;
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
        cube.add(g);  // 进 scene graph 让 inner-layer panel 跟 group.rotation 渲染
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
