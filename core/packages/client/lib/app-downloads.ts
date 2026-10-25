/** @module Official distribution links. Enable APK only after signing and hosting checks. */
import { apiUrl } from './api-base';
import { GOOGLE_PLAY_APP_URL } from '@cuberoot/shared/android-release';

export const GOOGLE_PLAY_URL = GOOGLE_PLAY_APP_URL;
export const ANDROID_APK_URL: string | null = 'https://static.cuberoot.me/downloads/android/latest.apk';

/** Best-effort click counts; the ordinary link remains independent of this request. */
export function trackDownload(channel: 'play' | 'apk' | 'windows-installer' | 'windows-portable', language: 'en' | 'zh'): void {
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
