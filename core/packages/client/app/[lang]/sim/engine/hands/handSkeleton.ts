/**
 * /sim 手部 MediaPipe Hands 风格 21 关键点骨架叠加层。
 * 画风对齐 mediapipe.solutions.drawing_styles 官方默认(BGR→RGB 换算):
 * 掌部 6 点(腕 + 拇指 CMC + 四指 MCP)红、拇指桃、食指紫、中指黄、无名指绿、
 * 小指蓝;掌部连线灰且比指骨线粗(thickness 3 vs 2),关键点带白描边(×1.2)。
 *
 * 指节线使用实际绑定端点，掌部连线取掌骨转动后的指根。
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

const alongX = new THREE.Vector3(1, 0, 0);
const linkDirection = new THREE.Vector3();

function placeLink(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, radius: number): void {
  linkDirection.subVectors(b, a);
  const length = linkDirection.length();
  mesh.scale.set(length, radius, radius);
  mesh.position.addVectors(a, b).multiplyScalar(.5);
  if (length > 0) mesh.quaternion.setFromUnitVectors(alongX, linkDirection.divideScalar(length));
}

export function addHandSkeleton(model: HandModel, mats: Record<SkeletonMatKey, THREE.MeshBasicMaterial>): void {
  const { group, fingers, meshes } = model;
  const origin = new THREE.Vector3();
  for (const name of Object.keys(fingers) as FingerName[]) {
    const f = fingers[name];
    const end = f.tipOffset ?? new THREE.Vector3(f.segLens[2], 0, 0);
    for (const [joint, offset] of [[f.root, f.mid.position], [f.mid, f.tip.position], [f.tip, end]] as const) {
      const line = makeMesh(unitBone, mats[name], ORDER_LINE);
      placeLink(line, origin, offset, FINGER_LINE_R);
      joint.add(line);
      meshes.push(line);
      addDot(joint, origin, joint === f.root ? mats.palm : mats[name], mats.border, meshes);
    }
    addDot(f.tip, end, mats[name], mats.border, meshes);
  }

  for (const { bone, end } of model.palmSupports ?? []) {
    const line = makeMesh(unitBone, mats.line, ORDER_LINE);
    placeLink(line, origin, end, PALM_LINE_R / bone.scale.x);
    bone.add(line);
    meshes.push(line);
  }

  const points = [WRIST_LOCAL, ...Object.values(fingers).map(() => new THREE.Vector3())];
  const knuckles = [fingers.thumb, fingers.index, fingers.middle, fingers.ring, fingers.pinky];
  const links = [[0,1], [0,2], [2,3], [3,4], [4,5], [0,5]].map(([a,b]) => {
    const mesh = makeMesh(unitBone, mats.line, ORDER_LINE);
    group.add(mesh);
    meshes.push(mesh);
    return { a, b, mesh };
  });
  model.updatePalmLinks = () => {
    knuckles.forEach((finger, i) => {
      const point = points[i + 1].copy(finger.root.position);
      if (finger.meta) point.applyQuaternion(finger.meta.quaternion).add(finger.meta.position);
    });
    for (const { a, b, mesh } of links) placeLink(mesh, points[a], points[b], PALM_LINE_R);
  };
  model.updatePalmLinks();
  addDot(group, WRIST_LOCAL, mats.palm, mats.border, meshes);
}
