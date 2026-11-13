import * as THREE from 'three';
import type { Move } from 'cubing/alg';
import type { PgInteractionPuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import { exportSimSvg, simSceneSignature } from '@cuberoot/puzzle-render-core/scene-svg';
import { applyFreeOrbitDelta, ORBIT_K } from '@cuberoot/puzzle-render-core/engine/viewControls';
import type { TwistySettings } from '../TwistySection';
import type { NativeDragDepth } from '../NativePuzzleControls';
import type { NativePgSoftwareView } from '../../lib/native-pg-software-view';
import { createNativePgScene, type NativePgScenePosition } from './nativePgScene';
import { attachNativePgPointer } from './gestures/nativePgPointer';

export interface NativePgSvgView extends NativePgSoftwareView {
  resetView(): void;
}

interface Options {
  settings: () => TwistySettings | undefined;
  depth: () => NativeDragDepth;
  enabled: () => boolean;
  current: () => boolean;
  onScaleChange?: (scale: number) => void;
  label: string;
}

interface Observable<T> {
  get(): Promise<T>;
  addFreshListener(listener: (value: T) => void): void;
  removeFreshListener(listener: (value: T) => void): void;
}

interface Viewport extends HTMLDivElement {
  contentWrapper: HTMLElement;
  camera(): Promise<THREE.PerspectiveCamera>;
}

interface View {
  viewport: Viewport;
  svg: SVGSVGElement;
  camera: THREE.PerspectiveCamera;
  width: number;
  height: number;
  signature: string;
}

interface OrbitGesture {
  pointerId: number;
  view: View;
  mode: 'view' | 'rotate' | 'orbit';
  startX: number;
  startY: number;
  x: number;
  y: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const CONTROL_SELECTOR = 'button, input, select, textarea, a, [role="button"], [role="slider"], [contenteditable="true"]';
const MIN_DISTANCE = 3;
const MAX_DISTANCE = 9;
const DRAG_THRESHOLD = 6;
const DEG = Math.PI / 180;
const clampDistance = (value: number): number => THREE.MathUtils.clamp(value, MIN_DISTANCE, MAX_DISTANCE);

/**
 * A real PG scene projected on the CPU when the browser cannot create WebGL2.
 * The original player's model remains the sole state/timeline/record authority;
 * this host owns only its meshes, view orientation, SVG and pointer listeners.
 */
export async function attachNativePgSvgView(
  host: HTMLElement,
  // The public experimental model is deliberately shared with the native player.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  player: any,
  id: PgInteractionPuzzleId,
  options: Options,
): Promise<NativePgSvgView> {
  const nativeScene = createNativePgScene(id);
  const scene = new THREE.Scene();
  // Keep free orbit's XYZ Euler at z=0, as applyFreeOrbitDelta requires. Exact
  // whole-turn compensation can include roll and belongs in this separate view
  // transform, while the native puzzle root stays in its original PG frame.
  const viewCompensation = new THREE.Group();
  scene.add(viewCompensation);
  viewCompensation.add(nativeScene.root);
  const model = player.experimentalModel;
  const positionProp = model.legacyPosition as Observable<NativePgScenePosition>;
  const disconnect: Array<() => void> = [];
  const unsettled = new Set<symbol>();
  const touches = new Map<number, { x: number; y: number }>();
  const captures = new Set<number>();
  let live = true;
  let raf = 0;
  let orbit: OrbitGesture | null = null;
  let pinching = false;
  let pinchDistance = 0;
  let distance = 6;
  let previousSettings: TwistySettings | undefined;
  let settingsRevision = 0;
  let appendPending = false;
  let foldPending = false;
  let position: NativePgScenePosition;
  const accumulated = nativeScene.rotationAxes.map(() => 0);
  const current = (): boolean => live && options.current();
  const resetAccumulated = (): void => { accumulated.fill(0); };
  const mode = (): OrbitGesture['mode'] => (
    options.settings()?.pointerTurns === false || !options.enabled()
      ? 'view' : options.settings()?.dragEmpty ?? 'orbit'
  );
  const canTurn = (): boolean => current() && options.enabled()
    && options.settings()?.pointerTurns !== false && !pinching && !appendPending && unsettled.size === 0;

  const makeView = (className: string, back: boolean): View => {
    const viewport = document.createElement('div') as Viewport;
    viewport.className = className;
    viewport.contentWrapper = viewport;
    const camera = new THREE.PerspectiveCamera(20, 1, 0.01, 50);
    viewport.camera = async () => camera;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', options.label);
    if (back) svg.setAttribute('aria-hidden', 'true');
    else svg.classList.add('twisty-software3d-root');
    viewport.append(svg);
    return { viewport, svg, camera, width: 1, height: 1, signature: '' };
  };
  const main = makeView('twisty-software3d', false);
  const back = makeView('twisty-software3d-backview', true);
  main.viewport.append(back.viewport);
  // Back comes first: its composed path also contains the outer main viewport.
  const views = [back, main];

  const resize = (): void => {
    const rect = host.getBoundingClientRect();
    main.width = Math.max(1, rect.width || host.clientWidth);
    main.height = Math.max(1, rect.height || host.clientHeight);
    back.width = back.height = Math.max(1, main.width / 4);
    for (const view of views) {
      view.camera.aspect = view.width / view.height;
      view.camera.fov = 2 * Math.atan(Math.tan(10 * DEG) * view.height / Math.min(view.width, view.height)) / DEG;
      view.camera.position.set(0, 0, view === back ? -distance : distance);
      view.camera.lookAt(0, 0, 0);
      view.camera.updateProjectionMatrix();
      view.camera.updateMatrixWorld(true);
      view.svg.setAttribute('viewBox', `0 0 ${view.width} ${view.height}`);
    }
  };
  const render = (): void => {
    raf = 0;
    if (!current() || foldPending) return;
    scene.updateMatrixWorld(true);
    for (const view of views) {
      if (view.viewport.hidden) continue;
      const world = { scene, camera: view.camera, width: view.width, height: view.height };
      const signature = simSceneSignature(world);
      if (signature === view.signature) continue;
      const markup = exportSimSvg({ world });
      // Only our trusted exporter supplies markup. Keep the outer SVG stable so
      // an active pointer stream never loses its explicitly owned surface.
      view.svg.innerHTML = markup.slice(markup.indexOf('>') + 1, markup.lastIndexOf('</svg>'));
      view.signature = signature;
    }
  };
  const schedule = (): void => { if (current() && !raf) raf = requestAnimationFrame(render); };
  const updateSettings = (): void => {
    if (!current()) return;
    const settings = options.settings();
    if (!previousSettings || settings?.viewAngle !== previousSettings.viewAngle
      || settings?.viewGradient !== previousSettings.viewGradient) {
      const yaw = (((settings?.viewAngle ?? 50) - 50) / 50) * 180 * DEG;
      const pitch = ((50 - (settings?.viewGradient ?? 50)) / 50) * 90 * DEG;
      scene.rotation.set(pitch, -yaw, 0);
      viewCompensation.quaternion.identity();
      settingsRevision++;
      resetAccumulated();
      orbit = null;
    }
    if (!previousSettings || settings?.scale !== previousSettings.scale) {
      distance = clampDistance(MAX_DISTANCE - (settings?.scale ?? 50) / 100 * (MAX_DISTANCE - MIN_DISTANCE));
    }
    if (settings?.dragEmpty !== previousSettings?.dragEmpty
      || settings?.pointerTurns !== previousSettings?.pointerTurns) {
      settingsRevision++;
      resetAccumulated();
      orbit = null;
    }
    nativeScene.setHint(settings?.hint ?? false);
    nativeScene.setCoreOpacity(settings?.coreOpacity ?? 100);
    back.viewport.hidden = !settings?.backView;
    previousSettings = settings ? { ...settings } : undefined;
    // Material opacity is intentionally not part of the shared mesh signature.
    for (const view of views) view.signature = '';
    scene.updateMatrixWorld(true);
    resize();
    schedule();
  };
  const zoom = (nextDistance: number): void => {
    if (!current() || options.settings()?.lockView || !Number.isFinite(nextDistance)) return;
    distance = clampDistance(nextDistance);
    resize();
    schedule();
    options.onScaleChange?.(Math.round((MAX_DISTANCE - distance) / (MAX_DISTANCE - MIN_DISTANCE) * 100));
  };

  const release = (pointerId: number): void => {
    captures.delete(pointerId);
    try { if (host.hasPointerCapture(pointerId)) host.releasePointerCapture(pointerId); } catch { /* Detached pointer. */ }
  };
  const capture = (pointerId: number): void => {
    captures.add(pointerId);
    try { host.setPointerCapture(pointerId); } catch { /* Pointer ended during setup. */ }
  };
  const viewAt = (event: Event): View | undefined => {
    const path = event.composedPath();
    if (path.some((target) => target instanceof Element && target.matches(CONTROL_SELECTOR))) return undefined;
    return views.find((view) => !view.viewport.hidden && path.includes(view.svg));
  };
  const touchSpan = (): number => {
    const [a, b] = Array.from(touches.values());
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  // Install these capture listeners before nativePgPointer. A second touch must
  // cancel its pending layer turn before either finger can be mistaken for a tap.
  const touchDown = (event: PointerEvent): void => {
    if (!current() || event.pointerType !== 'touch' || (!viewAt(event) && touches.size === 0)) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size < 2) return;
    pinching = true;
    orbit = null;
    resetAccumulated();
    pinchDistance = touchSpan();
    for (const pointerId of touches.keys()) capture(pointerId);
  };
  const touchMove = (event: PointerEvent): void => {
    if (!current() || !touches.has(event.pointerId)) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!pinching) return;
    event.preventDefault();
    const next = touchSpan();
    if (pinchDistance > 0 && next > 0) zoom(distance * pinchDistance / next);
    pinchDistance = next;
  };
  const touchEnd = (event: PointerEvent): void => {
    if (!touches.delete(event.pointerId)) return;
    if (pinching) release(event.pointerId);
    // One remaining finger still belongs to the pinch, never to a new layer drag.
    if (touches.size === 0) { pinching = false; pinchDistance = 0; }
  };

  const watchSettled = <T,>(prop: Observable<T> | undefined, busy: (value: T) => boolean): void => {
    if (!prop?.addFreshListener) return;
    const key = Symbol();
    unsettled.add(key);
    const listener = (value: T): void => {
      if (!current()) return;
      if (busy(value)) { unsettled.add(key); resetAccumulated(); }
      else unsettled.delete(key);
    };
    prop.addFreshListener(listener);
    disconnect.push(() => prop.removeFreshListener(listener));
  };

  /** An accepted whole turn is already in the real model's record. Cancel only
   * its matching catch-up and fold its inverse into the view in the same paint as
   * the new endpoint. O' T = O keeps every real sticker at its pre-fold position.
   * Rejected/stale appends never change the view or clear another move's animation.
   */
  const fold = async (move: Move, axis: THREE.Vector3, angle: number): Promise<void> => {
    if (!canTurn()) return;
    const before = position.pattern;
    const revision = settingsRevision;
    foldPending = appendPending = true;
    try {
      const accepted = await model.experimentalAddMove(move);
      if (!current() || accepted !== true || revision !== settingsRevision) return;
      const [catchUp, after] = await Promise.all([model.catchUpMove.get(), positionProp.get()]);
      if (!current() || revision !== settingsRevision) return;
      const expected = before.applyMove(move);
      // An editor change, a timeline jump or another append must not be hidden
      // by compensating the wrong state or clearing an unrelated catch-up move.
      if (!after.pattern.isIdentical(expected)
        || (catchUp.move !== null && !catchUp.move.isIdentical(move))) return;
      // A new append can be queued between the awaited snapshots above. Capture
      // the current public prop now and conditionally replace only the exact
      // catch-up object we verified. Twisty's own catch-up animator uses this
      // public set(Promise) form too; a later write supersedes it normally.
      let cleared = false;
      const latestCatchUp = model.catchUpMove.get();
      model.catchUpMove.set(latestCatchUp.then((latest: typeof catchUp) => {
        if (!current() || revision !== settingsRevision || latest !== catchUp) return latest;
        cleared = true;
        return { move: null, amount: 0 };
      }));
      const endpoint = await positionProp.get();
      if (!current() || !cleared || revision !== settingsRevision || endpoint.movesInProgress.length !== 0
        || !endpoint.pattern.isIdentical(expected)) return;
      viewCompensation.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, -angle));
      position = endpoint;
    } finally {
      foldPending = appendPending = false;
      resetAccumulated();
      if (current()) {
        nativeScene.applyPosition(position);
        scene.updateMatrixWorld(true);
        schedule();
      }
    }
  };
  const accumulate = (before: THREE.Quaternion): void => {
    if (!canTurn()) { resetAccumulated(); return; }
    const delta = before.invert().multiply(nativeScene.root.getWorldQuaternion(new THREE.Quaternion()));
    if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
    const sin = Math.hypot(delta.x, delta.y, delta.z);
    if (sin < 1e-10) return;
    const vector = new THREE.Vector3(delta.x, delta.y, delta.z).multiplyScalar(2 * Math.atan2(sin, delta.w) / sin);
    let best = -1;
    let score = 1;
    nativeScene.rotationAxes.forEach(({ axis, order }, index) => {
      accumulated[index] += vector.dot(axis);
      const ratio = Math.abs(accumulated[index]) / (2 * Math.PI / order);
      if (ratio >= score) { best = index; score = ratio; }
    });
    if (best < 0) return;
    const { axis, order, move } = nativeScene.rotationAxes[best];
    const sign = Math.sign(accumulated[best]);
    // PG bare moves rotate by the negative right-handed angle around their axis.
    void fold(move.modified({ amount: -sign }), axis, sign * 2 * Math.PI / order).catch(() => { /* Rejected/disposed model. */ });
  };

  const onDown = (event: PointerEvent): void => {
    if (!current() || pinching || orbit || (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2)) return;
    const view = viewAt(event);
    if (!view || ![event.clientX, event.clientY].every(Number.isFinite)) return;
    orbit = { pointerId: event.pointerId, view, mode: mode(), startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY };
    resetAccumulated();
    capture(event.pointerId);
    event.preventDefault();
  };
  const moveOrbit = (event: PointerEvent): void => {
    const active = orbit;
    if (!current() || !active || active.pointerId !== event.pointerId || pinching
      || ![event.clientX, event.clientY].every(Number.isFinite)) return;
    const dx = event.clientX - active.x;
    const dy = (event.clientY - active.y) * (active.view === back ? -1 : 1);
    active.x = event.clientX;
    active.y = event.clientY;
    if (active.mode === 'rotate') return;
    const before = nativeScene.root.getWorldQuaternion(new THREE.Quaternion());
    applyFreeOrbitDelta(scene.rotation, dx, dy, ORBIT_K);
    scene.updateMatrixWorld(true);
    if (active.mode === 'orbit') accumulate(before);
    schedule();
  };
  const onMove = (event: PointerEvent): void => {
    if (orbit?.pointerId !== event.pointerId) return;
    event.preventDefault();
    moveOrbit(event);
  };
  const onUp = (event: PointerEvent): void => {
    const active = orbit;
    if (!active || active.pointerId !== event.pointerId) return;
    moveOrbit(event);
    orbit = null;
    release(event.pointerId);
    event.preventDefault();
    if (active.mode !== 'rotate' || !canTurn()) return;
    const dx = event.clientX - active.startX;
    const dy = (event.clientY - active.startY) * (active.view === back ? -1 : 1);
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    const direction = new THREE.Vector3(dy, dx, 0)
      .applyQuaternion(nativeScene.root.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
    let best = -1;
    let bestDot = 0;
    nativeScene.rotationAxes.forEach(({ axis }, index) => {
      const dot = direction.dot(axis);
      if (Math.abs(dot) > Math.abs(bestDot)) { best = index; bestDot = dot; }
    });
    if (best < 0) return;
    appendPending = true;
    void Promise.resolve(model.experimentalAddMove(nativeScene.rotationAxes[best].move.modified({ amount: -Math.sign(bestDot) })))
      .catch(() => { /* Rejected/disposed model. */ }).finally(() => { appendPending = false; });
  };
  const onCancel = (event: PointerEvent): void => {
    if (orbit?.pointerId === event.pointerId) { orbit = null; resetAccumulated(); }
    if (captures.has(event.pointerId)) release(event.pointerId);
  };
  const onWheel = (event: WheelEvent): void => {
    if (!current() || !viewAt(event) || options.settings()?.lockView) return;
    event.preventDefault();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? main.height : 1);
    zoom(distance * Math.exp(pixels * 0.001));
  };
  const listen = (target: EventTarget, name: string, listener: EventListener, capture = false): void => {
    target.addEventListener(name, listener, { capture, passive: false });
    disconnect.push(() => target.removeEventListener(name, listener, capture));
  };
  const dispose = (): void => {
    if (!live) return;
    live = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    orbit = null;
    for (const stop of disconnect.reverse()) { try { stop(); } catch { /* Detached/disposed prop. */ } }
    for (const pointerId of captures) release(pointerId);
    touches.clear();
    main.viewport.remove();
    nativeScene.dispose();
    scene.clear();
  };

  try {
    position = await positionProp.get();
    if (!current()) throw new Error('Native PG software view was superseded');
    nativeScene.applyPosition(position);
    updateSettings();
    // Fail attachment before hiding the native net if initial projection fails.
    if (raf) cancelAnimationFrame(raf);
    render();
    host.append(main.viewport);
    const onPosition = (next: NativePgScenePosition): void => {
      if (!current()) return;
      position = next;
      if (!foldPending) nativeScene.applyPosition(next);
      schedule();
    };
    positionProp.addFreshListener(onPosition);
    disconnect.push(() => positionProp.removeFreshListener(onPosition));
    watchSettled<{ playing: boolean }>(model.playingInfo, (value) => value.playing);
    watchSettled<{ move: unknown | null }>(model.catchUpMove, (value) => value.move !== null);
    watchSettled<{ currentMoves: Array<{ fraction: number }> }>(model.currentMoveInfo, (value) => (
      value.currentMoves.some(({ fraction }) => !Number.isFinite(fraction) || (fraction > 1e-6 && fraction < 1 - 1e-6))
    ));
    listen(host, 'pointerdown', touchDown as EventListener, true);
    listen(host, 'pointermove', touchMove as EventListener, true);
    listen(host, 'pointerup', touchEnd as EventListener, true);
    listen(host, 'pointercancel', touchEnd as EventListener, true);
    const adapter = {
      experimentalModel: model,
      experimentalAddMove: (move: string) => player.experimentalAddMove(move),
      experimentalCurrentThreeJSPuzzleObject: async () => nativeScene.root,
      experimentalCurrentVantages: async () => views.map((view) => view.viewport),
    };
    disconnect.push(attachNativePgPointer(host, adapter, id, {
      enabled: () => current() && options.enabled() && mode() !== 'view' && !appendPending,
      depth: options.depth,
      pinching: () => pinching,
      svgSurface: (svg) => svg === main.svg || (svg === back.svg && !back.viewport.hidden),
    }));
    listen(host, 'pointerdown', onDown as EventListener);
    listen(host, 'pointermove', onMove as EventListener);
    listen(host, 'pointerup', onUp as EventListener);
    listen(host, 'pointercancel', onCancel as EventListener);
    listen(host, 'lostpointercapture', onCancel as EventListener);
    listen(host, 'wheel', onWheel as EventListener);
    listen(window, 'pointerup', (event) => { touchEnd(event as PointerEvent); onCancel(event as PointerEvent); });
    listen(window, 'pointercancel', (event) => { touchEnd(event as PointerEvent); onCancel(event as PointerEvent); });
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        if (!current()) return;
        const oldWidth = main.width;
        const oldHeight = main.height;
        resize();
        if (main.width !== oldWidth || main.height !== oldHeight) schedule();
      });
      observer.observe(host);
      disconnect.push(() => observer.disconnect());
    }
    return {
      getSvg: () => current() ? main.svg : null,
      updateSettings,
      resetView: () => { previousSettings = undefined; updateSettings(); },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
