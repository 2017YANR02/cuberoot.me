/**
 * /sim 手部指法动画 rig — 3x3 专属(world.puzzleKind === 3 时启用)。
 *
 * 同步原理:不挂事件、不改引擎热点文件 —— 每帧轮询 cube.table.groups 里
 * 各层 CubeGroup 的实时 angle(tween 播放与手动拖层都写这里),手跟着当前
 * 角度摆位,天然零漂移;drop() 归零后进入回位混合。
 *
 * 手势两类:
 *  - weld  腕转:整只手焊在转动层上,绕层轴跟转(R/L 外层、整体 x/y/z 双手)。
 *  - flick 指弹:出一根手指沿转向扫(U/D 食指/无名指、F/B 拇指/中指、M/E/S)。
 * 手/指的选择依转向(angle 符号)分配左右,映射见 classifyHandGesture(纯函数,
 * tests/hands_gestures.test.ts 锁定)。
 *
 * 握姿持久化:weld 提交(层角走满 ±90° 倍数后 drop)把该旋转烘进 per-hand 的
 * grip 基座 —— 手停在转完的位置,不自动回家(真实指法如此)。回 home / 换握由
 * 解法框记号驱动:↑ 上手(拇指起手在 U 面)、↓ 下手(D 面)、· 回 home 握,
 * 见 regrip() / simulateGrips()。
 */
import * as THREE from "three";
import { SIZE } from "../define";
import { buildHand, buildForearm, WRIST_LOCAL, type HandModel, type FingerName } from "./handModel";
import { homeLeft, homeRight, type HandPose } from "./handPoses";

/** 只读 duck-type,避免运行时 import NxN Cube(rig 只碰 groups 的 angle)。 */
export interface HandsCubeLike {
  order: number;
  table: { groups: Record<"x" | "y" | "z", { angle: number }[]> };
}

/** group.ts CubeGroup.AXIS_VECTOR 的同款轴向(x=(-1,0,0) 等)。这里复制而非
 *  import,是为了让 rig 与 NxN 引擎零 import 耦合;若上游改轴向(不可能,
 *  记号语义锁死)需同步。 */
const AXIS_VEC: Record<"x" | "y" | "z", THREE.Vector3> = {
  x: new THREE.Vector3(-1, 0, 0),
  y: new THREE.Vector3(0, -1, 0),
  z: new THREE.Vector3(0, 0, -1),
};

export type HandSide = "L" | "R";
export type Axis = "x" | "y" | "z";
export type LayerClass = "high" | "low" | "mid" | "whole";

export type HandGesture =
  | { kind: "weld"; hands: HandSide[] }
  | { kind: "flick"; hand: HandSide; finger: FingerName };

/**
 * (轴, 层类别, 转向) → 手势。dir = sign(group.angle)(angle 绕 AXIS_VEC)。
 * 直觉映射(以标准配色正视 F 绿 U 白):
 *  R/L 外层 = 同侧手腕转;U 顺(dir>0)= 右食指弹,U' = 左食指;
 *  D = 左无名指,D' = 右无名指;F = 右拇指推,F' = 左拇指;
 *  B/B' = 后侧中指(双手指尖本就搭在 B 面);M/E/S 就近借同族手指。
 *  整体 x/y/z = 双手抱转(regrip 回位)。
 */
export function classifyHandGesture(axis: Axis, cls: LayerClass, dir: 1 | -1): HandGesture {
  if (cls === "whole") return { kind: "weld", hands: ["L", "R"] };
  if (axis === "x") {
    if (cls === "high") return { kind: "weld", hands: ["R"] };
    if (cls === "low") return { kind: "weld", hands: ["L"] };
    return { kind: "flick", hand: dir < 0 ? "L" : "R", finger: "middle" }; // M 族
  }
  if (axis === "y") {
    if (cls === "high") return { kind: "flick", hand: dir > 0 ? "R" : "L", finger: "index" }; // U 族
    return { kind: "flick", hand: dir < 0 ? "L" : "R", finger: "ring" }; // D / E 族
  }
  // z 轴。F 族分手依据:拇指伸展 = 沿 F 面向上扫,F(dir>0)使左列上行 → 左拇指,
  // F' 使右列上行 → 右拇指(冻结层角实测过,反着配会出现「层往下、指往上」)。
  if (cls === "high") return { kind: "flick", hand: dir > 0 ? "L" : "R", finger: "thumb" }; // F 族
  return { kind: "flick", hand: dir < 0 ? "L" : "R", finger: "middle" }; // B / S 族
}

