/**
 * Shared drag-to-turn GESTURE controller for the discrete corner/edge-turning engine
 * puzzles (Dino, Redi, Rex — 120° corner twists — and Heli — 180° edge twists). Their
 * pointer flow is byte-identical: pointerdown grabs the cube (or misses → orbit the
 * view), the first pointermove past a threshold raycasts from the down point, scores the
 * drag against the candidate axes, and either fires the whole discrete move or — in the
 * "hold partial turn" debug mode — begins a live-tracked turn that freezes on release.
 *
 * Only the per-puzzle specifics differ (which cube class, which pick/resolve functions,
 * the full-turn pixel span, and whether beginMove takes a sweep direction). Those are
 * supplied by a small `CornerTurnAdapter`; this controller owns the gesture state machine
 * + orbit fallback + freeze plumbing so each puzzle's drag file is just its raycast and
 * SimPage just wires one adapter (≈12 lines) instead of copying ~175 lines of dispatch.
 *
 * The partial-turn apply/snap-back are the same `cuberDrag` primitives every corner-turn
 * puzzle already re-exports, so they live here directly rather than in each adapter.
 */
import type * as THREE from 'three';
import type World from './world';
import type { PieceAnim } from './pieceAnim';
import { applyPartial, snapBack } from './cuberDrag';
import { snapViewToQuadrant } from './viewControls';
import tweener from './tweener';

/** Minimal cube surface the controller drives (every engine cube satisfies this). */
interface TwistableCube<M> {
  twister: { finish(): void; twist(move: M, fast: boolean, force: boolean): boolean };
}

/** A resolved live plan: the move to fire + the drag-aligned screen tangent (project
 *  later drag onto it to advance 0→full) + an optional sweep direction (Heli's 180°
 *  involution uses it to orient the animation; corner turns ignore it). */
export interface CornerLivePlan<M> {
  move: M;
  tangentX: number;
  tangentY: number;
  dir?: 1 | -1;
}

/** Per-puzzle behavior. `C` = the concrete cube, `M` = its move, `H` = its pick-hit. */
export interface CornerTurnAdapter<C extends TwistableCube<M>, M, H> {
  /** Type guard narrowing world.cube to this puzzle's cube. */
  match(cube: unknown): cube is C;
  /** Raycast from the down point; null = missed the cube → orbit the view. */
  pickHit(cube: C, scene: THREE.Scene, camera: THREE.Camera, x: number, y: number, w: number, h: number): H | null;
  /** Resolve the started grab + drag (dx,dy px) into a live plan, or null if no axis aligns. */
  resolveLive(cube: C, hit: H, scene: THREE.Scene, camera: THREE.Camera, dx: number, dy: number, w: number, h: number): CornerLivePlan<M> | null;
  /** Resolve just the move for the discrete-fire path, or null. */
  resolveMove(cube: C, hit: H, scene: THREE.Scene, camera: THREE.Camera, dx: number, dy: number, w: number, h: number): M | null;
  /** Begin the move's per-piece animation (Heli passes `dir`; corner turns ignore it). */
  beginMove(cube: C, move: M, dir: 1 | -1): PieceAnim[];
  /** Canonical token recorded into the move history / input box. */
  moveToString(move: M): string;
  /** Drag px along the tangent for a full turn (120°≈150, Heli 180°≈200). */
  fullPx: number;
  /** Drag px to cross before the gesture commits to turn-or-orbit. */
  threshold: number;
}

/** SimPage-supplied shared dependencies (stable across the gesture). */
export interface CornerGestureCtx {
  world: World;
  dom: HTMLElement;
  /** `pointerTurns` false = 手拧锁(设置面板「手拧」关):跳过 pickHit,每次拖拽都落到
   *  orbit 分支,指针不产生 move。缺省视为 true(旧调用方 / paint 类场景不受影响)。 */
  settings(): { holdPartialTurn: boolean; dragEmpty: string; pointerTurns?: boolean };
  pinching(): boolean;
  emitMove(token: string): void;
  /** Orbit the view by a raw screen delta (controller leaves sensitivity scaling to
   *  SimPage, which owns the settings→k mapping). */
  orbit(dx: number, dy: number): void;
  clearPartialFreeze(): void;
  setPartialSnapBack(fn: () => void): void;
}

/** Non-generic handle SimPage holds in its per-puzzle registry. */
export interface CornerGestureHandle {
  /** Record a fresh single-pointer down (pending + capture). */
  begin(e: PointerEvent): void;
  /** Abandon the in-flight gesture state (2nd touch / pinch start). */
  cancel(): void;
  /** A pinch began — stop any orbit-in-progress (matches the old `*Rotating = false`). */
  onPinchStart(): void;
  /** Returns true if this controller consumed the move (caller should stop). */
  onMove(e: PointerEvent): boolean;
  onUp(e: PointerEvent): void;
  /** True while a cube-miss drag is orbiting the view (drives the twist-axis hint labels). */
  isOrbiting(): boolean;
}

