/**
 * rawCore — 原核 (raw / stickerless body) 渲染 for the NxN InstancedRenderer.
 *
 * 目标:把每块塑料本身染成它各可见面的颜色(无黑核、无贴纸),棱块沿对角线劈成
 * 双色、角块三色,还原真实无贴纸魔方(用户实拍图)。
 *
 * 做法(不切几何、复用 instancing):给 frame / inner 的 InstancedMesh 各挂一份克隆几何,
 * 上面带 6 个 per-instance 属性 —— 每块最多 3 个可见面的 (法向 aRawN*, 颜色 aRawC*)。
 * material 用 onBeforeCompile 注入:在 fragment 里取「localPos·法向」最大的那个可见面的
 * 颜色(= 离该 fragment 最近的可见面)。对棱块这恰好是两面之间的对角分割平面;角块是三面
 * 在体对角线处三分;中心块单色。cubelet 的 instanceMatrix 已带朝向,所以分割随块旋转,无需额外处理。
 *
 * 仅 NxN(order < superOrderThreshold)。超高阶用 unlit Basic + 无 inner,原核占位跳过。
 */
import * as THREE from 'three';
import { FACE, STICKER_INNER, STICKER_CORNER_RADIUS } from '../define';

const STICKER_HALF = STICKER_INNER / 2;

/** 内核色缝门控 uniform(材质单例共享,setRawCore 每次按 isMirror 设):
 *  1 = 镜面 —— 贴片圆角外缘(grooves)+ 内壁落 diffuse(=内核色)→ 金块 + 黑内核机芯,内核色可调;
 *  0 = 普通原核 —— 不染缝,连续实色无黑线(还原真实 stickerless 魔方,见图参考)。 */
const rawCoreBorder = { value: 0 };
export function setRawCoreBorder(on: boolean): void { rawCoreBorder.value = on ? 1 : 0; }
/** 当前缝门控状态(SVG 导出器 CPU 复算 shader 的 SDF 缝需要读它)。 */
export function getRawCoreBorder(): boolean { return rawCoreBorder.value > 0.5; }

/** 每个面在 cubelet 本地坐标系的外法向(与 makeStickerLocalMatrix 一致)。 */
const FACE_NORMAL: Record<number, [number, number, number]> = {
  [FACE.L]: [-1, 0, 0],
  [FACE.R]: [+1, 0, 0],
  [FACE.D]: [0, -1, 0],
  [FACE.U]: [0, +1, 0],
  [FACE.B]: [0, 0, -1],
  [FACE.F]: [0, 0, +1],
};

export interface RawAttrs {
  n0: THREE.InstancedBufferAttribute; n1: THREE.InstancedBufferAttribute; n2: THREE.InstancedBufferAttribute;
  c0: THREE.InstancedBufferAttribute; c1: THREE.InstancedBufferAttribute; c2: THREE.InstancedBufferAttribute;
}

type FaceColors = { U: string; D: string; L: string; R: string; F: string; B: string };

/** 给每个 cubelet 收集 ≤3 个可见面 (法向 + 颜色),写进 6 个 InstancedBufferAttribute。
 *  visible(cubelet i, face f) = cubeletFaceSlot[i*6+f] >= 0(有贴片 = 在表面)。
 *  颜色取 faceColors[FACE[f]](与 sticker 同源,原核去贴片后块身即此色)。 */
export function buildRawAttributes(
  visCount: number,
  cubeletFaceSlot: Int32Array,
  faceColors: FaceColors,
  existing?: RawAttrs,
): RawAttrs {
  const N = [
    existing?.n0.array as Float32Array ?? new Float32Array(visCount * 3),
    existing?.n1.array as Float32Array ?? new Float32Array(visCount * 3),
    existing?.n2.array as Float32Array ?? new Float32Array(visCount * 3),
  ];
  const C = [
    existing?.c0.array as Float32Array ?? new Float32Array(visCount * 3),
    existing?.c1.array as Float32Array ?? new Float32Array(visCount * 3),
    existing?.c2.array as Float32Array ?? new Float32Array(visCount * 3),
  ];
  const col = new THREE.Color();
  for (let i = 0; i < visCount; i++) {
    const base = i * 6;
    let slot = 0;
    // 清空 3 个槽(法向 0 = 该槽无效)
    for (let s = 0; s < 3; s++) { const o = i * 3; N[s][o] = N[s][o + 1] = N[s][o + 2] = 0; }
    for (let f = 0; f < 6 && slot < 3; f++) {
      if (cubeletFaceSlot[base + f] < 0) continue;
      const nrm = FACE_NORMAL[f];
      const o = i * 3;
      N[slot][o] = nrm[0]; N[slot][o + 1] = nrm[1]; N[slot][o + 2] = nrm[2];
      col.set(faceColors[FACE[f as FACE] as keyof FaceColors]);
      C[slot][o] = col.r; C[slot][o + 1] = col.g; C[slot][o + 2] = col.b;
      slot++;
    }
    // Interior cubie with no stickered faces (the mirror cube's hole-filling center piece)
    // keeps all 3 slots empty → every fragment falls through to diffuse = coreColor (the
    // 内核色), so the revealed core matches the inner walls instead of the gold body.
  }
  if (existing) {
    existing.n0.needsUpdate = existing.n1.needsUpdate = existing.n2.needsUpdate = true;
    existing.c0.needsUpdate = existing.c1.needsUpdate = existing.c2.needsUpdate = true;
    return existing;
  }
  const mk = (a: Float32Array) => new THREE.InstancedBufferAttribute(a, 3);
  return { n0: mk(N[0]), n1: mk(N[1]), n2: mk(N[2]), c0: mk(C[0]), c1: mk(C[1]), c2: mk(C[2]) };
}

