// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import PlaybackPanel from '@cuberoot/timer-ui/reconstruct/PlaybackPanel';
import type { ReconTextLine } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { encodeGyroTrack } from '@cuberoot/shared/smart-cube/gyro-track';
import { notationQuaternion } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { reconstructedTrack, playbackIndexForRaw } from '@cuberoot/timer-ui/reconstruct/playback-track';
import { playbackMoveDurationTicks } from '@cuberoot/timer-ui/reconstruct/report-player';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import tweener from '@cuberoot/puzzle-render-core/engine/tweener';
import { planSimUpdate } from '@cuberoot/shared/timer/sim-log';
import { Quaternion, Vector3 } from 'three';

const sim = vi.hoisted(() => ({ quatRef: undefined as { current: { x: number; y: number; z: number; w: number } | null } | undefined }));

vi.mock('@cuberoot/timer-ui/SimCubeView', () => ({
  default: ({ moves, quatRef, pose, moveDurationTicks }: { moves: string[]; quatRef?: typeof sim.quatRef; pose?: string; moveDurationTicks?: number }) => {
    sim.quatRef = quatRef;
    return createElement('div', { 'data-moves': moves.join(' '), 'data-quat': !!quatRef, 'data-pose': pose, 'data-duration': moveDurationTicks });
  },
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
it.each(['y', "y'"])('uses displayed-frame %s even before range mapping is available', async turn => {
  await act(async () => root.render(createElement(PlaybackPanel, {
    event: '333', scramble: 'B', moves: [{ m: 'U', ts: 300 }], totalMs: 500, isZh: false,
    viewRotation: 'z2', rotations: [{ token: turn, tMs: 100 }],
  })));
  await vi.waitFor(() => expect(shown()).not.toBeNull());
  await click('Step forward');
  expect(shown()!.getAttribute('data-pose')).toBe('z2');
  const pose = sim.quatRef!.current!;
  // Pose is applied outside the already posed model: its current right/left
  // vector must rotate to front, regardless of which colour is on top.
  const direction = new Vector3(turn === 'y' ? 1 : -1, 0, 0)
    .applyQuaternion(new Quaternion(pose.x, pose.y, pose.z, pose.w));
  expect(direction.z).toBeCloseTo(1);
  expect(direction.x).toBeCloseTo(0);
});

it('keeps reconstructed rotations after commuting opposite faces reorder encoder ranges', async () => {
  const moves = ['U', 'D', 'R'].map((m, i) => ({ m, ts: [100, 120, 400][i] }));
  const mapped = [{ ...lines[0], fromIdx: 0, toIdx: 2, moves: ['D', 'U', 'y', 'R'], moveRanges: [
    { token: 'D', ts: 120, endTs: 120, startIdx: 1, endIdx: 1 },
    { token: 'U', ts: 100, endTs: 100, startIdx: 0, endIdx: 0 },
    { token: 'y', ts: 300, endTs: 300, startIdx: 2, endIdx: 1 },
    { token: 'R', ts: 400, endTs: 400, startIdx: 2, endIdx: 2 },
  ] }];
  await act(async () => root.render(createElement(PlaybackPanel, {
    event: '333', scramble: 'B U B2 D U L F', moves, totalMs: 500, isZh: false,
    lines: mapped, viewRotation: 'z2', rotations: [{ token: 'y', tMs: 300 }],
  })));
  await vi.waitFor(() => expect(shown()).not.toBeNull());
  expect(shown()!.getAttribute('data-quat')).toBe('false');
  await click('Step forward');
  await click('Step forward');
  await click('Step forward');
  expect(shown()!.getAttribute('data-moves')).toBe('B U B2 D U L F z2 D U y');
  const track = reconstructedTrack(mapped, moves)!;
  expect(track.map(move => move.rawAfter)).toEqual([2, 2, 2, 3]);
  expect(playbackIndexForRaw(track, 1, 120)).toBe(0);
  expect(playbackIndexForRaw(track, 2, 300)).toBe(3);
  expect(reconstructedTrack([{ ...mapped[0], moveRanges: [...mapped[0].moveRanges, mapped[0].moveRanges[0]] }], moves)).toBeNull();
});

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

it.each([false, true])('keeps observation and final pauses out of turn duration (reconstructed=%s)', async rebuilt => {
  const moves = ['R', 'U', 'F'].map((m, i) => ({ m, ts: [100, 150, 3150][i] }));
  const mapped = [{ ...lines[0], fromIdx: 0, toIdx: 2, moves: moves.map(move => move.m),
    moveRanges: moves.map((move, i) => ({ token: move.m, ts: move.ts, endTs: move.ts, startIdx: i, endIdx: i })),
  }];
  await act(async () => root.render(createElement(PlaybackPanel, {
    event: '333', scramble: 'B', moves, totalMs: 8000, isZh: false, lines: rebuilt ? mapped : undefined,
  })));
  await vi.waitFor(() => expect(shown()).not.toBeNull());
  await click('Step forward');
  expect(Number(shown()?.getAttribute('data-duration'))).toBe(3); // 50 ms gap.
  await click('Step forward');
  expect(Number(shown()?.getAttribute('data-duration'))).toBe(30); // Normal 500 ms, not 3 seconds.
  expect(container.querySelector('.reconstruct-playback-counter')?.textContent).toBe('0.15 / 8.00');
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === '2x')!.click());
  expect(Number(shown()?.getAttribute('data-duration'))).toBe(15);
  await click('Step forward');
  expect(Number(shown()?.getAttribute('data-duration'))).toBe(15); // Final put-down pause is capped too.
  expect(container.querySelector('.reconstruct-playback-counter')?.textContent).toBe('3.15 / 8.00');
});

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

it('replays simplified library steps in their inspection frame, retaining raw gyro playback', async () => {
  const original = { ...lines[0], moves: raw.map(move => move.m),
    moveRanges: raw.map((move, i) => ({ token: move.m, ts: move.ts, endTs: move.ts, startIdx: i, endIdx: i })) };
  const corrected = { ...lines[0], libraryCorrection: { algorithm: lines[0].moves.join(' '),
    originalMoves: original.moves, originalRanges: original.moveRanges, originalLine: original } };
  await act(async () => root.render(createElement(PlaybackPanel, {
    event: '333', scramble: 'B', moves: raw, totalMs: 500, isZh: false,
    lines: [corrected], viewRotation: 'z2', inspection: 'y', gyro,
  })));
  await vi.waitFor(() => expect(shown()).not.toBeNull());
  expect(shown()?.getAttribute('data-moves')).toBe('B y');
  await click('Step forward');
  expect(shown()?.getAttribute('data-moves')).toBe("B y M'");
  await click('Gyro');
  // Switching modes retains the 100 ms playhead; the second encoder event
  // belonging to M' arrives at 120 ms in the original gyro recording.
  expect(shown()?.getAttribute('data-moves')).toBe('B R');
  await click('Gyro');
  expect(shown()?.getAttribute('data-moves')).toBe("B y M'");
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

it('gives a synthesized rotation and its simultaneous turn separate animation time', () => {
  const recorded = [{ m: 'R', ts: 100 }, { m: 'U', ts: 300 }];
  const mapped = [{ ...lines[0], moves: ['y', 'R', 'U'], moveRanges: [
    { token: 'y', ts: 100, endTs: 100, startIdx: 0, endIdx: -1 },
    { token: 'R', ts: 100, endTs: 100, startIdx: 0, endIdx: 0 },
    { token: 'U', ts: 300, endTs: 300, startIdx: 1, endIdx: 1 },
  ] }];
  const track = reconstructedTrack(mapped, recorded)!;
  expect(track.map(move => move.ts)).toEqual([100, 200, 300]);
  expect(track.map(move => move.rawAfter)).toEqual([0, 1, 2]);
  expect(playbackMoveDurationTicks(track, 1, 300, 1)).toBe(6);
  expect(playbackMoveDurationTicks(track, 2, 300, 1)).toBe(6);
});

it.each([2, 4])('fits %i replacement moves into the original interval including the final animation', count => {
  const raw = ['R', 'U', "R'", "U'"].map((m, i) => ({ m, ts: 100 + i * 100 }));
  const moves = Array.from({ length: count }, (_, i) => i % 2 ? 'U2' : 'R');
  const mapped = [{ ...lines[0], moves, moveRanges: moves.map((token, i) => ({
    token, ts: 100, endTs: 400, startIdx: 0, endIdx: i === count - 1 ? 3 : -1,
  })) }];
  const before = structuredClone(mapped);
  const track = reconstructedTrack(mapped, raw)!;
  expect(track.map(move => move.ts)).toEqual(moves.map((_, i) => 100 + 300 * i / count));
  expect(track.at(-1)!.endTs).toBe(400);
  expect(track.at(-1)!.rawAfter).toBe(raw.length);
  for (const speed of [0.5, 1, 2]) for (let i = 0; i < count; i++) {
    const durationMs = playbackMoveDurationTicks(track, i + 1, 5000, speed)! * 1000 / 60;
    expect(durationMs).toBeCloseTo(300 / count / speed);
    expect(track[i].ts + durationMs * speed).toBeCloseTo(track[i].endTs);
  }
  expect(mapped).toEqual(before);
});
