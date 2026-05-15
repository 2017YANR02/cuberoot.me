/**
 * InstancedRenderer — PG3D-style 静/动双 InstancedMesh,event-driven。
 *
 * 设计:
 *  - 4 个 InstancedMesh: staticFrame + movingFrame + staticSticker + movingSticker
 *    static 容量 = N visible cubelets / N visible stickers。每个 cubelet 拥有稳定的 instance idx。
 *    moving 容量同 static — slice 旋转时同 idx 在 static/moving 之间切换可见性。
 *  - 不每帧重写 cubelet 矩阵。 只在 3 个时机更新:
 *      constructor: 写入所有 cubelet 的初始矩阵到 static
 *      beginSlice: 把 slice 内 cubelet 的矩阵从 static 复制到 moving,隐藏 static slot
 *      setSliceAngle: 把整 movingFrame/movingSticker 围绕 slice 轴旋转 angle (一次 quaternion)
 *      endSlice: cubelet 的逻辑矩阵已被 group.rotate() 改成新位置,把新矩阵写回 static slot,隐藏 moving
 *      rebuildAll: cube.reset() 后,重写所有 static 矩阵
 *  - applyStick: setColorAt 写到 static (slice 期间也 OK,因为颜色跟着 cubelet,在 slice 期间 cubelet 在 moving)
 *    需要给 moving 也同步,否则 slice 期间换色看不见。
 */
import * as THREE from "three";
import Cubelet from "./cubelet";
import Cube from "./cube";
import CubeGroup from "./group";
import { FACE, COLORS } from "./define";

const HALF = Cubelet.SIZE / 2;
const HIDE_MAT = new THREE.Matrix4().makeScale(0, 0, 0);
// 内填充 box: 比 cubelet frame 小 1 单位防 z-fight (frame outer face 在 ±SIZE/2)。
// 任何方向上 frame 的"洞"(slice 旋转 / 邻居被搬走暴露的内表面) 露出来后,
// 看到的就是这个 dark box 而不是穿透到背景或别的 sticker。
const INNER_BOX = new THREE.BoxGeometry(Cubelet.SIZE - 1, Cubelet.SIZE - 1, Cubelet.SIZE - 1);
/** 性能开关 — DEV bench 可改 (window.__PERF_FLAGS),生产代码只读。
 * - `superOrderThreshold`: N≥此值 = 超高阶,启 inner box skip 等(stage 0)。
 *   bench A/B: 关闭 = 设成 order+1。
 * - `singleSliceQuaternion`: 单 slice 动画时整 moving mesh 共享 quaternion,
 *   省 N² 次 mat4 mul/帧(stage 1)。多并发 slice 自动 fallback per-instance。
 */
export const __PERF_FLAGS: {
  superOrderThreshold: number;
  singleSliceQuaternion: boolean;
  superOrderLowPolyGpu: boolean;
  superOrderShaderSlice: boolean;
} = {
  superOrderThreshold: 50,
  singleSliceQuaternion: true,
  superOrderLowPolyGpu: true,
  superOrderShaderSlice: true,
};

/** 注入 vertex shader,让 GPU 按 per-instance aLayerXYZ 判定是否在活跃 slice,
 * 在 instanceMatrix 后乘上 uSliceRot。zero per-instance writes during animation。 */
