// @vitest-environment jsdom
import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import ReconPlayerBase, { type ReconPlayerHandle, type ReconPlayerAdapter } from '@/components/recon/ReconPlayerBase';
vi.mock('@cuberoot/puzzle-render-core/sim/mountSimWorld', () => ({
  mountSimWorld: () => ({ world: {}, renderer: { domElement: document.createElement('canvas') }, invalidate() {}, dispose() {} }),
}));
vi.mock('@cuberoot/timer-ui/recon/orbitTapGesture', () => ({ attachOrbitTap: () => () => {} }));
vi.mock('@cuberoot/puzzle-render-core/support/three', () => ({}));
vi.mock('@cuberoot/puzzle-render-core/engine/define', () => ({ SIZE: 1 }));
vi.mock('@cuberoot/puzzle-render-core/engine/backView', () => ({}));
it.each([false, true])('keeps text seeks paused until explicit Play (overlay=%s)', async hideControls => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const playerRef = createRef<ReconPlayerHandle>();
  const applyPrefix = vi.fn((_world, _scramble, _moves, n: number) => n);
  const pushMove = vi.fn(() => true);
  const adapter: ReconPlayerAdapter<string> = {
    kind: 'nxn-cuber', backView: false, faceHints: false,
    parseMoves: alg => alg.split(' '), setupPuzzle() {}, applyPrefix, pushMove,
  };
  try {
    await act(async () => root.render(createElement(ReconPlayerBase, {
      scramble: '', alg: 'R U F L D', adapter, playerRef, hideControls,
    })));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    vi.useFakeTimers();
    await act(async () => playerRef.current!.jumpToMoveCount(1, true));
    await act(async () => vi.advanceTimersByTime(520));
    expect(pushMove).toHaveBeenLastCalledWith(expect.anything(), 'U');
    const pause = Array.from(host.querySelectorAll('button')).find(button =>
      /pause|暂停/i.test(`${button.title} ${button.getAttribute('aria-label')}`));
    expect(pause).toBeDefined();
    await act(async () => pause!.click());
    pushMove.mockClear();
    await act(async () => playerRef.current!.jumpToMoveCount(3, true));
    expect(applyPrefix).toHaveBeenLastCalledWith(expect.anything(), '', ['R', 'U', 'F', 'L', 'D'], 3);
    await act(async () => vi.advanceTimersByTime(2000));
    expect(pushMove).not.toHaveBeenCalled();
    await act(async () => playerRef.current!.play());
    await act(async () => vi.advanceTimersByTime(520));
    expect(pushMove).toHaveBeenLastCalledWith(expect.anything(), 'L');
    pushMove.mockClear();
    await act(async () => playerRef.current!.jumpToMoveCount(0, true));
    await act(async () => vi.advanceTimersByTime(520));
    expect(pushMove).toHaveBeenLastCalledWith(expect.anything(), 'R');
  } finally {
    await act(async () => root.unmount()); host.remove();
    vi.useRealTimers(); vi.unstubAllGlobals();
  }
});
