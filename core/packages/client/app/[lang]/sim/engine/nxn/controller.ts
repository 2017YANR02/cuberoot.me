// Ported from huazhechen/cuber (MIT) — src/cuber/controller.ts
import { FACE } from "../define";
import Cubelet from "./cubelet";
import CubeGroup from "./group";
import * as THREE from "three";
import World from "../world";
import tweener from "../tweener";
import { TwistAction } from "./twister";

export class TouchAction {
  type: string;
  x: number;
  y: number;
  shift: boolean;
  button: number;
  alt: boolean;
  constructor(type: string, x: number, y: number, shift = false, button = 0, alt = false) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.shift = shift;
    this.button = button;
    this.alt = alt;
  }
}

export class Holder {
  public vector: THREE.Vector3;
  public index: number = -1;
  public plane!: THREE.Plane;
  constructor() {
    this.vector = new THREE.Vector3();
  }
}

export default class Controller {
  public dragging = false;
  public rotating = false;
  public angle = 0;
  public contingle = 0;
  public taps: ((index: number, face: FACE | null, opts: { shift: boolean; button: number; alt: boolean }) => void)[];
  // 拖拽 / 整体旋转完成时 (cube.record 之后) 触发的 user-twist 回调。
  // 用于把 drag 出来的 move 自动追加到上层 (PlayerControls) 的解法输入框。
  public userTwist: ((action: TwistAction) => void)[] = [];
  // mousedown 时记录修饰键,handleUp 单击分支用
  private downShift = false;
  private downButton = 0;
  // Alt 修饰键:按住 = 强制单层切片,不走 wide 深度推断
  private downAlt = false;
  public ray = new THREE.Ray();
  public down = new THREE.Vector2(0, 0);
  public move = new THREE.Vector2(0, 0);
  public matrix = new THREE.Matrix4();
  public holder = new Holder();
  public vector = new THREE.Vector3();
  public group: CubeGroup | null = null;
  /** 宽层 wide turn 的额外 group 列表 (不含 this.group)。空 = 单层切片(现状)。 */
  public wideExtras: CubeGroup[] = [];
  /** 宽层 wide turn 的 notation (如 "Rw"/"3Lw'"/"x")。空串 = 用 this.group.name(现状)。 */
  public wideSign: string = "";
  public axis: string = "y";
  // 6 个 face plane,顺序:0=R(+x) 1=U(+y) 2=F(+z) 3=L(-x) 4=D(-y) 5=B(-z)
  // handleUp() 里按此顺序映射成 FACE 常量
  public planes = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), (-Cubelet.SIZE * 3) / 2),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), (-Cubelet.SIZE * 3) / 2),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), (-Cubelet.SIZE * 3) / 2),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), (-Cubelet.SIZE * 3) / 2),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), (-Cubelet.SIZE * 3) / 2),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), (-Cubelet.SIZE * 3) / 2),
  ];
  public _lock = false;
  get lock(): boolean {
    return this._lock;
  }
  set lock(value: boolean) {
    this.handleUp();
    this._lock = value;
  }

  public _disable = false;
  get disable(): boolean {
    return this._disable;
  }
  set disable(value: boolean) {
    this.handleUp();
    this.clearFrozen(); // releasing the cube (puzzle switch etc.) drops any frozen turn
    this._disable = value;
  }

  world: World;
  sensitivity = 0.5;
  /** 拖空白 (无 sticker hit) 时的语义:
   *  'orbit'  — 累积 dx/dy 经 onOrbit 喂给外层改 scene.rotation,跨 ±π/2 commit y/x。
   *  'rotate' — upstream cuber 默认行为:snap 到 x/y/z 单轴 + 90° + 记 TwistAction。
   *  'view'   — 同 orbit 路径但 onOrbit 内不 commit,纯改 scene.rotation。 */
  dragEmpty: 'orbit' | 'rotate' | 'view' = 'orbit';
  /** paint 模式:任何拖拽(含贴纸上)都当 orbit 转视角,绝不拧层;单击仍走 taps(→ 涂色)。
   *  仅 /scramble/solver 立体涂色用,默认关 → /sim 行为不变。需配合 dragEmpty='view'。 */
  public paintMode = false;
  /** 手拧锁(设置面板「手拧」关):指针不能产生任何 move —— 拖贴纸走 orbit 视角(无视
   *  dragEmpty,连 'rotate' 的整体转也不记步),单击不派 taps(转层)。paintMode 的
   *  强化版:paint 保留单击(涂色),这里连单击也吞掉。键盘 / 播放 / 缩放不受影响。 */
  public turnsLocked = false;
  /** 开发者调试:开启后拖一层转到一半松手 → 不吸附 90°、不记步,冻结在当前角度
   *  (逐帧看中间态)。下次 handleDown / disable / clearFrozen() 时干净释放。 */
  public holdPartial = false;
  /** 被 holdPartial 冻结、仍 holding(锁着)的那一层;非空 = 当前有冻结的半转。 */
  private frozenGroup: CubeGroup | null = null;
  /** 释放冻结的半转:角度归零 + drop()(烘焙 0° = 无逻辑变化,解锁、清 slice)。 */
  clearFrozen(): void {
    if (!this.frozenGroup) return;
    this.frozenGroup.angle = 0;
    this.frozenGroup.drop();
    this.frozenGroup = null;
    this.world.dirty = true;
  }
  /** 停掉 rAF 循环用(paint 组件卸载时调,避免反复挂载累积空跑循环 + 泄漏整个 world)。 */
  private _loopStopped = false;
  /** orbit 模式下每次 pointermove 触发,delta 是相对上一次的位移 (像素)。 */
  public onOrbit: ((dx: number, dy: number) => void) | null = null;
  /** orbit 模式下追踪上一次 move 坐标 (像素),用来算 delta。 */
  private orbitLastX = 0;
  private orbitLastY = 0;
  /** true = 用户在背景拖 orbit 模式自由视角。FaceHints 等外部模块观察方位变化时用。 */
  public orbiting = false;
  /** true = 转动不出动画(设置面板「动画」关):拖层时不实时跟手(update 不缓动),
   *  松手直接 fast 吸附到 90°(handleUp 走 fast=true);避免拖动留「转到一半」的中间态。 */
  public instantTurns = false;
  /** 用户正在做整体旋转视角的拖动 (orbit 模式 OR rotate 模式的 background drag);
   *  sticker 单层拖不算 — FaceHints 用它决定要不要显示 U/D/L/R/F/B 字母。 */
  get isViewRotating(): boolean {
    return this.orbiting || (this.rotating && this.group === null && this.holder.index === -1);
  }
  constructor(world: World) {
    this.world = world;
    this.taps = [];
    // headless 守卫(PLAN-sr-retirement Phase 1):World ctor 硬建 Controller,
    // 无 rAF 环境(Node)不起指针拖动循环 —— headless 场景没有指针输入,循环无意义。
    if (typeof requestAnimationFrame !== 'undefined') this.loop();
  }

  loop(): void {
    if (this._loopStopped) return;
    requestAnimationFrame(this.loop.bind(this));
    this.update();
  }

  /** 永久停掉 loop()(不可恢复)。/sim 不调,行为不变。 */
  stop(): void {
    this._loopStopped = true;
  }

  update(): void {
    const angle = this.contingle + this.angle;
    // 动画关:拖动期间不让层/整体实时跟手转(保持在 rest),松手时由 handleUp fast 吸附到 90°,
    // 全程无中间角度。holdPartial(半转停调试)是另一套语义,走它自己的冻结分支,不受此影响。
    if (this.instantTurns && !this.holdPartial) return;
    if (this.rotating) {
      if (this.group) {
        if (this.group.angle != angle) {
          const delta = (angle - this.group.angle) / 2;
          this.group.angle += delta;
          // 宽层:extras 跟 primary 走 (=, 不是 +=delta,防累计漂移)
          for (const g of this.wideExtras) g.angle = this.group.angle;
          this.world.dirty = true;
        }
      } else {
        const groups = (this.world.cube as import('./cube').default).table.groups[this.axis[0]];
        for (const group of groups) {
          if (group.angle != angle) {
            const delta = (angle - group.angle) / 2;
            group.angle += delta;
            this.world.dirty = true;
          }
        }
      }
    }
  }

  match(): CubeGroup | null {
    const plane = this.holder.plane.normal;
    const finger = this.holder.vector;
    const index = this.holder.index;
    const order = this.world.cube.order;
    for (const axis of ["x", "y", "z"]) {
      const vector = CubeGroup.AXIS_VECTOR[axis];
      if (vector.dot(plane) === 0 && vector.dot(finger) === 0) {
        let layer = 0;
        switch (axis) {
          case "x":
            layer = index % order;
            break;
          case "y":
            layer = Math.floor((index % (order * order)) / order);
            break;
          case "z":
            layer = Math.floor(index / (order * order));
            break;
        }
        return (this.world.cube as import('./cube').default).table.groups[axis][layer];
      }
    }
    return null;
  }

  intersect(point: THREE.Vector2, plane: THREE.Plane): THREE.Vector3 {
    const x = (point.x / this.world.width) * 2 - 1;
    const y = -(point.y / this.world.height) * 2 + 1;
    this.ray.origin.setFromMatrixPosition(this.world.camera.matrixWorld);
    this.ray.direction.set(x, y, 0.5).unproject(this.world.camera).sub(this.ray.origin).normalize();
    this.matrix.copy(this.world.scene.matrix);
    this.matrix.invert();
    this.ray.applyMatrix4(this.matrix);
    const result = new THREE.Vector3(Infinity, Infinity, Infinity);
    this.ray.intersectPlane(plane, result);
    return result;
  }

  handleDown(): void {
    if (this.disable) {
      return;
    }
    if (this.dragging || this.rotating) {
      this.handleUp();
    }
    this.dragging = true;
    this.holder.index = -1;
    let distance = 0;
    this.planes.forEach((plane) => {
      const point = this.intersect(this.down, plane);
      if (point !== null) {
        let x = point.x / Cubelet.SIZE / 3;
        let y = point.y / Cubelet.SIZE / 3;
        let z = point.z / Cubelet.SIZE / 3;
        if (Math.abs(x) <= 0.5001 && Math.abs(y) <= 0.5001 && Math.abs(z) <= 0.5001) {
          const d =
            Math.pow(point.x - this.ray.origin.x, 2) +
            Math.pow(point.y - this.ray.origin.y, 2) +
            Math.pow(point.z - this.ray.origin.z, 2);
          if (distance == 0 || d < distance) {
            this.holder.plane = plane;
            const order = this.world.cube.order;
            x = Math.max(0, Math.min(order - 1, Math.floor((x + 0.5) * order)));
            y = Math.max(0, Math.min(order - 1, Math.floor((y + 0.5) * order)));
            z = Math.max(0, Math.min(order - 1, Math.floor((z + 0.5) * order)));
            this.holder.index = z * order * order + y * order + x;
            distance = d;
          }
        }
      }
    }, this);
  }

  handleMove(): void {
    if (this.disable) {
      return;
    }
    // orbit 模式 (拖空白 = 切视角):已经进入 orbit 后,每次 move 算 delta 喂回外层
    if (this.orbiting) {
      const dx = this.move.x - this.orbitLastX;
      const dy = this.move.y - this.orbitLastY;
      this.orbitLastX = this.move.x;
      this.orbitLastY = this.move.y;
      if (dx !== 0 || dy !== 0) this.onOrbit?.(dx, dy);
      return;
    }
    if (this.dragging) {
      const dx = this.move.x - this.down.x;
      const dy = this.move.y - this.down.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (Math.min(this.world.width, this.world.height) / d > 128) {
        return;
      }
      // 拖空白 + orbit 模式 → 切到 orbit 分支,不走整体转。
      // paintMode 下任何拖拽(含贴纸上)都走 orbit,绝不拧层(单击没位移 → 不进这里 → handleUp 派 taps 涂色)。
      // turnsLocked(手拧关)同样把贴纸拖当 orbit,且无视 dragEmpty —— 'rotate' 的整体转
      // 会记 x/y/z 进 move list,锁着时同样不该产生。
      if ((this.turnsLocked || this.paintMode || this.holder.index === -1)
        && (this.turnsLocked || this.dragEmpty === 'orbit' || this.dragEmpty === 'view')) {
        this.dragging = false;
        this.orbiting = true;
        this.orbitLastX = this.down.x;
        this.orbitLastY = this.down.y;
        const ox = this.move.x - this.orbitLastX;
        const oy = this.move.y - this.orbitLastY;
        this.orbitLastX = this.move.x;
        this.orbitLastY = this.move.y;
        if (ox !== 0 || oy !== 0) this.onOrbit?.(ox, oy);
        return;
      }
      this.dragging = false;
      this.rotating = true;
      // Starting a real turn (not orbit — orbit returned above): release any
      // held-partial frozen layer first, else its lock makes group.drag() below
      // spin forever. Orbiting keeps the freeze (inspect from other angles).
      this.clearFrozen();
      if (this.holder.index === -1) {
        if (dx * dx > dy * dy) {
          this.axis = "y";
        } else {
          const half = this.world.width / 2;
          const lf = new THREE.Vector3(-(Cubelet.SIZE * 3) / 2, 0, (Cubelet.SIZE * 3) / 2);
          lf.applyMatrix4(this.world.scene.matrix).project(this.world.camera);
          const lx = Math.round(lf.x * half + half);

          const rf = new THREE.Vector3((Cubelet.SIZE * 3) / 2, 0, (Cubelet.SIZE * 3) / 2);
          rf.applyMatrix4(this.world.scene.matrix).project(this.world.camera);
          const rx = Math.round(rf.x * half + half);
          if (lf.z < rf.z) {
            if (this.down.x < lx) {
              this.axis = "z'";
            } else {
              this.axis = "x";
            }
          } else {
            if (this.down.x < rx) {
              this.axis = "x";
            } else {
              this.axis = "z";
            }
          }
        }
        this.group = null;
        const contingle: Set<number> = new Set();
        for (const group of (this.world.cube as import('./cube').default).table.groups[this.axis[0]]) {
          let success = group.drag();
          let guard = 8;
          while (!success && guard-- > 0) {
            tweener.finish();
            success = group.drag();
          }
          if (!success) console.warn('[sim] controller whole-cube drag: lock never cleared');
          contingle.add(group.angle);
        }
        if (contingle.size == 1) {
          for (const value of contingle.values()) {
            this.contingle = value;
            break;
          }
        } else {
          this.contingle = 0;
        }
      } else {
        const start = this.intersect(this.down, this.holder.plane);
        const end = this.intersect(this.move, this.holder.plane);
        this.vector.subVectors(end, start);
        let x = this.vector.x;
        let y = this.vector.y;
        let z = this.vector.z;
        const max = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
        x = Math.abs(x) === max ? x : 0;
        y = Math.abs(y) === max ? y : 0;
        z = Math.abs(z) === max ? z : 0;
        this.vector.set(x, y, z);
        this.holder.vector.copy(this.vector.multiply(this.vector).normalize());

        this.group = this.match();
        if (!this.group) {
          this.rotating = false;
          return;
        }
        let success = this.group.drag();
        let guard = 8;
        while (!success && guard-- > 0) {
          tweener.finish();
          success = this.group.drag();
        }
        if (!success) console.warn('[sim] controller layer drag: lock never cleared');
        // 默认单层切片;Alt 修饰键按下 → 走 wide (深度 = 宽度)
        this.wideExtras = [];
        this.wideSign = "";
        if (this.downAlt) {
          const order = this.world.cube.order;
          const wide = CubeGroup.wideFromClick(this.group.axis, this.group.layer, order);
          this.wideSign = wide.layers.length > 1 ? wide.sign : "";
          for (const l of wide.layers) {
            if (l === this.group.layer) continue;
            const g = (this.world.cube as import('./cube').default).table.groups[this.group.axis][l];
            let s = g.drag();
            let guardW = 8;
            while (!s && guardW-- > 0) {
              tweener.finish();
              s = g.drag();
            }
            if (!s) console.warn('[sim] controller wide-extra drag: lock never cleared');
            this.wideExtras.push(g);
          }
        }
        this.contingle = this.group.angle;
        this.vector.crossVectors(this.holder.vector, this.holder.plane.normal);
        this.holder.vector.multiplyScalar(this.vector.x + this.vector.y + this.vector.z);
      }
    }
    if (this.rotating) {
      if (this.group) {
        const start = this.intersect(this.down, this.holder.plane);
        const end = this.intersect(this.move, this.holder.plane);
        this.vector.subVectors(end, start).multiply(this.holder.vector);
        const vector = CubeGroup.AXIS_VECTOR[this.group.axis];
        this.angle =
          ((-(this.vector.x + this.vector.y + this.vector.z) * (vector.x + vector.y + vector.z)) / Cubelet.SIZE) *
          Math.PI *
          this.sensitivity;
      } else {
        const dx = this.move.x - this.down.x;
        const dy = this.move.y - this.down.y;
        switch (this.axis) {
          case "y":
            this.angle = (-dx / Cubelet.SIZE) * Math.PI * this.sensitivity;
            break;
          case "x":
            this.angle = (-dy / Cubelet.SIZE) * Math.PI * this.sensitivity;
            break;
          case "z":
            this.angle = (dy / Cubelet.SIZE) * Math.PI * this.sensitivity;
            break;
          case "z'":
            this.angle = (-dy / Cubelet.SIZE) * Math.PI * this.sensitivity;
            break;
          default:
            this.angle = 0;
            break;
        }
      }
    }
  }

  handleUp(): void {
    // 手拧锁:单击(dragging 无位移)本会派 taps 转层 —— 吞掉。paintMode 不受影响
    // (它靠 taps 涂色),两者不同时开。
    if (this.dragging && this.turnsLocked && !this.paintMode) {
      this.group = null;
      this.wideExtras = [];
      this.wideSign = "";
      this.holder.index = -1;
      this.dragging = false;
      this.rotating = false;
      this.orbiting = false;
      return;
    }
    if (this.dragging) {
      let face: FACE | null = null;
      switch (this.holder.plane) {
        case this.planes[0]:
          face = FACE.R;
          break;
        case this.planes[1]:
          face = FACE.U;
          break;
        case this.planes[2]:
          face = FACE.F;
          break;
        case this.planes[3]:
          face = FACE.L;
          break;
        case this.planes[4]:
          face = FACE.D;
          break;
        case this.planes[5]:
          face = FACE.B;
          break;
      }
      for (const tap of this.taps) {
        tap(this.holder.index, face, { shift: this.downShift, button: this.downButton, alt: this.downAlt });
      }
    }
    if (this.rotating) {
      // Debug hold-partial: freeze a single-layer turn at its current dragged
      // angle (no 90° snap, no bake/record). Only single slices (no wide/alt,
      // no whole-cube orbit) and only when not view-locked.
      if (this.holdPartial && this.group && !this.lock && this.wideExtras.length === 0) {
        this.group.angle = this.contingle + this.angle; // snap visual to finger
        this.frozenGroup = this.group;
        this.group = null;
        this.holder.index = -1;
        this.dragging = false;
        this.rotating = false;
        this.orbiting = false;
        this.world.dirty = true;
        return;
      }
      let angle = this.angle;
      if (!this.lock) {
        if (Math.abs(angle) < Math.PI / 4) {
          const tick = new Date().getTime();
          const speed = (Math.abs(angle) / (tick - this.tick)) * 1000;
          if (speed > 0.2) {
            angle = angle == 0 ? 0 : ((angle / Math.abs(angle)) * Math.PI) / 2;
          }
        }
        angle = angle + this.contingle;
      } else {
        angle = 0;
      }
      if (this.group) {
        this.group.twist(angle, this.instantTurns);
        // 宽层:extras 同步 twist (snap 到 90° 倍数动画)
        for (const g of this.wideExtras) g.twist(angle, this.instantTurns);
        if (angle != 0) {
          let times = Math.round(angle / (Math.PI / 2));
          const reverse = times < 0;
          times = Math.abs(times);
          // wideSign 非空 = 宽层 / 整体转, 用拼好的 notation;否则用 group.name (单层切片现状)
          const sign = this.wideSign || this.group.name;
          const action = new TwistAction(sign, reverse, times);
          (this.world.cube as import('./cube').default).record(action);
          for (const cb of this.userTwist) cb(action);
        }
      } else {
        const groups = (this.world.cube as import('./cube').default).table.groups[this.axis[0]];
        for (const group of groups) {
          group.twist(angle, this.instantTurns);
        }
        if (angle != 0) {
          let times = Math.round(angle / (Math.PI / 2));
          const reverse = times < 0;
          times = Math.abs(times);
          const action = new TwistAction(this.axis, reverse, times);
          (this.world.cube as import('./cube').default).record(action);
          for (const cb of this.userTwist) cb(action);
        }
      }
    }
    this.group = null;
    this.wideExtras = [];
    this.wideSign = "";
    this.holder.index = -1;
    this.dragging = false;
    this.rotating = false;
    this.orbiting = false;
    this.world.dirty = true;
  }

  tick: number = new Date().getTime();
  hover = -1;
  touch = (action: TouchAction): boolean => {
    switch (action.type) {
      case "touchstart":
      case "mousedown":
        this.down.x = action.x;
        this.down.y = action.y;
        this.downShift = action.shift;
        this.downButton = action.button;
        this.downAlt = action.alt;
        this.tick = new Date().getTime();
        this.handleDown();
        break;
      case "mousemove":
      case "touchmove":
        this.move.x = action.x;
        this.move.y = action.y;
        this.handleMove();
        break;
      case "touchend":
      case "touchcancel":
      case "mouseup":
      case "mouseout":
        this.handleUp();
        break;
      default:
        return false;
    }
    return true;
  };
}
