// Ported from huazhechen/cuber (MIT) — src/cuber/world.ts
import Cube from "./nxn/cube";
import { SIZE } from "./define";
import * as THREE from "three";
import Controller from "./nxn/controller";
import Sq1Cube from "./sq1/Sq1Cube";
import IvyCube from "./ivy/IvyCube";
import DinoCube from "./dino/DinoCube";
import RediCube from "./redi/RediCube";
import RexCube from "./rex/RexCube";
import HeliCube from "./heli/HeliCube";
import SkewbCube from "./skewb/SkewbCube";
import PyraCube from "./pyra/PyraCube";
import MegaminxCube from "./mega/MegaminxCube";
import FtoCube from "./fto/FtoCube";
import { APEX_UP_QUAT } from "./pyra/pyraGeometry";
import FaceHints, { IVY_CORNER_HINTS, DINO_CORNER_HINTS, REDI_CORNER_HINTS, REX_CORNER_HINTS, HELI_EDGE_HINTS, SKEWB_CORNER_HINTS, PYRA_VERTEX_HINTS, MEGA_FACE_HINTS, FTO_FACE_HINTS } from "./face_hints";
import HandsRig, { type HandsCubeLike } from "./hands/handsRig";

/** Puzzle slot — NxN cube (order >= 1), SQ1, Ivy, Dino, Redi, Rex (corner-turning),
 *  Heli (edge-turning Helicopter Cube), Skewb (deep-cut corner-turning), or Pyraminx
 *  (vertex-turning tetrahedron). Skewb + Pyraminx are the in-house engine alternatives
 *  to the cubing.js TwistyPlayer renders (chosen via the `renderer` toggle). */
export type PuzzleKind = number | 'sq1' | 'ivy' | 'dino' | 'redi' | 'rex' | 'heli' | 'skewb' | 'pyraminx' | 'megaminx' | 'fto' | 'mirror';

export default class World {
  public width = 1;
  public height = 1;

  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  /** Polymorphic cube. NxN puzzles use Cube; SQ1 uses Sq1Cube; Ivy uses IvyCube;
   *  Dino uses DinoCube. Consumers that reach into NxN-specific fields
   *  (instancedRenderer, table, locks) must first check `world.puzzleKind` is a number. */
  public cube!: Cube | Sq1Cube | IvyCube | DinoCube | RediCube | RexCube | HeliCube | SkewbCube | PyraCube | MegaminxCube | FtoCube;

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
  private rexCube: RexCube | null = null;
  private heliCube: HeliCube | null = null;
  private skewbCube: SkewbCube | null = null;
  private pyraCube: PyraCube | null = null;
  private megaCube: MegaminxCube | null = null;
  private ftoCube: FtoCube | null = null;
  /** Mirror Cube (Bump Cube) — an order-3 Cube with non-uniform geometry; separate
   *  cache so it never collides with the plain 3x3 in cubes[3]. */
  private mirrorCube: Cube | null = null;
  /** Current puzzle kind, mirrors what was last passed to setPuzzle. */
  public puzzleKind: PuzzleKind = 3;
  public callbacks: (() => void)[] = [];

  /** 手部指法 rig(3x3 专属)。惰性建:设置面板首次打开「手指」才实例化。 */
  public hands: HandsRig | null = null;
  /** 设置里的「手指」意愿;是否实际显示还要 && puzzleKind === 3(见 syncHands)。 */
  private handsWanted = false;

  public controller: Controller;

