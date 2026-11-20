export interface NativeFileEnvironment {
  getEnvInfoSync?(): { common?: { USER_DATA_PATH?: string } };
  env?: { USER_DATA_PATH?: string };
}

/** Douyin SDK 2.21+ exposes the private directory through getEnvInfoSync. */
export function nativeUserDataPath(api: NativeFileEnvironment): string | undefined {
  try {
    const path = api.getEnvInfoSync?.()?.common?.USER_DATA_PATH;
    if (typeof path === 'string' && path) return path;
  } catch { /* Older hosts may expose the method before implementing it. */ }
  const legacyPath = api.env?.USER_DATA_PATH;
  return typeof legacyPath === 'string' && legacyPath ? legacyPath : undefined;
}
