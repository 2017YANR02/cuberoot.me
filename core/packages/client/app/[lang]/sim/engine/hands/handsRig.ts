/**
 * /sim 手部指法动画 rig，供标准二至四阶共用。
 *
 * 同步原理:不挂事件、不改引擎热点文件 —— 每帧轮询 cube.table.groups 里
 * 各层 CubeGroup 的实时 angle(tween 播放与手动拖层都写这里),手跟着当前
 * 角度摆位,天然零漂移;drop() 归零后进入回位混合。
 *
 * 手势两类(**指法权威规格表:同目录 FINGERTRICKS.md,改指法先改那里**):
 *  - weld  腕转:整只手焊在转动层上,绕层轴跟转(R/L 外层、整体 x/y/z 双手)。
 *  - flick 指弹:出一根手指沿转向扫(U/D 食指/无名指、F/B 拇指/中指、M/E/S)。
 *    F 右中手、F' 左中手「食指越顶」topPush;y 族双中手接触勾拨 hook(180° 提示连拨:
 *    U2 食指→中指、D2' 小指→无名指,首指保持、双指齐收);B' 右食指 backHook;
 *    U'p 右食指推 upPush。F 层主动手下起手:食指 downPush,半转接中指。
 * 手/指的选择依转向(angle 符号)+ 握姿 + 转前提示分配,映射见
 * classifyHandGesture(纯函数,tests/hands_gestures.test.ts 锁定)。
 *
 * 握姿持久化:x 轴单层 weld(R/L)提交(层角走满 ±90° 倍数后 drop)把该旋转
 * 烘进 per-hand 的 grip 基座 —— 手停在转完的位置,不自动回家(真实指法如此)。
 * 整体转体随层等角度抱转，提交后右手先回握、左手支撑，再交换。
 * 整体转动不写入 grip。回 home / 换握由解法框记号驱动:↑ 上手
 * (拇指起手在 U 面)、↓ 下手(D 面)、· 回 home 握;手别由空白定(FINGERTRICKS
 * §2:记号紧贴后续字符 = 右手,后随空白/串尾 = 左手),见 regrip() / simulateGrips()。
 *
 * 穿模禁令(用户规格:任何时刻手指不得嵌入魔方,含转动途中)三机制:
 *  1. 静置贴面 = 肉面标定(handPoses,蒙皮顶点距体表 0.7~0.8U 相切);
 *  2. 转层避让随层角只驱动手指关节。
 *  3. 换握沿原握姿的旋转弧行进，靠张指让开棱角。
 */
import * as THREE from "three";
import { alignFrontIndex, easeFingerKnuckle } from "./frontKnuckle";
import type { SkinStroke } from './halfPalmContactSkin';
import { frontIndexNailPose } from './frontIndexNail';
import { frontThumbNailPose } from './frontThumbNail';
import { upperRingRelayPose } from './upperRingRelay';
import { homeIndexHook } from "./homeIndexHook";
import { HalfPalmPose } from "./halfPalmPose";
import { UPPER_U_INDEX_FOLLOW, FRONT_INDEX_FOLLOW, frontIndexReturn } from "./frontIndexFollow";
import { isPushOrder, pushRules } from '@/lib/push-notation';
import { evenMarkFitsGrip, evenMarkedStroke, isEvenFrontQuarter } from '../../evenFingerNotation';
import { calibratedStroke, frontCornerStroke, handBearings, strokeTangent, type CalibratedStroke } from './strokeGeometry';
import type Cube from '../nxn/cube';
import { capturePinchFingers, RightCornerPinch } from './rightCornerPinch';
import { homePushPose, pocketPushMiddle } from './homePush';
import { lowerHookPose } from './homeLowerHook';
import { inspectWideGrip, WideSupport } from './wideSupport';
import { mixedGripPose, isMixedPush, isSliceNail, lowerSliceBrace, type MixedPush } from './mixedGripPush';
import { isMiddleSliceStroke, middleSlicePose, middleSliceSupport, middleSliceTiming, M_RELAY_SHIFT } from "./middleSliceMotion";
import { sliceIndexPose } from "./sliceIndexMotion";
import { frontDownPose } from "./frontDownMotion";
import { FourLayerContact, innerRingApproachOffset, innerBraceProfile, isEquatorBand, type InnerBraceProfile, type FourLayerStroke } from './fourLayerContact';
import { SIZE } from "../define";
import { measureFinalHandPose } from './finalHandPose';
import { ForearmRotation, WRIST_BEND_MAX, WRIST_RADIAL_SIN, WRIST_ULNAR_SIN } from "./armKinematics";
import { buildForearm, makeSkinDetailTexture, HAND_SCALE, WRIST_LOCAL, type HandModel, type FingerName } from "./handModel";
import { loadManoHand } from "./handModelMano";
import { paintNailPolish, type NailPolishSpec } from "./handModelGltf";
import { SmplxBody, loadSmplxOnePiece } from "./smplxBody";
import { applyBakedSkinMaps, bakeHandTextures } from "./bakeHandTexture";
import { addHandSkeleton, makeHandSkeletonMats, type SkeletonMatKey } from "./handSkeleton";
import { homeLeft, homeRight, POCKET_MIDDLE_CURL, POCKET_MIDDLE_SPLAY, type HandPose } from "./handPoses";
import type { FingerAnnotation } from '@/lib/alg-finger-marks';
import { chooseMarkedFingerPlan, fingerChannels, markedStartContact, MarkedFingerMotion, type MarkedTurnRequest } from './markedFingerMotion';
import {
  applyPocketFingerPose, halfSupportClearance, halfDownIndex, halfDownThumb, halfThumb, homeIndex, homeMiddle, homeMiddleClearance, leftDownRing, leftIndex, leftMiddle, rightDownRing,
  reverseRingApproach, reverseRingContact, reverseRingSupport, seatPocketFinger, upperIndexClearance, upperMiddle, upperRingClearance,
  upperThumbClearance,
} from './pocketFingerContact';
import { applyPocketFaceStroke, pocketBottomRelay, pocketFrontThumb, pocketBackRelay } from './pocketFaceContact';
import { MARKED_CLEARANCE, MARKED_FINGER_PROFILES } from './markedFingerPoses';

