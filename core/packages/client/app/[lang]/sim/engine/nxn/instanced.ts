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
import { FACE, COLORS } from "../define";
import { rawMaterial, rawMaterialBasic, buildRawAttributes, attachRawAttributes, type RawAttrs } from "./rawCore";
import { mirrorTables } from "../mirror/mirrorGeometry";

const HALF = Cubelet.SIZE / 2;
const HIDE_MAT = new THREE.Matrix4().makeScale(0, 0, 0);
const ONE_SCALE = new THREE.Vector3(1, 1, 1);
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
} = {
  superOrderThreshold: 50,
  singleSliceQuaternion: true,
};

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

  /** 反查: instance idx → cubelet.initial (用于 endSlice 拿 cubelet) */
  instanceToInitial!: Uint32Array;

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
  /** 构造时为 true (延后 populate 省 ~440ms @ N=250); 首次 set hint(true) 触发 populateHint() 后置 false */
  private hintNeedsPopulate = false;
  private hintDistance: number;
  /** hint 颜色预混用的 bg 色 (matches CSS --background)。setHintBackdrop() 注入,主题切换 reapply。 */
  private hintBgColor: THREE.Color = new THREE.Color(0xffffff);
  /** hint face 色权重: hint_rgb = HINT_FACE_MIX * face + (1-HINT_FACE_MIX) * bg。等效原 opacity=0.35。 */
  private static readonly HINT_FACE_MIX = 0.35;

  stickerSlots: StickerSlot[] = [];
  /** 紧凑表: cubelet._instIdx * 6 + face → slot idx (-1 = 无 sticker)。
   * 替代两个 Map (slotLookup + cubeletSlots),N=250 省 ~70 MB:
   * 之前 375k Map 项 + 372k 小 Array,现在 = visCount*6*4B = ~9 MB。 */
  private cubeletFaceSlot!: Int32Array;

  // toggles
  private _thickness = true;
  private _arrow = false;
  private _hint = false;
  private _hollow = false;
  /** 原核 (raw/stickerless body) 状态 + 资源。全阶生效(低/中阶 Phong+inner,超高阶 unlit Basic 壳)。 */
  private _rawCore = false;
  private _rawAttrs: RawAttrs | null = null;
  private _rawFrameGeo: THREE.BufferGeometry | null = null;
  private _rawInnerGeo: THREE.BufferGeometry | null = null;

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

  // 临时
  private tmpMat = new THREE.Matrix4();
  private tmpRotMat = new THREE.Matrix4();
  private tmpColor = new THREE.Color();
  private tmpQuat = new THREE.Quaternion();

  // Mirror Cube: per-instance non-uniform cuboid center (×3) + scale (×3), indexed by
  // instance idx. null = standard NxN (uniform — the static/sticker matrices come
  // straight from cubelet.matrix, byte-identical to before). When set, every static
  // matrix is recomposed as compose(R·center0, R, scale0); the slice-turn animation
  // (R_slice × origMatrix) is automatically a valid render matrix of the new state.
  private _mirrorCenters: Float32Array | null = null;
  private _mirrorScales: Float32Array | null = null;
  // Mirror cube: the 3 turn axes pass through the CENTER cubie (the core), which is
  // offset from the bounding-box origin because the layers are non-uniform. A face
  // turn must rotate about that core axis, not the origin — else the face center
  // (a fixed 1x1 piece) would translate. Null for uniform NxN (rotate about origin).
  private _mirrorPivot: THREE.Vector3 | null = null;
  private tmpMirrorMat = new THREE.Matrix4();
  private tmpMirrorV1 = new THREE.Vector3();
  private tmpMirrorV2 = new THREE.Vector3();

  constructor(cube: Cube) {
    super();
    const T0 = performance.now();
    this.cube = cube;
    this.matrixAutoUpdate = false;
    this.hasInner = cube.order < __PERF_FLAGS.superOrderThreshold;

    const cubelets = [...cube.initials.values()];
    const visCount = cubelets.length;
    // initialToInstance Map 已淘汰 — instance idx 直接存到 cubelet._instIdx,beginSlice 走属性读
    // instanceToInitial 用 Uint32Array 跳 Array.push (372k 次)
    this.instanceToInitial = new Uint32Array(visCount);
    for (let i = 0; i < visCount; i++) {
      const c = cubelets[i];
      c._instIdx = i;
      this.instanceToInitial[i] = c.initial;
    }
    const T1 = performance.now();

    // Frame meshes + per-cubelet inner box meshes(共享 matrix)
    this.staticFrame = this.makeFrameMesh(visCount, false);
    this.movingFrame = this.makeFrameMesh(visCount, true);
    this.movingFrame.count = 0;
    // !hasInner 时仍 new mesh 占位 (dispose / 各 setMatrixAt 调用都得 mesh 存在),
    // 但 count=1 让 InstancedBufferAttribute 只分配 16 floats 而不是 16 * visCount。
    // N=250 省 ~48 MB (2 个 mesh × 64B × 372k)。
    const innerBufCount = this.hasInner ? visCount : 1;
    this.staticInner = this.makeInnerMesh(innerBufCount, false);
    this.movingInner = this.makeInnerMesh(innerBufCount, true);
    this.movingInner.count = 0;
    if (!this.hasInner) {
      this.staticInner.visible = false;
      this.movingInner.visible = false;
      this.staticInner.count = 0;
    }

    // 构造时 cubelet.matrix = 单位旋转 + cubelet.position translation。直接写 instance buffer
    // 跳过 setMatrixAt (matrix.toArray 间接)。movingFrame 的 HIDE_MAT 也跳:moving count=0,
    // 当前不渲染;有 slice 时 beginSlice 会写正确矩阵。
    {
      const arr = this.staticFrame.instanceMatrix.array;
      for (let i = 0; i < visCount; i++) {
        const off = i * 16;
        const p = cubelets[i].position;
        arr[off + 0] = 1; arr[off + 5] = 1; arr[off + 10] = 1; arr[off + 15] = 1;
        arr[off + 12] = p.x; arr[off + 13] = p.y; arr[off + 14] = p.z;
      }
    }
    if (this.hasInner) {
      const arr = this.staticInner.instanceMatrix.array;
      for (let i = 0; i < visCount; i++) {
        const off = i * 16;
        const p = cubelets[i].position;
        arr[off + 0] = 1; arr[off + 5] = 1; arr[off + 10] = 1; arr[off + 15] = 1;
        arr[off + 12] = p.x; arr[off + 13] = p.y; arr[off + 14] = p.z;
      }
    }
    this.staticFrame.instanceMatrix.needsUpdate = true;
    this.movingFrame.instanceMatrix.needsUpdate = true;
    if (this.hasInner) {
      this.staticInner.instanceMatrix.needsUpdate = true;
      this.movingInner.instanceMatrix.needsUpdate = true;
    }

    const T2 = performance.now();

    // Sticker slots — 共享 6 个 face localMat,而不是每 slot 各 alloc 一个 (376k → 6,省 ~150ms)
    const zScale = this._thickness ? HALF : 1;
    const faceLocalMats: THREE.Matrix4[] = [];
    for (let f = 0; f < 6; f++) faceLocalMats.push(makeStickerLocalMatrix(f, zScale));
    this.cubeletFaceSlot = new Int32Array(visCount * 6).fill(-1);
    for (const cubelet of cubelets) {
      const base = cubelet._instIdx * 6;
      for (let f = 0; f < 6; f++) {
        const col = cubelet.colors[f];
        if (col == null || col === "") continue;
        const slotIdx = this.stickerSlots.length;
        this.cubeletFaceSlot[base + f] = slotIdx;
        this.stickerSlots.push({
          cubeletInitial: cubelet.initial,
          face: f,
          localMat: faceLocalMats[f],
          visible: true,
        });
      }
    }

    const T3 = performance.now();

    // Sticker meshes — N≥50 用 unlit Basic 省 fragment shader 光照
    const isSuperOrderForSticker = this.cube.order >= __PERF_FLAGS.superOrderThreshold;
    this.stickerMaterial = isSuperOrderForSticker ? new THREE.MeshBasicMaterial() : new THREE.MeshLambertMaterial();
    this.movingStickerMaterial = isSuperOrderForSticker ? new THREE.MeshBasicMaterial() : new THREE.MeshLambertMaterial();
    this.staticSticker = this.makeStickerMesh(this.stickerSlots.length, false);
    this.movingSticker = this.makeStickerMesh(this.stickerSlots.length, true);
    this.movingSticker.count = 0;

    // 构造时 cubelet.matrix = 纯 translation (rot=identity, scale=1),T × localMat 简化为
    // localMat.elements 直接 copy + 12/13/14 加 cubelet.position。跳过 multiplyMatrices (64 mul) +
    // setMatrixAt (tmpMat.toArray)。movingSticker.setMatrixAt(HIDE_MAT) 也跳:moving count=0 当前不
    // 渲染,Float32Array 默认 0 矩阵也是 degenerate (count 起来后 beginSlice 会写正确值)。
    const staticInstArr = this.staticSticker.instanceMatrix.array;
    // 预算 6 面的 RGB triple — 跳过 376k × COLORS 字符串查表 + Color.set 解析
    const faceRGB = new Float32Array(6 * 3);
    for (let f = 0; f < 6; f++) {
      this.tmpColor.set(COLORS[FACE[f as 0|1|2|3|4|5]] ?? COLORS.Gray);
      faceRGB[f * 3 + 0] = this.tmpColor.r;
      faceRGB[f * 3 + 1] = this.tmpColor.g;
      faceRGB[f * 3 + 2] = this.tmpColor.b;
    }
    // 触发 instanceColor 分配 (setColorAt 第一次调用时会自动分配 InstancedBufferAttribute)
    this.staticSticker.setColorAt(0, this.tmpColor);
    this.movingSticker.setColorAt(0, this.tmpColor);
    const staticColorArr = this.staticSticker.instanceColor!.array;
    const movingColorArr = this.movingSticker.instanceColor!.array;
    for (let i = 0; i < this.stickerSlots.length; i++) {
      const slot = this.stickerSlots[i];
      const cubelet = cube.initials.get(slot.cubeletInitial)!;
      const lm = slot.localMat.elements;
      const cp = cubelet.position;
      const off = i * 16;
      staticInstArr[off+0] = lm[0]; staticInstArr[off+1] = lm[1]; staticInstArr[off+2] = lm[2]; staticInstArr[off+3] = lm[3];
      staticInstArr[off+4] = lm[4]; staticInstArr[off+5] = lm[5]; staticInstArr[off+6] = lm[6]; staticInstArr[off+7] = lm[7];
      staticInstArr[off+8] = lm[8]; staticInstArr[off+9] = lm[9]; staticInstArr[off+10] = lm[10]; staticInstArr[off+11] = lm[11];
      staticInstArr[off+12] = lm[12] + cp.x;
      staticInstArr[off+13] = lm[13] + cp.y;
      staticInstArr[off+14] = lm[14] + cp.z;
      staticInstArr[off+15] = lm[15];
      // sticker 的 face label 必为 FACE_LABELS[face] (slot 创建条件就是 colors[face] 非空,
      // 而构造期 colors[face] 等于 FACE_LABELS[face]),直接查 faceRGB 跳过 COLORS map
      const cOff = i * 3;
      const fOff = slot.face * 3;
      staticColorArr[cOff + 0] = faceRGB[fOff + 0];
      staticColorArr[cOff + 1] = faceRGB[fOff + 1];
      staticColorArr[cOff + 2] = faceRGB[fOff + 2];
      movingColorArr[cOff + 0] = faceRGB[fOff + 0];
      movingColorArr[cOff + 1] = faceRGB[fOff + 1];
      movingColorArr[cOff + 2] = faceRGB[fOff + 2];
    }
    this.staticSticker.instanceMatrix.needsUpdate = true;
    this.movingSticker.instanceMatrix.needsUpdate = true;
    if (this.staticSticker.instanceColor) this.staticSticker.instanceColor.needsUpdate = true;
    if (this.movingSticker.instanceColor) this.movingSticker.instanceColor.needsUpdate = true;

    // Hint stickers — 单面 plane (ShapeGeometry) + BackSide:
    // 只在 face normal 背向 camera 时可见,自动只显"看不到的 3 个面"。
    // 不透明 + 颜色预混 0.35 face + 0.65 bg: 等效原 opacity=0.35 视觉但 canvas alpha=1,
    // 防 checkered bg 透过 hint 区域。bg 色由 setHintBackdrop() 注入,主题切换需 re-call。
    this.hintDistance = cube.order + 1;
    this.hintMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
    this.movingHintMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
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

    // hintLocalMats 仍 eager 建 (beginSlice/endSlice 依赖),共享 6 个 face 矩阵省 alloc
    const faceHintMatsInit: THREE.Matrix4[] = [];
    for (let f = 0; f < 6; f++) faceHintMatsInit.push(makeStickerLocalMatrix(f, zScale, this.hintDistance));
    for (let i = 0; i < this.stickerSlots.length; i++) {
      this.hintLocalMats.push(faceHintMatsInit[this.stickerSlots[i].face]);
    }
    // Hint 默认 off; 延后 setMatrixAt + setColorAt 上传到首次 set hint(true)
    // (hint 输出走 staticHint.visible=false,在 visible 之前 GPU 不读其 instance buffer,延后无副作用)
    this.hintNeedsPopulate = true;

    this.add(this.staticFrame);
    this.add(this.movingFrame);
    this.add(this.staticInner);
    this.add(this.movingInner);
    this.add(this.staticSticker);
    this.add(this.movingSticker);
    this.add(this.staticHint);
    this.add(this.movingHint);
    const T4 = performance.now();
    if (cube.order >= 50) {
      console.log(`[InstancedRenderer ctor N=${cube.order}] init=${(T1 - T0).toFixed(0)}ms frame+inner=${(T2 - T1).toFixed(0)}ms stickerSlots=${(T3 - T2).toFixed(0)}ms stickerMesh+hint=${(T4 - T3).toFixed(0)}ms total=${(T4 - T0).toFixed(0)}ms slots=${this.stickerSlots.length}`);
    }
  }

  private makeFrameMesh(count: number, moving: boolean): THREE.InstancedMesh {
    const isSuperOrder = this.cube.order >= __PERF_FLAGS.superOrderThreshold;
    const mat = isSuperOrder ? Cubelet.CORE_BASIC : Cubelet.CORE;
    const geo = isSuperOrder ? Cubelet._FRAME_LOW : Cubelet._FRAME;
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.frustumCulled = false;
    m.userData.simRole = 'body'; // structure-coloring debug overlay (debugColors.ts)
    // moving mesh 由我们 setSliceAngle() 设 quaternion → matrixAutoUpdate 让 three 复合 matrix
    // static mesh 永远 identity
    m.matrixAutoUpdate = moving;
    if (!moving) m.matrix.identity();
    return m;
  }

  private makeInnerMesh(count: number, moving: boolean): THREE.InstancedMesh {
    const isSuperOrder = this.cube.order >= __PERF_FLAGS.superOrderThreshold;
    const mat = isSuperOrder ? Cubelet.CORE_BASIC : Cubelet.CORE;
    const m = new THREE.InstancedMesh(INNER_BOX, mat, count);
    m.frustumCulled = false;
    m.userData.simRole = 'core'; // structure-coloring debug overlay (debugColors.ts)
    m.matrixAutoUpdate = moving;
    if (!moving) m.matrix.identity();
    return m;
  }

  private makeStickerMesh(count: number, moving: boolean): THREE.InstancedMesh {
    // 排除法测试: 仅 sticker geometry 改 PlaneGeometry,其它(material/frame)不动
    const isSuperOrder = this.cube.order >= __PERF_FLAGS.superOrderThreshold;
    const baseGeo = isSuperOrder ? Cubelet._STICKER_LOW : Cubelet._STICKER;
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
      this.staticFrame.getMatrixAt(instIdx, this.tmpMat);
      origCubeletMats.push(this.tmpMat.clone());
      this.movingFrame.setMatrixAt(instIdx, this.tmpMat);
      this.staticFrame.setMatrixAt(instIdx, HIDE_MAT);
      if (this.hasInner) {
        this.movingInner.setMatrixAt(instIdx, this.tmpMat);
        this.staticInner.setMatrixAt(instIdx, HIDE_MAT);
      }

      const base = instIdx * 6;
      for (let f = 0; f < 6; f++) {
        const slotIdx = this.cubeletFaceSlot[base + f];
        if (slotIdx < 0) continue;
        if (!this.stickerSlots[slotIdx].visible) continue;
        slotsList.push(slotIdx);
        this.staticSticker.getMatrixAt(slotIdx, this.tmpMat);
        origStickerMats.push(this.tmpMat.clone());
        this.movingSticker.setMatrixAt(slotIdx, this.tmpMat);
        this.staticSticker.setMatrixAt(slotIdx, HIDE_MAT);
        this.staticHint.getMatrixAt(slotIdx, this.tmpMat);
        origHintMats.push(this.tmpMat.clone());
        this.movingHint.setMatrixAt(slotIdx, this.tmpMat);
        this.staticHint.setMatrixAt(slotIdx, HIDE_MAT);
      }
    }
    this.activeSlices.set(group, { instances, slots: slotsList, origCubeletMats, origStickerMats, origHintMats });
    if (this.activeSlices.size === 1) {
      // 第一个 slice 激活:打开 moving 渲染、重置 quaternion
      this.movingFrame.quaternion.identity();
      this.movingSticker.quaternion.identity();
      this.movingHint.quaternion.identity();
      this.resetMovingPivot();
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
    // Bake the FULL moving-mesh transform (T(position)·R) so the mirror pivot offset
    // carried in movingFrame.position is preserved; for uniform NxN position=0 → pure R.
    this.tmpRotMat.compose(this.movingFrame.position, this.movingFrame.quaternion, ONE_SCALE);
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
      this.tmpMat.multiplyMatrices(this.tmpRotMat, state.origHintMats[i]);
      this.movingHint.setMatrixAt(state.slots[i], this.tmpMat);
    }
    this.movingFrame.instanceMatrix.needsUpdate = true;
    this.movingSticker.instanceMatrix.needsUpdate = true;
    this.movingHint.instanceMatrix.needsUpdate = true;
    this.movingFrame.quaternion.identity();
    this.movingSticker.quaternion.identity();
    this.movingHint.quaternion.identity();
    this.resetMovingPivot(); // offset is baked into per-instance matrices now
    this.singleSliceGroup = null;
  }

  /** Mirror cube: set each moving mesh's position so that T(position)·R(quaternion)
   *  equals the rotation about the core axis, T(C)·R·T(-C) = T(C - R·C)·R. No-op for
   *  uniform NxN (pivot null → mesh stays at origin). */
  private applyMovingPivot(q: THREE.Quaternion): void {
    if (!this._mirrorPivot) return;
    this.tmpMirrorV1.copy(this._mirrorPivot).applyQuaternion(q);          // R·C
    this.tmpMirrorV2.copy(this._mirrorPivot).sub(this.tmpMirrorV1);       // C - R·C
    this.movingFrame.position.copy(this.tmpMirrorV2);
    this.movingSticker.position.copy(this.tmpMirrorV2);
    this.movingHint.position.copy(this.tmpMirrorV2);
    if (this.hasInner) this.movingInner.position.copy(this.tmpMirrorV2);
  }

  /** Multi-slice path: fold the same core-axis pivot offset into this.tmpRotMat's
   *  translation column (the matrix is then multiplied per-instance). No-op for NxN. */
  private applyPivotToRotMat(q: THREE.Quaternion): void {
    if (!this._mirrorPivot) return;
    this.tmpMirrorV1.copy(this._mirrorPivot).applyQuaternion(q);          // R·C
    this.tmpMirrorV2.copy(this._mirrorPivot).sub(this.tmpMirrorV1);       // C - R·C
    this.tmpRotMat.setPosition(this.tmpMirrorV2);
  }

  /** Reset moving meshes back to the origin (mirror only); paired with quaternion reset. */
  private resetMovingPivot(): void {
    if (!this._mirrorPivot) return;
    this.movingFrame.position.set(0, 0, 0);
    this.movingSticker.position.set(0, 0, 0);
    this.movingHint.position.set(0, 0, 0);
    if (this.hasInner) this.movingInner.position.set(0, 0, 0);
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

    if (this.singleSliceGroup === group) {
      // Stage 1 快路径: moving mesh.matrix 由 quaternion 自动复合,
      // 每个 instance 渲染 = rotation(q) × origMat × vertex。
      this.movingFrame.quaternion.copy(this.tmpQuat);
      this.movingSticker.quaternion.copy(this.tmpQuat);
      this.movingHint.quaternion.copy(this.tmpQuat);
      if (this.hasInner) this.movingInner.quaternion.copy(this.tmpQuat);
      this.applyMovingPivot(this.tmpQuat); // mirror: turn about the core axis, not origin
      this.cube.dirty = true;
      return;
    }

    this.tmpRotMat.makeRotationFromQuaternion(this.tmpQuat);
    this.applyPivotToRotMat(this.tmpQuat); // mirror: shift translation so rotation is about the core axis
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
      this.tmpMat.multiplyMatrices(this.tmpRotMat, state.origHintMats[i]);
      this.movingHint.setMatrixAt(state.slots[i], this.tmpMat);
    }
    this.movingFrame.instanceMatrix.needsUpdate = true;
    this.movingSticker.instanceMatrix.needsUpdate = true;
    this.movingHint.instanceMatrix.needsUpdate = true;
    this.cube.dirty = true;
  }

  /** group.drop 时调。cubelet.matrix 已被 group.rotate() 改成新位置,写回 static。 */
  endSlice(group: CubeGroup): void {
    const state = this.activeSlices.get(group);
    if (!state) return;
    for (const instIdx of state.instances) {
      const cubeletInitial = this.instanceToInitial[instIdx];
      const cubelet = this.cube.initials.get(cubeletInitial);
      if (!cubelet) continue;
      const cmat = this._mirrorCenters ? this.mirrorMat(cubelet._instIdx, cubelet, this.tmpMirrorMat) : cubelet.matrix;
      this.staticFrame.setMatrixAt(instIdx, cmat);
      this.movingFrame.setMatrixAt(instIdx, HIDE_MAT);
      if (this.hasInner) {
        this.staticInner.setMatrixAt(instIdx, cmat);
        this.movingInner.setMatrixAt(instIdx, HIDE_MAT);
      }

      const base = instIdx * 6;
      for (let f = 0; f < 6; f++) {
        const slotIdx = this.cubeletFaceSlot[base + f];
        if (slotIdx < 0) continue;
        const slot = this.stickerSlots[slotIdx];
        if (!slot.visible) {
          this.staticSticker.setMatrixAt(slotIdx, HIDE_MAT);
          this.movingSticker.setMatrixAt(slotIdx, HIDE_MAT);
          this.staticHint.setMatrixAt(slotIdx, HIDE_MAT);
          this.movingHint.setMatrixAt(slotIdx, HIDE_MAT);
          continue;
        }
        this.tmpMat.multiplyMatrices(cmat, slot.localMat);
        this.staticSticker.setMatrixAt(slotIdx, this.tmpMat);
        this.movingSticker.setMatrixAt(slotIdx, HIDE_MAT);
        this.tmpMat.multiplyMatrices(cmat, this.hintLocalMats[slotIdx]);
        this.staticHint.setMatrixAt(slotIdx, this.tmpMat);
        this.movingHint.setMatrixAt(slotIdx, HIDE_MAT);
      }
    }
    this.activeSlices.delete(group);
    if (this.singleSliceGroup === group) {
      this.singleSliceGroup = null;
    }
    if (this.activeSlices.size === 0) {
      this.movingFrame.quaternion.identity();
      this.movingSticker.quaternion.identity();
      this.movingHint.quaternion.identity();
      this.resetMovingPivot();
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
    this.activeSlices.clear();
    this.singleSliceGroup = null;
    this.movingFrame.count = 0;
    this.movingSticker.count = 0;
    this.movingHint.count = 0;
    this.tmpQuat.identity();
    this.movingFrame.quaternion.copy(this.tmpQuat);
    this.movingSticker.quaternion.copy(this.tmpQuat);
    this.movingHint.quaternion.copy(this.tmpQuat);
    this.resetMovingPivot();
    if (this.hasInner) {
      this.movingInner.count = 0;
      this.movingInner.quaternion.copy(this.tmpQuat);
    }

    for (let i = 0; i < this.instanceToInitial.length; i++) {
      const cubeletInitial = this.instanceToInitial[i];
      const cubelet = this.cube.initials.get(cubeletInitial);
      if (!cubelet) continue;
      const cmat = this._mirrorCenters ? this.mirrorMat(i, cubelet, this.tmpMirrorMat) : cubelet.matrix;
      this.staticFrame.setMatrixAt(i, cmat);
      this.movingFrame.setMatrixAt(i, HIDE_MAT);
      if (this.hasInner) {
        this.staticInner.setMatrixAt(i, cmat);
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
      const smat = this._mirrorCenters ? this.mirrorMat(cubelet._instIdx, cubelet, this.tmpMirrorMat) : cubelet.matrix;
      this.tmpMat.multiplyMatrices(smat, slot.localMat);
      this.staticSticker.setMatrixAt(i, this.tmpMat);
      this.movingSticker.setMatrixAt(i, HIDE_MAT);
      this.tmpMat.multiplyMatrices(smat, this.hintLocalMats[i]);
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
    const cubelet = this.cube.initials.get(cubeletInitial);
    if (!cubelet || cubelet._instIdx < 0) return;
    const slot = this.cubeletFaceSlot[cubelet._instIdx * 6 + face];
    if (slot < 0) return;
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
      const smat = this._mirrorCenters ? this.mirrorMat(cubelet._instIdx, cubelet, this.tmpMirrorMat) : cubelet.matrix;
      this.tmpMat.multiplyMatrices(smat, slotData.localMat);
      this.staticSticker.setMatrixAt(slot, this.tmpMat);
      this.tmpMat.multiplyMatrices(smat, this.hintLocalMats[slot]);
      this.staticHint.setMatrixAt(slot, this.tmpMat);
      this.staticSticker.instanceMatrix.needsUpdate = true;
      this.staticHint.instanceMatrix.needsUpdate = true;
    }
    const effective = label && label.length > 0 ? label : (cubelet.colors[face] ?? "Gray");
    this.tmpColor.set(COLORS[effective] ?? COLORS.Gray);
    this.staticSticker.setColorAt(slot, this.tmpColor);
    this.movingSticker.setColorAt(slot, this.tmpColor);
    // hint 走预混 (不透明,避免 checker 透过); sticker 用原色
    this.computeHintColor(effective);
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
    // 6 个 face local matrix 共享给所有同 face slot,而不是 376k × alloc
    const faceLocalMats: THREE.Matrix4[] = [];
    const faceHintMats: THREE.Matrix4[] = [];
    for (let f = 0; f < 6; f++) {
      faceLocalMats.push(makeStickerLocalMatrix(f, zScale));
      faceHintMats.push(makeStickerLocalMatrix(f, zScale, this.hintDistance));
    }
    for (let i = 0; i < this.stickerSlots.length; i++) {
      const slot = this.stickerSlots[i];
      slot.localMat = faceLocalMats[slot.face];
      this.hintLocalMats[i] = faceHintMats[slot.face];
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
      const smat = this._mirrorCenters ? this.mirrorMat(cubelet._instIdx, cubelet, this.tmpMirrorMat) : cubelet.matrix;
      this.tmpMat.multiplyMatrices(smat, slot.localMat);
      this.staticSticker.setMatrixAt(i, this.tmpMat);
      this.tmpMat.multiplyMatrices(smat, this.hintLocalMats[i]);
      this.staticHint.setMatrixAt(i, this.tmpMat);
    }
    this.staticSticker.instanceMatrix.needsUpdate = true;
    this.staticHint.instanceMatrix.needsUpdate = true;
    this.cube.dirty = true;
  }
  get thickness(): boolean { return this._thickness; }

  set hollow(value: boolean) {
    this._hollow = value;
    // 原核激活时块身材质由 setRawCore 接管(applySettings 在 hollow 之后调 setRawCore,
    // 会覆盖回 raw 材质);这里照常写,raw-off 时即恢复正确的 CORE/TRANS。
    const mat = value ? Cubelet.TRANS : Cubelet.CORE;
    this.staticFrame.material = mat;
    this.movingFrame.material = mat;
    if (this.hasInner) {
      this.staticInner.material = mat;
      this.movingInner.material = mat;
    }
    this.cube.dirty = true;
  }

  /** 原核 (raw / stickerless body):on=true 时给 frame(+inner,若有)换克隆几何(带 per-instance
   *  面色属性)+ raw 材质(最近可见面取色,棱对角双色/角三色);off 恢复默认几何 + CORE(_BASIC)/TRANS。
   *  低/中阶用带光照的 Phong raw + 圆角 _FRAME + inner;超高阶(N≥superOrderThreshold)用 unlit Basic
   *  raw + _FRAME_LOW(无 inner) —— 块身染成各面色后,贴片缝隙的深色网格消失成纯色面。
   *  faceColors 改变时 setFaceColors 会回调重建属性值。 */
  setRawCore(on: boolean, faceColors: { U: string; D: string; L: string; R: string; F: string; B: string }): void {
    const isSuper = this.cube.order >= __PERF_FLAGS.superOrderThreshold;
    if (on) {
      // 懒建克隆几何 + 属性(超高阶克隆 _FRAME_LOW box,其余克隆圆角 _FRAME)
      if (!this._rawFrameGeo) this._rawFrameGeo = (isSuper ? Cubelet._FRAME_LOW : Cubelet._FRAME).clone();
      this._rawAttrs = buildRawAttributes(
        this.instanceToInitial.length, this.cubeletFaceSlot, faceColors, this._rawAttrs ?? undefined,
      );
      attachRawAttributes(this._rawFrameGeo, this._rawAttrs);
      const mat = isSuper ? rawMaterialBasic() : rawMaterial();
      this.staticFrame.geometry = this._rawFrameGeo;
      this.movingFrame.geometry = this._rawFrameGeo;
      this.staticFrame.material = mat;
      this.movingFrame.material = mat;
      if (this.hasInner) {
        if (!this._rawInnerGeo) this._rawInnerGeo = INNER_BOX.clone();
        attachRawAttributes(this._rawInnerGeo, this._rawAttrs);
        this.staticInner.geometry = this._rawInnerGeo;
        this.movingInner.geometry = this._rawInnerGeo;
        this.staticInner.material = mat;
        this.movingInner.material = mat;
      }
    } else if (this._rawCore) {
      // 恢复默认几何 + 材质(尊重当前 hollow;超高阶 unlit Basic,其余 Phong)
      const frameGeo = isSuper ? Cubelet._FRAME_LOW : Cubelet._FRAME;
      const mat = this._hollow ? Cubelet.TRANS : (isSuper ? Cubelet.CORE_BASIC : Cubelet.CORE);
      this.staticFrame.geometry = frameGeo;
      this.movingFrame.geometry = frameGeo;
      this.staticFrame.material = mat;
      this.movingFrame.material = mat;
      if (this.hasInner) {
        this.staticInner.geometry = INNER_BOX;
        this.movingInner.geometry = INNER_BOX;
        this.staticInner.material = mat;
        this.movingInner.material = mat;
      }
    }
    // 占位板(盒子)+ 扇形横截面材质都走白基色 + vertexColors + 双面(实际色全由几何顶点色定)。
    // 运行时强制纠正:dev HMR 可能保留旧实例(Core 基色/单面/丢 polygonOffset),否则顶点色被乘暗或方块块顶又冒出。
    for (const pm of [Cubelet._PANEL_MAT, Cubelet._PANEL_FAN_MAT]) {
      if (!pm.vertexColors || pm.side !== THREE.DoubleSide) { pm.vertexColors = true; pm.side = THREE.DoubleSide; pm.needsUpdate = true; }
      pm.color.setRGB(1, 1, 1);
    }
    const fm = Cubelet._PANEL_FAN_MAT;  // 扇形须保留负 polygonOffset 才能盖过方形块顶
    if (!fm.polygonOffset) { fm.polygonOffset = true; fm.polygonOffsetFactor = -1; fm.polygonOffsetUnits = -1; fm.needsUpdate = true; }
    this._rawCore = on;
    this.cube.dirty = true;
  }

  /** group.hold 读它:原核(任意阶)转层挂扇形彩色横截面(panelFan)替换深色占位板,
   *  非原核才用 Cubelet._PANEL 深色盒。 */
  get rawCore(): boolean { return this._rawCore; }

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
    if (value && this.hintNeedsPopulate) {
      this.populateHint();
      this.hintNeedsPopulate = false;
    }
    this.staticHint.visible = value;
    this.movingHint.visible = value;
    this.cube.dirty = true;
  }
  get hint(): boolean { return this._hint; }

  /** 算 face 色与 bg 预混的 hint 实际显示色,写入 this.tmpColor。
   * 不透明 + 预混等效原 opacity=0.35 的视觉,但 canvas alpha=1,避免 checker bg 透过 hint。 */
  private computeHintColor(faceLabel: string | undefined): void {
    this.tmpColor.set(COLORS[faceLabel ?? "Gray"] ?? COLORS.Gray);
    this.tmpColor.lerp(this.hintBgColor, 1 - InstancedRenderer.HINT_FACE_MIX);
  }

  /** 用户改了 6 面色:写 COLORS map + 重刷所有 sticker / hint instance color。
   * sticker 用原色,hint 走 computeHintColor 跟当前 bg 预混。
   * cubelet.colors[face] 是 logical label ("L"/"R"/"U"/"D"/"F"/"B"),COLORS 改了下次 applyStick 也自动走新色。 */
  setFaceColors(map: Partial<Record<"U" | "D" | "L" | "R" | "F" | "B", string>>): void {
    for (const k of ["U", "D", "L", "R", "F", "B"] as const) {
      const v = map[k];
      if (v) COLORS[k] = v;
    }
    const updateHint = !this.hintNeedsPopulate;
    for (let i = 0; i < this.stickerSlots.length; i++) {
      const slot = this.stickerSlots[i];
      const cubelet = this.cube.initials.get(slot.cubeletInitial);
      if (!cubelet) continue;
      const label = cubelet.colors[slot.face];
      this.tmpColor.set(COLORS[label ?? "Gray"] ?? COLORS.Gray);
      this.staticSticker.setColorAt(i, this.tmpColor);
      this.movingSticker.setColorAt(i, this.tmpColor);
      if (updateHint) {
        this.computeHintColor(label);
        this.staticHint.setColorAt(i, this.tmpColor);
        this.movingHint.setColorAt(i, this.tmpColor);
      }
    }
    if (this.staticSticker.instanceColor) this.staticSticker.instanceColor.needsUpdate = true;
    if (this.movingSticker.instanceColor) this.movingSticker.instanceColor.needsUpdate = true;
    if (updateHint) {
      if (this.staticHint.instanceColor) this.staticHint.instanceColor.needsUpdate = true;
      if (this.movingHint.instanceColor) this.movingHint.instanceColor.needsUpdate = true;
    }
    // 原核激活时块身颜色与贴片同源,面色变了同步重建 raw per-instance 属性。
    // (扇形横截面 panelFan 的颜色在每次 group.hold 时按当前态重刷,自动跟上新面色,无需在此处理。)
    if (this._rawCore && this._rawAttrs) {
      buildRawAttributes(this.instanceToInitial.length, this.cubeletFaceSlot, {
        U: COLORS.U, D: COLORS.D, L: COLORS.L, R: COLORS.R, F: COLORS.F, B: COLORS.B,
      }, this._rawAttrs);
    }
    this.cube.dirty = true;
  }

  /** 主题/背景色变了时调:刷新 hint 预混颜色 + bg 色字段。
   * `bgHex` 应来自 CSS var(--background) 解析后的 hex/rgb 字符串。 */
  setHintBackdrop(bgHex: string): void {
    this.hintBgColor.set(bgHex);
    // 重写所有 hint 实例颜色 (face mix bg)
    if (!this.hintNeedsPopulate) {
      for (let i = 0; i < this.stickerSlots.length; i++) {
        const slot = this.stickerSlots[i];
        const cubelet = this.cube.initials.get(slot.cubeletInitial);
        if (!cubelet) continue;
        this.computeHintColor(cubelet.colors[slot.face]);
        this.staticHint.setColorAt(i, this.tmpColor);
        this.movingHint.setColorAt(i, this.tmpColor);
      }
      if (this.staticHint.instanceColor) this.staticHint.instanceColor.needsUpdate = true;
      if (this.movingHint.instanceColor) this.movingHint.instanceColor.needsUpdate = true;
      this.cube.dirty = true;
    }
  }

  /** 构造时延后的 hint matrix/color GPU 上传。N=250 ~250ms,只在首次开 hint 才付。 */
  private populateHint(): void {
    const cube = this.cube;
    for (let i = 0; i < this.stickerSlots.length; i++) {
      const slot = this.stickerSlots[i];
      const cubelet = cube.initials.get(slot.cubeletInitial)!;
      this.tmpMat.multiplyMatrices(this._mirrorCenters ? this.mirrorMat(cubelet._instIdx, cubelet, this.tmpMirrorMat) : cubelet.matrix, this.hintLocalMats[i]);
      this.staticHint.setMatrixAt(i, this.tmpMat);
      this.movingHint.setMatrixAt(i, HIDE_MAT);
      this.computeHintColor(cubelet.colors[slot.face]);
      this.staticHint.setColorAt(i, this.tmpColor);
      this.movingHint.setColorAt(i, this.tmpColor);
    }
    this.staticHint.instanceMatrix.needsUpdate = true;
    this.movingHint.instanceMatrix.needsUpdate = true;
    if (this.staticHint.instanceColor) this.staticHint.instanceColor.needsUpdate = true;
    if (this.movingHint.instanceColor) this.movingHint.instanceColor.needsUpdate = true;
  }

  /** Mirror-cube render matrix for a cubie: compose(R·center0, R, scale0), with
   *  R = cubelet.quaternion (logical accumulated rotation) and center0/scale0 from the
   *  cubie's original slot. Only called in mirror mode (callers guard on _mirrorCenters). */
  private mirrorMat(instIdx: number, cubelet: Cubelet, out: THREE.Matrix4): THREE.Matrix4 {
    const o = instIdx * 3;
    this.tmpMirrorV1.set(this._mirrorCenters![o], this._mirrorCenters![o + 1], this._mirrorCenters![o + 2]);
    this.tmpMirrorV1.applyQuaternion(cubelet.quaternion);
    this.tmpMirrorV2.set(this._mirrorScales![o], this._mirrorScales![o + 1], this._mirrorScales![o + 2]);
    out.compose(this.tmpMirrorV1, cubelet.quaternion, this.tmpMirrorV2);
    return out;
  }

  /** Switch this renderer to mirror-cube geometry: build per-instance center/scale from
   *  the layer-thickness tables, then rebuild every matrix. Called once right after
   *  construction by the mirror Cube (order 3). */
  enableMirror(): void {
    const tables = mirrorTables(this.cube.order);
    const n = this.instanceToInitial.length;
    const centers = new Float32Array(n * 3);
    const scales = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const init = this.instanceToInitial[i];
      const c = tables.center(init);
      const s = tables.scale(init);
      centers[i * 3] = c[0]; centers[i * 3 + 1] = c[1]; centers[i * 3 + 2] = c[2];
      scales[i * 3] = s[0]; scales[i * 3 + 1] = s[1]; scales[i * 3 + 2] = s[2];
    }
    this._mirrorCenters = centers;
    this._mirrorScales = scales;
    // Core-cubie center = the point all 3 turn axes pass through. For an odd order it is
    // the dead-center cubie (lx=ly=lz=(order-1)/2); the layers being non-uniform puts it
    // off the bounding-box origin, so face turns must pivot here (see _mirrorPivot).
    const order = this.cube.order;
    const c = (order - 1) / 2;
    const centerInit = c * order * order + c * order + c;
    const pc = tables.center(centerInit);
    this._mirrorPivot = new THREE.Vector3(pc[0], pc[1], pc[2]);
    this.rebuildAll();
  }

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
    this._rawFrameGeo?.dispose();
    this._rawInnerGeo?.dispose();
  }
}