/** 活动层集合 → 层类别。外层优先(宽层 Rw 含 N-1 → 按 R 族做手势)。 */
export function classifyLayers(layers: number[], order: number): LayerClass {
  const hasHigh = layers.includes(order - 1);
  const hasLow = layers.includes(0);
  if (layers.length >= order || (hasHigh && hasLow)) return "whole";
  if (hasHigh) return "high";
  if (hasLow) return "low";
  return "mid";
}

/** 90° 精确跟手;180°(U2 等)超过 SOFT_LIMIT 的部分压缩 — 手腕不拧断。 */
function softClampAngle(a: number): number {
  const LIMIT = 1.62; // ≈93°
  const abs = Math.abs(a);
  if (abs <= LIMIT) return a;
  return Math.sign(a) * (LIMIT + (abs - LIMIT) * 0.28);
}

const HALF_PI = Math.PI / 2;

/** 换握目标 */
export type GripName = "home" | "up" | "down";

/**
 * 换握基座四元数:up=上手(拇指起手在 U 面,恰等于 home 被 R/L' 提交后的腕姿),
 * down=下手(D 面)。两手同为绕 x 轴 ±90°(绕 x 的旋转在 x=0 镜像下不变,左右共用)。
 */
export function gripQuat(name: GripName): THREE.Quaternion {
  const q = new THREE.Quaternion();
  if (name === "up") q.setFromAxisAngle(AXIS_VEC.x, HALF_PI);
  else if (name === "down") q.setFromAxisAngle(AXIS_VEC.x, -HALF_PI);
  return q;
}

export type GripSimStep =
  | { grip: GripName }
  | { axis: Axis; layers: number[]; quarters: number };

/**
 * 静态推演一串(转动 / 换握记号)后的两手握姿基座 — 跳步 / 拖进度条用,
 * 结果与逐步 live 播放的 weld 烘入一致(flick 不改握,weld 按层转烘入)。
 */
export function simulateGrips(steps: GripSimStep[], order: number): { R: THREE.Quaternion; L: THREE.Quaternion } {
  const grips = { R: new THREE.Quaternion(), L: new THREE.Quaternion() };
  const q = new THREE.Quaternion();
  for (const s of steps) {
    if ("grip" in s) {
      grips.R.copy(gripQuat(s.grip));
      grips.L.copy(gripQuat(s.grip));
      continue;
    }
    if (s.quarters === 0 || s.layers.length === 0) continue;
    const cls = classifyLayers(s.layers, order);
    const g = classifyHandGesture(s.axis, cls, s.quarters > 0 ? 1 : -1);
    if (g.kind !== "weld") continue;
    q.setFromAxisAngle(AXIS_VEC[s.axis], s.quarters * HALF_PI);
    for (const h of g.hands) grips[h].premultiply(q);
  }
  return grips;
}

const FADE_MS = 240;
const RECOVER_MS = 300;
const IDLE_KEEPALIVE_MS = 6000;
/** 手势判向的最小角度 — angle 起步为 0,超过此值才提交方向。 */
const COMMIT_ANGLE = 0.02;

interface HandState {
  model: HandModel;
  home: HandPose;
  /** 独立前臂(肘锚固定,每帧 IK 指向手腕 —— 腕转时肘不绕魔方公转)。 */
  forearm: THREE.Group;
  /** 肘锚点(rig 局部,画面外下方)。 */
  elbow: THREE.Vector3;
  /** 持久握姿基座(weld 提交烘入 / 换握记号设定);identity = home 握。 */
  grip: THREE.Quaternion;
  /** weld 进行中:跟随的轴;null = 未 weld。 */
  weldAxis: Axis | null;
  weldAngle: number;
  /** weld 的未压缩层角(提交烘入判定用;flick 借力通道恒 0,不烘)。 */
  weldRawAngle: number;
  /** drop 后的回位:从该四元数 slerp 回 identity。 */
  recoverQuat: THREE.Quaternion;
  recoverT: number; // 0..1,1=已回位
  /** flick 残留(手指偏移随时间衰减)。 */
  flickFinger: FingerName | null;
  flickAxis: Axis | null; // 弹指所属轴(决定扫法:y=伸展横扫,x/z=竖扫);decay 期间保留
  flickAmount: number; // 当前手指扫角(rad,随层角)
  flickDecay: number;  // drop 后残留衰减
}

