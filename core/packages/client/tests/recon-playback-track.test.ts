// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import PlaybackPanel from '@cuberoot/timer-ui/reconstruct/PlaybackPanel';
import type { ReconTextLine } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { encodeGyroTrack } from '@cuberoot/shared/smart-cube/gyro-track';
import { notationQuaternion } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { reconstructedTrack, playbackIndexForRaw } from '../../timer-ui/src/reconstruct/playback-track';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import tweener from '@cuberoot/puzzle-render-core/engine/tweener';
import { planSimUpdate } from '@cuberoot/shared/timer/sim-log';

vi.mock('@cuberoot/timer-ui/SimCubeView', () => ({
  default: ({ moves, quatRef, pose, moveDurationTicks }: { moves: string[]; quatRef?: unknown; pose?: string; moveDurationTicks?: number }) =>
    createElement('div', { 'data-moves': moves.join(' '), 'data-quat': !!quatRef, 'data-pose': pose, 'data-duration': moveDurationTicks }),
}));

const raw = ['R', "L'", 'U', 'F'].map((m, i) => ({ m, ts: [100, 120, 300, 400][i] }));
const lines: ReconTextLine[] = [{
  key: 'lse', kind: 'pll', fromIdx: 0, toIdx: 3, label: 'LSE',
  moves: ["M'", 'y', 'u', 'F'], recognitionMs: 0, executionMs: 300, stepMs: 300,
  moveRanges: [
    { token: "M'", ts: 100, endTs: 120, startIdx: 0, endIdx: 1 },
    { token: 'y', ts: 200, endTs: 200, startIdx: 2, endIdx: 1 },
    { token: 'u', ts: 300, endTs: 310, startIdx: 2, endIdx: 2 },
    { token: 'F', ts: 400, endTs: 400, startIdx: 3, endIdx: 3 },
  ],
}];
const gyro = encodeGyroTrack([{ tMs: 0, q: notationQuaternion('') }, { tMs: 400, q: notationQuaternion('y') }], 'scramble');
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});
async function click(label: string) {
  const button = container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  expect(button).not.toBeNull();
  await act(async () => button.click());
}
function shown() { return container.querySelector('[data-moves]'); }
it.each(['', 'z2'].flatMap(grip => ['y', "y'"].map(turn => ({ grip, turn }))))(
  'rotates $turn relative to the displayed grip ($grip), in both animation and seek', async ({ grip, turn }) => {
    const moves = [{ m: 'U', ts: 300 }];
    const mapped = [{ ...lines[0], fromIdx: 0, toIdx: 0, moves: [turn, 'U'], moveRanges: [
      { token: turn, ts: 100, endTs: 100, startIdx: 0, endIdx: -1 },
      { token: 'U', ts: 300, endTs: 300, startIdx: 0, endIdx: 0 },
    ] }];
    await act(async () => root.render(createElement(PlaybackPanel, {
      event: '333', scramble: 'B', moves, totalMs: 500, isZh: false, lines: mapped, viewRotation: grip,
    })));
    await vi.waitFor(() => expect(shown()).not.toBeNull());
    const before = { turns: shown()!.getAttribute('data-moves')!, pose: shown()!.getAttribute('data-pose')! };
    const cube = new Cube(3);
    try {
      cube.twister.setup(`${before.turns} ${before.pose}`);
      const start = cube.serialize();
      await click('Step forward');
      const after = { turns: shown()!.getAttribute('data-moves')!, pose: shown()!.getAttribute('data-pose')! };
      const plan = planSimUpdate(before, after, true);
      expect(plan.mode).toBe('push');
      expect(shown()!.getAttribute('data-quat')).toBe('false');
      cube.twister.push(plan.exp);
      cube.twister.finish();
      const end = cube.serialize();
      // y brings the current right face to front; y' brings the current left.
      expect(end[22]).toBe(start[turn === 'y' ? 13 : 40]);
      expect(end[4]).toBe(start[4]);
      expect(end[31]).toBe(start[31]);
      cube.twister.setup(`${after.turns} ${after.pose}`);
      expect(cube.serialize()).toBe(end);
    } finally {
      tweener.finish();
      cube.dispose();
    }
  },
);

async function mount(withLines = true) {
  await act(async () => root.render(createElement(PlaybackPanel, {
    event: '333', method: 'roux', scramble: 'B', moves: raw, totalMs: 500, isZh: false,
    lines: withLines ? lines : undefined, viewRotation: 'z2', gyro,
    side: ({ idx, playFrom, seek }) => createElement('div', { 'data-raw-index': idx },
      createElement('button', { onClick: () => seek(1) }, 'inside slice'),
      createElement('button', { onClick: () => playFrom(2, 200) }, 'after rotation')),
  })));
  await vi.waitFor(() => expect(shown()).not.toBeNull());
}

