// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SimCubeView from '@cuberoot/timer-ui/SimCubeView';
import LiveCubeState from '@cuberoot/timer-ui/LiveCubeState';

const state = vi.hoisted(() => ({ mount: vi.fn(), dispose: vi.fn(), setup: vi.fn() }));
vi.mock('@cuberoot/puzzle-render-core/sim/mountSimWorld', () => ({ mountSimWorld: state.mount }));
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  state.mount.mockReset();
  state.mount.mockImplementation(({ host }: { host: HTMLElement }) => {
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    return { dispose: () => { state.dispose(); canvas.remove(); }, invalidate() {}, world: {
    puzzleKind: 3,
    scene: { rotation: { set() {} }, updateMatrix() {} },
    cube: { twister: { setup: state.setup, backlog: 0 }, instancedRenderer: { setStickering() {} } },
    } };
  });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); vi.unstubAllGlobals();
});

describe('the single live/replay 3D failure surface', () => {
  it('shows a failure without claiming to draw a cube, then retries the current move log', async () => {
    state.mount.mockImplementationOnce(() => { throw new Error('WebGL unavailable'); });
    await act(async () => root.render(createElement(SimCubeView, { moves: ['R'], language: 'en' })));
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Could not load the 3D view.');
    expect(host.querySelector('[role="img"]')).toBeNull();
    await act(async () => root.render(createElement(SimCubeView, { moves: ['R', 'U'], language: 'en' })));
    expect(host.querySelector('button')?.textContent).toBe('Retry');
    await act(async () => host.querySelector('button')!.click());
    expect(state.mount).toHaveBeenCalledTimes(2);
    expect(state.setup).toHaveBeenLastCalledWith('R U');
    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(host.querySelector('[role="img"]')).not.toBeNull();
    expect(host.querySelector('canvas')).not.toBeNull();
    await act(async () => root.render(null));
    expect(state.dispose).toHaveBeenCalledTimes(1);
  });

  it('passes the live view language to the shared failure and retry controls', async () => {
    state.mount.mockImplementation(() => { throw new Error('WebGL unavailable'); });
    await act(async () => root.render(createElement(LiveCubeState, {
      moves: [], facelets: null, algAnchored: true, mode: '3d', language: 'zh',
    })));
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(host.querySelector('[role="status"]')?.textContent).toBe('三维视图加载失败。');
    });
    expect(host.querySelector('button')?.textContent).toBe('重试');
  });

  it('does not initialize a view whose lazy mount was canceled on unmount', async () => {
    act(() => root.render(createElement(SimCubeView, { moves: ['R'] })));
    act(() => root.render(null));
    await act(async () => undefined);
    expect(state.mount).not.toHaveBeenCalled();
    expect(host.textContent).toBe('');
  });
});
