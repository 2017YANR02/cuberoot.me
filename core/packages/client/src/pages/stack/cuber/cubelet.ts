// Ported from huazhechen/cuber (MIT) — src/cuber/cubelet.ts
// 重构:不再每 cubelet 起 Mesh 子物,只保留 logical state(position/quaternion/colors[])。
// 渲染交给 cube.instancedRenderer (2 个 InstancedMesh)。
import { FACE, COLORS } from "./define";
import * as THREE from "three";

class Frame extends THREE.BufferGeometry {
  private static readonly _INDICES = [
    0, 2, 1,
    0, 3, 2,
    4, 6, 5,
    4, 7, 6,
    8, 10, 9,
    8, 11, 10,
    12, 14, 13,
    12, 15, 14,
    16, 18, 17,
    16, 19, 18,
    20, 22, 21,
    20, 23, 22,
    1, 6, 7,
    0, 1, 7,
    3, 0, 10,
    11, 3, 10,
    17, 2, 3,
    16, 17, 3,
    23, 20, 1,
    2, 23, 1,
    5, 12, 13,
    4, 5, 13,
    9, 13, 14,
    8, 9, 14,
    22, 15, 12,
    21, 22, 12,
    19, 14, 15,
    18, 19, 15,
    7, 4, 9,
    10, 7, 9,
    11, 8, 19,
    16, 11, 19,
    23, 17, 18,
    22, 23, 18,
    20, 21, 5,
    6, 20, 5,
    20, 6, 1,
    10, 0, 7,
    21, 12, 5,
    13, 9, 4,
    23, 2, 17,
    11, 16, 3,
    22, 18, 15,
    8, 14, 19,
  ];

  constructor(size: number, border: number) {
    super();
    const _O = size / 2;
    const _I = _O - border;
    const _verts = [
      -_I, +_I, +_O,
      +_I, +_I, +_O,
      +_I, -_I, +_O,
      -_I, -_I, +_O,
      -_I, +_O, -_I,
      +_I, +_O, -_I,
      +_I, +_O, +_I,
      -_I, +_O, +_I,
      -_O, -_I, -_I,
      -_O, +_I, -_I,
      -_O, +_I, +_I,
      -_O, -_I, +_I,
      +_I, +_I, -_O,
      -_I, +_I, -_O,
      -_I, -_I, -_O,
      +_I, -_I, -_O,
      -_I, -_O, +_I,
      +_I, -_O, +_I,
      +_I, -_O, -_I,
      -_I, -_O, -_I,
      +_O, +_I, +_I,
      +_O, +_I, -_I,
      +_O, -_I, -_I,
      +_O, -_I, +_I,
    ];
    this.setAttribute("position", new THREE.Float32BufferAttribute(_verts, 3));
    this.setIndex(Frame._INDICES);
    this.computeVertexNormals();
  }
}

function makeStickerShape(size: number, arrow: boolean): THREE.Shape {
  size = size / 2;
  const left = -size;
  const bottom = size;
  const top = -size;
  const right = size;
  const radius = size / 4;
  const shape = new THREE.Shape();
  shape.moveTo(left, top + radius);
  shape.lineTo(left, bottom - radius);
  shape.quadraticCurveTo(left, bottom, left + radius, bottom);
  shape.lineTo(right - radius, bottom);
  shape.quadraticCurveTo(right, bottom, right, bottom - radius);
  shape.lineTo(right, top + radius);
  shape.quadraticCurveTo(right, top, right - radius, top);
  shape.lineTo(left + radius, top);
  shape.quadraticCurveTo(left, top, left, top + radius);
  shape.closePath();

  if (arrow) {
    const h = size * 0.6;
    const w = h * 0.8;
    const arrowPath = new THREE.Path();
    arrowPath.moveTo(0, h);
    arrowPath.lineTo(-w, 0);
    arrowPath.lineTo(-w / 2, 0);
    arrowPath.lineTo(-w / 2, -h);
    arrowPath.lineTo(w / 2, -h);
    arrowPath.lineTo(w / 2, 0);
    arrowPath.lineTo(w, 0);
    arrowPath.closePath();
    shape.holes.push(arrowPath);
  }
  return shape;
}

