/** Public Android release metadata, shared by the website and installed App. */
export const ANDROID_RELEASE_URL = 'https://static.cuberoot.me/downloads/android/latest.json';
export const GOOGLE_PLAY_APP_URL = 'https://play.google.com/store/apps/details?id=me.cuberoot.app';
export const ANDROID_RELEASE_CERTIFICATE = 'fe511914cc90c6f31af71d0d4f86015a3a289a598fb1298845e7b5396e492ee2';

export interface AndroidRelease {
  schemaVersion: 1;
  applicationId: 'me.cuberoot.app';
  channel: 'direct';
  versionName: string;
  versionCode: number;
  minSdk: number;
  url: string;
  sha256: string;
  certificateSha256: string;
  size: number;
  commit: string;
  publishedAt: string;
}

export function parseAndroidRelease(value: unknown): AndroidRelease {
  if (!value || typeof value !== 'object') throw new Error('Invalid Android release');
  const r = value as AndroidRelease;
  if (r.schemaVersion !== 1 || r.applicationId !== 'me.cuberoot.app' || r.channel !== 'direct'
    || !/^\d+\.\d+\.\d+$/.test(r.versionName) || !Number.isSafeInteger(r.versionCode)
    || r.versionCode <= 1004 || r.versionCode > 2_100_000_000
    || !Number.isSafeInteger(r.minSdk) || r.minSdk < 26
    || !Number.isSafeInteger(r.size) || r.size <= 0
    || !/^[a-f0-9]{64}$/.test(r.sha256) || !/^[a-f0-9]{40}$/.test(r.commit)
    || r.certificateSha256 !== ANDROID_RELEASE_CERTIFICATE
    || typeof r.publishedAt !== 'string' || !Number.isFinite(Date.parse(r.publishedAt))
    || r.url !== `https://static.cuberoot.me/downloads/android/CubeRoot-${r.versionName}-${r.versionCode}.apk`) {
    throw new Error('Invalid Android release');
  }
  return r;
}

export async function fetchAndroidRelease(signal?: AbortSignal): Promise<AndroidRelease> {
  const response = await fetch(ANDROID_RELEASE_URL, { cache: 'no-store', credentials: 'omit', signal });
  if (!response.ok) throw new Error('Android release unavailable');
  return parseAndroidRelease(await response.json());
}
