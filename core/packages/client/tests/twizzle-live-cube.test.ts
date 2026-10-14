// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TwistyPlayer } from 'cubing/twisty';
import LiveCubeState from '@cuberoot/timer-ui/LiveCubeState';
import { LiveSmartCubeAnchor } from '@cuberoot/shared/smart-cube/anchor';
import { cubeMove, SOLVED_3X3 } from '@cuberoot/puzzle-solvers/timer-333-cube';

const probe = vi.hoisted(() => ({ mount: vi.fn(), dispose: vi.fn(), quaternion: vi.fn() }));
vi.mock('@cuberoot/timer-ui/mount-twisty-player', () => ({ mountTwistyPlayer: probe.mount }));
let host: HTMLDivElement, root: Root;
let players: TwistyPlayer[];
let frames: FrameRequestCallback[];
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  probe.mount.mockReset(); probe.dispose.mockClear(); probe.quaternion.mockClear(); players = [];
  probe.mount.mockImplementation(async (container, config) => {
    // Real cubing.js state/append semantics, with only WebGL replaced.
    const player = new TwistyPlayer(config); players.push(player);
    const shell = document.createElement('div'); container.append(shell);
    Object.defineProperty(player, 'isConnected', { get: () => shell.isConnected });
    player.experimentalCurrentThreeJSPuzzleObject = vi.fn().mockResolvedValue({
      quaternion: { set: probe.quaternion }, updateMatrix() {},
    });
    player.experimentalCurrentVantages = vi.fn().mockResolvedValue([]);
    return { player, dispose: () => { probe.dispose(); player.pause(); shell.remove(); } };
  });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  for (const player of players) player.pause();
  vi.unstubAllGlobals();
});

async function expectState(alg: string, player = players.at(-1)!) {
  await vi.waitFor(async () => {
    const model = player.experimentalModel;
    const kpuzzle = await model.kpuzzle.get();
    const setup = (await model.setupAlg.get()).alg;
    const turns = (await model.alg.get()).alg;
    expect(kpuzzle.defaultPattern().applyAlg(setup).applyAlg(turns)
      .isIdentical(kpuzzle.defaultPattern().applyAlg(alg))).toBe(true);
  });
}

it('keeps every burst turn, solved boundary and reconnect in one player without parent renders', async () => {
  const anchor = new LiveSmartCubeAnchor({ solve: async () => 'F', onChange() {} });
  anchor.setConnection('cube'); anchor.observeFacelets(SOLVED_3X3);
  await act(async () => root.render(createElement(LiveCubeState, {
    mode: 'twizzle', facelets: null, moves: [], algAnchored: true, liveSource: anchor,
  })));
  await vi.waitFor(() => expect(probe.mount).toHaveBeenCalledOnce());
  anchor.move('R'); anchor.move("R'"); anchor.move('U');
  await expectState('U');
  expect((await players[0].experimentalModel.alg.get()).alg.toString()).toBe('U');
  anchor.move("U'");
  const turns = Array.from({ length: 80 }, (_, i) => ['R', 'U', "R'", "U'"][i % 4]);
  for (const move of turns) anchor.move(move, 100);
  await expectState(turns.join(' '));
  // Resync immediately after a pending append must win over the old sequence.
  anchor.move('D'); anchor.observeFacelets(cubeMove(SOLVED_3X3, 'F'));
  anchor.move('L');
  await expectState('F L');
  expect(probe.mount).toHaveBeenCalledOnce();
  await act(async () => root.render(createElement(LiveCubeState, {
    mode: 'net', facelets: SOLVED_3X3, moves: [], algAnchored: true, liveSource: anchor,
  })));
  const before = (await players[0].experimentalModel.alg.get()).alg.toString();
  anchor.move('B');
  expect((await players[0].experimentalModel.alg.get()).alg.toString()).toBe(before);
  expect(probe.dispose).toHaveBeenCalled();
  await act(async () => root.render(createElement(LiveCubeState, {
    mode: 'twizzle', facelets: null, moves: anchor.getSnapshot().moves,
    algAnchored: true, liveSource: anchor,
  })));
  await vi.waitFor(() => expect(probe.mount).toHaveBeenCalledTimes(2));
  await expectState('F L B');
});

it('retains a fixed grip and applies calibration without changing logical moves', async () => {
  const reference = { w: 1, x: 0, y: 0, z: 0 };
  const quatRef = { current: reference };
  const render = (calibrateToken: number, moves = ['R']) => act(async () => root.render(createElement(LiveCubeState, {
    mode: 'twizzle', facelets: null, moves, algAnchored: true, displayOrientation: 'z2',
    sensorBasis: 'identity', mirror: false, quatRef, calibrateToken, calibrationReference: reference,
  })));
  await render(0);
  await vi.waitFor(() => expect(probe.mount).toHaveBeenCalledOnce());
  await expectState('R z2');
  await render(1);
  quatRef.current = { w: Math.SQRT1_2, x: 0, y: Math.SQRT1_2, z: 0 };
  await vi.waitFor(() => {
    for (const callback of frames.splice(0)) callback(performance.now());
    expect(probe.quaternion).toHaveBeenCalled();
  });
  const [, y, , w] = probe.quaternion.mock.calls.at(-1)!;
  expect(y).toBeCloseTo(-Math.SQRT1_2); expect(w).toBeCloseTo(Math.SQRT1_2);
  await render(1, ['R', 'U']);
  await expectState('R U z2');
  expect(probe.mount).toHaveBeenCalledOnce();
});

it('reports load failure and retries instead of silently falling back to another engine', async () => {
  probe.mount.mockRejectedValueOnce(new Error('WebGL unavailable'));
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  await act(async () => root.render(createElement(LiveCubeState, {
    mode: 'twizzle', language: 'zh', facelets: null, moves: ['U'], algAnchored: true,
  })));
  await vi.waitFor(() => expect(host.textContent).toContain('Twizzle 加载失败'));
  await act(async () => host.querySelector('button')!.click());
  await expectState('U');
  expect(host.textContent).not.toContain('Twizzle 加载失败');
  warn.mockRestore();
});