export default class HandsRig extends THREE.Group {
  private readonly skinMat: THREE.MeshStandardMaterial;
  private readonly nailMat: THREE.MeshStandardMaterial;
  private readonly cuffMat: THREE.MeshStandardMaterial;
  private readonly hands: Record<HandSide, HandState>;
  private cube: HandsCubeLike | null = null;

  private enabled = false;
  private fade = 0; // 0 隐 → 1 显
  private lastActivityAt = 0;
  private idleClock = 0;
  private regripFlag = false;

  /** 当前手势(某一轴上活动层的手势);null = 静止。dir=0 表示方向未提交;
   *  lastAngle 用于识别「同轴同类连发」(U 接 U:角度从 ~π/2 跳回 ~0)。 */
  private active: { axis: Axis; cls: LayerClass; dir: 0 | 1 | -1; gesture: HandGesture | null; lastAngle: number } | null = null;

  constructor() {
    super();
    this.name = "handsRig";
    this.skinMat = new THREE.MeshStandardMaterial({ color: 0xe0ac86, roughness: 0.58, metalness: 0 });
    this.nailMat = new THREE.MeshStandardMaterial({ color: 0xf0d6c4, roughness: 0.4, metalness: 0 });
    this.cuffMat = new THREE.MeshStandardMaterial({ color: 0x3a4148, roughness: 0.85, metalness: 0 });

    // 手性对调:魔方右侧的手用 side=-1 几何。家位规格(食指压 BUR 顶、无名指压
    // BDR 底、掌心朝魔方 -x、指列朝后 -z)对「指列方向 × 食指侧 × 掌心法向」的
    // 手性有硬约束 —— side=+1 几何摆成该姿态时掌心必然朝外(差一个镜像,纯旋转
    // 无解),side=-1 恰好满足。左手镜像同理用 side=+1。
    const right = buildHand(-1, this.skinMat, this.nailMat);
    const left = buildHand(1, this.skinMat, this.nailMat);
    this.add(right.group, left.group);
    const rArm = buildForearm(this.skinMat, this.cuffMat);
    const lArm = buildForearm(this.skinMat, this.cuffMat);
    this.add(rArm.group, lArm.group);
    right.meshes.push(...rArm.meshes);
    left.meshes.push(...lArm.meshes);
    this.hands = {
      R: this.initHandState(right, homeRight(), rArm.group, new THREE.Vector3(SIZE * 4.4, -SIZE * 5.2, SIZE * 1.4)),
      L: this.initHandState(left, homeLeft(), lArm.group, new THREE.Vector3(-SIZE * 4.4, -SIZE * 5.2, SIZE * 1.4)),
    };

    // 手专属补光:layer 1(魔方在默认 layer 0,不受影响;手网格同时在 0+1,
    // 场景主光照到手,补光只照手)。左前暖 + 右下冷,把背光侧从死黑里捞出来。
    const fillA = new THREE.DirectionalLight(0xfff0e2, Math.PI * 0.28);
    fillA.position.set(-SIZE * 3, SIZE * 1.5, SIZE * 3);
    fillA.layers.set(1);
    const fillB = new THREE.DirectionalLight(0xdfe8f5, Math.PI * 0.16);
    fillB.position.set(SIZE * 2, -SIZE * 3, SIZE * 2);
    fillB.layers.set(1);
    this.add(fillA, fillB);
    for (const s of ["R", "L"] as const) {
      for (const m of this.hands[s].model.meshes) m.layers.enable(1);
    }

    this.visible = false;
  }

