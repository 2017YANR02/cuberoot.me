// Face orientation indicator — 6 letter sprites (U/D/L/R/F/B) floating just
// outside each cube face, fading in/out during drag (cubedb.net style).
// Lives in world.scene → labels follow scene rotation. 字母标签是"屏幕方位",
// 跟 cube 状态(转体)解耦 — 即便用户做了 y/y' 整体转,F 仍指那个屏幕方位 (+Z)。
import * as THREE from 'three';
import { SIZE } from './define';
import { FACE_NORMAL, FACE_NAME } from './mega/megaState';
import { FACE_NORMAL as FTO_NORMAL, FACE_TOKEN as FTO_TOKEN } from './fto/ftoState';

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

// Dino is a corner-turner with all 8 body-diagonal corners turning. Each corner's
// label = its move token (the 3 face letters, U/D F/B L/R order) at that corner's
// outward body diagonal — matches CORNER_NAMES / CORNER_AXIS in cuber/dino/dinoState.
export const DINO_CORNER_HINTS: OrientationHint[] = [
  { letter: 'DBL', dir: new THREE.Vector3(-1, -1, -1) },
  { letter: 'DFL', dir: new THREE.Vector3(-1, -1, 1) },
  { letter: 'UBL', dir: new THREE.Vector3(-1, 1, -1) },
  { letter: 'UFL', dir: new THREE.Vector3(-1, 1, 1) },
  { letter: 'DBR', dir: new THREE.Vector3(1, -1, -1) },
  { letter: 'DFR', dir: new THREE.Vector3(1, -1, 1) },
  { letter: 'UBR', dir: new THREE.Vector3(1, 1, -1) },
  { letter: 'UFR', dir: new THREE.Vector3(1, 1, 1) },
];

// Rex is a corner-turner (all 8 corners), 3-letter U/D F/B L/R labels like the Dino —
// matches CORNER_NAMES / CORNER_AXIS in cuber/rex/rexState (same order as Dino).
export const REX_CORNER_HINTS: OrientationHint[] = [
  { letter: 'DBL', dir: new THREE.Vector3(-1, -1, -1) },
  { letter: 'DFL', dir: new THREE.Vector3(-1, -1, 1) },
  { letter: 'UBL', dir: new THREE.Vector3(-1, 1, -1) },
  { letter: 'UFL', dir: new THREE.Vector3(-1, 1, 1) },
  { letter: 'DBR', dir: new THREE.Vector3(1, -1, -1) },
  { letter: 'DFR', dir: new THREE.Vector3(1, -1, 1) },
  { letter: 'UBR', dir: new THREE.Vector3(1, 1, -1) },
  { letter: 'UFR', dir: new THREE.Vector3(1, 1, 1) },
];

// Megaminx is a FACE-turner (dodecahedron): 12 face labels at the face centers, matching
// FACE_NAME / FACE_NORMAL in mega/megaState (PG order U/F/L/BL/BR/R/C/A/I/BF/E/D).
export const MEGA_FACE_HINTS: OrientationHint[] = FACE_NAME.map((letter, i) => ({
  letter,
  dir: new THREE.Vector3(FACE_NORMAL[i][0], FACE_NORMAL[i][1], FACE_NORMAL[i][2]),
}));

// FTO is a FACE-turner (octahedron): 8 face labels at the face centers, matching
// FACE_TOKEN / FACE_NORMAL in fto/ftoState (cubing.js orientation, U up). The cube has no
// base reorientation, so the raw normals already sit on the displayed faces.
export const FTO_FACE_HINTS: OrientationHint[] = FTO_TOKEN.map((letter, i) => ({
  letter,
  dir: new THREE.Vector3(FTO_NORMAL[i][0], FTO_NORMAL[i][1], FTO_NORMAL[i][2]),
}));

// Helicopter is an EDGE-turner: its 12 twist axes sit at the edge midpoints. Each
// label = the edge's 2-letter name (UF, UR, …) at that edge's midpoint direction —
// matches HELI_EDGE_NAMES / EDGE_MID in cuber/heli/heliState. Shown on orbit instead
// of the 6 face letters (an edge puzzle has no 6 face turns).
export const HELI_EDGE_HINTS: OrientationHint[] = [
  { letter: 'UF', dir: new THREE.Vector3(0, 1, 1) },
  { letter: 'UR', dir: new THREE.Vector3(1, 1, 0) },
  { letter: 'UB', dir: new THREE.Vector3(0, 1, -1) },
  { letter: 'UL', dir: new THREE.Vector3(-1, 1, 0) },
  { letter: 'FR', dir: new THREE.Vector3(1, 0, 1) },
  { letter: 'BR', dir: new THREE.Vector3(1, 0, -1) },
  { letter: 'BL', dir: new THREE.Vector3(-1, 0, -1) },
  { letter: 'FL', dir: new THREE.Vector3(-1, 0, 1) },
  { letter: 'DF', dir: new THREE.Vector3(0, -1, 1) },
  { letter: 'DR', dir: new THREE.Vector3(1, -1, 0) },
  { letter: 'DB', dir: new THREE.Vector3(0, -1, -1) },
  { letter: 'DL', dir: new THREE.Vector3(-1, -1, 0) },
];

