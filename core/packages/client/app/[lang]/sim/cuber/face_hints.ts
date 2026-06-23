// Face orientation indicator — 6 letter sprites (U/D/L/R/F/B) floating just
// outside each cube face, fading in/out during drag (cubedb.net style).
// Lives in world.scene → labels follow scene rotation. 字母标签是"屏幕方位",
// 跟 cube 状态(转体)解耦 — 即便用户做了 y/y' 整体转,F 仍指那个屏幕方位 (+Z)。
import * as THREE from 'three';
import Cubelet from './cubelet';

export interface OrientationHint {
  letter: string;
  /** Direction from cube center the label floats along (need not be unit). */
  dir: THREE.Vector3;
}

const FACE_HINTS: OrientationHint[] = [
  { letter: 'U', dir: new THREE.Vector3(0, 1, 0) },
  { letter: 'D', dir: new THREE.Vector3(0, -1, 0) },
  { letter: 'L', dir: new THREE.Vector3(-1, 0, 0) },
  { letter: 'R', dir: new THREE.Vector3(1, 0, 0) },
  { letter: 'F', dir: new THREE.Vector3(0, 0, 1) },
  { letter: 'B', dir: new THREE.Vector3(0, 0, -1) },
];

// Ivy is a corner-turner: its 4 twist axes (R/L/D/B) sit at tetrahedral corners,
// matching CORNER_POS/AXIS_LETTER in cuber/ivy/IvyCube. Shown on orbit instead of
// the 6 face letters — a corner puzzle has no 6 face turns.
export const IVY_CORNER_HINTS: OrientationHint[] = [
  { letter: 'R', dir: new THREE.Vector3(1, 1, -1) },
  { letter: 'L', dir: new THREE.Vector3(-1, 1, 1) },
  { letter: 'D', dir: new THREE.Vector3(1, -1, 1) },
  { letter: 'B', dir: new THREE.Vector3(-1, -1, -1) },
];

function makeLetterTexture(letter: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.font = 'bold 200px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 16;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.strokeText(letter, 128, 138);
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.fillText(letter, 128, 138);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

const LETTER_OPACITY_FULL = 1;
const FADE_MS = 200;

export default class FaceHints extends THREE.Group {
  private letterMats: THREE.SpriteMaterial[] = [];
  private _alpha = 0;
  private _target = 0;

  /** unit = 1 个 cubelet 的边长。NxN/SQ1 用 Cubelet.SIZE (默认 64);
   *  cubing.js puzzle (skewb 等) bbox 半径 ~1,传 ~0.6。 */
  /** `hints` = label set (default 6 faces; Ivy passes IVY_CORNER_HINTS).
   *  `distanceMul` × unit = how far out the labels float (corners are farther
   *  from center than face centers, so Ivy passes a larger value). */
  constructor(unit: number = Cubelet.SIZE, hints: OrientationHint[] = FACE_HINTS, distanceMul = 2.6) {
    super();
    const distance = unit * distanceMul;
    const size = unit * 1.2;

    for (const hint of hints) {
      const letterTex = makeLetterTexture(hint.letter);
      const letterMat = new THREE.SpriteMaterial({
        map: letterTex,
        transparent: true,
        opacity: 0,
        // depthTest=true:字母位于 cube 外侧 (distance > cube half-extent),
        //   背面方位的字母被 cube 几何体挡住 → 符合"看不见那个面 = 看不见标签"。
        depthTest: true,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(letterMat);
      sprite.position.copy(hint.dir).normalize().multiplyScalar(distance);
      sprite.scale.set(size, size, 1);
      this.letterMats.push(letterMat);
      this.add(sprite);
    }
    this.visible = false;
  }

  /** Kept for API compat with applySettings — face hints 没色板,no-op。 */
  setFaceColors(_colors: { U: string; D: string; L: string; R: string; F: string; B: string }): void {
    // no-op
  }

  show(): void { this._target = 1; this.visible = true; }
  hide(): void { this._target = 0; }

  /** Called from render loop with dt in ms. Returns true if still animating. */
  tick(dt: number): boolean {
    if (this._alpha === this._target) {
      if (this._alpha === 0 && this.visible) this.visible = false;
      return false;
    }
    const step = dt / FADE_MS;
    this._alpha = this._target > this._alpha
      ? Math.min(this._target, this._alpha + step)
      : Math.max(this._target, this._alpha - step);
    for (const m of this.letterMats) m.opacity = this._alpha * LETTER_OPACITY_FULL;
    if (this._alpha === 0) this.visible = false;
    return true;
  }
}
