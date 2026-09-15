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
    cube: { quaternion: { set() {} }, updateMatrix() {}, twister: { setup: state.setup, backlog: 0 }, instancedRenderer: { setStickering() {} } },
    } };
  });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); vi.unstubAllGlobals();
});

describe('the single live/replay 3D failure surface', () => {
  it('uses the elevated three-face view without gyro and switches on the first valid sample', async () => {
    const quatRef: { current: { w: number; x: number; y: number; z: number } | null } = { current: null };
    await act(async () => root.render(createElement(LiveCubeState, {
      mode: '3d', algAnchored: true, moves: [], facelets: null, quatRef,
    })));
    await vi.waitFor(() => expect(state.mount).toHaveBeenCalledOnce());
    const options = state.mount.mock.calls[0][0];
    expect(options.sceneRot).toEqual({ x: Math.atan2(4.1, Math.hypot(4.8, 7.2)), y: -Math.atan2(4.8, 7.2), z: 0 });
    const world = state.mount.mock.results[0].value.world;
    const rotate = vi.spyOn(world.scene.rotation, 'set');
    quatRef.current = { w: 0, x: 0, y: 0, z: 0 };
    expect(options.onFrame(world, 16)).toBe(false);
    expect(rotate).not.toHaveBeenCalled();
    quatRef.current = { w: 1, x: 0, y: 0, z: 0 };
    options.onFrame(world, 16);
    expect(rotate).toHaveBeenCalledWith(Math.atan2(4.1, 7.2), 0, 0);
    expect(state.mount).toHaveBeenCalledOnce();
    rotate.mockClear();
    quatRef.current = null;
    options.onFrame(world, 16);
    expect(rotate).not.toHaveBeenCalled();
  });

  it('starts with the elevated front view when a gyro sample is already available', async () => {
    await act(async () => root.render(createElement(SimCubeView, {
      view: 'smart', moves: [], quat: { w: 1, x: 0, y: 0, z: 0 },
    })));
    expect(state.mount.mock.calls[0][0].sceneRot).toEqual({ x: Math.atan2(4.1, 7.2), y: 0, z: 0 });
  });
  it('retains its 3D instance while an authoritative state is being re-anchored', async () => {
    const draw = (algAnchored: boolean, moves: string[]) => act(async () => root.render(createElement(LiveCubeState, {
      mode: '3d', algAnchored, moves, facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
    })));
    await draw(true, ['R']);
    await vi.waitFor(() => expect(host.querySelector('canvas')).not.toBeNull());
    const canvas = host.querySelector('canvas');
    await draw(false, []);
    expect(host.querySelector('canvas')).toBe(canvas);
    expect(state.dispose).not.toHaveBeenCalled();
    expect(state.setup).toHaveBeenLastCalledWith('R');
    await draw(true, ['F', 'U']);
    expect(host.querySelector('canvas')).toBe(canvas);
    expect(state.mount).toHaveBeenCalledOnce();
    expect(state.setup).toHaveBeenLastCalledWith('F U');
  });

  it('waits for the first verified 3D state without flashing a flat preview', async () => {
    await act(async () => root.render(createElement(LiveCubeState, {
      mode: '3d', algAnchored: false, moves: [],
      facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
    })));
    expect(host.querySelector('svg')).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Syncing cube state…');
    expect(state.mount).not.toHaveBeenCalled();
  });
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
