// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { VideoReconResultPet, videoReconReaction } from '@/app/[lang]/video-recon/VideoReconResultPet';
import * as motion from '@/lib/deskpet-motion';
import { ROOTBEAST_RECON_REACTIONS } from '@/lib/deskpet-rootbeast';
import type { VideoWorkspace } from '@/lib/video-recon/workspace';

type View = ReturnType<VideoWorkspace['getSnapshot']>;

it('waits for a final verdict, including notation checks and camera recovery', () => {
  const file: Partial<View> = { activeTab: 'detector', sourceKind: 'video', fileReviewId: 1, cubeSolved: true };
  const camera: Partial<View> = { activeTab: 'record', cameraRecordingAttempt: 'take:1', cameraRecordingPhase: 'error',
    cameraRecordingFile: new File([], 'solve.mp4') };
  const outcome = (view: Partial<View>, hasMoves = true, verified?: boolean) =>
    videoReconReaction(view as View, hasMoves, verified)?.outcome;

  expect(outcome({ ...file, videoInputComplete: true })).toBeUndefined();
  file.reconstructionComplete = true;
  expect(outcome(file)).toBeUndefined();
  expect(outcome(file, true, true)).toBe('success');
  expect(outcome(file, true, false)).toBe('failure');
  expect(outcome(file, false, true)).toBe('failure');
  expect(outcome({ ...file, fileReviewId: undefined }, true, true)).toBeUndefined();
  expect(outcome(camera)).toBeUndefined();
  expect(outcome({ ...camera, recordingReview: 'running' })).toBeUndefined();
  expect(outcome({ ...camera, cameraRecordingRecovered: false })).toBe('failure');
  expect(outcome({ ...camera, cameraRecordingPhase: 'complete' })).toBe('success');
});

it('discards an interrupted load and starts a fresh SVG timeline only for a new attempt', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const create = vi.fn(() => 'blob:take');
  const revoke = vi.fn();
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: revoke }));
  const blob = new Blob(['<svg/>'], { type: 'image/svg+xml' });
  let finishLoading!: (blob: Blob) => void;
  vi.spyOn(motion, 'loadMotionBlob').mockImplementationOnce(() => new Promise(resolve => { finishLoading = resolve; })).mockResolvedValue(blob);
  const host = document.createElement('div');
  const root = createRoot(host);
  const render = (id?: number) => act(async () => {
    root.render(createElement(StrictMode, null, createElement(VideoReconResultPet, { result: id ? { id, outcome: 'success' } : undefined })));
  });
  try {
    await render();
    await render(1);
    await render();
    await act(async () => finishLoading(blob));
    expect(create).not.toHaveBeenCalled();
    await render(2);
    const image = host.querySelector('img')!;
    act(() => image.dispatchEvent(new Event('load')));
    expect(image.hidden).toBe(false);
    await render(2);
    act(() => vi.advanceTimersByTime(ROOTBEAST_RECON_REACTIONS.success.durationMs));
    expect(image.hidden).toBe(true);
    expect(revoke).toHaveBeenCalledOnce();
    await render();
    await render(2);
    expect(create).toHaveBeenCalledTimes(1);
    await render(3);
    expect(create).toHaveBeenCalledTimes(2);
  } finally {
    act(() => root.unmount());
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