class Sticker extends THREE.ExtrudeGeometry {
  constructor(size: number, depth: number, arrow: boolean) {
    super(makeStickerShape(size, arrow), { bevelEnabled: false, depth: depth });
  }
}

/** Hint sticker: 单面 plane,设 BackSide 后只在背向 camera 时可见。
 * 阴影只显示"看不到的 3 个面"(同 alg.cubing.net / cubing.js Cube3D)。 */
export class HintSticker extends THREE.ShapeGeometry {
  constructor(size: number, arrow: boolean) {
    super(makeStickerShape(size, arrow));
  }
}

const FACE_LABELS: Record<number, string> = {
  [FACE.L]: "L",
  [FACE.R]: "R",
  [FACE.D]: "D",
  [FACE.U]: "U",
  [FACE.B]: "B",
  [FACE.F]: "F",
};

export default class Cubelet extends THREE.Group {
  public static readonly SIZE: number = 64;
  private static readonly _BORDER_WIDTH: number = 3;
  private static readonly _EDGE_WIDTH: number = 2;
  private static readonly _STICKER_DEPTH: number = 0.1;
  public static readonly _FRAME: Frame = new Frame(Cubelet.SIZE, Cubelet._BORDER_WIDTH);
  public static readonly _STICKER: Sticker = new Sticker(
    Cubelet.SIZE - 2 * Cubelet._BORDER_WIDTH - Cubelet._EDGE_WIDTH,
    Cubelet._STICKER_DEPTH,
    false
  );
  public static readonly _ARROW: Sticker = new Sticker(
    Cubelet.SIZE - 2 * Cubelet._BORDER_WIDTH - Cubelet._EDGE_WIDTH,
    Cubelet._STICKER_DEPTH,
    true
  );
  public static readonly _HINT: HintSticker = new HintSticker(
    Cubelet.SIZE - 2 * Cubelet._BORDER_WIDTH - Cubelet._EDGE_WIDTH,
    false
  );
  public static readonly _HINT_ARROW: HintSticker = new HintSticker(
    Cubelet.SIZE - 2 * Cubelet._BORDER_WIDTH - Cubelet._EDGE_WIDTH,
    true
  );

  /** 超高阶简化 sticker (PlaneGeometry, 2 tri vs ExtrudeGeometry 204 tri)。
   * 沿 +Z 平移 0.05 单位破 z-fight:否则跟 frame pocket 底面 z=±SIZE/2 共面,
   * N=250 大跨度下 z-buffer 精度不足 → 异色条纹。
   * localMat 的 zScale=HALF=32 把 0.05 撑到 1.6 单位 pop-out,接近 ExtrudeGeometry 原 3.2 但视觉更平。 */
  public static readonly _STICKER_LOW: THREE.PlaneGeometry = (() => {
    const g = new THREE.PlaneGeometry(
      Cubelet.SIZE - 2 * Cubelet._BORDER_WIDTH - Cubelet._EDGE_WIDTH,
      Cubelet.SIZE - 2 * Cubelet._BORDER_WIDTH - Cubelet._EDGE_WIDTH,
    );
    g.translate(0, 0, 0.05);
    return g;
  })();

  public static CORE = new THREE.MeshPhongMaterial({
    color: COLORS.Core,
    specular: COLORS.Gray,
    shininess: 2,
  });
  /** 超高阶 frame 用的 unlit material — Phong specular 在亚像素 cubelet 上无意义。 */
  public static CORE_BASIC = new THREE.MeshBasicMaterial({
    color: COLORS.Core,
  });

  public static TRANS = new THREE.MeshBasicMaterial({
    color: COLORS.Gray,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
  });

  _vector: THREE.Vector3;

  set vector(vector: THREE.Vector3) {
    const half = (this.order - 1) / 2;
    let x = Math.round(vector.x * 2) / 2;
    let y = Math.round(vector.y * 2) / 2;
    let z = Math.round(vector.z * 2) / 2;
    this._vector.set(x, y, z);
    x = Math.round(x + half);
    y = Math.round(y + half);
    z = Math.round(z + half);
    this._index = z * this.order * this.order + y * this.order + x;
    this.position.x = Cubelet.SIZE * this._vector.x;
    this.position.y = Cubelet.SIZE * this._vector.y;
    this.position.z = Cubelet.SIZE * this._vector.z;
  }
  get vector(): THREE.Vector3 {
    return this._vector;
  }