// Skewb is a deep-cut corner-turner (all 8 corners turn). WCA / cubing.js tokens
// (R U L B = the 4 axis corners; F D UL UR = the opposite 4) — matches SKEWB_WCA_TOKENS
// / CORNER_AXIS in cuber/skewb/skewbState.
export const SKEWB_CORNER_HINTS: OrientationHint[] = [
  { letter: 'F', dir: new THREE.Vector3(1, 1, 1) },   // UFR
  { letter: 'UL', dir: new THREE.Vector3(-1, 1, 1) }, // UFL
  { letter: 'UR', dir: new THREE.Vector3(1, 1, -1) }, // UBR
  { letter: 'U', dir: new THREE.Vector3(-1, 1, -1) }, // UBL
  { letter: 'D', dir: new THREE.Vector3(1, -1, 1) },  // DFR
  { letter: 'L', dir: new THREE.Vector3(-1, -1, 1) }, // DFL
  { letter: 'R', dir: new THREE.Vector3(1, -1, -1) }, // DBR
  { letter: 'B', dir: new THREE.Vector3(-1, -1, -1) },// DBL
];

// Pyraminx is a vertex-turner: 4 vertex axes labelled U/L/R/B — matches VERTEX_NAMES
// in pyra/pyraState. dirs are the raw tetra vertex directions (V0..V3); world applies
// the same apex-up rotation as the cube so the labels sit on the displayed vertices.
export const PYRA_VERTEX_HINTS: OrientationHint[] = [
  { letter: 'U', dir: new THREE.Vector3(1, 1, 1) },    // V0 → apex
  { letter: 'L', dir: new THREE.Vector3(1, -1, -1) },  // V1
  { letter: 'R', dir: new THREE.Vector3(-1, 1, -1) },  // V2
  { letter: 'B', dir: new THREE.Vector3(-1, -1, 1) },  // V3
];

// Redi is a corner-turner too (all 8 corners). Real-Redi notation: F L B R = the 4
// TOP corners, f l b r = the 4 BOTTOM — matches CORNER_NAMES / CORNER_AXIS in
// cuber/redi/rediState.
export const REDI_CORNER_HINTS: OrientationHint[] = [
  { letter: 'F', dir: new THREE.Vector3(1, 1, 1) },
  { letter: 'L', dir: new THREE.Vector3(-1, 1, 1) },
  { letter: 'B', dir: new THREE.Vector3(-1, 1, -1) },
  { letter: 'R', dir: new THREE.Vector3(1, 1, -1) },
  { letter: 'f', dir: new THREE.Vector3(1, -1, 1) },
  { letter: 'l', dir: new THREE.Vector3(-1, -1, 1) },
  { letter: 'b', dir: new THREE.Vector3(-1, -1, -1) },
  { letter: 'r', dir: new THREE.Vector3(1, -1, -1) },
];

// Render a label (1+ glyphs) to a canvas texture. Single glyphs (face letters,
// Ivy/Redi corners) keep the square 256² canvas; multi-glyph labels (Dino corners
// like "UFR") widen the canvas so each glyph keeps its height — the caller scales
// the sprite by the returned aspect so the text isn't squashed.
const TEX_H = 256;
const TEX_FONT = 'bold 200px system-ui, sans-serif';
function makeLetterTexture(label: string): { tex: THREE.CanvasTexture; aspect: number } {
  const meas = document.createElement('canvas').getContext('2d')!;
  meas.font = TEX_FONT;
  const textW = meas.measureText(label).width;
  const W = Math.max(TEX_H, Math.ceil(textW) + 56);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d')!;
  ctx.font = TEX_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 16;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.strokeText(label, W / 2, TEX_H / 2 + 10);
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.fillText(label, W / 2, TEX_H / 2 + 10);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return { tex, aspect: W / TEX_H };
}

const LETTER_OPACITY_FULL = 1;
const FADE_MS = 200;

export default class FaceHints extends THREE.Group {
  private letterMats: THREE.SpriteMaterial[] = [];
  private _alpha = 0;
  private _target = 0;

  /** unit = 1 个 cubelet 的边长。NxN/SQ1 用 SIZE (默认 64);
   *  cubing.js puzzle (skewb 等) bbox 半径 ~1,传 ~0.6。 */
  /** `hints` = label set (default 6 faces; Ivy/Dino/Redi pass their corner sets).
   *  `distanceMul` × unit = how far out the labels float (corners are farther from
   *  center than face centers, so corner sets pass a larger value). `sizeMul` ×
   *  unit = glyph height — Dino's 3-letter corner labels pass a smaller value so 8
   *  of them don't crowd the cube. */
  constructor(
    unit: number = SIZE,
    hints: OrientationHint[] = FACE_HINTS,
    distanceMul = 2.6,
    sizeMul = 1.2,
  ) {
    super();
    const distance = unit * distanceMul;
    const size = unit * sizeMul;

    // headless 守卫(PLAN-sr-retirement Phase 1):World ctor 硬建 ~10 组 FaceHints,
    // 字母纹理靠 DOM canvas 烤 —— 无 document(Node)时跳过建 sprite。方位字母是纯
    // 视觉指示,headless 场景没有指针拖动也就永不 show();空 letterMats 下
    // show/hide/tick 均安全 no-op。
    if (typeof document === 'undefined') { this.visible = false; return; }

    for (const hint of hints) {
      const { tex, aspect } = makeLetterTexture(hint.letter);
      const letterMat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0,
        // depthTest=true:字母位于 cube 外侧 (distance > cube half-extent),
        //   背面方位的字母被 cube 几何体挡住 → 符合"看不见那个面 = 看不见标签"。
        depthTest: true,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(letterMat);
      sprite.position.copy(hint.dir).normalize().multiplyScalar(distance);
      // multi-glyph labels (Dino "UFR") widen the texture → widen the sprite by
      // its aspect so the text keeps its proportions.
      sprite.scale.set(size * aspect, size, 1);
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