/** 只读 duck-type,避免运行时 import NxN Cube(rig 只碰 groups 的 angle)。 */
export interface HandsCubeLike {
  order: number;
  table: { groups: Record<"x" | "y" | "z", { angle: number; targetAngle?: number; isDragging?: boolean }[]> };
  twister?: {
    backlog?: number;
    halfTurnDirection?: (axis: string, layer: number) => 1 | -1 | undefined;
    strokeEasing?: (axis: string, layers: readonly number[], twist: number) => import('@cuberoot/puzzle-render-core/engine/tweener').TweenEasing | undefined;
  };
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

/** 指弹样式(规格与编排细节见同目录 FINGERTRICKS.md):
 *  topPush 手局部食指路径(中起手 F 族 / 右上起手单步 U)/ hook 贴面勾拨(双中手 y 族,含连拨)/
 *  backHook 双中手 B' 右食指背钩 / downPush 左中右下 F 族右食指下拨 /
 *  upPush 顶层推法（左右食指从相应侧面的上排推向背面）。无 style = 遗留扫法(非标准握)。 */
export type FlickStyle = "markedRingNail" | "frontIndexNail" | "frontThumbNail" | "lowerPush" | "lowerHook" | "upperRingRelay" | "indexHook" | "reverseIndexHook" | "reverseRingHook" | "pocketThumbLift" | "topPush" | "hook" | "backHook" | "downPush" | "upPush" | "marked" | "middleSliceNail" | "middleSlicePad" | MixedPush;

export type HandGesture =
  | { kind: "weld"; hands: HandSide[] }
  | { kind: "flick"; hand: HandSide; finger: FingerName; finger2?: FingerName; style?: FlickStyle };

/** 两手当前握姿名(null = 非标准握,如 weld 途中/自定义积);由 grip 四元数判读。 */
export interface HandGripNames { R: GripName | null; L: GripName | null }

function prefersLeftUpperRelay({ R, L }: HandGripNames): boolean {
  // A home left hand can start immediately. When both wrists are turned,
  // retain the existing regrip path for a quarter-turned right wrist.
  return (L === 'home' && R !== 'home') || R === 'up' || R === 'down';
}

/** 播放/键盘路径的转前提示(prepareTwist 登记):quarters=180° 才连拨;push 表示显式 p 后缀。 */
type HomeStroke = CalibratedStroke;

function evenOrderStroke(order: 2 | 4, grips: HandGripNames, axis: Axis, layers: number[], dir: 1 | -1, quarters: number): HomeStroke | undefined {
  const cls = classifyLayers(layers, order);
  const hand = dir > 0 ? 'R' : 'L';
  const double = quarters === 2;
  if (cls === 'whole') return;
  const native = gestureForLayers(axis, layers, dir, grips, { quarters }, order);
  if (order === 2 && native.kind === 'flick' && native.style === 'pocketThumbLift') return;
  if (cls === 'mid') {
    if (order !== 4 || native.kind !== 'flick') return;
    if (axis === 'z') {
      // Front/back inner bands require the same top approach from opposite wrists.
      return { grip: 'home', gesture: { kind: 'flick', hand, finger: 'index',
        finger2: double ? 'middle' : undefined, style: 'topPush' } };
    }
    if (grips[native.hand] !== 'home') {
      // The entry grip identifies the driving hand. Once reseated, use the
      // stroke that actually starts from home, including the upper index hook.
      const seated = gestureForLayers(axis, layers, dir, { ...grips, [native.hand]: 'home' }, { quarters }, order);
      if (seated.kind === 'flick') return { grip: 'home', gesture: seated };
    }
    return;
  }
  if (axis === 'x') return;
  if (!double || axis === 'y' && cls === 'high') {
    if (native.kind !== 'flick' || native.style && (!double || native.finger2)) return;
    if (axis === 'y' && cls === 'high') return { grip: 'home', gesture: { kind: 'flick', hand,
      finger: 'index', finger2: double ? 'middle' : undefined, style: double ? 'hook' : 'indexHook' } };
    if (axis === 'z' && cls === 'high') return { grip: 'down', gesture: { kind: 'flick', hand, finger: 'index', style: 'downPush' } };
    return { grip: 'home', gesture: { kind: 'flick', hand, finger: axis === 'y' ? 'ring' : 'index',
      style: axis === 'y' ? 'hook' : 'backHook' } };
  }
  if (axis === 'z' && cls === 'high') return { grip: 'down',
    gesture: { kind: 'flick', hand, finger: 'index', finger2: 'middle', style: 'downPush' } };
  if (cls === 'low') {
    if (order === 4 && layers.length !== 2) return { grip: axis === 'z' ? 'down' : 'home',
      gesture: { kind: 'flick', hand, finger: 'pinky', finger2: 'ring', style: 'lowerHook' } };
    if (axis === 'z') return { grip: 'home',
      gesture: { kind: 'flick', hand, finger: 'index', finger2: 'middle', style: 'backHook' } };
    return { grip: 'home', gesture: { kind: 'flick', hand, finger: 'pinky', finger2: 'ring', style: 'hook' } };
  }
  return;
}

// The entry grip selects a rule. The required grip determines whether to
// seat the driving wrist before starting the layer or use the finger directly.
export function planHomeStroke(order: number, grips: HandGripNames, axis: Axis, layers: number[],
  dir: 1 | -1, quarters: number): HomeStroke | undefined {
  if (!grips.R || !grips.L || (quarters !== 1 && quarters !== 2)) return;
  const cls = classifyLayers(layers, order);
  const hand = dir > 0 ? 'R' : 'L';
  const double = quarters === 2;
  if (order === 2 || order === 4) return evenOrderStroke(order, grips, axis, layers, dir, quarters);
  if (order !== 3) return;
  const calibrated = calibratedStroke(grips, axis, cls, layers, dir, quarters);
  if (calibrated) return calibrated;
  const other = hand === 'R' ? 'L' : 'R';
  const wide = layers.length === 2;
  if (cls === 'whole' || axis === 'x' && cls !== 'mid') return;

  // Keep calibrated native strokes. Generic sweeps have no sticker target.
  const native = classifyHandGesture(axis, cls, dir, grips, { quarters }, !wide, order);
  if (native.kind !== 'flick') return;
  const upperWideRelay = axis === 'y' && cls === 'high' && wide && double;
  if (!upperWideRelay && native.style && (!double || native.finger2 || !wide && native.style === 'topPush')) return;
  if (axis === 'y' && cls === 'high')
    return { grip: 'home', gesture: double
      ? { kind: 'flick', hand, finger: 'index', finger2: 'middle', style: 'downPush' }
      : { kind: 'flick', hand, finger: 'index', style: 'indexHook' } };
  if (axis === 'z' && cls === 'high')
    return { grip: 'down', gesture: { kind: 'flick', hand, finger: 'index', style: 'downPush' } };
  if (cls !== 'mid') return;
  if (axis === 'x')
    return { grip: 'home', gesture: { kind: 'flick', hand: 'L',
      finger: 'ring', finger2: double ? 'pinky' : undefined,
      style: !double && dir < 0 ? 'middleSliceNail' : 'middleSlicePad' } };
  if (axis === 'z' && !double)
    return { grip: 'home', gesture: { kind: 'flick', hand, finger: 'index', style: 'topPush' } };
  // A quarter turn of the wrist maps the S slice and its two side stickers to E.
  return { grip: axis === 'y' ? 'down' : 'home', gesture: {
    kind: 'flick', hand: axis === 'y' ? hand : other, finger: 'index', style: double ? 'sliceNailDouble' : 'sliceNail',
  } };
}

export type MarkedMotionProblem = 'unsupported-grip' | 'invalid-start' | 'model-unavailable';
export interface TwistHint { homeStroke?: HomeStroke; quarters?: number; push?: boolean; nail?: boolean; thumb?: boolean; middleRelay?: boolean }

/** FTN `@pin` 注解(§7,解析层产出;编排目前仅 `R[R2:@C]`):weld 前置贴块
 *  钉指 —— 转动开始前指尖先到贴纸,weld 段随手刚体转,提交后收指。 */
export interface PinSpec { hand: HandSide; finger: FingerName; sticker: string }

/** Read-only instrumentation. Models are borrowed only while the callback runs. */
export interface HandDiagnosticFrame {
  atMs: number;
  event: 'prepare-u' | 'frame' | 'end-u' | 'reset' | 'disabled' | 'dispose' | 'grip-request' | 'grip-set';
  gripRequest?: { name: GripName; sides: HandSide[]; halfDirection?: 'up' | 'down'; reason?: 'stroke-return' | 'stroke-seat' };
  preparedGesture?: HandGesture;
  grips: HandGripNames;
  hands: Record<HandSide, {
    phase: 'stable' | 'regripping' | 'turning' | 'preparing' | 'returning';
    grip: number[];
    position: number[];
    quaternion: number[];
    /** Signed wrist winding and persistent forearm pose distinguish ↑↑ from ↓↓. */
    wristAngle: number;
    forearmRoll: number;
    forearmQuaternion: number[] | null;
    /** Virtual elbow target and wrist deflection, in rig space / radians. */
    elbowPosition?: number[];
    wristBend?: number;
    finalPose?: ReturnType<typeof measureFinalHandPose>;
    flickAngle: number;
    decay: number;
  }>;
  active: { axis: Axis; cls: LayerClass; layers: readonly number[]; angle: number; halfTurn?: boolean; bearing?: CalibratedStroke['bearing']; gesture: HandGesture | null } | null;
  wideSupport?: { hand: HandSide; fingers: readonly FingerName[]; shift: number[]; progress: number };
  marked?: { profile: string; hand: HandSide; finger: FingerName; contact: 'pad' | 'nail'; preparing: boolean; returning: boolean };
  models: Record<HandSide, HandModel>;
}

function isHomePushStyle(style?: FlickStyle | null): boolean {
  return style === 'upPush' || style === 'lowerPush';
}

/**
 * (轴, 层类别, 转向, 握姿, 提示) → 手势。dir = sign(group.angle)(angle 绕 AXIS_VEC)。
 * 权威规格表在 FINGERTRICKS.md(改指法先改那里);直觉映射(标准配色正视 F 绿 U 白):
 *  R/L 外层 = 同侧手腕转;U 顺(dir>0)= 右食指弹,U' = 左食指;
 *  D = 左无名指,D' = 右无名指;F = 右拇指推,F' = 左拇指;
 *  B/B' = 后侧中指(双手指尖本就搭在 B 面);M/E/S 就近借同族手指。
 *  整体 x/y/z = 双手抱转(regrip 回位)。
 * 中下混握的普通 F / F′ 由下手食指下拨或拇指上顶，左右镜像。
 * 中手食指可用指腹按 S 或用甲面反向顶 S。半转、宽层分别沿用其原有编排。
 * 双中手(grips 全 home)专项:y 族走接触勾拨 hook
 * (U/U' 食指、D/D' 无名指,180° 提示时连拨:U2 食指→中指、D2' 小指→无名指);
 * B' 右食指 backHook(B 左食指镜像);U'p 右食指推 upPush。
 * 未命中上述条件时回落遗留映射(几何未标定)。
 */
export function classifyHandGesture(
  axis: Axis, cls: LayerClass, dir: 1 | -1,
  grips: HandGripNames = { R: null, L: null }, hint?: TwistHint, singleLayer = true, order = 3,
): HandGesture {
  const bothHome = grips.R === "home" && grips.L === "home";
  const double = (hint?.quarters ?? 1) >= 2;
  if (cls === "whole") return { kind: "weld", hands: ["L", "R"] };
  if (axis === "x") {
    if (cls === "high") return { kind: "weld", hands: ["R"] };
    if (cls === "low") return { kind: "weld", hands: ["L"] };
    if (order === 3 && singleLayer && bothHome) {
      if (double) return { kind: "flick", hand: "L", finger: "ring", finger2: "pinky", style: "middleSlicePad" };
      if (dir < 0 && hint?.nail) return { kind: 'flick', hand: 'L', finger: 'ring', style: 'markedRingNail' };
      return { kind: "flick", hand: "L", finger: "ring", style: dir < 0 ? "middleSliceNail" : "middleSlicePad" };
    }
    return { kind: "flick", hand: dir < 0 ? "L" : "R", finger: "middle" };
  }
  if (axis === "y") {
    if (isPushOrder(order) && singleLayer && !double && bothHome && hint?.push) {
      const rule = pushRules.find(r => r.layer === cls && r.dir === dir);
      if (rule) return { kind: 'flick', hand: rule.hand, finger: rule.finger, style: rule.layer === 'low' ? 'lowerPush' : 'upPush' };
    }
    if (cls === "high") {
      const hand = dir > 0 ? "R" : "L";
      const other = hand === 'R' ? 'L' : 'R';
      // The home index pushes from L1 (U) or R1 (U′). The support wrist stays seated.
      if (order === 3 && singleLayer && !double && hint?.nail && grips[other] === 'home'
        && (grips[hand] === 'home' || grips[hand] === 'up' || grips[hand] === 'down')) {
        return { kind: 'flick', hand: other, finger: 'index', style: 'upPush' };
      }
      // R 把 home 的 U8 就位姿转到 B0；普通上握 U 的右食指复用中握 F 的接触路径。
      const upperDouble = singleLayer && hint?.quarters === 2;
      if (order === 3 && upperDouble && hint?.nail && grips[hand] === 'home' && grips[other] === 'down') {
        return { kind: 'flick', hand, finger: 'index', finger2: 'ring', style: 'upperRingRelay' };
      }
      const leftRelay = hand === 'L' && prefersLeftUpperRelay(grips) && (order === 3 || order === 4);
      if (order === 3 && upperDouble && hint?.middleRelay && grips[hand] === 'home') {
        // A down-grip F double and a home-grip U double coincide in hand space.
        return { kind: 'flick', hand, finger: 'index', finger2: 'middle', style: 'downPush' };
      }
      const relayDouble = upperDouble && !hint?.push && (order === 2 || leftRelay);
      if ((dir > 0 || relayDouble) && (!double || upperDouble) && !hint?.push && grips[hand] === "up") {
        return relayDouble
          ? { kind: "flick", hand, finger: "index", finger2: "middle", style: "topPush" }
          : { kind: "flick", hand, finger: "index", style: "topPush" };
      }
      if (order === 2 && singleLayer && !double && !hint?.push
        && (grips[hand] === 'half' || grips[hand] === 'halfDown') && grips[other] === 'home') {
        return { kind: 'flick', hand: other, finger: 'index', style: 'reverseIndexHook' };
      }
      if (singleLayer && !double && grips[hand] === "home") {
        return { kind: "flick", hand, finger: "index", style: "indexHook" };
      }
      // The driving hand can use its home stroke independently of the support wrist.
      if (bothHome || (relayDouble && grips[hand] === "home")) {
        // U2 / U2' 双向连拨(2026-07-09 L 侧 hook_index/hook_middle2 镜像标定)。
        return double
          ? { kind: "flick", hand, finger: "index", finger2: "middle", style: "hook" } // U2/U2' 连拨
          : { kind: "flick", hand, finger: "index", style: "hook" };
      }
      if (relayDouble) return { kind: "flick", hand, finger: "index", finger2: "middle" };
      return { kind: "flick", hand, finger: "index" };
    }
    const hand = dir < 0 ? "L" : "R";
    const support = hand === 'R' ? 'L' : 'R';
    if (order === 2 && cls === 'low' && singleLayer && !double
      && (grips[hand] === 'halfDown' || grips[hand] === 'half') && grips[support] === 'home') {
      return { kind: 'flick', hand: support, finger: 'ring', style: 'reverseRingHook' };
    }
    if (cls === "low" && (bothHome || order === 2 && grips[hand] === 'home')) {
      // D2' / D2 双向连拨(2026-07-10 L 侧 hook_pinky/hook_ring2 镜像标定)。
      return double
        ? { kind: "flick", hand, finger: "pinky", finger2: "ring", style: "hook" } // 先小指后无名指
        : { kind: "flick", hand, finger: "ring", style: "hook" };
    }
    return { kind: "flick", hand, finger: "ring" }; // D / E 族(非标准握 / E)
  }
  // z 轴。F 族分手依据:拇指伸展 = 沿 F 面向上扫,F(dir>0)使左列上行 → 左拇指,
  // F' 使右列上行 → 右拇指(冻结层角实测过,反着配会出现「层往下、指往上」)。
  if (cls === "high") {
    const hand = dir > 0 ? "R" : "L";
    const other = hand === 'R' ? 'L' : 'R';
    if (order === 3 && singleLayer && !double && dir > 0 && hint?.nail && grips.R === 'home' && (grips.L === 'down' || grips.L === 'home')) {
      return { kind: 'flick', hand: 'R', finger: 'index', style: 'frontIndexNail' };
    }
    if (order === 3 && singleLayer && !double && dir < 0 && hint?.nail && grips.L === 'home' && (grips.R === 'down' || grips.R === 'home')) {
      return { kind: 'flick', hand: 'L', finger: 'thumb', style: 'frontThumbNail' };
    }
    if (order === 3 && singleLayer && !double && hint?.thumb && grips[other] === 'down')
      return { kind: 'flick', hand: other, finger: 'thumb', style: 'thumbLift' };
    if (singleLayer && !double && grips[other] === 'down'
      && (grips[hand] === 'home' || order === 3 && grips[hand] === 'up')) {
      return { kind: 'flick', hand: other, finger: 'thumb', style: 'thumbLift' };
    }
    if (grips[hand] === "down") {
      // 主动手下起手:右 U8 / 左 U6 下拨,半转由同手中指接力。
      return double
        ? { kind: "flick", hand, finger: "index", finger2: "middle", style: "downPush" }
        : { kind: "flick", hand, finger: "index", style: "downPush" };
    }
    if (grips[hand] === "home") return { kind: "flick", hand, finger: "index", style: "topPush" };
    if (order === 2 && grips[other] === 'home' && (grips[hand] === 'half' || grips[hand] === 'halfDown')) {
      return { kind: 'flick', hand: other, finger: 'thumb', style: 'pocketThumbLift' };
    }
    return { kind: "flick", hand: dir > 0 ? "L" : "R", finger: "thumb" }; // F 族
  }
  if (cls === "low" && (bothHome || order === 2 && grips[dir > 0 ? "R" : "L"] === "home")) {
    // 双中手 B'(dir>0)= 右食指背钩;B = 左食指镜像(FINGERTRICKS §4.2 推定)。
    // B2 / B2' 双向连拨(2026-07-10 backHook_middle2 标定):先食指后中指,
    // 首指 Q2 极早期沿 BACK_EXIT 退场(同 U2 的 HOOK_EXIT 编排)。
    const hand = dir > 0 ? "R" : "L";
    return double
      ? { kind: "flick", hand, finger: "index", finger2: "middle", style: "backHook" }
      : { kind: "flick", hand, finger: "index", style: "backHook" };
  }
  if (cls === "mid") {
    const hand = dir > 0 ? 'R' : 'L';
    const other = hand === 'R' ? 'L' : 'R';
    if (double) {
      if (order === 3 && hint?.quarters === 2 && hint.nail && singleLayer && grips[other] === 'home')
        return { kind: 'flick', hand: other, finger: 'index', style: 'sliceNailDouble' };
    } else if (singleLayer && grips[other] === 'home' && (hint?.nail || grips[hand] === 'up' || grips[hand] === 'down')) {
      return { kind: 'flick', hand: other, finger: 'index', style: 'sliceNail' };
    } else if (grips[hand] === 'home') return { kind: "flick", hand, finger: "index", style: "topPush" };
  }
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

function sameLayers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every(layer => b.includes(layer));
}

function isPocketLowerRelay(order: number, axis: Axis, cls: LayerClass, gesture: HandGesture, support: GripName | null) {
  return order === 2 && axis === 'y' && cls === 'low' && gesture.kind === 'flick'
    && gesture.finger2 === 'ring' && (support === 'halfDown' || support === 'half');
}

function isFourWide(order: number, layers: readonly number[]): boolean {
  return order === 4 && layers.length === 2 && (layers.includes(0) || layers.includes(3));
}

/** Resolve physical depths before selecting an existing hand stroke. A half
 * cube has the same cut plane as the pocket cube. Its two physical layers
 * must remain separate for contact, hint consumption and turn completion. */
export function gestureForLayers(axis: Axis, layers: number[], dir: 1 | -1,
  grips: HandGripNames, hint: TwistHint | undefined, order: number): HandGesture {
  const cls = classifyLayers(layers, order);
  if (hint?.homeStroke) return hint.homeStroke.gesture;
  if (order === 4 && cls === 'mid' && axis === 'x') {
    const hand = layers.length === 1 && layers[0] === 2 ? 'R' : 'L';
    const double = hint?.quarters === 2;
    return { kind: 'flick', hand, finger: 'ring', finger2: double ? 'pinky' : undefined,
      style: dir < 0 ? 'middleSliceNail' : 'middleSlicePad' };
  }
  if (order === 4 && cls === 'mid' && axis === 'y') {
    const upper = layers.includes(2);
    const hand = dir > 0 ? 'R' : 'L';
    return { kind: 'flick', hand, finger: upper ? 'index' : 'ring',
      finger2: hint?.quarters === 2 ? (upper ? 'middle' : 'pinky') : undefined,
      style: upper && hint?.quarters !== 2 && grips[hand] === 'home' ? 'indexHook' : 'hook' };
  }
  const half = isFourWide(order, layers);
  return classifyHandGesture(axis, cls, dir, grips, hint, (half && !hint?.push) || layers.length === 1, half ? 2 : order);
}

/** 遗留指弹的幅度限制；weld 腕转必须与层角一致，不能使用此压缩。 */
function softClampAngle(a: number): number {
  const LIMIT = 1.62; // ≈93°
  const abs = Math.abs(a);
  if (abs <= LIMIT) return a;
  return Math.sign(a) * (LIMIT + (abs - LIMIT) * 0.28);
}

// Extra left middle MCP flexion at the narrower four-layer cut. The corner
// passes the pad twice as it takes over from the withdrawing index.
const FOUR_U_RELAY_MIDDLE = [
  [0, 0, 0, 0], [90, 0, 0, 0], [92, .010, 0, 0], [93, .021, 0, 0],
  [98, .016, 0, 0], [105, .009, 0, 0], [114, .004, 0, 0], [120, 0, 0, 0],
  [129, .006, 0, 0], [138, .01, 0, 0], [146, .016, 0, 0], [154, .019, 0, 0],
  [158, .016, 0, 0], [165, 0, 0, 0], [175, -.003, 0, 0], [180, 0, 0, 0],
] as const;

const HALF_PI = Math.PI / 2;

/** 换握目标 */
export type GripName = "home" | "up" | "down" | "half" | "halfDown";

/**
 * 换握基座四元数:up=上手(拇指起手在 U 面,恰等于 home 被 R/L' 提交后的腕姿),
 * down=下手(D 面)。两手同为绕 x 轴 ±90°(绕 x 的旋转在 x=0 镜像下不变,左右共用)。
 */
export function gripQuat(name: GripName): THREE.Quaternion {
  const q = new THREE.Quaternion();
  if (name === "up") q.setFromAxisAngle(AXIS_VEC.x, HALF_PI);
  else if (name === "down") q.setFromAxisAngle(AXIS_VEC.x, -HALF_PI);
  // ↑↑ uses the settled home + R2 / L′2 orientation (both rotate about -x).
  else if (name === "half") q.setFromAxisAngle(AXIS_VEC.x, Math.PI);
  else if (name === "halfDown") q.setFromAxisAngle(AXIS_VEC.x, -Math.PI);
  return q;
}

export function settledGripName(q: THREE.Quaternion, wristAngle: number): GripName | null {
  if (q.angleTo(GRIP_Q_HOME) < .01) return 'home';
  if (q.angleTo(GRIP_Q_UP) < .01) return 'up';
  if (q.angleTo(GRIP_Q_DOWN) < .01) return 'down';
  if (q.angleTo(GRIP_Q_HALF) < .01) return wristAngle < 0 ? 'halfDown' : 'half';
  return null;
}

// A quaternion loses the signed wrist winding at 180°. Keep the angle as well.
function wrapWristAngle(angle: number): number {
  const a = angle % (2 * Math.PI);
  return Math.abs(a) < 1e-8 || Math.abs(Math.abs(a) - 2 * Math.PI) < 1e-8 ? 0 : a;
}
function wristAngleOf(q: THREE.Quaternion): number {
  return wrapWristAngle(2 * Math.atan2(-q.x, q.w));
}
// Unit-height clearance arc biased toward the start of withdrawal. Both
// endpoints have zero lift, so committing a turn preserves its contact pose.
function releaseLift(remaining: number, power: number): number {
  const peak = power / (power + 1);
  return (1 - remaining) / (1 - peak) * (remaining / peak) ** power;
}
function atHalfTurn(angle: number): boolean { return Math.abs(Math.abs(wrapWristAngle(angle)) - Math.PI) < 1e-6; }
function gripWristAngle(name: GripName): number { return wristAngleOf(gripQuat(name)); }
/** Preserve quarter-turn grips; let the elbow participate in the second quarter.
 * Use the displayed hand rotation for this weight, not signed winding: switching
 * ↑↑ ↔ ↓↓ keeps the palm at 180° while the forearm changes its inward/outward aim. */
function halfGripWeight(angle: number): number {
  const t = Math.max(0, Math.min(1, (angle - HALF_PI) / HALF_PI));
  return t * t * (3 - 2 * t);
}

export type GripSimStep =
  | { grip: GripName; side?: HandSide } // side 缺省 = 双手(FINGERTRICKS §2:紧贴=R / 空格=L)
  | { axis: Axis; layers: number[]; quarters: number };

/**
 * 静态推演一串(转动 / 换握记号)后的两手握姿基座 — 跳步 / 拖进度条用,
 * 结果与逐步 live 播放的 weld 烘入一致(flick 不改握,weld 按层转烘入)。
 */
export function simulateGrips(steps: GripSimStep[], order: number, initial?: { R: THREE.Quaternion; L: THREE.Quaternion; wristAngles: Record<HandSide, number> }) {
  const wristAngles = initial ? { ...initial.wristAngles } : { R: 0, L: 0 };
  const grips = { R: initial?.R.clone() ?? new THREE.Quaternion(), L: initial?.L.clone() ?? new THREE.Quaternion() };
  const q = new THREE.Quaternion();
  for (const s of steps) {
    if ("grip" in s) {
      for (const side of s.side ? [s.side] : (["R", "L"] as const)) {
        grips[side].copy(gripQuat(s.grip));
        wristAngles[side] = gripWristAngle(s.grip);
      }
      continue;
    }
    if (s.quarters === 0 || s.layers.length === 0) continue;
    const cls = classifyLayers(s.layers, order);
    if (cls === "whole") continue; // 整体转体不烘(live 同款:双手随层后依次回到原握姿)
    if (s.axis !== "x") continue; // 只有 x 轴单层 weld 烘入(y/z 无 weld 手势)
    const g = gestureForLayers(s.axis, s.layers, s.quarters > 0 ? 1 : -1, { R: null, L: null }, undefined, order);
    if (g.kind !== "weld") continue;
    q.setFromAxisAngle(AXIS_VEC[s.axis], s.quarters * HALF_PI);
    for (const h of g.hands) {
      grips[h].premultiply(q);
      wristAngles[h] = wrapWristAngle(wristAngles[h] + s.quarters * HALF_PI);
    }
  }
  return { ...grips, wristAngles };
}

// Engineering envelopes around active motion, including inter-person variation
// (Ibrahim et al., doi:10.1055/s-0044-1788593). Lower stops retain the rig's
// pad-contact calibration. Thumb limits are separate model tuning values.
// Rig guard bands around measured active wrist deviations (PMID 24322647).

const FINGER_HINGES = { middleMin: .03, middleMax: 130 * Math.PI / 180, distalMax: 100 * Math.PI / 180 };
const THUMB_HINGES = { middleMin: -.5, middleMax: 95 * Math.PI / 180, distalMax: 100 * Math.PI / 180 };
const FADE_MS = 240;
// Reach the sticker once, then lift the pad slightly between the two taps.
const REFERENCE_THUMB_TAP = [[0, 0], [170, 1], [190, 1], [280, .84], [370, 1], [390, 1], [550, 0]] as const;
const RECOVER_MS = 300;
const IDLE_KEEPALIVE_MS = 6000;
/** 手势判向的最小角度 — angle 起步为 0,超过此值才提交方向。 */
const COMMIT_ANGLE = 0.02;

/**
 * 「食指越顶」(style:"topPush",主动手 home 握的 F 族)动作参数:手根不动,
 * 食指先沿 B 面竖直抬升(splay,越过 U 面 + 间隙),再大幅前卷 MCP(c1)+
 * 拉直中末节,指链从魔方上方横越 U 面,指尖落到 UFR/UFL 角块 U 面贴纸上方。
 * 用户规格:F 转动开始**之前**指尖就要到位 —— 伸指(reach)是时间驱动的前置
 * 动画(REACH_MS,prepareTwist 启动,播放循环闸步等 isReachPreparing),
 * 转动期间只有下压(press)随层角;拖拽/键盘没有前置窗口,beginGesture 补
 * 触发与层角并发。抬升先行、前卷后动(liftIn < sweepStart 语义):指尖起点
 * 就骑在 B 面上棱沿,先卷会立刻犁进 U 面。回程(reachTarget=0)同一参数化
 * 倒放,先收卷再落指,路径对称安全。数值浏览器内标定 + 穿模 oracle 验证。
 */
const TOP_PUSH = {
  liftIn: 0.12,   // 先抬离后上棱,再前卷
  sweepStart: 0.2,
  c1: 0.66,       // MCP 前卷幅度(rad;过大越过贴纸冲到角外缘,坐标下降定档)
  c2: 0.18,       // 中节加弯(用户规格:按压时弯曲要明显,别伸直戳)
  c3: 0.15,       // 末节加弯
  lift: 0.54,     // 抬升量(splay rad;弯曲平面前斜,前卷伴随下沉,~207U/rad 补偿)
  backOff: 0.16,  // reach 早段微伸(c1 −,sin 包络):抬升弧面稍向内斜,不退
                  // 一点指腹会蹭进 B 面上沿(oracle 实测 2.65U)
  // —— 转动物理跟随(用户硬规格:F 转动时**只有食指动**,手根/其余手指/
  // 另一只手一律静止;且四分转**全程**指尖贴住初始 UFR 角块)—— 接触点绕
  // z 走弧,弧长全部由食指四关节的 TOP_PUSH_FOLLOW 曲线补(见下),指尖钉在
  // 角块贴纸上、贴纸在指腹下滑转;不动腕 weld、不做 dodge(driveGesture 里
  // topPush 整段跳过外让 —— 静止手安全性靠 home 姿指腹接触半径 ≥136U >
  // 角柱扫掠 135.8U)。按压不是独立通道:knot0 就是按压姿(reach 一到位指腹
  // 即贴到贴纸 ~1.2U,转动开始之前已接触 —— 推动 = 先接触后运动)。转过
  // releaseAt(=90°,四分转终点)后才弹离(follow 渐出 + 额外抬升退出角柱
  // 扫掠区),只有 F2 的第二个 90° 走释放滑行。release 用未钳制层角(F2 的
  // UFL 角 ~2.27rad 扫到指位,必须按原角先弹离)。
  releaseAt: HALF_PI, // 释放起点(rad,原角):四分转全程接触
  releaseLen: 0.28, // 释放行程(~1.85rad 完全弹离;0.5 时倒退太慢,F2 第二象限
                    // 来料棱块在 θ≈1.85 追上手指,oracle 实测 pen +4.8 → 收紧)
  releaseLift: 0.45, // 释放先抬离中指,再沿固定手掌路径收回
  releaseLiftEnd: 0.2, // 释放段前 20% 完成抬指,避开静止/续转的前层
  transitLift: 0.15, // 准备/收指中段抬升,首尾为零,不改变贴纸接触姿态
  // Large home F strokes retire from their last nail pose on a free path.
  // Short, cancelled drags return along their partial approach; upper U keeps
  // its calibrated virtual release window around the stationary U5 thumb.
  retreatSplit: 1.2,
};
/** 固定手掌的食指路径：仅食指的屈曲、轴向旋转和掌骨关节参与。
 *  左右 MANO 资产与 home 姿严格镜像，因此共用作者空间曲线。
 *  旧曲线借整手腕转补可达范围，会带动未参与手指；已由 2026-11-16 规格替代。
 *  起拨 U8 / U6，全程留在同一实体贴纸，准备和释放另由 TOP_PUSH 编排。 */
const TOP_PUSH_FOLLOW = { R: UPPER_U_INDEX_FOLLOW, L: UPPER_U_INDEX_FOLLOW };
function carriedThumbWeight(winding: number, layerAngle: number): number {
  const sweep = Math.abs(Math.sin(2 * layerAngle));
  return Math.sign(winding) * THREE.MathUtils.smoothstep(sweep, 0, .55);
}

/** Uniform angular knots from the start to the end of the quarter turn. */
function followAt(arr: number[], phi: number): number {
  const t = Math.min(1, phi / HALF_PI) * (arr.length - 1);
  const i = Math.min(arr.length - 2, Math.floor(t));
  const u = t - i, start = arr[i], end = arr[i + 1];
  // A cubic B-spline joins neighbouring fitted slopes continuously. Linear
  // extrapolation beyond the end knots keeps both calibrated endpoints exact.
  const left = i > 0 ? arr[i - 1] - 2 * start + end : 0;
  const right = i + 2 < arr.length ? start - 2 * end + arr[i + 2] : 0;
  return start + (end - start) * u + ((1 - u) ** 3 * left + u ** 3 * right) / 6;
}
const REACH_MS = 200;
const FRONT_INDEX_LIFT_MS = 58;

function advanceFrontIndexReach(progress: number, elapsed: number): number {
  // The calibrated lift occupies only the first 12% of this path. Give it
  // time to clear the back edge before the normal-speed approach begins.
  const liftEnd = TOP_PUSH.liftIn;
  const time = progress <= liftEnd ? progress * FRONT_INDEX_LIFT_MS / liftEnd
    : FRONT_INDEX_LIFT_MS + (progress - liftEnd) * REACH_MS;
  const next = time + elapsed;
  return next <= FRONT_INDEX_LIFT_MS ? next * liftEnd / FRONT_INDEX_LIFT_MS
    : liftEnd + (next - FRONT_INDEX_LIFT_MS) / REACH_MS;
}
// Spread the extra approach time over the lift and the start of the sweep.
// Integrating a linearly decreasing delay gives the same speed on both
// sides of the join. Invert that clock for forward and cancelled reaches.
function advanceFrontApproach(progress: number, elapsed: number): number {
  const join = .38, extraMs = 90;
  const duration = FRONT_INDEX_LIFT_MS + (1 - TOP_PUSH.liftIn) * REACH_MS;
  const sweepMs = duration - extraMs;
  const remaining = Math.max(0, 1 - progress / join);
  const time = progress * sweepMs + extraMs * (1 - remaining * remaining) + elapsed;
  if (time <= 0) return 0;
  if (time >= join * sweepMs + extraMs) return (time - extraMs) / sweepMs;
  const slope = sweepMs + 2 * extraMs / join;
  return 2 * time / (slope + Math.sqrt(slope * slope - 4 * extraMs * time / (join * join)));
}
/** topPush 释放进度(0=按压跟随,1=完全弹离);t = |未钳制层角|。 */
function topPushRelease(t: number): number {
  const x = Math.min(1, Math.max(0, (t - TOP_PUSH.releaseAt) / TOP_PUSH.releaseLen));
  return x * x * (3 - 2 * x);
}

function topPushReleaseLift(t: number, liftEnd = TOP_PUSH.releaseLiftEnd, liftStart = 0): number {
  const x = Math.min(1, Math.max(0, (t - TOP_PUSH.releaseAt - TOP_PUSH.releaseLen * liftStart)
    / (TOP_PUSH.releaseLen * (liftEnd - liftStart))));
  return x * x * (3 - 2 * x);
}
/**
 * topPush 弧位置(rad):release 段沿标定弧**倒退**(手指原路退回起始按压位,
 * 比层角快 ~3 倍)—— 禁把 follow 幅度直接 ×(1−rel) 淡出:关节角朝 hover 姿
 * 插值走的是弦线,切进魔方内部(F2 实测 pen +30)。倒退路径上手指与来料
 * 角块在同槽位相遇时,姿态恰是该槽位的标定接触姿(间隙 ≥0.4),天然安全。
 */
function topPushArcPhi(rawAbs: number): number {
  return Math.min(HALF_PI, rawAbs) * (1 - topPushRelease(rawAbs));
}

/** 贴面勾拨基础曲线(y 族勾弯 + 双中手接触样式 hook/backHook 共用)。
 *  数值 = 旧 y 勾弯内联常量抽出(视觉不变);接触带由浏览器 oracle 标定微调。 */
const HOOK = {
  c1: -0.34, // 基节伸展:指尖抬离层面(位置上退不扎层)
  c2: 0.52,  // 中节勾弯(可见的向掌心勾)
  c3: 0.42,
  drift: 0.22, // splay 横拉系数(×扫角)
  open: 1.3,   // 弯曲饱和角
};

/** 连拨次指 Q1 就位姿(FINGERTRICKS §4.1:首指扫前 90° 期间次指渐入就位,
 *  90° 处接力)。键 = 次指名,两手各一套(2026-07-09 U2' 镜像标定:共享值
 *  ×sideSign 的镜像对 L 差 ~1.4U —— 资产不对称,Q1 末 θ≈1.30 角部扫掠窗
 *  蹭中 L3 中节;splay 语义仍 ×sideSign,L 值按 L 手密扫单解)。
 *  数值浏览器标定(rig.tuning 现场调)。 */
const HOOK_PREP: Record<HandSide, Partial<Record<string, { c1: number; c2: number; c3: number; splay: number }>>> = {
  R: {
    // 2026-07-25 MANO 重解:接力位判据 = 交接点(90°)中指指腹落在**食指 home
    // 接触点**(Q1 全程 pen ≤ −0.44,交接误差 6.5U、间隙 2.62U)。
    hook_middle: { c1: -0.259, c2: 0.316, c3: 0.0913, splay: 0.48 }, // U2 次指:中指沿 B 面上探 U 层带,90° 交接处进带
    hook_ring: { c1: -0.12, c2: 0.06, c3: 0.04, splay: -0.08 },     // D2' 次指:无名指微让位再接力
    // B2' 次指:中指沿 B 面上探顶带(BUR 区,与 hook_middle 同类攀爬),
    // 90° 交接处接住 Q2 来料。数值浏览器标定(种子 = hook_middle)。
    backHook_middle: { c1: -0.265, c2: 0.309, c3: 0.1043, splay: 0.486 }, // 2026-07-25 MANO(交接误差 7.0U、间隙 3.55U)
  },
  L: {
    // U2' 次指:R 值镜像起点上 0.02rad 密网格(Q1 每 0.02 + Q2 每 1.5° 全顶点
    // + 贴角保持)重解 —— 共享值在 L 差 c3/splay 各 ~0.02rad,Q1 末角部窗
    // +1.36U → 全程 ≤ −0.02U。
    hook_middle: { c1: -0.266, c2: 0.297, c3: 0.1773, splay: 0.464 }, // 2026-07-25 MANO(交接误差 10.7U、间隙 3.41U)
    hook_ring: { c1: -0.12, c2: 0.06, c3: 0.04, splay: -0.08 },
    backHook_middle: { c1: -0.29, c2: 0.321, c3: 0.2013, splay: 0.476 }, // 2026-07-25 MANO(交接误差 10.9U、间隙 5.3U)
  },
};

/** 样式化指法跟随曲线(FINGERTRICKS §4.0「贴面」):每通道二次型
 *  v(s) = lin·s + quad·s²,s = 本指扫角/90°。键 = `${style}_${finger}` + 连拨
 *  次指后缀 "2"(U=hook_index / D'=hook_ring / D2'=hook_pinky+hook_ring2 /
 *  U2 次指=hook_middle2 / B'=backHook_index / 右下手 F=downPush_index+
 *  downPush_middle2)。两手各一套(镜像资产不对称,同
 *  topPush 先例);数值浏览器 oracle 坐标下降标定(判据:指腹对活动层 gap
 *  贴带 [0.6,2.6] + 全局 pen ≤0),改 home 姿必须重标。缺键回退各样式默认
 *  常量。splay 为本手局部值(不再 ×sideSign,两手各解各的)。三次项给「中段
 *  追面、末端归位」的弓形留自由度(二次型贴到 83° 后末端回不了家,实测)。 */
type HookFit = { c1: [number, number, number]; c2: [number, number, number]; c3: [number, number, number]; splay: [number, number, number] };
/** 2026-07-08 浏览器坐标下降解,密采样版(θ 步长 0.08/0.09 全程 + 400·pen² +
 *  接触带 hinge [0.6,2.6] + endHome 正则;粗采样曾漏掉 slab 角部窄窗口 ——
 *  方形层 45° 时角伸出 √2 半宽,扫过指节只在 ~0.1rad 窗口现形,重解后全清,
 *  唯余起始 θ≈0.05 的 −0.42U 结构残差:cubic 在 s=0 无力,home 指腹本就停在
 *  角部扫掠带内,真实播放该角度仅 1 帧)。downPush_* 与 hook_index/hook_middle2
 *  同值不是巧合:下手握 = home 绕 x 刚体转 −90°,F 层相对手的几何与 U 层完全
 *  同构(零跟随基线逐位相同,oracle 实证),关节空间解可整套移植。 */
const HOOK_FOLLOW: Record<HandSide, Record<string, HookFit>> = {
  R: {
    // hook_index 全曲线重解(2026-07-09 r3,U/U2-Q1「贴面扫到角 M」):12 参数
    // 节点参数化(每通道 v(1/3)/v(2/3)/v(1),中段塑形与端点解耦)坐标下降,
    // cost = 全顶点穿透罚 400·pen²(θ 每 1.5° + 末端着陆窗 0.5° + 提交点本尊,
    // 漏采样提交点会被 solver 牺牲,踩过)+ 贴面带 hinge + M-touch 端点。
    // 端点禁硬钉 3D 点:r1 的 (109,66,66) 钉点姿本身肉侵入 12.6U(distal 下缘
    // 肉卷进角块内),物理不可行 —— 改「pad 肉垫贴 RUF 角块 M 贴纸」接触目标
    // (x−96 ∈ [0.2,1.4] 于贴纸足迹 y,z∈[36,92])+ tip 骨 y/z 松钉贴纸中带。
    // 解:全程 pen ≤ 0(冻结 1.5° 细扫),提交姿 pad 贴 M 间隙 1.31U,
    // tip (116.5,63.3,67.5)。中段路径 = 骑着转动层凸轮面走 R 面外侧走廊。
    // 2026-07-25 MANO 重解(r28,§5 fit 分家):generic 标定在 MANO 上中段深插
    // 8.7U(手大 18% + r19~r27 手根重解);同法 12 参重解后 1.5° 细扫全程 pen ≤
    // −0.3,提交 pad 贴 M 间隙 1.86U,tip (102.5,68.9,49.8)。
    hook_index: { c1: [-0.0912, -0.8325, 1.3735], c2: [-0.6412, 4.455, -3.6084], c3: [2.7574, -6.8926, 4.1401], splay: [-0.8352, 0.9532, -0.4458] },
    // 2026-07-25 MANO 重解(r28,D 族无名指贴面 —— D 层无 M-touch 端点,判据 =
    // 全程 pen ≤0 + 接触点跟随 + 落地窗):generic 值在 MANO 上 D 转程 2.1U;
    // 重解后全程 pen ≤ −0.12,落地 gap 2.79U,tip (106.5, −90.4, 4.6)。
    hook_ring: { c1: [-2.1265, 7.843, -5.3155], c2: [4.8607, -11.4791, 6.7293], c3: [-0.4212, 4.3163, -4.7489], splay: [0.775, -2.1113, 1.3206] },
    // hook_middle2 全曲线重解(2026-07-09 r3,U2 规格「第二个 U 做完 R3 紧贴
    // 角 M」):方法同 hook_index(全顶点罚 + M-touch 端点;r2 的「骨端扩壳箱
    // 余量 10U」低估肉厚,全顶点复测 Q2 末穿 23.6U / 提交姿穿 18.8U)。解:
    // Q2 全程 pen ≤ +0.06U 瞬态,提交姿 pad 贴 M 间隙 1.38U,tip (118.4,61.7,79.7)。
    // 2026-07-25 MANO 重解(r28):generic 值在 MANO 上不穿模但**姿态失控** ——
    // 180° 提交姿指尖甩到 x=242(离方块 2.5 个身位,pad 离层 109.8U),观感上
    // 根本没在拨。重解后提交 tip (116, 61.7, 28.7)、pad 离层 13.3U、Q2 全程
    // pen ≤ +0.03 瞬态。**贴块端点(M-touch)在 MANO 上够不到**:两手各独立解
    // 都停在 13~15U 外(同 U'p climb 的可达域墙,手大 18%);现按「不穿模 +
    // 姿态贴近层面 + 最小离面」收敛,贴块欠账记 §6。
    hook_middle2: { c1: [0.3929, 1.5998, -1.0915], c2: [1.5761, -5.2652, 3.1394], c3: [-2.0157, 4.673, -2.7895], splay: [-2.2498, 5.6879, -3.2778] },
    hook_pinky: { c1: [0.2484, -0.21, 0.0182], c2: [0.7997, -0.5291, -0.0955], c3: [-0.2046, 0.2746, -0.155], splay: [-0.1375, 0.008, 0.1] },
    hook_ring2: { c1: [0.041, -0.382, 0.5732], c2: [1.7475, -1.4909, 0.3643], c3: [0.8482, -0.6875, -0.4179], splay: [-0.34, 0.37, 0.1144] },
    // 2026-07-25 MANO 重解(r28):generic 值在 MANO 上 B' 全程 11.4U;重解加
    // 「接触点跟随」项(pad 接触点 = home 接触点绕层轴转 θ —— 只罚穿模的话
    // 「手指不动」也满足贴面,层从指下滑过 = 没在拨)。冻结细扫全程 pen ≤ −0.02,
    // 提交 pad gap 3.28U,tip (98.1,−65.8,−99.5)。
    backHook_index: { c1: [0.45, -2.3475, 1.8915], c2: [-0.725, 2.88, -2.1643], c3: [1.1092, 0.2008, -0.7447], splay: [0.5413, 1.3163, -1.2689] },
    // B2' 次指 Q2 跟随(2026-07-10 连拨标定):prep 攀到 B 面顶带后,沿右侧
    // 弧下潜接住来料(与 backHook_index 的 Q1 弧同族)。节点参数化 12 参
    // 坐标下降(全顶点罚每 0.026rad + 贴面带 + 落地窗 ≥1.1U 软目标):Q2
    // 全程 pen ≤ −0.17(走廊窄段 0.17~0.26U 余量),提交 pad gap 0.83U,
    // tip (109.5, 26.9, −119.6)。
    // 2026-07-25 MANO 重解(r28,同族方法 + 接触点跟随项):generic 值在 MANO 上
    // B2' Q2 中指 10.7U;重解后 Q2 全程 pen ≤ −0.13(唯 θ≈2.02 一帧 +0.07 瞬态),
    // 落地 gap 3.75U,tip (99, −81.6, −101.5)。
    backHook_middle2: { c1: [-0.9042, 2.0988, -1.1507], c2: [0.5917, -1.1164, 0.6754], c3: [0.6924, 0.4707, -1.1227], splay: [-2.0661, 7.5483, -4.7335] },
    // 2026-07-25 MANO 重解(r28,§4.3 左中右下 F):generic 值在 MANO 上 Q1 中段
    // 把食指压进 F 层 6.7U(真实播放 r3 基准里唯一剩下的坏帧族,37 帧);
    // 重解后全程 pen ≤ +0.08 瞬态,落地 gap 2.38U,tip (102.5, −42.9, 45.6)。
    // 注:generic 时代「downPush_* 与 hook_* 同值」(下手握 = home 绕 x 转 −90°
    // 的同构)在 MANO 上不再成立 —— 融合前臂/腕缝让 down 握不是纯刚体转。
    downPush_index: { c1: [0.22, -1.755, 1.965], c2: [-0.44, 3.915, -3.195], c3: [1.7261, -2.3251, 0.3146], splay: [0.2773, -2.3768, 1.8795] },
    // 2026-07-25 MANO 重解(r28,F2 连拨次指):Q2 全程 pen ≤ +0.03 瞬态,
    // 落地 gap 2.85U,tip (104.7, −30.3, 45)。
    downPush_middle2: { c1: [-0.78, 6.2775, -4.4715], c2: [3.554, -10.6715, 6.4863], c3: [-1.2216, 0.7531, 0.3106], splay: [-2.066, 4.9225, -2.6075] },
  },
  L: {
    // hook_index 全曲线重解(2026-07-09 U2' 镜像标定,方法同 R 侧 r3:节点
    // 参数化 12 参 + 每 1.5° 全顶点罚 + M-touch 镜像端点 —— U'/U2'-Q1 做完
    // L2 贴 UFL 角块 L 面贴纸,x+96 ∈ [0.2,1.4] 于 y,z∈[36,92];起点 = R 侧
    // r3 fit 镜像)。解:冻结细扫全程 pen ≤ 0,提交姿 pad 贴镜像角 M 间隙
    // 1.56U,tip (−118.8, 69.9, 55.6)。顺带解决 §6「U' 终点贴块未标定」。
    // 2026-07-25 MANO 重解(r28,同 R 侧方法与判据):generic 值在 MANO 上 12.7U;
    // 重解后 1.5° 细扫全程 pen ≤ −0.3,提交 pad 贴镜像角 2.61U,tip (−102,68,42.1)。
    hook_index: { c1: [-0.0337, -0.9, 1.3285], c2: [-1.5762, 6.6825, -4.8459], c3: [3.7249, -8.2426, 3.9376], splay: [1.4952, -3.0457, 1.8633] },
    // 2026-07-25 MANO 重解(r28,R 侧 hook_ring 的镜像判据):generic 值在 MANO 上
    // D' 转程 1.5U;重解后全程 pen ≤ −0.14,落地 gap 2.96U,tip (−106.6, −92.8, −8.4)。
    hook_ring: { c1: [-3.5515, 12.8316, -9.0006], c2: [5.5307, -15.2744, 9.9768], c3: [1.7295, -1.6268, -0.4497], splay: [1.3275, -2.2553, 0.9356] },
    // hook_middle2 镜像标定(2026-07-09,U2' 次指 L3 的 Q2 走廊,方法同 R 侧
    // r3:节点参数化 12 参重解 + 每 1.5° 全顶点罚 + M-touch 镜像端点 —— U2'
    // 终点 = 角 M 的 x 镜像贴纸,即 UFL 角块 L 面贴纸,x+96 ∈ [0.2,1.4] 于
    // y,z∈[36,92];起点 = R 值 c 通道同 / splay 反号)。解:Q2 全程 pen ≤
    // +0.02U 瞬态,提交姿 pad 贴镜像角 M 间隙 1.16U,tip (−118.6, 61.8, 82.2)
    // (端点带下限提到 1.1U 重精修 —— 首解 0.52U 太贴,回撤攻窗 kFit=1 保持
    // 提交姿 + 凸包渐升会瞬时压进贴纸,同 R 侧 1.38U 余量的经验)。
    // 2026-07-25 MANO 重解(r28,同 R 侧:generic 值提交姿指尖甩到 x=−241.9、
    // pad 离层 109.9U)。重解后提交 tip (−117.4, 60.6, 28.3)、pad 离层 14.5U、
    // Q2 全程 pen ≤ +0.06 瞬态;M-touch 贴块端点同样够不到(§6)。
    hook_middle2: { c1: [1.2166, -0.1327, -0.2028], c2: [-0.2202, -2.5877, 2.3631], c3: [3.1205, -4.9907, 1.5755], splay: [0.7223, -2.4254, 1.5678] },
    // D2 连拨镜像标定(2026-07-10,方法同 U2' L 侧:起点 = R 值 c 通道同 /
    // splay 反号,节点参数化 12 参 + 每 1.5° 全顶点罚 + 锚种子正则重解;贴面
    // 契约 —— D 族无 M-touch 端点,gap 走廊照抄 R 侧轮廓)。资产不对称只出
    // ~0.2U 量级(≪ U2' 的 1.4U):hook_pinky 仅端点节点 v(1) 抬 +0.02rad
    // (清 Q2 冻结保持段 +0.16U → 全程 ≤ −0.51U,首指做完停位必须在后续角柱
    // 扫掠环带外 —— D2' 首指无 HOOK_EXIT 同款退场,靠端姿本身出带,镜像同);
    // hook_ring2 仅 c2 前段节点 v(1/3) −0.06rad(清 Q2 走廊 +0.07U 瞬态)。
    // 解:Q1 pinky pen ≤ −0.76 / Q2 ring pen 全负、贴面收尾 gap 0.42U。
    hook_pinky: { c1: [0.2684, -0.3, 0.1082], c2: [0.7997, -0.5291, -0.0955], c3: [-0.2046, 0.2746, -0.155], splay: [0.1375, -0.008, -0.1] },
    hook_ring2: { c1: [0.041, -0.382, 0.5732], c2: [1.2075, -0.1409, -0.4457], c3: [0.8482, -0.6875, -0.4179], splay: [0.34, -0.37, -0.1144] },
    // backHook_index 端节点微调(2026-07-10 B2 连拨标定):L 侧 Q1 末端姿顶点
    // 在 90° 边界恰贴来料角柱(1.5° 后 +0.85U,BACK_EXIT ramp 物理来不及)——
    // 同 D2 pinky 方案,端节点 v(1) 微调 [−0.06, +0.06, −0.188, +0.2] 把停位
    // 挪出早窗(v(1/3)/v(2/3) 不动,Q1 走廊不变),90° pad gap 1.81U、
    // tip90 (−106.1, 76.5, −110)。单拨 B 提交姿同此(共享 fit)。
    // 2026-07-25 MANO 重解(r28,同 R 侧方法):generic 值在 MANO 上 B 全程 7.1U;
    // 重解后冻结细扫全程 pen ≤ −0.11,提交 pad gap 4.84U,tip (−99.9,−33.5,−100.8)。
    backHook_index: { c1: [-0.15, 0.6525, -0.6975], c2: [0.605, -1.7143, 1.4204], c3: [-2.661, 6.7334, -3.6959], splay: [-0.4608, -0.0231, -0.063] },
    // B2 次指 Q2 跟随(2026-07-10 连拨标定,B2' 的 x 镜像;方法同 R 侧)。解:
    // Q2 全程 pen ≤ +0.05U 冻结瞬态(走廊 θ≈2.14-2.22 蹭零),提交 pad gap
    // 1.02U,tip (−99.2, 66.5, −117.8)。
    // 2026-07-25 MANO 重解(r28,同族方法 + 接触点跟随项):generic 值在 MANO 上
    // B2 Q2 中指 12.7U;重解后 Q2 全程 pen ≤ −0.18,落地 gap 1.64U,
    // tip (−103, −103.4, −90.3)。
    backHook_middle2: { c1: [0.4854, -2.0039, 1.6884], c2: [-0.2201, 3.1684, -2.9673], c3: [2.4979, -7.083, 4.6885], splay: [-0.2279, -1.746, 1.1201] },
  },
};
const fitAt = (f: HookFit, ch: keyof HookFit, s: number): number => ((f[ch][2] * s + f[ch][1]) * s + f[ch][0]) * s;

/** D2' 首指小指前置伸指(prepareTwist 时间驱动 reach):小指 home 收拢悬空,
 *  先伸至 D 层 BDR 接触位再起转(连拨第一击也要贴面)。数值浏览器标定。 */
const PINKY_REACH = { c1: -0.26, c2: 0.19, c3: 0, splay: 0.02 };

/** FTN 贴块钉指就位姿(§7 `@pin`,首例 `R[R2:@C]`):weld 前 R2 指尖前置到
 *  C 贴纸(UFR 的 U 面,x,z∈[32,96] 于 y=96),weld 段随手刚体转(钉的块就在
 *  转动层,零相对运动),提交后收指(时间驱动同 reachT)。就位姿浏览器标定,
 *  判据:全顶点 pen≤0 + pad 贴 C 贴纸间隙 §4.0 贴块带;表里没值的 (hand,
 *  finger) = 未编排,prepareTwist 直接忽略 pin。 */
const WELD_PIN: Record<HandSide, Partial<Record<FingerName, { c1: number; c2: number; c3: number; splay: number }>>> = {
  // 2026-07-10 标定(Node 蒙皮探针 SOLVE=PIN,home = 四指水平下沉版):基元
  // = 继续卷拢折过 U-B 顶棱 + splay 上倾(「松开伸直」方向反,C 在前上方,
  // 旧占位 c1 −0.62 就是这么飘的)。就位:pad gap 1.48@C(84.4,43.4)、全顶点
  // pen −0.27、全手肉 x≥32(weld 绕 x 转,x 不变 ⇒ 就位安全即全程安全)。
  R: { index: { c1: 0.59, c2: 0.3625, c3: 0.195, splay: -0.2532 } },
  L: {},
};
/** 钉指转移凸包(sin(π·t) 包络):就位/收指途中抬离,直插会蹭 U 后棱(同
 *  UP_PUSH.transit 的坑)。2026-07-10 与就位姿联合解:路径逐 t 细扫 pen ≤−0.84。 */
const WELD_PIN_TRANSIT = { c1: -0.1125, c2: -0.1781, c3: 0, splay: -0.145 };
/** @pin 期间中指同步收避:home(四指水平)中指尖 x=27.6 已入 M 列 x 域且
 *  yz 半径 121.9 < 角柱 135.8 —— R weld 整手刚体转会扫穿静止 M 列。pin 就位
 *  同步退卷让出(收避后全手肉 x≥32,绕 x 的 weld 天然安全);随 pinReachT
 *  同节奏进退。 */
const WELD_PIN_MID_TUCK = -0.2;

/** B 族接触背钩的静止指避让:home 指列(中指/无名指)贴着 B 面 2.7U 停靠,而
 *  backHook 转的就是 B 层 —— 层角 45° 附近方形角部伸出至 √2 半宽(比面多 ~40U),
 *  会扫中静止指腹(oracle 密采样 2026-07-08 现形,粗采样一直漏)。弹指手无 dodge
 *  (styled 弃 dodge 保接触),给静止的中/无名指走这条快升姿态通道抬离扫掠区。 */
const BACK_EVADE: Record<HandSide, { c1: number; c2: number; c3: number; splay: number }> = {
  R: { c1: -0.028, c2: 0, c3: 0, splay: 0 }, // 微伸即可(0.03rad×指长≈2U);reg 压最小干预
  L: { c1: -0.0246, c2: 0, c3: 0, splay: 0 },
};

/** U 族(y.high)静止手食指单指避让(2026-07-09 用户规格「手作为整体在任何
 *  时候不要远离魔方,单个手指可以」,替代旧 DODGE_MAG.y.high=16 整手平移):
 *  home 静止手食指尖贴 B 面上部(L 手 BUL / R 手 BUR),正处 U 层扫掠带,
 *  U/U'/U2/U'p 期间沿 B 面外法线(−z)微伸离面一小段,层角回落后归位。
 *  时序同 dodge:目标 = min(1,|层角|/0.09) 即时跟升,drop 后 RECOVER_MS
 *  回落(HandState.indexEvade,tick 推进)。数值浏览器截图标定,判据:
 *  U 层角块扫掠(角柱 135.8U)不碰静止食指。 */
const HOOK_INDEX_EVADE: Record<HandSide, { c1: number; c2: number; c3: number; splay: number }> = {
  R: { c1: -0.07, c2: -0.04, c3: 0, splay: 0 },
  L: { c1: -0.07, c2: -0.04, c3: 0, splay: 0 },
};

/** D 族(y.low)静止手无名指沿 B 面外法线微伸离面。
 *  2026-11-16:双手拇指固定，取消旧拇指甩出，home 保持 L:F3 / R:F5。
 *  时序同 HOOK_INDEX_EVADE，drop 后 RECOVER_MS 回落。 */
const LOW_EVADE: Record<HandSide, { ring: { c1: number; c2: number; c3: number; splay: number } }> = {
  R: { ring: { c1: -0.05, c2: -0.03, c3: 0, splay: 0 } },
  L: { ring: { c1: -0.05, c2: -0.03, c3: 0, splay: 0 } },
};

/** E 族(y.mid)双手单指避让(2026-07-09 总原则迁移,替代旧
 *  DODGE_MAG.y.mid=62 整手平移):E 层带(y∈[−32,32])扫掠会犁**两只手**的
 *  贴面指 —— 受害不分弹指手(dodge=0 裸基线,全顶点冻结扫,双向 + 180°):
 *  ① 双手拇指末节肉(贴 F 面,y≈−20、径向 ~119U < 角柱 135.8U)被犁
 *  9.2~11.3U(弹指侧 θ≈0.1-0.64 / 静止侧 θ≈0.98-1.42,窗口首尾相接);
 *  ② 双手中指末节肉(骑 BR/BL 棱中部 y≈0)被犁 6.0~7.5U(θ 窗口与拇指
 *  互补);③ 弹指手无名指自身的 legacy 勾弯扫掠(标定于旧整手 dodge=62 之下)
 *  中段/回撤探进 E 带 4.3~4.8U。避让方向全为贴面外法线:拇指绕根节甩出
 *  F 面(+z,沿用旧 D 拇指避让参数；D 本身现已取消避让);中指/无名指沿
 *  B 面外法线(−z)基节伸展离面。旧注释「E 犁拇指整块肉,关节动作无解」
 *  实测不成立 —— 主犯全是末节单指肉,甩出/离面即清。时序同
 *  HOOK_INDEX_EVADE:目标 = min(1,|层角|/0.09) 即时跟升,drop 后
 *  RECOVER_MS 回落(HandState.midEvade,tick 推进;driveGesture 写**两手**
 *  目标)。splay 两手镜像符号已烘入表内,applyHand 不 ×sideSign。
 *  标定实测(E' 冻结 0.8):拇指尖 Δ≈(±16,−30,+33)U 径向 138→174U
 *  (沿用旧 D 拇指避让数值);中指尖
 *  Δ≈(±4,+4,−16)U 主向 −z;弹指无名指尖 Δ≈(+4,+2,−16)U。避让后全顶点
 *  冻结扫余量:中指 ≥4.4U、拇指 >6U、弹指无名指 ≥4.9U(0.94° 细扫全程
 *  零穿模,decay 0);真实播放 E/E'/E2/E2' 及混序全零。 */
const MID_EVADE: Record<HandSide, { thumb: { c1: number; c2: number; c3: number; splay: number }; middle: { c1: number; c2: number; c3: number; splay: number }; ring: { c1: number; c2: number; c3: number; splay: number } }> = {
  R: {
    thumb: { c1: 0, c2: -0.08, c3: 0, splay: -0.2 },
    middle: { c1: -0.06, c2: -0.03, c3: 0, splay: 0 },
    ring: { c1: -0.06, c2: -0.04, c3: 0, splay: 0 },
  },
  L: {
    thumb: { c1: 0, c2: -0.08, c3: 0, splay: 0.2 },
    middle: { c1: -0.06, c2: -0.03, c3: 0, splay: 0 },
    ring: { c1: -0.06, c2: -0.04, c3: 0, splay: 0 },
  },
};

/** B 族(z.low)静止手单指避让(2026-07-09 总原则迁移,替代旧
 *  DODGE_MAG.z.low=40 整手平移;与 BACK_EVADE 分工:那是**弹指手本侧**静止
 *  中/无名指,这里是**另一只手**):home 静止手贴 B 面的指列处 B 层扫掠带
 *  (z∈[−96,−32],角柱 135.8U),dodge=0 裸基线(2026-07-09 全顶点冻结扫,
 *  双向 + 180°)实测只两指被蹭:① 食指末节尖肉(BUL/BUR 角,z≈−95)被
 *  0.7~1.4U@θ≈1.33-1.42;② 中指中节侧肉(骑 BL/BR 棱,径向 ~132U)被
 *  2.3U@θ≈0.83(仅 B' 的静止 L 手;B 的静止 R 手中指实测未中,~2U 资产
 *  不对称 + 扫向相位所致,两手同表保镜像统一)。无名指/拇指/掌体全程干净
 *  (旧注释「B 族犁中节侧肉,必须让 40U」严重高估)。避让方向 = B 面外法线
 *  (−z)基节伸展离面:食指 = HOOK_INDEX_EVADE 同款数值(同一根手指同一个
 *  动作,U/B 两族视觉统一);中指 = MID_EVADE.middle 同款(E/B 统一)。时序
 *  同 HOOK_INDEX_EVADE:目标 = min(1,|层角|/0.09) 即时跟升,drop 后
 *  RECOVER_MS 回落(HandState.bEvade,tick 推进;driveGesture 只写另一手)。 */
const B_EVADE: Record<HandSide, { index: { c1: number; c2: number; c3: number; splay: number }; middle: { c1: number; c2: number; c3: number; splay: number } }> = {
  R: { index: { c1: -0.07, c2: -0.04, c3: 0, splay: 0 }, middle: { c1: -0.06, c2: -0.03, c3: 0, splay: 0 } },
  L: { index: { c1: -0.07, c2: -0.04, c3: 0, splay: 0 }, middle: { c1: -0.06, c2: -0.03, c3: 0, splay: 0 } },
};

/** F 族(z.high)遗留拇指分支(非 topPush/downPush 的其它握持)单指避让
 *  (2026-07-09 总原则迁移,替代旧 DODGE_MAG.z.high=10 整手平移):F 层带
 *  (z∈[32,96],角柱 135.8U)扫掠受害按**该手自身握姿**分组(dodge=0 且
 *  borrow=0 裸基线,全顶点冻结扫,双向 + 180°,8 种 up/down/home 组合):
 *  ① up 握手拇指末节肉(home 压 F 面的拇指转到 U 面上方,(±40,+112,44)
 *  径向 ~119U)被犁 11.5~11.7U@θ≈1.0-1.3(仅静止时;弹指拇指自己张开避走);
 *  ② up 握手无名指末节(骑 D 面下缘 (±72,−104,66..70))被蹭 3.7~5.4U
 *  @θ≈0.15-0.2 与 θ≈1.57;③ down 握手食指末节(压 U 面上方 (±73,+110,73))
 *  被蹭 0.7~2.4U。home 握手全程干净(贴 B/F 面的指肉都在 F 带外)——
 *  旧整手让 10U 是为 up/down 握持兜底的保险。避让方向 = 该指所贴面的外
 *  法线,且全部复用既有单指动作(关节空间随握姿旋转,方向自动跟面):
 *  拇指沿用旧 D 族甩出参数(up 握下 = 甩离 U 面,E/F 两族拇指
 *  同一动作);食指 = HOOK_INDEX_EVADE 同款基节伸展(down 握下 = 离 U 面,
 *  U/B/F 三族同一动作);无名指 = LOW_EVADE.ring 同款(up 握下 = 离 D 面,
 *  幅度按 5.4U 裸穿加深到 c1:-0.07/c2:-0.04)。施加按握姿选指(applyHand:
 *  up = 拇指+无名指 / down = 食指 / home 与非标准握不动),两手都写目标
 *  (受害不分弹指手,driveGesture)。时序同 HOOK_INDEX_EVADE:目标 =
 *  min(1,|层角|/0.09) 即时跟升,drop 后 RECOVER_MS 回落(HandState.fEvade,
 *  tick 推进)。splay 两手镜像符号已烘入表内,applyHand 不 ×sideSign。 */
const F_EVADE: Record<HandSide, { thumb: { c1: number; c2: number; c3: number; splay: number }; index: { c1: number; c2: number; c3: number; splay: number }; ring: { c1: number; c2: number; c3: number; splay: number } }> = {
  R: {
    thumb: { c1: 0, c2: -0.08, c3: 0, splay: -0.2 },
    index: { c1: -0.07, c2: -0.04, c3: 0, splay: 0 },
    ring: { c1: -0.07, c2: -0.04, c3: 0, splay: 0 },
  },
  L: {
    thumb: { c1: 0, c2: -0.08, c3: 0, splay: 0.2 },
    index: { c1: -0.07, c2: -0.04, c3: 0, splay: 0 },
    ring: { c1: -0.07, c2: -0.04, c3: 0, splay: 0 },
  },
};
/** F_EVADE / S_EVADE 按握姿选指用的基座快照(gripQuat 每帧新建太浪费)。 */
const GRIP_Q_HOME = gripQuat('home');
const GRIP_Q_HALF = gripQuat('half');
const GRIP_Q_UP = gripQuat("up");
const GRIP_Q_DOWN = gripQuat("down");

/** S 族(z.mid)up/down 握单指避让(2026-07-09 总原则迁移,替代旧
 *  DODGE_MAG.z.mid=10 整手平移):home 握全程干净(贴 B/F 面的指肉都在
 *  S 带 z∈[−32,32] 外),受害只在 up/down 握(dodge=0 且借力=0 裸基线,
 *  全顶点冻结扫,双向 + 180°,8 种组合):① 双手拇指末节肉(up 握下
 *  home 压 F 面的拇指转到 U 面上方 (±56,±105,±20..23),z 探进 S 带、
 *  径向 ~119U < 角柱 135.8U)被犁 9.2~11.2U;② 静止手中指末节肉(up 握下
 *  骑 D 面下缘 (±64..66,∓107,±15..19))被犁 5.9~7.3U(弹指中指自己扫开,
 *  不中);down 握 y/z 镜像同值。避让全部复用既有单指动作(关节空间随握姿
 *  旋转,方向自动跟该指所贴面的外法线):拇指沿用旧 D 族甩出参数
 *  (E/F/S 三族拇指同一动作);中指 = MID_EVADE.middle 同款基节伸展
 *  (E/B/S 统一,up 握下 = 离 D 面甩出扫掠半径)。施加按握姿选指
 *  (applyHand:up/down = 拇指+中指,home 与非标准握不动),两手都写目标
 *  (受害不分弹指手,driveGesture)。时序同 HOOK_INDEX_EVADE:目标 =
 *  min(1,|层角|/0.09) 即时跟升,drop 后 RECOVER_MS 回落(HandState.sEvade,
 *  tick 推进)。splay 两手镜像符号已烘入表内,applyHand 不 ×sideSign。 */
const S_EVADE: Record<HandSide, { thumb: { c1: number; c2: number; c3: number; splay: number }; middle: { c1: number; c2: number; c3: number; splay: number } }> = {
  R: {
    thumb: { c1: 0, c2: -0.08, c3: 0, splay: -0.2 },
    middle: { c1: -0.06, c2: -0.03, c3: 0, splay: 0 },
  },
  L: {
    thumb: { c1: 0, c2: -0.08, c3: 0, splay: 0.2 },
    middle: { c1: -0.06, c2: -0.03, c3: 0, splay: 0 },
  },
};

/** 回撤抬指(hook/backHook/downPush 的 decay 凸包):终姿绕层缠得深(尤其连拨
 *  s=1 + 下手握),关节空间直线回 home 的「弦」会切进魔方体(真实播放 oracle
 *  F2 −21.8U,2026-07-08)。decay 叠一个伸展凸包(快攻 12% - 平台 - 快收 15%
 *  包络,起止为零),指尖先径向抬离再归位 —— 伸展方向对任何绕缠终姿都朝外,
 *  天然安全。幅度按回撤起点的 s 加权(缠得浅回撤本就安全,别白抬)。 */
const RETREAT_LIFT = { c1: -0.338, c2: -0.653, c3: -0.113 };

/** per-style 回撤凸包覆盖(缺键回落 RETREAT_LIFT;FINGERTRICKS §5.1 预留的
 *  per-style 回撤编排):hook_index 端点 2026-07-09 钉角 M(指链绕过右上棱
 *  包到 R 面前上)后,s=1 冻结 ×decayK 的关节直线弦会横切 U 面右前区(真实
 *  播放 oracle ~38U);hook_middle2 同族端姿(U2 次指同贴角 M,回撤弦切
 *  25.8U)。默认 RETREAT_LIFT 的纯伸展方向抬不过顶,且缺 splay 通道 ——
 *  +x 甩离 R 面才是钉角端姿的天然逃逸向。数值浏览器坐标下降按 decayK 网格
 *  解(判据 = 回撤全程 pen ≤0 对静态整方箱体;U 单拨与 U2 双指回撤两条
 *  路径同罚)。键 = HOOK_FOLLOW 同款 `${style}_${finger}${次指 ? "2" : ""}`,
 *  只 R 侧钉角端姿需要覆盖。有覆盖的键在 applyHand 里还启用「攻窗保持」:
 *  decayK ∈ [0.88,1] 段 fit 输出钳在提交姿(kFit=min(1,decayK/0.88)),凸包
 *  升满后才开始衰减 —— 贴块提交姿 pad 离贴纸只 ~1.4U,×0.99 的第一帧就会
 *  拉进贴纸。2026-07-09 r3 解:U 回撤全程 pen ≤0;U2 回撤仅攻窗/收尾
 *  ≤0.45U 瞬态(prep 通道仍走 decayK 的固有残差,< 0.5U 验收带)。 */
const RETREAT_LIFT_STYLED: Record<HandSide, Partial<Record<string, { c1: number; c2: number; c3: number; splay: number }>>> = {
  R: {
    // 2026-07-25 随 MANO fit 重解重标(单拨 U + 连拨 U2 两路径联解,细 k 网格
    // 0.02 步 + 尾段 0.005~0.05 + 攻窗 0.88~1):worstSingle 0.05 /
    // worstDouble 0.53(k≈0.01 首指尾段,同 L 侧 0.39 的同族残差)。
    hook_index: { c1: -0.572, c2: 0.409, c3: 0.289, splay: 0.295 },
    // 连拨食指从抬离后的退场姿归位；中指收窄侧摆，避开无名指和小指。
    hook_indexRelay: { c1: -.55, c2: .55, c3: .289, splay: -.225 },
    hook_middle2: { c1: -.454, c2: .232, c3: .701, splay: -.339 },
    // F/F2 左中右下(§4.3)2026-07-25:downPush 两键 MANO 重解后端姿换盆地,
    // 默认 RETREAT_LIFT 在退场中段把食指/中指插回 F 层 23~32U;单拨 F + 连拨 F2
    // 两路径联解 + 细网格精修(worstSingle 0.02 / worstDouble 0.26)。
    downPush_index: { c1: -0.221, c2: 0.436, c3: 0, splay: 1.653 },
    downPush_middle2: { c1: -0.42, c2: 0.59, c3: 0.621, splay: 0.495 },
    // D'(单拨无名指)2026-07-25:hook_ring MANO 重解后端姿换盆地,默认
    // RETREAT_LIFT 在退场中段把无名指插进底后角 +20U;单拨路径联解出纯 splay
    // 甩离(全 k 网格 worst −0.00,尾段 k≈0.03 蹭零)。D2' 连拨仍不设键(见下)。
    hook_ring: { c1: 0, c2: 0, c3: 0, splay: 0.363 },
    // D2'(hook_pinky/hook_ring2)不设键(2026-07-16 MANO 重验):generic 时代
    // 的攻窗峰 +2.9U 随 generic 退役消失 —— MANO 端姿离箱体远(ring2 提交姿
    // ~35U),默认 RETREAT_LIFT 全 k 网格(0.005 步)worst −0.56 全负。
    // ⚠ 勿照 L 侧加「零凸包键」:styled 键会整体顶掉默认 RETREAT_LIFT
    // (rl = rlS ?? RETREAT_LIFT),ring2 失去抬指后关节直线弦在 k≈0.2 切进
    // 底后角区 +15.6U(2026-07-16 注入实测)。
  },
  // L 侧(U'/U2' 钉镜像角端姿,2026-07-09):浏览器按 U' 单拨 + U2' 双指两条
  // 回撤路径联解,细 k 网格(尾段 0.01~0.06 + 攻窗 0.965~0.995 都要采,
  // kStep 0.04 粗网格漏 k=0.98/0.02 两处真峰,踩过)。**凸包 splay 镜像与
  // fit 通道相反**:fit 的 splay 镜像 = 反号,但回撤凸包在贴角端姿上的逃逸
  // splay 两手同号为正(负 splay 盆地多起点怎么解都剩 0.5~1.9U 残差,正
  // splay 盆地直接全负);尾段(k≈0.02,走弦末端蹭 B 面)靠 c1 基节伸展
  // 离面清。解:两键全 k 网格(0.005 步注入复核)pen ≤ 0。
  L: {
    // 2026-07-25 随 MANO fit 重解重标(单拨 U' + 连拨 U2' 两路径联解,k 网格
    // 尾段 0.005~0.05 + 攻窗 0.88~1 全采):worstSingle 0.08 / worstDouble 0.39,
    // 全在 ≤0.5U 瞬态带内。注意**「凸包 splay 两手同号为正」是 generic 时代的
    // 结论,MANO 上不成立** —— L 侧 hook_index 解到 −0.324(端姿换了盆地)。
    hook_index: { c1: -0.71, c2: 0.622, c3: 0, splay: -0.324 },
    // 左手的回撤弧单独标定，避免食指内侧扫过中指指甲。
    hook_indexRelay: { c1: -.54, c2: .53, c3: 0, splay: .22 },
    hook_middle2: { c1: -.397, c2: -.04, c3: .02, splay: .307 },
    // D(单拨无名指)2026-07-25:同 R 侧 hook_ring 键,基节伸展 + 甩离
    // (全 k 网格 worst −0.29)。
    hook_ring: { c1: -0.175, c2: 0, c3: 0, splay: 0.325 },
    // D2 两键(2026-07-10 镜像连拨落地):注入 0.005 步细 k 网格实测,默认
    // RETREAT_LIFT(无 styled 键 = 无攻窗保持)在攻窗段 k≈0.945-0.965 把
    // ring2 端姿(pad gap ~0.4U)×decayK 拉进箱体 +4.0U(R 侧同网格 +2.9U,
    // 同族既有暴露,真实播放 60fps 采样只探到 0.5U)—— 该峰主要靠 styled 键
    // 自带的攻窗 kFit 钳解决,凸包本身只需极小量:pinky 键零凸包(仅为启用
    // 攻窗保持),ring2 微量伸展 + 负 splay。8 参联解(pinky+ring2 两路径
    // 同罚),全 k 网格(0.005 步)pen ≤ −0.49。
    hook_pinky: { c1: 0, c2: 0, c3: 0, splay: 0 },
    hook_ring2: { c1: -0.038, c2: -0.053, c3: -0.001, splay: -0.163 },
  },
};

/** U2 首指退场：指根稍向外让开，中节和末节舒展，让中指沿原轨迹拨层。侧展按手镜像。 */
const HOOK_EXIT = { c1: .4, c2: -.32, c3: -.22, splay: .25, window: .125 };
/** B2 背钩仍在第二段的前 20% 内完成退场。 */
const HOOK_EXIT_IN = 0.2;

/** B2/B2' 连拨首指退场(HOOK_EXIT 的 backHook 版):backHook Q1 做完食指
 *  绕过 BR/BL 棱贴在 R/L 面旁(R 侧 distal 肉 (105,2,−77),径向 ~105 <
 *  角柱扫掠 96√2 ≈ 135.8),Q2 中后段下一个角柱必扫过原地 —— Q2 前 20%
 *  (HOOK_EXIT_IN 同窗)沿 B 面外法线(−z)拉出扫掠带 + 基节伸展,观感 =
 *  背钩拨完向后下方的自然 follow-through。判据:Q2 全程食指全顶点 pen ≤ 0
 *  + 最小幅度正则;两手各解各的(splay 符号已烘入,不 ×sideSign)。
 *  2026-07-10 标定:R 最小幅度解(Q2 worst −0.81U,tip 提交
 *  (135.2, 11.5, −115.1));L 侧早窗(90° 边界贴角柱)靠 backHook_index 端
 *  节点微调解开(见 HOOK_FOLLOW.L 注),exit 同为中等幅度(Q2 worst 0.00U
 *  单点擦零,tip 提交 (−131.8, 87.1, −152.7),向后上方甩出)。 */
const BACK_EXIT: Record<HandSide, { c1: number; c2: number; c3: number; splay: number }> = {
  R: { c1: -0.16, c2: -0.028, c3: -0.002, splay: 0 },
  L: { c1: -0.232, c2: -0.064, c3: 0.006, splay: -0.016 },
};

/** F2 / F2'(§4.3)连拨首指退场(HOOK_EXIT 的 downPush 版,参数按右手定义,
 *  左手复用并镜像 splay)。2026-07-25 MANO 重解 downPush_index 后暴露:Q1 做完
 *  食指停在 F 层前上缘,Q2 中后段(φ≈1.0-1.4)下一个角柱扫过原地 —— 冻结细扫
 *  实测 21.7U(generic 时代靠端姿本身在带外侥幸避开,fit 换盆地后失效)。同
 *  HOOK_EXIT_IN 窗口内退场,判据 = Q2 全程食指全顶点 pen ≤0 + 最小幅度正则。
 *  解:Q2 全程 pen ≤ −1.93,指尖 Δ≈(+30,−31,−8)= 拨完向右前下方的自然收势。 */
const DOWN_EXIT = { c1: 0.1, c2: 0.1, c3: 0, splay: -0.05 };

/** F 层「食指下拨」(FINGERTRICKS §4.3):右手从 U8 / 左手从 U6 起拨,
 *  随 F 层角前卷;半转时次指中指 Q1 前探 UF 缘接力。参数按右手定义,左手镜像。
 *  数值浏览器标定。 */
const DOWN_PUSH = {
  c1: 0.5, c2: 0.35, c3: 0.25, splay: 0, // 回退默认(实际走 HOOK_FOLLOW.downPush_*)
  // = HOOK_PREP.middle 的 splay 反号版(hook 分支 prep ×sideSign、downPush 分支
  // 用本手局部值,R 手 sideSign=−1;符号踩过,oracle 实证 43U 反向)。
  prep2: { c1: -0.29, c2: 0.309, c3: 0.0093, splay: -0.468 },
};

interface HandState {
  model: HandModel;
  halfPalm: HalfPalmPose;
  idleBlend: number;
  skinStroke: SkinStroke;
  halfThumbReturn: number;
  halfSeatRelease?: { source: number; layerAngle: number };
  home: HandPose;
  /** 独立前臂(肘锚固定,每帧 IK 指向手腕 —— 腕转时肘不绕魔方公转)。
   *  @4 融合资产下为 null:前臂已缝在手网格里,由 model.forearm.bone 驱动
   *  (同一肘锚语义,摆动改为绕腕的骨旋转)。 */
  forearm: THREE.Group | null;
  /** 融合前臂绑定基(手局部正交基 x=肘→腕绑定向、z≈掌法向 的逆四元数,
   *  Δ = 目标基 · bindFrameInv;setFromUnitVectors 滚转漂移的同款规避)。 */
  armBindFrameInv: THREE.Quaternion | null;
  /** 肘锚点(rig 局部,画面外下方)。 */
  elbow: THREE.Vector3;
  forearmAim: THREE.Vector3;
  virtualShoulder: THREE.Vector3;
  forearmRotation: ForearmRotation;
  virtualRoll: number;
  appliedForearmRoll: number;
  appliedArmWeight: number;
  regripArmWeight: number;
  wristBend: number;
  /** 持久握姿基座(weld 提交烘入 / 换握记号设定);identity = home 握。 */
  grip: THREE.Quaternion;
  gripAngle: number;
  recoverWristAngle: number;
  /** weld 进行中:跟随的轴;null = 未 weld。 */
  weldAxis: Axis | null;
  weldAngle: number;
  /** weld 的未压缩层角(提交烘入判定用;flick 借力通道恒 0,不烘)。 */
  weldRawAngle: number;
  /** true = 本次 weld 是整体转体(同步层角、提交后依次回握)。 */
  weldWhole: boolean;
  /** drop 后的回位:从该四元数 slerp 回 identity。 */
  recoverQuat: THREE.Quaternion;
  recoverT: number; // 0..1,1=已回位
  /** flick 残留(手指偏移随时间衰减)。 */
  strokeLayers: readonly number[];
  flickFinger: FingerName | null;
  /** 连拨次指(180° 接力,FINGERTRICKS §4.1);decay 期间保留(两指一起恢复)。 */
  flickFinger2: FingerName | null;
  flickAxis: Axis | null; // 弹指所属轴(决定扫法:y=勾弯横拉,x/z=竖扫);decay 期间保留
  flickLayer: LayerClass | null; // 区分 F/F′ 的 U8/U6 与 S/S′ 的 U5/U3；准备和收指期间也保留
  flickStyle: FlickStyle | null; // 特殊扫法(FINGERTRICKS.md);decay 期间保留
  flickAmount: number; // 当前手指扫角(rad,随层角;连拨/接触样式存未钳制原角)
  flickDecay: number;  // drop 后残留衰减
  /** topPush 伸指进度(时间驱动,0..1;reachTarget 为目标,tick 内推进)。 */
  reachT: number;
  reachTarget: 0 | 1;
  /** FTN @pin 贴块钉指(weld 前置,见 WELD_PIN):时间驱动同 reachT;
   *  收指走完(pinReachT 回 0)才清 pinFinger。 */
  pinFinger: FingerName | null;
  pinReachT: number;
  pinReachTarget: 0 | 1;
  /** U 族静止手食指避让（即时跟升 /
   *  RECOVER_MS 回落)× HOOK_INDEX_EVADE = 食指离面姿态偏移。 */
  indexEvade: number;
  indexEvadeTarget: number;
  /** D 族静止手无名指避让:同 indexEvade 时序 × LOW_EVADE。 */
  lowEvade: number;
  lowEvadeTarget: number;
  /** E 族双手「拇指 + 中指(+ 弹指无名指)」单指避让:同上时序 × MID_EVADE。 */
  midEvade: number;
  midEvadeTarget: number;
  /** B 族静止手「食指 + 中指」单指避让:同上时序 × B_EVADE。 */
  bEvade: number;
  bEvadeTarget: number;
  /** F 族遗留分支(非双中手握持)单指避让:同上时序 × F_EVADE(按握姿选指)。 */
  fEvade: number;
  fEvadeTarget: number;
  /** S 族 up/down 握「拇指 + 中指」单指避让:同上时序 × S_EVADE(按握姿选指)。 */
  sEvade: number;
  sEvadeTarget: number;
}

export type HandLoadPhase = 'idle' | 'loading' | 'texturing' | 'ready' | 'error';
export interface HandsLoadState {
  readonly hands: HandLoadPhase;
  readonly body: HandLoadPhase;
}

function disposeHandModel(model: HandModel): void {
  // 骨架连线共享几何，只释放一次；SkinnedMesh 的骨骼纹理不由 geometry 管理。
  for (const geo of new Set(model.meshes.map((mesh) => mesh.geometry))) geo.dispose();
  for (const mesh of model.meshes) {
    if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.dispose();
  }
  for (const mat of model.extraMats ?? []) mat.dispose();
  model.group.removeFromParent();
}

// Keep the support-hand kinematics for one-handed previews without a second mesh or asset.
function rightHandPoseFrom(left: HandModel): HandModel {
  const reflect = ({ x, y, z, w }: THREE.Quaternion) => new THREE.Quaternion(-x, y, -z, w);
  const group = new THREE.Group();
  const joints = new Map<THREE.Object3D, THREE.Group>([[left.group, group]]);
  const mirrorJoint = (source: THREE.Object3D): THREE.Group => {
    const existing = joints.get(source);
    if (existing) return existing;
    const joint = new THREE.Group();
    joint.position.set(source.position.x, -source.position.y, source.position.z);
    joint.quaternion.copy(reflect(source.quaternion));
    joint.scale.copy(source.scale);
    (source.parent ? mirrorJoint(source.parent) : group).add(joint);
    joints.set(source, joint);
    return joint;
  };
  const fingers = Object.fromEntries(Object.entries(left.fingers).map(([name, finger]) => [name, {
    ...finger,
    root: mirrorJoint(finger.root), mid: mirrorJoint(finger.mid), tip: mirrorJoint(finger.tip),
    rootBase: reflect(finger.rootBase),
    meta: finger.meta && mirrorJoint(finger.meta), metaBase: finger.metaBase && reflect(finger.metaBase),
    tipOffset: finger.tipOffset?.clone().multiply(new THREE.Vector3(1, -1, 1)),
  }])) as HandModel['fingers'];
  return { group, fingers, side: -1, unitScale: left.unitScale, meshes: [] };
}

export default class HandsRig extends THREE.Group {
  private diagnosticListeners = new Set<(frame: HandDiagnosticFrame) => void>();
  private ruPreparation: 'preparing' | 'turning' | 'held' | null = null;
  private markedMotion: MarkedFingerMotion | null = null;
  private supportTransition: { motion: MarkedFingerMotion; weldRadians: number; releasing: boolean } | null = null;
  private rightPinch: RightCornerPinch | null = null;
  private restorePinchFingers?: () => void;

