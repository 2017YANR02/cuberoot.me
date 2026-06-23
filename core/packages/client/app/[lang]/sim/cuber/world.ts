// Ported from huazhechen/cuber (MIT) — src/cuber/world.ts
import Cube from "./cube";
import Cubelet from "./cubelet";
import * as THREE from "three";
import Controller from "./controller";
import Sq1Cube from "./sq1/Sq1Cube";
import IvyCube from "./ivy/IvyCube";
import DinoCube from "./dino/DinoCube";
import RediCube from "./redi/RediCube";
import FaceHints, { IVY_CORNER_HINTS } from "./face_hints";

/** Puzzle slot — NxN cube (order >= 1), SQ1, Ivy, Dino, or Redi (corner-turning). */
export type PuzzleKind = number | 'sq1' | 'ivy' | 'dino' | 'redi';

export default class World {
  public width = 1;
  public height = 1;

  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  /** Polymorphic cube. NxN puzzles use Cube; SQ1 uses Sq1Cube; Ivy uses IvyCube;
   *  Dino uses DinoCube. Consumers that reach into NxN-specific fields
   *  (instancedRenderer, table, locks) must first check `world.puzzleKind` is a number. */
  public cube!: Cube | Sq1Cube | IvyCube | DinoCube | RediCube;

  public ambient: THREE.AmbientLight;
  public directional: THREE.DirectionalLight;
  /** Extra rim lights added/removed with the SQ1 puzzle (it's a small object
   *  with many oblique faces; needs more wraparound than NxN). */
  private sq1RimLights: THREE.DirectionalLight[] = [];

  private cubes: Cube[] = [];
  private sq1Cube: Sq1Cube | null = null;
  private ivyCube: IvyCube | null = null;
  private dinoCube: DinoCube | null = null;
  private rediCube: RediCube | null = null;
  /** Current puzzle kind, mirrors what was last passed to setPuzzle. */
  public puzzleKind: PuzzleKind = 3;
  public callbacks: (() => void)[] = [];

  public controller: Controller;

  /** 方位指示器,拖动时淡入,挂在 scene 下跟随 scene.rotation。
   *  faceHints = 6 面字母(U/D/L/R/F/B,NxN/SQ1);ivyHints = Ivy 的 4 个角转
   *  轴字母(R/L/D/B)—— 角转魔方没有 6 面转动,显示 4 个角标才贴切。 */
  public faceHints!: FaceHints;
  public ivyHints!: FaceHints;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.matrixAutoUpdate = false;
    this.scene.rotation.x = Math.PI / 6;
    this.scene.rotation.y = -Math.PI / 4 + Math.PI / 16;

    // NOTE: ambient + directional 组合 (×π 是 three r155+ 物理光照补偿)
    // directional 给贴片侧面阴影,配合 cubelet.thickness=true 出立体感
    this.ambient = new THREE.AmbientLight(0xffffff, Math.PI * 0.75);
    this.scene.add(this.ambient);
    this.directional = new THREE.DirectionalLight(0xffffff, Math.PI * 0.4);
    this.directional.position.set(Cubelet.SIZE, Cubelet.SIZE * 3, Cubelet.SIZE * 2);
    this.scene.add(this.directional);
    this.scene.updateMatrix();

    this.camera = new THREE.PerspectiveCamera(50, 1, 1, Cubelet.SIZE * 32);
    this.camera.position.x = 0;
    this.camera.position.y = 0;
    this.camera.position.z = 0;

