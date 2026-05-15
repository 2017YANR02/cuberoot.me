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
   * 不会穿透到背景或别的 sticker。 */
  staticInner!: THREE.InstancedMesh;
  movingInner!: THREE.InstancedMesh;

  private stickerMaterial: THREE.MeshLambertMaterial;
  private movingStickerMaterial: THREE.MeshLambertMaterial;

  stickerSlots: StickerSlot[] = [];
  /** key: cubeletInitial * 6 + face → slot idx */
  private slotLookup: Map<number, number> = new Map();
  /** 每个 cubeletInitial 拥有的 sticker slot idx 列表(beginSlice/endSlice 用) */
  private cubeletSlots: Map<number, number[]> = new Map();

  // toggles
  private _thickness = true;
  private _arrow = false;

  // active slices (支持并发,例如 x/y/z 整 cube 旋转 = N 个 group 同时跑)
  private activeSlices: Map<CubeGroup, { instances: number[]; slots: number[] }> = new Map();

  // 临时
  private tmpMat = new THREE.Matrix4();
  private tmpColor = new THREE.Color();
  private tmpQuat = new THREE.Quaternion();

  constructor(cube: Cube) {
    super();
    this.cube = cube;
    this.matrixAutoUpdate = false;

    const cubelets = [...cube.initials.values()];
    const visCount = cubelets.length;
    for (let i = 0; i < visCount; i++) {
      this.initialToInstance.set(cubelets[i].initial, i);
      this.instanceToInitial.push(cubelets[i].initial);
    }

    // Frame meshes + per-cubelet inner box meshes(共享 matrix)
    this.staticFrame = this.makeFrameMesh(visCount, false);
    this.movingFrame = this.makeFrameMesh(visCount, true);
    this.movingFrame.count = 0;
    this.staticInner = this.makeInnerMesh(visCount, false);
    this.movingInner = this.makeInnerMesh(visCount, true);
    this.movingInner.count = 0;

    // 初始 frame + inner box 矩阵 (static),全部 moving 隐藏
    for (let i = 0; i < visCount; i++) {
      this.staticFrame.setMatrixAt(i, cubelets[i].matrix);
      this.movingFrame.setMatrixAt(i, HIDE_MAT);
      this.staticInner.setMatrixAt(i, cubelets[i].matrix);
      this.movingInner.setMatrixAt(i, HIDE_MAT);
    }
    this.staticFrame.instanceMatrix.needsUpdate = true;
    this.movingFrame.instanceMatrix.needsUpdate = true;
    this.staticInner.instanceMatrix.needsUpdate = true;
    this.movingInner.instanceMatrix.needsUpdate = true;

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

    // Sticker meshes
    this.stickerMaterial = new THREE.MeshLambertMaterial();
    this.movingStickerMaterial = new THREE.MeshLambertMaterial();
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

    this.add(this.staticFrame);
    this.add(this.movingFrame);
    this.add(this.staticInner);
    this.add(this.movingInner);
    this.add(this.staticSticker);
    this.add(this.movingSticker);
  }

  private makeFrameMesh(count: number, moving: boolean): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(Cubelet._FRAME, Cubelet.CORE, count);
    m.frustumCulled = false;
    // moving mesh 由我们 setSliceAngle() 设 quaternion → matrixAutoUpdate 让 three 复合 matrix
    // static mesh 永远 identity
    m.matrixAutoUpdate = moving;
    if (!moving) m.matrix.identity();
    return m;
  }

  private makeInnerMesh(count: number, moving: boolean): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(INNER_BOX, Cubelet.CORE, count);
    m.frustumCulled = false;
    m.matrixAutoUpdate = moving;
    if (!moving) m.matrix.identity();
    return m;
  }

  private makeStickerMesh(count: number, moving: boolean): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(
      moving ? this.staticSticker?.geometry ?? Cubelet._STICKER : Cubelet._STICKER,
      moving ? this.movingStickerMaterial : this.stickerMaterial,
      count,
    );
    m.frustumCulled = false;
    m.matrixAutoUpdate = moving;
    if (!moving) m.matrix.identity();
    return m;
  }

  /** group.hold 时调。把 slice 内 cubelet 切换到 moving,static slot 隐藏。 */
  beginSlice(group: CubeGroup): void {
    if (this.activeSlices.has(group)) {
      // re-entrant — clean up first
      this.endSlice(group);
    }
    const instances: number[] = [];
    const slotsList: number[] = [];

    for (const positionIdx of group.indices) {
      const cubelet = this.cube.cubelets.get(positionIdx);
      if (!cubelet) continue;
      const instIdx = this.initialToInstance.get(cubelet.initial);
      if (instIdx === undefined) continue;
      instances.push(instIdx);
      this.staticFrame.getMatrixAt(instIdx, this.tmpMat);
      this.movingFrame.setMatrixAt(instIdx, this.tmpMat);
      this.staticFrame.setMatrixAt(instIdx, HIDE_MAT);
      this.movingInner.setMatrixAt(instIdx, this.tmpMat);
      this.staticInner.setMatrixAt(instIdx, HIDE_MAT);

      const slots = this.cubeletSlots.get(cubelet.initial);
      if (slots) {
        for (const slotIdx of slots) {
          if (!this.stickerSlots[slotIdx].visible) continue;
          slotsList.push(slotIdx);
          this.staticSticker.getMatrixAt(slotIdx, this.tmpMat);
          this.movingSticker.setMatrixAt(slotIdx, this.tmpMat);
          this.staticSticker.setMatrixAt(slotIdx, HIDE_MAT);
        }
      }
    }
    this.activeSlices.set(group, { instances, slots: slotsList });
    if (this.activeSlices.size === 1) {
      // 第一个 slice 激活:打开 moving 渲染、重置 quaternion
      this.movingFrame.quaternion.identity();
      this.movingSticker.quaternion.identity();
      this.movingInner.quaternion.identity();
      this.movingFrame.count = this.instanceToInitial.length;
      this.movingSticker.count = this.stickerSlots.length;
      this.movingInner.count = this.instanceToInitial.length;
    }
    this.staticFrame.instanceMatrix.needsUpdate = true;
    this.movingFrame.instanceMatrix.needsUpdate = true;
    this.staticInner.instanceMatrix.needsUpdate = true;
    this.movingInner.instanceMatrix.needsUpdate = true;
    this.staticSticker.instanceMatrix.needsUpdate = true;
    this.movingSticker.instanceMatrix.needsUpdate = true;
    this.cube.dirty = true;
  }

  /** group.angle setter 调。仅旋转 moving meshes,不动 instance 矩阵。
   * 多个并发 slice (整 cube 旋转) 会重复设同一 quaternion,无害。 */
  setSliceAngle(angle: number, axis: string): void {
    const axisVec = CubeGroup.AXIS_VECTOR[axis];
    if (!axisVec) return;
    this.tmpQuat.setFromAxisAngle(axisVec, angle);
    this.movingFrame.quaternion.copy(this.tmpQuat);
    this.movingSticker.quaternion.copy(this.tmpQuat);
    this.movingInner.quaternion.copy(this.tmpQuat);
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
      this.staticFrame.setMatrixAt(instIdx, cubelet.matrix);
      this.movingFrame.setMatrixAt(instIdx, HIDE_MAT);
      this.staticInner.setMatrixAt(instIdx, cubelet.matrix);
      this.movingInner.setMatrixAt(instIdx, HIDE_MAT);

      const slots = this.cubeletSlots.get(cubeletInitial);
      if (slots) {
        for (const slotIdx of slots) {
          const slot = this.stickerSlots[slotIdx];
          if (!slot.visible) {
            this.staticSticker.setMatrixAt(slotIdx, HIDE_MAT);
            this.movingSticker.setMatrixAt(slotIdx, HIDE_MAT);
            continue;
          }
          this.tmpMat.multiplyMatrices(cubelet.matrix, slot.localMat);
          this.staticSticker.setMatrixAt(slotIdx, this.tmpMat);
          this.movingSticker.setMatrixAt(slotIdx, HIDE_MAT);
        }
      }
    }
    this.activeSlices.delete(group);
    if (this.activeSlices.size === 0) {
      this.movingFrame.quaternion.identity();
      this.movingSticker.quaternion.identity();
      this.movingInner.quaternion.identity();
      this.movingFrame.count = 0;
      this.movingSticker.count = 0;
      this.movingInner.count = 0;
    }
    this.staticFrame.instanceMatrix.needsUpdate = true;
    this.movingFrame.instanceMatrix.needsUpdate = true;
    this.staticInner.instanceMatrix.needsUpdate = true;
    this.movingInner.instanceMatrix.needsUpdate = true;
    this.staticSticker.instanceMatrix.needsUpdate = true;
    this.movingSticker.instanceMatrix.needsUpdate = true;
    this.cube.dirty = true;
  }

  /** cube.reset() 后调:全部 cubelet 在初始位置,重建所有 static 矩阵。 */
  rebuildAll(): void {
    this.activeSlices.clear();
    this.movingFrame.count = 0;
    this.movingSticker.count = 0;
    this.movingInner.count = 0;
    this.tmpQuat.identity();
    this.movingFrame.quaternion.copy(this.tmpQuat);
    this.movingSticker.quaternion.copy(this.tmpQuat);
    this.movingInner.quaternion.copy(this.tmpQuat);

    for (let i = 0; i < this.instanceToInitial.length; i++) {
      const cubeletInitial = this.instanceToInitial[i];
      const cubelet = this.cube.initials.get(cubeletInitial);
      if (!cubelet) continue;
      this.staticFrame.setMatrixAt(i, cubelet.matrix);
      this.movingFrame.setMatrixAt(i, HIDE_MAT);
      this.staticInner.setMatrixAt(i, cubelet.matrix);
      this.movingInner.setMatrixAt(i, HIDE_MAT);
    }
    for (let i = 0; i < this.stickerSlots.length; i++) {
      const slot = this.stickerSlots[i];
      const cubelet = this.cube.initials.get(slot.cubeletInitial);
      if (!cubelet || !slot.visible) {
        this.staticSticker.setMatrixAt(i, HIDE_MAT);
        this.movingSticker.setMatrixAt(i, HIDE_MAT);
        continue;
      }
      this.tmpMat.multiplyMatrices(cubelet.matrix, slot.localMat);
      this.staticSticker.setMatrixAt(i, this.tmpMat);
      this.movingSticker.setMatrixAt(i, HIDE_MAT);
    }
    this.staticFrame.instanceMatrix.needsUpdate = true;
    this.movingFrame.instanceMatrix.needsUpdate = true;
    this.staticInner.instanceMatrix.needsUpdate = true;
    this.movingInner.instanceMatrix.needsUpdate = true;
    this.staticSticker.instanceMatrix.needsUpdate = true;
    this.movingSticker.instanceMatrix.needsUpdate = true;
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
      this.staticSticker.instanceMatrix.needsUpdate = true;
      this.movingSticker.instanceMatrix.needsUpdate = true;
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
        this.staticSticker.instanceMatrix.needsUpdate = true;
      }
    }
    const cubelet = this.cube.initials.get(cubeletInitial);
    const effective = label && label.length > 0 ? label : (cubelet?.colors[face] ?? "Gray");
    this.tmpColor.set(COLORS[effective] ?? COLORS.Gray);
    this.staticSticker.setColorAt(slot, this.tmpColor);
    this.movingSticker.setColorAt(slot, this.tmpColor);
    if (this.staticSticker.instanceColor) this.staticSticker.instanceColor.needsUpdate = true;
    if (this.movingSticker.instanceColor) this.movingSticker.instanceColor.needsUpdate = true;
    this.cube.dirty = true;
  }

  set thickness(value: boolean) {
    if (value === this._thickness) return;
    this._thickness = value;
    const zScale = value ? HALF : 1;
    for (let i = 0; i < this.stickerSlots.length; i++) {
      const slot = this.stickerSlots[i];
      slot.localMat = makeStickerLocalMatrix(slot.face, zScale);
    }
    // Rebuild sticker matrices
    for (let i = 0; i < this.stickerSlots.length; i++) {
      const slot = this.stickerSlots[i];
      const cubelet = this.cube.initials.get(slot.cubeletInitial);
      if (!cubelet || !slot.visible) {
        this.staticSticker.setMatrixAt(i, HIDE_MAT);
        continue;
      }
      this.tmpMat.multiplyMatrices(cubelet.matrix, slot.localMat);
      this.staticSticker.setMatrixAt(i, this.tmpMat);
    }
    this.staticSticker.instanceMatrix.needsUpdate = true;
    this.cube.dirty = true;
  }
  get thickness(): boolean { return this._thickness; }

  set hollow(value: boolean) {
    const mat = value ? Cubelet.TRANS : Cubelet.CORE;
    this.staticFrame.material = mat;
    this.movingFrame.material = mat;
    this.staticInner.material = mat;
    this.movingInner.material = mat;
    this.cube.dirty = true;
  }

  set arrow(value: boolean) {
    if (value === this._arrow) return;
    this._arrow = value;
    const geo = value ? Cubelet._ARROW : Cubelet._STICKER;
    this.staticSticker.geometry = geo;
    this.movingSticker.geometry = geo;
    this.cube.dirty = true;
  }
  get arrow(): boolean { return this._arrow; }

  dispose(): void {
    this.staticFrame.dispose();
    this.movingFrame.dispose();
    this.staticInner.dispose();
    this.movingInner.dispose();
    this.staticSticker.dispose();
    this.movingSticker.dispose();
    this.stickerMaterial.dispose();
    this.movingStickerMaterial.dispose();
  }
}