  bindRightPinch(cube: Cube, completed: number) {
    if (this.enabled && cube.order === 3) this.rightPinch ??= new RightCornerPinch(cube, completed);
  }

  prepareRightPinch(cube: Cube, step: number, reverse = false) {
    if (!this.hands) return this.enabled && this.loadState.hands !== 'error';
    this.bindRightPinch(cube, reverse ? step + 1 : step);
    return this.rightPinch?.prepare(step, reverse) ?? false;
  }

  private readonly fourContacts = new WeakMap<HandModel, FourLayerContact>();
  private fourSeat: (FourLayerStroke & { gesture: HandGesture; progress: number }) | null = null;

  private seatFour(axis: Axis, layers: readonly number[], dir: number, gesture: HandGesture) {
    const seat = this.fourSeat;
    if (seat && seat.axis === axis && sameLayers(seat.layers, layers) && seat.dir === dir && !seat.returning) {
      seat.gesture = gesture;
      return seat;
    }
    this.fourSeat = { axis, layers, dir, gesture, progress: 0, angle: 0, returning: false };
    return this.fourSeat;
  }

  private captureFourHome(): void {
    if (this.cube?.order !== 4 || !this.hands) return;
    for (const side of ['R', 'L'] as const) {
      const { model } = this.hands[side];
      if (this.fourContacts.has(model)) continue;
      this.applyHand(side, false);
      const mesh = model.meshes.find(m => (m as THREE.SkinnedMesh).isSkinnedMesh) as THREE.SkinnedMesh | undefined;
      if (mesh) this.fourContacts.set(model, new FourLayerContact(model, mesh));
    }
  }

  private wideSupport: WideSupport | null = null;
  private markedProblem: MarkedMotionProblem | null = null;
  /** The gesture actually driving the current layer, after preparation and any grip changes. */
  get activeBearing() { return this.active?.bearing; }
  get strokeCandidates() { return this.active?.gesture?.kind === 'flick' && this.active.gesture.style === 'marked'
    ? this.markedMotion?.plan.candidates : this.active?.candidates; }
  get activeGesture(): HandGesture | null { return this.active?.gesture ?? null; }
  get isPreparingHomeStroke(): boolean {
    return this.pocketPushSupport !== this.pocketPushTarget
      || !!(this.singleMarkSeat?.homeStroke || this.pendingHint?.homeStroke || this.wideSupport);
  }

  getMarkedMotionProblem(): MarkedMotionProblem | null { return this.markedProblem; }

  private releaseRUPreparation(): void {
    if (this.ruPreparation && this.hands) this.hands.R.reachTarget = 0;
    this.ruPreparation = null;
  }

  subscribeDiagnostics(listener: (frame: HandDiagnosticFrame) => void): () => void {
    this.diagnosticListeners.add(listener);
    return () => { this.diagnosticListeners.delete(listener); };
  }

  private emitDiagnostic(event: HandDiagnosticFrame['event'], gripRequest?: HandDiagnosticFrame['gripRequest'], preparedGesture?: HandGesture): void {
    const hands = this.hands;
    if (!hands || !this.diagnosticListeners.size) return;
    const state = (side: HandSide): HandDiagnosticFrame['hands'][HandSide] => {
      const h = hands[side];
      return {
        phase: this.markedMotion?.retreating ? 'returning' : this.markedMotion?.preparing ? 'preparing'
          : this.regripFlag && h.recoverT < 1 ? 'regripping'
          : h.flickDecay > 0 || (h.reachT > 0 && h.reachTarget === 0) || h.recoverT < 1 ? 'returning'
          : h.reachTarget > h.reachT || h.pinReachTarget > h.pinReachT || side !== this.supportTransition?.motion.plan.hand && this.supportTransition?.motion.preparingPinch ? 'preparing'
          : h.weldAxis || (this.active?.gesture?.kind === 'flick' && this.active.gesture.hand === side) ? 'turning'
          : 'stable',
        grip: h.grip.toArray(), position: h.model.group.position.toArray(),
        quaternion: h.model.group.quaternion.toArray(),
        wristAngle: this.currentWristAngle(h), forearmRoll: h.appliedForearmRoll,
        elbowPosition: h.forearmAim.toArray(), wristBend: h.wristBend,
        finalPose: event === 'frame' ? measureFinalHandPose(h.model, h.virtualRoll,
          this.body?.visible ? this.body.measureArm(side) : null) : undefined,
        forearmQuaternion: (h.model.forearm?.bone.quaternion ?? h.forearm?.quaternion)?.toArray() ?? null,
        flickAngle: h.flickAmount, decay: h.flickDecay,
      };
    };
    const frame: HandDiagnosticFrame = {
      atMs: performance.now(), event, gripRequest, preparedGesture, grips: this.gripNames(),
      hands: { R: state('R'), L: state('L') },
      active: this.active ? { axis: this.active.axis, cls: this.active.cls, layers: this.active.layers,
        angle: this.active.lastAngle, halfTurn: this.active.halfTurn, bearing: this.active.bearing, gesture: this.active.gesture } : null,
      wideSupport: this.wideSupport ? { hand: this.wideSupport.hand, fingers: this.wideSupport.anchors,
        shift: this.wideSupport.shift.toArray(), progress: this.wideSupport.progress } : undefined,
      marked: this.markedMotion ? { profile: this.markedMotion.plan.profile.id, hand: this.markedMotion.plan.hand,
        finger: this.markedMotion.plan.profile.finger, contact: this.markedMotion.contact,
        preparing: this.markedMotion.preparing, returning: this.markedMotion.retreating } : undefined,
      models: { R: hands.R.model, L: hands.L.model },
    };
    for (const listener of this.diagnosticListeners) {
      try { listener(frame); } catch (error) {
        // A broken observer must never prevent a turn or leave the rig half-updated.
        this.diagnosticListeners.delete(listener);
        console.warn('[sim hands] diagnostic observer detached:', error);
      }
    }
  }
  private disposed = false;
  private readonly abort = new AbortController();
  private readonly loadListeners = new Set<() => void>();
  private loadState: HandsLoadState = { hands: 'loading', body: 'idle' };
  private readonly pendingGrips = { R: new THREE.Quaternion(), L: new THREE.Quaternion() };
  private readonly pendingWristAngles = { R: 0, L: 0 };

  getLoadState = (): HandsLoadState => this.loadState;
  subscribeLoadState = (listener: () => void): (() => void) => {
    this.loadListeners.add(listener);
    return () => { this.loadListeners.delete(listener); };
  };
  private updateLoadState(part: keyof HandsLoadState, phase: HandLoadPhase): void {
    if (this.disposed || this.loadState[part] === phase) return;
    this.loadState = { ...this.loadState, [part]: phase };
    for (const listener of this.loadListeners) listener();
  }
  retryLoad(): void {
    if (this.disposed) return;
    if (this.loadState.hands === 'error') void this.initAsync();
    else if (this.bodyWanted && this.loadState.body === 'error') this.ensureBody();
  }
  private readonly skinMat: THREE.MeshPhysicalMaterial;
  /** 两手各自的烘焙贴图材质(UV 布局左右不一致,各烘各的);烘焙失败为空,
   *  手退回平色 skinMat 仍可用。 */
  private readonly handMats: THREE.MeshPhysicalMaterial[] = [];
  /** MediaPipe 风格骨架叠加层材质(透明常开,fade 只驱动 opacity)。 */
  private readonly skelMats: THREE.MeshBasicMaterial[];
  private readonly skelMatMap: Record<SkeletonMatKey, THREE.MeshBasicMaterial>;
  /** 手模异步加载，完成前记录握姿并等待播放，完成后从 fade=0 淡入。 */
  private hands: Record<HandSide, HandState> | null = null;
  private cube: HandsCubeLike | null = null;
  /** SMPL-X 全身(设置「全身人物」;懒加载,onepiece 单网格傀儡 —— 肘臂腕手
   *  同一块皮,手区逐骨同步活手,见 smplxBody.ts)。 */
  private body: SmplxBody | null = null;
  private bodyWanted = false;
  private avatarSrc = "";
  private avatarPlacement: [number, number, number] = [0, 0, 1];
  setAvatar(src: string, x = 0, y = 0, scale = 1): void {
    this.avatarSrc = src;
    this.avatarPlacement = [x, y, scale];
    this.body?.setAvatar(src, x, y, scale);
  }
  getHeadView(position: THREE.Vector3, direction: THREE.Vector3): boolean {
    return this.body?.getHeadView(position, direction) ?? false;
  }
  private bodyLoading = false;

  private enabled = false;
  private fade = 0; // 0 隐 → 1 显
  private lastActivityAt = 0;
  private idleClock = 0;
  private regripFlag = false;
  // A formatted single turn may borrow one wrist orientation until the digit clears.
  private singleMarkSeat: { hand: HandSide; original: GripName; wristAngle: number; style: FlickStyle; homeStroke?: boolean; selection?: { dir: number; thumbOnly: boolean; stroke: HomeStroke }; returning: boolean } | null = null;
  private leftRelaySeat: { original: GripName; wristAngle: number; returning: boolean } | null = null;
  private wholeRegrip = false;

  /** 当前手势(某一轴上活动层的手势);null = 静止。dir=0 表示方向未提交;
   *  lastAngle 用于识别「同轴同类连发」(U 接 U:角度从 ~π/2 跳回 ~0);
   *  lastAngle 保存本帧层角。 */
  private active: { axis: Axis; cls: LayerClass; layers: readonly number[]; dir: 0 | 1 | -1; gesture: HandGesture | null; halfTurn?: boolean; candidates?: HomeStroke['candidates']; bearing?: CalibratedStroke['bearing']; lastAngle: number } | null = null;

  private thumbReferenceSeated = false;
  private thumbTapCount = 0;
  private thumbTapElapsed = 0;
  private thumbTapReach = 0;
  private thumbGripClearance = 0;

  constructor(private readonly loadedHands: 'both' | 'left' | 'left-thumb' = 'both') {
    super();
    this.name = "handsRig";
    // 皮肤(前臂 + 烘焙失败时的手部回退):物理材质 + 顶点血色(几何侧烘)+
    // 程序噪声 bump/roughness(毛孔颗粒);手本体正常路径用 initAsync 里的
    // 烘焙贴图材质(handMats)。低强度高光保留皮肤油脂感，不用织物 sheen 模拟透光。
    const detail = makeSkinDetailTexture();
    const skin = new THREE.MeshPhysicalMaterial({
      color: 0xd9af94, // 降饱和肤色 —— 偏橘的高饱和基色是「橘蜡假人」主因(评审 #8)
      roughness: 0.85, // 有 roughnessMap 时为乘数:0.85 × 贴图(均值 ~0.66)≈ 实效 0.56
      metalness: 0,
      vertexColors: true,
      ior: 1.4,
      specularIntensity: 0.75,
    });
    skin.bumpMap = detail;
    skin.bumpScale = 0.55;
    skin.roughnessMap = detail;
    this.skinMat = skin;

    // 骨架叠加层材质先建(setSkeletonVisible 在加载完成前就可调),几何在
    // initAsync 里挂到加载好的骨骼上。默认隐藏 —— 由设置「骨架线条」开关驱动。
    this.skelMatMap = makeHandSkeletonMats();
    this.skelMats = Object.values(this.skelMatMap);
    this.setSkeletonVisible(false);
    // MANO 手模异步加载；缺失时由设置反馈并提供重试。
    void this.initAsync();

    // 手部补光使用 layer 1。柔和的半球漫射
    // 保留背光侧肤色，左前主光交代关节曲面；不依赖魔方塑料材质的低强度灯光。
    const sky = new THREE.HemisphereLight(0xfff4eb, 0x746a63, Math.PI * 0.22);
    sky.layers.set(1);
    const fillA = new THREE.DirectionalLight(0xfff0e2, Math.PI * 0.30);
    fillA.position.set(-SIZE * 3, SIZE * 1.5, SIZE * 3);
    fillA.layers.set(1);
    // 下方冷补光压低(0.16→0.08):拉开明暗比,减少「均匀照亮」的蜡感(评审 #10)。
    const fillB = new THREE.DirectionalLight(0xdfe8f5, Math.PI * 0.08);
    fillB.position.set(SIZE * 2, -SIZE * 3, SIZE * 2);
    fillB.layers.set(1);
    // 暖背光轮廓(rim):从手后上方掠射,勾亮指缘/指尖 —— 皮肤薄处透红是次表面
    // 散射最强的「肉感」信号,一盏背光比任何贴图都廉价有效(craft 研究首推)。
    const rim = new THREE.DirectionalLight(0xffcaa6, Math.PI * 0.3);
    rim.position.set(SIZE * 1.2, SIZE * 2.6, -SIZE * 3.2);
    rim.layers.set(1);
    // 前侧低强度暖 rim:产品主视角(正面)吃不到后上 rim,补一盏让正面握持
    // 视角的指缘也有暖轮廓(评审 #10②)。
    const rimFront = new THREE.DirectionalLight(0xffcaa6, Math.PI * 0.08);
    rimFront.position.set(-SIZE * 2, SIZE * 1.2, SIZE * 3);
    rimFront.layers.set(1);
    this.add(sky, fillA, fillB, rim, rimFront);

    this.visible = false;
  }

  /** 加载所需的 MANO 手 → 烘焙皮肤贴图 → 建前臂 / 骨架叠加 / HandState。 */
  private async initAsync(): Promise<void> {
    this.updateLoadState('hands', 'loading');
    // MANO 资产是逐机转换的 gitignored 文件(授权数据不入公开仓库):缺失时
    // 手部功能整体不可用(内置 generic-hand 已退役,无回退)。
    const loaded = await Promise.allSettled([
      this.loadedHands === 'both' ? loadManoHand(-1, this.skinMat, this.abort.signal) : Promise.resolve(null),
      loadManoHand(1, this.skinMat, this.abort.signal),
    ]);
    const [r, l] = loaded;
    if (this.disposed || r.status === 'rejected' || l.status === 'rejected') {
      for (const result of loaded) if (result.status === 'fulfilled' && result.value) disposeHandModel(result.value);
      if (!this.disposed) {
        this.updateLoadState('hands', 'error');
        console.warn('[sim hands] Hand model load failed:', loaded.find(result => result.status === 'rejected'));
      }
      return;
    }
    const left = l.value;
    const models = r.value ? [r.value, left] : [left];
    this.updateLoadState('hands', 'texturing');
    // 程序化皮肤贴图烘焙(albedo/bump/roughness + 指甲)。必须在入场景 / 摆
    // home 姿态之前(烘焙契约:绑定姿态 + group 无父级)。UV 布局左右手不一致
    // (实测 max diff 0.042),两手各烘各的。失败非致命:退回平色 skinMat。
    // MANO 同路径烘焙(转换器 @2 起给盒式投影无重叠 UV 图集 —— 烘焙器在 3D
    // 域求值特征,对图集布局无要求,只要求单射)。
    try {
      for (const model of models) {
        const maps = await bakeHandTextures(model, 1024, this.abort.signal);
        if (this.disposed) {
          maps.albedo.dispose(); maps.bump.dispose(); maps.rough.dispose();
          break;
        }
        const mat = this.skinMat.clone();
        applyBakedSkinMaps(mat, maps);
        model.meshes[0].material = mat;
        this.handMats.push(mat);
      }
    } catch (e) {
      if (!this.disposed) console.warn("[sim hands] skin texture bake failed:", e);
    }
    if (this.disposed) {
      for (const model of models) disposeHandModel(model);
      return;
    }
    const right = r.value ?? rightHandPoseFrom(left);
    this.add(right.group, left.group);
    // 前臂:@4 起已在转换期缝进手网格(单一网格 —— 腕缝几何/法线/贴图天然
    // 连续,根治两件套时代的台阶与「手臂比手细」;旧 stumpFit 对齐层还犯过
    // 米制几何 vs rig 单位 WRIST_LOCAL 的单位混用,fit 恒 undefined → 前臂恒
    // 走 34.5U 旧回退缩放,细 18%)。灰袖口 2026-07-16 按用户要求移除,肘端
    // 断口裸露肤色封盖。此处只剩旧资产兜底 → 程序化锥形管。
    let rArm: { group: THREE.Group; meshes: THREE.Mesh[] } | null = null;
    let lArm: { group: THREE.Group; meshes: THREE.Mesh[] } | null = null;
    if (!left.forearm || (r.value && !right.forearm)) {
      console.info("[sim hands] 资产无融合前臂(@4 前旧格式?),使用程序化前臂");
      lArm = buildForearm(this.skinMat);
      this.add(lArm.group);
      left.meshes.push(...lArm.meshes);
      if (r.value) {
        rArm = buildForearm(this.skinMat);
        this.add(rArm.group);
        right.meshes.push(...rArm.meshes);
      }
    }
    // 21 关键点骨架叠加(MediaPipe Hands 默认画风)—— 静态几何挂关节组,
    // 姿态自动跟随;网格进 model.meshes 复用补光层 / dispose。
    for (const model of models) addHandSkeleton(model, this.skelMatMap);
    // 肘锚 = home 腕点沿「手局部 −x(腕→肘,即手轴的反向延长)」推远:静止时
    // 前臂就是手的自然延长线(腕部不打折 —— 固定世界锚曾让前臂垂直下垂 /
    // 斜插,2026-07-11 用户两次抓的);锚仍是固定点(距离 ≫ 臂长),腕转 /
    // 弹指时前臂绕它小幅摆动而不是整条手臂跟手公转(原设计语义保留)。
    const elbowAnchor = (home: HandPose): THREE.Vector3 => {
      const wrist = WRIST_LOCAL.clone().applyQuaternion(home.quat).add(home.pos);
      const back = new THREE.Vector3(-1, 0, 0).applyQuaternion(home.quat);
      return wrist.addScaledVector(back, SIZE * 7.5 * HAND_SCALE);
    };
    const homeR = homeRight(this.cube?.order);
    const homeL = homeLeft(this.cube?.order);
    this.hands = {
      R: this.initHandState(right, homeR, rArm ? rArm.group : null, elbowAnchor(homeR)),
      L: this.initHandState(left, homeL, lArm ? lArm.group : null, elbowAnchor(homeL)),
    };
    for (const side of ['R', 'L'] as const) {
      this.applyHand(side, false);
      this.hands[side].halfPalm.contactSkin.captureGripKnuckles(side === 'L');
    }
    this.restorePinchFingers = capturePinchFingers(right);
    this.captureFourHome();
    const pendingPinch = this.rightPinch;
    this.setGrips(this.pendingGrips.R, this.pendingGrips.L, this.pendingWristAngles, !!this.pocketPushTarget);
    this.rightPinch = pendingPinch;
    for (const s of ["R", "L"] as const) {
      for (const m of this.hands[s].model.meshes) m.layers.enable(1);
    }
    this.setNailsVisible(this.nailsVisible); // 手模晚于设置到位,补应用「指甲」显隐
    this.setNailPolish(this.nailPolish);     // 同上,补应用「指甲配色」
    if (this.bodyWanted) this.ensureBody();  // 「全身人物」早于手模到位的回放
    // 加载期间开关已开 → 从 0 重新淡入(否则 fade 早到 1,手会瞬间蹦出来)。
    if (this.enabled) {
      this.fade = 0;
      for (const mat of this.fadeMats()) { mat.transparent = true; mat.opacity = 0; }
    }
    this.updateLoadState('hands', 'ready');
  }

  /** 随 fade 开合的实体材质(骨架叠加线另算,常开 transparent 只驱动 opacity)。
   *  handMats 异步烘焙后才入列,动态取。 */
  private fadeMats(): THREE.Material[] {
    return [this.skinMat, ...this.handMats,
      ...(this.hands?.R.model.extraMats ?? []), ...(this.hands?.L.model.extraMats ?? []),
      ...(this.body ? [this.body.mat] : []),
    ];
  }

  /** onepiece 全身渲染时隐藏活手皮肤网格:傀儡手区表面与活手逐点重合,双显 =
   *  共面 z-fight。甲片/骨架线挂代理关节组,不在 meshes[0],照常显示;活手的
   *  姿态/求解/修正照常运转(傀儡的数据源)。(旧「变焦穿越带」淡出已删 ——
   *  2026-07-16 用户规格:全身开关开着任何缩放都必须显示。) */
  private syncLiveSkin(): void {
    if (!this.hands) return;
    const puppet = this.fullBodyOn;
    for (const s of ["R", "L"] as const) {
      const skin = this.hands[s].model.meshes[0];
      if (skin) skin.visible = !puppet;
    }
  }

  /** 设置「全身人物」(SimSettings.fullBody 驱动):SMPL-X 全身随手出场。
   *  首开惰性 fetch + 建体(onepiece 单网格 ~8.7MB 一次,30 天强缓存);资产
   *  缺失时保留手模并提供重试。依赖手模就位(unitScale / 傀儡常量预算 /
   *  home 放置),手未加载完时由 initAsync 尾部回放。 */
  setFullBody(want: boolean): void {
    if (this.loadedHands !== 'both') return;
    if (this.bodyWanted !== want && this.hands) {
      for (const hand of Object.values(this.hands)) hand.forearmRotation.reset();
      this.body?.resetPlacement();
    }
    this.bodyWanted = want;
    if (want) this.ensureBody();
    if (this.body) this.body.visible = want;
    this.syncLiveSkin();
  }