/** 把 6 个 raw 属性挂到一份克隆几何上(frame / inner 各一份,可共享同一组属性对象)。 */
export function attachRawAttributes(geo: THREE.BufferGeometry, attrs: RawAttrs): void {
  geo.setAttribute('aRawN0', attrs.n0); geo.setAttribute('aRawN1', attrs.n1); geo.setAttribute('aRawN2', attrs.n2);
  geo.setAttribute('aRawC0', attrs.c0); geo.setAttribute('aRawC1', attrs.c1); geo.setAttribute('aRawC2', attrs.c2);
}

/** 共享的「最近可见面取色」着色器注入 —— Phong / Basic 的 chunk include 点相同
 *  (<common> / <begin_vertex> / <color_fragment> 都有),同一份注入两种材质通用。
 *  fragment 取「localPos·面法向 最大的可见面」色(= 离该 fragment 最近的可见面):外壳=自己面色,
 *  棱对角双色、角体对角线三色,内壁/切面=最近面色(转层露出彩色横截面);无任何贴片面的
 *  (镜面中心块/深核)落 diffuse=内核色。**原核 = 连续实色块身、无黑缝/黑线** —— 块间分隔靠
 *  `_FRAME` 几何 pocket + Phong 光照(同色凹槽明暗),不靠换色;黑线只属于「六色」贴纸模式。 */
function injectRawShader(shader: {
  vertexShader: string;
  fragmentShader: string;
  uniforms: { [k: string]: { value: unknown } };
}): void {
  shader.uniforms.uCoreBorder = rawCoreBorder;
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
      attribute vec3 aRawN0; attribute vec3 aRawN1; attribute vec3 aRawN2;
      attribute vec3 aRawC0; attribute vec3 aRawC1; attribute vec3 aRawC2;
      varying vec3 vRawPos;
      varying vec3 vRawN0; varying vec3 vRawN1; varying vec3 vRawN2;
      varying vec3 vRawC0; varying vec3 vRawC1; varying vec3 vRawC2;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vRawPos = position;
      vRawN0 = aRawN0; vRawN1 = aRawN1; vRawN2 = aRawN2;
      vRawC0 = aRawC0; vRawC1 = aRawC1; vRawC2 = aRawC2;`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      uniform float uCoreBorder;
      varying vec3 vRawPos;
      varying vec3 vRawN0; varying vec3 vRawN1; varying vec3 vRawN2;
      varying vec3 vRawC0; varying vec3 vRawC1; varying vec3 vRawC2;`,
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      {
        float best = -1e30;
        vec3 rawCol = diffuse;
        vec3 bestN = vec3(0.0);
        if (dot(vRawN0, vRawN0) > 0.25) { float d = dot(vRawPos, vRawN0); if (d > best) { best = d; rawCol = vRawC0; bestN = vRawN0; } }
        if (dot(vRawN1, vRawN1) > 0.25) { float d = dot(vRawPos, vRawN1); if (d > best) { best = d; rawCol = vRawC1; bestN = vRawN1; } }
        if (dot(vRawN2, vRawN2) > 0.25) { float d = dot(vRawPos, vRawN2); if (d > best) { best = d; rawCol = vRawC2; bestN = vRawN2; } }
        // 镜面(uCoreBorder=1):贴片圆角外缘(grooves)+ 内壁落 diffuse(=内核色)→ 金块 + 黑内核;
        // 普通原核(=0):整片连续面色、无黑线。SDF:面内点到圆角矩形(半宽/圆角同源 _STICKER)。
        if (uCoreBorder > 0.5 && dot(bestN, bestN) > 0.5) {
          vec3 ip = vRawPos - bestN * dot(vRawPos, bestN);
          vec3 q = abs(ip) - vec3(${(STICKER_HALF - STICKER_CORNER_RADIUS).toFixed(1)});
          float sdf = min(max(q.x, max(q.y, q.z)), 0.0) + length(max(q, vec3(0.0))) - ${STICKER_CORNER_RADIUS.toFixed(1)};
          if (sdf > 0.0) rawCol = diffuse;
        }
        diffuseColor.rgb = rawCol;
      }`,
    );
}

let _rawMaterial: THREE.MeshPhongMaterial | null = null;

/** 原核 frame/inner 共用材质 —— clone Phong 保留打光(块身仍有立体明暗),
 *  onBeforeCompile 注入「最近可见面取色」。单例,全 cube 复用(低/中阶)。 */
export function rawMaterial(): THREE.MeshPhongMaterial {
  if (_rawMaterial) return _rawMaterial;
  const m = new THREE.MeshPhongMaterial({ specular: 0x222222, shininess: 4 });
  m.onBeforeCompile = (shader) => injectRawShader(shader);
  _rawMaterial = m;
  return m;
}

let _rawMaterialBasic: THREE.MeshBasicMaterial | null = null;

/** 超高阶(N≥superOrderThreshold)原核材质 —— unlit Basic,跟超高阶 frame 的 CORE_BASIC
 *  一致(Phong 光照在亚像素 cubelet 上无意义);同一份「最近可见面取色」注入。
 *  保持 FrontSide:转层缝隙的中空由实心彩色占位板(paintPanel)挡住,不靠 DoubleSide 露内壁
 *  (DoubleSide 会让薄壳穿帮成镂空)。 */
export function rawMaterialBasic(): THREE.MeshBasicMaterial {
  if (_rawMaterialBasic) return _rawMaterialBasic;
  const m = new THREE.MeshBasicMaterial();
  m.onBeforeCompile = (shader) => injectRawShader(shader);
  _rawMaterialBasic = m;
  return m;
}
