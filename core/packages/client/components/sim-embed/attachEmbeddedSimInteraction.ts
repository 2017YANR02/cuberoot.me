import { Quaternion, Vector3 } from 'three';
import type World from '@/app/[lang]/sim/engine/world';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';
import Toucher from '@/app/[lang]/sim/Toucher';
import { TwistAction } from '@/app/[lang]/sim/engine/nxn/twister';
import { createCornerGestureResolver } from '@/app/[lang]/sim/engine/cornerGestureRegistry';
import Sq1Cube from '@/app/[lang]/sim/engine/sq1/Sq1Cube';
import {
  sq1DragApply,
  sq1DragCommit,
  sq1DragDelta,
  sq1DragSnapBack,
  sq1DragStart,
  type Sq1TurnDrag,
} from '@/app/[lang]/sim/engine/sq1/sq1Drag';
import { moveToString as sq1MoveToString } from '@/app/[lang]/sim/engine/sq1/sq1State';
import tweener from '@/app/[lang]/sim/engine/tweener';
import { ORBIT_K, orbitSceneFree } from '@/app/[lang]/sim/engine/viewControls';

export type EmbeddedSimInteractionMode = 'view' | 'turn' | 'none';
export type EmbeddedWholeCubeDrag = 'rotate' | 'rotate-only';
export type CubeletTap = { homeIndex: number; positionIndex: number; clientX: number; clientY: number };
export type BlockedLayerTurnHandler = (move: string, point?: Pick<CubeletTap, 'clientX' | 'clientY'>) => void;

interface EmbeddedSimInteractionOptions {
  world: World;
  dom: HTMLElement;
  mode: EmbeddedSimInteractionMode;
  lockView?: boolean;
  wholeCubeDrag?: EmbeddedWholeCubeDrag;
  onUserMove?: (move: string) => void;
  allowUserLayerTurn?: (move: string) => boolean;
  onBlockedUserLayerTurn?: BlockedLayerTurnHandler;
  onCubeletTap?: (selection: CubeletTap) => void;
  orbitSnapDegrees?: number;
  isOrbitSnapLocked?: () => boolean;
}

const SQ1_DRAG_THRESHOLD_PX = 4;
const ORBIT_SNAP_DURATION_MS = 360;
const SNAP_AXES = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0) };

/**
 * Attach the same pointer semantics used by `/sim` to an embedded player.
 * NxN delegates to the canonical Controller, corner/edge puzzles delegate to
 * CornerTurnGesture, and Square-1 delegates to the shared sq1 drag primitives.
 */