  _index: number = 0;

  set index(index: number) {
    const half = (this.order - 1) / 2;
    const _x = (index % this.order) - half;
    const _y = Math.floor((index % (this.order * this.order)) / this.order) - half;
    const _z = Math.floor(index / (this.order * this.order)) - half;
    this.vector = new THREE.Vector3(_x, _y, _z);
  }

  get index(): number {
    return this._index;
  }

  /** logical sticker label per local face. undefined = 内部面无 sticker。 'remove' = 隐藏。其它 = 颜色 label。 */
  colors: (string | undefined)[] = [undefined, undefined, undefined, undefined, undefined, undefined];
  /** stick("") 时恢复用 */
  initialColors: (string | undefined)[] = [undefined, undefined, undefined, undefined, undefined, undefined];

  getFace(face: FACE): FACE {
    const position = new THREE.Vector3(0, 0, 0);
    switch (face) {
      case FACE.L: position.x = -1; break;
      case FACE.R: position.x = 1; break;
      case FACE.D: position.y = -1; break;
      case FACE.U: position.y = 1; break;
      case FACE.B: position.z = -1; break;
      case FACE.F: position.z = 1; break;
      default: break;
    }
    this._quaternion.copy(this.quaternion);
    position.applyQuaternion(this._quaternion.invert());
    const x = Math.round(position.x);
    const y = Math.round(position.y);
    const z = Math.round(position.z);
    let color: FACE = FACE.L;
    if (x < 0) color = FACE.L;
    else if (x > 0) color = FACE.R;
    else if (y < 0) color = FACE.D;
    else if (y > 0) color = FACE.U;
    else if (z < 0) color = FACE.B;
    else if (z > 0) color = FACE.F;
    return color;
  }

  getColor(face: FACE): string {
    const localFace = this.getFace(face);
    const c = this.colors[localFace];
    if (!c || c === "remove") return "?";
    return c;
  }

  initial: number;

  _quaternion: THREE.Quaternion;
  order: number;
  exist = false;

  constructor(order: number, index: number) {
    super();
    this.order = order;
    this.initial = index;
    this._vector = new THREE.Vector3();
    this.index = index;
    this._quaternion = new THREE.Quaternion();

    const xx = this.position.x * this.position.x;
    const yy = this.position.y * this.position.y;
    const zz = this.position.z * this.position.z;
    let d = xx + yy + zz - Math.min(xx, yy, zz);
    d = Math.sqrt(d) + (Math.sqrt(2) * Cubelet.SIZE) / 2 - (order * Cubelet.SIZE) / 2;
    if (d < 0) {
      return;
    }
    this.exist = true;
    const half = (order - 1) / 2;

    // 初始 sticker label = vector 触面对应的 label
    if (this.vector.x === -half) this.initialColors[FACE.L] = FACE_LABELS[FACE.L];
    if (this.vector.x === +half) this.initialColors[FACE.R] = FACE_LABELS[FACE.R];
    if (this.vector.y === -half) this.initialColors[FACE.D] = FACE_LABELS[FACE.D];
    if (this.vector.y === +half) this.initialColors[FACE.U] = FACE_LABELS[FACE.U];
    if (this.vector.z === -half) this.initialColors[FACE.B] = FACE_LABELS[FACE.B];
    if (this.vector.z === +half) this.initialColors[FACE.F] = FACE_LABELS[FACE.F];
    for (let i = 0; i < 6; i++) this.colors[i] = this.initialColors[i];

    this.matrixAutoUpdate = false;
    this.updateMatrix();
  }

  /** 更新 logical color。renderer 同步走 cube.stick() → renderer.applyStick()。 */
  stick(face: number, value: string): void {
    if (this.initialColors[face] == null) return;
    if (value === "remove") {
      this.colors[face] = "remove";
    } else if (value && value.length > 0) {
      this.colors[face] = value;
    } else {
      this.colors[face] = this.initialColors[face];
    }
  }
}
