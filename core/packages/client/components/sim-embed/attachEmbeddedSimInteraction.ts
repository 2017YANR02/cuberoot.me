import type World from '@/app/[lang]/sim/engine/world';
import Toucher from '@/app/[lang]/sim/Toucher';
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

export type EmbeddedSimInteractionMode = 'view' | 'turn';

interface EmbeddedSimInteractionOptions {
  world: World;
  dom: HTMLElement;
  mode: EmbeddedSimInteractionMode;
  onUserMove?: (move: string) => void;
}

const SQ1_DRAG_THRESHOLD_PX = 4;

/**
 * Attach the same pointer semantics used by `/sim` to an embedded player.
 * NxN delegates to the canonical Controller, corner/edge puzzles delegate to
 * CornerTurnGesture, and Square-1 delegates to the shared sq1 drag primitives.
 */
export function attachEmbeddedSimInteraction({
  world,
  dom,
  mode,
  onUserMove,
}: EmbeddedSimInteractionOptions): () => void {
  const orbit = (dx: number, dy: number) => orbitSceneFree(world, dx, dy, ORBIT_K);

  if (typeof world.puzzleKind === 'number') {
    const toucher = new Toucher();
    const emit = (action: { value: string }) => onUserMove?.(action.value);
    world.controller.paintMode = mode === 'view';
    world.controller.turnsLocked = false;
    world.controller.dragEmpty = 'view';
    world.controller.onOrbit = orbit;
    world.controller.userTwist.push(emit);
    toucher.init(dom, world.controller.touch);
    return () => {
      toucher.destroy();
      const index = world.controller.userTwist.indexOf(emit);
      if (index >= 0) world.controller.userTwist.splice(index, 1);
      world.controller.onOrbit = null;
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
