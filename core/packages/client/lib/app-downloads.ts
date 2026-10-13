/** @module Official distribution links. Enable APK only after signing and hosting checks. */
import { apiUrl } from './api-base';

export const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=me.cuberoot.app';
export const ANDROID_APK_URL: string | null = null;

/** Best-effort click counts; the ordinary link remains independent of this request. */
export function trackDownload(channel: 'play' | 'apk', language: 'en' | 'zh'): void {
  try {
    void fetch(apiUrl('/v1/downloads/events'), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ channel, language }),
      credentials: 'omit',
      keepalive: true,
    }).catch(() => { /* Offline or unavailable statistics must not block navigation. */ });
  } catch { /* A browser may reject the keepalive request synchronously. */ }
}
