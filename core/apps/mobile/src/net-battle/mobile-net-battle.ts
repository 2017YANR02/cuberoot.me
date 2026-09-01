import {
  createNetBattleClient,
  createNetBattleSessionStore,
  decodeNetBattleSession,
  type NetBattleSession,
} from '@cuberoot/shared/timer';
import { mobileApiUrl } from '@cuberoot/app-ui';
import {
  nativeMobileSecureStorage,
  type MobileSecureStorage,
} from '../native/secure-storage';

export type MobileNetBattleSession = NetBattleSession;

export function decodeMobileNetBattleSession(value: unknown): MobileNetBattleSession | null {
  return decodeNetBattleSession(value);
}

export function createMobileNetBattleSessionStore(storage: MobileSecureStorage) {
  return createNetBattleSessionStore(storage);
}

/** Same shared room transport as Web, with only the native API-origin adapter injected. */
export const mobileNetBattleClient = createNetBattleClient({ apiUrl: mobileApiUrl });

/** Android and iOS persist the private player capability in the existing native secret store. */
export const mobileNetBattleSessionStore = createMobileNetBattleSessionStore(nativeMobileSecureStorage);
