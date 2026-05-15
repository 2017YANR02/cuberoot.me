/**
 * InstancedRenderer — 用 2 个 InstancedMesh 替换 N³ 个 cubelet Mesh。
 * 灵感来自 cubing.js PG3D (单 BufferGeometry + materialIndex 切静/动)。
 * Cubelet 仍是 THREE.Group(承载 position/quaternion/index 逻辑 + 被 CubeGroup 重 parent),
 * 但不创建任何 Mesh 子物;每帧 update() 读 cubelet.matrixWorld 写 instanceMatrix。
 */
import * as THREE from "three";
import Cubelet from "./cubelet";
import Cube from "./cube";
import { FACE, COLORS } from "./define";

const HALF = Cubelet.SIZE / 2;

/** 把 thickness toggle 烤进 sticker local 矩阵的 z scale。upstream 默认 32。 */
function makeStickerLocalMatrix(face: number, zScale: number): THREE.Matrix4 {
  const pos = new THREE.Vector3();
  const rot = new THREE.Euler();
  switch (face) {
    case FACE.L: rot.y = -Math.PI / 2; pos.x = -HALF; break;
    case FACE.R: rot.y = +Math.PI / 2; pos.x = +HALF; break;
    case FACE.D: rot.x = +Math.PI / 2; pos.y = -HALF; break;
    case FACE.U: rot.x = -Math.PI / 2; pos.y = +HALF; break;
    case FACE.B: rot.x = +Math.PI;     pos.z = -HALF; break;
    case FACE.F: /* identity */        pos.z = +HALF; break;
  }
  const m = new THREE.Matrix4();
  m.compose(pos, new THREE.Quaternion().setFromEuler(rot), new THREE.Vector3(1, 1, zScale));
  return m;
}

const HIDE_MAT = new THREE.Matrix4().makeScale(0, 0, 0);

export default class InstancedRenderer extends THREE.Group {
  cube: Cube;

  /** cubelet 在 cube.initials[] 里的 index(稳定身份,不随旋转变);只装 exist=true 的 */
  visibleCubeletIdx: number[] = [];
  /** Reverse map: cubeletInitial → instance idx in frameMesh,-1 = 不渲染 */
  cubeletToInstance: Int32Array;

  frameMesh: THREE.InstancedMesh;
  stickerMesh: THREE.InstancedMesh;
  /** 当前 sticker geometry / material(供 arrow / hollow 切换替换) */
  private stickerGeometry: THREE.BufferGeometry;
  private stickerMaterial: THREE.MeshLambertMaterial;
  private frameMaterial: THREE.Material;

  // 每个 sticker slot
  stickerCubeletIdx: Int32Array;
  stickerLocalFace: Int8Array;
  stickerLocalMatrix: THREE.Matrix4[];
  stickerVisible: Uint8Array;
  /** sticker slot index 反查:key = cubeletIdx * 6 + localFace */
  private slotLookup: Map<number, number>;

  // toggles
  private _thickness = true;
  private _arrow = false;

  // 复用临时
  private tmpMat = new THREE.Matrix4();
  private cubeWorldInv = new THREE.Matrix4();
  private tmpColor = new THREE.Color();

  constructor(cube: Cube) {
    super();
    this.cube = cube;
    this.matrixAutoUpdate = false;

    // 收集 visible cubelets(用 initials 数组的 index 做稳定身份 — cubelets[] 会随旋转重排)
    this.cubeletToInstance = new Int32Array(cube.initials.length).fill(-1);
    for (let i = 0; i < cube.initials.length; i++) {
      if (cube.initials[i].exist) {
        this.cubeletToInstance[i] = this.visibleCubeletIdx.length;
        this.visibleCubeletIdx.push(i);
      }
    }
    const visCount = this.visibleCubeletIdx.length;

    this.frameMaterial = Cubelet.CORE;
    this.frameMesh = new THREE.InstancedMesh(Cubelet._FRAME, this.frameMaterial, visCount);
    this.frameMesh.frustumCulled = false;
    this.frameMesh.matrixAutoUpdate = false;

    // sticker slots
    const slotsCubeletIdx: number[] = [];
    const slotsFace: number[] = [];
    const slotsMat: THREE.Matrix4[] = [];
    const initialColors: string[] = [];
    const lookup = new Map<number, number>();
    const zScale = this._thickness ? HALF : 1;
    for (const idx of this.visibleCubeletIdx) {
      const c = cube.initials[idx];
      for (let f = 0; f < 6; f++) {
        const col = c.colors[f];
        if (col == null || col === "") continue;
        const slot = slotsCubeletIdx.length;
        lookup.set(idx * 6 + f, slot);
        slotsCubeletIdx.push(idx);
        slotsFace.push(f);
        slotsMat.push(makeStickerLocalMatrix(f, zScale));
        initialColors.push(col);
      }
    }
    this.stickerCubeletIdx = new Int32Array(slotsCubeletIdx);
    this.stickerLocalFace = new Int8Array(slotsFace);
    this.stickerLocalMatrix = slotsMat;
    this.stickerVisible = new Uint8Array(slotsCubeletIdx.length).fill(1);
    this.slotLookup = lookup;

    this.stickerGeometry = Cubelet._STICKER;
    this.stickerMaterial = new THREE.MeshLambertMaterial();
    this.stickerMesh = new THREE.InstancedMesh(this.stickerGeometry, this.stickerMaterial, slotsCubeletIdx.length);
    this.stickerMesh.frustumCulled = false;
    this.stickerMesh.matrixAutoUpdate = false;

    for (let i = 0; i < initialColors.length; i++) {
      this.tmpColor.set(COLORS[initialColors[i]] ?? COLORS.Gray);
      this.stickerMesh.setColorAt(i, this.tmpColor);
    }
    if (this.stickerMesh.instanceColor) this.stickerMesh.instanceColor.needsUpdate = true;

    this.add(this.frameMesh);
    this.add(this.stickerMesh);
  }

