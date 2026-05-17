// Ported from huazhechen/cuber (MIT) — src/cuber/world.ts
import Cube from "./cube";
import Cubelet from "./cubelet";
import * as THREE from "three";
import Controller from "./controller";
import Sq1Cube from "./sq1/Sq1Cube";

/** Puzzle slot — either an NxN cube (order >= 1) or SQ1 (sentinel 'sq1'). */
export type PuzzleKind = number | 'sq1';

export default class World {
  public width = 1;
  public height = 1;

  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  /** Polymorphic cube. NxN puzzles use Cube; SQ1 uses Sq1Cube. Consumers that
   *  reach into NxN-specific fields (instancedRenderer, table, locks) must
   *  first check `world.puzzleKind` !== 'sq1'. */
  public cube!: Cube | Sq1Cube;

  public ambient: THREE.AmbientLight;
  public directional: THREE.DirectionalLight;
  /** Extra rim lights added/removed with the SQ1 puzzle (it's a small object
   *  with many oblique faces; needs more wraparound than NxN). */
  private sq1RimLights: THREE.DirectionalLight[] = [];

  private cubes: Cube[] = [];
  private sq1Cube: Sq1Cube | null = null;
  /** Current puzzle kind, mirrors what was last passed to setPuzzle. */
  public puzzleKind: PuzzleKind = 3;
  public callbacks: (() => void)[] = [];

  public controller: Controller;

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
      // SQ1 drag/tap input not implemented yet — disable controller.
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
    const positions: [number, number, number][] = [
      [-d * 3, +d * 2, +d * 2],   // front-left fill
      [+d * 3, -d * 1, +d * 2],   // bottom-right rim
      [-d * 2, -d * 2, -d * 2],   // back-below
      [+d * 2, +d * 2, -d * 3],   // back-top
    ];
    for (const p of positions) {
      const l = new THREE.DirectionalLight(0xffffff, Math.PI * 0.18);
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
    const distance = Cubelet.SIZE * 3 * this.perspective;
    this.camera.position.x = this.panX;
    this.camera.position.y = this.panY;
    this.camera.position.z = distance;
    this.camera.near = distance - Cubelet.SIZE * 3;
    this.camera.far = distance + Cubelet.SIZE * 8;
    this._lookAtTarget.set(this.panX, this.panY, 0);
    this.camera.lookAt(this._lookAtTarget);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }
}
