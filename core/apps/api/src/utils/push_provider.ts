import { apnsConfig, type ApnsEnvironment } from './apns.js';
import { getuiConfig } from './getui.js';
export type PushProvider = 'getui' | 'apns';
export function pushConfigured(appId: string, provider: string = 'getui', environment: string = 'production'): boolean {
  if (provider === 'getui') return environment === 'production' && !!getuiConfig(appId);
  return provider === 'apns' && ['sandbox', 'production'].includes(environment) && !!apnsConfig(appId);
}
export interface PushTarget { provider: PushProvider; environment: ApnsEnvironment }
