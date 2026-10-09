import * as THREE from 'three';
import { Move } from 'cubing/alg';
import type { NativePuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle } from '@cuberoot/puzzle-solvers/native-puzzle-model';
import {
  createNativePuzzleDragGeometry, pickNativePuzzleDrag,
  type NativePuzzleDragDepth, type NativePuzzleDragGeometry,
} from './pgDrag';

interface NativePgObject extends THREE.Object3D {
  experimentalGetControlTargets(): THREE.Object3D[];
  getClosestMoveToAxis(point: THREE.Vector3, transformations: {
    invert: boolean; depth: 'none' | 'secondSlice' | 'rotation';
  }): { move: Move } | null;
}

interface Vantage extends HTMLElement {
  contentWrapper: HTMLElement;
  camera(): Promise<THREE.Camera>;
}

interface Observable<T> {
  addFreshListener(listener: (value: T) => void): void;
  removeFreshListener(listener: (value: T) => void): void;
}

interface Options {
  enabled: () => boolean;
  depth: () => 'auto' | NativePuzzleDragDepth;
  pinching: () => boolean;
}

interface Gesture {
  pointerId: number;
  button: number;
  startX: number;
  startY: number;
  worldPoint: THREE.Vector3;
  localPoint: THREE.Vector3;
  matrix: THREE.Matrix4;
  camera: THREE.Camera;
  viewport: { width: number; height: number };
  dragged: boolean;
  committed: boolean;
}

const DRAG_THRESHOLD = 6;
const CONTROL_SELECTOR = 'button, input, select, textarea, a, [role="button"], [role="slider"], [contenteditable="true"]';

/** Capture real native PG surface gestures before cubing's click/orbit tracker.
 * PG's closed shadow roots hide canvases/vantages from the outer host. Bind the
 * public content wrappers inside those roots for surface downs, while keeping
 * the host listeners after pinch listeners so they see every owned touch end.
 * A missed ray or a control remains available to the player's own handlers.
 */
