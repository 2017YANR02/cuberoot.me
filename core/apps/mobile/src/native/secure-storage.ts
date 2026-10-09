import { SecureStorage, KeychainAccess } from '@aparajita/capacitor-secure-storage';

export interface MobileSecureStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

let secureStorageReady: Promise<void> | null = null;

function prepareSecureStorage(): Promise<void> {
  if (!secureStorageReady) {
    secureStorageReady = Promise.all([
      SecureStorage.setKeyPrefix('cuberoot_mobile_'),
      SecureStorage.setSynchronize(false),
      SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly),
    ]).then(() => undefined);
  }
  return secureStorageReady;
}

/** Shared Android/iOS secret store; auth and online battle use one native adapter. */
export const nativeMobileSecureStorage: MobileSecureStorage = {
  async getItem(key) {
    await prepareSecureStorage();
    // set() JSON-encodes even strings; getItem() would expose that outer encoding.
    // Keep the existing format so pending logins and sessions from older builds survive.
    const value = await SecureStorage.get(key, false, false);
    if (value === null || typeof value === 'string') return value;
    throw new Error('Invalid mobile secure-storage value');
  },
  async setItem(key, value) {
    await prepareSecureStorage();
    await SecureStorage.set(key, value, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
  },
  async removeItem(key) {
    await prepareSecureStorage();
    await SecureStorage.removeItem(key);
  },
};