type Live = { anims: PieceAnim[]; tx: number; ty: number; downX: number; downY: number };

export class CornerTurnGesture<C extends TwistableCube<M>, M, H> implements CornerGestureHandle {
  private pending = false;
  private fired = false;
  private rotating = false;
  private hit: H | null = null;
  private live: Live | null = null;
  private downX = 0;
  private downY = 0;
  private lastX = 0;
  private lastY = 0;

  constructor(private adapter: CornerTurnAdapter<C, M, H>, private ctx: CornerGestureCtx) {}

  private localXY(e: PointerEvent): { x: number; y: number } {
    const r = this.ctx.dom.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private release(e: PointerEvent): void {
    try { this.ctx.dom.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  begin(e: PointerEvent): void {
    const { x, y } = this.localXY(e);
    this.downX = x;
    this.downY = y;
    this.pending = true;
    this.fired = false;
    this.rotating = false;
    this.hit = null;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    if (e.pointerType !== 'touch') this.ctx.dom.setPointerCapture(e.pointerId);
  }

  cancel(): void {
    this.pending = false;
    this.fired = false;
    this.rotating = false;
    this.hit = null;
  }

  onPinchStart(): void {
    this.rotating = false;
  }

  isOrbiting(): boolean {
    return this.rotating;
  }

  onMove(e: PointerEvent): boolean {
    const { world } = this.ctx;
    // Live partial-turn tracking (hold-partial debug): map drag along the tangent → t.
    if (this.live) {
      const { x, y } = this.localXY(e);
      const proj = (x - this.live.downX) * this.live.tx + (y - this.live.downY) * this.live.ty;
      applyPartial(this.live.anims, proj / this.adapter.fullPx);
      world.dirty = true;
      return true;
    }
    if (this.rotating) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.ctx.orbit(dx, dy);
      return true;
    }
    if (this.pending && !this.fired && !this.ctx.pinching()) {
      const { x: localX, y: localY } = this.localXY(e);
      const dx = localX - this.downX;
      const dy = localY - this.downY;
      if (Math.hypot(dx, dy) < this.adapter.threshold) return false; // not yet → let pinch see it
      this.fired = true; // consume this gesture either as a turn or orbit
      const cube = world.cube;
      // 手拧锁:不 pick → 直接落到下方 orbit 分支(等价于"没抓到块")。
      if (this.ctx.settings().pointerTurns !== false && this.adapter.match(cube)) {
        cube.twister.finish();
        tweener.finish();
        // pick from the original pointerdown location (before the drag moved)
        this.hit = this.adapter.pickHit(cube, world.scene, world.camera, this.downX, this.downY, world.width, world.height);
        if (this.hit) {
          if (this.ctx.settings().holdPartialTurn) {
            // Live partial turn: resolve axis + drag tangent, begin (pivots tracked
            // live, NOT committed) — frozen on pointerup.
            const plan = this.adapter.resolveLive(cube, this.hit, world.scene, world.camera, dx, dy, world.width, world.height);
            if (plan) {
              this.ctx.clearPartialFreeze();
              const anims = this.adapter.beginMove(cube, plan.move, plan.dir ?? 1);
              this.live = { anims, tx: plan.tangentX, ty: plan.tangentY, downX: this.downX, downY: this.downY };
              const proj = (localX - this.downX) * plan.tangentX + (localY - this.downY) * plan.tangentY;
              applyPartial(anims, proj / this.adapter.fullPx);
              world.dirty = true;
              this.pending = false;
              return true;
            }
          } else {
            const move = this.adapter.resolveMove(cube, this.hit, world.scene, world.camera, dx, dy, world.width, world.height);
            if (move) {
              cube.twister.twist(move, false, true);
              this.ctx.emitMove(this.adapter.moveToString(move));
              this.pending = false;
              return true;
            }
          }
        }
      }
      // missed a piece, or no aligned axis → orbit the rest of this gesture
      this.rotating = true;
      this.hit = null;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.ctx.orbit(dx, dy);
      return true;
    }
    return false;
  }

  onUp(e: PointerEvent): void {
    if (this.live) {
      // Hold-partial: freeze where released — keep the live pivots, register a snap-back
      // (next turn / toggle-off restores them), do NOT commit.
      const frozen = this.live.anims;
      this.ctx.setPartialSnapBack(() => snapBack(frozen));
      this.live = null;
      this.release(e);
    }
    // The move (if any) already fired on pointermove. Clear state + snap the view if we
    // were orbiting in 'rotate' mode.
    if (this.rotating) {
      if (this.ctx.settings().dragEmpty === 'rotate') snapViewToQuadrant(this.ctx.world);
      this.release(e);
    } else if (this.pending) {
      this.release(e);
    }
    this.pending = false;
    this.fired = false;
    this.rotating = false;
    this.hit = null;
  }
}