  get fullBodyOn(): boolean {
    return this.bodyWanted && this.body != null;
  }

  private ensureBody(): void {
    if (this.disposed || this.body || this.bodyLoading || !this.hands) return;
    this.bodyLoading = true;
    this.updateLoadState('body', 'loading');
    void loadSmplxOnePiece(this.abort.signal)
      .then((data) => {
        const hands = this.hands;
        if (this.disposed || !hands) { this.bodyLoading = false; return; }
        const body = new SmplxBody(data, { R: hands.R.model, L: hands.L.model }, this.skinMat);
        const homeWrist = (side: HandSide) => WRIST_LOCAL.clone()
          .applyQuaternion(hands[side].home.quat).add(hands[side].home.pos);
        body.placeFromWrists(homeWrist("R"), homeWrist("L"));
        body.mesh.layers.enable(1);
        body.visible = this.bodyWanted;
        this.add(body);
        this.body = body;
        body.mat.opacity = this.fade * this.fade * (3 - 2 * this.fade);
        body.mat.transparent = this.fade < 1;
        body.setAvatar(this.avatarSrc, ...this.avatarPlacement);
        this.bodyLoading = false;
        this.syncLiveSkin();                     // 傀儡接管手区,活手皮肤退场
        this.lastActivityAt = performance.now();
        this.updateLoadState('body', 'texturing');
        // 全身贴图异步烘焙(基肤 + 双手皱纹;烘完热替换,失败留平色可用)
        void body.bakeTextures(this.abort.signal)
          .catch((e: unknown) => { if (!this.disposed) console.warn("[sim hands] body texture bake failed:", e); })
          .finally(() => {
            this.lastActivityAt = performance.now();
            this.updateLoadState('body', 'ready');
          });
      })
      .catch((e: unknown) => {
        this.bodyLoading = false;
        if (!this.disposed) {
          this.updateLoadState('body', 'error');
          console.warn('[sim hands] Full body load failed:', e);
        }
      });
  }

  /** 调试开关(SimSettings.handsSkeleton 驱动):显隐 MediaPipe 风格骨架叠加线
   *  (关节点 + 连线)。两只手共享同一批材质实例,一次性切全部。与 fade 驱动的
   *  opacity 相互独立 —— 直接控 visible,不影响手部皮肤/指甲的淡入淡出。 */
  setSkeletonVisible(v: boolean): void {
    for (const mat of this.skelMats) mat.visible = v;
  }

  /** 调试开关(SimSettings.showNails 驱动):显隐立体甲片(mesh.visible,
   *  不拆几何)。手模异步加载,加载完成处回放最后一次设置值。 */
  private nailsVisible = true;
  setNailsVisible(v: boolean): void {
    this.nailsVisible = v;
    if (!this.hands) return;
    for (const s of ["R", "L"] as const) {
      for (const m of this.hands[s].model.nailMeshes ?? []) m.visible = v;
    }
  }

  /** 「指甲配色」(SimSettings.nailColor* 驱动):null = 自然甲。重涂甲片顶点色
   *  (paintNailPolish,可反复来回切);手模异步加载,加载完成处回放最后设置值。 */
  private nailPolish: NailPolishSpec | null = null;
  setNailPolish(p: NailPolishSpec | null): void {
    this.nailPolish = p;
    if (!this.hands) return;
    for (const s of ["R", "L"] as const) paintNailPolish(this.hands[s].model, p);
  }

  private initHandState(model: HandModel, home: HandPose, forearm: THREE.Group | null, elbow: THREE.Vector3): HandState {
    model.group.position.copy(home.pos);
    model.group.quaternion.copy(home.quat);
    let armBindFrameInv: THREE.Quaternion | null = null;
    if (model.forearm) {
      // 绑定臂正交基(手局部,与 tick 目标基同款):x=肘→腕 = −bindDir
      const xb = model.forearm.bindDir.clone().negate();
      const zb = new THREE.Vector3(0, 0, 1).addScaledVector(xb, -xb.z).normalize();
      const yb = new THREE.Vector3().crossVectors(zb, xb);
      armBindFrameInv = new THREE.Quaternion()
        .setFromRotationMatrix(new THREE.Matrix4().makeBasis(xb, yb, zb))
        .invert();
    }
    return {
      model,
      idleBlend: 0,
      skinStroke: { index: 0, middle: 0, ring: 0 },
      halfPalm: new HalfPalmPose(model, FINGER_HINGES, THUMB_HINGES),
      home,
      forearm,
      armBindFrameInv,
      elbow,
      forearmAim: elbow.clone(),
      // The aiming pole can be far outside the mesh. Place a virtual shoulder
      // above and behind a forearm-length elbow, in the same rig frame as home.
      virtualShoulder: WRIST_LOCAL.clone().applyQuaternion(home.quat).add(home.pos)
        .addScaledVector(new THREE.Vector3(-1, 0, 0).applyQuaternion(home.quat), .25 * model.unitScale)
        .addScaledVector(new THREE.Vector3(0, .26, .08), model.unitScale),
      forearmRotation: new ForearmRotation(), virtualRoll: 0,
      appliedForearmRoll: 0,
      appliedArmWeight: 0,
      regripArmWeight: 0,
      wristBend: 0,
      grip: new THREE.Quaternion(),
      gripAngle: 0,
      recoverWristAngle: 0,
      weldAxis: null,
      weldAngle: 0,
      weldRawAngle: 0,
      halfThumbReturn: 0,
      weldWhole: false,
      recoverQuat: new THREE.Quaternion(),
      recoverT: 1,
      strokeLayers: [],
      flickFinger: null,
      flickFinger2: null,
      flickAxis: null,
      flickLayer: null,
      flickStyle: null,
      flickAmount: 0,
      flickDecay: 0,
      reachT: 0,
      reachTarget: 0,
      pinFinger: null,
      pinReachT: 0,
      pinReachTarget: 0,
      indexEvade: 0,
      indexEvadeTarget: 0,
      lowEvade: 0,
      lowEvadeTarget: 0,
      midEvade: 0,
      midEvadeTarget: 0,
      bEvade: 0,
      bEvadeTarget: 0,
      fEvade: 0,
      fEvadeTarget: 0,
      sEvade: 0,
      sEvadeTarget: 0,
    };
  }

  /** rig 在标准二至四阶上活动;其它拼图/关开关时传 null。 */
  attachCube(cube: HandsCubeLike | null): void {
    if (this.cube === cube) return;
    this.thumbReferenceSeated = false;
    this.thumbTapCount = 0;
    this.thumbTapElapsed = 0;
    this.thumbTapReach = 0;
    this.thumbGripClearance = 0;
    if (this.hands && cube && cube.order !== this.cube?.order) {
      this.hands.R.home = homeRight(cube.order);
      this.hands.L.home = homeLeft(cube.order);
    }
    this.detachHalfTurnDirection();
    this.cube = cube;
    if (cube?.twister) {
      cube.twister.halfTurnDirection = this.animatedHalfTurnDirection;
      cube.twister.strokeEasing = this.strokeEasing;
    }
    this.active = null;
    this.resetGrips();
    if (this.hands && cube?.order === 3) {
      this.applyHand('R', false);
      this.restorePinchFingers = capturePinchFingers(this.hands.R.model);
    }
    this.captureFourHome();
  }

  /** 握姿全清回 home(挂/摘 cube 或瞬时跳步前的硬复位)。 */
  private resetGrips(): void {
    this.setGrips(HandsRig._qIdent, HandsRig._qIdent);
  }

  /**
   * 换握(动画):手 slerp 到指定握姿基座 —— 解法框记号 ↑/↓/· 驱动。
   * side 缺省 = 双手;单手记号(FINGERTRICKS §2 空格规则)只动指定手。
   * 把「当前显示偏移 ∘ 旧 grip」折算成相对新 grip 的回位余量,切换瞬间画面连续。
   */
  regrip(name: GripName, only?: HandSide, wristAngle = gripWristAngle(name), reason?: 'stroke-return' | 'stroke-seat'): void {
    this.pocketPushTarget = 0;
    if (!only || only === this.singleMarkSeat?.hand) this.singleMarkSeat = null;
    if (only !== 'R') this.leftRelaySeat = null;
    if (this.fourSeat) this.fourSeat.returning = true;
    if (this.wideSupport && !(reason === 'stroke-seat' && this.wideSupport.hand !== only)) this.wideSupport.returning = true;
    this.supportTransition = null;
    const halfDirection = name === 'halfDown' ? 'down' : 'up';
    this.markedMotion = null;
    this.markedProblem = null;
    this.releaseRUPreparation();
    const target = gripQuat(name);
    const hands = this.hands;
    if (!hands) {
      for (const side of only ? [only] : (["R", "L"] as const)) {
        this.pendingGrips[side].copy(target);
        this.pendingWristAngles[side] = wristAngle;
      }
      return;
    }
    this.settleCompletedGesture();
    const q = HandsRig._qTmp;
    const neutralHandoff = this.isLateralHandoff(hands.R)
      && Math.abs(hands.R.gripAngle) < .01 && Math.abs(hands.L.gripAngle) < .01;
    let any = false;
    for (const side of only ? [only] : (["R", "L"] as const)) {
      const h = hands[side];
      const wristStart = this.currentWristAngle(h);
      h.halfThumbReturn = 0;
      h.halfSeatRelease = undefined;
      h.regripArmWeight = h.appliedArmWeight;
      if (h.weldAxis) {
        q.setFromAxisAngle(AXIS_VEC[h.weldAxis], h.weldAngle);
      } else if (h.recoverT < 1) {
        this.recoverOrientation(q, h, neutralHandoff);
      } else {
        q.identity();
      }
      q.multiply(h.grip).multiply(HandsRig._qTmp2.copy(target).invert());
      // At exactly 180° both slerp arcs are equally short. A full wrist turn
      // leaves an equivalent -identity with floating-point residue, which can
      // select the opposite arc. ↑↑ goes via up (R2 / L′2), ↓↓ via down.
      if ((name === 'half' || name === 'halfDown') && Math.abs(q.w) < 1e-8 && Math.hypot(q.y, q.z) < 1e-8) {
        q.set(halfDirection === 'down' ? -1 : 1, 0, 0, 0);
      }
      h.grip.copy(target);
      h.gripAngle = wristAngle;
      h.recoverWristAngle = wristStart - h.gripAngle;
      h.weldAxis = null;
      h.weldAngle = 0;
      h.weldRawAngle = 0;
      h.weldWhole = false;
      if (q.angleTo(HandsRig._qIdent) < 0.01 && Math.abs(h.recoverWristAngle) < 0.01) {
        h.recoverT = 1; // 已在目标握姿,免 300ms 空转(播放循环靠 isRegripping 闸步)
        continue;
      }
      h.recoverQuat.copy(q);
      h.recoverT = 0;
      any = true;
    }
    if (any) {
      this.wholeRegrip = false;
      this.regripFlag = true;
      this.lastActivityAt = performance.now();
    }
    this.emitDiagnostic('grip-request', { name, ...(reason && { reason }), sides: only ? [only] : ['R', 'L'], ...((name === 'half' || name === 'halfDown') ? { halfDirection } : {}) });
  }

  /** 瞬时设定两手握姿基座(跳步 / 拖进度条的静态摆位,配 simulateGrips)。 */
  setGrips(qR: THREE.Quaternion, qL: THREE.Quaternion, wristAngles?: Record<HandSide, number>, homePush = false): void {
    this.pocketPushSupport = this.pocketPushTarget = Number(homePush && this.cube?.order === 2
      && qR.angleTo(HandsRig._qIdent) < .01 && qL.angleTo(HandsRig._qIdent) < .01);
    this.rightPinch = null;
    this.fourSeat = null;
    this.wideSupport = null;
    this.supportTransition = null;
    this.body?.resetPlacement();
    this.wholeRegrip = false;
    this.markedMotion = null;
    this.markedProblem = null;
    this.ruPreparation = null;
    this.singleMarkSeat = null;
    this.emitDiagnostic('reset');
    this.leftRelaySeat = null;
    this.pendingWristAngles.R = wristAngles?.R ?? wristAngleOf(qR);
    this.pendingWristAngles.L = wristAngles?.L ?? wristAngleOf(qL);
    this.pendingGrips.R.copy(qR);
    this.pendingGrips.L.copy(qL);
    this.active = null;
    this.pendingHint = null;
    this.regripFlag = false;
    this.lastActivityAt = performance.now();
    const hands = this.hands;
    if (!hands) return;
    hands.R.grip.copy(this.pendingGrips.R);
    hands.L.grip.copy(this.pendingGrips.L);
    for (const side of ["R", "L"] as const) {
      const h = hands[side];
      h.recoverT = 1;
      h.forearmRotation.reset();
      this.settledHalf[side] = null;
      h.gripAngle = this.pendingWristAngles[side];
      h.strokeLayers = [];
      h.halfThumbReturn = 0;
      h.halfSeatRelease = undefined;
      h.recoverWristAngle = 0;
      h.appliedArmWeight = halfGripWeight(2 * Math.acos(Math.min(1, Math.abs(h.grip.w))));
      h.regripArmWeight = h.appliedArmWeight;
      h.weldAxis = null;
      h.weldAngle = 0;
      h.weldRawAngle = 0;
      h.weldWhole = false;
      h.flickFinger = null;
      h.flickFinger2 = null;
      h.flickAxis = null;
      h.flickLayer = null;
      h.flickStyle = null;
      h.flickAmount = 0;
      h.flickDecay = 0;
      h.reachT = 0;
      h.reachTarget = 0;
      h.pinFinger = null;
      h.pinReachT = 0;
      h.pinReachTarget = 0;
      h.indexEvade = 0;
      h.indexEvadeTarget = 0;
      h.lowEvade = 0;
      h.lowEvadeTarget = 0;
      h.midEvade = 0;
      h.midEvadeTarget = 0;
      h.bEvade = 0;
      h.bEvadeTarget = 0;
      h.fEvade = 0;
      h.fEvadeTarget = 0;
      h.sEvade = 0;
      h.sEvadeTarget = 0;
    }
    this.regripFlag = false;
    this.emitDiagnostic('grip-set');
  }

  /** 换握动画进行中(播放循环用它闸住下一步;普通 weld 回位不算)。 */
  get isRegripping(): boolean {
    return this.enabled && this.regripFlag;
  }

  /** 播放轮询可能先于下一渲染帧，先提交已 drop 的手势再选下一招。 */
  private settleCompletedGesture(): void {
    if (!this.active || !this.cube) return;
    if (!Object.values(this.cube.table.groups).every(groups => groups.every(group => group.angle === 0))) return;
    this.endGesture();
    this.active = null;
  }

  /** Called after the cube unlocks. Its last layer can already be baked
   * while the hand rig still has the last displayed pose. */
  waitForRegrip(): boolean {
    this.settleCompletedGesture();
    return this.isRegripping || this.isReachRetreating;
  }

  // A pocket cube has no stationary middle row. Seat both middle fingers
  // outside the swept corners once and retain the seat between marked pushes.
  private pocketPushSupport = 0;
  private pocketPushTarget = 0;

  /** 转前提示(prepareTwist 登记,tick 建手势时按 (axis,cls,dir) 匹配消费):
   *  quarters ≥2 才连拨、push 表示 U/D 单转的显式推法。3s 过期防陈旧提示污染后续拖拽。 */
  private pendingHint: { axis: Axis; cls: LayerClass; layers: readonly number[]; dir: 1 | -1; quarters: number; push: boolean; nail: boolean; thumb: boolean; middleRelay: boolean; explicit: boolean; indexHook: boolean; homeStroke?: HomeStroke; at: number } | null = null;

  private takeHint(axis: Axis, cls: LayerClass, layers: number[], dir: 1 | -1): TwistHint | undefined {
    const hint = this.pendingHint;
    if (!hint || performance.now() - hint.at > 3000) return undefined;
    if (hint.axis !== axis || hint.cls !== cls || !sameLayers(hint.layers, layers) || hint.dir !== dir) return undefined;
    this.pendingHint = null;
    return { homeStroke: hint.homeStroke, quarters: hint.quarters, push: hint.push, nail: hint.nail, thumb: hint.thumb, middleRelay: hint.middleRelay };
  }

  /** 两手握姿名判读(grip 是精确四分转积,阈值只兜浮点;非标准积 = null)。 */
  gripNames(): HandGripNames {
    const hands = this.hands;
    if (!hands) return { R: null, L: null };
    return { R: settledGripName(hands.R.grip, hands.R.gripAngle), L: settledGripName(hands.L.grip, hands.L.gripAngle) };
  }

  /** 该手势是否走「前置伸指」(转动开始前指尖先到位;FINGERTRICKS §4.5/§4.2):
   *  topPush(F 族越顶 / S 族中层下按)/ upPush（就位于左右侧面上排）/ D2' 首指小指伸至 D 层。 */
  private static needsReach(g: HandGesture): boolean {
    if (g.kind !== "flick") return false;
    return g.style === 'frontIndexNail' || g.style === 'frontThumbNail' || g.style === 'upperRingRelay' || g.style === 'lowerPush' || g.style === 'lowerHook' || g.style === 'pocketThumbLift' || g.style === "reverseIndexHook" || g.style === "reverseRingHook" || isMiddleSliceStroke(g.style) || isMixedPush(g.style) || g.style === "topPush" || g.style === "upPush" || (g.style === "hook" && g.finger === "pinky");
  }

  private placeWideSupport(axis: Axis, high: boolean, g: HandGesture, homeUpper = false): WideSupport {
    const hand = (g.kind === 'weld' ? g.hands[0] : g.hand) === 'R' ? 'L' : 'R';
    const current = this.wideSupport;
    if (current?.hand === hand && current.axis === axis && current.high === high && current.homeUpper === homeUpper && !current.returning) return current;
    this.updateWorldMatrix(true, true);
    const h = this.hands![hand];
    const order = this.cube?.order ?? 3;
    const { anchors, travel } = inspectWideGrip(h.model, this.matrixWorld.clone().invert(), axis, high ? -1 : 1, order);
    return this.wideSupport = new WideSupport(axis, high, hand, h.grip, anchors, travel, this.gripNames()[hand], order, homeUpper);
  }

  /** Detached snapshots in cube axes; safe to retain after turning or seeking. */
  readHandGeometry() {
    const hands = this.hands;
    if (!hands) return null;
    this.updateWorldMatrix(true, true);
    const scale = (this.cube?.order ?? 3) / 3;
    const toCube = new THREE.Matrix4().makeScale(scale, scale, scale)
      .multiply(this.matrixWorld.clone().invert());
    const grips = this.gripNames();
    const read = (side: HandSide) => {
      const h = hands[side];
      const palm = toCube.clone().multiply(h.model.group.matrixWorld);
      return { grip: grips[side], wristAngle: this.currentWristAngle(h),
        position: new THREE.Vector3().setFromMatrixPosition(palm),
        quaternion: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(palm)),
        fingers: handBearings(h.model, toCube) };
    };
    return { L: read('L'), R: read('R') };
  }

  private createMarkedMotion(request: MarkedTurnRequest): MarkedFingerMotion | null {
    const hands = this.hands;
    if (!hands || request.layers.length === 1 && this.cube?.order !== 3) return null;
    this.updateWorldMatrix(true, true);
    const toCube = this.matrixWorld.clone().invert();
    const bearings = { L: handBearings(hands.L.model, toCube), R: handBearings(hands.R.model, toCube) };
    const home = {} as Record<HandSide, Record<FingerName, number[]>>;
    for (const side of ['L', 'R'] as const) {
      home[side] = {} as Record<FingerName, number[]>;
      for (const finger of ['thumb', 'index', 'middle', 'ring', 'pinky'] as const) {
        home[side][finger] = fingerChannels(hands[side].home.fingers[finger]);
      }
    }
    const plan = chooseMarkedFingerPlan(request, MARKED_FINGER_PROFILES,
      { L: hands.L.grip, R: hands.R.grip }, bearings);
    return plan ? new MarkedFingerMotion(plan, home, MARKED_CLEARANCE) : null;
  }

  /**
   * 播放前置伸指 + 转前提示:登记 (quarters, push) 提示(连拨 / 推法分类用),
   * 该转动若需前置就位(needsReach),启动/继续伸指动画并返回「还需等待」——
   * 调用方本轮不发 twist,等 isReachPreparing 落 false 再转。返回 false =
   * 无需前置或已到位。幂等,播放循环可 16ms 轮询重入。
   */
  prepareTwist(axis: Axis, layers: number[], dir: 1 | -1, quarters = 1, push = false, pin?: PinSpec, nextIsU = false, annotation?: FingerAnnotation, nextSupport?: MarkedTurnRequest | 'right-weld' | 'left-weld', explicitPath = false): boolean {
    const hands = this.hands;
    const cube = this.cube;
    if (!cube || !this.enabled || this.disposed || this.loadedHands === 'left-thumb') return false;
    const explicit = !!(push || pin || annotation?.finger || annotation?.contact || explicitPath);
    if (!hands) {
      if (this.loadState.hands !== 'error') return true;
      this.markedProblem = explicit ? 'model-unavailable' : null;
      return explicit;
    }
    this.settleCompletedGesture();
    if (!explicit && this.rightPinch?.driver(axis, layers, dir)) {
      this.pendingHint = null;
      return false;
    }
    const grips = this.gripNames();
    if (quarters === 2 && layers.length === 1) {
      // Both ordinary M half turns use the back-pad relay once the left wrist
      // can seat at home. The twister must choose the same arc as preflight.
      if (!explicit && cube.order === 3 && axis === 'x' && layers[0] === 1 && grips.L && grips.R) dir = 1;
      else if (axis === 'x' || (cube.twister && !explicit)) dir = this.preferredHalfTurnDirection(axis, layers[0]) ?? dir;
    }
    if (this.isRegripping || this.isReachRetreating) return true;
    const leftHalfTurn = !explicit && axis === 'y' && layers.length === 1 && layers[0] === cube.order - 1
      && quarters === 2 && dir === -1;
    if (cube.twister && leftHalfTurn && !this.singleMarkSeat?.homeStroke && this.seatLeftForRelay(grips)) return true;
    // Playback can be paused or edited during preparation, before U2 starts.
    if (this.leftRelaySeat && !leftHalfTurn && !this.active) {
      this.regrip(this.leftRelaySeat.original, 'L', this.leftRelaySeat.wristAngle);
      return true;
    }
    const weldHand = axis === 'x' && layers.length === 1
      ? layers[0] === cube.order - 1 ? 'R' : layers[0] === 0 ? 'L' : null : null;
    const transition = this.supportTransition;
    const cls = classifyLayers(layers, cube.order);
    const evenFront = isEvenFrontQuarter(cube.order, axis, layers, quarters);
    const evenMark = !pin && !explicitPath && !push ? evenMarkedStroke(cube.order, axis, layers, dir, quarters, annotation) : undefined;
    const markedEven = evenMarkFitsGrip(evenMark, cube.order, dir, grips);
    const markedThumb = markedEven && evenMark === 'frontThumb';
    const pocketRelay = evenMark === 'upperRelay' && cube.order === 2;
    const upperHand = dir > 0 ? 'R' : 'L';
    const oppositeUpperHand = upperHand === 'R' ? 'L' : 'R';
    if (cube.order !== 3 && !markedEven && (annotation?.finger || annotation?.contact || pin || explicitPath)) {
      this.pendingHint = null;
      this.markedProblem = 'unsupported-grip';
      return true;
    }
    const nail = annotation?.contact === 'nail' && !annotation.finger;
    const readyPush = push && axis === 'y' && isPushOrder(cube.order) && layers.length === 1 && quarters === 1
      && grips.R === 'home' && grips.L === 'home'
      && pushRules.some(rule => rule.layer === cls && rule.dir === dir);
    if ((push && (!readyPush || explicitPath || pin || annotation?.finger || annotation?.contact))
      || (explicitPath && (!pin || grips[pin.hand] !== 'home' || annotation?.finger || annotation?.contact))) {
      this.pendingHint = null;
      this.markedProblem = 'unsupported-grip';
      return true;
    }
    this.pocketPushTarget = Number(cube.order === 2 && readyPush);
    if (this.pocketPushSupport !== this.pocketPushTarget) return true;
    const thumb = annotation?.finger === 'thumb' && !annotation.contact;
    const basic = (grip: GripName | null) => grip === 'home' || grip === 'up' || grip === 'down';
    const seat = this.singleMarkSeat;
    let singleMark: MixedPush | 'topPush' | null = null;
    if (cube.order === 3 && axis === 'z' && layers.length === 1
      && basic(grips.L) && basic(grips.R) && !push && !pin && !explicitPath) {
      if (thumb && quarters === 1 && cls === 'high') singleMark = 'thumbLift';
      if (nail && cls === 'mid' && (quarters === 1 || quarters === 2)) singleMark = quarters === 2 ? 'sliceNailDouble' : 'sliceNail';
      // Ordinary S prefers an existing home grip. With neither hand seated,
      // prepare the usual U5/U3 index-pad stroke and restore that wrist afterwards.
      if (!explicit && quarters === 1 && cls === 'mid' && ((grips.L !== 'home' && grips.R !== 'home') || seat?.style === 'topPush')) {
        singleMark = 'topPush';
      }
    }
    const mixedUpper = cube.order === 3 && axis === 'y' && cls === 'high' && layers.length === 1
      && quarters === 1 && !explicit && grips[oppositeUpperHand] === 'up'
      && (grips[upperHand] === 'down' || seat?.style === 'indexHook' && seat.hand === upperHand);
    const markedUpper = cube.order === 3 && axis === 'y' && cls === 'high' && layers.length === 1 && (quarters === 1 || quarters === 2)
      && annotation?.finger === 'middle' && !annotation.contact && !push && !pin && !explicitPath && basic(grips.L) && basic(grips.R);
    const middleRelay = markedUpper && quarters === 2;
    // During repeated preflight calls the temporary seat already owns the
    // active wrist. Compare against its entry grip until the stroke finishes.
    const entry = seat?.homeStroke ? { ...grips, [seat.hand]: seat.original } : grips;
    let ordinary = planHomeStroke(cube.order, entry, axis, layers, dir, quarters);
    if (pocketRelay) {
      ordinary = { grip: 'up', gesture: { kind: 'flick', hand: upperHand, finger: 'index', finger2: 'middle', style: 'topPush' } };
    }
    if (evenFront && (markedThumb || !explicit && (ordinary || entry.L === 'down' && entry.R === 'down'))) {
      const cached = seat?.selection?.dir === dir && seat.selection.thumbOnly === markedThumb ? seat.selection.stroke : (this.pendingHint?.axis === axis && this.pendingHint.dir === dir
        && this.pendingHint.quarters === quarters && this.pendingHint.explicit === explicit && sameLayers(this.pendingHint.layers, layers)
        ? this.pendingHint.homeStroke : undefined);
      if (cached?.candidates && (!markedThumb || cached.gesture.finger === 'thumb')) ordinary = cached;
      else {
        this.updateWorldMatrix(true, true);
        const inverse = this.matrixWorld.clone().invert();
        ordinary = frontCornerStroke(cube.order as 2 | 4, dir, entry,
          { L: handBearings(hands.L.model, inverse), R: handBearings(hands.R.model, inverse) }, markedThumb);
      }
    }
    const wide = (cube.order === 3 && layers.length === 2 || cube.order === 4 && layers.length === 3) && (cls === 'high' || cls === 'low');
    let automatic: MarkedFingerMotion | null = null;
    if (wide && cube.order === 3 && !explicit && !seat?.homeStroke && !ordinary?.slideUpper && axis !== 'x' && quarters === 1) {
      const candidate: MarkedTurnRequest = { axis, layers, dir, quarters, annotation: {}, automatic: true };
      const current = this.markedMotion;
      automatic = current?.matches(candidate) ? current : this.createMarkedMotion(candidate);
    }
    const stroke = (explicit && !markedEven) || automatic ? undefined : ordinary;
    const seatStyle = stroke?.gesture.style ?? (middleRelay ? 'downPush' : markedUpper ? 'marked' : mixedUpper ? 'indexHook' : singleMark);
    const hand = stroke?.gesture.hand ?? (mixedUpper || markedUpper || singleMark === 'topPush' ? upperHand : dir > 0 ? 'L' : 'R');
    if (seat && (seatStyle !== seat.style || hand !== seat.hand || !!seat.homeStroke !== !!stroke
      || stroke && grips[hand] !== stroke.grip) && !this.active) {
      hands[seat.hand].reachTarget = 0;
      if (seat.style === 'marked') this.markedMotion?.finish();
      seat.returning = true;
      return true;
    }
    if (cube.order === 3 && axis === 'y' && layers.length === 1 && cls === 'high'
      && annotation?.finger === 'middle' && !markedUpper) {
      this.markedProblem = 'unsupported-grip';
      return true;
    }
    if (ordinary && (pin || explicitPath)) {
      this.pendingHint = null;
      // These flicks have no FTN pin trajectory. Keep the
      // written constraint visible to the player instead of borrowing a flick.
      this.markedProblem = 'unsupported-grip';
      return true;
    }
    if (seatStyle) {
      const target = stroke?.grip ?? (seatStyle === 'thumbLift' ? 'down' : 'home');
      if (grips[hand] !== target) {
        const original = grips[hand]!, wristAngle = hands[hand].gripAngle;
        if (wide && stroke && this.placeWideSupport(axis, cls === 'high', stroke.gesture).progress < 1) return true;
        this.regrip(target, hand, gripWristAngle(target), 'stroke-seat');
        this.singleMarkSeat = { hand, original, wristAngle, style: seatStyle, homeStroke: !!stroke,
          selection: stroke?.candidates ? { dir, thumbOnly: markedThumb, stroke } : undefined, returning: false };
        return true;
      }
    }
    const nailHint = nail && !markedEven && (quarters !== 2 || singleMark === 'sliceNailDouble' || axis === 'y' && cls === 'high' && cube.order === 3);
    const g = gestureForLayers(axis, layers, dir, grips, { homeStroke: stroke, quarters, push, nail: nailHint, thumb: singleMark === 'thumbLift', middleRelay }, cube.order);
    const nativeMark = markedEven || g.kind === 'flick' && (middleRelay && g.finger2 === 'middle' || nail && (g.style === 'markedRingNail' || isSliceNail(g.style) || g.style === 'upPush' || g.style === 'upperRingRelay' || g.style === 'frontIndexNail' || g.style === 'frontThumbNail') || singleMark === 'thumbLift' && g.style === 'thumbLift');
    const marked = !!(annotation?.finger || annotation?.contact) && !nativeMark;
    const request = marked && annotation ? { axis, layers, dir, quarters, annotation } : automatic?.plan.request ?? null;
    if (!this.ruPreparation) {
      for (const side of ['L', 'R'] as const) {
        const h = hands[side];
        if (h.reachTarget !== 1 || (h.flickAxis !== 'z' && h.flickStyle !== 'lowerHook') || h.flickDecay || this.active?.gesture) continue;
        if (!request && g.kind === 'flick' && g.hand === side && h.flickStyle === g.style
          && h.flickAxis === axis && h.flickLayer === cls
          && (h.flickStyle !== 'lowerHook' || h.flickFinger === g.finger && h.flickFinger2 === (g.finger2 ?? null))) continue;
        h.reachTarget = 0;
        if (h.reachT > 0) return true;
      }
    }
    const driver = automatic?.plan.hand ?? (g.kind === 'weld' ? g.hands[0] : g.hand);
    const supportGrip = grips[driver === 'L' ? 'R' : 'L'];
    const pocketSupport = !explicit && isPocketLowerRelay(cube.order, axis, cls, g, supportGrip);
    if (this.wideSupport && (!(wide || pocketSupport) || marked || this.wideSupport.hand === driver
      || this.wideSupport.axis !== axis || this.wideSupport.high !== (cls === 'high'))) {
      this.wideSupport.returning = true;
      if (this.wideSupport.moves && this.wideSupport.progress > 0) return true;
      this.wideSupport = null;
    }
    const pinchEntry = weldHand && dir === -1 && quarters === 2 && !marked
      && nextSupport && typeof nextSupport !== 'string' && grips[weldHand] === 'home';
    if (transition && transition.motion.topPinch !== null) {
      const entering = pinchEntry && transition.motion.matches(nextSupport);
      const continuing = request && transition.motion.matches(request) && grips[transition.motion.plan.hand === 'L' ? 'R' : 'L'] === 'halfDown';
      if (transition.releasing || !entering && !continuing) {
        transition.motion.finish();
        transition.releasing = true;
        return true;
      }
    }
    if (transition && !weldHand && !marked && !transition.motion.finished) transition.motion.finish();
    if (transition?.motion.finished && !weldHand) {
      transition.releasing = true;
      return true;
    }
    if (cube.order === 3 && weldHand && !marked && nextSupport && typeof nextSupport !== 'string' && !transition) {
      const preview = this.createMarkedMotion(nextSupport);
      if (preview && !preview.plan.profile.singleUpper && preview.plan.hand !== weldHand && preview.plan.profile.finger === 'middle') {
        if (pinchEntry && preview.plan.profile.id === 'middle-pad-wide') preview.topPinch = 0;
        this.supportTransition = { motion: preview, weldRadians: quarters * HALF_PI, releasing: false };
      }
    }
    if (pinchEntry && this.supportTransition?.motion.preparingPinch) return true;
    if (request) {
      this.releaseRUPreparation();
      if (Object.values(hands).some(h => h.flickDecay > 0 || h.reachT > 0 || h.pinReachT > 0)) return true;
      const current = this.markedMotion;
      if (!current?.matches(request)) {
        if (current) { current.finish(); return true; }
        const motion = automatic ?? this.createMarkedMotion(request);
        this.markedProblem = motion ? null : 'unsupported-grip';
        if (!motion) return true;
        motion.supportReady = transition?.motion.plan.profile === motion.plan.profile && !transition.motion.finished;
        if (motion.supportReady) motion.topPinch = transition!.motion.topPinch;
        motion.holdSupport = !motion.plan.profile.singleUpper && motion.plan.profile.finger === 'middle'
          && nextSupport === (motion.plan.hand === 'L' ? 'right-weld' : 'left-weld');
        this.supportTransition = null;
        this.pendingHint = null;
        this.markedMotion = motion;
      }
      const motion = this.markedMotion!;
      this.lastActivityAt = performance.now();
      if (automatic) {
        const support = this.placeWideSupport(axis, cls === 'high',
          { kind: 'flick', hand: motion.plan.hand, finger: motion.plan.profile.finger });
        if (support.progress < 1) return true;
      }
      if (motion.preparing) return true;
      const contact = markedStartContact(hands[motion.plan.hand].model, this, motion.plan);
      this.markedProblem = !contact || contact.distance > 3 || contact.facing > -.9 ? 'invalid-start' : null;
      return this.markedProblem !== null;
    }
    this.markedProblem = null;
    if (this.markedMotion) { this.markedMotion.finish(); return true; }
    const single = layers.length === 1 && layers[0] === cube.order - 1
      && dir === 1 && quarters === 1 && !push && !pin;
    const prepareRU = single && axis === 'x' && nextIsU && this.gripNames().R === 'home';
    const continueRU = single && axis === 'y' && this.gripNames().R === 'up';
    if (this.ruPreparation && !prepareRU && !continueRU) {
      this.releaseRUPreparation();
      return this.isReachRetreating;
    }
    this.pendingHint = { homeStroke: stroke, axis, cls, layers, dir, quarters, push, nail: nailHint, thumb: singleMark === 'thumbLift', middleRelay, explicit, indexHook: g.kind === "flick" && g.style === "indexHook", at: performance.now() };
    // U 族接续闸(2026-07-09 U2' 镜像连拨):对侧手上一步 U 族 hook(钉角端姿)
    // 的回撤未完时,下一步 y.high 必须等 —— 回撤走廊在 U 带扫掠环带内侧
    // (半径 ~107U < 96√2),层再次转动会犁到回撤中的指链(真实播放 oracle
    // U2'→U'p 实测 11U;F/S 族「decay 段吃 evade」先例是小幅姿态可解,这里
    // 是结构性重叠只能等,decay ≤ RECOVER_MS)。同手接续也等原有回撤结束，
    // 避免 beginGesture 清零幅度使指尖瞬跳；无冲突的对侧手仍可接续。
    const actingHands = g.kind === 'weld' ? g.hands : [g.hand];
    if (actingHands.some(side => hands[side].flickDecay > 0)) {
      this.lastActivityAt = performance.now();
      return true;
    }
    if (prepareRU) {
      // 只提前摆指，R 仍使用原有整手随层转动；reach 保持到下一步 U。
      this.ruPreparation = 'preparing';
      const h = hands.R;
      h.flickFinger = 'index'; h.flickFinger2 = null;
      h.flickStyle = 'topPush'; h.flickAxis = 'y';
      h.flickLayer = 'high';
      h.flickAmount = 0; h.flickDecay = 0; h.reachTarget = 1;
      this.lastActivityAt = performance.now();
      return h.reachT < 1;
    }
    if (continueRU) this.ruPreparation = null;
    if (axis === "y" && cls === "high" && g.kind === "flick") {
      const other = hands[g.hand === "R" ? "L" : "R"];
      if (other.flickDecay > 0 && other.flickAxis === "y" && (other.flickStyle === "hook" || other.flickStyle === "indexHook") && other.flickFinger === "index") {
        this.lastActivityAt = performance.now();
        return true;
      }
    }
    // FTN @pin(§7,首例 R[R2:@C]):weld 前置贴块钉指 —— 指尖先到贴纸再转,
    // weld 段随手刚体转。仅编排已标定组合(WELD_PIN 有值);上一钉指收指未完
    // 先等(同 reach 收指闸语义,防 weld 把收回中的指链烘着转)。
    if (pin && g.kind === "weld" && g.hands.includes(pin.hand) && WELD_PIN[pin.hand][pin.finger]) {
      const h = hands[pin.hand];
      if (h.pinReachT > 0 && h.pinReachTarget === 0) {
        this.lastActivityAt = performance.now();
        return true;
      }
      h.pinFinger = pin.finger;
      h.pinReachTarget = 1;
      this.lastActivityAt = performance.now();
      return h.pinReachT < 1;
    }
    const widePreparing = (wide || pocketSupport) && this.placeWideSupport(axis, cls === 'high', g, stroke?.slideUpper).progress < 1;
    const fourPreparing = cube.order === 4 && !push && cls !== 'whole' && this.seatFour(axis, layers, dir, g).progress < 1;
    const waitingForSupport = widePreparing || fourPreparing;
    if (!HandsRig.needsReach(g) || g.kind !== "flick") {
      if (cube.order === 3 && axis === 'y' && layers.length === 1 && layers[0] === 2 && dir === 1 && quarters === 1
        && !push && !pin && g.kind === 'flick' && g.hand === 'R' && !g.finger2 && g.finger === 'index') {
        this.emitDiagnostic('prepare-u', undefined, g);
      }
      return waitingForSupport;
    }
    const h = hands[g.hand];
    // Retract before changing sticker, contact surface, or relay partner.
    if (h.reachT > 0 && h.reachTarget === 1 && (h.flickStyle === 'topPush' || isMixedPush(h.flickStyle) || isMiddleSliceStroke(h.flickStyle))
      && (h.flickAxis !== axis || h.flickLayer !== cls || h.flickStyle !== g.style
        || isMiddleSliceStroke(g.style) && h.flickFinger2 !== (g.finger2 ?? null))) {
      h.reachTarget = 0;
      this.lastActivityAt = performance.now();
      return true;
    }
    if (h.flickDecay > 0 && h.reachT > 0) {
      // 上一转的退场未完:清 flickAmount 会让手指从弧中段瞬移。轮询重入
      // 等 decay 走完(届时 reachT 仍为 1,下一轮直接从按压位起推)。
      this.lastActivityAt = performance.now();
      return true;
    }
    h.strokeLayers = layers;
    h.flickFinger = g.finger;
    h.flickFinger2 = g.finger2 ?? null;
    h.flickAxis = axis;
    h.flickLayer = cls;
    h.flickStyle = g.style ?? null;
    h.flickAmount = 0;
    h.flickDecay = 0;
    h.reachTarget = 1;
    this.lastActivityAt = performance.now();
    if (h.reachT === 1 && single && axis === 'y' && g.hand === 'R' && g.finger === 'index') {
      this.emitDiagnostic('prepare-u', undefined, g);
    }
    return waitingForSupport || h.reachT < 1;
  }

