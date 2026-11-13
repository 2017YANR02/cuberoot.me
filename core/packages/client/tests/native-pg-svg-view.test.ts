// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { TwistyPlayer, type ExperimentalLeafIndex, type ExperimentalMillisecondTimestamp } from 'cubing/twisty';
import { Move } from 'cubing/alg';
import { INTERACTIVE_PG_PUZZLES } from '@cuberoot/puzzle-solvers/native-puzzles';
import { nativePuzzleKPuzzle } from '@cuberoot/puzzle-solvers/native-puzzle-model';
import { attachNativePgSvgView } from '@/components/puzzle-models/nativePgSvgView';
import { attachNativePgMoveAppend } from '@/components/puzzle-models/gestures/nativePgMoveAppend';
import * as nativeSceneModule from '@/components/puzzle-models/nativePgScene';
import type { TwistySettings } from '@/components/TwistySection';

type Id = 'radiogem' | 'radiofathom';
const createScene = nativeSceneModule.createNativePgScene;
const frames = new Map<number, FrameRequestCallback>();
const cleanup: Array<() => void> = [];
let frameId = 0;
let madeScene: nativeSceneModule.NativePgScene;

async function settle(): Promise<void> {
  // Public TwistyProps dispatch fresh values in a zero-delay task, then derive
  // their state through promises. This keeps that real state graph in the test.
  for (let i = 0; i < 3; i++) await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
async function paint(): Promise<void> {
  await settle();
  const pending = [...frames];
  for (const [id, callback] of pending) {
    if (!frames.delete(id)) continue;
    callback(performance.now());
  }
  await settle();
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++frameId;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
  vi.spyOn(nativeSceneModule, 'createNativePgScene').mockImplementation((id) => {
    madeScene = createScene(id);
    return madeScene;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    throw new Error('A software PG host must not request a canvas context');
  });
});
afterEach(() => {
  for (const stop of cleanup.splice(0).reverse()) stop();
  frames.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

interface PointerData {
  x: number;
  y: number;
  pointerId?: number;
  pointerType?: string;
}

async function fixture(id: Id = 'radiogem', override: Partial<TwistySettings> = {}, anchor: 'start' | 'end' = 'start') {
  const host = document.createElement('div');
  document.body.append(host);
  const rect = new DOMRect(0, 0, 640, 480);
  host.getBoundingClientRect = () => rect;
  const captured = new Set<number>();
  host.setPointerCapture = (pointerId) => { captured.add(pointerId); };
  host.hasPointerCapture = (pointerId) => captured.has(pointerId);
  host.releasePointerCapture = (pointerId) => { captured.delete(pointerId); };
  const player = new TwistyPlayer({
    experimentalPuzzleDescription: INTERACTIVE_PG_PUZZLES[id].description,
    experimentalSetupAlg: "R 2L'", alg: 'G', experimentalSetupAnchor: anchor,
    visualization: '2D', controlPanel: 'none',
  });
  player.timestamp = 'end';
  const requestThree = vi.spyOn(player, 'experimentalCurrentThreeJSPuzzleObject').mockRejectedValue(new Error('No WebGL'));
  const requestVantages = vi.spyOn(player, 'experimentalCurrentVantages').mockRejectedValue(new Error('No WebGL'));
  const state = {
    current: true, enabled: true,
    settings: { scale: 50, viewAngle: 50, viewGradient: 50, hint: false, speed: 50, dragEmpty: 'orbit', ...override } as TwistySettings,
  };
  const onMove = vi.fn<(move: string, anchoredSetup?: { setup: string }) => void>();
  const detachAppend = attachNativePgMoveAppend(player.experimentalModel, id, {
    enabled: () => state.enabled, current: () => state.current, onMove,
  });
  cleanup.push(() => { player.pause(); detachAppend(); host.remove(); });
  const scale = vi.fn();
  const removePosition = vi.spyOn(player.experimentalModel.legacyPosition, 'removeFreshListener');
  const view = await attachNativePgSvgView(host, player, id, {
    settings: () => state.settings,
    depth: () => 'auto',
    enabled: () => state.enabled,
    current: () => state.current,
    onScaleChange: scale,
    label: id,
  });
  cleanup.push(view.dispose);
  const nativeScene = madeScene;
  const scene = nativeScene.root.parent!.parent as THREE.Scene;
  const svg = view.getSvg()!;
  const viewport = svg.parentElement! as HTMLDivElement & { camera(): Promise<THREE.PerspectiveCamera> };
  const backViewport = host.querySelector<HTMLDivElement>('.twisty-software3d-backview')! as HTMLDivElement & { camera(): Promise<THREE.PerspectiveCamera> };
  const backSvg = backViewport.querySelector('svg')!;
  viewport.getBoundingClientRect = () => rect;
  backViewport.getBoundingClientRect = () => new DOMRect(480, 0, 160, 160);
  await paint();
  const fire = (name: string, data: PointerData, target: EventTarget = svg): Event => {
    const event = new Event(name, { bubbles: true, composed: true, cancelable: true });
    const pointerId = data.pointerId ?? 1;
    Object.defineProperties(event, {
      clientX: { value: data.x }, clientY: { value: data.y },
      pointerId: { value: pointerId }, pointerType: { value: data.pointerType ?? 'mouse' },
      button: { value: 0 }, altKey: { value: false }, shiftKey: { value: false },
      ctrlKey: { value: false }, metaKey: { value: false },
    });
    (name !== 'pointerdown' && captured.has(pointerId) ? host : target).dispatchEvent(event);
    return event;
  };
  const drag = (from: PointerData, to: PointerData, target: EventTarget = svg): void => {
    fire('pointerdown', from, target);
    fire('pointermove', to, target);
    fire('pointerup', to, target);
  };
  return { id, host, player, model: player.experimentalModel, view, svg, backSvg, viewport, backViewport,
    nativeScene, scene, state, onMove, scale, fire, drag, captured, requestThree, requestVantages, removePosition };
}

/** Match colored physical sticker centers in world space; this observes the
 * actual native permutation and the host's view compensation together. */
function coloredCenters(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  const result: { point: THREE.Vector3; color: string }[] = [];
  root.traverse((object) => {
    if (!object.name.startsWith('sticker:')) return;
    const mesh = object as THREE.Mesh;
    const positions = mesh.geometry.getAttribute('position');
    const color = mesh.geometry.getAttribute('color');
    const point = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) point.add(new THREE.Vector3().fromBufferAttribute(positions, i));
    point.divideScalar(positions.count).applyMatrix4(mesh.matrixWorld);
    result.push({ point, color: [color.getX(0), color.getY(0), color.getZ(0)].join(',') });
  });
  return result;
}

describe('native PG software 3D host', () => {
  it.each(['radiogem', 'radiofathom'] as const)('%s projects real position and in-flight frames without WebGL or replacement SVG roots', async (id) => {
    const f = await fixture(id);
    const initial = f.svg.innerHTML;
    expect(f.svg.querySelector('path')).not.toBeNull();
    expect(initial).not.toMatch(/NaN|Infinity/);
    f.player.alg = "R U'";
    f.player.timestamp = 'end';
    await paint();
    const end = f.svg.innerHTML;
    expect(end).not.toBe(initial);
    const indexer = await f.model.indexer.get();
    f.player.timestamp = (indexer.moveDuration(0 as ExperimentalLeafIndex) / 2) as ExperimentalMillisecondTimestamp;
    await paint();
    const position = await f.model.legacyPosition.get();
    expect(position.movesInProgress[0].fraction).toBeCloseTo(0.5);
    expect(f.svg.innerHTML).not.toBe(end);
    expect(f.svg.innerHTML).not.toMatch(/NaN|Infinity/);
    expect(f.view.getSvg()).toBe(f.svg);
    expect(f.requestThree).not.toHaveBeenCalled();
    expect(f.requestVantages).not.toHaveBeenCalled();
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
  });

  it.each(['radiogem', 'radiofathom'] as const)('%s consumes one real surface drag into one native move and gates animated presses', async (id) => {
    const f = await fixture(id);
    const orientation = f.scene.quaternion.clone();
    f.drag({ x: 325, y: 244 }, { x: 365, y: 224 });
    await settle();
    expect(f.onMove).toHaveBeenCalledTimes(1);
    const move = f.onMove.mock.calls[0][0];
    expect(() => nativePuzzleKPuzzle(id).moveToTransformation(move)).not.toThrow();
    expect(new Move(move).family.endsWith('v')).toBe(false);
    expect(f.scene.quaternion.angleTo(orientation)).toBe(0);
    f.drag({ x: 325, y: 244 }, { x: 365, y: 224 });
    await settle();
    expect(f.onMove).toHaveBeenCalledTimes(1);
  });

  it('keeps view-only drags unbounded, preserves them across unrelated settings and resets them only on changed view sliders', async () => {
    const f = await fixture('radiogem', { dragEmpty: 'view' });
    f.drag({ x: 325, y: 244 }, { x: 325, y: 444 });
    expect(f.scene.rotation.x).toBeCloseTo(2);
    f.drag({ x: 325, y: 244 }, { x: 375, y: 244 });
    expect(f.scene.rotation.y).toBeCloseTo(-0.5);
    const q = f.scene.quaternion.clone();
    f.state.settings = { ...f.state.settings, hint: true, coreOpacity: 25, backView: true };
    f.view.updateSettings();
    await paint();
    expect(f.scene.quaternion.angleTo(q)).toBe(0);
    expect(f.backViewport.hidden).toBe(false);
    expect(f.backSvg.querySelector('path')).not.toBeNull();
    expect(f.svg.innerHTML).toContain('opacity="0.25"');
    expect(f.onMove).not.toHaveBeenCalled();
    f.state.settings = { ...f.state.settings, viewAngle: 75, viewGradient: 25 };
    f.view.updateSettings();
    expect(f.scene.rotation.x).toBeCloseTo(Math.PI / 4);
    expect(f.scene.rotation.y).toBeCloseTo(-Math.PI / 2);
  });

  it('records a legal whole turn in rotate mode without silently changing the view', async () => {
    const f = await fixture('radiofathom', { dragEmpty: 'rotate' });
    const q = f.scene.quaternion.clone();
    f.drag({ x: 8, y: 8 }, { x: 95, y: 8 });
    await settle();
    expect(f.onMove).toHaveBeenCalledTimes(1);
    const move = new Move(f.onMove.mock.calls[0][0]);
    expect(move.family.endsWith('v')).toBe(true);
    expect(nativePuzzleKPuzzle(f.id).moveToTransformation(move).repetitionOrder()).toBe(5);
    expect(f.scene.quaternion.angleTo(q)).toBe(0);
  });

  it('explicitly resets a dragged view even when the persisted default slider values have not changed', async () => {
    const f = await fixture('radiogem', { dragEmpty: 'view', viewAngle: 30, viewGradient: 20 });
    const initial = f.nativeScene.root.getWorldQuaternion(new THREE.Quaternion());
    f.drag({ x: 8, y: 8 }, { x: 138, y: 148 });
    expect(f.nativeScene.root.getWorldQuaternion(new THREE.Quaternion()).angleTo(initial)).toBeGreaterThan(0.1);
    f.view.resetView();
    await paint();
    expect(f.nativeScene.root.getWorldQuaternion(new THREE.Quaternion()).angleTo(initial)).toBe(0);
    expect(f.state.settings.viewAngle).toBe(30);
    expect(f.state.settings.viewGradient).toBe(20);
    expect(f.onMove).not.toHaveBeenCalled();
  });

  it.each(['start', 'end'] as const)('folds automatic whole turns continuously while preserving the %s anchor and native record', async (anchor) => {
    const f = await fixture('radiogem', { dragEmpty: 'orbit' }, anchor);
    const beforePattern = (await f.model.legacyPosition.get()).pattern;
    const beforeSetup = (await f.model.setupAlg.get()).alg;
    f.fire('pointerdown', { x: 8, y: 8 });
    f.fire('pointermove', { x: 148, y: 8 });
    // The drag has rotated the real scene, but the async native append has not
    // yet committed. Capture this frame for independent continuity comparison.
    const beforeFold = coloredCenters(f.nativeScene.root);
    const beforeQ = f.nativeScene.root.getWorldQuaternion(new THREE.Quaternion());
    f.fire('pointerup', { x: 148, y: 8 });
    await paint();
    expect(f.onMove).toHaveBeenCalledTimes(1);
    const move = f.onMove.mock.calls[0][0];
    expect(new Move(move).family.endsWith('v')).toBe(true);
    expect((await f.model.legacyPosition.get()).pattern.isIdentical(beforePattern.applyMove(move))).toBe(true);
    expect((await f.model.catchUpMove.get()).move).toBeNull();
    expect(f.nativeScene.root.getWorldQuaternion(new THREE.Quaternion()).angleTo(beforeQ)).toBeCloseTo(2 * Math.PI / 5);
    expect(f.scene.rotation.z).toBe(0);
    const afterFold = coloredCenters(f.nativeScene.root);
    const maxError = Math.max(...beforeFold.map(({ point, color }) => Math.min(
      ...afterFold.filter((entry) => entry.color === color).map((entry) => point.distanceTo(entry.point)),
    )));
    expect(maxError).toBeLessThan(2e-7);
    expect(await f.model.setupAnchor.get()).toBe(anchor);
    if (anchor === 'end') {
      const setup = (await f.model.setupAlg.get()).alg;
      expect(f.onMove.mock.calls[0][1]?.setup).toBe(setup.toString());
      const puzzle = await f.model.kpuzzle.get();
      expect(puzzle.algToTransformation(setup).isIdentical(puzzle.algToTransformation(`${beforeSetup} ${move}`))).toBe(true);
    }
  });

  it('keeps the free view intact when the native append wrapper rejects a queued automatic turn', async () => {
    const f = await fixture();
    const alg = (await f.model.alg.get()).alg.toString();
    f.fire('pointerdown', { x: 8, y: 8 });
    f.fire('pointermove', { x: 148, y: 8 });
    const q = f.scene.quaternion.clone();
    // The wrapper checks this before its queued transaction starts.
    f.state.enabled = false;
    f.fire('pointerup', { x: 148, y: 8 });
    await paint();
    expect(f.scene.quaternion.angleTo(q)).toBe(0);
    expect((await f.model.alg.get()).alg.toString()).toBe(alg);
    expect(f.onMove).not.toHaveBeenCalled();
  });

  it('keeps consecutive automatic turns continuous across different axes without adding roll to the free-orbit controls', async () => {
    const f = await fixture('radiofathom');
    const motions = [{ x: 148, y: 8 }, { x: 8, y: 208 }];
    for (const [index, to] of motions.entries()) {
      f.fire('pointerdown', { x: 8, y: 8 });
      f.fire('pointermove', to);
      const before = coloredCenters(f.nativeScene.root);
      f.fire('pointerup', to);
      await paint();
      expect(f.onMove).toHaveBeenCalledTimes(index + 1);
      expect((await f.model.catchUpMove.get()).move).toBeNull();
      const after = coloredCenters(f.nativeScene.root);
      const maxError = Math.max(...before.map(({ point, color }) => Math.min(
        ...after.filter((entry) => entry.color === color).map((entry) => point.distanceTo(entry.point)),
      )));
      expect(maxError).toBeLessThan(2e-7);
      expect(f.scene.rotation.z).toBe(0);
    }
    expect(new Move(f.onMove.mock.calls[0][0]).family).not.toBe(new Move(f.onMove.mock.calls[1][0]).family);
    f.state.settings = { ...f.state.settings, dragEmpty: 'view' };
    f.view.updateSettings();
    const yaw = f.scene.rotation.y;
    f.drag({ x: 8, y: 8 }, { x: 38, y: 8 });
    // Pitch has crossed the pole; the shared free-view convention reverses yaw.
    expect(f.scene.rotation.y).toBeCloseTo(yaw - 0.3);
    expect(f.onMove).toHaveBeenCalledTimes(2);
    f.view.resetView();
    expect(f.nativeScene.root.getWorldQuaternion(new THREE.Quaternion()).angleTo(new THREE.Quaternion())).toBe(0);
    expect(f.onMove).toHaveBeenCalledTimes(2);
  });

  it('does not clear a newer catch-up inserted after the automatic turn snapshots were read', async () => {
    const f = await fixture();
    const originalGet = f.model.legacyPosition.get.bind(f.model.legacyPosition);
    const newerCatchUp = { move: new Move('R'), amount: 0.2 };
    // Insert a different public animation write precisely between the read of
    // the old frame and the conditional clear. A token-only check is insufficient.
    vi.spyOn(f.model.legacyPosition, 'get').mockImplementationOnce(async () => {
      const snapshot = await originalGet();
      queueMicrotask(() => f.model.catchUpMove.set(newerCatchUp));
      return snapshot;
    });
    f.fire('pointerdown', { x: 8, y: 8 });
    f.fire('pointermove', { x: 148, y: 8 });
    const beforeQ = f.nativeScene.root.getWorldQuaternion(new THREE.Quaternion());
    f.fire('pointerup', { x: 148, y: 8 });
    await settle();
    expect(f.onMove).toHaveBeenCalledTimes(1);
    expect(await f.model.catchUpMove.get()).toBe(newerCatchUp);
    expect(f.nativeScene.root.getWorldQuaternion(new THREE.Quaternion()).angleTo(beforeQ)).toBe(0);
  });

  it('cancels a touched layer when a second finger begins a pinch and respects the size lock', async () => {
    const f = await fixture();
    const camera = await f.viewport.camera();
    const initialDistance = camera.position.length();
    f.fire('pointerdown', { x: 325, y: 244, pointerType: 'touch', pointerId: 1 });
    f.fire('pointerdown', { x: 425, y: 244, pointerType: 'touch', pointerId: 2 });
    f.fire('pointermove', { x: 475, y: 244, pointerType: 'touch', pointerId: 2 });
    expect(camera.position.length()).toBeLessThan(initialDistance);
    f.fire('pointerup', { x: 475, y: 244, pointerType: 'touch', pointerId: 2 });
    f.fire('pointermove', { x: 365, y: 224, pointerType: 'touch', pointerId: 1 });
    f.fire('pointerup', { x: 365, y: 224, pointerType: 'touch', pointerId: 1 });
    await settle();
    expect(f.onMove).not.toHaveBeenCalled();
    expect(f.captured.size).toBe(0);
    f.state.settings = { ...f.state.settings, lockView: true };
    f.view.updateSettings();
    const lockedDistance = camera.position.length();
    f.svg.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
    f.fire('pointerdown', { x: 8, y: 8, pointerType: 'touch', pointerId: 3 });
    f.fire('pointerdown', { x: 108, y: 8, pointerType: 'touch', pointerId: 4 });
    f.fire('pointermove', { x: 208, y: 8, pointerType: 'touch', pointerId: 4 });
    f.fire('pointerup', { x: 208, y: 8, pointerType: 'touch', pointerId: 4 });
    f.fire('pointerup', { x: 8, y: 8, pointerType: 'touch', pointerId: 3 });
    expect(camera.position.length()).toBe(lockedDistance);
    expect(f.onMove).not.toHaveBeenCalled();
  });

  it('uses the back camera for physical surface turns and rejects unrelated SVG and controls', async () => {
    const f = await fixture('radiofathom', { backView: true });
    f.drag({ x: 561, y: 81 }, { x: 575, y: 73 }, f.backSvg);
    await settle();
    expect(f.onMove).toHaveBeenCalledTimes(1);
    expect(() => nativePuzzleKPuzzle(f.id).moveToTransformation(f.onMove.mock.calls[0][0])).not.toThrow();
    f.model.catchUpMove.set({ move: null, amount: 0 });
    await settle();
    const unrelated = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    f.viewport.append(unrelated);
    f.drag({ x: 325, y: 244 }, { x: 365, y: 224 }, unrelated);
    const button = document.createElement('button');
    f.viewport.append(button);
    f.drag({ x: 325, y: 244 }, { x: 365, y: 224 }, button);
    await settle();
    expect(f.onMove).toHaveBeenCalledTimes(1);
  });

  it('disposes model listeners, active pointers, pending paint and DOM without touching the native player', async () => {
    const f = await fixture('radiogem', { dragEmpty: 'view' });
    const oldMarkup = f.svg.innerHTML;
    f.fire('pointerdown', { x: 8, y: 8 });
    f.fire('pointermove', { x: 45, y: 8 });
    f.view.dispose();
    expect(f.captured.size).toBe(0);
    expect(f.view.getSvg()).toBeNull();
    expect(f.host.querySelector('.twisty-software3d')).toBeNull();
    expect(f.removePosition).toHaveBeenCalledTimes(1);
    expect(f.nativeScene.root.children).toHaveLength(0);
    f.player.alg = 'R';
    await paint();
    expect(f.svg.innerHTML).toBe(oldMarkup);
    expect(f.player.isConnected).toBe(false);
    expect(f.onMove).not.toHaveBeenCalled();
  });

  it('cleans an initialization failure before rejecting to the 2D fallback', async () => {
    const host = document.createElement('div');
    const get = vi.fn().mockRejectedValue(new Error('Invalid position'));
    await expect(attachNativePgSvgView(host, { experimentalModel: { legacyPosition: { get } } }, 'radiogem', {
      settings: () => undefined, depth: () => 'auto', enabled: () => true, current: () => true, label: 'Gem',
    })).rejects.toThrow('Invalid position');
    expect(host.childElementCount).toBe(0);
    expect(madeScene.root.children).toHaveLength(0);
    expect(frames.size).toBe(0);
  });
});