  private initHandState(model: HandModel, home: HandPose, forearm: THREE.Group, elbow: THREE.Vector3): HandState {
    model.group.position.copy(home.pos);
    model.group.quaternion.copy(home.quat);
    return {
      model,
      home,
      forearm,
      elbow,
      grip: new THREE.Quaternion(),
      weldAxis: null,
      weldAngle: 0,
      weldRawAngle: 0,
      recoverQuat: new THREE.Quaternion(),
      recoverT: 1,
      flickFinger: null,
      flickAxis: null,
      flickAmount: 0,
      flickDecay: 0,
    };
  }

  /** rig 只在 3x3 上活动;其它拼图/关开关时传 null。 */
  attachCube(cube: HandsCubeLike | null): void {
    if (this.cube === cube) return;
    this.cube = cube;
    this.active = null;
    this.resetGrips();
  }

  /** 握姿全清回 home(挂/摘 cube 或瞬时跳步前的硬复位)。 */
  private resetGrips(): void {
    for (const side of ["R", "L"] as const) {
      const h = this.hands[side];
      h.grip.identity();
      h.recoverT = 1;
      h.weldAxis = null;
      h.weldAngle = 0;
      h.weldRawAngle = 0;
      h.flickFinger = null;
      h.flickAxis = null;
      h.flickAmount = 0;
      h.flickDecay = 0;
    }
    this.regripFlag = false;
  }

  /**
   * 换握(动画):两手 slerp 到指定握姿基座 —— 解法框记号 ↑/↓/· 驱动。
   * 把「当前显示偏移 ∘ 旧 grip」折算成相对新 grip 的回位余量,切换瞬间画面连续。
   */
  regrip(name: GripName): void {
    const target = gripQuat(name);
    const q = HandsRig._qTmp;
    let any = false;
    for (const side of ["R", "L"] as const) {
      const h = this.hands[side];
      if (h.weldAxis) {
        q.setFromAxisAngle(AXIS_VEC[h.weldAxis], h.weldAngle);
      } else if (h.recoverT < 1) {
        const t = 1 - Math.pow(1 - h.recoverT, 3);
        q.copy(h.recoverQuat).slerp(HandsRig._qIdent, t);
      } else {
        q.identity();
      }
      q.multiply(h.grip).multiply(HandsRig._qTmp2.copy(target).invert());
      h.grip.copy(target);
      h.weldAxis = null;
      h.weldAngle = 0;
      h.weldRawAngle = 0;
      if (q.angleTo(HandsRig._qIdent) < 0.01) {
        h.recoverT = 1; // 已在目标握姿,免 300ms 空转(播放循环靠 isRegripping 闸步)
        continue;
      }
      h.recoverQuat.copy(q);
      h.recoverT = 0;
      any = true;
    }
    if (any) {
      this.regripFlag = true;
      this.lastActivityAt = performance.now();
    }
  }

  /** 瞬时设定两手握姿基座(跳步 / 拖进度条的静态摆位,配 simulateGrips)。 */
  setGrips(qR: THREE.Quaternion, qL: THREE.Quaternion): void {
    this.hands.R.grip.copy(qR);
    this.hands.L.grip.copy(qL);
    for (const side of ["R", "L"] as const) {
      const h = this.hands[side];
      h.recoverT = 1;
      h.weldAxis = null;
      h.weldAngle = 0;
      h.weldRawAngle = 0;
      h.flickFinger = null;
      h.flickAxis = null;
      h.flickAmount = 0;
      h.flickDecay = 0;
    }
    this.regripFlag = false;
  }

  /** 换握动画进行中(播放循环用它闸住下一步;普通 weld 回位不算)。 */
  get isRegripping(): boolean {
    return this.regripFlag;
  }

