// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { CameraSelector } from '@/app/[lang]/video-recon/CameraRecordingControls';
import type { VideoWorkspace } from '@/lib/video-recon/workspace';

vi.mock('@/hooks/useT', () => ({ useT: () => (_zh: string, en: string) => en }));

it('offers the permitted cameras, releases the old source before opening the selected camera, and locks selection during capture', async () => {
  const stopSource = vi.fn();
  const camera = vi.fn();
  const getUserMedia = vi.fn(async () => {
    expect(stopSource).toHaveBeenCalledOnce();
    return stream;
  });
  const stream = { getVideoTracks: () => [{ getSettings: () => ({ deviceId: 'rear' }) }] } as unknown as MediaStream;
  const workspace = { camera, stopSource } as unknown as VideoWorkspace;
  const devices = Object.assign(new EventTarget(), {
    enumerateDevices: vi.fn(async () => [{ kind: 'videoinput', deviceId: 'rear', label: 'Back camera' }]),
    getUserMedia,
  });
  vi.stubGlobal('navigator', { mediaDevices: devices });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(CameraSelector, { workspace, stream, disabled: false })));
    expect(host.querySelector('select')).toBeNull();
    devices.enumerateDevices.mockResolvedValue([
      { kind: 'videoinput', deviceId: 'rear', label: 'Back camera' },
      { kind: 'videoinput', deviceId: 'front', label: 'Front camera' },
    ]);
    await act(async () => { devices.dispatchEvent(new Event('devicechange')); });
    const selector = host.querySelector('select')!;
    expect(selector.value).toBe('rear');
    expect([...selector.options].map(option => option.label)).toEqual(['Back camera', 'Front camera']);
    selector.value = 'front';
    await act(async () => { selector.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({
      audio: false, video: expect.objectContaining({ deviceId: { exact: 'front' } }),
    });
    expect(camera).toHaveBeenCalledOnce();
    await act(async () => root.render(createElement(CameraSelector, { workspace, stream, disabled: true })));
    expect(selector.disabled).toBe(true);
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
