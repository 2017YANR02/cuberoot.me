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

/** Website and installed Windows clients consume this same validated manifest. */
export const WINDOWS_RELEASE_URL = 'https://static.cuberoot.me/downloads/windows/latest.json';
export type ReleasePlatform = 'android' | 'windows' | 'both';
export interface WindowsRelease {
  schemaVersion: 1;
  platform: 'windows';
  arch: 'x64';
  versionName: string;
  versionCode: number;
  commit: string;
  publishedAt: string;
  notes: string;
  files: Record<'installer' | 'portable', { url: string; sha256: string; size: number }>;
}

export function compareReleaseVersions(a: string, b: string): number {
  if (![a, b].every(v => /^\d+\.\d+\.\d+$/.test(v))) throw new Error('Invalid release version');
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  return left[0]! - right[0]! || left[1]! - right[1]! || left[2]! - right[2]!;
}

/** Only manual release workflow runs consume a sequence; retries retain their identity. */
export function releaseIdentity(sequence: number) {
  // Gradle's existing semantic-version contract limits minor and patch to 999.
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 999_999) throw new Error('Invalid release sequence');
  return { versionName: `1.${Math.floor(sequence / 1000)}.${sequence % 1000}`, versionCode: 1_000_000 + sequence };
}

export function parseWindowsRelease(value: unknown): WindowsRelease {
  if (!value || typeof value !== 'object') throw new Error('Invalid Windows release');
  const r = value as WindowsRelease;
  if (r.schemaVersion !== 1 || r.platform !== 'windows' || r.arch !== 'x64'
    || typeof r.versionName !== 'string' || !/^\d+\.\d+\.\d+$/.test(r.versionName)
    || !Number.isSafeInteger(r.versionCode) || r.versionCode < 1
    || !/^[a-f0-9]{40}$/.test(r.commit) || !Number.isFinite(Date.parse(r.publishedAt))
    || typeof r.notes !== 'string' || r.notes.length > 4000 || !r.files) throw new Error('Invalid Windows release');
  for (const kind of ['installer', 'portable'] as const) {
    const file = r.files[kind];
    if (!file || !Number.isSafeInteger(file.size) || file.size <= 0 || !/^[a-f0-9]{64}$/.test(file.sha256)
      || file.url !== `https://static.cuberoot.me/downloads/windows/CubeRoot-${r.versionName}-${r.versionCode}-x64-${kind}.exe`) throw new Error('Invalid Windows artifact');
  }
  return r;
}

export async function fetchWindowsRelease(signal?: AbortSignal): Promise<WindowsRelease> {
  const response = await fetch(WINDOWS_RELEASE_URL, { cache: 'no-store', credentials: 'omit', signal });
  if (!response.ok) throw new Error('Windows release unavailable');
  return parseWindowsRelease(await response.json());
}

export interface AppReleaseRequest {
  requestId: string;
  platform: ReleasePlatform;
  commit: string;
  notes: string;
}
export function parseAppReleaseRequest(value: unknown): AppReleaseRequest {
  if (!value || typeof value !== 'object') throw new Error('Invalid release request');
  const r = value as AppReleaseRequest;
  if (Object.keys(r).some(k => !['requestId', 'platform', 'commit', 'notes'].includes(k))
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(r.requestId)
    || !['android', 'windows', 'both'].includes(r.platform) || !/^[a-f0-9]{40}$/.test(r.commit)
    || typeof r.notes !== 'string' || !r.notes.trim() || r.notes.length > 4000) throw new Error('Invalid release request');
  return { ...r, notes: r.notes.trim() };
}

export interface AppReleaseRun {
  id: number;
  requestId: string;
  status: string;
  conclusion: string | null;
  url: string;
  versionName: string;
  createdAt: string;
}
export interface AppReleaseStatus {
  configured: boolean;
  commit: string | null;
  runs: AppReleaseRun[];
  pending: { requestId: string; state: 'dispatching' | 'accepted' | 'unknown'; createdAt: string } | null;
}