function injectSliceRotationShader(material: THREE.Material): void {
  const m = material as THREE.Material & {
    onBeforeCompile?: (shader: { uniforms: Record<string, { value: unknown }>; vertexShader: string }) => void;
    customProgramCacheKey?: () => string;
    userData: { sliceUniforms?: Record<string, { value: unknown }> };
  };
  m.userData = m.userData ?? {};
  const uniforms = {
    // uSliceLayer = -1 表示 inactive (无 cubelet 的 layer 匹配)。
    // 不用 uSliceActive bool 因为部分 GLSL driver 在 uSliceActive=0 时把分支常量
    // 折叠优化掉,后续 setSliceAngle 设 1 时 shader 已经不响应了。
    uSliceAxisMask: { value: new THREE.Vector3(1, 0, 0) },  // (1,0,0)=x, (0,1,0)=y, (0,0,1)=z
    uSliceLayer: { value: -1 },            // 0..N-1 = active slice, -1 = inactive
    uSliceRot: { value: new THREE.Matrix4() },
  };
  m.userData.sliceUniforms = uniforms;
  // 必须设 customProgramCacheKey 否则 three.js 复用 cached basic shader,
  // onBeforeCompile 的注入被忽略 (cache key 只看 shaderID + defines)。
  // 用 material.uuid 让每个 material 实例独立 program — 避免 dev HMR 下旧
  // cached program (旧 shader 源码) 被新 material 复用。
  m.customProgramCacheKey = () => 'cuber-slice-' + m.uuid;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      attribute vec3 aLayerXYZ;
      uniform vec3 uSliceAxisMask;
      uniform float uSliceLayer;
      uniform mat4 uSliceRot;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        float myLayer = dot(aLayerXYZ, uSliceAxisMask);
        if (abs(myLayer - uSliceLayer) < 0.5) {
          mvPosition = uSliceRot * mvPosition;
        }
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`
    );
  };
}

function makeStickerLocalMatrix(face: number, zScale: number, distanceMul = 1): THREE.Matrix4 {
  const d = HALF * distanceMul;
  const pos = new THREE.Vector3();
  const rot = new THREE.Euler();
  switch (face) {
    case FACE.L: rot.y = -Math.PI / 2; pos.x = -d; break;
    case FACE.R: rot.y = +Math.PI / 2; pos.x = +d; break;
    case FACE.D: rot.x = +Math.PI / 2; pos.y = -d; break;
    case FACE.U: rot.x = -Math.PI / 2; pos.y = +d; break;
    case FACE.B: rot.x = +Math.PI;     pos.z = -d; break;
    case FACE.F: /* identity */        pos.z = +d; break;
  }
  const m = new THREE.Matrix4();
  m.compose(pos, new THREE.Quaternion().setFromEuler(rot), new THREE.Vector3(1, 1, zScale));
  return m;
}

interface StickerSlot {
  cubeletInitial: number;
  face: number;
  localMat: THREE.Matrix4;
  visible: boolean;
}

export default class InstancedRenderer extends THREE.Group {
  cube: Cube;

  /** 稳定 instance idx: cubelet.initial → 0..N-1 */
  initialToInstance: Map<number, number> = new Map();
  /** 反查: instance idx → cubelet.initial (用于 endSlice 拿 cubelet) */
  instanceToInitial: number[] = [];

  staticFrame!: THREE.InstancedMesh;
  movingFrame!: THREE.InstancedMesh;
  staticSticker!: THREE.InstancedMesh;
  movingSticker!: THREE.InstancedMesh;
  /** Per-cubelet 内填充:每个 cubelet 内部塞一个实心 box,跟 Frame 共享 matrix。
   * 任何 slice 旋转后,Frame 缝隙永远能看到自己或邻居的 inner box(灰),
   * 不会穿透到背景或别的 sticker。N≥SUPER_ORDER 时整套跳过(`hasInner=false`)。 */
  staticInner!: THREE.InstancedMesh;
  movingInner!: THREE.InstancedMesh;
  /** false 时 staticInner/movingInner 仍存在(便于 dispose)但不写矩阵、不渲染。 */
  private hasInner: boolean;
  /** N≥superOrderThreshold + flag 开: frame 用 BoxGeometry, sticker 用 PlaneGeometry,
   * 材质换 unlit。geometry tris/cubelet 88→12, tris/sticker 204→2。 */
  private useLowPolyGpu: boolean;
  /** N≥superOrderThreshold + flag 开: shader-based slice rotation。
   * beginSlice/setSliceAngle/endSlice 不再 per-instance 写 moving mesh,
   * 仅设 uniform。GPU vertex shader 按 aLayerXYZ 判定 slice 成员 + 乘 uSliceRot。
   * endSlice 仍需 update cubelet.matrix 进 static instanceMatrix (一次性 commit)。 */
  private useShaderSlice: boolean;
  /** Per-cube cloned materials (shader injected). 共享 _FRAME_LOW geometry 添加
   * aLayerXYZ 会污染 singleton, 所以 geometry 也 clone。 */
  private shaderFrameMat?: THREE.MeshBasicMaterial;
  private shaderStickerMat?: THREE.MeshBasicMaterial;

  private stickerMaterial: THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;
  private movingStickerMaterial: THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;

  /** hint stickers (alg.cubing.net "hint facelets"): 每个 sticker 沿 face normal
   * 推到 cube 外侧 (order+1) 倍位置, BasicMaterial 半透明全亮。提示背面颜色。
   * 抄自 huazhechen/cuber `cubelet.ts` 的 `mirror` 字段, 但走 instanced 渲染。 */
  staticHint!: THREE.InstancedMesh;
  movingHint!: THREE.InstancedMesh;
  private hintMaterial: THREE.MeshBasicMaterial;
  private movingHintMaterial: THREE.MeshBasicMaterial;
  private hintLocalMats: THREE.Matrix4[] = [];
  private hintDistance: number;

  stickerSlots: StickerSlot[] = [];
  /** key: cubeletInitial * 6 + face → slot idx */
  private slotLookup: Map<number, number> = new Map();
  /** 每个 cubeletInitial 拥有的 sticker slot idx 列表(beginSlice/endSlice 用) */
  private cubeletSlots: Map<number, number[]> = new Map();

  // toggles
  private _thickness = true;
  private _arrow = false;
  private _hint = false;

  // active slices (支持并发,例如 x/y/z 整 cube 旋转 = N 个 group 同时跑)。
  // 同轴异步并发 (user 拖了 A 还在 tween,又 drag 平行 B) 也要正确 — 每个 slice
  // 独立 angle,所以存它进 moving 之前的 instance matrix (origCubeletMat / origStickerMat /
  // origHintMat),setSliceAngle 时 per-instance 算 `rot(slice.axis, slice.angle) × origMat`。
  private activeSlices: Map<CubeGroup, {
    instances: number[];
    slots: number[];
    origCubeletMats: THREE.Matrix4[];
    origStickerMats: THREE.Matrix4[];
    origHintMats: THREE.Matrix4[];
  }> = new Map();
  /** Single-slice quaternion 模式: 活跃 slice 只剩 1 个时,整 moving mesh
   * 共享一个 quaternion,免 N² 次 mat4 mul/帧。第 2 个 slice 进来前 bake 进
   * per-instance,然后 fallback 到多 slice 路径。 */
  private singleSliceGroup: CubeGroup | null = null;
  /** Stage 2: Matrix4 freelist 池 — 替代 beginSlice 里 187k 次 .clone() 的 GC 风暴。
   * 池 max size ≈ 一个面 slice 的 cubelet+sticker+hint 数 (~187k @ N=250 ≈ 12 MB),
   * 不会无限涨;endSlice 全部 release 回池,下个 twist 复用。 */
  private mat4Pool: THREE.Matrix4[] = [];
  private acquireMat4(): THREE.Matrix4 {
    return this.mat4Pool.pop() ?? new THREE.Matrix4();
  }
  private releaseMat4Array(arr: THREE.Matrix4[]): void {
    for (let i = 0; i < arr.length; i++) this.mat4Pool.push(arr[i]);
    arr.length = 0;
  }

  // 临时
  private tmpMat = new THREE.Matrix4();
  private tmpRotMat = new THREE.Matrix4();
  private tmpColor = new THREE.Color();
  private tmpQuat = new THREE.Quaternion();

  constructor(cube: Cube) {
    super();
    this.cube = cube;
    this.matrixAutoUpdate = false;
    const isSuperOrder = cube.order >= __PERF_FLAGS.superOrderThreshold;
    this.hasInner = !isSuperOrder;
    this.useLowPolyGpu = isSuperOrder && __PERF_FLAGS.superOrderLowPolyGpu;
    this.useShaderSlice = isSuperOrder && __PERF_FLAGS.superOrderShaderSlice && this.useLowPolyGpu;

    const cubelets = [...cube.initials.values()];
    const visCount = cubelets.length;
    for (let i = 0; i < visCount; i++) {
      this.initialToInstance.set(cubelets[i].initial, i);
      this.instanceToInitial.push(cubelets[i].initial);
      cubelets[i]._instIdx = i;
    }

    // Frame meshes + per-cubelet inner box meshes(共享 matrix)
    this.staticFrame = this.makeFrameMesh(visCount, false);
    this.movingFrame = this.makeFrameMesh(visCount, true);
    this.movingFrame.count = 0;
    this.staticInner = this.makeInnerMesh(visCount, false);
    this.movingInner = this.makeInnerMesh(visCount, true);
    this.movingInner.count = 0;
    if (!this.hasInner) {
      this.staticInner.visible = false;
      this.movingInner.visible = false;
      this.staticInner.count = 0;
    }

    // 初始 frame + inner box 矩阵 (static),全部 moving 隐藏
    for (let i = 0; i < visCount; i++) {
      this.staticFrame.setMatrixAt(i, cubelets[i].matrix);
      this.movingFrame.setMatrixAt(i, HIDE_MAT);
      if (this.hasInner) {
        this.staticInner.setMatrixAt(i, cubelets[i].matrix);
        this.movingInner.setMatrixAt(i, HIDE_MAT);
      }
    }
    this.staticFrame.instanceMatrix.needsUpdate = true;
    this.movingFrame.instanceMatrix.needsUpdate = true;
    if (this.hasInner) {
      this.staticInner.instanceMatrix.needsUpdate = true;
      this.movingInner.instanceMatrix.needsUpdate = true;
    }

    // Sticker slots
    const zScale = this._thickness ? HALF : 1;
    for (const cubelet of cubelets) {
      const list: number[] = [];
      for (let f = 0; f < 6; f++) {
        const col = cubelet.colors[f];
        if (col == null || col === "") continue;
        const slotIdx = this.stickerSlots.length;
        this.slotLookup.set(cubelet.initial * 6 + f, slotIdx);
        list.push(slotIdx);
        this.stickerSlots.push({
          cubeletInitial: cubelet.initial,
          face: f,
          localMat: makeStickerLocalMatrix(f, zScale),
          visible: true,
        });
      }
      this.cubeletSlots.set(cubelet.initial, list);
    }

    // Sticker meshes — 超高阶用 unlit basic 省 fragment shader 光照
    this.stickerMaterial = this.useLowPolyGpu ? new THREE.MeshBasicMaterial() : new THREE.MeshLambertMaterial();
    this.movingStickerMaterial = this.useLowPolyGpu ? new THREE.MeshBasicMaterial() : new THREE.MeshLambertMaterial();
    this.staticSticker = this.makeStickerMesh(this.stickerSlots.length, false);
    this.movingSticker = this.makeStickerMesh(this.stickerSlots.length, true);
    this.movingSticker.count = 0;

    for (let i = 0; i < this.stickerSlots.length; i++) {
      const slot = this.stickerSlots[i];
      const cubelet = cube.initials.get(slot.cubeletInitial)!;
      this.tmpMat.multiplyMatrices(cubelet.matrix, slot.localMat);
      this.staticSticker.setMatrixAt(i, this.tmpMat);
      this.movingSticker.setMatrixAt(i, HIDE_MAT);
      this.tmpColor.set(COLORS[cubelet.colors[slot.face] ?? "Gray"] ?? COLORS.Gray);
      this.staticSticker.setColorAt(i, this.tmpColor);
      this.movingSticker.setColorAt(i, this.tmpColor);
    }
    this.staticSticker.instanceMatrix.needsUpdate = true;
    this.movingSticker.instanceMatrix.needsUpdate = true;
    if (this.staticSticker.instanceColor) this.staticSticker.instanceColor.needsUpdate = true;
    if (this.movingSticker.instanceColor) this.movingSticker.instanceColor.needsUpdate = true;

    // Hint stickers — 单面 plane (ShapeGeometry) + BackSide:
    // 只在 face normal 背向 camera 时可见,自动只显"看不到的 3 个面"。
    this.hintDistance = cube.order + 1;
    this.hintMaterial = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.35, depthWrite: false, side: THREE.BackSide,
    });
    this.movingHintMaterial = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.35, depthWrite: false, side: THREE.BackSide,
    });
    this.staticHint = new THREE.InstancedMesh(Cubelet._HINT, this.hintMaterial, this.stickerSlots.length);
    this.movingHint = new THREE.InstancedMesh(Cubelet._HINT, this.movingHintMaterial, this.stickerSlots.length);
    this.staticHint.frustumCulled = false;
    this.movingHint.frustumCulled = false;
    this.staticHint.matrixAutoUpdate = false;
    this.movingHint.matrixAutoUpdate = true;
    this.staticHint.matrix.identity();
    this.staticHint.visible = false;
    this.movingHint.visible = false;
    this.movingHint.count = 0;

    for (let i = 0; i < this.stickerSlots.length; i++) {
      const slot = this.stickerSlots[i];
      this.hintLocalMats.push(makeStickerLocalMatrix(slot.face, zScale, this.hintDistance));
    }
    for (let i = 0; i < this.stickerSlots.length; i++) {
      const slot = this.stickerSlots[i];
      const cubelet = cube.initials.get(slot.cubeletInitial)!;
      this.tmpMat.multiplyMatrices(cubelet.matrix, this.hintLocalMats[i]);
      this.staticHint.setMatrixAt(i, this.tmpMat);
      this.movingHint.setMatrixAt(i, HIDE_MAT);
      this.tmpColor.set(COLORS[cubelet.colors[slot.face] ?? "Gray"] ?? COLORS.Gray);
      this.staticHint.setColorAt(i, this.tmpColor);
      this.movingHint.setColorAt(i, this.tmpColor);
    }
    this.staticHint.instanceMatrix.needsUpdate = true;
    this.movingHint.instanceMatrix.needsUpdate = true;
    if (this.staticHint.instanceColor) this.staticHint.instanceColor.needsUpdate = true;
    if (this.movingHint.instanceColor) this.movingHint.instanceColor.needsUpdate = true;

    this.add(this.staticFrame);
    this.add(this.movingFrame);
    this.add(this.staticInner);
    this.add(this.movingInner);
    this.add(this.staticSticker);
    this.add(this.movingSticker);
    this.add(this.staticHint);
    this.add(this.movingHint);

    if (this.useShaderSlice) {
      this.setupShaderSliceMode(cube, cubelets);
    }
  }

  /** Shader slice 模式: 给 frame + sticker mesh clone 几何 + 添加 aLayerXYZ 属性,
   * 注入 shader,关 moving 渲染。beginSlice → 设 uniform 即可,免 N² 写。 */
  private setupShaderSliceMode(cube: Cube, cubelets: Cubelet[]): void {
    const half = (cube.order - 1) / 2;
    // Frame: aLayerXYZ per cubelet
    const frameLayers = new Float32Array(cubelets.length * 3);
    for (let i = 0; i < cubelets.length; i++) {
      const v = cubelets[i].vector;
      frameLayers[i * 3 + 0] = v.x + half;
      frameLayers[i * 3 + 1] = v.y + half;
      frameLayers[i * 3 + 2] = v.z + half;
    }
    const frameGeo = this.staticFrame.geometry.clone();
    frameGeo.setAttribute('aLayerXYZ', new THREE.InstancedBufferAttribute(frameLayers, 3));
    this.staticFrame.geometry = frameGeo;
    this.shaderFrameMat = (this.staticFrame.material as THREE.MeshBasicMaterial).clone();
    injectSliceRotationShader(this.shaderFrameMat);
    this.staticFrame.material = this.shaderFrameMat;
    // Sticker: aLayerXYZ per sticker slot
    const stickerLayers = new Float32Array(this.stickerSlots.length * 3);
    for (let i = 0; i < this.stickerSlots.length; i++) {
      const slot = this.stickerSlots[i];
      const cubelet = cube.initials.get(slot.cubeletInitial);
      if (!cubelet) continue;
      const v = cubelet.vector;
      stickerLayers[i * 3 + 0] = v.x + half;
      stickerLayers[i * 3 + 1] = v.y + half;
      stickerLayers[i * 3 + 2] = v.z + half;
    }
    const stickerGeo = this.staticSticker.geometry.clone();
    stickerGeo.setAttribute('aLayerXYZ', new THREE.InstancedBufferAttribute(stickerLayers, 3));
    this.staticSticker.geometry = stickerGeo;
    this.shaderStickerMat = (this.staticSticker.material as THREE.MeshBasicMaterial).clone();
    injectSliceRotationShader(this.shaderStickerMat);
    this.staticSticker.material = this.shaderStickerMat;
    // 关掉 moving 渲染 — shader 让 static 自己处理 slice 视觉
    this.movingFrame.visible = false;
    this.movingSticker.visible = false;
    this.movingFrame.count = 0;
    this.movingSticker.count = 0;
  }

  /** Update aLayerXYZ for given cubelets — called at endSlice to reflect new layer
   * assignments after group.rotate moved them. */
  private updateShaderLayers(cubeletInstIdxs: number[]): void {
    if (!this.useShaderSlice) return;
    const half = (this.cube.order - 1) / 2;
    const frameAttr = this.staticFrame.geometry.getAttribute('aLayerXYZ') as THREE.InstancedBufferAttribute;
    const stickerAttr = this.staticSticker.geometry.getAttribute('aLayerXYZ') as THREE.InstancedBufferAttribute;
    for (const instIdx of cubeletInstIdxs) {
      const cubeletInitial = this.instanceToInitial[instIdx];
      const cubelet = this.cube.initials.get(cubeletInitial);
      if (!cubelet) continue;
      const v = cubelet.vector;
      frameAttr.setXYZ(instIdx, v.x + half, v.y + half, v.z + half);
      const slots = this.cubeletSlots.get(cubeletInitial);
      if (slots) {
        for (const slotIdx of slots) {
          stickerAttr.setXYZ(slotIdx, v.x + half, v.y + half, v.z + half);
        }
        tmpMat.multiplyMatrices(cubelet.matrix, slot.localMat);
        staticSticker.setMatrixAt(slotIdx, tmpMat);
        stickerAttr.setXYZ(slotIdx, lx, ly, lz);
      }
    }
    this.pendingCommit.cursor = end;
    if (end >= instArr.length) {
      // 完成: flush GPU + clear uniform + release state。
      // 中间 chunk 不设 needsUpdate — shader uniform 持续 active 让视觉走旋转,
      // GPU 不需看到 static buffer 的中间状态 (24MB 上传每帧太贵)。
      staticFrame.instanceMatrix.needsUpdate = true;
      staticSticker.instanceMatrix.needsUpdate = true;
      frameAttr.needsUpdate = true;
      stickerAttr.needsUpdate = true;
      this.setShaderSliceUniforms(-1, 0, null);
      this.pendingCommit = null;
      this.cube.dirty = true;
    }
  }

  /** 强制 sync flush 全部 pending commit (next beginSlice 调用,确保新 slice 开始前
   * 所有 cubelet 位置已 committed)。 */
  private flushPendingCommitSync(): void {
    while (this.pendingCommit) this.advanceCommitChunk();
  }


  /** Update shader-slice uniforms for active slice. axisIdx: 0=x, 1=y, 2=z; -1 = inactive (layer set to -1). */
  private setShaderSliceUniforms(axisIdx: number, layer: number, rot: THREE.Matrix4 | null): void {
    if (!this.shaderFrameMat || !this.shaderStickerMat) return;
    for (const mat of [this.shaderFrameMat, this.shaderStickerMat]) {
      const u = (mat.userData as { sliceUniforms?: Record<string, { value: unknown }> }).sliceUniforms;
      if (!u) continue;
      const mask = u.uSliceAxisMask.value as THREE.Vector3;
      if (axisIdx >= 0) {
        mask.set(axisIdx === 0 ? 1 : 0, axisIdx === 1 ? 1 : 0, axisIdx === 2 ? 1 : 0);
        u.uSliceLayer.value = layer;
      } else {
        // 关 slice: layer=-1 不匹配任何 cubelet
        u.uSliceLayer.value = -1;
      }
      if (rot) (u.uSliceRot.value as THREE.Matrix4).copy(rot);
    }
  }

  private makeFrameMesh(count: number, moving: boolean): THREE.InstancedMesh {
    const geo = this.useLowPolyGpu ? Cubelet._FRAME_LOW : Cubelet._FRAME;
    const mat = this.useLowPolyGpu ? Cubelet.CORE_BASIC : Cubelet.CORE;
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.frustumCulled = false;
    // moving mesh 由我们 setSliceAngle() 设 quaternion → matrixAutoUpdate 让 three 复合 matrix
    // static mesh 永远 identity
    m.matrixAutoUpdate = moving;
    if (!moving) m.matrix.identity();
    return m;
  }

  private makeInnerMesh(count: number, moving: boolean): THREE.InstancedMesh {
    const mat = this.useLowPolyGpu ? Cubelet.CORE_BASIC : Cubelet.CORE;
    const m = new THREE.InstancedMesh(INNER_BOX, mat, count);
    m.frustumCulled = false;
    m.matrixAutoUpdate = moving;
    if (!moving) m.matrix.identity();
    return m;
  }

  private makeStickerMesh(count: number, moving: boolean): THREE.InstancedMesh {
    const baseGeo = this.useLowPolyGpu ? Cubelet._STICKER_LOW : Cubelet._STICKER;
    const m = new THREE.InstancedMesh(
      moving ? this.staticSticker?.geometry ?? baseGeo : baseGeo,
      moving ? this.movingStickerMaterial : this.stickerMaterial,
      count,
    );
    m.frustumCulled = false;
    m.matrixAutoUpdate = moving;
    if (!moving) m.matrix.identity();
    return m;
  }

  /** group.hold 时调。把 slice 内 cubelet 切换到 moving,static slot 隐藏。
   * 同时存原始 instance matrix,setSliceAngle 用它 per-instance 旋转。 */
  beginSlice(group: CubeGroup): void {
    if (this.activeSlices.has(group)) {
      // re-entrant — clean up first
      this.endSlice(group);
    }

    // Shader slice 快路径: 只设 uniforms,无 per-instance 写 (省 ~73ms / twist at N=250)
    if (this.useShaderSlice) {
      const axisIdx = group.axis === 'x' ? 0 : group.axis === 'y' ? 1 : 2;
      this.setShaderSliceUniforms(axisIdx, group.layer, null);
      // 仍然记 instances/slots 给 endSlice 用 (它需要 update cubelet.matrix)
      const instances: number[] = [];
      const slotsList: number[] = [];
      for (const positionIdx of group.indices) {
        const cubelet = this.cube.cubelets.get(positionIdx);
        if (!cubelet || cubelet._instIdx < 0) continue;
        instances.push(cubelet._instIdx);
        const slots = this.cubeletSlots.get(cubelet.initial);
        if (slots) for (const s of slots) if (this.stickerSlots[s].visible) slotsList.push(s);
      }
      // 占位空数组 (没用 origMats 但 endSlice 要 release_mat4 释放空数组)
      this.activeSlices.set(group, { instances, slots: slotsList, origCubeletMats: [], origStickerMats: [], origHintMats: [] });
      this.cube.dirty = true;
      return;
    }

    // Single→multi 过渡: 必须先把旧 single slice 的 quaternion bake 进 per-instance,
    // 否则下面写新 slice 的 origMats 会跟 q_old 复合渲染错位。
    if (this.singleSliceGroup && this.singleSliceGroup !== group) {
      this.bakeSingleSliceQuaternion();
    }
    const instances: number[] = [];
    const slotsList: number[] = [];
    const origCubeletMats: THREE.Matrix4[] = [];
    const origStickerMats: THREE.Matrix4[] = [];
    const origHintMats: THREE.Matrix4[] = [];

    for (const positionIdx of group.indices) {
      const cubelet = this.cube.cubelets.get(positionIdx);
      if (!cubelet) continue;
      const instIdx = cubelet._instIdx;
      if (instIdx < 0) continue;
      instances.push(instIdx);
      // Frame matrix at this instance == cubelet.matrix (logical state).
      // 直接读 cubelet.matrix 跳过 staticFrame.getMatrixAt 的 typed array dance。
      const origCub = this.acquireMat4();
      origCub.copy(cubelet.matrix);
      origCubeletMats.push(origCub);
      this.movingFrame.setMatrixAt(instIdx, cubelet.matrix);
      this.staticFrame.setMatrixAt(instIdx, HIDE_MAT);
      if (this.hasInner) {
        this.movingInner.setMatrixAt(instIdx, cubelet.matrix);
        this.staticInner.setMatrixAt(instIdx, HIDE_MAT);
      }

      const slots = this.cubeletSlots.get(cubelet.initial);
      if (slots) {
        for (const slotIdx of slots) {
          if (!this.stickerSlots[slotIdx].visible) continue;
          slotsList.push(slotIdx);
          this.staticSticker.getMatrixAt(slotIdx, this.tmpMat);
          const origStk = this.acquireMat4();
          origStk.copy(this.tmpMat);
          origStickerMats.push(origStk);
          this.movingSticker.setMatrixAt(slotIdx, this.tmpMat);
          this.staticSticker.setMatrixAt(slotIdx, HIDE_MAT);
          // Hint 在 visible=false 时也照写 4×62500 次 mat 操作 = beginSlice 的 30% 时间。
          // 关时跳过,need 时 set hint 走 onHintEnabledMidSlice 重新 fill。
          if (this._hint) {
            this.staticHint.getMatrixAt(slotIdx, this.tmpMat);
            const origHnt = this.acquireMat4();
            origHnt.copy(this.tmpMat);
            origHintMats.push(origHnt);
            this.movingHint.setMatrixAt(slotIdx, this.tmpMat);
            this.staticHint.setMatrixAt(slotIdx, HIDE_MAT);
          }
        }
      }
    }
    this.activeSlices.set(group, { instances, slots: slotsList, origCubeletMats, origStickerMats, origHintMats });
    if (this.activeSlices.size === 1) {
      // 第一个 slice 激活:打开 moving 渲染、重置 quaternion
      this.movingFrame.quaternion.identity();
      this.movingSticker.quaternion.identity();
      this.movingHint.quaternion.identity();
      this.movingFrame.count = this.instanceToInitial.length;
      this.movingSticker.count = this.stickerSlots.length;
      this.movingHint.count = this.stickerSlots.length;
      if (this.hasInner) {
        this.movingInner.quaternion.identity();
        this.movingInner.count = this.instanceToInitial.length;
      }
    }
    this.staticFrame.instanceMatrix.needsUpdate = true;
    this.movingFrame.instanceMatrix.needsUpdate = true;
    this.staticSticker.instanceMatrix.needsUpdate = true;
    this.movingSticker.instanceMatrix.needsUpdate = true;
    this.staticHint.instanceMatrix.needsUpdate = true;
    this.movingHint.instanceMatrix.needsUpdate = true;
    if (this.hasInner) {
      this.staticInner.instanceMatrix.needsUpdate = true;
      this.movingInner.instanceMatrix.needsUpdate = true;
    }
    // Stage 1: 标记 single slice (恰好 1 个 active),setSliceAngle 走快路径
    if (__PERF_FLAGS.singleSliceQuaternion && this.activeSlices.size === 1) {
      this.singleSliceGroup = group;
    }
    this.cube.dirty = true;
  }

  /** Single → multi 过渡 / endSlice 收尾时调:把 singleSliceGroup 的当前 quaternion
   * bake 进 per-instance matrices, 然后重置 moving.quaternion = identity。
   * 之后两个 slice 都走 per-instance 路径。 */
  private bakeSingleSliceQuaternion(): void {
    const group = this.singleSliceGroup;
    if (!group) return;
    const state = this.activeSlices.get(group);
    if (!state) { this.singleSliceGroup = null; return; }
    this.tmpRotMat.makeRotationFromQuaternion(this.movingFrame.quaternion);
    if (this.hasInner) {
      for (let i = 0; i < state.instances.length; i++) {
        this.tmpMat.multiplyMatrices(this.tmpRotMat, state.origCubeletMats[i]);
        this.movingFrame.setMatrixAt(state.instances[i], this.tmpMat);
        this.movingInner.setMatrixAt(state.instances[i], this.tmpMat);
      }
      this.movingInner.instanceMatrix.needsUpdate = true;
      this.movingInner.quaternion.identity();
    } else {
      for (let i = 0; i < state.instances.length; i++) {
        this.tmpMat.multiplyMatrices(this.tmpRotMat, state.origCubeletMats[i]);
        this.movingFrame.setMatrixAt(state.instances[i], this.tmpMat);
      }
    }
    for (let i = 0; i < state.slots.length; i++) {
      this.tmpMat.multiplyMatrices(this.tmpRotMat, state.origStickerMats[i]);
      this.movingSticker.setMatrixAt(state.slots[i], this.tmpMat);
    }
    this.movingFrame.instanceMatrix.needsUpdate = true;
    this.movingSticker.instanceMatrix.needsUpdate = true;
    this.movingFrame.quaternion.identity();
    this.movingSticker.quaternion.identity();
    if (this._hint && state.origHintMats.length > 0) {
      for (let i = 0; i < state.slots.length; i++) {
        this.tmpMat.multiplyMatrices(this.tmpRotMat, state.origHintMats[i]);
        this.movingHint.setMatrixAt(state.slots[i], this.tmpMat);
      }
      this.movingHint.instanceMatrix.needsUpdate = true;
      this.movingHint.quaternion.identity();
    }
    this.singleSliceGroup = null;
  }

  /** group.angle setter 调。
   * - 单 slice 模式 (stage 1): 整 moving mesh quaternion = rot,免 N² mat4 mul。
   * - 多 slice 模式: per-instance 写 instance matrix。 */
  setSliceAngle(group: CubeGroup, angle: number): void {
    const state = this.activeSlices.get(group);
    if (!state) return;
    const axisVec = CubeGroup.AXIS_VECTOR[group.axis];
    if (!axisVec) return;
    this.tmpQuat.setFromAxisAngle(axisVec, angle);

    // Shader 路径: 更新 uniform rotation matrix。免 N² 写。
    if (this.useShaderSlice) {
      this.tmpRotMat.makeRotationFromQuaternion(this.tmpQuat);
      const axisIdx = group.axis === 'x' ? 0 : group.axis === 'y' ? 1 : 2;
      this.setShaderSliceUniforms(axisIdx, group.layer, this.tmpRotMat);
      this.cube.dirty = true;
      return;
    }

    if (this.singleSliceGroup === group) {
      // Stage 1 快路径: moving mesh.matrix 由 quaternion 自动复合,
      // 每个 instance 渲染 = rotation(q) × origMat × vertex。
      this.movingFrame.quaternion.copy(this.tmpQuat);
      this.movingSticker.quaternion.copy(this.tmpQuat);
      this.movingHint.quaternion.copy(this.tmpQuat);
      if (this.hasInner) this.movingInner.quaternion.copy(this.tmpQuat);
      this.cube.dirty = true;
      return;
    }

    this.tmpRotMat.makeRotationFromQuaternion(this.tmpQuat);
    if (this.hasInner) {
      for (let i = 0; i < state.instances.length; i++) {
        this.tmpMat.multiplyMatrices(this.tmpRotMat, state.origCubeletMats[i]);
        this.movingFrame.setMatrixAt(state.instances[i], this.tmpMat);
        this.movingInner.setMatrixAt(state.instances[i], this.tmpMat);
      }
      this.movingInner.instanceMatrix.needsUpdate = true;
    } else {
      for (let i = 0; i < state.instances.length; i++) {
        this.tmpMat.multiplyMatrices(this.tmpRotMat, state.origCubeletMats[i]);
        this.movingFrame.setMatrixAt(state.instances[i], this.tmpMat);
      }
    }
    for (let i = 0; i < state.slots.length; i++) {
      this.tmpMat.multiplyMatrices(this.tmpRotMat, state.origStickerMats[i]);
      this.movingSticker.setMatrixAt(state.slots[i], this.tmpMat);
    }
    this.movingFrame.instanceMatrix.needsUpdate = true;
    this.movingSticker.instanceMatrix.needsUpdate = true;
    if (this._hint && state.origHintMats.length > 0) {
      for (let i = 0; i < state.slots.length; i++) {
        this.tmpMat.multiplyMatrices(this.tmpRotMat, state.origHintMats[i]);
        this.movingHint.setMatrixAt(state.slots[i], this.tmpMat);
      }
      this.movingHint.instanceMatrix.needsUpdate = true;
    }
    this.cube.dirty = true;
  }

  /** group.drop 时调。cubelet.matrix 已被 group.rotate() 改成新位置,写回 static。 */
  endSlice(group: CubeGroup): void {
    const state = this.activeSlices.get(group);
    if (!state) return;

    // Shader 路径: 写 aOrientation + aLayerXYZ 给 slice cubelets (frame + sticker)。
    // aOrientation 4 floats vs mat4 16 floats, sticker 不用 multiplyMatrices, 一次性 commit
    // 同步 ~30ms 比 chunk + flushPendingCommitSync 模式 (per beginSlice 60ms spike) 更稳。
    if (this.useShaderSlice) {
      for (const instIdx of state.instances) {
        const cubeletInitial = this.instanceToInitial[instIdx];
        const cubelet = this.cube.initials.get(cubeletInitial);
        if (!cubelet) continue;
        this.staticFrame.setMatrixAt(instIdx, cubelet.matrix);
        const slots = this.cubeletSlots.get(cubeletInitial);
        if (slots) {
          for (const slotIdx of slots) {
            const slot = this.stickerSlots[slotIdx];
            if (!slot.visible) {
              this.staticSticker.setMatrixAt(slotIdx, HIDE_MAT);
              continue;
            }
            this.tmpMat.multiplyMatrices(cubelet.matrix, slot.localMat);
            this.staticSticker.setMatrixAt(slotIdx, this.tmpMat);
          }
        }
      }
      this.updateShaderLayers(state.instances);
      this.staticFrame.instanceMatrix.needsUpdate = true;
      this.staticSticker.instanceMatrix.needsUpdate = true;
      this.setShaderSliceUniforms(-1, 0, null);
      this.releaseMat4Array(state.origCubeletMats);
      this.releaseMat4Array(state.origStickerMats);
      this.releaseMat4Array(state.origHintMats);
      this.activeSlices.delete(group);
      const instArr = state.instances;
      const cubeletsArr = state.cubelets;
      const staticFrame = this.staticFrame;
      const staticSticker = this.staticSticker;
      const frameLayerAttr = staticFrame.geometry.getAttribute('aLayerXYZ') as THREE.InstancedBufferAttribute;
      const stickerLayerAttr = staticSticker.geometry.getAttribute('aLayerXYZ') as THREE.InstancedBufferAttribute;
      const frameOrientAttr = staticFrame.geometry.getAttribute('aOrientation') as THREE.InstancedBufferAttribute;
      const stickerOrientAttr = staticSticker.geometry.getAttribute('aOrientation') as THREE.InstancedBufferAttribute;
      const frameOrientArr = frameOrientAttr.array as Float32Array;
      const stickerOrientArr = stickerOrientAttr.array as Float32Array;
      const half = (this.cube.order - 1) / 2;
      const cubeletSlots = this.cubeletSlots;
      for (let i = 0; i < instArr.length; i++) {
        const cubelet = cubeletsArr[i];
        if (!cubelet) continue;
        const v = cubelet.vector;
        const q = cubelet.quaternion;
        const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
        const lx = v.x + half, ly = v.y + half, lz = v.z + half;
        const instOff = instArr[i] * 4;
        frameOrientArr[instOff + 0] = qx;
        frameOrientArr[instOff + 1] = qy;
        frameOrientArr[instOff + 2] = qz;
        frameOrientArr[instOff + 3] = qw;
        frameLayerAttr.setXYZ(instArr[i], lx, ly, lz);
        const slots = cubeletSlots.get(cubelet.initial);
        if (!slots) continue;
        for (let j = 0; j < slots.length; j++) {
          const slotIdx = slots[j];
          const slotOff = slotIdx * 4;
          stickerOrientArr[slotOff + 0] = qx;
          stickerOrientArr[slotOff + 1] = qy;
          stickerOrientArr[slotOff + 2] = qz;
          stickerOrientArr[slotOff + 3] = qw;
          stickerLayerAttr.setXYZ(slotIdx, lx, ly, lz);
        }
      }
      frameLayerAttr.needsUpdate = true;
      stickerLayerAttr.needsUpdate = true;
      frameOrientAttr.needsUpdate = true;
      stickerOrientAttr.needsUpdate = true;
      this.setShaderSliceUniforms(-1, 0, null);
      state.cubelets.length = 0;
      this.cube.dirty = true;
      return;
    }

    for (const instIdx of state.instances) {
      const cubeletInitial = this.instanceToInitial[instIdx];
      const cubelet = this.cube.initials.get(cubeletInitial);
      if (!cubelet) continue;
      this.staticFrame.setMatrixAt(instIdx, cubelet.matrix);
      this.movingFrame.setMatrixAt(instIdx, HIDE_MAT);
      if (this.hasInner) {
        this.staticInner.setMatrixAt(instIdx, cubelet.matrix);
        this.movingInner.setMatrixAt(instIdx, HIDE_MAT);
      }

      const slots = this.cubeletSlots.get(cubeletInitial);
      if (slots) {
        for (const slotIdx of slots) {
          const slot = this.stickerSlots[slotIdx];
          if (!slot.visible) {
            this.staticSticker.setMatrixAt(slotIdx, HIDE_MAT);
            this.movingSticker.setMatrixAt(slotIdx, HIDE_MAT);
            if (this._hint) {
              this.staticHint.setMatrixAt(slotIdx, HIDE_MAT);
              this.movingHint.setMatrixAt(slotIdx, HIDE_MAT);
            }
            continue;
          }
          this.tmpMat.multiplyMatrices(cubelet.matrix, slot.localMat);
          this.staticSticker.setMatrixAt(slotIdx, this.tmpMat);
          this.movingSticker.setMatrixAt(slotIdx, HIDE_MAT);
          // Hint matrix 是 endSlice 50% 时间。关时跳, 开时 set hint(true) 走全量 rebuild
          if (this._hint) {
            this.tmpMat.multiplyMatrices(cubelet.matrix, this.hintLocalMats[slotIdx]);
            this.staticHint.setMatrixAt(slotIdx, this.tmpMat);
            this.movingHint.setMatrixAt(slotIdx, HIDE_MAT);
          }
        }
      }
    }
    // Stage 2: 把 origMats 数组里的 Matrix4 全释放回池
    this.releaseMat4Array(state.origCubeletMats);
    this.releaseMat4Array(state.origStickerMats);
    this.releaseMat4Array(state.origHintMats);
    this.activeSlices.delete(group);
    if (this.singleSliceGroup === group) {
      this.singleSliceGroup = null;
    }
    if (this.activeSlices.size === 0) {
      this.movingFrame.quaternion.identity();
      this.movingSticker.quaternion.identity();
      this.movingHint.quaternion.identity();
      this.movingFrame.count = 0;
      this.movingSticker.count = 0;
      this.movingHint.count = 0;
      if (this.hasInner) {
        this.movingInner.quaternion.identity();
        this.movingInner.count = 0;
      }
    }
    this.staticFrame.instanceMatrix.needsUpdate = true;
    this.movingFrame.instanceMatrix.needsUpdate = true;
    this.staticSticker.instanceMatrix.needsUpdate = true;
    this.movingSticker.instanceMatrix.needsUpdate = true;
    this.staticHint.instanceMatrix.needsUpdate = true;
    this.movingHint.instanceMatrix.needsUpdate = true;
    if (this.hasInner) {
      this.staticInner.instanceMatrix.needsUpdate = true;
      this.movingInner.instanceMatrix.needsUpdate = true;
    }
    this.cube.dirty = true;
  }

  /** cube.reset() 后调:全部 cubelet 在初始位置,重建所有 static 矩阵。 */
  rebuildAll(): void {
    // 池回收任何还活着的 slice 的 mat4
    for (const state of this.activeSlices.values()) {
      this.releaseMat4Array(state.origCubeletMats);
      this.releaseMat4Array(state.origStickerMats);
      this.releaseMat4Array(state.origHintMats);
    }
    this.activeSlices.clear();
    this.singleSliceGroup = null;
    this.movingFrame.count = 0;
    this.movingSticker.count = 0;
    this.movingHint.count = 0;
    this.tmpQuat.identity();
    this.movingFrame.quaternion.copy(this.tmpQuat);
    this.movingSticker.quaternion.copy(this.tmpQuat);
    this.movingHint.quaternion.copy(this.tmpQuat);
    if (this.hasInner) {
      this.movingInner.count = 0;
      this.movingInner.quaternion.copy(this.tmpQuat);
    }

    for (let i = 0; i < this.instanceToInitial.length; i++) {
      const cubeletInitial = this.instanceToInitial[i];
      const cubelet = this.cube.initials.get(cubeletInitial);
      if (!cubelet) continue;
      this.staticFrame.setMatrixAt(i, cubelet.matrix);
      this.movingFrame.setMatrixAt(i, HIDE_MAT);
      if (this.hasInner) {
        this.staticInner.setMatrixAt(i, cubelet.matrix);
        this.movingInner.setMatrixAt(i, HIDE_MAT);
      }
    }
    for (let i = 0; i < this.stickerSlots.length; i++) {
      const slot = this.stickerSlots[i];
      const cubelet = this.cube.initials.get(slot.cubeletInitial);
      if (!cubelet || !slot.visible) {
        this.staticSticker.setMatrixAt(i, HIDE_MAT);
        this.movingSticker.setMatrixAt(i, HIDE_MAT);
        this.staticHint.setMatrixAt(i, HIDE_MAT);
        this.movingHint.setMatrixAt(i, HIDE_MAT);
        continue;
      }
      this.tmpMat.multiplyMatrices(cubelet.matrix, slot.localMat);
      this.staticSticker.setMatrixAt(i, this.tmpMat);
      this.movingSticker.setMatrixAt(i, HIDE_MAT);
      this.tmpMat.multiplyMatrices(cubelet.matrix, this.hintLocalMats[i]);
      this.staticHint.setMatrixAt(i, this.tmpMat);
      this.movingHint.setMatrixAt(i, HIDE_MAT);
    }
    this.staticFrame.instanceMatrix.needsUpdate = true;
    this.movingFrame.instanceMatrix.needsUpdate = true;
    this.staticSticker.instanceMatrix.needsUpdate = true;
    this.movingSticker.instanceMatrix.needsUpdate = true;
    this.staticHint.instanceMatrix.needsUpdate = true;
    this.movingHint.instanceMatrix.needsUpdate = true;
    if (this.hasInner) {
      this.staticInner.instanceMatrix.needsUpdate = true;
      this.movingInner.instanceMatrix.needsUpdate = true;
    }
    this.cube.dirty = true;
  }

  applyStick(cubeletInitial: number, face: number, label: string | undefined): void {
    const slot = this.slotLookup.get(cubeletInitial * 6 + face);
    if (slot === undefined) return;
    const slotData = this.stickerSlots[slot];
    if (label === "remove") {
      slotData.visible = false;
      this.staticSticker.setMatrixAt(slot, HIDE_MAT);
      this.movingSticker.setMatrixAt(slot, HIDE_MAT);
      this.staticHint.setMatrixAt(slot, HIDE_MAT);
      this.movingHint.setMatrixAt(slot, HIDE_MAT);
      this.staticSticker.instanceMatrix.needsUpdate = true;
      this.movingSticker.instanceMatrix.needsUpdate = true;
      this.staticHint.instanceMatrix.needsUpdate = true;
      this.movingHint.instanceMatrix.needsUpdate = true;
      this.cube.dirty = true;
      return;
    }
    if (!slotData.visible) {
      // re-show
      slotData.visible = true;
      const cubelet = this.cube.initials.get(cubeletInitial);
      if (cubelet) {
        this.tmpMat.multiplyMatrices(cubelet.matrix, slotData.localMat);
        this.staticSticker.setMatrixAt(slot, this.tmpMat);
        this.tmpMat.multiplyMatrices(cubelet.matrix, this.hintLocalMats[slot]);
        this.staticHint.setMatrixAt(slot, this.tmpMat);
        this.staticSticker.instanceMatrix.needsUpdate = true;
        this.staticHint.instanceMatrix.needsUpdate = true;
      }
    }
    const cubelet = this.cube.initials.get(cubeletInitial);
    const effective = label && label.length > 0 ? label : (cubelet?.colors[face] ?? "Gray");
    this.tmpColor.set(COLORS[effective] ?? COLORS.Gray);
    this.staticSticker.setColorAt(slot, this.tmpColor);
    this.movingSticker.setColorAt(slot, this.tmpColor);
    this.staticHint.setColorAt(slot, this.tmpColor);
    this.movingHint.setColorAt(slot, this.tmpColor);
    if (this.staticSticker.instanceColor) this.staticSticker.instanceColor.needsUpdate = true;
    if (this.movingSticker.instanceColor) this.movingSticker.instanceColor.needsUpdate = true;
    if (this.staticHint.instanceColor) this.staticHint.instanceColor.needsUpdate = true;
    if (this.movingHint.instanceColor) this.movingHint.instanceColor.needsUpdate = true;
    this.cube.dirty = true;
  }

  set thickness(value: boolean) {
    if (value === this._thickness) return;
    this._thickness = value;
    const zScale = value ? HALF : 1;
    for (let i = 0; i < this.stickerSlots.length; i++) {
      const slot = this.stickerSlots[i];
      slot.localMat = makeStickerLocalMatrix(slot.face, zScale);
      this.hintLocalMats[i] = makeStickerLocalMatrix(slot.face, zScale, this.hintDistance);
    }
    // Rebuild sticker + hint matrices
    for (let i = 0; i < this.stickerSlots.length; i++) {
      const slot = this.stickerSlots[i];
      const cubelet = this.cube.initials.get(slot.cubeletInitial);
      if (!cubelet || !slot.visible) {
        this.staticSticker.setMatrixAt(i, HIDE_MAT);
        this.staticHint.setMatrixAt(i, HIDE_MAT);
        continue;
      }
      this.tmpMat.multiplyMatrices(cubelet.matrix, slot.localMat);
      this.staticSticker.setMatrixAt(i, this.tmpMat);
      this.tmpMat.multiplyMatrices(cubelet.matrix, this.hintLocalMats[i]);
      this.staticHint.setMatrixAt(i, this.tmpMat);
    }
    this.staticSticker.instanceMatrix.needsUpdate = true;
    this.staticHint.instanceMatrix.needsUpdate = true;
    this.cube.dirty = true;
  }
  get thickness(): boolean { return this._thickness; }

  set hollow(value: boolean) {
    // Shader slice 模式 frame 用 shaderFrameMat (注入 GLSL),不能换成 CORE/TRANS,
    // 否则 shader 注入丢失。inner 在 super-order 已 disabled,这里也跳过。
    if (this.useShaderSlice) {
      return;
    }
    const mat = value ? Cubelet.TRANS : Cubelet.CORE;
    this.staticFrame.material = mat;
    this.movingFrame.material = mat;
    if (this.hasInner) {
      this.staticInner.material = mat;
      this.movingInner.material = mat;
    }
    this.cube.dirty = true;
  }

  set arrow(value: boolean) {
    if (value === this._arrow) return;
    this._arrow = value;
    this.staticSticker.geometry = value ? Cubelet._ARROW : Cubelet._STICKER;
    this.movingSticker.geometry = value ? Cubelet._ARROW : Cubelet._STICKER;
    this.staticHint.geometry = value ? Cubelet._HINT_ARROW : Cubelet._HINT;
    this.movingHint.geometry = value ? Cubelet._HINT_ARROW : Cubelet._HINT;
    this.cube.dirty = true;
  }
  get arrow(): boolean { return this._arrow; }

  set hint(value: boolean) {
    if (value === this._hint) return;
    this._hint = value;
    this.staticHint.visible = value;
    this.movingHint.visible = value;
    if (value) {
      // 开 hint 时全量 rebuild staticHint — 关 hint 期间的 cube twist 不更新它,
      // 此时位置可能 stale。全量重写一次保证视觉正确。
      for (let i = 0; i < this.stickerSlots.length; i++) {
        const slot = this.stickerSlots[i];
        const cubelet = this.cube.initials.get(slot.cubeletInitial);
        if (!cubelet || !slot.visible) {
          this.staticHint.setMatrixAt(i, HIDE_MAT);
          continue;
        }
        this.tmpMat.multiplyMatrices(cubelet.matrix, this.hintLocalMats[i]);
        this.staticHint.setMatrixAt(i, this.tmpMat);
      }
      this.staticHint.instanceMatrix.needsUpdate = true;
    }
    this.cube.dirty = true;
  }
  get hint(): boolean { return this._hint; }

  dispose(): void {
    this.staticFrame.dispose();
    this.movingFrame.dispose();
    this.staticInner.dispose();
    this.movingInner.dispose();
    this.staticSticker.dispose();
    this.movingSticker.dispose();
    this.staticHint.dispose();
    this.movingHint.dispose();
    this.stickerMaterial.dispose();
    this.movingStickerMaterial.dispose();
    this.hintMaterial.dispose();
    this.movingHintMaterial.dispose();
  }
}