it('steps complete reconstructed gestures and rotations, and switches to raw moves with gyro', async () => {
  await mount();
  expect(shown()?.getAttribute('data-moves')).toBe('B z2');
  expect(shown()?.getAttribute('data-quat')).toBe('false');
  await click('Step forward');
  expect(shown()?.getAttribute('data-moves')).toBe("B z2 M'");
  expect(container.querySelector('[data-raw-index]')?.getAttribute('data-raw-index')).toBe('2');
  await click('Step forward');
  expect(shown()?.getAttribute('data-moves')).toBe("B z2 M' y");
  await click('Gyro');
  expect(shown()?.getAttribute('data-moves')).toBe("B R L'");
  expect(shown()?.getAttribute('data-quat')).toBe('true');
  expect(shown()?.getAttribute('data-pose')).toBe('');
  await click('Gyro');
  expect(shown()?.getAttribute('data-moves')).toBe("B z2 M' y");
  await click('Step back');
  expect(shown()?.getAttribute('data-moves')).toBe("B z2 M'");
  await click('To end');
  expect(shown()?.getAttribute('data-moves')).toBe("B z2 M' y u F");
  await click('To start');
  expect(shown()?.getAttribute('data-moves')).toBe('B z2');
});

it('snaps raw seeks before an incomplete merged gesture and keeps rotation click time', async () => {
  await mount();
  await click('To end');
  const inside = [...container.querySelectorAll('button')].find(button => button.textContent === 'inside slice')!;
  await act(async () => inside.click());
  expect(shown()?.getAttribute('data-moves')).toBe('B z2');
  const after = [...container.querySelectorAll('button')].find(button => button.textContent === 'after rotation')!;
  await act(async () => after.click());
  expect(shown()?.getAttribute('data-moves')).toBe("B z2 M' y");
  expect(container.querySelector('.reconstruct-playback-counter')?.textContent).toBe('0.20 / 0.50');
});

it('falls back to the original stream until a complete reconstruction map exists', async () => {
  expect(reconstructedTrack([{ ...lines[0], moveRanges: undefined }], raw)).toBeNull();
  expect(reconstructedTrack([{ ...lines[0], moveRanges: lines[0].moveRanges!.slice(0, 2) }], raw)).toBeNull();
  await mount(false);
  await click('Step forward');
  expect(shown()?.getAttribute('data-moves')).toBe('B R');
});

it('plays on recorded timestamps and preserves time when toggling gyro while running', async () => {
  let now = 0;
  let nextId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextId, callback); return nextId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const advance = async (ms: number) => {
    now = ms;
    await act(async () => {
      const pending = [...frames.values()]; frames.clear();
      pending.forEach(callback => callback(ms));
    });
  };
  await mount();
  await click('Play');
  await advance(110);
  expect(shown()?.getAttribute('data-moves')).toBe("B z2 M'");
  await advance(210);
  expect(shown()?.getAttribute('data-moves')).toBe("B z2 M' y");
  await click('Gyro');
  expect(shown()?.getAttribute('data-moves')).toBe("B R L'");
  await advance(310);
  expect(shown()?.getAttribute('data-moves')).toBe("B R L' U");
  await click('Gyro');
  expect(shown()?.getAttribute('data-moves')).toBe("B z2 M' y u");
  await advance(500);
  expect(shown()?.getAttribute('data-moves')).toBe("B z2 M' y u F");
  expect(container.querySelector('[aria-label="Replay"]')).not.toBeNull();
});

it('maps pure rotations without consuming encoder events and keeps waste tokens', () => {
  const track = reconstructedTrack(lines, raw)!;
  expect(track.map(move => move.rawAfter)).toEqual([2, 2, 3, 4]);
  expect(playbackIndexForRaw(track, 1, 100)).toBe(0);
  expect(playbackIndexForRaw(track, 2, 120)).toBe(1);
  expect(playbackIndexForRaw(track, 2, 200)).toBe(2);
  const waste = [{ ...lines[0], moves: ['(R', "R')"], moveRanges: [
    { token: 'R', ts: 100, endTs: 100, startIdx: 0, endIdx: 0 },
    { token: "R'", ts: 120, endTs: 120, startIdx: 1, endIdx: 1 },
  ] }];
  expect(reconstructedTrack(waste, raw.slice(0, 2))!.map(move => move.m)).toEqual(['R', "R'"]);
});