export function attachEmbeddedSimInteraction({
  world,
  dom,
  mode,
  lockView = false,
  wholeCubeDrag,
  onUserMove,
  allowUserLayerTurn,
  onBlockedUserLayerTurn,
  onCubeletTap,
  orbitSnapDegrees = 0,
  isOrbitSnapLocked,
}: EmbeddedSimInteractionOptions): () => void {
  if (mode === 'none') return () => undefined;
  const orbit = (dx: number, dy: number) => {
    if (!lockView) orbitSceneFree(world, dx, dy, ORBIT_K);
  };

  if (typeof world.puzzleKind === 'number') {
    const toucher = new Toucher();
    const emit = (action: { value: string }) => onUserMove?.(action.value);
    const controller = world.controller;
    const rotateOnly = mode === 'turn' && wholeCubeDrag === 'rotate-only';
    const pick = mode === 'view' && onCubeletTap;
    const fixedLayerView = world.puzzleKind === 2 && mode === 'turn' && !wholeCubeDrag && isOrbitSnapLocked?.() === true;
    const snapAngle = (mode === 'view' || rotateOnly || isOrbitSnapLocked?.()) && orbitSnapDegrees > 0 && orbitSnapDegrees < 90
      ? orbitSnapDegrees * Math.PI / 180 : 0;
    const dragToSnap = rotateOnly && snapAngle > 0;
    const clampAngle = (angle: number) => Math.max(-snapAngle, Math.min(snapAngle, angle));
    const crossingAt = (from: number, to: number) => Math.abs(to) <= snapAngle ? Infinity
      : Math.max(0, Math.min(1, (Math.sign(to) * snapAngle - from) / (to - from)));
    let snappedThisDrag = false;
    let snapFrame: number | null = null;
    let releasePoint: { x: number; y: number } | null = null;
    const toClientPoint = ({ x, y }: { x: number; y: number }) => {
      const bounds = dom.getBoundingClientRect();
      return { clientX: bounds.left + x, clientY: bounds.top + y };
    };
    const tap: (typeof controller.taps)[number] = (index, face, { button }) => {
      if (!pick || !releasePoint || snappedThisDrag || face === null || button !== 0 || index < 0) return;
      const piece = (world.cube as Cube).cubelets.get(index);
      if (!piece) return;
      pick({ homeIndex: piece.initial, positionIndex: index, ...toClientPoint(releasePoint) });
    };
    const orbitWithSnap = (dx: number, dy: number) => {
      if (snappedThisDrag || snapFrame !== null || lockView) return;
      const rotation = world.scene.rotation;
      const beforeX = rotation.x;
      const beforeY = rotation.y;
      orbit(dx, dy);
      if (isOrbitSnapLocked?.()) {
        rotation.x = clampAngle(rotation.x);
        rotation.y = clampAngle(rotation.y);
        world.scene.updateMatrix();
        return;
      }
      // An oblique drag can cross both edges in one event. Keep the pose at the first edge reached.
      const xCrossing = crossingAt(beforeX, rotation.x);
      const yCrossing = crossingAt(beforeY, rotation.y);
      const crossing = Math.min(xCrossing, yCrossing);
      if (!Number.isFinite(crossing)) return;
      const pitchFirst = xCrossing < yCrossing || (xCrossing === yCrossing && Math.abs(dy) > Math.abs(dx));
      const axis = pitchFirst ? 'x' : 'y';
      const direction = Math.sign(rotation[axis]);

      const cube = world.cube as Cube;
      const action = new TwistAction(axis, direction > 0, 1);
      const fromX = pitchFirst ? direction * snapAngle : clampAngle(beforeX + (rotation.x - beforeX) * crossing);
      const fromY = pitchFirst ? clampAngle(beforeY + (rotation.y - beforeY) * crossing) : direction * snapAngle;
      if (mode === 'turn' && allowUserLayerTurn?.(action.value) === false) {
        snappedThisDrag = true;
        rotation.set(fromX, fromY, 0);
        world.scene.updateMatrix();
        onBlockedUserLayerTurn?.(action.value);
        return;
      }
      const quarterTurn = direction * Math.PI / 2;
      const start = performance.now();
      snappedThisDrag = true;
      rotation.set(fromX, fromY, 0);
      world.scene.updateMatrix();
      const view = world.scene.quaternion.clone();
      const spin = new Quaternion();
      const animate = (now: number) => {
        const progress = Math.min(1, Math.max(0, (now - start) / ORBIT_SNAP_DURATION_MS));
        const eased = progress * progress * (3 - 2 * progress);
        if (progress < 1) {
          spin.setFromAxisAngle(SNAP_AXES[axis], quarterTurn * eased);
          world.scene.quaternion.copy(view).multiply(spin);
          snapFrame = requestAnimationFrame(animate);
        } else {
          snapFrame = null;
          // Transfer the animated turn to the puzzle and keep the same viewing offsets.
          const committed = cube.twister.twist(action, true, true);
          rotation.set(fromX, fromY, 0);
          if (committed) emit(action);
        }
        world.scene.updateMatrix();
        world.dirty = true;
      };
      snapFrame = requestAnimationFrame(animate);
    };
    world.controller.paintMode = mode === 'view';
    world.controller.turnsLocked = false;
    world.controller.dragEmpty = mode === 'turn' && wholeCubeDrag && !dragToSnap ? 'rotate' : 'view';
    world.controller.wholeCubeOnly = rotateOnly;
    controller.allowLayerTurn = mode === 'turn' ? allowUserLayerTurn ?? null : null;
    controller.onBlockedLayerTurn = mode === 'turn' && onBlockedUserLayerTurn
      ? move => onBlockedUserLayerTurn(move, releasePoint ? toClientPoint(releasePoint) : undefined) : null;
    world.controller.onOrbit = snapAngle ? orbitWithSnap : orbit;
    world.controller.userTwist.push(emit);
    if (pick) controller.taps.push(tap);
    toucher.init(dom, pick || snapAngle || fixedLayerView || onBlockedUserLayerTurn ? action => {
      if (action.type === 'mousedown' || action.type === 'touchstart') snappedThisDrag = snapFrame !== null;
      releasePoint = action.type === 'mouseup' || action.type === 'touchend' ? action : null;
      if (fixedLayerView) action.alt = false;
      controller.touch(action);
      releasePoint = null;
    } : controller.touch);
    return () => {
      if (snapFrame !== null) {
        cancelAnimationFrame(snapFrame);
        snapFrame = null;
      }
      toucher.destroy();
      const index = world.controller.userTwist.indexOf(emit);
      if (index >= 0) world.controller.userTwist.splice(index, 1);
      if (pick) {
        const tapIndex = controller.taps.indexOf(tap);
        if (tapIndex >= 0) controller.taps.splice(tapIndex, 1);
      }
      controller.allowLayerTurn = null;
      controller.onBlockedLayerTurn = null;
      world.controller.onOrbit = null;
      world.controller.wholeCubeOnly = false;
    };
  }

  if (world.puzzleKind === 'sq1' && world.cube instanceof Sq1Cube) {
    const cube = world.cube;
    let pending = false;
    let moved = false;
    let rotating = false;
    let drag: Sq1TurnDrag | null = null;
    let dragDelta = 0;
    let downX = 0;
    let downY = 0;
    let lastX = 0;
    let lastY = 0;

    const localPoint = (event: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const release = (event: PointerEvent) => {
      try { dom.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    };
    const clear = () => {
      pending = false;
      moved = false;
      rotating = false;
      drag = null;
      dragDelta = 0;
    };
    const fireSlice = (dir: 1 | -1) => {
      if (cube.twister.twist({ kind: 'slice' }, false, true, dir)) onUserMove?.('/');
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const point = localPoint(event);
      downX = point.x;
      downY = point.y;
      lastX = event.clientX;
      lastY = event.clientY;
      pending = true;
      moved = false;
      rotating = false;
      drag = null;
      dragDelta = 0;
      dom.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pending && !drag && !rotating) return;
      event.preventDefault();
      const point = localPoint(event);
      if (drag) {
        const delta = sq1DragDelta(drag, world.scene, world.camera, point.x, point.y, world.width, world.height);
        if (delta != null) {
          dragDelta = delta;
          sq1DragApply(drag, delta);
          world.dirty = true;
        }
        return;
      }
      if (rotating) {
        orbit(event.clientX - lastX, event.clientY - lastY);
        lastX = event.clientX;
        lastY = event.clientY;
        return;
      }
      const dx = point.x - downX;
      const dy = point.y - downY;
      if (Math.hypot(dx, dy) < SQ1_DRAG_THRESHOLD_PX) return;
      moved = true;
      if (mode === 'turn') {
        cube.twister.finish();
        tweener.finish();
        const started = sq1DragStart(cube, world.scene, world.camera, downX, downY, world.width, world.height);
        if (started?.kind === 'slice') {
          fireSlice(dy < 0 ? -1 : 1);
          pending = false;
          return;
        }
        if (started?.kind === 'turn') {
          if (started.startEastHalf && Math.abs(dy) > Math.abs(dx) * 1.5) {
            sq1DragSnapBack(started);
            fireSlice(dy < 0 ? -1 : 1);
            pending = false;
            return;
          }
          drag = started;
          const delta = sq1DragDelta(drag, world.scene, world.camera, point.x, point.y, world.width, world.height);
          if (delta != null) {
            dragDelta = delta;
            sq1DragApply(drag, delta);
            world.dirty = true;
          }
          return;
        }
      }
      rotating = true;
      lastX = event.clientX;
      lastY = event.clientY;
      orbit(dx, dy);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (drag) {
        const move = sq1DragCommit(cube, drag, dragDelta);
        if (move) onUserMove?.(sq1MoveToString(move));
      } else if (pending && !moved && mode === 'turn') {
        const hit = sq1DragStart(cube, world.scene, world.camera, downX, downY, world.width, world.height);
        if (hit?.kind === 'slice') fireSlice(1);
      }
      clear();
      release(event);
    };
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove, { passive: false });
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointercancel', onPointerUp);
    return () => {
      if (drag) sq1DragSnapBack(drag);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointercancel', onPointerUp);
    };
  }

  let partialSnapBack: (() => void) | null = null;
  const resolveCornerGesture = createCornerGestureResolver(
    {
      world,
      dom,
      settings: () => ({ holdPartialTurn: false, dragEmpty: 'view', pointerTurns: mode === 'turn' }),
      pinching: () => false,
      emitMove: move => onUserMove?.(move),
      orbit,
      clearPartialFreeze: () => {
        partialSnapBack?.();
        partialSnapBack = null;
      },
      setPartialSnapBack: snapBack => { partialSnapBack = snapBack; },
    },
    { megaminxWcaNotation: true },
  );
  const gesture = resolveCornerGesture(world.puzzleKind);
  if (!gesture) return () => undefined;

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    gesture.begin(event);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (gesture.onMove(event)) event.preventDefault();
  };
  const onPointerUp = (event: PointerEvent) => gesture.onUp(event);
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointermove', onPointerMove, { passive: false });
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointercancel', onPointerUp);
  return () => {
    gesture.cancel();
    partialSnapBack?.();
    dom.removeEventListener('pointerdown', onPointerDown);
    dom.removeEventListener('pointermove', onPointerMove);
    dom.removeEventListener('pointerup', onPointerUp);
    dom.removeEventListener('pointercancel', onPointerUp);
  };
}
