// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useTimer, type TimerHandle } from '@/app/[lang]/timer/_shared/useTimer';
import { cameraTimerMoves, useCameraTimerCapture } from '@/app/[lang]/timer/_shared/useCameraTimerCapture';
import type { TimerReconstructionResult } from '@/lib/video-recon/engine/cube-timer';
import type { MoveSearchResult } from '@/lib/video-recon/engine/move-search-types';
import { reviewSimulationFile } from '@/lib/video-recon/engine/simulated-camera';
import { createVideoWorkspace, type VideoWorkspace } from '@/lib/video-recon/workspace';

vi.mock('@/app/[lang]/timer/_lib/sound', () => ({ timerSound: {} }));
vi.mock('@cuberoot/timer-ui', () => ({ useTimerSoundFeedback: () => () => {} }));
vi.mock('@/lib/video-recon/workspace', () => ({ createVideoWorkspace: vi.fn() }));

it('continues file recovery past the live error and returns the decoded reconstruction', async () => {
  const result = { status: 'solved' } as const;
  const file = new File(['sample'], 'sample.mp4', { type: 'video/mp4' });
  let notify!: () => void;
  let snapshot: Partial<ReturnType<VideoWorkspace['getSnapshot']>> = { cameraRecordingPhase: 'error', recordingReview: 'opening' };
  const unsubscribe = vi.fn();
  const workspace = {
    subscribe(listener: () => void) { notify = listener; return unsubscribe; },
    getSnapshot: () => snapshot,
    reviewSimulatedCameraFile: vi.fn(() => notify()),
    loadModel: vi.fn(),
    cleanup: vi.fn(),
  };
  vi.mocked(createVideoWorkspace).mockReturnValueOnce(workspace as unknown as VideoWorkspace);
  const pending = reviewSimulationFile('simulated', file, new AbortController().signal, () => {});
  await vi.waitFor(() => expect(workspace.loadModel).toHaveBeenCalledOnce());
  expect(workspace.reviewSimulatedCameraFile).toHaveBeenCalledWith('simulated', file);
  expect(unsubscribe).not.toHaveBeenCalled();
  snapshot = { cameraRecordingPhase: 'complete', cameraRecordingResult: result };
  notify();
  await expect(pending).resolves.toBe(result);
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(workspace.cleanup).toHaveBeenCalledOnce();
});

it('uses the extended ending as evidence without crediting turns made after the clock stopped', async () => {
  const result: TimerReconstructionResult = {
    status: 'solved',
    config: { scramble: 'R', fps: 1000, source_fps: 30, requested_start_seconds: 4,
      requested_stop_seconds: 5, source_origin_seconds: 3.5, source_end_seconds: 7 },
    result: { status: 'solved', steps: [{ frame_index: 6200, state_moves: ["R'"], geometry_option_index: null }] } as MoveSearchResult,
  };
  await expect(cameraTimerMoves(result, 1000)).resolves.toBeNull();
});

it('requests camera access on click before the preview loads and releases an abandoned stream', async () => {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  const getUserMedia = vi.fn(() => Promise.resolve(stream));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  const workspace = {
    camera: vi.fn(async (request: Promise<MediaStream>) => { expect(await request).toBe(stream); }),
    getSnapshot: () => ({ timerReconstructions: {} }),
    subscribe: () => () => {},
  } as unknown as VideoWorkspace;
  let camera!: ReturnType<typeof useCameraTimerCapture>;
  function Harness() {
    camera = useCameraTimerCapture(() => {});
    return createElement('button', { onClick: () => camera.connect() }, 'Connect camera');
  }

  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    act(() => root.render(createElement(Harness)));
    act(() => host.querySelector('button')!.click());
    expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({ video: expect.any(Object), audio: false });
    expect(workspace.camera).not.toHaveBeenCalled();
    await act(async () => camera.cancelConnect());
    expect(stop).toHaveBeenCalledTimes(1);

    act(() => host.querySelector('button')!.click());
    await act(async () => camera.attach(workspace));
    expect(workspace.camera).toHaveBeenCalledExactlyOnceWith(expect.any(Promise));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});

it('uses the ordinary timer clock and delivers verified camera moves to the same attempt once', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
  const startTimerSolve = vi.fn();
  const stopTimerSolve = vi.fn();
  const recorded = vi.fn();
  const completed = vi.fn();
  const listeners = new Set<() => void>();
  const results: Record<string, TimerReconstructionResult> = {};
  const workspace = {
    getSnapshot: () => ({ timerReady: true, timerReconstructions: results }),
    startTimerSolve, stopTimerSolve,
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  } as unknown as VideoWorkspace;
  let timer!: TimerHandle;
  function Harness() {
    const camera = useCameraTimerCapture(completed);
    timer = useTimer(({ timeMs }) => recorded(camera.stop('333', timeMs), timeMs),
      startedAt => camera.start('R', startedAt));
    return createElement('button', { onClick: () => camera.attach(workspace) }, 'Attach camera');
  }

  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(Harness)));
    act(() => host.querySelector('button')!.click());
    act(() => { timer.onPressDown(); timer.onPressUp(); });
    expect(startTimerSolve).not.toHaveBeenCalled();
    act(() => timer.onPressDown());
    act(() => vi.advanceTimersByTime(1500));
    act(() => timer.onPressUp());
    expect(startTimerSolve).toHaveBeenCalledExactlyOnceWith(expect.any(String), 'R', performance.timeOrigin + performance.now());
    const [id, , start] = startTimerSolve.mock.calls[0];
    act(() => vi.advanceTimersByTime(2750));
    act(() => timer.onPressDown());
    expect(recorded).toHaveBeenCalledExactlyOnceWith(id, 2750);
    expect(stopTimerSolve).toHaveBeenCalledExactlyOnceWith(id, start + 2750);
    expect(completed).not.toHaveBeenCalled();

    results[id] = {
      status: 'solved',
      config: { scramble: 'R', fps: 1000, source_fps: 30, requested_start_seconds: 4, source_origin_seconds: 3.7, source_end_seconds: 7 },
      result: { status: 'solved', steps: [{ frame_index: 4500, state_moves: ["R'"], geometry_option_index: null }] } as MoveSearchResult,
    };
    await act(async () => {
      listeners.forEach(listener => listener());
      listeners.forEach(listener => listener());
      await vi.waitFor(() => expect(completed).toHaveBeenCalledExactlyOnceWith({
        id, event: '333', elapsedMs: 2750, moves: [{ m: "R'", ts: 500 }],
      }));
    });
  } finally {
    act(() => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
