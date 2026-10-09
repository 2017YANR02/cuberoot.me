// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Move } from 'cubing/alg';
import { NATIVE_PUZZLES, NATIVE_PUZZLE_IDS, type NativePuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import { attachNativePgPointer } from '@/components/puzzle-models/gestures/nativePgPointer';
import { createNativePuzzleDragGeometry, pickNativePuzzleDrag, type NativePuzzleDragDepth } from '@/components/puzzle-models/gestures/pgDrag';

class FreshProp<T> {
  readonly listeners = new Set<(value: T) => void>();
  constructor(public value: T) {}
  addFreshListener(listener: (value: T) => void): void { this.listeners.add(listener); listener(this.value); }
  removeFreshListener(listener: (value: T) => void): void { this.listeners.delete(listener); }
  emit(value: T): void { this.value = value; for (const listener of this.listeners) listener(value); }
}

interface PointerData {
  x?: number;
  y?: number;
  pointerId?: number;
  pointerType?: string;
  button?: number;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

const DELTA = { x: 37, y: -19 };
const VIEWPORT = { width: 960, height: 720 };
const cleanups: Array<() => void> = [];
afterEach(() => { for (const stop of cleanups.splice(0)) stop(); });

async function flushInitialization(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/** No renderer/WebGL is used. Real PG surface polygons and real THREE raycasts
 * exercise the DOM adapter; the separate drag tests prove move geometry/signs. */
async function fixture(id: NativePuzzleId = 'superz', deferred = false, shadowMode: ShadowRootMode = 'closed') {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const player = document.createElement('twisty-player');
  host.appendChild(player);
  // cubing ManagedCustomElement defaults to closed for all three nested layers.
  // Keep real DOM retargeting here; an open tree conceals missing inner bindings.
  const playerShadow = player.attachShadow({ mode: shadowMode });
  const sceneWrapper = document.createElement('twisty-3d-scene-wrapper');
  playerShadow.appendChild(sceneWrapper);
  const sceneShadow = sceneWrapper.attachShadow({ mode: shadowMode });
  const hostPaths: EventTarget[][] = [];
  host.addEventListener('pointerdown', (event) => { hostPaths.push(event.composedPath()); }, true);
  const geometry = createNativePuzzleDragGeometry(id);
  const positions: number[] = [];
  for (const { vertices } of geometry.stickers) for (let i = 1; i < vertices.length - 1; i++) {
    for (const p of [vertices[0], vertices[i], vertices[i + 1]]) positions.push(p.x, p.y, p.z);
  }
  const meshGeometry = new THREE.BufferGeometry();
  meshGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(meshGeometry, material);
  const family = NATIVE_PUZZLES[id].axes[0][0];
  const closest = vi.fn((_point: THREE.Vector3, transformations: { invert: boolean; depth: string }) => {
    let move = new Move(family);
    if (transformations.depth === 'rotation') move = move.modified({ family: `${family}v` });
    if (transformations.depth === 'secondSlice') move = move.modified({ innerLayer: 2 });
    return { move: transformations.invert ? move.invert() : move };
  });
  const object = Object.assign(new THREE.Group(), {
    experimentalGetControlTargets: () => [mesh],
    getClosestMoveToAxis: closest,
  });
  object.add(mesh);
  object.rotation.set(0.24, -0.39, 0.18);
  object.position.set(0.13, -0.07, 0.09);
  object.updateMatrixWorld(true);

  const views = [1, -1].map((direction, index) => {
    const vantage = document.createElement('twisty-3d-vantage');
    sceneShadow.appendChild(vantage);
    const wrapper = document.createElement('div');
    vantage.attachShadow({ mode: shadowMode }).appendChild(wrapper);
    const innerPaths: EventTarget[][] = [];
    wrapper.addEventListener('pointerdown', (event) => { innerPaths.push(event.composedPath()); }, true);
    const canvas = document.createElement('canvas');
    wrapper.appendChild(canvas);
    const camera = new THREE.PerspectiveCamera(35, VIEWPORT.width / VIEWPORT.height, 0.01, 100);
    camera.position.set(2.1, 2.8, 4.2).multiplyScalar(direction).add(object.position);
    camera.lookAt(object.position);
    camera.updateMatrixWorld(true);
    const rect = new DOMRect(17 + index * 1000, 23, VIEWPORT.width, VIEWPORT.height);
    wrapper.getBoundingClientRect = () => rect;
    const cameraAPI = vi.fn(async () => camera);
    Object.assign(vantage, { contentWrapper: wrapper, camera: cameraAPI });
    const raycaster = new THREE.Raycaster();
    let witness: { x: number; y: number; local: THREE.Vector3; world: THREE.Vector3 } | null = null;
    for (const { vertices } of geometry.stickers) {
      const center = vertices.reduce((sum, v) => sum.add(v), new THREE.Vector3()).divideScalar(vertices.length);
      const world = center.clone().applyMatrix4(object.matrixWorld);
      const screen = world.clone().project(camera);
      raycaster.setFromCamera(new THREE.Vector2(screen.x, screen.y), camera);
      const hit = raycaster.intersectObject(mesh)[0];
      if (!hit || hit.point.distanceTo(world) > 1e-6) continue;
      const local = object.worldToLocal(hit.point.clone());
      const requiredDepths: Array<NativePuzzleDragDepth | undefined> = id === 'superz'
        ? [undefined, 'outer'] : [undefined, 'outer', 'inner', 'wide'];
      if (requiredDepths.some((depth) => !pickNativePuzzleDrag(geometry, local, object.matrixWorld, camera, DELTA, VIEWPORT, depth))) continue;
      witness = {
        x: rect.left + (screen.x + 1) * rect.width / 2,
        y: rect.top + (1 - screen.y) * rect.height / 2,
        local, world: hit.point,
      };
      break;
    }
    if (!witness) throw new Error(`No visible drag witness for ${id} view ${index}`);
    const nativeDown = vi.fn(), nativeUp = vi.fn(), nativeMove = vi.fn();
    canvas.addEventListener('pointerdown', nativeDown);
    canvas.addEventListener('pointerup', nativeUp);
    canvas.addEventListener('pointermove', nativeMove);
    return { vantage, canvas, wrapper, camera, cameraAPI, rect, witness, nativeDown, nativeUp, nativeMove, innerPaths };
  });

  const captured = new Set<number>();
  host.setPointerCapture = vi.fn((pointerId: number) => { captured.add(pointerId); });
  host.hasPointerCapture = (pointerId: number) => captured.has(pointerId);
  host.releasePointerCapture = vi.fn((pointerId: number) => { captured.delete(pointerId); });
  const state = { enabled: true, depth: 'auto' as 'auto' | NativePuzzleDragDepth, pinching: false };
  const pinchTouches = new Set<number>();
  const pinchUps: number[] = [];
  // Match the earlier TwistySection pinch capture listeners, including keeping
  // pinching=true until the final finger lifts.
  host.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    pinchTouches.add(event.pointerId);
    if (pinchTouches.size === 2) { state.pinching = true; event.stopPropagation(); }
  }, true);
  const pinchEnd = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch' || !pinchTouches.has(event.pointerId)) return;
    pinchUps.push(event.pointerId);
    if (state.pinching && pinchTouches.size === 2) event.stopPropagation();
    pinchTouches.delete(event.pointerId);
    if (pinchTouches.size === 0) state.pinching = false;
  };
  host.addEventListener('pointerup', pinchEnd, true);
  host.addEventListener('pointercancel', pinchEnd, true);

  const model = {
    playingInfo: new FreshProp({ playing: false }),
    catchUpMove: new FreshProp<{ move: Move | null }>({ move: null }),
    currentMoveInfo: new FreshProp<{ currentMoves: Array<{ fraction: number }> }>({ currentMoves: [] }),
    backView: new FreshProp('none'),
  };
  let resolveObject = (): void => {};
  const objectPromise = deferred
    ? new Promise<typeof object>((resolve) => { resolveObject = () => resolve(object); })
    : Promise.resolve(object);
  const addMove = vi.fn();
  const currentVantages = vi.fn(async () => views.map((view) => view.vantage).values());
  Object.assign(player, {
    experimentalModel: model,
    experimentalCurrentThreeJSPuzzleObject: () => objectPromise,
    experimentalCurrentVantages: currentVantages,
    experimentalAddMove: addMove,
  });
  const detach = attachNativePgPointer(host, player, id, {
    enabled: () => state.enabled, depth: () => state.depth, pinching: () => state.pinching,
  });
  cleanups.push(() => { detach(); host.remove(); meshGeometry.dispose(); material.dispose(); });
  await flushInitialization();

  const fire = (type: string, data: PointerData = {}, target: EventTarget = views[0].canvas): Event => {
    const event = new Event(type, { bubbles: true, cancelable: true, composed: true });
    const pointerId = data.pointerId ?? 1;
    Object.defineProperties(event, {
      clientX: { value: data.x ?? views[0].witness.x }, clientY: { value: data.y ?? views[0].witness.y },
      pointerId: { value: pointerId }, pointerType: { value: data.pointerType ?? 'mouse' },
      button: { value: data.button ?? 0 },
      altKey: { value: data.altKey ?? false }, ctrlKey: { value: data.ctrlKey ?? false },
      metaKey: { value: data.metaKey ?? false }, shiftKey: { value: data.shiftKey ?? false },
    });
    if (type === 'lostpointercapture') captured.delete(pointerId);
    const dispatchedTarget = type !== 'pointerdown' && captured.has(pointerId) ? host : target;
    dispatchedTarget.dispatchEvent(event);
    return event;
  };
  const expectedDrag = (depth?: NativePuzzleDragDepth, index = 0, sign = 1): string | null => {
    const view = views[index];
    return pickNativePuzzleDrag(geometry, view.witness.local, object.matrixWorld, view.camera,
      { x: DELTA.x * sign, y: DELTA.y * sign }, VIEWPORT, depth);
  };
  return { host, player, sceneWrapper, hostPaths, views, object, family, closest, captured, state, pinchUps, pinchTouches,
    model, addMove, detach, fire, expectedDrag, resolveObject, currentVantages };
}

