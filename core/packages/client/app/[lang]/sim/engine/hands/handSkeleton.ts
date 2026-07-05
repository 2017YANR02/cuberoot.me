/**
 * /sim 手部 MediaPipe Hands 风格 21 关键点骨架叠加层。
 * 画风对齐 mediapipe.solutions.drawing_styles 官方默认(BGR→RGB 换算):
 * 掌部 6 点(腕 + 拇指 CMC + 四指 MCP)红、拇指桃、食指紫、中指黄、无名指绿、
 * 小指蓝;掌部连线灰且比指骨线粗(thickness 3 vs 2),关键点带白描边(×1.2)。
 *
 * 全部是静态几何:指骨线在其起点关节的局部系里沿 +x 跨 [0,len],关节点挂在
 * 关节组原点,掌部连线两端(腕点 / 指根)在手根系里本就固定 —— 姿态由现有
 * 关节链自动带动,零逐帧更新。
 * 叠加渲染:depthTest=false + renderOrder(线 < 白边 < 点)—— 关键点在指肉
 * 内部,开深度测试整条骨架会埋进皮肤;MediaPipe 原版同样画在图像最上层
 * (会盖过魔方,是刻意的 overlay 观感)。
 */
import * as THREE from "three";
import { SIZE } from "../define";
import { HAND_SCALE, WRIST_LOCAL, type HandModel, type FingerName } from "./handModel";

const U = (SIZE / 64) * HAND_SCALE;

/** mediapipe drawing_styles 默认色(源码 BGR 常量转 RGB)。 */
const COLORS = {
  palm: 0xff3030,   // _RED:掌部关键点
  thumb: 0xffe5b4,  // _PEACH
  index: 0x804080,  // _PURPLE
  middle: 0xffcc00, // _YELLOW
  ring: 0x30ff30,   // _GREEN
  pinky: 0x1565c0,  // _BLUE
  line: 0x808080,   // _GRAY:掌部连线
  border: 0xe0e0e0, // WHITE_COLOR:点白描边
} as const;
export type SkeletonMatKey = keyof typeof COLORS;

/** 参照原版像素比例(点半径 5px ≈ 指宽 1/3)折算到手模单位。 */
const DOT_R = 3.8 * U;
const BORDER_SCALE = 1.22;
const FINGER_LINE_R = 1.2 * U;
const PALM_LINE_R = 1.7 * U;
/** 线 < 白边 < 点(depthTest 关掉后靠 renderOrder 定谁盖谁,同 mediapipe 画序)。 */
const ORDER_LINE = 8;
const ORDER_BORDER = 9;
const ORDER_DOT = 10;

const noRaycast = (): void => { /* 与手网格一致:不可拾取 */ };

/** 材质透明常开(手部淡入淡出直接驱动 opacity;深度关闭的叠加层留在透明
 *  通道里才能稳定按 renderOrder 排最后)。toneMapped 关掉保色值精确。 */
export function makeHandSkeletonMats(): Record<SkeletonMatKey, THREE.MeshBasicMaterial> {
  const out = {} as Record<SkeletonMatKey, THREE.MeshBasicMaterial>;
  for (const key of Object.keys(COLORS) as SkeletonMatKey[]) {
    out[key] = new THREE.MeshBasicMaterial({
      color: COLORS[key],
      depthTest: false,
      depthWrite: false,
      transparent: true,
      toneMapped: false,
    });
  }
  return out;
}

// 共享单位几何:球 scale=半径;柱经 rotateZ 后沿 x、高 1,scale=(长,半径,半径)。
const unitSphere = new THREE.SphereGeometry(1, 12, 8);
const unitBone = new THREE.CylinderGeometry(1, 1, 1, 10).rotateZ(-Math.PI / 2);

function makeMesh(geo: THREE.BufferGeometry, mat: THREE.Material, order: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = order;
  m.raycast = noRaycast;
  return m;
}

function addDot(parent: THREE.Object3D, pos: THREE.Vector3, mat: THREE.Material, borderMat: THREE.Material, meshes: THREE.Mesh[]): void {
  const border = makeMesh(unitSphere, borderMat, ORDER_BORDER);
  border.scale.setScalar(DOT_R * BORDER_SCALE);
  border.position.copy(pos);
  const dot = makeMesh(unitSphere, mat, ORDER_DOT);
  dot.scale.setScalar(DOT_R);
  dot.position.copy(pos);
  parent.add(border, dot);
  meshes.push(border, dot);
}

/** 关节局部系里沿 +x 跨 [0,len] 的骨线(随关节旋转自动跟姿态)。 */
function addBone(parent: THREE.Object3D, len: number, r: number, mat: THREE.Material, meshes: THREE.Mesh[]): void {
  const m = makeMesh(unitBone, mat, ORDER_LINE);
  m.scale.set(len, r, r);
  m.position.set(len / 2, 0, 0);
  parent.add(m);
  meshes.push(m);
}

/** 手根系里两固定点之间的连线(掌部连线用)。 */
function addLink(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, meshes: THREE.Mesh[]): void {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = makeMesh(unitBone, mat, ORDER_LINE);
  m.scale.set(len, r, r);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
  parent.add(m);
  meshes.push(m);
}

/**
 * 给一只手挂骨架。网格全部 push 进 model.meshes,复用 rig 的补光层开启与
 * dispose 清理(共享几何重复 dispose 幂等,无害)。
 */
export function addHandSkeleton(model: HandModel, mats: Record<SkeletonMatKey, THREE.MeshBasicMaterial>): void {
  const { group, fingers, meshes } = model;

  // 指链:MCP(掌点红)→ PIP → DIP → TIP,骨线与远端三点用指色。
  for (const name of Object.keys(fingers) as FingerName[]) {
    const f = fingers[name];
    const [l1, l2, l3] = f.segLens;
    const mat = mats[name];
    addBone(f.root, l1, FINGER_LINE_R, mat, meshes);
    addBone(f.mid, l2, FINGER_LINE_R, mat, meshes);
    addBone(f.tip, l3, FINGER_LINE_R, mat, meshes);
    addDot(f.root, new THREE.Vector3(), mats.palm, mats.border, meshes);
    addDot(f.mid, new THREE.Vector3(), mat, mats.border, meshes);
    addDot(f.tip, new THREE.Vector3(), mat, mats.border, meshes);
    addDot(f.tip, new THREE.Vector3(l3, 0, 0), mat, mats.border, meshes);
  }

  // 掌部:HAND_PALM_CONNECTIONS = 腕-拇CMC、腕-食MCP、食-中、中-无名、
  // 无名-小、腕-小(指根位置构建时已含 side 镜像,直接取现值)。
  const wrist = WRIST_LOCAL.clone();
  const mcp = (name: FingerName): THREE.Vector3 => fingers[name].root.position;
  const palmPairs: [THREE.Vector3, THREE.Vector3][] = [
    [wrist, mcp("thumb")],
    [wrist, mcp("index")],
    [mcp("index"), mcp("middle")],
    [mcp("middle"), mcp("ring")],
    [mcp("ring"), mcp("pinky")],
    [wrist, mcp("pinky")],
  ];
  for (const [a, b] of palmPairs) addLink(group, a, b, PALM_LINE_R, mats.line, meshes);
  addDot(group, wrist, mats.palm, mats.border, meshes);
}
