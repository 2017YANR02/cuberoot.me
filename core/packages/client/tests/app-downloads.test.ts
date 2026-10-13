import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANDROID_APK_URL, GOOGLE_PLAY_URL, trackDownload } from '../lib/app-downloads';

describe('official download links and independent click reporting', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the published package and a versioned HTTPS APK on the official static host', () => {
    expect(new URL(GOOGLE_PLAY_URL).searchParams.get('id')).toBe('me.cuberoot.app');
    const apk = new URL(ANDROID_APK_URL!);
    expect(apk.origin).toBe('https://static.cuberoot.me');
    expect(apk.pathname).toMatch(/^\/downloads\/android\/CubeRoot-\d+\.\d+\.\d+-\d+\.apk$/);
  });

  it('sends only the selected channel and language without credentials', () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    expect(trackDownload('play', 'zh')).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/v1/downloads/events'), expect.objectContaining({
      method: 'POST', body: '{"channel":"play","language":"zh"}', credentials: 'omit', keepalive: true,
    }));
  });

  it('ignores asynchronous network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(() => trackDownload('apk', 'en')).not.toThrow();
    await Promise.resolve();
  });

  it('ignores synchronous request failures', () => {
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('keepalive unavailable'); }));
    expect(() => trackDownload('play', 'en')).not.toThrow();
  });
});