describe('native PG pointer adapter', () => {
  it('finds surfaces inside three closed shadow roots although the host cannot see canvas or vantage', async () => {
    const f = await fixture(), view = f.views[0];
    expect(f.player.shadowRoot).toBeNull();
    expect(f.sceneWrapper.shadowRoot).toBeNull();
    expect(view.vantage.shadowRoot).toBeNull();
    f.fire('pointerdown');
    expect(f.hostPaths[0]).toContain(f.player);
    expect(f.hostPaths[0]).not.toContain(f.sceneWrapper);
    expect(f.hostPaths[0]).not.toContain(view.vantage);
    expect(f.hostPaths[0]).not.toContain(view.canvas);
    expect(view.innerPaths[0]).toContain(view.vantage);
    expect(view.innerPaths[0]).toContain(view.canvas);
    f.fire('pointerup', { x: view.witness.x + DELTA.x, y: view.witness.y + DELTA.y });
    expect(f.addMove.mock.calls).toEqual([[f.expectedDrag()]]);
  });

  it.each(NATIVE_PUZZLE_IDS)('%s raycasts closed surfaces and commits each drag once in both directions', async (id) => {
    const f = await fixture(id), view = f.views[0];
    for (const sign of [1, -1]) {
      expect(f.fire('pointerdown').defaultPrevented).toBe(true);
      expect(f.captured.has(1)).toBe(true);
      f.fire('pointermove', { x: view.witness.x + sign * DELTA.x, y: view.witness.y + sign * DELTA.y });
      f.fire('pointermove', { x: view.witness.x - 100, y: view.witness.y + 50 });
      f.fire('pointerup');
    }
    expect(f.addMove.mock.calls).toEqual([
      [f.expectedDrag(undefined, 0, 1)], [f.expectedDrag(undefined, 0, -1)],
    ]);
    expect(f.closest).not.toHaveBeenCalled();
    expect(f.captured.size).toBe(0);
    expect(view.nativeDown).not.toHaveBeenCalled();
    expect(view.nativeMove).not.toHaveBeenCalled();
    expect(view.nativeUp).not.toHaveBeenCalled();
  });

  it('uses the rear vantage camera and its own viewport bounds', async () => {
    const f = await fixture(), view = f.views[1];
    for (const sign of [1, -1]) {
      f.fire('pointerdown', view.witness, view.canvas);
      f.fire('pointermove', { x: view.witness.x + sign * DELTA.x, y: view.witness.y + sign * DELTA.y }, view.canvas);
      f.fire('pointerup', view.witness, view.canvas);
    }
    expect(f.addMove.mock.calls).toEqual([
      [f.expectedDrag(undefined, 1, 1)], [f.expectedDrag(undefined, 1, -1)],
    ]);
    expect(view.nativeDown).not.toHaveBeenCalled();
  });

  it('keeps open debug shadow trees working without handling the same down twice', async () => {
    const f = await fixture('superz', false, 'open'), view = f.views[0];
    f.fire('pointerdown');
    f.fire('pointerup', { x: view.witness.x + DELTA.x, y: view.witness.y + DELTA.y });
    expect(f.hostPaths[0]).toContain(view.canvas);
    expect(view.innerPaths).toHaveLength(0); // The earlier host capture already owns it.
    expect(f.addMove.mock.calls).toEqual([[f.expectedDrag()]]);
    expect(view.nativeDown).not.toHaveBeenCalled();
  });

  it('preserves native tap inversion and sends the world hit to the existing local-coordinate wrapper', async () => {
    const f = await fixture();
    f.fire('pointerdown');
    f.fire('pointerup', { x: f.views[0].witness.x + 3 });
    expect(f.addMove.mock.calls).toEqual([[`${f.family}'`]]);
    expect(f.closest.mock.calls[0][0].distanceTo(f.views[0].witness.world)).toBeLessThan(1e-7);
    expect(f.closest.mock.calls[0][1]).toEqual({ invert: true, depth: 'none' });
    f.fire('pointerdown', { button: 2 });
    f.fire('pointerup', { button: 2 });
    expect(f.addMove.mock.calls[1]).toEqual([f.family]);
    expect(f.closest.mock.calls[1][1]).toEqual({ invert: false, depth: 'none' });
  });

  it.each([
    { modifier: { shiftKey: true }, depth: 'secondSlice', token: '2' },
    { modifier: { ctrlKey: true, shiftKey: true }, depth: 'rotation', token: 'v' },
    { modifier: { metaKey: true }, depth: 'rotation', token: 'v' },
  ])('preserves native $depth tap modifiers', async ({ modifier, depth, token }) => {
    const f = await fixture();
    f.fire('pointerdown', modifier); f.fire('pointerup', modifier);
    expect(f.closest.mock.calls[0][1]).toEqual({ invert: true, depth });
    expect(f.addMove.mock.calls).toEqual([[token === '2' ? `2${f.family}'` : `${f.family}v'`]]);
  });

  it.each([
    { selected: 'inner', modifier: {}, expected: 'inner' },
    { selected: 'wide', modifier: {}, expected: 'wide' },
    { selected: 'outer', modifier: {}, expected: 'outer' },
    { selected: 'auto', modifier: { shiftKey: true }, expected: 'inner' },
    { selected: 'auto', modifier: { altKey: true }, expected: 'wide' },
  ] as const)('uses $expected drag depth for $selected and modifiers', async ({ selected, modifier, expected }) => {
    const f = await fixture('dinoskewb'), point = f.views[0].witness;
    f.state.depth = selected;
    f.fire('pointerdown', modifier);
    f.fire('pointermove', { x: point.x + DELTA.x, y: point.y + DELTA.y, ...modifier });
    f.fire('pointerup', modifier);
    expect(f.addMove.mock.calls).toEqual([[f.expectedDrag(expected)]]);
  });

  it('uses drag direction for right-button drags and coalesced pointerup motion', async () => {
    const f = await fixture(), point = f.views[0].witness;
    f.fire('pointerdown', { button: 2 });
    f.fire('pointerup', { button: 2, x: point.x - DELTA.x, y: point.y - DELTA.y });
    expect(f.addMove.mock.calls).toEqual([[f.expectedDrag(undefined, 0, -1)]]);
    expect(f.closest).not.toHaveBeenCalled();
  });

  it.each(['inner', 'wide'] as const)('SuperZ ignores a retained %s selector depth from a previous puzzle', async (selected) => {
    const f = await fixture('superz'), point = f.views[0].witness;
    f.state.depth = selected;
    for (const sign of [1, -1]) {
      f.fire('pointerdown');
      f.fire('pointermove', { x: point.x + sign * DELTA.x, y: point.y + sign * DELTA.y });
      f.fire('pointerup');
    }
    expect(f.expectedDrag()).not.toBeNull();
    expect(f.addMove.mock.calls).toEqual([
      [f.expectedDrag(undefined, 0, 1)],
      [f.expectedDrag(undefined, 0, -1)],
    ]);
    expect(f.closest).not.toHaveBeenCalled();
    expect(f.captured.size).toBe(0);
  });

  it('validates wide tap aliases and gives whole rotations priority', async () => {
    const f = await fixture('dinoskewb');
    f.state.depth = 'wide';
    f.fire('pointerdown'); f.fire('pointerup');
    expect(f.addMove.mock.calls).toEqual([[`${f.family}w'`]]);
    f.fire('pointerdown', { ctrlKey: true }); f.fire('pointerup', { ctrlKey: true });
    expect(f.addMove.mock.calls[1]).toEqual([`${f.family}v'`]);
    const singleLayer = await fixture('superz');
    singleLayer.fire('pointerdown', { altKey: true }); singleLayer.fire('pointerup', { altKey: true });
    expect(singleLayer.addMove).not.toHaveBeenCalled();
  });

  it('leaves empty-space orbit, controls, and disabled pointer turns to the original handlers', async () => {
    const f = await fixture();
    for (const view of f.views) {
      const empty = { x: view.rect.left + 1, y: view.rect.top + 1 };
      expect(f.fire('pointerdown', empty, view.canvas).defaultPrevented).toBe(false);
      f.fire('pointerup', empty, view.canvas);
      expect(view.nativeDown).toHaveBeenCalledTimes(1);
      expect(view.nativeUp).toHaveBeenCalledTimes(1);
      const control = document.createElement('button');
      view.wrapper.appendChild(control);
      const controlDown = vi.fn(); control.addEventListener('pointerdown', controlDown);
      expect(f.fire('pointerdown', view.witness, control).defaultPrevented).toBe(false);
      f.fire('pointerup', view.witness, control);
      expect(controlDown).toHaveBeenCalledOnce();
    }
    f.state.enabled = false;
    for (const view of f.views) {
      expect(f.fire('pointerdown', view.witness, view.canvas).defaultPrevented).toBe(false);
      f.fire('pointerup', view.witness, view.canvas);
      expect(view.nativeDown).toHaveBeenCalledTimes(2);
    }
    expect(f.addMove).not.toHaveBeenCalled();
  });

  it('blocks turns during playback, catch-up, and paused partial animation, then resumes at a boundary', async () => {
    const f = await fixture();
    const cases = [
      { start: () => f.model.playingInfo.emit({ playing: true }), end: () => f.model.playingInfo.emit({ playing: false }) },
      { start: () => f.model.catchUpMove.emit({ move: new Move('F') }), end: () => f.model.catchUpMove.emit({ move: null }) },
      { start: () => f.model.currentMoveInfo.emit({ currentMoves: [{ fraction: 0.5 }] }), end: () => f.model.currentMoveInfo.emit({ currentMoves: [{ fraction: 1 }] }) },
    ];
    for (const scenario of cases) {
      scenario.start();
      expect(f.fire('pointerdown').defaultPrevented).toBe(true);
      f.fire('pointerup');
      expect(f.addMove).not.toHaveBeenCalled();
      scenario.end();
    }
    f.fire('pointerdown'); f.fire('pointerup');
    expect(f.addMove).toHaveBeenCalledOnce();
    f.fire('pointerdown');
    f.model.playingInfo.emit({ playing: true });
    f.model.playingInfo.emit({ playing: false });
    f.fire('pointerup');
    expect(f.addMove).toHaveBeenCalledOnce();
  });

  it.each(['pointercancel', 'lostpointercapture'])('%s cancels without committing even with large coordinates', async (ending) => {
    const f = await fixture(), point = f.views[0].witness;
    f.fire('pointerdown');
    f.fire(ending, { x: point.x + 100, y: point.y - 40 }, f.host);
    if (ending === 'lostpointercapture') {
      // Real native DragTracker interprets an orphan up as a press, so the
      // canceled stream must remain consumed after involuntary capture loss.
      f.fire('pointerup');
      expect(f.views[0].nativeUp).not.toHaveBeenCalled();
    }
    expect(f.addMove).not.toHaveBeenCalled();
    expect(f.closest).not.toHaveBeenCalled();
    expect(f.captured.size).toBe(0);
  });

  it('hands two touches to the earlier pinch handler and retains both captures until outside releases', async () => {
    const f = await fixture(), point = f.views[0].witness;
    f.fire('pointerdown', { pointerId: 11, pointerType: 'touch' });
    f.fire('pointerdown', { pointerId: 12, pointerType: 'touch', x: point.x + 10 });
    expect(f.state.pinching).toBe(true);
    expect([...f.captured]).toEqual([11, 12]);
    f.fire('pointermove', { pointerId: 11, pointerType: 'touch', x: point.x + 100 });
    f.fire('pointerup', { pointerId: 11, pointerType: 'touch', x: -100 }, document.body);
    expect(f.state.pinching).toBe(true);
    f.fire('pointerup', { pointerId: 12, pointerType: 'touch', x: -100 }, document.body);
    expect(f.pinchUps).toEqual([11, 12]);
    expect(f.pinchTouches.size).toBe(0);
    expect(f.state.pinching).toBe(false);
    expect(f.captured.size).toBe(0);
    expect(f.addMove).not.toHaveBeenCalled();
    f.fire('pointerdown', { pointerId: 13, pointerType: 'touch' });
    f.fire('pointerup', { pointerId: 13, pointerType: 'touch', x: point.x + DELTA.x, y: point.y + DELTA.y });
    expect(f.addMove.mock.calls).toEqual([[f.expectedDrag()]]);
  });

  it('cancels a held gesture when disabled and rejects nonfinite pointer or camera data', async () => {
    const f = await fixture(), point = f.views[0].witness;
    f.fire('pointerdown'); f.state.enabled = false;
    f.fire('pointerup', { x: point.x + DELTA.x });
    expect(f.addMove).not.toHaveBeenCalled();
    f.state.enabled = true;
    expect(f.fire('pointerdown', { x: NaN }).defaultPrevented).toBe(false);
    f.fire('pointerdown'); f.fire('pointermove', { x: Infinity }); f.fire('pointerup');
    expect(f.addMove).not.toHaveBeenCalled();
    f.views[0].camera.projectionMatrix.elements[0] = NaN;
    expect(f.fire('pointerdown').defaultPrevented).toBe(false);
  });

  it('releases capture and subscriptions on cleanup and ignores late initialization', async () => {
    const f = await fixture();
    f.fire('pointerdown');
    f.detach();
    expect(f.captured.size).toBe(0);
    for (const prop of Object.values(f.model)) expect(prop.listeners.size).toBe(0);
    f.fire('pointerup');
    expect(f.addMove).not.toHaveBeenCalled();
    const late = await fixture('superz', true);
    late.detach(); late.resolveObject();
    await flushInitialization();
    expect(late.currentVantages).not.toHaveBeenCalled();
    expect(late.fire('pointerdown').defaultPrevented).toBe(false);
    expect(late.addMove).not.toHaveBeenCalled();
  });

  it('ignores a stale player removed while the public object promise is pending', async () => {
    const f = await fixture('superz', true);
    f.player.remove(); f.resolveObject();
    await flushInitialization();
    expect(f.currentVantages).not.toHaveBeenCalled();
  });

  it('does not bind inner listeners when a pending camera resolves after cleanup', async () => {
    const f = await fixture('superz', true), view = f.views[0];
    let resolveCamera!: (camera: THREE.PerspectiveCamera) => void;
    const pendingCamera = new Promise<THREE.PerspectiveCamera>((resolve) => { resolveCamera = resolve; });
    view.cameraAPI.mockReturnValueOnce(pendingCamera);
    const addListener = vi.spyOn(view.wrapper, 'addEventListener');
    f.resolveObject();
    await flushInitialization();
    expect(view.cameraAPI).toHaveBeenCalledOnce();
    f.detach();
    resolveCamera(view.camera);
    await flushInitialization();
    expect(addListener).not.toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
    expect(f.fire('pointerdown').defaultPrevented).toBe(false);
    expect(view.nativeDown).toHaveBeenCalledOnce();
    expect(f.addMove).not.toHaveBeenCalled();
  });

  it('unbinds retired inner wrappers and prevents an older vantage refresh from restoring them', async () => {
    const f = await fixture(), rear = f.views[1];
    const removeRear = vi.spyOn(rear.wrapper, 'removeEventListener');
    const addRear = vi.spyOn(rear.wrapper, 'addEventListener');
    let resolveOld!: (vantages: ArrayIterator<HTMLElement>) => void;
    const pendingVantages = new Promise<ArrayIterator<HTMLElement>>((resolve) => { resolveOld = resolve; });
    f.currentVantages.mockReturnValueOnce(pendingVantages);
    f.model.backView.emit('side-by-side');
    f.currentVantages.mockResolvedValueOnce([f.views[0].vantage].values());
    f.model.backView.emit('none');
    await flushInitialization();
    expect(removeRear).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
    resolveOld(f.views.map((view) => view.vantage).values());
    await flushInitialization();
    expect(addRear).not.toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
    expect(f.fire('pointerdown', rear.witness, rear.canvas).defaultPrevented).toBe(false);
    f.fire('pointerup', rear.witness, rear.canvas);
    expect(f.addMove).not.toHaveBeenCalled();
    f.fire('pointerdown'); f.fire('pointerup');
    expect(f.addMove).toHaveBeenCalledOnce();
    const removeFront = vi.spyOn(f.views[0].wrapper, 'removeEventListener');
    f.detach();
    expect(removeFront).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
  });
});