  /** 方位指示器,拖动时淡入,挂在 scene 下跟随 scene.rotation。
   *  faceHints = 6 面字母(U/D/L/R/F/B,NxN/SQ1);ivyHints = Ivy 的 4 个角转
   *  轴字母(R/L/D/B)—— 角转魔方没有 6 面转动,显示 4 个角标才贴切。 */
  public faceHints!: FaceHints;
  public ivyHints!: FaceHints;
  /** Dino/Redi corner-turn labels — all 8 body-diagonal corners (Dino: 3-letter
   *  UFR-style tokens; Redi: F L B R / f l b r). */
  public dinoHints!: FaceHints;
  public rediHints!: FaceHints;
  public rexHints!: FaceHints;
  public heliHints!: FaceHints;
  public skewbHints!: FaceHints;
  /** Pyraminx vertex-turn labels — 4 vertices U/L/R/B. */
  public pyraHints!: FaceHints;
  /** Megaminx 12 face-turn labels at the face centers. */
  public megaHints!: FaceHints;
  /** FTO 8 face-turn labels at the octahedron face centers. */
  public ftoHints!: FaceHints;

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
    this.directional.position.set(SIZE, SIZE * 3, SIZE * 2);
    this.scene.add(this.directional);
    this.scene.updateMatrix();

    this.camera = new THREE.PerspectiveCamera(50, 1, 1, SIZE * 32);
    // 手部补光在 layer 1(只照手);相机不 enable 该 layer 的话 three 连灯都不收集。
    this.camera.layers.enable(1);
    this.camera.position.x = 0;
    this.camera.position.y = 0;
    this.camera.position.z = 0;

