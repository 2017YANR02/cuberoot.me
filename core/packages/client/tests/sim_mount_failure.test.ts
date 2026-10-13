// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type World from '@cuberoot/puzzle-render-core/engine/world';
import { mountSimWorld } from '@cuberoot/puzzle-render-core/sim/mountSimWorld';
import tweener from '@cuberoot/puzzle-render-core/engine/tweener';

const state = vi.hoisted(() => ({ failRenderer: false, failObserve: false,
  rendererDispose: vi.fn(), loseContext: vi.fn(), disconnectObserver: vi.fn() }));
vi.mock('three', async (original) => ({
  ...await original<typeof import('three')>(),
  WebGLRenderer: class {
    domElement = document.createElement('canvas');
    constructor() { if (state.failRenderer) throw new Error('WebGL unavailable'); }
    setClearColor() {} setPixelRatio() {} setSize() {}
    clear() {} render() {}
    dispose = state.rendererDispose;
    forceContextLoss = state.loseContext;
  },
}));

beforeEach(() => {
  state.failRenderer = false; state.failObserve = false;
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class {
    observe() { if (state.failObserve) throw new Error('observer setup failed'); }
    disconnect = state.disconnectObserver;
  });
  vi.stubGlobal('matchMedia', () => ({ addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

it('reads theme styles only on invalidation or puzzle replacement', async () => {
  const readStyle = vi.fn(() => ({ getPropertyValue: () => 'rgb(255, 255, 255)' }));
  vi.stubGlobal('getComputedStyle', readStyle);
  const fixture = scene();
  const mount = mountSimWorld(fixture);
  try {
    mount.invalidate(); tweener.loop(10);
    expect(readStyle).toHaveBeenCalledTimes(1);
    mount.invalidate(); tweener.loop(20);
    expect(readStyle).toHaveBeenCalledTimes(1);
    fixture.host.className = 'another-theme';
    await Promise.resolve();
    tweener.loop(30);
    expect(readStyle).toHaveBeenCalledTimes(2);
    const renderer = { setHintBackdrop: vi.fn() };
    Object.assign(mount.world.cube, { instancedRenderer: renderer });
    mount.invalidate(); tweener.loop(40);
    expect(readStyle).toHaveBeenCalledTimes(3);
    expect(renderer.setHintBackdrop).toHaveBeenCalledWith('rgb(255, 255, 255)');
  } finally { mount.dispose(); }
});
afterEach(() => vi.unstubAllGlobals());

function scene() {
  const dispose = vi.fn();
  const world = { cube: { dispose }, faceHints: { hide() {} }, resize() {}, puzzleKind: 3 };
  const host = document.createElement('div');
  return { host, dispose, createWorld: () => world as unknown as World };
}

describe('shared renderer acquisition and release', () => {
  it('releases the existing puzzle when WebGL initialization throws', () => {
    state.failRenderer = true;
    const fixture = scene();
    expect(() => mountSimWorld(fixture)).toThrow('WebGL unavailable');
    expect(fixture.dispose).toHaveBeenCalledTimes(1);
    expect(fixture.host.querySelector('canvas')).toBeNull();
  });

  it('releases an acquired canvas, renderer and observer after partial mount failure', () => {
    state.failObserve = true;
    const fixture = scene();
    expect(() => mountSimWorld(fixture)).toThrow('observer setup failed');
    expect(fixture.dispose).toHaveBeenCalledTimes(1);
    expect(state.rendererDispose).toHaveBeenCalledTimes(1);
    expect(state.loseContext).toHaveBeenCalledTimes(1);
    expect(state.disconnectObserver).toHaveBeenCalledTimes(1);
    expect(fixture.host.querySelector('canvas')).toBeNull();
  });

  it('uses the same idempotent release path for a successful mount', () => {
    const fixture = scene();
    const mount = mountSimWorld(fixture);
    expect(fixture.host.querySelector('canvas')).not.toBeNull();
    mount.dispose(); mount.dispose();
    expect(fixture.dispose).toHaveBeenCalledTimes(1);
    expect(state.rendererDispose).toHaveBeenCalledTimes(1);
    expect(state.loseContext).toHaveBeenCalledTimes(1);
    expect(state.disconnectObserver).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(fixture.host.querySelector('canvas')).toBeNull();
  });

  it('still releases the puzzle and context when renderer disposal itself throws', () => {
    const fixture = scene();
    const mount = mountSimWorld(fixture);
    state.rendererDispose.mockImplementationOnce(() => { throw new Error('lost context'); });
    expect(() => mount.dispose()).not.toThrow();
    expect(fixture.dispose).toHaveBeenCalledTimes(1);
    expect(state.loseContext).toHaveBeenCalledTimes(1);
    expect(fixture.host.querySelector('canvas')).toBeNull();
  });
});