    this.controller = new Controller(this);
    this.faceHints = new FaceHints();
    this.scene.add(this.faceHints);
    // Ivy: corner-turner — 4 twist-axis labels (R/L/D/B) at the corners, pushed a
    // bit farther out than face labels since corners are farther from center.
    this.ivyHints = new FaceHints(Cubelet.SIZE, IVY_CORNER_HINTS, 3.0);
    this.scene.add(this.ivyHints);
    this.setPuzzle(3);
  }

  set dirty(value: boolean) {
    this.cube.dirty = value;
  }

  get dirty(): boolean {
    return this.cube.dirty;
  }

  /** Unified puzzle switch. Pass a number for NxN, 'sq1' for Square-1. */
  setPuzzle(kind: PuzzleKind): void {
    if (this.cube) {
      this.scene.remove(this.cube);
    }
    if (kind === 'sq1') {
      if (this.sq1Cube == null) {
        this.sq1Cube = new Sq1Cube();
        this.sq1Cube.callbacks.push(this.callback);
      }
      this.cube = this.sq1Cube;
      // SQ1: Controller reaches into cube.table.groups (NxN layer state) on
      // empty-space drag, which Sq1Cube doesn't have. Disable it; SimPage
      // installs a separate sq1 drag-rotate handler that updates this.cube.rotation.
      this.controller.disable = true;
      this._ensureSq1Lights();
    } else if (kind === 'ivy') {
      if (this.ivyCube == null) {
        this.ivyCube = new IvyCube();
        this.ivyCube.callbacks.push(this.callback);
      }
      this.cube = this.ivyCube;
      // Like SQ1, Ivy has no NxN layer table; disable the NxN controller. SimPage
      // installs a whole-cube drag-rotate handler for it.
      this.controller.disable = true;
      this._ensureSq1Lights(); // small oblique solid — reuse the wrap-around rig
    } else if (kind === 'dino') {
      if (this.dinoCube == null) {
        this.dinoCube = new DinoCube();
        this.dinoCube.callbacks.push(this.callback);
      }
      this.cube = this.dinoCube;
      // Dino: same as SQ1 — the NxN Controller doesn't apply. SimPage installs a
      // dedicated dino drag-to-turn + view-rotate handler. Reuse the SQ1 rim-light
      // rig (Dino is a small object with many oblique tetra facets too).
      this.controller.disable = true;
      this._ensureSq1Lights();
    } else if (kind === 'redi') {
      if (this.rediCube == null) {
        this.rediCube = new RediCube();
        this.rediCube.callbacks.push(this.callback);
      }
      this.cube = this.rediCube;
      // Redi: corner-turning like Dino — the NxN Controller doesn't apply. SimPage
      // installs a dedicated redi drag-to-turn + view-rotate handler. Reuse the SQ1
      // rim-light rig (many oblique facets on the corner + edge pieces).
      this.controller.disable = true;
      this._ensureSq1Lights();
    } else {
      if (this.cubes[kind] == undefined) {
        this.cubes[kind] = new Cube(kind);
        this.cubes[kind].callbacks.push(this.callback);
        this.cubes[kind].instancedRenderer.thickness = true;
      }
      this.cube = this.cubes[kind];
      this.controller.disable = false;
      this._removeSq1Lights();
    }
    this.puzzleKind = kind;
    this.scene.add(this.cube);
    this.dirty = true;
  }

  /** Legacy property — kept for back-compat. Number kinds only. */
  set order(value: number) {
    this.setPuzzle(value);
  }

  get order(): number {
    return this.cube.order;
  }

  callback = (): void => {
    for (const cb of this.callbacks) {
      cb();
    }
  };

  /** Add four extra directional lights wrapping the SQ1 — back, below, left,
   *  right — to highlight the oblique facets that the single NxN key light
   *  misses. Intensities low enough that the existing key light still reads
   *  as the dominant top-front light. */
  private _ensureSq1Lights(): void {
    if (this.sq1RimLights.length > 0) return;
    const d = Cubelet.SIZE;
    // 8 corners of a bounding cube, mirroring /demo/sq1's lighting rig — gives
    // the small oblique facets enough wrap-around to read all 6 hint tiles.
    const positions: [number, number, number][] = [
      [+d * 3, +d * 3, +d * 3], [-d * 3, +d * 3, +d * 3],
      [+d * 3, +d * 3, -d * 3], [-d * 3, +d * 3, -d * 3],
      [+d * 3, -d * 3, +d * 3], [-d * 3, -d * 3, +d * 3],
      [+d * 3, -d * 3, -d * 3], [-d * 3, -d * 3, -d * 3],
    ];
    for (const p of positions) {
      const l = new THREE.DirectionalLight(0xffffff, Math.PI * 0.15);
      l.position.set(p[0], p[1], p[2]);
      this.scene.add(l);
      this.sq1RimLights.push(l);
    }
    this.scene.updateMatrix();
  }

  private _removeSq1Lights(): void {
    for (const l of this.sq1RimLights) this.scene.remove(l);
    this.sq1RimLights.length = 0;
  }

  scale = 1;
  perspective = 5;
  /** 视图平移 (世界单位)。camera + lookAt 同时偏移,保持视线方向不变。 */
  panX = 0;
  panY = 0;
  private _lookAtTarget = new THREE.Vector3();
  resize(): void {
    const min = this.height / Math.min(this.width, this.height) / this.scale / this.perspective;
    const fov = (2 * Math.atan(min) * 180) / Math.PI;

    this.camera.aspect = this.width / this.height;
    this.camera.fov = fov;
    // Frame reference half-extent (fov is size-agnostic, so the camera distance
    // is what scales a puzzle to fit). SIZE*3 frames NxN order-3. SQ1 is a
    // larger octagonal solid — corner vertices reach ≈(W,W) in xz and the
    // stacked layers ≈SIZE*2.2 in y, bounding-sphere radius ≈250 (> NxN-3's
    // ~166) — so at the NxN reference it overflows the viewport. SIZE*4.6 pulls
    // it back to the same ~0.85 fill the NxN view has. NxN path unchanged.
    const isSq1 = this.puzzleKind === 'sq1';
    const isDino = this.puzzleKind === 'dino';
    const isRedi = this.puzzleKind === 'redi';
    // Dino/Redi cubes span [-2,2]·SIZE (corners at ~3.5·SIZE); ~4.0 frames them to
    // the same fill as the NxN-3 reference.
    const refHalf = isSq1 ? Cubelet.SIZE * 4.6 : (isDino || isRedi) ? Cubelet.SIZE * 4.0 : Cubelet.SIZE * 3;
    const distance = refHalf * this.perspective;
    this.camera.position.x = this.panX;
    this.camera.position.y = this.panY;
    this.camera.position.z = distance;
    // near/far margins: SQ1/Dino/Redi solids are deeper along view, so widen the near cut.
    this.camera.near = distance - Cubelet.SIZE * (isSq1 || isDino || isRedi ? 5 : 4);
    this.camera.far = distance + Cubelet.SIZE * 8;
    this._lookAtTarget.set(this.panX, this.panY, 0);
    this.camera.lookAt(this._lookAtTarget);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }
}
