// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { SecureStorage, KeychainAccess } from '@aparajita/capacitor-secure-storage';
import { nativeMobileSecureStorage } from './secure-storage';

const KEY = 'secure_storage_regression';

afterEach(async () => { await nativeMobileSecureStorage.removeItem(KEY); });

describe('native secure-storage serialization with the real plugin', () => {
  it.each(['plain-string', '', '2026-10-06T00:00:00.000Z', JSON.stringify({ state: 'synthetic', createdAt: 1 })])(
    'preserves a string exactly across set/get: %s', async (value) => {
      await nativeMobileSecureStorage.setItem(KEY, value);
      expect(await nativeMobileSecureStorage.getItem(KEY)).toBe(value);
      // The actual plugin stores an outer JSON encoding, on web and native alike.
      expect(await SecureStorage.getItem(KEY)).toBe(JSON.stringify(value));
    },
  );

  it('reads the existing release storage format without rewriting it', async () => {
    await nativeMobileSecureStorage.getItem(KEY); // initialize prefix and native options
    const value = JSON.stringify({ codeVerifier: 'synthetic', state: 'synthetic', createdAt: 1 });
    await SecureStorage.set(KEY, value, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
    const stored = await SecureStorage.getItem(KEY);
    expect(await nativeMobileSecureStorage.getItem(KEY)).toBe(value);
    expect(await SecureStorage.getItem(KEY)).toBe(stored);
  });

  it('returns null for a missing key and rejects non-string data', async () => {
    await nativeMobileSecureStorage.removeItem(KEY);
    expect(await nativeMobileSecureStorage.getItem(KEY)).toBeNull();
    await SecureStorage.set(KEY, { unexpected: true });
    await expect(nativeMobileSecureStorage.getItem(KEY)).rejects.toThrow('Invalid mobile secure-storage value');
  });
});
