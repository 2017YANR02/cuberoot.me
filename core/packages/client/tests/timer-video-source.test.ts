// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TimerVideoReview } from '@/app/[lang]/timer/_components/TimerVideoReview';

const renderWorkspace = vi.hoisted(() => vi.fn((props: { timerSource: { switchSourceAction: ReactElement } }) => props.timerSource.switchSourceAction));
vi.mock('next/dynamic', () => ({ default: () => renderWorkspace }));
vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));

it('opens a local video without camera permission, keeps its scramble, and releases a late camera grant after closing', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const stop = vi.fn();
  let grant!: (stream: MediaStream) => void;
  const getUserMedia = vi.fn(() => new Promise<MediaStream>(resolve => { grant = resolve; }));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(TimerVideoReview, { scramble: 'R U' })));
    expect([...host.querySelectorAll('button')].map(button => button.textContent)).toEqual(['Record', 'Choose video']);
    expect(getUserMedia).not.toHaveBeenCalled();
    const file = new File(['local clip'], 'solve.mp4', { type: 'video/mp4' });
    const picker = host.querySelector('input')!;
    Object.defineProperty(picker, 'files', { value: [file] });
    await act(async () => { picker.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Video reconstruction');
    await act(async () => root.render(createElement(TimerVideoReview, { scramble: 'F' })));
    expect(renderWorkspace.mock.lastCall?.[0]).toMatchObject({
      mode: 'detector', timerSource: { file, scramble: 'R U' },
    });
    expect(getUserMedia).not.toHaveBeenCalled();
    await act(async () => host.querySelector('button')!.click());
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Record');
    expect(getUserMedia).toHaveBeenCalledOnce();
  } finally {
    act(() => root.unmount());
    host.remove();
    grant?.({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await Promise.resolve();
    vi.unstubAllGlobals();
  }
  await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce());
});