  /** 每帧 render 前调。读 cubelet.matrixWorld → 写 instanceMatrix。 */
  update(): void {
    this.cube.updateMatrixWorld(true);
    this.cubeWorldInv.copy(this.cube.matrixWorld).invert();

    const initials = this.cube.initials;

    for (let i = 0; i < this.visibleCubeletIdx.length; i++) {
      const c = initials[this.visibleCubeletIdx[i]];
      this.tmpMat.multiplyMatrices(this.cubeWorldInv, c.matrixWorld);
      this.frameMesh.setMatrixAt(i, this.tmpMat);
    }
    this.frameMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.stickerCubeletIdx.length; i++) {
      if (this.stickerVisible[i] === 0) {
        this.stickerMesh.setMatrixAt(i, HIDE_MAT);
        continue;
      }
      const c = initials[this.stickerCubeletIdx[i]];
      this.tmpMat.multiplyMatrices(this.cubeWorldInv, c.matrixWorld).multiply(this.stickerLocalMatrix[i]);
      this.stickerMesh.setMatrixAt(i, this.tmpMat);
    }
    this.stickerMesh.instanceMatrix.needsUpdate = true;
  }

  /** stick(face, value) 走这里:更新 sticker color / 隐藏。value: '' = 恢复初始,'remove' = 隐藏,其它 = label。
   * cubeletInitial 是 cube.initials[] 里的稳定 index(= cubelet.initial)。 */
  applyStick(cubeletInitial: number, face: number, label: string | undefined): void {
    const slot = this.slotLookup.get(cubeletInitial * 6 + face);
    if (slot === undefined) return;
    if (label === "remove") {
      this.stickerVisible[slot] = 0;
      this.cube.dirty = true;
      return;
    }
    this.stickerVisible[slot] = 1;
    const cubelet = this.cube.initials[cubeletInitial];
    const effective = label && label.length > 0 ? label : (cubelet.colors[face] ?? "Gray");
    this.tmpColor.set(COLORS[effective] ?? COLORS.Gray);
    this.stickerMesh.setColorAt(slot, this.tmpColor);
    if (this.stickerMesh.instanceColor) this.stickerMesh.instanceColor.needsUpdate = true;
    this.cube.dirty = true;
  }

  set thickness(value: boolean) {
    if (value === this._thickness) return;
    this._thickness = value;
    const zScale = value ? HALF : 1;
    for (let i = 0; i < this.stickerLocalMatrix.length; i++) {
      this.stickerLocalMatrix[i] = makeStickerLocalMatrix(this.stickerLocalFace[i], zScale);
    }
    this.cube.dirty = true;
  }
  get thickness(): boolean { return this._thickness; }

  set hollow(value: boolean) {
    this.frameMesh.material = value ? Cubelet.TRANS : Cubelet.CORE;
    this.cube.dirty = true;
  }

  set arrow(value: boolean) {
    if (value === this._arrow) return;
    this._arrow = value;
    this.stickerMesh.geometry = value ? Cubelet._ARROW : Cubelet._STICKER;
    this.cube.dirty = true;
  }
  get arrow(): boolean { return this._arrow; }

  dispose(): void {
    this.frameMesh.dispose();
    this.stickerMesh.dispose();
    this.stickerMaterial.dispose();
  }
}