export function attachNativePgPointer(
  host: HTMLElement,
  // The public experimental player surface includes APIs absent from its stable type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  player: any,
  id: NativePuzzleId,
  opts: Options,
): () => void {
  let live = true;
  let object: NativePgObject | null = null;
  let geometry: NativePuzzleDragGeometry | null = null;
  let vantages = new Map<Vantage, THREE.Camera>();
  let vantageRevision = 0;
  let gesture: Gesture | null = null;
  const touches = new Set<number>();
  const owned = new Set<number>();
  const unsettled = new Set<symbol>();
  const disconnect: Array<() => void> = [];
  const raycaster = new THREE.Raycaster();
  const puzzle = nativePuzzleKPuzzle(id);
  const current = (): boolean => live && (!(player instanceof Node) || host.contains(player));

  const consume = (event: Event): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const own = (event: PointerEvent): void => {
    owned.add(event.pointerId);
    try { host.setPointerCapture(event.pointerId); } catch { /* Pointer ended during setup. */ }
    consume(event);
  };
  const release = (pointerId: number): void => {
    // Remove first: releasePointerCapture can synchronously report lost capture.
    owned.delete(pointerId);
    try {
      if (host.hasPointerCapture(pointerId)) host.releasePointerCapture(pointerId);
    } catch { /* Host was detached, or capture was already released. */ }
  };

  const watchSettled = <T,>(prop: Observable<T> | undefined, busy: (value: T) => boolean): void => {
    if (!prop?.addFreshListener) return;
    const key = Symbol();
    unsettled.add(key); // Wait for the fresh initial value, not a stale default.
    const listener = (value: T): void => {
      if (!current()) return;
      if (busy(value)) {
        unsettled.add(key);
        gesture = null;
      } else unsettled.delete(key);
    };
    prop.addFreshListener(listener);
    disconnect.push(() => prop.removeFreshListener(listener));
  };
  const model = player.experimentalModel;
  watchSettled<{ playing: boolean }>(model?.playingInfo, (value) => value.playing);
  watchSettled<{ move: unknown | null }>(model?.catchUpMove, (value) => value.move !== null);
  watchSettled<{ currentMoves: Array<{ fraction: number }> }>(model?.currentMoveInfo, (value) => (
    value.currentMoves.some(({ fraction }) => !Number.isFinite(fraction) || (fraction > 1e-6 && fraction < 1 - 1e-6))
  ));

  const unbindVantages = (): void => {
    for (const vantage of vantages.keys()) vantage.contentWrapper.removeEventListener('pointerdown', onDown, true);
  };
  const refreshVantages = async (): Promise<void> => {
    if (!object || !current()) return;
    const revision = ++vantageRevision;
    const currentVantages = Array.from(await player.experimentalCurrentVantages()) as Vantage[];
    const entries = await Promise.all(currentVantages.map(async (vantage) => (
      [vantage, await vantage.camera()] as const
    )));
    if (!current() || revision !== vantageRevision) return;
    unbindVantages();
    vantages = new Map(entries);
    for (const vantage of vantages.keys()) vantage.contentWrapper.addEventListener('pointerdown', onDown, true);
  };
  const backView = model?.backView as Observable<unknown> | undefined;
  if (backView?.addFreshListener) {
    const onBackView = (): void => { void refreshVantages().catch(() => { /* Disposed view. */ }); };
    backView.addFreshListener(onBackView);
    disconnect.push(() => backView.removeFreshListener(onBackView));
  }
  void (async () => {
    const nextObject = await player.experimentalCurrentThreeJSPuzzleObject();
    if (!current() || typeof nextObject?.experimentalGetControlTargets !== 'function') return;
    object = nextObject as NativePgObject;
    geometry = createNativePuzzleDragGeometry(id);
    await refreshVantages();
  })().catch(() => { /* 3D unavailable or player disposed; the existing fallback owns this case. */ });

  const eventVantage = (event: Event): [Vantage, THREE.Camera] | null => {
    const path = event.composedPath();
    if (path.some((target) => target instanceof Element && target.matches(CONTROL_SELECTOR))) return null;
    if (!path.some((target) => target instanceof Element && target.tagName === 'CANVAS')) return null;
    for (const [vantage, camera] of vantages) if (path.includes(vantage)) return [vantage, camera];
    return null;
  };

  const hitSurface = (event: PointerEvent): Omit<Gesture, 'pointerId' | 'button' | 'startX' | 'startY' | 'dragged' | 'committed'> | null => {
    const view = eventVantage(event);
    if (!object || !view || ![event.clientX, event.clientY].every(Number.isFinite)) return null;
    const [vantage, camera] = view;
    const rect = vantage.contentWrapper.getBoundingClientRect();
    if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
      || rect.width <= 0 || rect.height <= 0
      || event.clientX < rect.left || event.clientX > rect.left + rect.width
      || event.clientY < rect.top || event.clientY > rect.top + rect.height) return null;
    object.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    if (![...object.matrixWorld.elements, ...camera.matrixWorld.elements, ...camera.projectionMatrix.elements].every(Number.isFinite)) return null;
    raycaster.setFromCamera(new THREE.Vector2(
      (event.clientX - rect.left) / rect.width * 2 - 1,
      1 - (event.clientY - rect.top) / rect.height * 2,
    ), camera);
    const hit = raycaster.intersectObjects(object.experimentalGetControlTargets(), true)[0];
    if (!hit || ![hit.point.x, hit.point.y, hit.point.z].every(Number.isFinite)) return null;
    const localPoint = object.worldToLocal(hit.point.clone());
    if (![localPoint.x, localPoint.y, localPoint.z].every(Number.isFinite)) return null;
    return {
      worldPoint: hit.point.clone(), localPoint, matrix: object.matrixWorld.clone(),
      camera: camera.clone(), viewport: { width: rect.width, height: rect.height },
    };
  };

  const depth = (event: PointerEvent): NativePuzzleDragDepth | undefined => {
    if (event.altKey) return 'wide';
    if (event.shiftKey) return 'inner';
    const selected = opts.depth();
    // SuperZ has one cut per axis and no depth selector. A saved depth from a
    // previously selected two-depth puzzle must not disable its surface grips.
    return selected === 'auto' || id === 'superz' ? undefined : selected;
  };
  const canTurn = (): boolean => current() && opts.enabled() && !opts.pinching() && unsettled.size === 0;
  const commit = (active: Gesture, move: string | Move): void => {
    if (active.committed || !canTurn()) return;
    try {
      puzzle.moveToTransformation(move);
      active.committed = true;
      void Promise.resolve(player.experimentalAddMove(move.toString())).catch(() => { /* Disposed player. */ });
    } catch { /* Unsupported native alias: do not replace it with a different turn. */ }
  };
  const moveGesture = (event: PointerEvent): void => {
    const active = gesture;
    if (!active || active.pointerId !== event.pointerId || active.committed) return;
    if (!canTurn() || ![event.clientX, event.clientY].every(Number.isFinite)) { gesture = null; return; }
    const delta = { x: event.clientX - active.startX, y: event.clientY - active.startY };
    if (Math.hypot(delta.x, delta.y) < DRAG_THRESHOLD) return;
    active.dragged = true;
    if (!geometry) return;
    const token = pickNativePuzzleDrag(geometry, active.localPoint, active.matrix, active.camera, delta, active.viewport, depth(event));
    if (token) commit(active, token);
  };
  const tapGesture = (event: PointerEvent, active: Gesture): void => {
    if (!object || !canTurn()) return;
    const whole = event.ctrlKey || event.metaKey;
    const selected = depth(event);
    try {
      // TwistySection's existing free-view wrapper converts this world hit to
      // local coordinates. Passing a local point here would transform it twice.
      const closest = object.getClosestMoveToAxis(active.worldPoint.clone(), {
        invert: active.button !== 2,
        depth: whole ? 'rotation' : selected === 'inner' ? 'secondSlice' : 'none',
      });
      if (!closest) return;
      let move = new Move(closest.move.toString());
      if (!whole && selected === 'wide') move = move.modified({ family: `${move.family}w` });
      commit(active, move);
    } catch { /* A slice or wide alias may not exist for this puzzle. */ }
  };

  const onDown = (event: PointerEvent): void => {
    if (!current()) return;
    if (event.pointerType === 'touch') {
      touches.add(event.pointerId);
      if (touches.size > 1 || opts.pinching()) {
        const hadOwnedSurface = owned.size > 0;
        gesture = null;
        // Retain the first capture and also capture the second surface touch.
        // Both ups still traverse the earlier host pinch listener, even outside.
        // The host cannot inspect a closed vantage's composed path. It is the
        // player container, and its earlier pinch handler already owns this pair.
        if (hadOwnedSurface) own(event);
        return;
      }
    }
    if (owned.has(event.pointerId)) { consume(event); return; }
    if (!geometry || !opts.enabled() || opts.pinching() || gesture
      || (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2)) return;
    const hit = hitSurface(event);
    if (!hit) return;
    own(event);
    // During an animation, consume surface presses but allow empty-space orbit.
    if (!canTurn()) return;
    gesture = {
      ...hit, pointerId: event.pointerId, button: event.button,
      startX: event.clientX, startY: event.clientY, dragged: false, committed: false,
    };
  };
  const onMove = (event: PointerEvent): void => {
    if (!owned.has(event.pointerId)) return;
    consume(event);
    moveGesture(event);
  };
  const onUp = (event: PointerEvent): void => {
    touches.delete(event.pointerId);
    if (!owned.has(event.pointerId)) return;
    consume(event);
    moveGesture(event); // A coalesced final motion must not become a tap.
    const active = gesture;
    if (active?.pointerId === event.pointerId) {
      if (!active.dragged && !active.committed) tapGesture(event, active);
      gesture = null;
    }
    release(event.pointerId);
  };
  const onCancel = (event: PointerEvent): void => {
    touches.delete(event.pointerId);
    if (gesture?.pointerId === event.pointerId) gesture = null;
    if (!owned.has(event.pointerId)) return;
    consume(event);
    release(event.pointerId);
  };
  const onLostCapture = (event: PointerEvent): void => {
    if (gesture?.pointerId === event.pointerId) gesture = null;
    // Keep consuming this stream until its actual end. Native DragTracker treats
    // an orphan pointerup as a press even when it never received pointerdown.
  };
  const onOutsideEnd = (event: PointerEvent): void => {
    // Bubble phase only: never swallow an up before the host pinch handler.
    touches.delete(event.pointerId);
    if (gesture?.pointerId === event.pointerId) gesture = null;
    if (owned.has(event.pointerId)) release(event.pointerId);
  };
  const onContextMenu = (event: MouseEvent): void => {
    if (gesture?.button === 2 || (opts.enabled() && eventVantage(event))) event.preventDefault();
  };

  host.addEventListener('pointerdown', onDown, true);
  host.addEventListener('pointermove', onMove, true);
  host.addEventListener('pointerup', onUp, true);
  host.addEventListener('pointercancel', onCancel, true);
  host.addEventListener('lostpointercapture', onLostCapture, true);
  host.addEventListener('contextmenu', onContextMenu, true);
  window.addEventListener('pointerup', onOutsideEnd);
  window.addEventListener('pointercancel', onOutsideEnd);
  return () => {
    live = false;
    gesture = null;
    host.removeEventListener('pointerdown', onDown, true);
    host.removeEventListener('pointermove', onMove, true);
    host.removeEventListener('pointerup', onUp, true);
    host.removeEventListener('pointercancel', onCancel, true);
    host.removeEventListener('lostpointercapture', onLostCapture, true);
    host.removeEventListener('contextmenu', onContextMenu, true);
    window.removeEventListener('pointerup', onOutsideEnd);
    window.removeEventListener('pointercancel', onOutsideEnd);
    for (const pointerId of owned) release(pointerId);
    for (const stop of disconnect) { try { stop(); } catch { /* Disposed prop. */ } }
    touches.clear();
    unbindVantages();
    vantages.clear();
    object = null;
    geometry = null;
  };
}
