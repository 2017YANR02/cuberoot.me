// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { CameraTimer } from '@/app/[lang]/video-recon/CameraTimer';
import type { VideoWorkspace } from '@/lib/video-recon/workspace';

vi.mock('@/app/[lang]/timer/_lib/sound', () => ({ timerSound: {} }));
vi.mock('cubing/scramble', () => ({ randomScrambleForEvent: async () => 'R U' }));
vi.mock('@/app/[lang]/video-recon/TimerReplay', () => ({ TimerReplay: () => null }));
vi.mock('@/app/[lang]/video-recon/TpsGraph', () => ({ TpsGraph: () => null }));
vi.mock('@/components/SettingsDialog', () => ({ default: () => null }));
vi.mock('@/app/[lang]/timer/_components/TimerReadout', () => ({ default: ({ text }: { text: string }) => text }));
vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));
vi.mock('@cuberoot/timer-ui', () => ({
  TimerScramblePreview: () => null, TimerScrambleStrip: () => null, TimingSurface: () => null,
  useTimerSoundFeedback: () => () => {},
}));

it('passes the shared timer start and stop times to the same camera solve and saves its scramble', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
  const startTimerSolve = vi.fn();
  const stopTimerSolve = vi.fn();
  const workspace = { startTimerSolve, stopTimerSolve, selectTimerReplay: vi.fn(), setTimerBusy: vi.fn() } as unknown as VideoWorkspace;
  const view = { timerReady: true, timerReconstructions: {}, timerReplays: {} } as ReturnType<VideoWorkspace['getSnapshot']>;
  const root = createRoot(document.createElement('div'));
  const key = (type: string, code: string) => act(() => { window.dispatchEvent(new KeyboardEvent(type, { code })); });
  try {
    await act(async () => root.render(createElement(CameraTimer, { active: true, view, workspace })));
    key('keydown', 'Space');
    key('keyup', 'Space');
    expect(startTimerSolve).not.toHaveBeenCalled();
    key('keydown', 'Space');
    act(() => vi.advanceTimersByTime(1500));
    key('keyup', 'Space');
    expect(startTimerSolve).toHaveBeenCalledExactlyOnceWith(expect.any(String), 'R U', performance.timeOrigin + performance.now());
    const [id, , start] = startTimerSolve.mock.calls[0];
    act(() => vi.advanceTimersByTime(2750));
    key('keydown', 'KeyA');
    expect(stopTimerSolve).toHaveBeenCalledExactlyOnceWith(id, start + 2750);
    await act(async () => {});
    expect(JSON.parse(localStorage.getItem('live-recognition.timer.v1')!)).toMatchObject([{ id, scramble: 'R U', elapsedMs: 2750, penalty: 'none' }]);
  } finally {
    act(() => root.unmount());
    localStorage.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
