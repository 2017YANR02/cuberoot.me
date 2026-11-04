// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCameraStream } from '@/hooks/useCameraStream';
import { captureCameraPhoto } from '@/lib/camera-photo';

describe('photo camera lifecycle', () => {
  let root: Root;
  let camera: ReturnType<typeof useCameraStream>;
  const getUserMedia = vi.fn();
  function Probe({ enabled = true }: { enabled?: boolean }) {
    camera = useCameraStream({ enabled });
    return null;
  }
  const makeStream = () => {
    const stop = vi.fn();
    return { stream: { getTracks: () => [{ stop }] } as unknown as MediaStream, stop };
  };
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    getUserMedia.mockReset();
    root = createRoot(document.createElement('div'));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  });

  it('opens only when enabled, prefers the rear camera without audio, and releases it on close', async () => {
    const current = makeStream();
    getUserMedia.mockResolvedValue(current.stream);
    await act(async () => root.render(createElement(Probe, { enabled: false })));
    expect(getUserMedia).not.toHaveBeenCalled();
    await act(async () => root.render(createElement(Probe)));
    expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    expect(camera.stream).toBe(current.stream);
    await act(async () => root.render(createElement(Probe, { enabled: false })));
    expect(current.stop).toHaveBeenCalledOnce();
    expect(camera.stream).toBeNull();
  });

  it('releases a stream whose permission prompt resolves after the camera was dismissed', async () => {
    const current = makeStream();
    let resolve!: (stream: MediaStream) => void;
    getUserMedia.mockReturnValue(new Promise<MediaStream>(yes => { resolve = yes; }));
    await act(async () => root.render(createElement(Probe)));
    await act(async () => root.render(null));
    await act(async () => resolve(current.stream));
    expect(current.stop).toHaveBeenCalledOnce();
  });

  it('supports permission retry and stops the acquired stream on unmount', async () => {
    const current = makeStream();
    getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError')).mockResolvedValueOnce(current.stream);
    await act(async () => root.render(createElement(Probe)));
    expect(camera.error).toBe('NotAllowedError');
    await act(async () => camera.retry());
    expect(camera.error).toBeNull();
    expect(camera.stream).toBe(current.stream);
    await act(async () => root.render(null));
    expect(current.stop).toHaveBeenCalledOnce();
  });

  it('ignores obsolete errors after retry while preserving the active stream', async () => {
    const current = makeStream();
    let reject!: (error: Error) => void;
    getUserMedia.mockReturnValueOnce(new Promise<MediaStream>((_, no) => { reject = no; })).mockResolvedValueOnce(current.stream);
    await act(async () => root.render(createElement(Probe)));
    await act(async () => camera.retry());
    await act(async () => reject(new Error('old request')));
    expect(camera.stream).toBe(current.stream);
    expect(camera.error).toBeNull();
    expect(current.stop).not.toHaveBeenCalled();
  });

  it('provides a recoverable error when the camera API is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    await act(async () => root.render(createElement(Probe)));
    expect(camera.error).toBe('Unsupported');
    expect(camera.stream).toBeNull();
  });
});

describe('photo frame capture', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([[3840, 2160, 1920, 1080], [1080, 1920, 1080, 1920], [640, 480, 640, 480]])(
    'preserves the complete %s × %s frame and bounds image size', async (width, height, expectedWidth, expectedHeight) => {
      const drawImage = vi.fn();
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as ReturnType<HTMLCanvasElement['getContext']>);
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function(this: HTMLCanvasElement, callback, type) {
        expect([this.width, this.height]).toEqual([expectedWidth, expectedHeight]);
        callback(new Blob(['test frame'], { type }));
      });
      const video = { readyState: 2, videoWidth: width, videoHeight: height } as HTMLVideoElement;
      const file = await captureCameraPhoto(video);
      expect(drawImage).toHaveBeenCalledExactlyOnceWith(video, 0, 0, expectedWidth, expectedHeight);
      expect(file.type).toBe('image/jpeg');
      expect(file.size).toBe(10);
    },
  );

  it('rejects empty camera frames before attempting to encode', async () => {
    const draw = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    await expect(captureCameraPhoto({ readyState: 1, videoWidth: 0, videoHeight: 0 } as HTMLVideoElement)).rejects.toThrow('CameraNotReady');
    expect(draw).not.toHaveBeenCalled();
  });
});
