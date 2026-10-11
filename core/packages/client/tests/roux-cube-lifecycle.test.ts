// @vitest-environment jsdom
import React, { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CubeSim from '@/app/[lang]/alg/_roux/_components/CubeSim';
import { Face } from '@/lib/roux/Defs';

const resources = vi.hoisted(() => ({
  renderers: [] as { dispose: ReturnType<typeof vi.fn> }[],
  controls: [] as { dispose: ReturnType<typeof vi.fn> }[],
  geometries: new Set<object>(),
  materials: new Set<object>(),
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement('canvas');
      dispose = vi.fn();
      constructor() { resources.renderers.push(this); }
      setSize() {}
      setClearColor() {}
      setPixelRatio() {}
      render() {}
    },
    BufferGeometry: class extends actual.BufferGeometry {
      constructor() {
        super();
        resources.geometries.add(this);
        this.addEventListener('dispose', () => resources.geometries.delete(this));
      }
    },
    PlaneGeometry: class extends actual.PlaneGeometry {
      constructor(...args: ConstructorParameters<typeof actual.PlaneGeometry>) {
        super(...args);
        resources.geometries.add(this);
        this.addEventListener('dispose', () => resources.geometries.delete(this));
      }
    },
    MeshBasicMaterial: class extends actual.MeshBasicMaterial {
      constructor(...args: ConstructorParameters<typeof actual.MeshBasicMaterial>) {
        super(...args);
        resources.materials.add(this);
        this.addEventListener('dispose', () => resources.materials.delete(this));
      }
    },
  };
});

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    enabled = true;
    dispose = vi.fn();
    constructor() { resources.controls.push(this); }
    update() {}
  },
}));

const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
let root: Root | null = null;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  resources.renderers.length = 0;
  resources.controls.length = 0;
  resources.geometries.clear();
  resources.materials.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
  frames.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const cube = [Face.U, Face.D, Face.F, Face.B, Face.L, Face.R].map(face => Array<Face>(9).fill(face));
const colors = ['white', 'yellow', 'green', 'blue', 'orange', 'red', 'gray'];
const view = (width = 200) => React.createElement(CubeSim, {
  cube, width, height: 200, colorScheme: colors, facesToReveal: [], theme: 'dark',
});

function expectReleased() {
  expect(frames.size).toBe(0);
  expect(resources.geometries.size).toBe(0);
  expect(resources.materials.size).toBe(0);
  for (const renderer of resources.renderers) expect(renderer.dispose).toHaveBeenCalledOnce();
  for (const controls of resources.controls) expect(controls.dispose).toHaveBeenCalledOnce();
}

it('releases loops, canvas and all GPU resources across StrictMode remounts and configuration changes', () => {
  act(() => root!.render(React.createElement(StrictMode, null, view())));
  expect(frames.size).toBe(1);
  expect(host.querySelectorAll('canvas')).toHaveLength(1);
  expect(resources.renderers).toHaveLength(2);
  expect(resources.renderers[0].dispose).toHaveBeenCalledOnce();

  // Same-view rerenders retain the renderer and release old sticker resources.
  const geometryCount = resources.geometries.size;
  const materialCount = resources.materials.size;
  act(() => root!.render(React.createElement(StrictMode, null, view())));
  expect(resources.renderers).toHaveLength(2);
  expect(resources.geometries.size).toBe(geometryCount);
  expect(resources.materials.size).toBe(materialCount);

  act(() => root!.render(React.createElement(StrictMode, null, view(250))));
  expect(resources.renderers).toHaveLength(3);
  expect(frames.size).toBe(1);
  expect(host.querySelectorAll('canvas')).toHaveLength(1);
  act(() => root!.unmount());
  root = null;
  expect(host.querySelectorAll('canvas')).toHaveLength(0);
  expectReleased();
});

it('removes both keyboard listeners when returning from Roux to another trainer', () => {
  const added = vi.spyOn(window, 'addEventListener');
  const removed = vi.spyOn(window, 'removeEventListener');
  act(() => root!.render(view()));
  act(() => root!.render(view()));
  for (const event of ['keydown', 'keyup']) {
    expect(added.mock.calls.filter(([name]) => name === event)).toHaveLength(1);
  }
  act(() => root!.render(null));
  const keyboardRegistrations = added.mock.calls.filter(([name]) => ['keydown', 'keyup'].includes(name));
  for (const [name, listener] of keyboardRegistrations) {
    expect(removed).toHaveBeenCalledWith(name, listener);
  }
  expectReleased();

  act(() => root!.render(view()));
  expect(frames.size).toBe(1);
  act(() => root!.render(null));
  expectReleased();
});
