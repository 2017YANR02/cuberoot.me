import {
  createNetBattleClient,
  decodeNetBattleSession,
  type NetBattleSession,
} from '@cuberoot/shared/timer';

import { mobileApiUrl } from '../data/wca-source-adapter';
import {
  nativeMobileSecureStorage,
  type MobileSecureStorage,
} from '../native/secure-storage';

const NET_BATTLE_SESSION_KEY = 'net_battle_session';

export type MobileNetBattleSession = NetBattleSession;

export function decodeMobileNetBattleSession(value: unknown): MobileNetBattleSession | null {
  return decodeNetBattleSession(value);
}

export function createMobileNetBattleSessionStore(storage: MobileSecureStorage) {
  return {
    async load(): Promise<MobileNetBattleSession | null> {
      const raw = await storage.getItem(NET_BATTLE_SESSION_KEY);
      if (!raw) return null;
      try {
        return decodeMobileNetBattleSession(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    save(session: MobileNetBattleSession): Promise<void> {
      return storage.setItem(NET_BATTLE_SESSION_KEY, JSON.stringify(session));
    },
    clear(): Promise<void> {
      return storage.removeItem(NET_BATTLE_SESSION_KEY);
    },
  };
}

/** Same shared room transport as Web, with only the native API-origin adapter injected. */
export const mobileNetBattleClient = createNetBattleClient({ apiUrl: mobileApiUrl });

/** Android and iOS persist the private player capability in the existing native secret store. */
export const mobileNetBattleSessionStore = createMobileNetBattleSessionStore(nativeMobileSecureStorage);
