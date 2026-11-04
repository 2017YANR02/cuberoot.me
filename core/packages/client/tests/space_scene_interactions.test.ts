import * as THREE from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SpaceScene } from '@/app/[lang]/space/space-scene';
import { INITIAL_LAYOUT } from '@/app/[lang]/space/space-state';

const visibility = { hidden: false };
let frames: FrameRequestCallback[];
beforeEach(() => {
  visibility.hidden = false; frames = [];
  vi.stubGlobal('document', visibility);
  vi.stubGlobal('PointerEvent', Event);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => frames.push(callback)));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const scene = Object.create(SpaceScene.prototype) as SpaceScene;
  const captured = new Set<number>();
  const canvas = {
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: vi.fn((id: number) => { captured.delete(id); scene.cancel(); }),
  };
  const render = vi.fn(() => scene['scheduleRender']());
  const callbacks = { place: vi.fn(), change: vi.fn(), select: vi.fn() };
  const transform = { dragging: false, enabled: true, reset: vi.fn(), pointerUp: vi.fn() };
  Object.assign(scene, {
    scene: new THREE.Scene(), renderer: { domElement: canvas }, composer: { render: vi.fn() },
    inViewport: true, frame: 0, navigation: 'orbit', room: null, city: null,
    surfaces: [], snap: false, touches: new Map(), walkKeys: new Map(),
    orbit: { enabled: true }, transform, callbacks, render,
    cast: vi.fn(), placementHit: vi.fn(),
  });
  return { scene, captured, canvas, render, callbacks, transform };
}

it('suspends offscreen frames and interrupted inputs, resuming only when both viewport and tab are visible', () => {
  const f = fixture();
  f.scene['walkKeys'].set('KeyW', 'forward');
  f.scene['touches'].set(7, {} as PointerEvent);
  Object.assign(f.scene, { consumedTouch: 7, walkTime: 100 });
  f.scene['scheduleRender'](); f.scene['scheduleRender'](); expect(frames).toHaveLength(1);
  Object.assign(f.scene, { inViewport: false }); f.scene['updateVisibility']();
  expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  expect(f.scene['frame']).toBe(0); expect(f.scene['walkTime']).toBe(0);
  expect(f.scene['touches'].size).toBe(0); expect(f.scene['walkKeys'].size).toBe(0);
  expect(f.scene['consumedTouch']).toBeNull();
  // Even a queued callback delivered after cancellation cannot draw offscreen.
  frames[0](16); f.scene['scheduleRender'](); expect(frames).toHaveLength(1);
  expect(f.scene['composer'].render).not.toHaveBeenCalled();
  visibility.hidden = true;
  Object.assign(f.scene, { inViewport: true }); f.scene['updateVisibility'](); expect(frames).toHaveLength(1);
  visibility.hidden = false; f.scene['updateVisibility'](); expect(frames).toHaveLength(2);
  Object.assign(f.scene, { contextLost: true }); frames[1](32);
  expect(f.scene['composer'].render).not.toHaveBeenCalled();
});

it('rolls back an interrupted drag once and safely releases capture without recording an edit', () => {
  const f = fixture(), original = INITIAL_LAYOUT.objects[0], entry = f.scene['create'](original);
  try {
    f.scene['apply'](entry, original);
    entry.root.position.set(15, 2, 10);
    f.captured.add(7);
    Object.assign(f.scene, {
      drag: { id: 7, entry, before: original, moved: true },
      press: { id: 7, x: 10, y: 10, blank: false },
    });
    f.scene.cancel();
    expect(entry.root.position.x).toBe(original.position[0]);
    expect(entry.root.position.z).toBe(original.position[1]);
    expect(entry.data).toBe(original);
    expect(f.canvas.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(7);
    expect(f.callbacks.change).not.toHaveBeenCalled(); expect(f.render).toHaveBeenCalledOnce();
    expect(f.scene['drag']).toBeNull(); expect(f.scene['press']).toBeNull();
    expect(f.scene['orbit'].enabled).toBe(true); expect(f.transform.enabled).toBe(true);
  } finally { f.scene['remove'](entry); }
});

it('cancels a transform gesture without committing its temporary rotation', () => {
  const f = fixture();
  f.transform.dragging = true;
  f.transform.reset.mockImplementation(() => f.scene.cancel());
  f.transform.pointerUp.mockImplementation(() => {
    f.transform.dragging = false;
    if (!f.scene['cancelling']) f.callbacks.change();
  });
  f.scene.cancel();
  expect(f.transform.reset).toHaveBeenCalledOnce(); expect(f.transform.pointerUp).toHaveBeenCalledOnce();
  expect(f.callbacks.change).not.toHaveBeenCalled(); expect(f.scene['cancelling']).toBe(false);
});

it('only places on the primary release of the pointer that started placement', () => {
  const f = fixture(), floor = new THREE.Mesh();
  f.captured.add(7);
  Object.assign(f.scene, { placing: true, press: { id: 7, x: 10, y: 20, blank: false }, surfaces: [floor] });
  f.scene['orbit'].enabled = false;
  f.transform.enabled = false;
  vi.mocked(f.scene['placementHit']).mockReturnValue({ object: floor, point: new THREE.Vector3(3, 0, 4), distance: 5 });
  const up = (pointerId: number, button = 0) => f.scene['up']({ pointerId, button, clientX: 10, clientY: 20, stopImmediatePropagation: vi.fn() } as unknown as PointerEvent);
  up(7, 2); up(8);
  expect(f.callbacks.place).not.toHaveBeenCalled(); expect(f.scene['press']?.id).toBe(7);
  expect(f.scene['orbit'].enabled).toBe(false); expect(f.transform.enabled).toBe(false);
  up(7);
  expect(f.callbacks.place).toHaveBeenCalledExactlyOnceWith([3, 4], 0, 1);
  expect(f.scene['press']).toBeNull(); expect(f.scene['orbit'].enabled).toBe(true);
  expect(f.canvas.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(7);
});