  /** 标定入口:编排参数的活引用(浏览器坐标下降现场改,数值烘回源码)。 */
  get tuning(): {
    push: typeof TOP_PUSH; follow: typeof TOP_PUSH_FOLLOW; frontFollow: typeof FRONT_INDEX_FOLLOW;
    hook: typeof HOOK; hookFollow: typeof HOOK_FOLLOW; hookPrep: typeof HOOK_PREP;
    pinkyReach: typeof PINKY_REACH; downPush: typeof DOWN_PUSH;
    backEvade: typeof BACK_EVADE;
    hookIndexEvade: typeof HOOK_INDEX_EVADE; lowEvade: typeof LOW_EVADE;
    midEvade: typeof MID_EVADE; bEvade: typeof B_EVADE; fEvade: typeof F_EVADE;
    sEvade: typeof S_EVADE;
    retreatLift: typeof RETREAT_LIFT; retreatLiftStyled: typeof RETREAT_LIFT_STYLED;
    hookExit: typeof HOOK_EXIT; backExit: typeof BACK_EXIT; downExit: typeof DOWN_EXIT;
    weldPin: typeof WELD_PIN; weldPinTransit: typeof WELD_PIN_TRANSIT;
  } {
    return {
      push: TOP_PUSH, follow: TOP_PUSH_FOLLOW, frontFollow: FRONT_INDEX_FOLLOW,
      hook: HOOK, hookFollow: HOOK_FOLLOW, hookPrep: HOOK_PREP,
      pinkyReach: PINKY_REACH, downPush: DOWN_PUSH,
      backEvade: BACK_EVADE,
      hookIndexEvade: HOOK_INDEX_EVADE, lowEvade: LOW_EVADE,
      midEvade: MID_EVADE, bEvade: B_EVADE, fEvade: F_EVADE,
      sEvade: S_EVADE,
      retreatLift: RETREAT_LIFT, retreatLiftStyled: RETREAT_LIFT_STYLED,
      hookExit: HOOK_EXIT, backExit: BACK_EXIT, downExit: DOWN_EXIT,
      weldPin: WELD_PIN, weldPinTransit: WELD_PIN_TRANSIT,
    };
  }

  /** 前置伸指进行中(播放循环闸步,与 isRegripping 同款;手关着恒 false)。 */
  get isReachPreparing(): boolean {
    const hands = this.hands;
    if (!hands || !this.enabled) return false;
    if (this.pocketPushSupport !== this.pocketPushTarget) return true;
    if (this.fourSeat && !this.fourSeat.returning && this.fourSeat.progress < 1) return true;
    if (this.supportTransition?.motion.preparingPinch) return true;
    if (this.wideSupport && !this.wideSupport.returning && this.wideSupport.progress < 1) return true;
    if (this.markedMotion?.preparing) return true;
    return (["R", "L"] as const).some((s) => {
      const h = hands[s];
      return (h.flickFinger !== null && h.reachTarget === 1 && h.reachT < 1)
        || (h.pinFinger !== null && h.pinReachTarget === 1 && h.pinReachT < 1);
    });
  }

  /** reach 式手势收指进行中:下一步(尤其 weld,R'/L 等会把整手烘着转)必须等
   *  指链撤回,否则伸在魔方上方的手指被腕转扫进方块(真实播放 oracle −11U,
   *  2026-07-08)。非 reach 的 hook 类回撤已是安全的关节直线(见 applyHand
   *  decayK 注释),不闸。 */
  get isReachRetreating(): boolean {
    const hands = this.hands;
    if (!hands || !this.enabled) return false;
    if (this.fourSeat?.returning && this.fourSeat.progress > 0) return true;
    if (this.wideSupport?.returning && this.wideSupport.moves && this.wideSupport.progress > 0) return true;
    if (this.markedMotion?.retreating || this.singleMarkSeat?.returning || this.leftRelaySeat?.returning) return true;
    return (["R", "L"] as const).some((s) => {
      const h = hands[s];
      // decay 段也算「收指未完」:reach 式手势 decay 结束必然接 walk-back,若只
      // 看 reachTarget,下一步会在 decay 期间放行,retreat 与 weld 叠加(oracle
      // 实测 R' 把回撤中的食指烘着转进方块 −11U)。
      return (h.flickAxis === 'y' && h.flickStyle === 'downPush' && h.flickDecay > 0)
        || (h.reachT > 0 && (h.reachTarget === 0 || h.flickDecay > 0))
        || (h.pinReachT > 0 && h.pinReachTarget === 0);
    });
  }

  setEnabled(on: boolean): void {
    if (this.disposed) return;
    if (!on && this.enabled) this.emitDiagnostic('disabled');
    if (!on) {
      this.rightPinch = null;
      const seat = this.singleMarkSeat;
      if (seat) this.regrip(seat.original, seat.hand, seat.wristAngle);
      if (this.leftRelaySeat) this.regrip(this.leftRelaySeat.original, 'L', this.leftRelaySeat.wristAngle);
      this.fourSeat = null;
      this.wideSupport = null;
      this.supportTransition = null;
      this.releaseRUPreparation();
      this.markedMotion = null;
      this.markedProblem = null;
    }
    // visible 无条件跟 on 拉起(不能挂在 enabled-diff 后面:dt=0 帧曾把
    // visible 误置 false,若 enabled 未变就再也拉不起来)。
    if (on) this.visible = true;
    if (this.enabled === on) return;
    this.enabled = on;
    this.lastActivityAt = 0; // 让 tick 重新计 keepalive
    for (const mat of this.fadeMats()) {
      mat.transparent = true; // 渐变期间开启;fade 达到 1 后关掉(省排序)
    }
  }

  private seatLeftForRelay(grips: HandGripNames): boolean {
    const order = this.cube?.order;
    if (!order || order < 2 || order > 4 || !prefersLeftUpperRelay(grips)
      || !grips.L || grips.L === 'home' || order === 2 && grips.L === 'up') return false;
    const wristAngle = this.hands!.L.gripAngle;
    this.regrip('home', 'L');
    this.leftRelaySeat = { original: grips.L, wristAngle, returning: false };
    return true;
  }

  private preferredHalfTurnDirection(axis: string, layer: number): 1 | -1 | undefined {
    if (!this.isEnabled || !this.cube) return undefined;
    const { order } = this.cube;
    const current = this.gripNames(), seat = this.singleMarkSeat;
    const grips = seat?.homeStroke ? { ...current, [seat.hand]: seat.original } : current;
    if (axis === 'y' && order >= 2 && order <= 4 && layer === order - 1) {
      return prefersLeftUpperRelay(grips) ? -1 : undefined;
    }
    if (axis !== 'x' || layer !== 1 || order !== 3) return undefined;
    const hint = this.pendingHint;
    const preparedRelay = hint?.homeStroke?.gesture.style === 'middleSlicePad'
      && hint.axis === 'x' && hint.cls === 'mid' && hint.quarters === 2;
    return preparedRelay || grips.L === 'home' && grips.R === 'home' ? 1 : undefined;
  }

  private readonly animatedHalfTurnDirection = (axis: string, layer: number): 1 | -1 | undefined => {
    if (!this.isEnabled) return undefined;
    // A queued keyboard turn may start between the preceding R/L drop and
    // the next rig tick. Commit that wrist before selecting the U arc.
    if (axis === 'y' && layer === (this.cube?.order ?? 0) - 1) {
      if (this.rightPinch?.driver('y', [layer], -1)) return undefined;
      this.settleCompletedGesture();
      const marked = this.markedMotion?.plan.request;
      if (marked?.quarters === 2 && marked.axis === axis && marked.layers.length === 1 && marked.layers[0] === layer) return undefined;
      const hint = this.pendingHint;
      if (hint?.explicit && hint.quarters === 2 && hint.axis === axis && hint.layers.length === 1 && hint.layers[0] === layer
        && performance.now() - hint.at < 3000) return undefined;
    }
    return this.preferredHalfTurnDirection(axis, layer);
  };

  private readonly strokeEasing = (axis: string, layers: readonly number[], twist: number) => {
    const order = this.cube?.order;
    if (!this.isEnabled || !this.hands || this.markedMotion || this.pendingHint?.explicit) return;
    // Both wrists travel with a whole half turn. Accelerate from rest and
    // settle at the far side in the same formula beat.
    if (layers.length === order && Math.abs(twist) === 2)
      return (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);
    if (axis !== 'x' || (order !== 3 && order !== 4)
      || layers.length !== order - 2 || layers.includes(0) || layers.includes(order - 1)) return;
    // Three-layer M2 uses the pad relay in either written direction.
    const relay = Math.abs(twist) === 2;
    if (relay && order === 4) return;
    return middleSliceTiming(order, twist, relay);
  };

