// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CameraRecordingFormat } from '@/app/[lang]/video-recon/CameraRecordingFormat';

vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));

afterEach(() => vi.unstubAllGlobals());

it('keeps 4K selectable after the lens rejects 4K at 60 fps', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  let settings = { width: 3840, height: 2160, frameRate: 30 };
  const track = {
    getSettings: () => settings,
    getConstraints: () => ({}),
    getCapabilities: () => ({ frameRate: { min: 24, max: 60 } }),
    async applyConstraints(c: { height?: { exact: number }; width?: { exact: number }; frameRate?: { ideal?: number; exact?: number } }) {
      if (!c.height || !c.width) return;
      const height = c.height.exact;
      const rate = c.frameRate?.exact ?? c.frameRate?.ideal ?? 30;
      settings = { width: c.width.exact, height, frameRate: height === 2160 ? Math.min(30, rate) : rate };
    },
  } as unknown as MediaStreamTrack;
  const host = document.createElement('div');
  const root = createRoot(host);
  const button = (text: string) => [...host.querySelectorAll('button')].find(b => b.textContent === text)!;
  try {
    await act(async () => root.render(createElement(CameraRecordingFormat, { track, disabled: false, onChanging: () => {} })));
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Format"]')!.click());
    await act(async () => button('60').click());
    expect(button('60').disabled).toBe(true);
    await act(async () => button('HD').click());
    await act(async () => button('60').click());
    expect(settings.frameRate).toBe(60);
    expect(button('4K').disabled).toBe(false);
    await act(async () => button('4K').click());
    expect(settings).toEqual({ width: 3840, height: 2160, frameRate: 30 });
  } finally { await act(async () => root.unmount()); }
});