    this.controller = new Controller(this);
    this.faceHints = new FaceHints();
    this.scene.add(this.faceHints);
    // Ivy: corner-turner — 4 twist-axis labels (R/L/D/B) at the corners, pushed a
    // bit farther out than face labels since corners are farther from center.
    this.ivyHints = new FaceHints(SIZE, IVY_CORNER_HINTS, 3.0);
    this.scene.add(this.ivyHints);
    // Dino: 8 corners, 3-letter labels → push out + shrink so they read without
    // crowding (Dino corners are open gaps, so 3.3 sits in the notch, unoccluded).
    // Redi: 8 single-letter labels — it HAS solid corner caps (vertices ≈3.46·SIZE),
    // so the labels must float past them (3.7) or depthTest hides them behind a cap.
    this.dinoHints = new FaceHints(SIZE, DINO_CORNER_HINTS, 3.3, 0.78);
    this.scene.add(this.dinoHints);
    this.rediHints = new FaceHints(SIZE, REDI_CORNER_HINTS, 3.7, 1.1);
    this.scene.add(this.rediHints);
    // Rex: 8 corners, 3-letter labels (like Dino) but its petals reach the vertices
    // (solid caps), so float the labels out past them (3.7) and shrink (0.78).
    this.rexHints = new FaceHints(SIZE, REX_CORNER_HINTS, 3.7, 0.78);
    this.scene.add(this.rexHints);
    // Heli: 12 edge labels (2-letter, like UF) at the edge midpoints. The solid
    // reaches the cube corners (~3.46·SIZE) but only ~2.83·SIZE along edge axes, so
    // float them to 3.4 to clear the geometry; shrink a bit so 12 don't crowd.
    this.heliHints = new FaceHints(SIZE, HELI_EDGE_HINTS, 3.4, 0.82);
    this.scene.add(this.heliHints);
    // Skewb: 8 corners, 3-letter labels like Dino/Rex. Corner pieces keep solid cube
    // corners (vertices ≈3.46·SIZE), so float labels out past them (3.7) + shrink (0.78).
    this.skewbHints = new FaceHints(SIZE, SKEWB_CORNER_HINTS, 3.7, 0.78);
    this.scene.add(this.skewbHints);
    // Pyraminx: 4 vertex labels. The cube group carries an apex-up rotation; apply the
    // same to the hints so each label sits on the displayed vertex. Float them past the
    // tetra vertices (≈2.6·SIZE out) and single-letter sized like Ivy.
    this.pyraHints = new FaceHints(SIZE, PYRA_VERTEX_HINTS, 3.0, 1.0);
    this.pyraHints.quaternion.copy(APEX_UP_QUAT);
    this.scene.add(this.pyraHints);
    // Megaminx: 12 face labels at the dodecahedron face centers (inradius ≈2.4·SIZE),
    // floated just past the faces and shrunk so 12 labels don't crowd.
    this.megaHints = new FaceHints(SIZE, MEGA_FACE_HINTS, 2.9, 0.8);
    this.scene.add(this.megaHints);
    // FTO: 8 face labels at the octahedron face centers (inradius ≈1.85·SIZE). The solid
    // reaches ≈3.2·SIZE at its vertices, so float the labels past them (3.4) + shrink.
    this.ftoHints = new FaceHints(SIZE, FTO_FACE_HINTS, 3.4, 0.95);
    this.scene.add(this.ftoHints);
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
    } else if (kind === 'rex') {
      if (this.rexCube == null) {
        this.rexCube = new RexCube();
        this.rexCube.callbacks.push(this.callback);
      }
      this.cube = this.rexCube;
      // Rex: corner-turning (deep-cut FTO) — NxN Controller doesn't apply. SimPage
      // installs a dedicated rex drag-to-turn + view-rotate handler. Reuse the SQ1
      // rim-light rig (42 CSG pieces with many oblique curved facets).
      this.controller.disable = true;
      this._ensureSq1Lights();
    } else if (kind === 'heli') {
      if (this.heliCube == null) {
        this.heliCube = new HeliCube();
        this.heliCube.callbacks.push(this.callback);
      }
      this.cube = this.heliCube;
      // Heli: edge-turning (Helicopter Cube) — NxN Controller doesn't apply. SimPage
      // installs a dedicated heli drag-to-turn + view-rotate handler. Reuse the SQ1
      // rim-light rig (32 solid wedge pieces with many oblique facets).
      this.controller.disable = true;
      this._ensureSq1Lights();
    } else if (kind === 'skewb') {
      if (this.skewbCube == null) {
        this.skewbCube = new SkewbCube();
        this.skewbCube.callbacks.push(this.callback);
      }
      this.cube = this.skewbCube;
      // Skewb: deep-cut corner-turning — NxN Controller doesn't apply. SimPage installs
      // a dedicated skewb drag-to-turn + view-rotate handler (corner-gesture registry).
      // Reuse the SQ1 rim-light rig (14 solid wedge pieces with many oblique facets).
      this.controller.disable = true;
      this._ensureSq1Lights();
    } else if (kind === 'pyraminx') {
      if (this.pyraCube == null) {
        this.pyraCube = new PyraCube();
        this.pyraCube.callbacks.push(this.callback);
      }
      this.cube = this.pyraCube;
      // Pyraminx: vertex-turning tetrahedron — NxN Controller doesn't apply. SimPage
      // installs a dedicated pyra drag-to-turn + view-rotate handler (corner-gesture
      // registry). Reuse the SQ1 rim-light rig (14 wedge pieces, many oblique facets).
      this.controller.disable = true;
      this._ensureSq1Lights();
    } else if (kind === 'megaminx') {
      if (this.megaCube == null) {
        this.megaCube = new MegaminxCube();
        this.megaCube.callbacks.push(this.callback);
      }
      this.cube = this.megaCube;
      // Megaminx: face-turning dodecahedron — NxN Controller doesn't apply. SimPage
      // installs a dedicated mega drag-to-turn + view-rotate handler (corner-gesture
      // registry). Reuse the SQ1 rim-light rig (62 solid wedge pieces, many oblique facets).
      this.controller.disable = true;
      this._ensureSq1Lights();
    } else if (kind === 'fto') {
      if (this.ftoCube == null) {
        this.ftoCube = new FtoCube();
        this.ftoCube.callbacks.push(this.callback);
      }
      this.cube = this.ftoCube;
      // FTO: face-turning octahedron — NxN Controller doesn't apply. SimPage installs a
      // dedicated fto drag-to-turn + view-rotate handler (corner-gesture registry). Reuse
      // the SQ1 rim-light rig (51 solid wedge cells, many oblique facets).
      this.controller.disable = true;
      this._ensureSq1Lights();
    } else if (kind === 'mirror') {
      if (this.mirrorCube == null) {
        this.mirrorCube = new Cube(3, true);
        this.mirrorCube.callbacks.push(this.callback);
        this.mirrorCube.instancedRenderer.thickness = true;
      }
      this.cube = this.mirrorCube;
      // Mirror Cube IS a 3x3 — the NxN Controller applies unchanged (logical layer is
      // uniform; only the geometry is non-uniform), so no dedicated drag handler and
      // no rim-light rig (it's a full cube like NxN, not a small oblique solid).
      this.controller.disable = false;
      this._removeSq1Lights();
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
    this.syncHands();
    // Camera framing is a pure function of puzzleKind (per-puzzle refHalf in resize()),
    // so it MUST re-frame the moment the kind changes — otherwise a puzzle switched in
    // after init keeps the previous puzzle's frame (e.g. FTO, which needs a wider
    // refHalf than NxN-3, renders oversized until some later resize happens to run).
    // width/height default to 1, so this is safe before SimPage sets the real size.
    this.resize();
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
    const d = SIZE;
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

  /** 设置面板「手指」开关(applySettings 驱动)。实际显隐还看当前拼图。 */
  setHandsWanted(want: boolean): void {
    if (this.handsWanted === want) return;
    this.handsWanted = want;
    this.syncHands();
    this.resize(); // refHalf 随手显隐变化(见 resize)
  }

  /** 手 rig 显隐 = 「想要」 && 3x3(镜面/其它阶/非 NxN 都不上手)。 */
  private syncHands(): void {
    const active = this.handsWanted && this.puzzleKind === 3;
    if (active && this.hands == null) {
      this.hands = new HandsRig();
      this.scene.add(this.hands);
    }
    if (this.hands) {
      this.hands.setEnabled(active);
      this.hands.attachCube(active ? (this.cube as unknown as HandsCubeLike) : null);
      this.dirty = true;
    }
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
    const handsOn = this.hands?.isEnabled === true && this.puzzleKind === 3;
    const isSq1 = this.puzzleKind === 'sq1';
    const isDino = this.puzzleKind === 'dino';
    const isRedi = this.puzzleKind === 'redi';
    const isRex = this.puzzleKind === 'rex';
    const isHeli = this.puzzleKind === 'heli';
    const isSkewb = this.puzzleKind === 'skewb';
    const isMega = this.puzzleKind === 'megaminx';
    const isFto = this.puzzleKind === 'fto';
    // Dino/Redi/Rex/Heli/Skewb cubes span [-2,2]·SIZE (corners at ~3.5·SIZE); the megaminx
    // dodecahedron reaches ~3.0·SIZE at its vertices; the FTO octahedron ~3.2·SIZE; ~4.0
    // frames them to the NxN-3 fill.
    // 手开着时把 3x3 取景拉宽(手/前臂环在魔方外围,SIZE*3 会顶出画框)。
    const refHalf = isSq1 ? SIZE * 4.6 : (isDino || isRedi || isRex || isHeli || isSkewb || isMega || isFto) ? SIZE * 4.0 : handsOn ? SIZE * 3.9 : SIZE * 3;
    const distance = refHalf * this.perspective;
    this.camera.position.x = this.panX;
    this.camera.position.y = this.panY;
    this.camera.position.z = distance;
    // near/far margins: SQ1/Dino/Redi/Rex/Heli/Skewb/Mega/FTO solids are deeper along view, so widen the near cut.
    // 手开着时按手部几何真包络放宽:腕半径 166U + 前臂 170U + 圆帽 30U ≈ 5.8×SIZE,取 6
    //(肘锚 6.95×SIZE 处无几何,别拿它当包络)。near 必须钳正 —— 视角滑杆低段
    // (mapPerspective 下限 2)distance 仅 7.8×SIZE,旧「distance − 8×SIZE」为负,
    // 透视投影 near≤0 = 投影矩阵损坏,大图小图在任意角度出现乱切面(2026-07-04 实测根因)。
    const nearMargin = handsOn ? 6 : isSq1 || isDino || isRedi || isRex || isHeli || isSkewb || isMega || isFto ? 5 : 4;
    this.camera.near = Math.max(distance - SIZE * nearMargin, SIZE * 0.4);
    this.camera.far = distance + SIZE * 8;
    this._lookAtTarget.set(this.panX, this.panY, 0);
    this.camera.lookAt(this._lookAtTarget);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }
}