  setEnabled(on: boolean): void {
    // visible 无条件跟 on 拉起(不能挂在 enabled-diff 后面:dt=0 帧曾把
    // visible 误置 false,若 enabled 未变就再也拉不起来)。
    if (on) this.visible = true;
    if (this.enabled === on) return;
    this.enabled = on;
    this.lastActivityAt = 0; // 让 tick 重新计 keepalive
    for (const mat of [this.skinMat, this.nailMat, this.cuffMat]) {
      mat.transparent = true; // 渐变期间开启;fade 达到 1 后关掉(省排序)
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** 每帧驱动;返回 true = 画面有变化需要重渲。 */
  tick(dtMs: number): boolean {
    if (!this.visible) return false;
    const dt = Math.min(dtMs, 100); // 掉帧保护
    let animating = false;

    // —— 淡入淡出 ——
    const fadeTarget = this.enabled ? 1 : 0;
    if (this.fade !== fadeTarget) {
      const step = dt / FADE_MS;
      this.fade = fadeTarget > this.fade ? Math.min(1, this.fade + step) : Math.max(0, this.fade - step);
      const eased = this.fade * this.fade * (3 - 2 * this.fade);
      for (const mat of [this.skinMat, this.nailMat, this.cuffMat]) mat.opacity = eased;
      // 只在「淡出完成」隐藏 —— 淡入起点 fade=0 碰上 dt=0 帧不能误藏。
      if (this.fade === 0 && !this.enabled) this.visible = false;
      if (this.fade === 1) for (const mat of [this.skinMat, this.nailMat, this.cuffMat]) mat.transparent = false;
      animating = true;
      this.lastActivityAt = performance.now();
    }
    if (!this.visible) return true;

    // —— 轮询当前转动层 ——
    const now = performance.now();
    const cube = this.cube;
    if (cube) {
      let axis: Axis | null = null;
      let layers: number[] | null = null;
      let repAngle = 0;
      for (const a of ["x", "y", "z"] as const) {
        const gs = cube.table.groups[a];
        let ls: number[] | null = null;
        let best = 0;
        for (let l = 0; l < gs.length; l++) {
          const ang = gs[l].angle;
          if (ang !== 0) {
            (ls ??= []).push(l);
            if (Math.abs(ang) > Math.abs(best)) best = ang;
          }
        }
        if (ls && (axis === null || Math.abs(best) > Math.abs(repAngle))) {
          axis = a;
          layers = ls;
          repAngle = best;
        }
      }

      if (axis && layers) {
        this.lastActivityAt = now;
        animating = true;
        const cls = classifyLayers(layers, cube.order);
        // 招式队列是同步接续的(drop → 下一步 twist 在同一 tick),中间可能
        // 没有「零活动帧」—— 所以轴变 / 层类变 / 同类连发 / 方向反转四种切换
        // 都要在这里显式收尾旧手势,否则上一手的 weld 姿态永远悬着(踩过)。
        if (!this.active || this.active.axis !== axis || this.active.cls !== cls) {
          this.endGesture();
          this.active = { axis, cls, dir: 0, gesture: null, lastAngle: 0 };
        } else if (this.active.gesture && Math.abs(repAngle) < Math.abs(this.active.lastAngle) - 0.8) {
          // 同轴同类连发(U 接 U):角度从 ~π/2 跳回 ~0 = 新的一步。
          this.endGesture();
          this.active.gesture = null;
          this.active.dir = 0;
        }
        const act = this.active;
        if (Math.abs(repAngle) >= COMMIT_ANGLE) {
          const dir: 1 | -1 = repAngle > 0 ? 1 : -1;
          if (act.gesture && act.dir !== 0 && act.dir !== dir) {
            // 转向反转(拖拽回拉 / U 接 U'):换手重分类。
            this.endGesture();
            act.gesture = null;
          }
          if (!act.gesture) {
            act.gesture = classifyHandGesture(axis, cls, dir);
            act.dir = dir;
            this.beginGesture(act.gesture, axis);
          }
        }
        if (act.gesture) this.driveGesture(act.gesture, axis, repAngle);
        act.lastAngle = repAngle;
      } else if (this.active) {
        // 层已 drop(角度归零 & bake)→ 手势进入回位。
        this.endGesture();
        this.active = null;
        this.lastActivityAt = now;
        animating = true;
      }
    }

    // —— 回位 / 残留衰减 / 待机微动 ——
    this.idleClock += dt;
    const keepalive = now - this.lastActivityAt < IDLE_KEEPALIVE_MS;
    for (const side of ["R", "L"] as const) {
      const h = this.hands[side];
      if (h.recoverT < 1) {
        h.recoverT = Math.min(1, h.recoverT + dt / RECOVER_MS);
        animating = true;
      }
      if (h.flickDecay > 0) {
        h.flickDecay = Math.max(0, h.flickDecay - dt / RECOVER_MS);
        if (h.flickDecay === 0) { h.flickFinger = null; h.flickAxis = null; }
        animating = true;
      }
      this.applyHand(side, keepalive);
    }
    if (this.regripFlag && this.hands.R.recoverT >= 1 && this.hands.L.recoverT >= 1) {
      this.regripFlag = false;
    }
    if (keepalive) animating = true;
    return animating;
  }

  // ================= 手势生命周期 =================

  private beginGesture(g: HandGesture, axis: Axis): void {
    if (g.kind === "weld") {
      for (const s of g.hands) {
        const h = this.hands[s];
        h.weldAxis = null; // driveGesture 里设,先清残留
        h.weldAngle = 0;
        h.weldRawAngle = 0;
        h.recoverT = 1; // weld 直接接管,丢弃未完的回位
      }
    } else {
      const h = this.hands[g.hand];
      h.flickFinger = g.finger;
      h.flickAxis = axis;
      h.flickAmount = 0;
      h.flickDecay = 0;
    }
  }

  private driveGesture(g: HandGesture, axis: Axis, angle: number): void {
    if (g.kind === "weld") {
      for (const s of g.hands) {
        const h = this.hands[s];
        h.weldAxis = axis;
        h.weldAngle = softClampAngle(angle);
        h.weldRawAngle = angle;
      }
    } else {
      const h = this.hands[g.hand];
      h.flickAmount = softClampAngle(angle);
      // 弹指时手腕轻微借力(跟 1/6 角度),applyHand 里通过 weld 通道叠加。
      h.weldAxis = axis;
      h.weldAngle = softClampAngle(angle) * 0.16;
      h.weldRawAngle = 0; // 借力不烘入握姿
    }
  }

  private endGesture(): void {
    for (const side of ["R", "L"] as const) {
      const h = this.hands[side];
      if (h.weldAxis) {
        // weld 提交(未压缩层角走满 ±90° 倍数)→ 把该旋转烘进持久握姿基座,手停在
        // 转完的位置不回家;残余(压缩差/采样差)折进回位四元数抹平。未提交(拖拽
        // 回弹,snap=0)→ 维持旧行为:整段 weld 姿态 slerp 回当前握姿。
        const snap = Math.round(h.weldRawAngle / HALF_PI);
        if (snap !== 0) {
          h.grip.premultiply(HandsRig._qTmp2.setFromAxisAngle(AXIS_VEC[h.weldAxis], snap * HALF_PI));
          h.recoverQuat.setFromAxisAngle(AXIS_VEC[h.weldAxis], h.weldAngle - snap * HALF_PI);
        } else {
          h.recoverQuat.setFromAxisAngle(AXIS_VEC[h.weldAxis], h.weldAngle);
        }
        h.recoverT = 0;
        h.weldAxis = null;
        h.weldAngle = 0;
        h.weldRawAngle = 0;
      }
      if (h.flickFinger) {
        h.flickDecay = 1;
        // flickAmount 保留为残留幅度,由 flickDecay 衰减。
      }
    }
  }

  // ================= 每帧姿态合成 =================

  private static _qTmp = new THREE.Quaternion();
  private static _qTmp2 = new THREE.Quaternion();
  private static _qIdent = new THREE.Quaternion();
  private static _eTmp = new THREE.Euler();
  private static _vTmp = new THREE.Vector3();
  private static _vTmp2 = new THREE.Vector3();
  private static _xAxis = new THREE.Vector3(1, 0, 0);

  private applyHand(side: HandSide, idle: boolean): void {
    const h = this.hands[side];
    const g = h.model.group;
    const sideSign = h.model.side;
    const q = HandsRig._qTmp;

    // 手根变换 = 偏移旋转(weld 实时 / 回位余量) ∘ 持久握姿基座 ∘ home。
    if (h.weldAxis) {
      q.setFromAxisAngle(AXIS_VEC[h.weldAxis], h.weldAngle);
    } else if (h.recoverT < 1) {
      // easeOutCubic 回位
      const t = 1 - Math.pow(1 - h.recoverT, 3);
      q.copy(h.recoverQuat).slerp(HandsRig._qIdent, t);
    } else {
      q.identity();
    }
    q.multiply(h.grip);
    g.quaternion.copy(q).multiply(h.home.quat);
    g.position.copy(h.home.pos).applyQuaternion(q);

    // 待机微动:极轻的呼吸浮动(位移 ±1.2,相位左右手错开)。
    if (idle && !h.weldAxis) {
      const t = this.idleClock / 1000;
      const ph = side === "R" ? 0 : 1.7;
      g.position.y += Math.sin(t * 1.1 + ph) * 1.2;
      g.position.z += Math.cos(t * 0.9 + ph) * 0.8;
    }

    // 前臂 IK:origin 贴到手腕接驳点,+x 指向「肘 → 腕」方向 —— 肘锚固定,
    // 腕转/弹指/回位时前臂自然摆动而不是整条手臂绕魔方公转。
    const wrist = HandsRig._vTmp.copy(WRIST_LOCAL).applyQuaternion(g.quaternion).add(g.position);
    h.forearm.position.copy(wrist);
    const dir = HandsRig._vTmp2.copy(wrist).sub(h.elbow).normalize();
    h.forearm.quaternion.setFromUnitVectors(HandsRig._xAxis, dir);

    // 手指姿态 = home 弯曲 + flick 偏移。
    const flickA = h.flickFinger ? h.flickAmount * (h.flickDecay > 0 ? h.flickDecay : 1) : 0;
    for (const name of ["thumb", "index", "middle", "ring", "pinky"] as const) {
      const f = h.model.fingers[name];
      const pose = h.home.fingers[name];
      let c1 = pose.curl[0];
      let c2 = pose.curl[1];
      let c3 = pose.curl[2];
      let splay = pose.splay * sideSign;
      if (h.flickFinger === name && flickA !== 0) {
        // 弹指(前后钳形握姿)分三种扫法,匹配接触点处层面的真实运动方向:
        //  拇指(F 族):折叠的中节展开 → 沿 F 面向上大扫幅;
        //  y 轴(U/D/E,食指/无名指):层动是水平的 → 伸展横扫(钩握弹直);
        //  x/z 轴中指(M/B/S 族):接触立柱处层动是竖直的 → splay 竖扫为主。
        const open = Math.min(1, Math.abs(flickA) / 1.3);
        if (name === "thumb") {
          c1 -= open * 0.25;
          c2 -= open * 0.9;
          c3 -= open * 0.35;
        } else if (h.flickAxis === "y") {
          c1 -= open * 0.28;
          c2 -= open * 0.5;
          c3 -= open * 0.55;
          splay += flickA * 0.22 * (side === "R" ? 1 : -1) * sideSign;
        } else {
          // x/z 族竖扫。世界系扫向:z 族(B/S)两手各推自己那根立柱,方向随
          // dir 与手绑定(右列 down=dir 正);x 族(M/E' 同轴)绕 x 转时整个
          // B 面同向竖移,与手无关 —— 先算世界竖向 vy,再按「右手 splay 正
          // = 世界向下 / 左手相反」换算符号(不能用镜像对称公式:绕 x 的旋转
          // 在 x=0 镜像下不变,两手需求会打架,推导见 memory)。
          c1 -= open * 0.15;
          c2 -= open * 0.25;
          c3 -= open * 0.3;
          const vy = (h.flickAxis === "z" && side === "L" ? 1 : -1) * Math.sign(flickA);
          splay += (side === "R" ? -1 : 1) * vy * 0.45 * Math.abs(flickA);
        }
      }
      // 指根 = 基座朝向 ∘ (curl/splay)。四指基座为 identity;拇指基座是对掌位
      // 四元数 —— 直接写 rotation 会抹掉它(踩过),必须叠加。
      HandsRig._eTmp.set(0, -c1, splay);
      f.root.quaternion.setFromEuler(HandsRig._eTmp).premultiply(f.rootBase);
      f.mid.rotation.set(0, -c2, 0);
      f.tip.rotation.set(0, -c3, 0);
    }
  }

  /** 释放几何/材质(rig 与 world 同生命周期,当前无人调用;备完整性)。 */
  dispose(): void {
    for (const side of ["R", "L"] as const) {
      for (const m of this.hands[side].model.meshes) m.geometry.dispose();
    }
    this.skinMat.dispose();
    this.nailMat.dispose();
    this.cuffMat.dispose();
  }
}