  private detachHalfTurnDirection(): void {
    const twister = this.cube?.twister;
    if (twister?.halfTurnDirection === this.animatedHalfTurnDirection) twister.halfTurnDirection = undefined;
    if (twister?.strokeEasing === this.strokeEasing) twister.strokeEasing = undefined;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get hasPendingThumbTaps(): boolean {
    return this.thumbTapCount > 0;
  }

  queueReferenceThumbTaps(turns = 1): void {
    if (this.loadedHands === 'left-thumb' && this.enabled) this.thumbTapCount += turns;
  }

  private tickReferenceThumb(cube: HandsCubeLike, dt: number, holdOnSticker: boolean): boolean {
    const upper = cube.table.groups.y[cube.order - 1];
    const angle = upper?.angle ?? 0;
    const sweep = Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)) - 1;
    const clearance = THREE.MathUtils.clamp(sweep / .24, 0, 1);
    const still = !cube.twister?.backlog && !upper?.isDragging && !clearance;
    const holdAfterTap = still && holdOnSticker && this.thumbTapCount <= 1;
    let reach = holdAfterTap ? 1 : 0;
    let finished = false;
    if (this.thumbTapCount && still) {
      this.thumbTapElapsed += dt;
      const next = REFERENCE_THUMB_TAP.findIndex(([time]) => time > this.thumbTapElapsed);
      // On a match, finish the last pair at the second tap and keep its contact pose.
      if (next < 0 || (holdAfterTap && next === REFERENCE_THUMB_TAP.length - 1)) {
        this.thumbTapCount--;
        this.thumbTapElapsed = 0;
        finished = true;
      } else {
        const [start, from] = REFERENCE_THUMB_TAP[next - 1];
        const [end, to] = REFERENCE_THUMB_TAP[next];
        reach = THREE.MathUtils.lerp(from, to, THREE.MathUtils.smoothstep(this.thumbTapElapsed, start, end));
      }
    }
    if (this.thumbReferenceSeated && reach === this.thumbTapReach && clearance === this.thumbGripClearance) return finished;
    this.thumbReferenceSeated = true;
    this.thumbTapReach = reach;
    this.thumbGripClearance = clearance;
    this.applyHand('L', false);
    return true;
  }

  /** 每帧驱动;返回 true = 画面有变化需要重渲。 */
  tick(dtMs: number, holdReferenceThumb = false): boolean {
    if (!this.visible) return false;
    const dt = Math.min(dtMs, 100); // 掉帧保护
    let animating = false;

    // —— 淡入淡出 ——
    const fadeTarget = this.enabled ? 1 : 0;
    if (this.fade !== fadeTarget) {
      const step = dt / FADE_MS;
      this.fade = fadeTarget > this.fade ? Math.min(1, this.fade + step) : Math.max(0, this.fade - step);
      const eased = this.fade * this.fade * (3 - 2 * this.fade);
      for (const mat of [...this.fadeMats(), ...this.skelMats]) mat.opacity = eased;
      // 只在「淡出完成」隐藏 —— 淡入起点 fade=0 碰上 dt=0 帧不能误藏。
      if (this.fade === 0 && !this.enabled) this.visible = false;
      if (this.fade === 1) for (const mat of this.fadeMats()) mat.transparent = false;
      animating = true;
      this.lastActivityAt = performance.now();
    }
    if (!this.visible) return true;
    const hands = this.hands;
    if (!hands) return animating; // GLTF 加载中:fade 照走,姿态等模型
    if (this.loadedHands === 'left-thumb') {
      return (!!this.cube && this.tickReferenceThumb(this.cube, dt, holdReferenceThumb)) || animating;
    }
    if (this.pocketPushSupport !== this.pocketPushTarget) {
      const distance = this.pocketPushTarget - this.pocketPushSupport;
      this.pocketPushSupport += Math.sign(distance) * Math.min(Math.abs(distance), dt / 180);
      animating = true;
    }
    if (this.rightPinch?.advance(dt)) animating = true;
    if (this.wideSupport) {
      const moving = this.wideSupport.returning || this.wideSupport.progress < 1;
      const driver = hands[this.wideSupport.hand === 'R' ? 'L' : 'R'];
      const pocketRelease = this.cube?.order === 2 && this.wideSupport.returning && driver.flickDecay > 0;
      if (!pocketRelease) this.wideSupport.advance(dt);
      if (this.wideSupport.returning && !this.wideSupport.progress) this.wideSupport = null;
      animating ||= moving;
    }
    if (this.markedMotion) {
      this.markedMotion.advance(dt);
      if (this.markedMotion.done) {
        const completed = this.markedMotion;
        this.markedMotion = null;
        if (completed.holdSupport && completed.started) {
          completed.restartSupportReturn();
          this.supportTransition = { motion: completed, weldRadians: 0, releasing: false };
        }
      }
      animating = true;
    }

    // —— 轮询当前转动层 ——
    const now = performance.now();
    const cube = this.cube;
    // 外让/单指避让目标每帧重算(driveGesture 写入);无手势帧目标归零 → 衰减回落。
    hands.R.indexEvadeTarget = 0;
    hands.L.indexEvadeTarget = 0;
    hands.R.lowEvadeTarget = 0;
    hands.L.lowEvadeTarget = 0;
    hands.R.midEvadeTarget = 0;
    hands.L.midEvadeTarget = 0;
    hands.R.bEvadeTarget = 0;
    hands.L.bEvadeTarget = 0;
    hands.R.fEvadeTarget = 0;
    hands.L.fEvadeTarget = 0;
    hands.R.sEvadeTarget = 0;
    hands.L.sEvadeTarget = 0;
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
        if (cube.order === 4 && ls && ls.length > 1) {
          // Simultaneous, independent drags may move disjoint layers or turn
          // adjacent layers in opposite directions. A wide stroke must be rigid.
          const peak = ls.find(layer => gs[layer].angle === best)!;
          let lo = peak, hi = peak;
          while (lo > 0 && gs[lo - 1].angle !== 0 && Math.abs(gs[lo - 1].angle - best) < 1e-5) lo--;
          while (hi + 1 < gs.length && gs[hi + 1].angle !== 0 && Math.abs(gs[hi + 1].angle - best) < 1e-5) hi++;
          ls = ls.filter(layer => layer >= lo && layer <= hi);
        }
        if (ls && (axis === null || Math.abs(best) > Math.abs(repAngle))) {
          axis = a;
          layers = ls;
          repAngle = best;
        }
      }

      if (axis && layers) {
        if (this.rightPinch && !this.rightPinch.matches(axis, layers, repAngle)) this.rightPinch = null;
        this.lastActivityAt = now;
        animating = true;
        const cls = classifyLayers(layers, cube.order);
        const group = cube.table.groups[axis][layers[0]];
        const pocketStroke = cube.order === 2 || isFourWide(cube.order, layers);
        const pocketUpper = pocketStroke && axis === 'y' && cls === 'high';
        // 招式队列是同步接续的(drop → 下一步 twist 在同一 tick),中间可能
        // 没有「零活动帧」—— 所以轴变 / 层类变 / 同类连发 / 方向反转四种切换
        // 都要在这里显式收尾旧手势,否则上一手的 weld 姿态永远悬着(踩过)。
        if (!this.active || this.active.axis !== axis || this.active.cls !== cls || !sameLayers(this.active.layers, layers)) {
          this.endGesture();
          this.active = { axis, cls, layers, dir: 0, gesture: null, lastAngle: 0 };
        } else if (this.active.gesture && !((pocketUpper || cube.order === 4) && group.isDragging) && Math.abs(repAngle) < Math.abs(this.active.lastAngle) - 0.8) {
          // 同轴同类连发(U 接 U):角度从 ~π/2 跳回 ~0 = 新的一步。
          this.endGesture();
          this.active.gesture = null;
          this.active.dir = 0;
        }
        const act = this.active;
        // 已就位的 F 食指从第一帧非零层角开始跟随，不能等拖拽判向阈值。
        const preparedFront = ((axis === "z" && (cls === "high" || cls === "mid")) || (axis === "y" && cls === "high"))
          && ([hands.R, hands.L].some(h => (h.flickStyle === "topPush" || isMixedPush(h.flickStyle)) && h.reachTarget === 1
              && h.flickAxis === axis && h.flickLayer === cls)
            || (this.pendingHint?.axis === "z" && this.pendingHint.cls === "high"));
        const preparedHook = axis === 'y' && cls === 'high' && layers.length === 1
          && (this.pendingHint?.indexHook || this.pendingHint?.middleRelay || this.pendingHint?.axis === 'y' && this.pendingHint.cls === 'high' && this.pendingHint.nail) && this.pendingHint.dir === Math.sign(repAngle);
        const preparedR = axis === 'x' && cls === 'high' && (this.ruPreparation === 'preparing'
          || layers.length === 1 && this.supportTransition?.motion.topPinch === 1);
        // The half grip already holds the outer column. Its hand is known
        // before the drag direction is classified, including sub-degree motion.
        const seatedOuter = axis === 'x' && (cls === 'high' || cls === 'low') && layers.length === 1
          && atHalfTurn(hands[cls === 'high' ? 'R' : 'L'].gripAngle);
        const markedPlan = this.markedMotion?.plan;
        const preparedMarked = markedPlan && markedPlan.request.axis === axis
          && markedPlan.request.layers.length === layers.length && layers.every(layer => markedPlan.request.layers.includes(layer));
        const pocketHint = (pocketStroke || cube.order === 4 || this.pendingHint?.push || this.pendingHint?.homeStroke) && this.pendingHint?.axis === axis && this.pendingHint.cls === cls
          && sameLayers(this.pendingHint.layers, layers) && this.pendingHint.dir === Math.sign(repAngle) && now - this.pendingHint.at < 3000;
        const preparedM = axis === 'x' && cls === 'mid' && isMiddleSliceStroke(hands.L.flickStyle)
          && this.pendingHint?.dir === Math.sign(repAngle);
        const innerSlice = cube.order === 4 && cls === 'mid' && layers.length === 1;
        const pinchDriver = this.rightPinch?.driver(axis, layers, Math.sign(repAngle));
        if (pinchDriver || innerSlice || preparedM || pocketHint || cls === "whole" || Math.abs(repAngle) >= COMMIT_ANGLE || preparedFront || preparedHook || preparedR || seatedOuter || preparedMarked) {
          const dir: 1 | -1 = repAngle > 0 ? 1 : -1;
          if (cls !== "whole" && act.gesture && act.dir !== 0 && act.dir !== dir) {
            // 转向反转(拖拽回拉 / U 接 U'):换手重分类。
            this.endGesture();
            act.gesture = null;
          }
          if (!act.gesture) {
            // 握姿感知分类(grip 是精确四分转积,阈值只兜浮点;regrip() 提交即
            // 写 grip,动画途中判定也指向终态)+ 转前提示(连拨 / 推法)消费。
            const marked = preparedMarked && markedPlan.request.dir === dir;
            const singleUpper = axis === 'y' && cls === 'high' && layers.length === 1;
            const middleSlice = axis === 'x' && cls === 'mid' && layers.length === 1;
            const timedArc = pocketUpper || cube.order === 4 || (cube.order === 3 && singleUpper) || middleSlice
              ? group.targetAngle : undefined;
            // A pointer has no target angle yet. Stage the second finger while
            // the index drives the first quarter so crossing 90° stays continuous.
            let grips = this.gripNames();
            if (!pinchDriver && !marked && !this.pendingHint?.explicit && singleUpper
              && timedArc !== undefined && Math.abs(timedArc + Math.PI) < 1e-6 && this.seatLeftForRelay(grips)) {
              grips = this.gripNames();
            }
            const dragGrip = grips[dir > 0 ? 'R' : 'L'];
            const innerUpperRelay = cube.order === 4 && axis === 'y' && layers.length === 1 && layers[0] === 2
              && grips.R === 'home' && grips.L === 'home';
            const dragRelay = group.isDragging && (innerUpperRelay
              || pocketUpper && (dragGrip === 'up' || dragGrip === 'home' || dragGrip === 'down'));
            const hint = marked ? undefined : this.takeHint(axis, cls, layers, dir)
              ?? (dragRelay || timedArc !== undefined && Math.abs(Math.abs(timedArc) - Math.PI) < 1e-6 ? { quarters: 2 } : undefined);
            act.halfTurn = hint?.quarters === 2;
            act.candidates = hint?.homeStroke?.candidates;
            act.bearing = marked ? { center: markedPlan.start, normal: markedPlan.normal,
              tangent: strokeTangent(axis, dir, markedPlan.start) } : hint?.homeStroke?.bearing;
            act.gesture = pinchDriver ?? (marked
              ? { kind: 'flick', hand: markedPlan.hand, finger: markedPlan.profile.finger, style: 'marked' }
              : gestureForLayers(axis, layers, dir, grips, hint, cube.order));
            const other = act.gesture.kind === 'flick' && act.gesture.hand === 'L' ? 'R' : 'L';
            if (!marked && cls !== 'whole' && (cube.order === 3 && layers.length === 2 || cube.order === 4 && layers.length === 3
              || isPocketLowerRelay(cube.order, axis, cls, act.gesture, grips[other])))
              this.placeWideSupport(axis, cls === 'high', act.gesture, hint?.homeStroke?.slideUpper);
            act.dir = dir;
            this.beginGesture(act.gesture, axis);
          }
        }
        if (act.gesture) {
          if (cube.order === 4 && cls !== 'whole' && !(act.gesture.kind === 'flick' && isHomePushStyle(act.gesture.style))) {
            const seat = this.seatFour(axis, layers, act.dir, act.gesture);
            seat.angle = repAngle;
            // Pointer drags and directly queued turns lack a pre-turn interval.
            // Display the seated grip from the first moving frame.
            if (innerSlice) seat.progress = 1;
          }
          this.driveGesture(act.gesture, axis, repAngle);
        }
        act.lastAngle = repAngle;
      } else if (this.active) {
        // 层已 drop(角度归零 & bake)→ 手势进入回位。
        this.endGesture();
        this.active = null;
        this.lastActivityAt = now;
        animating = true;
      }
    }

    // The finishing frame starts both finger decay and seat withdrawal.
    // Advancing the seat before observing the drop delays it by one frame.
    if (this.fourSeat) {
      const seat = this.fourSeat;
      const previous = seat.progress;
      const ringRelayReturn = seat.returning && this.usesFittedRingRelay(seat);
      seat.progress = THREE.MathUtils.clamp(previous + (seat.returning ? -dt : dt) / (ringRelayReturn ? RECOVER_MS : 160), 0, 1);
      if (!seat.progress && seat.returning) this.fourSeat = null;
      animating ||= seat.progress !== previous;
    }

    const transition = this.supportTransition;
    if (transition) {
      if (transition.motion.topPinch !== null && !transition.motion.finished)
        transition.motion.topPinch = Math.min(1, transition.motion.topPinch + dt / 320);
      const supportTurn = this.active?.axis === 'x' && this.active.cls === (transition.motion.plan.hand === 'L' ? 'high' : 'low');
      if (transition.motion.finished) {
        if (supportTurn) transition.releasing = true;
        if (transition.releasing) transition.motion.advance(dt);
        if (transition.motion.done) this.supportTransition = null;
      } else if (supportTurn) {
        const t = Math.min(1, Math.abs(this.active!.lastAngle) / transition.weldRadians);
        transition.motion.preparation = t * t * (3 - 2 * t);
      }
      animating = true;
    }

    // —— 回位 / 残留衰减 / 待机微动 ——
    this.idleClock += dt;
    // F 层单指/双指动作包含前置与回撤:对侧手也保持握持,不能叠待机呼吸。
    const fFingerMotion = ([hands.R, hands.L]).some(h => h.flickFinger !== null
      && (isMixedPush(h.flickStyle) || h.flickStyle === "topPush" || h.flickStyle === "downPush"))
      || (this.pendingHint?.axis === "z" && this.pendingHint.cls === "high" && now - this.pendingHint.at < 3000);
    // D 层准备、转动和收指期间，两手拇指不能被支撑手的待机呼吸带动。
    const dFingerMotion = (this.active?.axis === "y" && this.active.cls === "low")
      || ([hands.R, hands.L]).some(h => h.flickFinger !== null && h.flickAxis === "y" && h.flickLayer === "low")
      || (this.pendingHint?.axis === "y" && this.pendingHint.cls === "low" && now - this.pendingHint.at < 3000);
    // The resting hand still supports the cube while the other seats or
    // releases a half grip. Keep breathing offsets off both sets of pads.
    const halfRecovery = [hands.R, hands.L].some(h => h.recoverT < 1 && (h.halfSeatRelease
      || atHalfTurn(h.gripAngle) || atHalfTurn(h.gripAngle + h.recoverWristAngle)));
    const middleSliceMotion = isMiddleSliceStroke(hands.L.flickStyle);
    const keepalive = !middleSliceMotion && !this.markedMotion && !fFingerMotion && !dFingerMotion && now - this.lastActivityAt < IDLE_KEEPALIVE_MS;
    // On a whole half turn the hands finish on opposite sides. Return
    // one quarter at a time, alternating support before their paths cross.
    const twoSeats = this.wholeRegrip && hands.R.recoverQuat.angleTo(HandsRig._qIdent) > HALF_PI + .01;
    const stop = twoSeats && hands.L.recoverT < .5 ? .5 : 1;
    const returningHand = hands.R.recoverT < stop ? 'R' : 'L';
    for (const side of ["R", "L"] as const) {
      const h = hands[side];
      if (h.recoverT < 1 && (!this.wholeRegrip || side === returningHand)) {
        // Returning a hand around the cube sweeps a longer arc than a wrist regrip.
        const angle = h.recoverQuat.angleTo(HandsRig._qIdent);
        const duration = this.wholeRegrip ? Math.max(RECOVER_MS, angle * 390)
          : this.isHalfBranchSwitch(h) ? 400 : RECOVER_MS;
        h.recoverT = Math.min(this.wholeRegrip ? stop : 1, h.recoverT + dt / duration);
        if (h.recoverT === 1) h.halfSeatRelease = undefined;
        animating = true;
      }
      const withdrawingFront = h.flickStyle === 'topPush' && h.flickAxis === 'z' && h.flickLayer === 'high'
        && Math.abs(h.flickAmount) >= TOP_PUSH.retreatSplit;
      const returnMs = isSliceNail(h.flickStyle) && cube?.order === 3 ? 460 : RECOVER_MS;
      const reachElapsed = withdrawingFront ? Math.max(0, dt - h.flickDecay * RECOVER_MS) : dt;
      if (h.flickDecay > 0) {
        h.flickDecay = Math.max(0, h.flickDecay - dt / returnMs);
        if (h.flickDecay === 0) {
          if (h.flickStyle === 'frontIndexNail' || h.flickStyle === 'frontThumbNail' || h.flickStyle === 'upperRingRelay' || h.flickStyle === 'upPush' || h.flickStyle === 'lowerPush' || h.flickStyle === 'lowerHook' || isMiddleSliceStroke(h.flickStyle) || isMixedPush(h.flickStyle)) {
            h.reachT = h.reachTarget = 0;
            h.flickAmount = 0;
          } else if (h.flickStyle === "topPush" || h.reachT > 0) {
            // 带前置伸指的样式(topPush/upPush/D2' 小指):完全收回(下方
            // reachT=0 清理)才清字段,退场走完才收指(串行)。topPush 的
            // flickAmount 不清(收指段姿态靠它判定终点:release 走满/缩回
            // 按压位);其余 reach 样式 decay 已沿弧退到起手位,清零防
            // decayK 回 1 时姿态弹回。
            if (h.flickStyle !== "topPush") h.flickAmount = 0;
            h.reachTarget = 0;
          } else {
            h.flickFinger = null; h.flickFinger2 = null; h.flickAxis = null; h.flickLayer = null; h.flickStyle = null;
          }
        }
        animating = true;
      }
      // 前置伸指/收指(时间驱动);完全收回后才清 flick 状态。
      if (h.reachT !== h.reachTarget) {
        const reaching = h.reachTarget > h.reachT;
        const elapsed = reaching ? dt : -reachElapsed;
        const frontApproach = !this.active && h.flickStyle === "topPush" && h.flickAxis === "z" && h.flickLayer !== "mid";
        const upperDoubleReturn = !reaching && h.flickStyle === 'topPush' && h.flickAxis === 'y' && Math.abs(h.flickAmount) > HALF_PI;
        let progress = h.reachT + elapsed / REACH_MS;
        if (frontApproach && !withdrawingFront) progress = advanceFrontApproach(h.reachT, elapsed);
        if (upperDoubleReturn) progress = advanceFrontIndexReach(h.reachT, elapsed);
        h.reachT = reaching ? Math.min(h.reachTarget, progress) : Math.max(h.reachTarget, progress);
        animating = true;
      }
      if (h.flickFinger && h.flickStyle && h.reachTarget === 0 && h.reachT === 0 && h.flickDecay === 0 && this.active?.gesture?.kind !== "flick") {
        h.flickFinger = null; h.flickFinger2 = null; h.flickAxis = null; h.flickLayer = null; h.flickStyle = null;
        h.flickAmount = 0;
      }
      // FTN @pin 钉指就位/收指(时间驱动,同 reachT 节拍);收回后清指名。
      if (h.pinReachT !== h.pinReachTarget) {
        const step = dt / REACH_MS;
        h.pinReachT = h.pinReachTarget > h.pinReachT
          ? Math.min(h.pinReachTarget, h.pinReachT + step)
          : Math.max(h.pinReachTarget, h.pinReachT - step);
        animating = true;
      }
      if (h.pinFinger && h.pinReachTarget === 0 && h.pinReachT === 0) h.pinFinger = null;
      if (h.indexEvadeTarget > h.indexEvade) {
        h.indexEvade = h.indexEvadeTarget;
        animating = true;
      } else if (h.indexEvade > h.indexEvadeTarget) {
        h.indexEvade = Math.max(h.indexEvadeTarget, h.indexEvade - dt / RECOVER_MS);
        animating = true;
      }
      // D 族静止手「无名指 + 拇指」单指避让:同上时序。
      if (h.lowEvadeTarget > h.lowEvade) {
        h.lowEvade = h.lowEvadeTarget;
        animating = true;
      } else if (h.lowEvade > h.lowEvadeTarget) {
        h.lowEvade = Math.max(h.lowEvadeTarget, h.lowEvade - dt / RECOVER_MS);
        animating = true;
      }
      // E 族双手「拇指 + 中指(+ 弹指无名指)」单指避让:同上时序。
      if (h.midEvadeTarget > h.midEvade) {
        h.midEvade = h.midEvadeTarget;
        animating = true;
      } else if (h.midEvade > h.midEvadeTarget) {
        h.midEvade = Math.max(h.midEvadeTarget, h.midEvade - dt / RECOVER_MS);
        animating = true;
      }
      // B 族静止手「食指 + 中指」单指避让:同上时序。
      if (h.bEvadeTarget > h.bEvade) {
        h.bEvade = h.bEvadeTarget;
        animating = true;
      } else if (h.bEvade > h.bEvadeTarget) {
        h.bEvade = Math.max(h.bEvadeTarget, h.bEvade - dt / RECOVER_MS);
        animating = true;
      }
      // S 族 up/down 握「拇指 + 中指」单指避让(按握姿选指):同上时序。
      if (h.sEvadeTarget > h.sEvade) {
        h.sEvade = h.sEvadeTarget;
        animating = true;
      } else if (h.sEvade > h.sEvadeTarget) {
        h.sEvade = Math.max(h.sEvadeTarget, h.sEvade - dt / RECOVER_MS);
        animating = true;
      }
      // F 族遗留分支单指避让(按握姿选指):同上时序。
      if (h.fEvadeTarget > h.fEvade) {
        h.fEvade = h.fEvadeTarget;
        animating = true;
      } else if (h.fEvade > h.fEvadeTarget) {
        h.fEvade = Math.max(h.fEvadeTarget, h.fEvade - dt / RECOVER_MS);
        animating = true;
      }
      this.applyHand(side, keepalive && !halfRecovery, dt);
      if (this.skelMatMap.line.visible) h.model.updatePalmLinks?.();
    }
    // onepiece 全身傀儡:两手姿态(applyHand 含 poseCorrective)全部落定后,
    // 手骨逐骨解析同步 —— 傀儡手区表面与活手表面逐点重合(见 smplxBody)。
    if (this.body && this.body.visible) this.body.syncHands(dt);
    if (this.regripFlag && hands.R.recoverT >= 1 && hands.L.recoverT >= 1) {
      this.regripFlag = false;
      this.wholeRegrip = false;
    }
    const seat = this.singleMarkSeat;
    if (seat?.returning && !this.active && !this.markedMotion && !this.fourSeat && !hands[seat.hand].flickDecay && !hands[seat.hand].reachT) {
      this.regrip(seat.original, seat.hand, seat.wristAngle, 'stroke-return');
      animating = true;
    }
    // Wait for both digits to leave the top before rotating the palm back.
    if (this.leftRelaySeat?.returning && !this.active && !hands.L.flickDecay && !hands.L.reachT) {
      this.regrip(this.leftRelaySeat.original, 'L', this.leftRelaySeat.wristAngle);
      animating = true;
    }
    if (keepalive) animating = true;
    this.emitDiagnostic('frame');
    this.markedMotion?.didDisplay();
    return animating;
  }

  // ================= 手势生命周期 =================

  private beginGesture(g: HandGesture, axis: Axis): void {
    if (g.kind !== 'flick' || !isHomePushStyle(g.style)) this.pocketPushTarget = 0;
    if (g.kind === 'flick' && g.style === 'marked') return;
    const hands = this.hands;
    if (!hands) return;
    if (g.kind === "weld") {
      if (this.ruPreparation === 'preparing' && axis === 'x' && g.hands.includes('R')) this.ruPreparation = 'turning';
      for (const s of g.hands) {
        const h = hands[s];
        h.halfThumbReturn = 0;
        h.halfSeatRelease = undefined;
        h.weldAxis = null; // driveGesture 里设,先清残留
        h.weldAngle = 0;
        h.weldRawAngle = 0;
        h.weldWhole = false;
        h.recoverT = 1; // weld 直接接管,丢弃未完的回位
      }
    } else {
      const h = hands[g.hand];
      h.strokeLayers = this.active?.layers ?? [];
      h.flickFinger = g.finger;
      h.flickFinger2 = g.finger2 ?? null;
      h.flickAxis = axis;
      h.flickLayer = this.active?.cls ?? null;
      h.flickStyle = g.style ?? null;
      h.flickAmount = 0;
      h.flickDecay = 0;
      // 前置伸指样式(topPush/upPush/D2' 小指):播放路径 prepareTwist 已前置
      // (reachT 到 1);拖拽/键盘没有前置窗口,这里补触发,伸指与层角并发。
      // reachT 不清零 —— 已到位的连发(F 接 F)指尖全程停在贴纸上。
      if (HandsRig.needsReach(g)) h.reachTarget = 1;
    }
  }

  private driveGesture(g: HandGesture, axis: Axis, angle: number): void {
    if (g.kind === 'flick' && g.style === 'marked') { this.markedMotion?.turn(angle); return; }
    const hands = this.hands;
    if (!hands) return;
    if (g.kind === "weld") {
      const whole = this.active?.cls === "whole";
      const weldAngle = angle;
      for (const s of g.hands) {
        const h = hands[s];
        h.weldAxis = axis;
        h.weldWhole = whole;
        h.weldAngle = weldAngle;
        h.weldRawAngle = angle;
      }
    } else {
      const h = hands[g.hand];
      if (g.style || g.finger2) {
        // 样式化指法(FINGERTRICKS.md):手根不动 —— 禁腕借力(借力绕 y/z 会把
        // 静止的中指/无名指沿 ~130U 弧转进 B 面,dodge 已按接触规格砍掉后
        // oracle 实测 pen −5.7);接触/连拨编排全在 applyHand 随层角展开。
        // flickAmount 存未钳制原角(release / 连拨象限拆分依赖真实层角)。
        h.flickAmount = angle;
      } else {
        h.flickAmount = softClampAngle(angle);
        // 弹指时手腕轻微借力(跟层角),applyHand 里通过 weld 通道叠加。系数按轴:
        // x 族(M)必须为 0 —— 绕 x 借力会把贴 B 面的指腹沿 ~118U 半径圆弧转进
        // 角块区(对角线处 Chebyshev 内陷 >15U,oracle 实测);y/z 借力在 2.7U
        // 贴面间隙下对角线擦过量 <0(指腹接触半径 ~136U ≥ 角柱 135.8U,且旧
        // 扫法带 dodge 外让)。y.mid(E 族)也必须 0 —— 上述安全论证只覆盖
        // 外层带(接触半径 ~136U);E 带贴面指(拇指/中指)半径只 ~119-130U,
        // 且整手 dodge 已废,借力旋转会把弹指手食指腹沿 B 面切向压进静止 U 带
        // 箱体(dodge=0 裸基线 oracle 实测 ~3U)。z.high(F 族遗留拇指分支,
        // 只在 up/down/混合握持出现)也必须 0 —— 该借力绕 z 旋转弹指手,up 握
        // 下会把中指/食指末节切向压进静止箱体角柱(dodge=0 裸基线 oracle 实测
        // 中指 6.0U/食指 2.8U@θ≈1.2-1.6),home 握下也把食指腹压进 BUR 角
        // ~1.4U;旧安全论证同样依赖已废的整手 dodge。归零后弹指手根更稳
        // (总原则),残余受害由 F_EVADE 单指避让兜。z.mid(S 族)同理必须 0:
        // up 握下借力把弹指手拇指(z 探进 S 带、径向 ~119U)切向压进转动域,
        // 真实播放 R S R' S' 实测 10.5U(借力是该拇指唯一运动通道,归零即清
        // 借力分量);home 握借力本安全(指肉全在 S 带外)但同享手根更稳,
        // 静态扫掠残余受害由 S_EVADE 单指避让兜。
        h.weldAxis = axis;
        h.weldWhole = false;
        // D 族非双中握也不借腕，保证拇指保持本手原握姿。
        const pocketSupportGrip = (this.cube?.order === 2 || isFourWide(this.cube?.order ?? 3, h.strokeLayers)) && axis === "y"
          && (atHalfTurn(h.gripAngle) || h.grip.angleTo(GRIP_Q_DOWN) < .01);
        h.weldAngle = softClampAngle(angle)
          * (pocketSupportGrip || axis === "x" || (axis === "y" && (this.active?.cls === "mid" || this.active?.cls === "low"))
            || (axis === "z" && (this.active?.cls === "high" || this.active?.cls === "mid")) ? 0 : 0.1);
        h.weldRawAngle = 0; // 借力不烘入握姿
      }
    }
    // The right index clears the front edge on its own from home.
    if (g.kind === 'flick' && g.style === 'frontIndexNail') return;
    // The downward grip drives an outer F from its own side. Keep the other grip seated.
    if (this.cube?.order === 3 && axis === 'z' && this.active?.cls === 'high'
      && this.active.layers.length === 1 && g.kind === 'flick' && hands[g.hand].grip.angleTo(GRIP_Q_DOWN) < .01) return;
    // Drive finger clearance from the displayed layer angle.
    if (axis === 'z' && this.active?.cls === 'high' && g.kind === "flick"
      && (g.style === "topPush" || g.style === "downPush")) {
      const support = hands[g.hand === "R" ? "L" : "R"];
      if ((this.cube?.order === 2 || isFourWide(this.cube?.order ?? 3, hands[g.hand].strokeLayers)) && support.grip.angleTo(GRIP_Q_DOWN) < .01) {
        support.fEvadeTarget = Math.min(1, Math.abs(angle) / .09);
      }
      return;
    }
    // U 族(y.high,含 hook 单/连拨与 upPush)静止手改食指单指避让(见
    // HOOK_INDEX_EVADE 注释):静止手食指尖在 B 面上部(BUL/BUR)正处 U 层
    // 扫掠带(upPush 真实播放 oracle 曾测 −1.7U,2026-07-08),整手 dodge 已
    // 废(DODGE_MAG.y.high=0),只写另一手的单指避让目标;弹指手不避
    // (指尖要贴面)。
    if (g.kind === "flick" && axis === "y" && this.active?.cls === "high") {
      const other = hands[g.hand === "R" ? "L" : "R"];
      // In the right half grip the index already rests on the lower row.
      if (this.rightHalfSupportsUpperRelay()) return;
      const t = Math.min(1, Math.abs(angle) / 0.09);
      if (t > other.indexEvadeTarget) other.indexEvadeTarget = t;
    }
    // D 族(y.low,含 hook 单/连拨)只让支撑手无名指避让，双手拇指保持原位。
    if (g.kind === "flick" && axis === "y" && this.active?.cls === "low") {
      const other = hands[g.hand === "R" ? "L" : "R"];
      const t = Math.min(1, Math.abs(angle) / 0.09);
      if (t > other.lowEvadeTarget) other.lowEvadeTarget = t;
    }
    // E 族(y.mid)双手单指避让(见 MID_EVADE 注释):E 带扫掠犁**两只手**的
    // 贴 F 面拇指与贴 B 面中指(受害不分弹指手,窗口首尾相接),整手 dodge
    // 已废(DODGE_MAG.y.mid=0),两手都写目标;弹指手无名指的扫掠抬离也由
    // 同一进度驱动(applyHand role===1 分支)。
    if (g.kind === "flick" && axis === "y" && this.active?.cls === "mid") {
      const t = Math.min(1, Math.abs(angle) / 0.09);
      if (t > hands.R.midEvadeTarget) hands.R.midEvadeTarget = t;
      if (t > hands.L.midEvadeTarget) hands.L.midEvadeTarget = t;
    }
    // B 族(z.low)静止手改「食指 + 中指」单指避让(见 B_EVADE 注释):整手
    // dodge 已废(DODGE_MAG.z.low=0),只写另一手目标;弹指手本侧的静止中/
    // 无名指避让走 BACK_EVADE(既有通道,保留)。
    if (g.kind === "flick" && axis === "z" && this.active?.cls === "low") {
      const other = hands[g.hand === "R" ? "L" : "R"];
      const t = Math.min(1, Math.abs(angle) / 0.09);
      if (t > other.bEvadeTarget) other.bEvadeTarget = t;
    }
    // F 族(z.high 遗留拇指分支;topPush/downPush 已在上方整段 return)单指
    // 避让(见 F_EVADE 注释):受害不分弹指手(up 握弹指手的无名指同样被扫),
    // 两手都写目标,施加端按各手握姿选指(home 握手在 applyHand 里不动)。
    if (g.kind === "flick" && axis === "z" && this.active?.cls === "high") {
      const t = Math.min(1, Math.abs(angle) / 0.09);
      if (t > hands.R.fEvadeTarget) hands.R.fEvadeTarget = t;
      if (t > hands.L.fEvadeTarget) hands.L.fEvadeTarget = t;
    }
    // S 族(z.mid)up/down 握「拇指 + 中指」单指避让(见 S_EVADE 注释):
    // 受害不分弹指手(弹指手拇指同样被扫),两手都写目标,施加端按各手握姿
    // 选指(home 握手在 applyHand 里不动 —— home 握 S 全程干净)。
    if (g.kind === "flick" && axis === "z" && this.active?.cls === "mid") {
      const t = Math.min(1, Math.abs(angle) / 0.09);
      if (t > hands.R.sEvadeTarget) hands.R.sEvadeTarget = t;
      if (t > hands.L.sEvadeTarget) hands.L.sEvadeTarget = t;
    }

  }

  private usesFittedRingRelay(seat: typeof this.fourSeat): boolean {
    if (!seat || seat.gesture.kind !== 'flick'
      || seat.gesture.finger !== 'ring' || seat.gesture.finger2 !== 'pinky') return false;
    if (seat.axis === 'x') return seat.layers.length === 1 ? seat.layers[0] === 1 || seat.layers[0] === 2
      : seat.layers.length === 2 && seat.layers.includes(1) && seat.layers.includes(2);
    if (seat.layers.length !== 1) return false;
    const hand = this.hands?.[seat.gesture.hand];
    return seat.axis === 'y' && seat.layers[0] === 1 && !!hand && hand.grip.angleTo(HandsRig._qIdent) < .01;
  }

  private endGesture(): void {
    const hands = this.hands;
    const gesture = this.active?.gesture;
    if (!hands || !gesture) return;
    if (this.singleMarkSeat && gesture.kind === 'flick' && gesture.hand === this.singleMarkSeat.hand
      && gesture.style === this.singleMarkSeat.style) this.singleMarkSeat.returning = true;
    if (this.leftRelaySeat && gesture.kind === 'flick' && gesture.hand === 'L'
      && gesture.finger === 'index' && gesture.finger2 === 'middle') this.leftRelaySeat.returning = true;
    if (this.fourSeat) this.fourSeat.returning = true;
    if (this.wideSupport) this.wideSupport.returning = true;
    if (gesture.kind === 'flick' && gesture.style === 'marked') { this.markedMotion?.completeTurn(); return; }
    if (this.active?.axis === 'y' && this.active.cls === 'high' && this.active.dir === 1
      && gesture.kind === 'flick' && gesture.hand === 'R' && gesture.finger === 'index'
      && !gesture.finger2) this.emitDiagnostic('end-u');
    for (const side of ["R", "L"] as const) {
      const h = hands[side];
      if (h.weldAxis) {
        // Outer x turns persist. Whole turns retain the last displayed rotation
        // as a release offset; one hand supports the cube while the other returns.
        if (h.weldWhole && Math.abs(h.weldAngle) > .01) {
          this.wholeRegrip = true;
          this.regripFlag = true;
          h.regripArmWeight = h.appliedArmWeight;
        }
        // Keep the displayed thumb pose on an interrupted drag, then unwind
        // it on the recovery clock along with the wrist.
        h.halfThumbReturn = h.weldAxis === 'x' && !h.weldWhole && atHalfTurn(h.gripAngle)
          ? carriedThumbWeight(h.gripAngle, h.weldAngle) : 0;
        const snap = Math.round(h.weldRawAngle / HALF_PI);
        if (side === 'R' && this.ruPreparation === 'turning') {
          if (snap === 1 && h.weldAxis === 'x' && !h.weldWhole) this.ruPreparation = 'held';
          else this.releaseRUPreparation();
        }
        if (snap !== 0 && h.weldAxis === "x" && !h.weldWhole) {
          const source = h.gripAngle;
          h.gripAngle = wrapWristAngle(source + snap * HALF_PI);
          if (atHalfTurn(source) || atHalfTurn(h.gripAngle)) {
            h.halfSeatRelease = { source, layerAngle: snap * HALF_PI };
            h.regripArmWeight = h.appliedArmWeight;
            this.regripFlag = true;
          }
          // The cube has baked the exact turn. Suppress sub-pixel residuals
          // from the last displayed angle before the next stationary contact.
          const residual = h.weldAngle - snap * HALF_PI;
          h.recoverWristAngle = Math.abs(residual) < .001 ? 0 : residual;
          h.grip.premultiply(HandsRig._qTmp2.setFromAxisAngle(AXIS_VEC[h.weldAxis], snap * HALF_PI));
          h.recoverQuat.setFromAxisAngle(AXIS_VEC[h.weldAxis], h.recoverWristAngle);
        } else {
          h.recoverWristAngle = h.weldAxis === "x" && !h.weldWhole ? h.weldAngle : 0;
          h.recoverQuat.setFromAxisAngle(AXIS_VEC[h.weldAxis], h.weldAngle);
        }
        h.recoverT = 0;
        h.weldAxis = null;
        h.weldAngle = 0;
        h.weldRawAngle = 0;
        h.weldWhole = false;
        // FTN @pin 钉指:weld 提交即收指(与回位并行;收指闸挡下一步)。
        if (h.pinFinger) h.pinReachTarget = 0;
      }
      if (gesture.kind === 'flick' && gesture.hand === side && h.flickFinger) {
        h.flickDecay = 1;
        if (this.usesFittedRingRelay(this.fourSeat)) {
          // The inner relay owns its return while the palm leaves the strip.
          h.flickDecay = h.reachTarget = h.reachT = 0;
        }
        if (h.flickStyle === 'reverseIndexHook' || h.flickStyle === 'reverseRingHook') {
          // Keep the last driven angle through release, including a partial drag.
          h.flickDecay = h.reachTarget = 0;
        }
        if ((h.flickStyle === 'thumbLift' || h.flickStyle === 'sliceNail' && this.cube?.order !== 3)
          && Math.abs(h.flickAmount) >= HALF_PI - .001) {
          h.flickDecay = h.reachTarget = h.reachT = 0;
        }
        if (h.flickStyle === 'topPush' && h.flickAxis === 'z' && h.flickLayer === 'mid'
          && Math.abs(h.flickAmount) >= HALF_PI - .001) {
          // S has already lifted and unwound during 45..90°. Return immediately
          // instead of waiting through F's extra release window above the cube.
          h.flickDecay = 0;
          h.reachTarget = 0;
        }
        if (h.flickStyle === 'topPush' && h.flickAxis === 'y' && Math.abs(h.flickAmount) > HALF_PI) {
          // Finish just the unplayed part of the withdrawal if the last rendered
          // frame preceded the snapped half turn. A full turn can retract now.
          h.flickDecay = Math.max(0, (Math.PI - Math.abs(h.flickAmount)) / HALF_PI);
          if (h.flickDecay === 0) h.reachTarget = 0;
        }
        // flickAmount 保留为残留幅度,由 flickDecay 衰减。
        // topPush:flickAmount 保留提交原角(退场姿态由 applyHand 的 effRaw
        // 统一推导,见 TOP_PUSH.retreatSplit 注释)。收指**串行**:reach 钳在 1,
        // decay 段跑虚拟续转 release / 原地缩回,tick 里 decay 归零才 reachTarget=0。
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
  private static _vTmp3 = new THREE.Vector3();
  private static _vTmp4 = new THREE.Vector3();
  private static _mTmp = new THREE.Matrix4();
  private static _relayOffset = new THREE.Vector3();
  private static _elbowTarget = new THREE.Vector3();
  private static _armDirection = new THREE.Vector3();
  private static _armHome = new THREE.Vector3();
  private static _armNatural = new THREE.Vector3();
  private static _armTurn = new THREE.Quaternion();
  private static readonly WRIST_COMFORT = THREE.MathUtils.degToRad(38);
  private static readonly HALF_WRIST_COMFORT = THREE.MathUtils.degToRad(24);

  private recoveryProgress(t: number): number {
    return this.regripFlag ? t * t * (3 - 2 * t) : 1 - (1 - t) ** 3;
  }

  private handRecoveryProgress(h: HandState): number {
    const t = h.recoverT;
    if (this.wholeRegrip && h.recoverQuat.angleTo(HandsRig._qIdent) > HALF_PI + .01) {
      const quarter = t < .5 ? 0 : .5;
      return quarter + .5 * THREE.MathUtils.smoothstep(2 * (t - quarter), 0, 1);
    }
    return this.recoveryProgress(t);
  }

  private isLateralHandoff(right: HandState): boolean {
    return this.wholeRegrip && Math.abs(right.recoverQuat.x) < .01
      && right.recoverQuat.angleTo(HandsRig._qIdent) > HALF_PI + .01;
  }

  private recoverOrientation(q: THREE.Quaternion, h: HandState, neutralHandoff: boolean): void {
    const t = this.handRecoveryProgress(h);
    q.copy(h.recoverQuat).slerp(HandsRig._qIdent, t);
    if (neutralHandoff) {
      // The hands use opposite top and bottom strips at the intermediate seat.
      const roll = -h.model.side * HALF_PI * Math.sin(Math.PI * t);
      q.multiply(HandsRig._qTmp2.setFromAxisAngle(AXIS_VEC.x, roll));
    }
  }

  private currentWristAngle(h: HandState): number {
    if (h.weldAxis) return h.gripAngle + (h.weldAxis === 'x' && !h.weldWhole ? h.weldAngle : 0);
    const residual = 1 - this.handRecoveryProgress(h);
    return h.gripAngle + h.recoverWristAngle * residual;
  }

  private isHalfBranchSwitch(h: HandState): boolean {
    return this.regripFlag && Math.abs(h.recoverWristAngle) > Math.PI
      && Math.abs(Math.abs(h.gripAngle) - Math.PI) < 1e-6 && Math.abs(h.recoverQuat.w) > 1 - 1e-6;
  }

  /** Keep the hand and wrist pivot fixed. Only redirect the forearm toward a
   * neutral continuation of the hand. No inward/outward branch-specific bias. */
  private aimForearm(h: HandState, wrist: THREE.Vector3, elbow: THREE.Vector3, weight: number, relief: number, halfAim: number): THREE.Vector3 {
    const g = h.model.group;
    const turn = HandsRig._armTurn.copy(h.home.quat).invert().premultiply(g.quaternion).normalize();
    h.appliedArmWeight = weight;
    const direction = HandsRig._armDirection.copy(elbow).sub(wrist).normalize();
    if (weight > 0) {
      // Gradually let the elbow follow the hand's turn. Leaving the home elbow
      // fixed at 180° bent the wrist by about 135° and folded the skin over itself.
      const homeBack = HandsRig._armHome.copy(h.model.forearm?.bindDir ?? HandsRig._armNatural.set(-1, 0, 0)).applyQuaternion(h.home.quat);
      direction.lerp(homeBack, weight).normalize();
      turn.slerp(HandsRig._qIdent, 1 - weight);
      direction.applyQuaternion(turn);
    }
    const natural = HandsRig._armNatural.copy(h.model.forearm?.bindDir ?? HandsRig._armHome.set(-1, 0, 0))
      .applyQuaternion(g.quaternion).normalize();
    if (weight > 0) {
      // Keep the forearm nearer its home elbow rather than forcing it straight
      // behind the palm. Cap the flexed wrist at 80° (10° shy of a right angle).
      const bent = HandsRig._armHome.copy(elbow).sub(wrist).normalize();
      const bend = bent.angleTo(natural), limit = WRIST_BEND_MAX;
      if (bend > limit) {
        turn.setFromUnitVectors(bent, natural).slerp(HandsRig._qIdent, limit / bend);
        bent.applyQuaternion(turn);
      }
      direction.lerp(bent, weight).normalize();
    }
    // Enforce the existing wrist bend envelope on the final blended aim,
    // including single turns and the intermediate frames of a regrip.
    const bend = direction.angleTo(natural);
    const maxBend = WRIST_BEND_MAX;
    if (bend > maxBend) {
      turn.setFromUnitVectors(natural, direction);
      turn.slerp(HandsRig._qIdent, 1 - maxBend / bend);
      direction.copy(natural).applyQuaternion(turn);
    }
    if (h.model.radialAxis) {
      const radial = HandsRig._armHome.copy(h.model.radialAxis).applyQuaternion(g.quaternion).normalize();
      // direction points from wrist back to elbow, hence a negative projection
      // corresponds to radial deviation of the hand. Bound that component
      // independently of forearm roll and preserve the sagittal-plane aim.
      const lateral = THREE.MathUtils.clamp(direction.dot(radial), -1, 1);
      const limited = THREE.MathUtils.clamp(lateral, -WRIST_RADIAL_SIN, WRIST_ULNAR_SIN);
      if (limited !== lateral) {
        direction.addScaledVector(radial, -lateral).normalize()
          .multiplyScalar(Math.sqrt(1 - limited * limited)).addScaledVector(radial, limited);
      }
    }
    // Lead with the elbow while keeping the wrist pivot and all finger
    // contacts fixed. Ease the assistance in only on strongly bent wrists.
    let wristBend = direction.angleTo(natural);
    if (relief > 0) {
      const comfort = THREE.MathUtils.lerp(HandsRig.WRIST_COMFORT, HandsRig.HALF_WRIST_COMFORT, weight);
      const amount = relief * Math.max(0, wristBend - comfort) * THREE.MathUtils.smoothstep(wristBend, comfort, Math.PI / 3);
      if (amount > 0) {
        turn.setFromUnitVectors(direction, natural).slerp(HandsRig._qIdent, 1 - amount / wristBend);
        direction.applyQuaternion(turn);
        wristBend -= amount;
      }
    }
    if (halfAim > 0) {
      const extended = HandsRig._armHome.copy(h.halfPalm.extendedBack).applyQuaternion(g.quaternion).normalize();
      // Let the elbow follow part of the palm tilt instead of fixing the
      // seated forearm parallel to the cube edge. Both windings retain their
      // own extension and the wrist pivot stays on the authored grip.
      extended.applyQuaternion(turn.setFromUnitVectors(extended, natural).slerp(HandsRig._qIdent, .81));
      turn.setFromUnitVectors(direction, extended).slerp(HandsRig._qIdent, 1 - halfAim);
      direction.applyQuaternion(turn);
      wristBend = direction.angleTo(natural);
    }
    h.forearmAim.copy(wrist).addScaledVector(direction, elbow.distanceTo(wrist));
    h.appliedForearmRoll = 0;
    h.wristBend = wristBend;
    return direction;
  }

  // A settled half grip holds its material contacts while the other hand
  // plays. Re-evaluate on a signed grip change, a body toggle or any motion.
  private readonly settledHalf: Record<HandSide, { angle: number; body: SmplxBody | null; holding: MarkedFingerMotion | null } | null> = { L: null, R: null };

  private rightHalfSupportsUpperRelay(): boolean {
    const turn = this.active, order = this.cube?.order, right = this.hands?.R;
    return !!(turn && order && order >= 2 && order <= 4 && right && atHalfTurn(right.gripAngle)
      && turn.axis === 'y' && turn.layers.length === 1 && turn.layers[0] === order - 1 && turn.dir === -1
      && turn.gesture?.kind === 'flick' && turn.gesture.hand === 'L'
      && turn.gesture.finger === 'index' && turn.gesture.finger2 === 'middle');
  }

  private applyHand(side: HandSide, idle: boolean, dtMs = 0): void {
    const hands = this.hands;
    if (!hands) return;
    const h = hands[side];
    const g = h.model.group;
    const mark = this.markedMotion ?? (this.supportTransition?.motion.plan.hand === side ? this.supportTransition.motion : null);
    // A signed half grip can pinch the stationary bottom row during a marked
    // upper-wide turn. Preserve its fingers while sliding the pads along F/B.
    const wide = this.wideSupport?.hand === side ? this.wideSupport : null;
    const wideWeight = wide?.poseProgress ?? 0;
    const lowerSupport = !wide && mark && mark.plan.hand !== side && atHalfTurn(h.gripAngle)
      && mark.plan.request.axis === 'y' && mark.plan.request.layers.includes(2);
    const supportMotion = this.markedMotion ?? this.supportTransition?.motion;
    const pinchMotion = supportMotion?.plan.hand !== side ? supportMotion : null;
    const pinch = pinchMotion?.topPinch != null ? THREE.MathUtils.smoothstep(pinchMotion.topPinch, 0, 1)
      * (1 - THREE.MathUtils.smoothstep(pinchMotion.returning, .20, 1)) : 0;
    const clearing = h.indexEvade || h.lowEvade || h.midEvade || h.bEvade || h.fEvade || h.sEvade;
    if (this.fourSeat || wide || mark || pinchMotion?.topPinch != null || this.active || clearing) idle = false;
    // During a marked wide turn the other hand finishes clearing the layers
    // before the turn starts. Its clearance pose is constant until release.
    const holding = mark && mark.plan.hand !== side && mark.preparation === 1 && !mark.finished ? mark : null;
    const halfRelaySupport = side === 'R' && this.rightHalfSupportsUpperRelay();
    const order = this.cube?.order ?? 3;
    const turn = this.active;
    const sweep = turn?.gesture?.kind === 'flick' && turn.gesture.hand !== side && turn.layers.length === 1
      && !mark && !wide && !halfRelaySupport
      ? halfSupportClearance(order, h.gripAngle, turn.axis, turn.cls) : undefined;
    const lateralHandoff = this.isLateralHandoff(hands.R);
    const mixedHandoff = lateralHandoff && Math.abs(hands.R.gripAngle - hands.L.gripAngle) > .01;
    const settled = !mixedHandoff && !halfRelaySupport && Math.abs(Math.abs(h.gripAngle) - Math.PI) < 1e-8 && Math.abs(h.grip.x) > 1 - 1e-8
      && !wide && (!mark || holding) && !pinch && h.recoverT >= 1 && !h.weldAxis && !h.flickFinger && !h.pinFinger
      && !clearing;
    if (settled && !sweep && !this.fourSeat && !this.rightPinch) {
      idle = false;
      const body = this.body?.visible ? this.body : null;
      const cached = this.settledHalf[side];
      if (!h.forearmRotation.settling && cached && cached.angle === h.gripAngle && cached.body === body && cached.holding === holding) return;
      this.settledHalf[side] = { angle: h.gripAngle, body, holding };
    } else this.settledHalf[side] = null;
    h.halfPalm.contactSkin.restore();
    const sideSign = h.model.side;
    const q = HandsRig._qTmp;

    // 手根变换 = 偏移旋转(weld 实时 / 回位余量) ∘ 持久握姿基座 ∘ home。
    if (h.weldAxis) {
      q.setFromAxisAngle(AXIS_VEC[h.weldAxis], h.weldAngle);
    } else if (h.recoverT < 1) {
      // Explicit regrips ease both ends; turn overshoot decays from release.
      this.recoverOrientation(q, h, lateralHandoff && !mixedHandoff && Math.abs(h.gripAngle) < .01);
    } else {
      q.identity();
    }
    q.multiply(h.grip);
    g.quaternion.copy(q).multiply(h.home.quat);
    g.position.copy(h.home.pos).applyQuaternion(q);
    const referenceGrip = side === 'L' && this.loadedHands === 'left-thumb';
    if (referenceGrip) g.position.x += 20 * SIZE / 64;

    // topPush 有效原角(活跃 = 本值;提交后退场 = 虚拟续转 release / 原地缩回;
    // 收指段钳各自终点。姿态推导统一走它,见 TOP_PUSH.retreatSplit 注释)。
    let topEffRaw = 0;
    if (h.flickStyle === "topPush" && h.flickFinger) {
      const amt = Math.abs(h.flickAmount);
      if (h.flickDecay === 0 && h.reachTarget === 1) {
        topEffRaw = amt; // 活跃手势(driveGesture 每帧喂原角)
      } else if (amt >= TOP_PUSH.retreatSplit) {
        // 虚拟续转:原角推进到 release 走满(F2 提交本就 ≥ 该值,无缝)
        topEffRaw = amt + (1 - h.flickDecay)
          * Math.max(0, TOP_PUSH.releaseAt + TOP_PUSH.releaseLen * 1.2 - amt);
      } else {
        topEffRaw = amt * h.flickDecay; // 小角度残余原地缩回
      }
    }
    const pushFinger = h.flickStyle === 'upPush' ? 'index' : h.flickStyle === 'lowerPush' ? 'ring' : null;
    // The wrist follows the grip rotation itself. Fingers open around the
    // corners during recovery without adding a translation to that rotation.
    let regripOpen = 0, pinchOpen = 0;
    if (!h.weldAxis && h.recoverT < 1) {
      const angle = 2 * Math.acos(Math.min(1, Math.abs(h.recoverQuat.w)));
      if (angle > .3) {
        const progress = this.handRecoveryProgress(h);
        // Close on the intermediate seat before the other hand releases.
        const reach = this.wholeRegrip && angle > HALF_PI + .01 ? (2 * progress) % 1 : progress;
        const travel = Math.min(1, angle / HALF_PI);
        regripOpen = Math.sin(Math.PI * progress) * travel;
        pinchOpen = Math.sin(Math.PI * reach) * travel;
      }
    }

    if (mixedHandoff) {
      const separation = Math.abs(this.handRecoveryProgress(hands.R) - this.handRecoveryProgress(hands.L));
      regripOpen = Math.max(regripOpen, Math.sin(Math.PI * separation));
    }

    // 待机微动:极轻的呼吸浮动(位移 ±1.0,相位左右手错开)。禁走 z —— 那是
    // B/F 接触法向,肉面标定间隙只 ~0.8U,呼吸会周期性吃穿;改沿本侧外向 x
    // (掌与 R/L 面之间本就留 ~97U 空腔,纯切向安全)。换握回位途中(recoverT<1)
    // 禁全部;y 呼吸只在 home 握走 —— up/down 握下 y 变成拇指/指列的 U/D 接触
    // 法向(L 拇指间隙只 1.25U,旧 ±2.64U 呼吸周期性吃穿 1.4U,oracle 2026-07-07
    // 现形,存量 bug);外向 x 在任意绕 x 握姿下都切向安全,保留。指弹进行中
    // (flickFinger)也禁全部 —— topPush 无 weld,呼吸会叠在按压接触上抖
    // (±2U 噪声 > 1.2U 接触间隙,标定/oracle 全被污染,2026-07-07 现形)。
    // Seat the supporting fingers as the wrists enter the grip, before F starts.
    const partner = hands[side === 'R' ? 'L' : 'R'];
    // Between the two half-grip windings the palm stays on the same face.
    // The interpolated wrist angle passes through down without taking a down grip.
    const supportedByLower = this.cube?.order === 3 && !this.isHalfBranchSwitch(partner)
      ? Math.max(0, -Math.sin(this.currentWristAngle(partner))) : 0;
    const wristAngle = this.currentWristAngle(h);
    const upperBrace = supportedByLower * Math.max(0, Math.sin(wristAngle));
    const lowerBrace = supportedByLower * Math.max(0, -Math.sin(wristAngle));
    const homeBrace = supportedByLower * Math.max(0, Math.cos(wristAngle));
    const partnerStyle = hands[side === 'L' ? 'R' : 'L'].flickStyle;
    const canBreathe = !this.pocketPushSupport && partnerStyle !== 'upPush' && partnerStyle !== 'lowerPush' && partnerStyle !== 'frontIndexNail' && idle && !this.singleMarkSeat && !this.wideSupport?.homeUpper && !h.weldAxis && !h.flickFinger && h.recoverT >= 1;
    h.idleBlend = canBreathe ? Math.min(1, h.idleBlend + dtMs / 180) : 0;
    if (canBreathe) {
      const blend = THREE.MathUtils.smoothstep(h.idleBlend, 0, 1) * (1 - supportedByLower);
      const t = this.idleClock / 1000;
      const ph = side === "R" ? 0 : 1.7;
      // y 呼吸幅度 0.4(旧 1.0):2026-07-09 拇指 home 抬进 E 层带后可见肉
      // y∈[−30.9,30.9],距 ±32 带界只剩 ~1.1U —— 旧 ±2.2U 呼吸会周期性把
      // 拇指肉推出 E 带(L 相位 1.7 起手即 +2.18,实测 33.2)。
      if (h.grip.w > 0.9999) g.position.y += Math.sin(t * 1.1 + ph) * 0.4 * HAND_SCALE * blend;
      g.position.x += Math.cos(t * 0.9 + ph) * 0.8 * HAND_SCALE * blend * (sideSign === -1 ? 1 : -1);
    }

    const elbowTarget = HandsRig._elbowTarget.copy(h.elbow);
    const thumbStroke = h.flickStyle === 'frontThumbNail' ? frontThumbNailPose(THREE.MathUtils.radToDeg(Math.abs(h.flickAmount))) : null;
    const thumbWeight = thumbStroke ? THREE.MathUtils.smoothstep(h.reachT, 0, 1) * (h.flickDecay || 1) : 0;
    if (thumbStroke) {
      const shift = HandsRig._vTmp.set(thumbStroke.x, thumbStroke.y, thumbStroke.z).multiplyScalar(thumbWeight);
      g.position.add(shift);
      elbowTarget.add(shift);
      const roll = HandsRig._qTmp2.setFromAxisAngle(AXIS_VEC.z, -THREE.MathUtils.degToRad(thumbStroke.rollDegrees) * thumbWeight);
      g.quaternion.premultiply(roll);
    }
    if (h.flickStyle === 'upperRingRelay') {
      const seat = THREE.MathUtils.smoothstep(h.reachT, 0, 1) * (h.flickDecay || 1);
      // Approach the back sticker from behind and withdraw from the driving side.
      const releasing = h.flickDecay > 0;
      const clearance = releasing ? .25 + .75 * (1 - seat) ** 2 : .32;
      const arc = 4 * seat * (1 - seat) * clearance;
      const offset = HandsRig._relayOffset.set(
        -sideSign * (13 * seat + (releasing ? 100 : 65) * arc),
        53 * seat,
        -8 * seat - (releasing ? 39 : 10) * arc,
      );
      g.position.add(offset);
      elbowTarget.add(offset);
    }
    const nailStroke = isSliceNail(h.flickStyle) && this.cube?.order === 3 && h.flickFinger
      ? mixedGripPose(h.flickStyle, h.reachT, THREE.MathUtils.radToDeg(Math.abs(h.flickAmount)),
        h.flickDecay > 0 ? 1 - h.flickDecay : 0) : null;
    if (nailStroke) {
      const nailAxis = HandsRig._vTmp.copy(AXIS_VEC.z).applyQuaternion(h.grip);
      const roll = HandsRig._qTmp2.setFromAxisAngle(nailAxis, nailStroke[6] * sideSign);
      g.position.applyQuaternion(roll);
      g.quaternion.premultiply(roll);
      elbowTarget.applyQuaternion(roll);
    }
    const opposite = hands[side === 'L' ? 'R' : 'L'];
    let sliceBrace = 0;
    if (this.cube?.order === 3 && isSliceNail(opposite.flickStyle) && opposite.flickFinger && h.grip.angleTo(GRIP_Q_DOWN) < .01) {
      sliceBrace = THREE.MathUtils.smoothstep(opposite.reachT, 0, .85)
        * (opposite.flickDecay > 0 ? THREE.MathUtils.smoothstep(opposite.flickDecay, 0, .35) : 1);
      const offset = sideSign * lowerSliceBrace.lateral * sliceBrace;
      g.position.x -= offset;
      elbowTarget.x -= offset;
    }
    const four = this.fourSeat;
    const innerRelay = four?.axis === 'x' && four.gesture.kind === 'flick' && four.gesture.hand === side && this.usesFittedRingRelay(four);
    const innerRelayRelease = this.cube?.order === 4 && h.flickAxis === 'x' && h.strokeLayers.length === 1
      && (h.strokeLayers[0] === 1 || h.strokeLayers[0] === 2);
    const middleRelaySeat = innerRelay ? THREE.MathUtils.smoothstep(four.progress, 0, 1)
      : !innerRelayRelease && h.flickStyle === 'middleSlicePad' && h.flickFinger2 === 'pinky'
        ? THREE.MathUtils.smoothstep(h.reachT, 0, 1) * THREE.MathUtils.smoothstep(h.flickDecay || 1, 0, 1) : 0;
    if (middleRelaySeat) {
      const delta = HandsRig._vTmp.set((side === 'R' ? -1 : 1) * M_RELAY_SHIFT.x, M_RELAY_SHIFT.y, 0);
      if (innerRelay) delta.applyQuaternion(h.grip);
      delta.multiplyScalar(middleRelaySeat);
      g.position.add(delta);
      elbowTarget.add(delta);
    }
    let braceProfile: InnerBraceProfile | undefined;
    if (four?.axis === 'x' && four.gesture.kind === 'weld' && four.gesture.hands.includes(side)) {
      // Bring the palm over the moving block before the wrist starts turning.
      // A single face retains its original wrist position.
      const inside = four.layers.length === 3 ? SIZE * 1.25 : four.layers.length === 2 ? SIZE / 2 : 0;
      const shift = (side === 'R' ? -1 : 1) * inside * THREE.MathUtils.smoothstep(four.progress, 0, 1);
      g.position.x += shift;
      elbowTarget.x += shift;
    }
    if (four?.gesture.kind === 'flick' && !four.layers.includes(3) && !four.layers.includes(0)) {
      const driver = four.gesture.hand === side;
      let shift = 0;
      if (four.layers.length === 1 || four.axis === 'x' && this.usesFittedRingRelay(four)) {
        braceProfile = innerBraceProfile(four, h.grip, driver, this.usesFittedRingRelay(four));
        if (braceProfile === 'innerX' || braceProfile === 'innerXRelay') shift = side === 'R' ? -20 : 20;
        if (braceProfile === 'lowerY' || braceProfile === 'upperY') shift = four.layers[0] === 2 ? -38 : 38;
      } else if (driver && four.axis === 'y') {
        const row = four.gesture.finger2 === 'middle' ? 2 : (Math.min(...four.layers) + Math.max(...four.layers)) / 2;
        const center = (row - 1.5) * SIZE * .75;
        shift = center - (four.gesture.finger === 'index' ? 62 : -62);
      }
      shift *= THREE.MathUtils.smoothstep(four.progress, 0, 1);
      g.position[four.axis] += shift;
      elbowTarget[four.axis] += shift;
    }
    if (four && four.progress > 0 && four.progress < 1 && four.gesture.kind === 'flick' && four.gesture.hand === side
      && (this.usesFittedRingRelay(four) || four.axis === 'x' && four.gesture.style === 'middleSliceNail' && !four.gesture.finger2)) {
      // Approach outside the fixed shell. Fade the arc to zero before either
      // digit drives its sticker and retrace it as the seated palm withdraws.
      const p = four.progress;
      const arc = 4 * p * (1 - p) * THREE.MathUtils.smoothstep(Math.min(p, 1 - p), 0, .12);
      const clearance = HandsRig._vTmp.fromArray(innerRingApproachOffset(four.axis, four.dir, !!four.gesture.finger2, side));
      g.position.addScaledVector(clearance, arc);
      elbowTarget.addScaledVector(clearance, arc);
    }
    const carryForearm = mark?.applyWrist(side, g, elbowTarget) ?? false;

    // 手指姿态 = home 弯曲 + flick 偏移。
    const sm = (t: number): number => t * t * (3 - 2 * t);
    const decayK = h.flickDecay > 0 ? h.flickDecay : 1;
    const flickA = h.flickFinger ? h.flickAmount * decayK : 0;
    // 连拨(FINGERTRICKS §4.1):未钳制原角按象限拆两指 —— 首指扫 [0,90°] 后保持
    // 末姿不恢复,次指前 90° 就位、[90°,180°] 接力;drop 后 decayK 同乘,两指
    // 一起恢复(用户硬规则)。
    const isDouble = h.flickFinger2 !== null;
    const rawAbs = Math.abs(h.flickAmount);
    const pocketPose = order === 2 || (this.active ? isFourWide(order, this.active.layers)
      : !!h.flickFinger && isFourWide(order, h.strokeLayers));
    const pocketRelay = pocketPose && isDouble
      && (h.flickStyle === 'backHook' || h.flickStyle === 'hook' && h.flickFinger === 'pinky');
    const strokeSide = pocketRelay ? 'L' : side;
    const strokeMirror = pocketRelay && side === 'R' ? -1 : 1;
    const rawSign = h.flickAmount < 0 ? -1 : 1;
    const amt1 = isDouble ? Math.min(rawAbs, HALF_PI) * decayK : 0;
    const amt2 = isDouble ? Math.max(0, Math.min(rawAbs - HALF_PI, HALF_PI)) * decayK : 0;
    // 回撤禁倒放(2026-07-08 真实播放 oracle 现形 −27U):fit 是「贴面路径」,
    // decay 若把 s 缩小 = 沿接触曲线倒放,而提交后层角已归零(魔方恢复整体),
    // 倒放中段的贴面姿态直接穿进复位的层。改为 s 取未缩层角、decayK 只乘 fit
    // 输出 —— 回撤变成关节空间直线回 home(末端 fit(1)≈0 由 endHome 正则拉住,
    // 起点即终姿,途中不再重返扫掠带)。
    const sRaw1 = Math.min(rawAbs, HALF_PI) / HALF_PI;
    const sRaw2 = Math.max(0, Math.min(rawAbs - HALF_PI, HALF_PI)) / HALF_PI;
    const prep = sm(sRaw1);
    const prep2T = isDouble ? prep * decayK : 0;
    const indexHookRelay = h.flickStyle === 'hook' && h.flickFinger === 'index' && h.flickFinger2 === 'middle';
    // F 族遗留分支避让按本手握姿选指(见 F_EVADE 注释):up = 拇指+无名指在
    // F 带内 / down = 食指在 F 带内 / home 与非标准握的指肉都在带外,不动。
    // Hold the support pose throughout the marked turn. Seat it while the
    // driving index approaches, then let it recover as that finger withdraws.
    const frontSupport = opposite.flickStyle === 'frontIndexNail' ? sm(opposite.reachT) * (opposite.flickDecay || 1) : 0;
    const supportEvade = Math.max(h.fEvade, frontSupport);
    let fEvadeGrip: GripName | null = null;
    if (supportEvade > 0) {
      if (h.grip.angleTo(GRIP_Q_UP) < 0.01) fEvadeGrip = "up";
      else if (h.grip.angleTo(GRIP_Q_DOWN) < 0.01) fEvadeGrip = "down";
    }
    // S 族避让同款握姿选指(见 S_EVADE 注释):up/down 握拇指+中指探进 S 带,
    // home 与非标准握的指肉都在带外,不动。
    let sEvadeGrip: GripName | null = null;
    const sliceClearance = Math.max(h.sEvade, sliceBrace);
    if (sliceClearance > 0) {
      if (h.grip.angleTo(GRIP_Q_UP) < 0.01) sEvadeGrip = "up";
      else if (h.grip.angleTo(GRIP_Q_DOWN) < 0.01) sEvadeGrip = "down";
    }
    // A lower 2×2 turn sweeps the corners underneath both front and back
    // support pads. Open those digits as the square's projected width grows.
    const pocketTurn = pocketPose ? this.active : null;
    const pushDriver = pushFinger ? h : isHomePushStyle(partnerStyle) ? partner : null;
    const pocketPushSeat = sm(this.pocketPushSupport);
    let lowerClearance = 0, frontClearance = 0, upperPhase: number | undefined;
    if (pocketTurn && pocketTurn.axis !== 'x' && pocketTurn.cls !== 'whole') {
      const angle = pocketTurn.lastAngle;
      const sweep = (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)) - 1) / (Math.SQRT2 - 1);
      // Convert the moving face normal to the resting hand's frame. A wrist
      // turn changes which world face borders its thumb and middle pads.
      const normal = HandsRig._vTmp.copy(AXIS_VEC[pocketTurn.axis])
        .multiplyScalar(pocketTurn.cls === 'high' ? -1 : 1)
        .applyQuaternion(HandsRig._qTmp2.copy(h.grip).invert());
      if (normal.y > .99) {
        const direction = Math.sign(angle) * (pocketTurn.cls === 'high' ? 1 : -1);
        const phase = THREE.MathUtils.radToDeg(Math.abs(angle)) % 90;
        upperPhase = direction === (side === 'R' ? 1 : -1) ? 90 - phase : phase;
      }
      if (normal.y < -.99) lowerClearance = sweep * (2 - sweep);
      if (normal.z > .99) frontClearance = sweep;
    }
    let frontPadWeight = 1;
    for (const name of ["thumb", "index", "middle", "ring", "pinky"] as const) {
      const f = h.model.fingers[name];
      const pose = h.home.fingers[name];
      let c1 = pose.curl[0];
      let c2 = pose.curl[1];
      if (name === 'ring' && upperBrace > 0) {
        c1 += F_EVADE[side].ring.c1 * upperBrace;
        c2 += F_EVADE[side].ring.c2 * upperBrace;
      } else if (name === 'index' && lowerBrace > 0) {
        c1 += F_EVADE[side].index.c1 * lowerBrace;
        c2 += F_EVADE[side].index.c2 * lowerBrace;
      } else if (name === 'thumb') {
        if (opposite.flickStyle === 'frontThumbNail' && Math.abs(h.grip.w) > .99999) {
          // Let the front sticker slide past the resting thumb while the wrist stays home.
          c1 += .035 * Math.sin(2 * Math.min(HALF_PI, Math.abs(opposite.flickAmount))) * (opposite.flickDecay || 1);
        }
        // The neutral thumb pad sits just clear of the front plane, including
        // when both hands start at home and the corner passes the resting pad.
        const pairedHome = this.cube?.order === 3 ? Math.max(0, Math.cos(this.currentWristAngle(partner))) * Math.max(0, Math.cos(wristAngle)) : 0;
        c2 -= .001 * Math.max(homeBrace, pairedHome);
        if (nailStroke && Math.abs(h.grip.w) > .99999) c2 -= .0015 * sm(h.reachT) * (h.flickDecay || 1);
      }
      let c3 = pose.curl[2];
      let splay = pose.splay * sideSign;
      if (h.flickStyle === 'upperRingRelay') {
        const raised = sm(h.reachT) * decayK;
        if (name === 'thumb') c1 -= .65 * raised;
        if (name === 'middle') {
          // Keep the passage open until the ring finger has withdrawn.
          const support = h.flickDecay > 0 ? Math.sqrt(raised) : raised;
          c1 -= .13 * support;
          splay += .11 * sideSign * support;
        }
      }
      // r11 轴向扭转(FingerCurl.twist,Euler x 槽,此前恒 0):拇指 CMC 旋前 /
      // 四指指柱滚转。topPush 叠加标定的食指 twist，其余动作保持姿态层值。
      let twist = (pose.twist ?? 0) * sideSign;
      let metaCurl = 0, metaSplay = 0, metaTwist = 0;
      // topPush 伸指是时间驱动(reachT),层角为零的前置/回收期间也要摆位。
      let hookPose: number[] | undefined;
      let pm = pose.mid;
      if (referenceGrip) {
        const reach = this.thumbTapReach;
        const clearance = this.thumbGripClearance;
        // Keep the palm in home grip. Only the pads near U yield to its corners.
        if (name === 'thumb' && pm) {
          // Keep the middle joint flexed as the pad reaches the UFL/F sticker.
          c1 += .027 - .3348 * reach;
          c2 -= .0665 * reach;
          c3 = .03 + .2925 * reach;
          splay += .022 + .0315 * reach;
          twist += .3280 * reach;
          pm = [pm[0] - .1694 * reach, pm[1] + .1310 * reach];
        } else if (name === 'index') {
          c1 -= .18 * clearance;
          splay += .16 * clearance ** 2;
        } else if (name === 'middle') {
          splay -= .11 * clearance;
        }
      }
      if (pocketPushSeat && name === 'middle') {
        // Seat the pad once on the B-side corner before pushing. Both hands
        // hold the same pose throughout the layer turn, in either direction.
        const seat = pocketPushMiddle;
        c1 += (seat[0] - c1) * pocketPushSeat;
        c2 += (seat[1] - c2) * pocketPushSeat;
        c3 += (seat[2] - c3) * pocketPushSeat;
        splay += (seat[3] * sideSign - splay) * pocketPushSeat;
        twist += (seat[4] * sideSign - twist) * pocketPushSeat;
        pm = [THREE.MathUtils.lerp(pm?.[0] ?? 0, seat[5], pocketPushSeat),
          THREE.MathUtils.lerp(pm?.[1] ?? 0, seat[6], pocketPushSeat)];
      }
      const secondTopPush = h.flickStyle === 'topPush' && h.flickFinger2 === name;
      const topPush = h.flickStyle === "topPush" && (h.flickFinger === name || secondTopPush);
      // 本指角色与负担扫角(带符号):单指 = 全量;连拨首指钳 90°、次指接后半。
      const role = h.flickFinger === name ? 1 : h.flickFinger2 === name ? 2 : 0;
      if (pocketPose) {
        if (name === 'middle') {
          if (!pushDriver) c1 -= .18 * lowerClearance;
          if (secondTopPush) {
            // The relay is fitted from its raised seat. Interpolate from the
            // relaxed lower corner without moving its contact in quarter two.
            c1 += (.03 - POCKET_MIDDLE_CURL) * prep2T * h.reachT;
            splay += (-.105 - POCKET_MIDDLE_SPLAY) * prep2T * h.reachT * sideSign;
          }
          if (role === 2 && !secondTopPush) {
            // The relay reaches the original upper corner. Blend from the
            // lower pocket seat into its calibrated second-finger trajectory.
            c1 -= POCKET_MIDDLE_CURL * prep2T;
            if (indexHookRelay) c1 -= .003 * Math.sin(Math.PI * sRaw2) * decayK;
            if (h.flickDecay > 0) c1 -= .048 * Math.sin(Math.PI * prep2T);
            splay -= POCKET_MIDDLE_SPLAY * prep2T * sideSign;
          }
        } else if (name === 'thumb') {
          splay += .13 * lowerClearance * sideSign;
          if (role === 0) c2 -= .030 * frontClearance;
        }
      }
      // B 族静止指避让(见 BACK_EVADE 注释):backHook 期间静止的中/无名指抬离 B 面。
      if ((name === "middle" || name === "ring") && role === 0 && h.flickStyle === "backHook") {
        const ev = BACK_EVADE[side];
        const tEv = sm(Math.min(1, rawAbs / 0.12)) * decayK;
        c1 += ev.c1 * tEv;
        c2 += ev.c2 * tEv;
        c3 += ev.c3 * tEv;
        splay += ev.splay * tEv;
      }
      // U 族静止手食指离面避让(见 HOOK_INDEX_EVADE 注释):弹指发生在另一只
      // 手上,本手无 flick 状态,进度走 tick 推进的 indexEvade(role===0 兜住
      // 「上一步避让还在回落、本手食指已开始弹下一步」的重叠帧)。
      if (name === "index" && role === 0 && h.indexEvade > 0) {
        const ev = HOOK_INDEX_EVADE[side];
        c1 += ev.c1 * h.indexEvade;
        c2 += ev.c2 * h.indexEvade;
        c3 += ev.c3 * h.indexEvade;
        splay += ev.splay * h.indexEvade;
      }
      // FTN @pin 钉指(weld 前置贴块,见 WELD_PIN):就位/收指时间驱动,weld
      // 段 pinReachT 保持 1,姿态随手刚体转。transit = sin(π·t) 转移凸包。
      if (name === h.pinFinger && h.pinReachT > 0) {
        const pinPose = WELD_PIN[side][name];
        if (pinPose) {
          const t = sm(h.pinReachT);
          c1 += pinPose.c1 * t;
          c2 += pinPose.c2 * t;
          c3 += pinPose.c3 * t;
          splay += pinPose.splay * t;
          const tr = Math.sin(Math.PI * h.pinReachT);
          c1 += WELD_PIN_TRANSIT.c1 * tr;
          c2 += WELD_PIN_TRANSIT.c2 * tr;
          c3 += WELD_PIN_TRANSIT.c3 * tr;
          splay += WELD_PIN_TRANSIT.splay * tr;
        }
      }
      // @pin 期间中指收避(见 WELD_PIN_MID_TUCK):weld 静区扫掠安全前提。
      if (name === "middle" && h.pinFinger === "index" && h.pinReachT > 0) {
        c1 += WELD_PIN_MID_TUCK * sm(h.pinReachT);
      }
      // D 族静止手无名指避让(见 LOW_EVADE 注释):弹指发生在
      // 另一只手上,进度走 tick 推进的 lowEvade(role===0 兜重叠帧,同上)。
      // splay 两手镜像符号已烘入表内,不 ×sideSign。
      if (name === "ring" && role === 0 && h.lowEvade > 0) {
        const ev = LOW_EVADE[side][name];
        c1 += ev.c1 * h.lowEvade;
        c2 += ev.c2 * h.lowEvade;
        c3 += ev.c3 * h.lowEvade;
        splay += ev.splay * h.lowEvade;
      }
      // B 族静止手「食指 + 中指」单指避让(见 B_EVADE 注释):弹指发生在另一只
      // 手上,进度走 tick 推进的 bEvade。`role===0 || flickDecay>0` 同 F/S 族:
      // 上一步本手弹指还在回落时 role 仍是 1/2,只认 role===0 会漏掉这段 ——
      // 2026-07-25 真实播放 "U2 B2" 相接实测 R 食指被 B 层扫 3.3U(3 帧)。
      if ((name === "index" || name === "middle") && (role === 0 || h.flickDecay > 0) && h.bEvade > 0) {
        const ev = B_EVADE[side][name];
        c1 += ev.c1 * h.bEvade;
        c2 += ev.c2 * h.bEvade;
        c3 += ev.c3 * h.bEvade;
        splay += ev.splay * h.bEvade;
      }
      // F 族遗留分支单指避让(见 F_EVADE 注释):受害不分弹指手,两手同走
      // tick 推进的 fEvade,按本手握姿选指;splay 镜像符号已烘入表内,不
      // ×sideSign。role===0 兜重叠帧;弹指手指自身在 decay 段(flickDecay>0)
      // 也要吃 evade —— 同类连发(F 接 F')时上一步的弹指拇指正随 decayK 回落
      // 回 home 位,恰落进下一步的扫掠区(真实播放 oracle 实测 10.6U),且
      // decay 清零瞬间 role 0 才生效会造成单帧姿态跳变;正在扫的弹指
      // (flickDecay===0)不避,指尖要沿面扫。
      if ((role === 0 || h.flickDecay > 0) && supportEvade > 0 && fEvadeGrip !== null
        && (fEvadeGrip === "up" ? name === "thumb" || name === "ring" : name === "index")) {
        const ev = F_EVADE[side][name as "thumb" | "ring" | "index"];
        c1 += ev.c1 * supportEvade;
        c2 += ev.c2 * supportEvade;
        c3 += ev.c3 * supportEvade;
        splay += ev.splay * supportEvade;
      }
      // S 族 up/down 握「拇指 + 中指」单指避让(见 S_EVADE 注释):受害不分
      // 弹指手,两手同走 tick 推进的 sEvade,按本手握姿选指(home 握不动);
      // splay 镜像符号已烘入表内,不 ×sideSign。role===0 兜重叠帧;弹指手指
      // 自身在 decay 段(flickDecay>0)也吃 evade(同 F_EVADE:同类连发时
      // 上一步弹指中指随 decayK 回落恰落进下一步扫掠区,且免 decay 清零瞬间
      // 的单帧姿态跳变);正在扫的弹指中指(flickDecay===0)不避,自己扫开。
      if ((role === 0 || h.flickDecay > 0) && sliceClearance > 0 && sEvadeGrip !== null
        && (name === "thumb" || name === "middle")) {
        const ev = S_EVADE[side][name];
        c1 += ev.c1 * sliceClearance;
        c2 += ev.c2 * sliceClearance;
        c3 += ev.c3 * sliceClearance;
        splay += ev.splay * sliceClearance;
      }
      // E 族双手「拇指 + 中指」单指避让(见 MID_EVADE 注释):受害不分弹指手,
      // 两手同走 tick 推进的 midEvade(role===0 兜重叠帧,同上)。
      if ((name === "thumb" || name === "middle") && role === 0 && h.midEvade > 0) {
        const ev = MID_EVADE[side][name];
        c1 += ev.c1 * h.midEvade;
        c2 += ev.c2 * h.midEvade;
        c3 += ev.c3 * h.midEvade;
        splay += ev.splay * h.midEvade;
      }
      // E 族弹指无名指扫掠抬离(见 MID_EVADE 注释):legacy 勾弯标定于旧整手
      // dodge=62 之下,dodge 归零后扫掠中段 / softClamp 保持段 / 回撤会探进
      // E 带(裸基线 4.3~4.8U),叠一层沿 B 面外法线(−z)的基节伸展偏置。
      // !flickStyle 挡掉 styled hook(D 族无名指有自己的贴面 fit)。
      if (name === "ring" && role === 1 && !h.flickStyle && h.midEvade > 0) {
        const ev = MID_EVADE[side].ring;
        c1 += ev.c1 * h.midEvade;
        c2 += ev.c2 * h.midEvade;
        c3 += ev.c3 * h.midEvade;
        splay += ev.splay * h.midEvade;
      }
      const share = !isDouble ? (role === 1 ? flickA : 0) : (role === 1 ? amt1 : amt2) * rawSign;
      const engaged = role === 1
        ? (h.reachT > 0 || share !== 0)
        : role === 2 && (prep2T > 0 || share !== 0 || (isMiddleSliceStroke(h.flickStyle) && h.reachT > 0));
      if (engaged && h.flickStyle !== 'pocketThumbLift') {
        // 弹指(前后钳形握姿)分扫法,匹配接触点处层面的真实运动方向:
        //  拇指(F 族):折叠的中节展开 → 沿 F 面向上大扫幅;
        //  y 轴(U/D/E,食指/无名指)与 hook/backHook:层动水平朝本手掌心 →
        //  向掌心勾弯横拉(真实拨 U 是「勾」;反向伸展会向手背过伸 —— 用户报障);
        //  downPush/upPush:压面推层(FINGERTRICKS §4.3/§4.5);
        //  x/z 轴中指(M/B/S 族):接触立柱处层动是竖直的 → splay 竖扫为主。
        const open = Math.min(1, Math.abs(share) / HOOK.open);
        const angle = THREE.MathUtils.radToDeg(rawAbs);
        if (h.flickStyle === 'frontIndexNail' && name === 'index') {
          hookPose = frontIndexNailPose(angle, sm(h.reachT), h.flickDecay);
        } else if (thumbStroke && name === 'thumb') {
          hookPose = fingerChannels(pose).map((value, i) => THREE.MathUtils.lerp(value, thumbStroke.finger[i], thumbWeight));
          // Flex the base slightly as the nail peels away from the front sticker.
          if (h.flickDecay > 0) hookPose[0] += .8 * thumbWeight * (1 - thumbWeight);
        } else if (h.flickStyle === 'upperRingRelay' && (name === 'index' || name === 'ring')) {
          hookPose = upperRingRelayPose(name, angle, sm(h.reachT) * decayK, fingerChannels(pose));
        } else if (pushFinger && name === pushFinger && h.flickFinger === pushFinger) {
          hookPose = homePushPose(pushFinger, angle, sm(h.reachT), decayK, fingerChannels(pose), order);
        } else if (h.flickStyle === 'lowerHook' && (name === 'ring' || name === 'pinky')) {
          hookPose = lowerHookPose(name, angle, isDouble, sm(h.reachT), decayK, fingerChannels(pose));
        }
        if (hookPose) {
          [c1, c2, c3] = hookPose;
          splay = hookPose[3] * sideSign;
          twist = hookPose[4] * sideSign;
          [metaCurl, metaSplay, metaTwist] = hookPose.slice(5, 8);
        } else if (isMiddleSliceStroke(h.flickStyle)) {
          const reverseFour = order === 4 && h.flickStyle === 'middleSliceNail' && !isDouble;
          const degrees = rawAbs * 180 / Math.PI;
          const p = reverseFour
            ? middleSlicePose('middleSlicePad', false, false, Math.max(0, 90 - degrees), h.reachT, decayK, fingerChannels(pose), order)
            : middleSlicePose(h.flickStyle, role === 2, isDouble, degrees, h.reachT, decayK, fingerChannels(pose), order);
          [c1, c2, c3, splay, twist, metaCurl, metaSplay, metaTwist] = p;
          if (p.length > 8) pm = [p[8], p[9]];
          if (side === 'R') { splay = -splay; twist = -twist; }
        } else if (nailStroke) {
          [c1, c2, c3] = nailStroke;
          splay = nailStroke[3] * sideSign;
          [metaCurl, metaSplay] = nailStroke.slice(4, 6);
        } else if (isMixedPush(h.flickStyle)) {
          const release = h.flickDecay > 0 ? 1 - h.flickDecay : 0;
          const p = mixedGripPose(h.flickStyle, h.reachT, THREE.MathUtils.radToDeg(rawAbs), release, order);
          [c1, c2, c3] = p;
          splay = p[3] * sideSign;
          twist = p[4] * sideSign;
          pm = [p[5], p[6]];
        } else if (h.flickStyle === 'reverseRingHook' && name === 'ring') {
          const fit = HOOK_FOLLOW[side].hook_ring;
          const travel = 1 - sRaw1;
          const reach = sm(h.reachT);
          c1 += fitAt(fit, 'c1', travel) * reach;
          c2 += fitAt(fit, 'c2', travel) * reach;
          c3 += fitAt(fit, 'c3', travel) * reach;
          splay += fitAt(fit, 'splay', travel) * reach;
        } else if ((h.flickStyle === 'indexHook' || h.flickStyle === 'reverseIndexHook') && name === 'index') {
          const reverse = h.flickStyle === 'reverseIndexHook';
          const degrees = reverse ? Math.max(0, 90 - THREE.MathUtils.radToDeg(rawAbs)) : THREE.MathUtils.radToDeg(rawAbs);
          const release = reverse ? 1 - h.reachT : h.flickDecay > 0 ? 1 - h.flickDecay : 0;
          hookPose = homeIndexHook(degrees, release);
          [c1, c2, c3] = hookPose;
          splay = hookPose[3] * sideSign;
          if (pocketPose) {
            // The larger corner sticker has a wider margin at its outer edge.
            // Keep the pad seated as contact rolls toward the nail.
            const contact = THREE.MathUtils.smoothstep(degrees, 15, 28)
              * (1 - THREE.MathUtils.smoothstep(degrees, 37, 47));
            c1 += .004 * contact * (1 - release);
            splay -= .015 * contact * (1 - release) * sideSign;
            const handoff = THREE.MathUtils.smoothstep(degrees, 49, 54)
              * (1 - THREE.MathUtils.smoothstep(degrees, 56, 62));
            c1 += .001 * handoff * (1 - release);
          }
          twist = hookPose[4] * sideSign;
          [metaCurl, metaSplay, metaTwist] = hookPose.slice(5, 8);
        } else if (topPush && h.flickAxis === 'z' && h.flickLayer === 'mid') {
          // S / S′ presses through 45°, then lifts and unwinds the
          // index. Keeping the pad attached until 90° would overtwist the MCP.
          const home = [pose.curl[0], pose.curl[1], pose.curl[2], pose.splay, 0, 0, 0, 0];
          const returning = h.flickDecay > 0 ? 1 - h.flickDecay
            : h.reachTarget === 0 && rawAbs > 0 ? 1 : 0;
          const p = sliceIndexPose(rawAbs * 180 / Math.PI, returning, h.reachT, home, TOP_PUSH);
          [c1, c2, c3] = p;
          splay = p[3] * sideSign;
          twist = ((pose.twist ?? 0) + p[4]) * sideSign;
          [metaCurl, metaSplay, metaTwist] = p.slice(5);
        } else if (topPush) {
          // 食指下按(home 握 F 族及上手 U):reach(时间驱动)先抬(splay 竖直离开
          // B 面)后卷(c1 大幅前卷 + 中末节拉直,指链横越 U 面上方),指尖
          // 落到起拨贴纸上方。转动段物理跟随:press 从转动
          // 一开始压满(推动=接触),食指关节跟随、手掌固定;释放段
          // (releaseAt 后)press 渐出 + releaseLift 抬离扫掠区,层滑行收尾。
          // 收指 reachT 倒放同路径。
          // Upper-grip U has a different supporting thumb and contact plane.
          const frontStroke = h.flickAxis === 'z';
          const FW = frontStroke ? FRONT_INDEX_FOLLOW : TOP_PUSH_FOLLOW[side];
          const strokeAngle = secondTopPush ? sRaw2 * HALF_PI : rawAbs;
          const frontReturn = strokeAngle >= TOP_PUSH.retreatSplit
            && (strokeAngle > HALF_PI || h.flickDecay > 0 || h.reachTarget === 0);
          const pathAngle = frontReturn ? Math.min(strokeAngle, HALF_PI) : secondTopPush ? strokeAngle : topEffRaw;
          const reach = frontReturn && h.reachTarget === 0 ? 1 : secondTopPush ? prep * h.reachT : h.reachT;
          // Start the front sweep while the finger is still rising. This keeps
          // the tip moving over the edge instead of pausing at the top.
          const initialLift = sm(Math.min(1, reach / TOP_PUSH.liftIn));
          const liftT = frontStroke ? (initialLift + sm(reach)) / 2 : initialLift;
          const sweepT = sm(Math.max(0, (reach - TOP_PUSH.sweepStart) / (1 - TOP_PUSH.sweepStart)));
          // reach 早段微伸(sin 包络):抬升弧面稍向内斜,顶着 B 面上沿滑会
          // 蹭进 2.65U(oracle),c1 退一点让指腹离面爬升。
          const backOffPhase = Math.min(1, reach / .35);
          const backOff = Math.sin(Math.PI * backOffPhase) * TOP_PUSH.backOff
            * (1 - THREE.MathUtils.smoothstep(backOffPhase, .62, 1));
          // 接触跟随:指腹跟随起拨处的实体贴纸(全程接触规格),knot 曲线随
          // 弧位置 φ_eff 展开(knot0 即按压姿,reach 到位即贴住);release(F2
          // 第二象限)/ 收指沿同曲线倒放 —— φ_eff 退回 = 手指原路撤离,见
          // topPushArcPhi 注释。
          const phi = topPushArcPhi(pathAngle);
          // As the nail rolls down the sticker, leave the web between the
          // stationary middle and active index room to fold.
          frontPadWeight = 1 - THREE.MathUtils.smoothstep(phi,
            THREE.MathUtils.degToRad(50), THREE.MathUtils.degToRad(68));

          // U first withdraws beneath the fixed U5 thumb, then lifts away. An
          // immediate lift intersects the thumb with the index nail on release.
          const relLift = topPushReleaseLift(pathAngle, .4);
          const followGate = sm(reach);
          c1 += sweepT * TOP_PUSH.c1 - backOff + followAt(FW.c1, phi) * followGate;
          c2 += sweepT * TOP_PUSH.c2 + followAt(FW.c2, phi) * followGate;
          c3 += sweepT * TOP_PUSH.c3 + followAt(FW.c3, phi) * followGate;
          // 抬升方向 = 世界 +y;splay 局部符号在镜像资产下左右相反,×sideSign
          // (R 实测 splay 负=抬升;L 反之)。releaseLift 挂 followGate:活跃段
          // 恒 1 无影响,收指段随 reach 渐出(从带抬离的按压位平滑归位)。
          const releaseLift = .235 - .125 * THREE.MathUtils.smoothstep(topPushRelease(pathAngle), .65, 1);
          splay += (liftT * TOP_PUSH.lift + relLift * releaseLift * followGate
            + .075 * Math.sin(Math.PI * reach) ** 2
            + followAt(FW.splay, phi) * followGate) * sideSign;
          twist += followAt(FW.twist, phi) * followGate * sideSign;
          metaCurl = followAt(FW.metaCurl, phi) * followGate;
          metaSplay = followAt(FW.metaSplay, phi) * followGate;
          metaTwist = followAt(FW.metaTwist, phi) * followGate;
          metaSplay += .055 * relLift * followGate;
          if (frontReturn) {
            // F2 uses the second quadrant for most of its withdrawal. A
            // quarter starts here on commit; both finish on the recovery clock.
            const upperDouble = h.flickAxis === 'y' && strokeAngle > HALF_PI;
            const layerTravel = THREE.MathUtils.clamp((strokeAngle - HALF_PI) / HALF_PI, 0, 1);
            // Upper U2 only spends the unplayed part of quadrant two on its decay clock.
            const travel = .8 * (upperDouble && h.flickDecay > 0 ? 1 - h.flickDecay : layerTravel);
            const retreat = secondTopPush ? 1 - h.reachT
              : h.reachTarget === 0 ? 1 - (upperDouble ? 1 : .4) * h.reachT
              : !upperDouble && h.flickDecay > 0 ? .6 * (1 - h.flickDecay) : 0;
            const t = sm(travel + (1 - travel) * retreat);
            const departure = [c1, c2, c3, splay * sideSign, twist * sideSign - (pose.twist ?? 0),
              metaCurl, metaSplay, metaTwist];
            const p = frontIndexReturn(pose, departure, t);
            [c1, c2, c3] = p;
            splay = p[3] * sideSign;
            twist = ((pose.twist ?? 0) + p[4]) * sideSign;
            [metaCurl, metaSplay, metaTwist] = p.slice(5);
            frontPadWeight = THREE.MathUtils.lerp(frontPadWeight, 1, THREE.MathUtils.smoothstep(t, 0, .28));
          }
        } else if (h.flickStyle === "downPush") {
          // Absolute author-space finger poses; the other fingers and palm stay fixed.
          const finger = name === "middle" ? "middle" : "index";
          const home = [pose.curl[0], pose.curl[1], Math.max(.03, pose.curl[2]), pose.splay, 0, 0, 0, 0];
          const p = frontDownPose(finger, rawAbs * 180 / Math.PI, isDouble,
            h.flickDecay > 0 ? 1 - h.flickDecay : 0, home);
          [c1, c2, c3] = p;
          splay = p[3] * sideSign;
          twist = ((pose.twist ?? 0) + p[4]) * sideSign;
          [metaCurl, metaSplay, metaTwist] = p.slice(5);
        } else if (name === "thumb") {
          c1 -= open * 0.25;
          c2 -= open * 0.9;
          c3 -= open * 0.35;
        } else if (h.flickStyle === "hook" || h.flickStyle === "backHook" || h.flickAxis === "y") {
          // 「勾」的合成(y 族默认;双中手接触样式 hook 含连拨;B'/B 背钩
          // backHook 同族 —— B 面顶带在 z 旋转下切向水平移动,勾法同 U):
          // 基节伸展把指尖抬离层面(位置上退,不扎进转动层),中/末节加弯给出
          // 可见的向掌心勾弯(用户规格:拨 U 手指要弯,禁向手背反弓)。
          if (role === 2 && prep2T > 0) {
            // 连拨次指就位(U2 中指上探 / D2' 无名指让位 / B2 中指上探顶带);
            // 键按样式区分(hook 与 backHook 的中指就位目标不同)。
            const p = HOOK_PREP[strokeSide][`${h.flickStyle}_${name}`];
            if (p) {
              c1 += p.c1 * prep2T;
              c2 += p.c2 * prep2T;
              c3 += p.c3 * prep2T;
              splay += p.splay * prep2T * sideSign;
              // 中指准备时侧让；起点和交接点的附加侧展都为零。
              if (indexHookRelay) splay -= .85 * prep2T * (1 - prep) * sideSign;
            }
          }
          if (name === "pinky" && h.reachT > 0) {
            // D2' 首指小指:前置伸至 D 层 BDR 接触位(prepareTwist reach)
            const smR = sm(h.reachT);
            c1 += PINKY_REACH.c1 * smR;
            c2 += PINKY_REACH.c2 * smR;
            c3 += PINKY_REACH.c3 * smR;
            splay += PINKY_REACH.splay * smR * sideSign;
          }
          // 接触样式且有标定跟随曲线 → 二次型跟随(贴面);否则回退旧勾弯。
          const fit = h.flickStyle
            ? HOOK_FOLLOW[strokeSide][`${h.flickStyle}_${name}${role === 2 ? "2" : ""}`] : undefined;
          if (fit) {
            const s = role === 2 ? sRaw2 : (isDouble ? sRaw1 : Math.min(rawAbs, HALF_PI) / HALF_PI);
            // 钉角 M 端姿的 per-style 回撤覆盖(见 RETREAT_LIFT_STYLED):贴块
            // 提交姿 pad 离贴纸只 ~1.4U,fit(1)×decayK 的第一帧就往贴纸里拉
            // (oracle 实测 0.8U)—— 攻窗(decayK ∈ [0.88,1])先钳 kFit=1 保持
            // 提交姿,等回撤凸包升满再沿直线衰减;凸包包络仍走 decayK。
            const returningLead = indexHookRelay && role === 1 && h.flickDecay > 0;
            const rlS = h.flickDecay > 0
              ? RETREAT_LIFT_STYLED[side][returningLead ? 'hook_indexRelay'
                : `${h.flickStyle}_${name}${role === 2 ? "2" : ""}`] : undefined;
            const fitHold = rlS ? Math.min(1, decayK / .88) : decayK;
            // 首指已离块，接近中握时平滑收去退场姿，避免指尖沿直线切过块角。
            const kFit = returningLead ? sm(fitHold) : fitHold;
            c1 += fitAt(fit, "c1", s) * kFit;
            c2 += fitAt(fit, "c2", s) * kFit;
            c3 += fitAt(fit, "c3", s) * kFit;
            splay += fitAt(fit, "splay", s) * kFit * strokeMirror; // 每手独立标定,含侧向符号
            // U2 首指沿较短的弧线提前让开角 M，给接力中指留出空间。
            // 此后保持到提交，避免来料角块扫过食指。
            if (role === 1 && isDouble && h.flickStyle === "hook" && name === "index") {
              const ex = sm(Math.min(1, sRaw2 / HOOK_EXIT.window)) * kFit;
              c1 += HOOK_EXIT.c1 * ex;
              c2 += HOOK_EXIT.c2 * ex;
              c3 += HOOK_EXIT.c3 * ex;
              splay += HOOK_EXIT.splay * ex * sideSign;
            }
            // B2/B2' 连拨首指退场(BACK_EXIT 注释):Q1 末端姿在角柱扫掠环带
            // 内(径向 ~105U),Q2 前 20% 内沿 −z 拉出;splay 符号已烘入表。
            if (role === 1 && isDouble && h.flickStyle === "backHook" && name === "index") {
              const bx = BACK_EXIT[strokeSide];
              const ex = sm(Math.min(1, sRaw2 / HOOK_EXIT_IN)) * kFit;
              c1 += bx.c1 * ex;
              c2 += bx.c2 * ex;
              c3 += bx.c3 * ex;
              splay += bx.splay * ex * strokeMirror;
            }
            if (h.flickDecay > 0) {
              // 包络说明见 downPush 分支同款注释;非钉角样式回落默认 RETREAT_LIFT。
              // 首指已让位，可以放慢抬离；中指仍按贴块端姿的时序退回。
              const attack = returningLead ? .25 : .12;
              const lift = sm(Math.min(1, (1 - decayK) / attack)) * sm(Math.min(1, decayK / .15)) * s;
              const rl: { c1: number; c2: number; c3: number; splay?: number } = rlS ?? RETREAT_LIFT;
              c1 += rl.c1 * lift;
              c2 += rl.c2 * lift;
              c3 += rl.c3 * lift;
              splay += (rl.splay ?? 0) * lift;
            }
          } else {
            c1 += HOOK.c1 * open;
            c2 += HOOK.c2 * open;
            c3 += HOOK.c3 * open;
            splay += softClampAngle(share) * HOOK.drift * (side === "R" ? 1 : -1) * sideSign;
          }
        } else {
          // x/z 族竖扫。世界系扫向:z 族(B/S)两手各推自己那根立柱,方向随
          // dir 与手绑定(右列 down=dir 正);x 族(M/E' 同轴)绕 x 转时整个
          // B 面同向竖移,与手无关 —— 先算世界竖向 vy,再按「右手 splay 正
          // = 世界向下 / 左手相反」换算符号(不能用镜像对称公式:绕 x 的旋转
          // 在 x=0 镜像下不变,两手需求会打架,推导见 memory)。
          c1 -= open * 0.15;
          c2 -= open * 0.25;
          c3 -= open * 0.3;
          const vy = (h.flickAxis === "z" && side === "L" ? 1 : -1) * Math.sign(share);
          splay += (side === "R" ? -1 : 1) * vy * 0.45 * Math.abs(share);
        }
      }
      // 换握张手:行程中段把弯曲压掉大半(见 regripOpen 注释),指尖伸展
      // 离开抓握半径;splay 不动(横向散开会互相打架)。
      // The thumb and a support finger take the intermediate hold. Free fingers
      // remain clear while the opposite hand passes around that corner.
      const supportDigit = mixedHandoff && side === 'L' ? 'ring' : 'index';
      const opening = name === 'thumb' || name === supportDigit ? pinchOpen : regripOpen;
      if (opening > 0) {
        if (name === "thumb") {
          // 拇指例外(2026-07-09 E 带姿):四指「张」= 压 curl 伸直离开抓握
          // 半径,但拇指压的是 F 面、末节大弯(c3≈1.1)—— 同款压 curl 会把
          // 指尖伸直戳进 F 面(regrip oracle 实测 7.6U;旧姿 c3=0.55 时 2.9U
          // 已有暴露)。拇指的「张」= 轻开 curl + 绕根节向贴面外甩
          // (沿旧 D 拇指避让方向,随 open 渐入),yz 径向甩出箱体对角
          // 扫掠区。幅度 regrip play oracle 标定。
          const k = 1 - opening * 0.3;
          c1 *= k;
          c2 *= k;
          c3 *= k;
          c2 -= 0.16 * opening;
          splay += (side === "R" ? -1 : 1) * 0.4 * opening;
        } else {
          // oracle 标定:0.6 时 180° 换握中段剩 3.2U,0.72 剩 0.46U(↓→↑),
          // 0.78 全零(旧平摊 curl);2026-07-07 home 加弯档后残余绝对弯曲
          // 变大,中段指尖勾 U 面 1.38U → 提到 0.86。
          const k = 1 - opening * 0.86;
          c1 *= k;
          c2 *= k;
          c3 *= k;
        }
      }
      if (pocketTurn?.axis === 'z' && h.flickStyle === 'backHook' && name === 'index' && role === 1) {
        // Clear the far corner near the end of a back flick.
        const degrees = THREE.MathUtils.radToDeg(rawAbs);
        c1 -= .006 * THREE.MathUtils.smoothstep(degrees, 55, 70)
          * (1 - THREE.MathUtils.smoothstep(degrees, 80, 90));
      }
      const upper = this.wideSupport?.homeUpper ? this.wideSupport : null;
      const markedPose = upper ? upper.homeUpperPose(name, side !== upper.hand) : wide ? undefined : mark?.pose(side, name, !!lowerSupport || pinch > 0);
      if (wide) {
        const p = wide.pose(name);
        if (wide.frontHome && name === 'thumb') {
          splay += .004 * sideSign * wide.weight;
        } else if (p) {
          [c1, c2, c3] = p;
          splay = p[3] * sideSign;
          twist = p[4] * sideSign;
          pm = [p[5], p[6]];
        } else if (wide.anchors.includes(name)) {
          [c1, c2, c3] = pose.curl;
          splay = pose.splay * sideSign;
          twist = (pose.twist ?? 0) * sideSign;
        }
      }
      if (middleRelaySeat && (name === 'thumb' || name === 'index' || name === 'middle')) {
        const p = middleSliceSupport(name, middleRelaySeat);
        [c1, c2, c3, splay, twist, metaCurl, metaSplay, metaTwist] = p;
        if (name === 'thumb') pm = [p[8], p[9]];
        if (side === 'R') { splay = -splay; twist = -twist; }
      }
      if (markedPose) {
        [c1, c2, c3] = markedPose;
        splay = markedPose[3] * sideSign;
        twist = markedPose[4] * sideSign;
        metaCurl = markedPose[5] - (pose.meta?.[0] ?? 0);
        metaSplay = markedPose[6] - (pose.meta?.[1] ?? 0);
        metaTwist = markedPose[7] - (pose.meta?.[2] ?? 0);
      }
      if (h.flickStyle === 'lowerHook' && name === 'pinky') {
        // Open the ulnar side of the palm as the ring takes over. Keep the
        // little finger's contact through its own quarter, then clear its base.
        const takingOver = isDouble ? THREE.MathUtils.smoothstep(rawAbs, 1.566, 1.72) : 1;
        metaSplay -= .16 * takingOver * sm(h.reachT) * decayK;
      }
      if (h.flickStyle === 'lowerHook' && name === 'ring' && isDouble) {
        const handoff = THREE.MathUtils.smoothstep(rawAbs, 1.45, 1.54) * (1 - THREE.MathUtils.smoothstep(rawAbs, 1.64, 1.76));
        metaSplay += .070 * handoff * decayK;
      }
      // Give free sweeps a weak distal response to PIP flexion. Contact
      // trajectories and support fingers keep their individually fitted DIP.
      if (role && !h.flickStyle && !markedPose && name !== 'thumb') {
        const coupled = pose.curl[2] + .65 * (c2 - pose.curl[1]);
        c3 = THREE.MathUtils.lerp(c3, coupled, .2);
      }
      // Flexion acts in the binding segment's x/z plane. Use its measured
      // rest bend when applying these rig envelopes (radians). CMC opposition
      // and thumb MCP out-of-plane rotation have separate calibrated channels.
      const limits = name === 'thumb' ? THUMB_HINGES : FINGER_HINGES;
      // When the middle slab turns too, its leading corner reaches the
      // resting thumb early and the middle finger late in each quarter.
      if (order === 3 && h.strokeLayers.length === 2 && (h.flickStyle === 'downPush' || h.flickStyle === 'lowerHook')) {
        const degrees = THREE.MathUtils.radToDeg(rawAbs), phase = degrees % 90;
        if (name === 'thumb') c1 += .20 * THREE.MathUtils.smoothstep(phase, 0, 6)
          * (1 - THREE.MathUtils.smoothstep(phase, 17, 27)) * decayK;
        if (name === 'middle' && (h.flickStyle === 'lowerHook' || degrees < 90))
          c1 -= .09 * THREE.MathUtils.smoothstep(phase, 61, 68) * (1 - THREE.MathUtils.smoothstep(phase, 77, 90)) * decayK;
      }
      const downRing = role === 1 && name === 'ring' && order === 3 && !isDouble && h.flickStyle === 'middleSliceNail';
      const [middleRest, distalRest] = f.restBend ?? [0, 0];
      // The D-side roll uses a shallow extension at the PIP and allows a small
      // nail-first tilt at the DIP. Apply these limits in the bound finger's frame.
      const middleMin = downRing ? -THREE.MathUtils.degToRad(3) - middleRest : limits.middleMin;
      const distalMin = downRing ? -THREE.MathUtils.degToRad(10) - distalRest : .03;
      c2 = THREE.MathUtils.clamp(c2, middleMin, limits.middleMax - middleRest);
      c3 = THREE.MathUtils.clamp(c3, distalMin, limits.distalMax - distalRest);
      // Transport the surface only as far as this finger has articulated
      // away from its resting grip. A wrist rotation alone has zero weight.
      if (name === 'index' || name === 'middle' || name === 'ring') {
        const excursion = Math.max(Math.abs(c1 - pose.curl[0]), Math.abs(c2 - pose.curl[1]),
          Math.abs(splay - pose.splay * sideSign), Math.abs(twist - (pose.twist ?? 0) * sideSign));
        h.skinStroke[name] = role && !markedPose ? THREE.MathUtils.smoothstep(excursion, .04, .38) : 0;
      }
      // 指根 = 基座朝向 ∘ (curl/splay/twist)。四指基座为 identity;拇指基座是
      // 对掌位四元数 —— 直接写 rotation 会抹掉它(踩过),必须叠加。
      // Euler 序 'YZX':R = Ry(curl)·Rz(splay)·Rx(twist),twist 最内层 = 先绕
      // 作者系长轴旋转、再随屈曲侧摆带走。最终骨长轴扭转见 finalPose.root.axialTwist。'XYZ' 的
      // twist 是绕**绑定**轴的定轴旋转,大幅 swing 后语义漂成进动,r11 踩过。
      // twist=0 时两序等价(Ry·Rz),历史姿态逐位不变。
      HandsRig._eTmp.set(twist, -c1, splay, "YZX");
      f.root.quaternion.setFromEuler(HandsRig._eTmp).premultiply(f.rootBase);
      // 中节:默认纯铰链;姿态层可给出平面通道(拇指 MCP 外展+旋前,r11)。
      const calibrated = markedPose ?? hookPose;
      if (calibrated) pm = [calibrated[8], calibrated[9]];
      if (pm) {
        f.mid.rotation.set(pm[0] * sideSign, -c2, pm[1] * sideSign, "YZX");
      } else {
        f.mid.rotation.set(0, -c2, 0);
      }
      f.tip.rotation.set(0, -c3, 0);
      // 掌骨关节(r11 掌弓通道):euler 在掌骨作者系解读,手系共轭施加
      // (meta rest 局部 = identity → 缺省姿态与旧「焊死」行为逐位一致)。
      if (f.meta && f.metaBase) {
        const m = pose.meta;
        if (m || metaCurl !== 0 || metaSplay !== 0 || metaTwist !== 0) {
          HandsRig._eTmp.set(((m?.[2] ?? 0) + metaTwist) * sideSign,
            -((m?.[0] ?? 0) + metaCurl), ((m?.[1] ?? 0) + metaSplay) * sideSign, "YZX");
          f.meta.quaternion.setFromEuler(HandsRig._eTmp).premultiply(f.metaBase)
            .multiply(HandsRig._qTmp2.copy(f.metaBase).invert());
        } else {
          f.meta.quaternion.identity();
        }
      }
      if (sliceBrace && (name === 'thumb' || name === 'index')) {
        // Extend to the static row after the palm clears the corner.
        const contactWeight = sliceBrace ** 5;
        applyPocketFingerPose(f, lowerSliceBrace[name], contactWeight, sideSign);
        f.root.rotateZ(-.006 * sliceBrace * sideSign);
        if (name === 'thumb') {
          f.mid.rotateX(lowerSliceBrace.thumbMid[0] * contactWeight * sideSign);
          f.mid.rotateZ(lowerSliceBrace.thumbMid[1] * contactWeight * sideSign);
        }
      }
    }
    let indexSkin = 0, middleSkin = 0, indexSkinRoll = 0, gripStretchWeight = 0;
    const frontPress = h.flickLayer === 'high' && (h.flickStyle === 'topPush'
      || h.flickStyle === 'downPush');
    if (frontPress) {
      const relay = h.flickFinger2 === 'middle';
      const weight = relay ? 1 - .85 * THREE.MathUtils.smoothstep(rawAbs, HALF_PI, Math.PI) : 1;
      const surfaceWeight = h.flickStyle === 'topPush' ? sm(h.reachT)
        : THREE.MathUtils.smoothstep(rawAbs, 0, .26) * (h.flickDecay > 0 ? sm(Math.min(1, 5 * h.flickDecay)) : 1);
      if (h.flickFinger === 'index') {
        easeFingerKnuckle(h.model.fingers.index, weight);
        if (h.flickAxis === 'z' || h.flickStyle === 'downPush') {
          h.skinStroke.index = surfaceWeight;
          const edge = h.flickStyle === 'topPush' ? THREE.MathUtils.smoothstep(rawAbs, 1.25, HALF_PI) : 0;
          indexSkinRoll = alignFrontIndex(h.model.fingers.index, h.home.fingers.index, sideSign, 1 - .8 * edge);
        }
        // Both proximal surfaces approach the same web at the relay.
        const handoff = relay ? .15 + .85 * THREE.MathUtils.smoothstep(Math.abs(rawAbs - HALF_PI), .045, .24) : 1;
        indexSkin = surfaceWeight * handoff;
        if (h.flickAxis === 'z' && h.flickStyle === 'topPush')
          gripStretchWeight = indexSkin * THREE.MathUtils.smoothstep(rawAbs, 1.30, HALF_PI);
      }
      if (relay) {
        easeFingerKnuckle(h.model.fingers.middle, weight);
        const middleReturn = h.flickDecay > 0 ? THREE.MathUtils.smoothstep(h.flickDecay, .35, .58) : 1;
        middleSkin = indexSkin * middleReturn * THREE.MathUtils.smoothstep(rawAbs, .7 * HALF_PI, HALF_PI);
        if (h.flickAxis === 'z' || h.flickStyle === 'downPush') h.skinStroke.middle = middleSkin;
      }
    }
    if ((h.flickStyle === 'indexHook' || h.flickStyle === 'reverseIndexHook') && h.flickFinger === 'index') {
      const movement = h.flickStyle === 'reverseIndexHook' ? (HALF_PI - rawAbs) * h.reachT : rawAbs;
      const moving = THREE.MathUtils.smoothstep(movement, .25, .75);
      // The hook is fitted directly to the online curl and distal contact.
      // Smooth the proximal skin without counter-rotating the PIP.
      indexSkin = moving * (h.flickDecay > 0 ? sm(h.flickDecay) : 1);
      gripStretchWeight = indexSkin;
    }
    if (this.wideSupport?.homeUpper && this.wideSupport.hand !== side) {
      this.wideSupport.seatIndex(h.model.fingers.index, side === 'R' ? 1 : -1, THREE.MathUtils.radToDeg(rawAbs), decayK);
    }
    const palmTurn = HandsRig._armTurn.copy(h.home.quat).invert().premultiply(g.quaternion).normalize();
    const displayedPalmWeight = halfGripWeight(2 * Math.acos(Math.min(1, Math.abs(palmTurn.w))));
    const targetPalmWeight = halfGripWeight(2 * Math.acos(Math.min(1, Math.abs(h.grip.w))));
    // Explicit regrips let the arm join immediately; live layer turns blend
    // in after 90°. Derive this once, before the corrective palm rotation.
    // Marked turns already calibrate the wrist and all five fingers together.
    // Keep the starting grip's correction; treating their wrist delta as a
    // new half grip applies a second bend and makes the free fingers cross.
    const palmWeight = h.weldWhole || nailStroke || mark?.plan.hand === side ? targetPalmWeight
      : this.regripFlag && h.recoverT < 1
      ? THREE.MathUtils.lerp(h.regripArmWeight, targetPalmWeight, this.handRecoveryProgress(h))
      : displayedPalmWeight;
    const winding = THREE.MathUtils.clamp(wristAngle / Math.PI, -1, 1);
    // Face turns with calibrated contact paths still use their authored
    // support. Signed half turns seat the entire gripping hand as one unit.
    const switching = this.isHalfBranchSwitch(h);
    const carrying = h.weldAxis && this.active?.gesture?.kind === 'weld' && this.active.gesture.hands.includes(side);
    const release = h.recoverT < 1 ? h.halfSeatRelease : undefined;
    const signedHalf = atHalfTurn(h.gripAngle) || !!release
      || h.recoverT < 1 && atHalfTurn(h.gripAngle + h.recoverWristAngle);
    let halfAim = signedHalf ? palmWeight : 0, seatWinding = winding;
    let transport: THREE.Quaternion | undefined;
    if (carrying) {
      // Carry the current grip in the moving frame until the turn commits.
      halfAim = atHalfTurn(h.gripAngle) ? 1 : 0;
      seatWinding = Math.sign(h.gripAngle);
      transport = HandsRig._qTmp2.setFromAxisAngle(AXIS_VEC[h.weldAxis!], h.weldAngle);
    } else if (release) {
      const leaving = atHalfTurn(release.source), t = this.handRecoveryProgress(h);
      halfAim = leaving ? 1 - t : t;
      seatWinding = Math.sign(leaving ? release.source : h.gripAngle);
      if (leaving) transport = HandsRig._qTmp2.setFromAxisAngle(AXIS_VEC.x, release.layerAngle);
    } else if (this.wholeRegrip && h.recoverT < 1 && signedHalf) {
      transport = HandsRig._qTmp2.copy(h.recoverQuat).slerp(HandsRig._qIdent, this.handRecoveryProgress(h));
    }
    h.halfPalm.apply(signedHalf || carrying && h.weldAxis === 'x' ? 0 : palmWeight, winding);
    const thumbRoll = carrying && h.weldAxis === 'x' && !h.weldWhole && atHalfTurn(h.gripAngle)
      ? carriedThumbWeight(h.gripAngle, h.weldAngle)
      : h.recoverT < 1 ? h.halfThumbReturn * (1 - this.handRecoveryProgress(h)) : 0;
    const slide = lowerSupport ? THREE.MathUtils.smoothstep(mark.preparation, 0, .85)
      * (1 - THREE.MathUtils.smoothstep(mark.returning, 0, .65)) : 0;
    if (wide?.moves) halfAim *= 1 - wideWeight;
    if (braceProfile && four) halfAim *= 1 - THREE.MathUtils.smoothstep(four.progress, 0, 1);
    halfAim *= 1 - pinch;
    if (halfAim > 0) {
      h.halfPalm.placeStandard(halfAim, seatWinding, switching, transport, !!release || pinch > 0, Math.abs(thumbRoll));
      if (lowerSupport && pinchMotion?.topPinch == null) {
        h.halfPalm.slideToBottomRow(halfAim * slide, seatWinding);
      } else if (!wide && !lowerSupport && mark && mark.plan.hand !== side && mark.plan.request.axis === 'y') {
        // Both front and back pads border the rotating layer. Release the
        // grip laterally before the turn, then return on the same path.
        const support = THREE.MathUtils.smoothstep(mark.preparation, 0, .4)
          * (1 - THREE.MathUtils.smoothstep(mark.returning, 0, .3));
        g.position.x -= h.model.side * halfAim * support * 1.5 * SIZE;
      }
    }
    if (this.wideSupport?.homeUpper) {
      const slide = this.wideSupport.shift.y * this.wideSupport.slideWeight;
      g.position.y += slide;
      elbowTarget.y += slide;
    } else if (wide?.moves) {
      g.position.addScaledVector(wide.shift, wide.slideWeight);
      elbowTarget.addScaledVector(wide.shift, wide.slideWeight);
      g.position.x += wide.lateralClearance;
      elbowTarget.x += wide.lateralClearance;
    }
    if (pinch) {
      const clearance = this.markedMotion ? THREE.MathUtils.smoothstep(this.markedMotion.preparation, 0, .8)
        * (1 - THREE.MathUtils.smoothstep(this.markedMotion.returning, 0, .35)) : 0;
      h.halfPalm.liftPinch(pinch, wristAngle, clearance, elbowTarget, halfAim);
    }
    if (thumbRoll) {
      const layerAngle = carrying ? h.weldAngle
        : (release?.layerAngle ?? 0) + h.recoverWristAngle * (1 - this.handRecoveryProgress(h));
      h.halfPalm.rollCarriedThumb(thumbRoll, layerAngle);
    }
    // The even-order half grip straddles the equatorial seam even when the
    // next move is a single outer layer. Use its seated pads during idle too.
    if ((order === 2 || order === 4) && !mark && halfAim > 0) {
      const { index, middle, thumb } = h.model.fingers;
      if (seatWinding > 0) {
        const turningTop = pocketTurn?.axis === 'y' && pocketTurn.cls === 'high' && pocketTurn.lastAngle * (side === 'R' ? 1 : -1) > 0;
        const degrees = turningTop ? THREE.MathUtils.radToDeg(Math.abs(pocketTurn.lastAngle)) % 90 : 0;
        // The thumb follows the passing corner while the opposite pads support the grip.
        seatPocketFinger(thumb, halfThumb, degrees, halfAim, side === 'R' ? 1 : -1);
        if (thumbRoll) thumb.root.rotateY(.004 * Math.abs(thumbRoll));
        middle.root.rotateY(.014 * halfAim);
        h.model.fingers.ring.root.rotateY(.006 * halfAim);
        if (pocketTurn?.axis === 'z' && pocketTurn.cls === 'high' && !h.flickFinger) {
          const phase = THREE.MathUtils.radToDeg(Math.abs(pocketTurn.lastAngle)) % 90;
          const roll = THREE.MathUtils.smoothstep(phase, 45, 64) * (1 - THREE.MathUtils.smoothstep(phase, 78, 90));
          index.root.rotateY(.019 * halfAim * roll);
        }
        if (turningTop && h.flickFinger === 'index') {
          const lift = THREE.MathUtils.smoothstep(degrees, 0, 16)
            * (1 - THREE.MathUtils.smoothstep(degrees, 39, 58));
          index.root.rotateY(.052 * lift * halfAim);
        }
      } else if (seatWinding < 0) {
        const driven = pocketTurn?.axis === 'y' && pocketTurn.cls === 'low'
          && pocketTurn.gesture?.kind === 'flick' && pocketTurn.gesture.style === 'reverseRingHook';
        const degrees = driven ? THREE.MathUtils.radToDeg(Math.abs(pocketTurn.lastAngle)) : 0;
        const mirror = side === 'R' ? 1 : -1;
        seatPocketFinger(index, halfDownIndex, degrees, halfAim, mirror);
        seatPocketFinger(thumb, halfDownThumb, degrees, halfAim, mirror);
        middle.root.rotateY(.013 * halfAim);
      }
    }
    if (pocketPose && !mark) {
      const { index, middle, thumb } = h.model.fingers;
      const faceStroke = h.flickStyle === 'pocketThumbLift' ? pocketFrontThumb
        : pocketRelay ? (h.flickStyle === 'backHook' ? pocketBackRelay : pocketBottomRelay) : null;
      if (faceStroke) {
        const reach = faceStroke === pocketBackRelay ? 1 : THREE.MathUtils.smoothstep(h.reachT, 0, 1);
        applyPocketFaceStroke(faceStroke, THREE.MathUtils.radToDeg(rawAbs), decayK, reach,
          side === 'L' ? 1 : -1, h.model.fingers, g.position, elbowTarget);
      }
      if (!pushDriver && upperPhase !== undefined && halfAim === 0 && h.flickFinger2 !== 'middle' && h.flickFinger !== 'middle') {
        // Support the lower row below the moving edge, including F from a down grip.
        seatPocketFinger(middle, homeMiddleClearance, upperPhase, 1, side === 'R' ? 1 : -1);
      }
      if (h.flickStyle === 'hook' && h.flickFinger === 'ring' && !isDouble && h.flickLayer === 'low') {
        seatPocketFinger(h.model.fingers.ring, side === 'L' ? leftDownRing : rightDownRing,
          THREE.MathUtils.radToDeg(rawAbs), decayK);
        if (side === 'R' && h.flickDecay > 0) {
          const release = 1 - decayK;
          const lift = THREE.MathUtils.smoothstep(release, 0, .024) * (1 - THREE.MathUtils.smoothstep(release, .032, .07));
          h.model.fingers.ring.root.rotateY(-.009 * lift);
        }
      }
      if (h.flickStyle === 'reverseRingHook') {
        const degrees = THREE.MathUtils.radToDeg(rawAbs);
        const mirror = side === 'L' ? 1 : -1;
        seatPocketFinger(h.model.fingers.ring, reverseRingContact, degrees, h.reachT, mirror);
        seatPocketFinger(middle, reverseRingSupport, degrees, h.reachT, mirror);
        // Curl around the stationary lower corner before making contact.
        seatPocketFinger(h.model.fingers.ring, reverseRingApproach, h.reachT * 100, 1 - sRaw1, mirror);
      }
      if (!isDouble && !h.flickStyle && h.flickFinger === 'index' && h.flickAxis === 'y'
        && h.flickLayer === 'high' && h.grip.angleTo(GRIP_Q_DOWN) < .01) {
        const angle = THREE.MathUtils.radToDeg(rawAbs);
        const lift = THREE.MathUtils.smoothstep(angle, 0, 6) * (1 - THREE.MathUtils.smoothstep(angle, 16, 27));
        index.root.rotateY(.021 * lift * decayK);
        index.mid.rotateY(.012 * lift * decayK);
        if (h.flickDecay > 0) {
          // Retract around the stationary lower corner after the layer commits.
          const release = 1 - decayK;
          const clearance = THREE.MathUtils.smoothstep(release, .20, .45)
            * (1 - THREE.MathUtils.smoothstep(release, .72, 1));
          index.root.rotateY(.078 * clearance);
          index.mid.rotateY(.025 * clearance);
        }
      }
      if (h.flickAxis === 'z' && h.flickLayer === 'low' && !h.flickStyle && h.flickFinger === 'middle') {
        thumb.mid.rotateY(.012 * Math.min(1, rawAbs / Math.PI) * decayK);
      }
    }
    // All three orders have the same displayed edge length. Keep the pocket
    // relay's arc, adjusting flexion where the narrower outer cuts pass the pad.
    const supportGrip = this.hands!.R.grip;
    const leftTopRelay = indexHookRelay && (order === 3 || order === 4) && side === 'L' && h.strokeLayers.length === 1 && h.strokeLayers[0] === order - 1
      && (order === 4 || supportGrip.angleTo(HandsRig._qIdent) >= .01);
    if (!mark && (pocketPose || leftTopRelay) && isDouble && h.flickAxis === 'y'
      && h.flickLayer === 'high' && h.flickFinger2 === 'middle') {
      const { index, middle, thumb } = h.model.fingers;
      const degrees = THREE.MathUtils.radToDeg(rawAbs);
      if (h.flickStyle === 'topPush') {
        const mirror = side === 'R' ? 1 : -1;
        seatPocketFinger(middle, upperMiddle, degrees, h.reachT, mirror);
        seatPocketFinger(index, upperIndexClearance, degrees, h.reachT, mirror);
        seatPocketFinger(h.model.fingers.ring, upperRingClearance, degrees, h.reachT, mirror);
        seatPocketFinger(thumb, upperThumbClearance, degrees, h.reachT, mirror);
      } else if (indexHookRelay) {
        seatPocketFinger(index, side === 'R' ? homeIndex : leftIndex, degrees, leftTopRelay ? 1.32 * decayK : decayK);
        if (side === 'R' && h.flickDecay > 0) {
          const unwind = THREE.MathUtils.smoothstep(decayK, .26, .39)
            * (1 - THREE.MathUtils.smoothstep(decayK, .44, .56));
          middle.root.rotateZ(-.013 * unwind);
          middle.mid.rotateY(-.010 * unwind);
        }
        seatPocketFinger(middle, side === 'R' ? homeMiddle : leftMiddle, degrees, leftTopRelay ? 1.18 * decayK : decayK);
        if (leftTopRelay && order === 4) seatPocketFinger(middle, FOUR_U_RELAY_MIDDLE, degrees, decayK);
      }
    }
    if (sweep && halfAim > 0 && turn) {
      // The corner sweeps out and back once per quarter. Only lift the pad
      // in that strip, leaving the other contact points on the fixed layer.
      const weight = halfAim * Math.abs(Math.sin(2 * turn.lastAngle));
      const mirror = side === 'R' ? 1 : -1;
      for (const { finger, pose } of sweep) applyPocketFingerPose(h.model.fingers[finger], pose, weight, mirror);
    }
    if (halfRelaySupport) h.halfPalm.clearUpperRelay(order, seatWinding, this.active!.lastAngle, halfAim);
    const halfRelief = palmWeight * THREE.MathUtils.smoothstep(Math.abs(winding), 0, 1);
    // Establish forearm support as the outer layer reaches upper grip. Once
    // settled, the thumb can prepare, push and retract with the same wrist bend.
    const upGripDistance = Math.abs(THREE.MathUtils.euclideanModulo(wristAngle + HALF_PI, 2 * Math.PI) - Math.PI) / Math.PI;
    const upGripRelief = 1 - THREE.MathUtils.smoothstep(upGripDistance, .06, .36);
    const thumbRelief = mark?.plan.hand === side && mark.plan.profile.finger === 'thumb'
      ? THREE.MathUtils.smoothstep(mark.preparation, 0, 1) * (1 - THREE.MathUtils.smoothstep(mark.returning, .5, 1))
      : 0;

    // 前臂 IK:随手掌自然接顺，不额外设置内收/外拐方向。
    // 腕转/弹指/回位时前臂自然摆动而不是整条手臂绕魔方
    // 公转。目标正交基 +x=肘→腕、+z≈手系掌法向(setFromUnitVectors 最小旋转
    // 的滚转会随肘-腕方位漂,扁截面转离腕背 → 现台阶,故锚定掌平面)。
    // @4 融合前臂:前臂缝在手网格里,摆动 = forearm 骨绕腕的手局部旋转
    // Δ = 目标基 · 绑定基⁻¹(全程手局部)。
    if (side === 'L' && this.rightPinch) {
      this.rightPinch.applyLeftHome(h.model, h.home, h.flickStyle === 'topPush' ? h.reachT : 0);
      h.halfPalm.baseQuaternion.copy(h.home.quat);
      elbowTarget.copy(h.elbow);
    }
    const anchored = side === 'R' ? this.rightPinch : null;
    if (anchored && this.restorePinchFingers) {
      anchored.apply(h.model, h.home, this.restorePinchFingers);
      h.halfPalm.baseQuaternion.copy(g.quaternion);
      elbowTarget.copy(h.elbow);
    }
    const wrist = HandsRig._vTmp.copy(WRIST_LOCAL).applyQuaternion(g.quaternion).add(g.position);
    const upperTurnSupport = h.weldAxis === 'x' && !h.weldWhole || h.grip.angleTo(GRIP_Q_UP) < .01;
    const armDirection = this.aimForearm(h, wrist, elbowTarget, palmWeight,
      Math.max(halfRelief, upperTurnSupport ? upGripRelief : 0, thumbRelief), halfAim);
    if (h.model.forearm && h.armBindFrameInv) {
      const qInv = HandsRig._qTmp.copy(g.quaternion).invert();
      const xT = HandsRig._vTmp2.copy(armDirection).negate().applyQuaternion(qInv).normalize();
      // Palm tilt is a wrist motion, not extra forearm axial roll. Keep the
      // pre-tilt palm reference so a flexed wrist cannot amplify roll near 90°.
      const zT = HandsRig._vTmp3.set(0, 0, 1).applyQuaternion(h.halfPalm.baseQuaternion).applyQuaternion(qInv);
      zT.addScaledVector(xT, -zT.dot(xT));
      if (zT.lengthSq() < 1e-6) zT.set(0, 0, 1); // 臂轴撞上掌法向的退化兜底
      zT.normalize().applyAxisAngle(xT, h.appliedForearmRoll);
      const yT = HandsRig._vTmp4.crossVectors(zT, xT);
      const dq = HandsRig._qTmp2.setFromRotationMatrix(HandsRig._mTmp.makeBasis(xT, yT, zT)).multiply(h.armBindFrameInv);
      // The elbow direction fixes swing. Near a settled half turn, unwind
      // the residual roll at the wrist while keeping that same forearm axis.
      if (palmWeight > 0) {
        const neutralSwing = HandsRig._armTurn.setFromUnitVectors(h.model.forearm.bindDir, xT.negate());
        dq.slerp(neutralSwing, palmWeight);
      }
      if (!this.body?.visible && h.model.radialAxis) {
        const fore = HandsRig._vTmp2.copy(armDirection).negate();
        const towardShoulder = HandsRig._vTmp3.subVectors(h.virtualShoulder, wrist)
          .addScaledVector(fore, .25 * h.model.unitScale);
        const rotation = HandsRig._armTurn.copy(g.quaternion).multiply(dq);
        const thumb = HandsRig._vTmp4.copy(h.model.radialAxis).applyQuaternion(rotation);
        const angle = h.forearmRotation.angle(fore, towardShoulder, thumb, side);
        h.virtualRoll = h.forearmRotation.apply(rotation, fore, angle, side, dtMs);
        dq.copy(qInv).multiply(rotation);
      }
      h.model.forearm.bone.quaternion.copy(dq).multiply(h.model.forearm.bindQuat);
      // SMPL-X 全身焊臂:体前臂目标世界旋转 = gq·dq·frameQuat(体系→模板系
      // 的解析刚性对应,推导见 smplxBody.updateArm),体腕点钉在手腕点 ——
      // 位置/朝向/扭转三者全对齐,体残段与融合前臂表面严格重合(手不再断开)。
      if (this.body && this.body.visible && h.model.forearm.frameQuat) {
        const geoQ = HandsRig._qTmp.copy(g.quaternion).multiply(dq).multiply(h.model.forearm.frameQuat);
        const lowerGripSupport = side === 'R' && (mark?.plan.profile.id === 'thumb-pad-wide-down')
          ? THREE.MathUtils.smoothstep(-wristAngle, 0, HALF_PI) : 0;
        const fixedSupport = !!clearing || !!mark && (mark.plan.hand !== side
          || mark.plan.profile.id === 'thumb-pad-wide' || mark.supportReady || mark.started)
          || !!this.active && !h.weldAxis && !h.flickFinger;
        // Start freeing the elbow on the way up, before the rotating palm
        // reaches the high grip. Ease away along the same path on reversal.
        const bodyHalfSupport = winding > 0
          ? Math.max(palmWeight, THREE.MathUtils.smoothstep(palmWeight, 0, .12)) : palmWeight;
        // Playback can prepare a half turn before the quarter mark. A free
        // drag reveals the same intent gradually as it passes that mark.
        const outer = carrying && h.weldAxis === 'x' && !h.weldWhole;
        const turn = Math.abs(wrapWristAngle(wristAngle));
        const turnShare = signedHalf || (outer && this.active?.halfTurn)
          ? Math.max(halfAim, THREE.MathUtils.smoothstep(turn, 0, Math.PI / 4))
          : outer ? halfGripWeight(turn) : 0;
        this.body.updateArm(side, wrist, geoQ, Math.max(bodyHalfSupport, upGripRelief, thumbRelief, lowerGripSupport),
          lowerGripSupport, fixedSupport, carryForearm, bodyHalfSupport, halfAim, turnShare);
      }
    } else if (h.forearm) {
      h.forearm.position.copy(wrist);
      const dir = HandsRig._vTmp2.copy(armDirection).negate();
      const zF = HandsRig._vTmp3.set(0, 0, 1).applyQuaternion(h.halfPalm.baseQuaternion);
      zF.addScaledVector(dir, -zF.dot(dir));
      if (zF.lengthSq() < 1e-6) zF.set(0, 0, 1); // 臂轴撞上掌法向的退化兜底
      zF.normalize().applyAxisAngle(dir, h.appliedForearmRoll);
      const yF = HandsRig._vTmp4.crossVectors(zF, dir);
      h.forearm.quaternion.setFromRotationMatrix(HandsRig._mTmp.makeBasis(dir, yF, zF));
    }

    // MANO posedirs 姿态修正(指关节局部旋转驱动;系数不变时内部早退,待机
    // 呼吸只动手根零开销,只有指弹帧真正重写绑定几何)。
    const seat = this.fourSeat;
    const fittedUpperRelay = leftTopRelay && seat?.axis === 'y' && seat.layers.length === 1 && seat.layers[0] === 3
      && seat.gesture.kind === 'flick' && seat.gesture.hand === side;
    if (this.cube?.order === 4 && seat && !fittedUpperRelay) {
      const contact = this.fourContacts.get(h.model);
      const flick = seat.gesture.kind === 'flick' ? seat.gesture : undefined;
      // A directly queued half turn can start before fourSeat finishes
      // preparing. The supporting pads must clear its corners on frame one.
      const weight = halfRelaySupport ? 1 : THREE.MathUtils.smoothstep(seat.progress, 0, 1);
      contact?.apply(seat, seat.gesture.kind === 'weld' ? seat.gesture.hands[0] : seat.gesture.hand,
        flick?.finger, flick?.finger2, weight, side, h.grip.angleTo(HandsRig._qIdent) < .01,
        this.hands![side === 'R' ? 'L' : 'R'].grip.angleTo(HandsRig._qIdent) < .01, braceProfile);
    }
    if (order === 4 && wide) {
      wide.clearRearMiddle(h.model.fingers.middle, 1 - THREE.MathUtils.smoothstep(seat?.progress ?? 0, 0, 1));
    }
    if (seat && seat.progress > 0 && seat.progress < 1) {
      const p = seat.progress, mirror = side === 'R' ? 1 : -1;
      if (seat.axis === 'x' && seat.layers.length === 3 && seat.gesture.kind === 'weld'
        && seat.gesture.hands.includes(side) && Math.abs(h.gripAngle - Math.PI) < .01) {
        // Roll the thumb off the outer corner before carrying all three rows.
        applyPocketFingerPose(h.model.fingers.thumb, [.079, -.028, .045, -.005], 4 * p * (1 - p), mirror);
      } else if (seat.returning && seat.axis === 'y' && seat.layers.length === 1 && seat.layers[0] === 1
        && seat.gesture.kind === 'flick' && seat.gesture.hand === side && side === 'R' && seat.gesture.finger === 'ring'
        && !seat.gesture.finger2 && opposite.grip.angleTo(HandsRig._qIdent) < .01) {
        // Peel the driving nail off the stationary corner early in withdrawal.
        const lift = releaseLift(p, 4);
        applyPocketFingerPose(h.model.fingers.ring, [-.127, -.015, -.077, .012], lift, mirror);
      }
    }
    // The layer is already baked. Let the driving pad clear the stationary
    // corner throughout its own recovery clock, including after fourSeat ends.
    if (order === 4 && !pushFinger && h.flickDecay > 0 && (h.flickAxis === 'y' || h.flickAxis === 'z') && h.flickFinger === 'index'
      && h.grip.angleTo(HandsRig._qIdent) < .01 && (opposite.grip.angleTo(HandsRig._qIdent) < .01
        || h.flickFinger2 === 'middle' && isEquatorBand(h.flickAxis, h.strokeLayers))) {
      this.fourContacts.get(h.model)?.releaseFlick(h.flickAxis, h.strokeLayers, h.flickFinger2 === 'middle', rawAbs, 1 - h.flickDecay, side);
    }
    if (!isDouble && h.flickStyle === 'lowerHook' && h.reachT > 0 && h.reachT < 1) {
      const seat = sm(h.reachT);
      applyPocketFingerPose(h.model.fingers.ring, [.033, .10, -.036, -.14],
        4 * seat * (1 - seat), -sideSign);
    }
    if (order === 4 && !mark && isMiddleSliceStroke(h.flickStyle) && !isDouble) {
      // Keep the free little finger outside the ring's pad-to-nail roll.
      h.model.fingers.pinky.root.rotateZ(-sideSign * .15 * sm(h.reachT) * decayK);
    }
    if (h.flickDecay > 0 && !mark) {
      // Lift the driving pad around the baked corner while the other hand
      // supports the cube. Both endpoints stay on the authored trajectory.
      const release = 4 * decayK * (1 - decayK);
      const mirror = side === 'R' ? 1 : -1;
      if (pocketRelay && h.flickStyle === 'hook') {
        h.model.fingers.pinky.root.rotateZ(mirror * .34 * release);
        h.model.fingers.pinky.root.rotateY(-.10 * release);
        h.model.fingers.index.root.rotateY(.025 * release);
      } else if (h.flickStyle === 'lowerHook') {
        const ringTravel = rawAbs - (isDouble ? HALF_PI : 0);
        const finished = THREE.MathUtils.smoothstep(ringTravel, 0, HALF_PI);
        applyPocketFingerPose(h.model.fingers.ring, [.156, .094, -.003, -.354], release * finished, mirror);
        if (order === 4 && isDouble && h.strokeLayers.length === 3) {
          applyPocketFingerPose(h.model.fingers.ring, [-.080, .014, -.052, .002], releaseLift(decayK, 8) * finished, mirror);
        }
      } else if (order === 4 && h.flickStyle === 'downPush' && h.flickAxis === 'z' && h.flickFinger2 === 'middle') {
        applyPocketFingerPose(h.model.fingers.middle, [.029, -.057, -.004, .028],
          release * THREE.MathUtils.smoothstep(rawAbs, HALF_PI, Math.PI), mirror);
      } else if (order === 4 && h.flickAxis === 'y' && h.strokeLayers.length === 1 && h.strokeLayers[0] === 2
        && h.flickFinger === 'index' && !isDouble && h.grip.angleTo(HandsRig._qIdent) < .01) {
        applyPocketFingerPose(h.model.fingers.index, [.091, -.493, -.071, .170],
          release * THREE.MathUtils.smoothstep(rawAbs, 0, HALF_PI), mirror);
      }
    }
    h.model.poseCorrective?.();
    const relayBlend = .63 + .37 * (h.flickAxis === 'z' && h.flickDecay > 0 ? THREE.MathUtils.smoothstep(1 - h.flickDecay, 0, .55) : 0);
    const frontBlend = frontPress ? indexSkin * (h.flickFinger2 ? relayBlend : frontPadWeight) : undefined;
    const foldRegion = frontPress && h.flickAxis === 'z' && h.flickStyle === 'topPush' ? 'proximal'
      : indexHookRelay ? 'pip' : undefined;
    h.skinStroke.middleSlice = h.flickStyle === 'middleSlicePad' || (order === 3 && isMiddleSliceStroke(h.flickStyle));
    h.halfPalm.contactSkin.apply(indexSkin, middleSkin, frontBlend, indexSkinRoll, gripStretchWeight, h.skinStroke, foldRegion);
  }

  /** 页面卸载时取消未完成加载，并释放本 rig 拥有的 GPU 资源。 */
  dispose(): void {
    this.detachHalfTurnDirection();
    if (this.disposed) return;
    this.emitDiagnostic('dispose');
    this.diagnosticListeners.clear();
    this.disposed = true;
    this.abort.abort();
    this.loadListeners.clear();
    this.enabled = false;
    this.visible = false;
    if (this.hands) {
      for (const side of ["R", "L"] as const) disposeHandModel(this.hands[side].model);
      this.hands = null;
    }
    this.skinMat.bumpMap?.dispose();
    this.skinMat.dispose();
    for (const mat of this.handMats) {
      mat.map?.dispose();
      mat.bumpMap?.dispose();
      mat.roughnessMap?.dispose();
      mat.dispose();
    }
    for (const m of this.skelMats) m.dispose();
    this.body?.dispose();
    this.body = null;
    this.handMats.length = 0;
    this.clear();
    this.removeFromParent();
  }
}
