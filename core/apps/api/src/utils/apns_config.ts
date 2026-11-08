export const APNS_APP_IDS = ['me.cuberoot.app', 'me.cuberoot.app.debug'] as const;
export const APNS_CONFIG_KEYS = ['RECORD_PUSH_ENABLED', 'APNS_ENABLED', 'APNS_TEAM_ID', 'APNS_KEY_ID', 'APNS_PRIVATE_KEY_PATH'] as const;
export type ApnsConfigEnv = Record<string, string | undefined>;

export function readApnsConfig(appId: string, env: ApnsConfigEnv) {
  if (env.RECORD_PUSH_ENABLED !== '1' || env.APNS_ENABLED !== '1'
    || !APNS_APP_IDS.some(id => id === appId)) return null;
  const teamId = env.APNS_TEAM_ID?.trim();
  const keyId = env.APNS_KEY_ID?.trim();
  const keyPath = env.APNS_PRIVATE_KEY_PATH?.trim();
  return teamId && keyId && keyPath ? { teamId, keyId, keyPath, topic: appId } : null;
}
