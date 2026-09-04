import { describe, expect, it } from 'vitest';
import {
  createVaultKeyProfile,
  decryptVaultEntry,
  encryptVaultEntry,
  isValidVaultPassphrase,
  recoverVaultPrivateKey,
  unlockVaultPrivateKey,
  type VaultEntry,
} from '@/lib/vault-crypto';

describe('private vault crypto', () => {
  it('accepts only an exact six-digit vault passphrase', () => {
    expect(isValidVaultPassphrase('123456')).toBe(true);
    expect(isValidVaultPassphrase('12345')).toBe(false);
    expect(isValidVaultPassphrase('1234567')).toBe(false);
    expect(isValidVaultPassphrase('12345a')).toBe(false);
  });

  it('round-trips Unicode content for only the intended key', async () => {
    const owner = await createVaultKeyProfile('correct horse battery staple');
    const stranger = await createVaultKeyProfile('a different long passphrase');
    const entry: VaultEntry = {
      id: crypto.randomUUID(),
      title: '证件与账号',
      fields: [{ id: crypto.randomUUID(), label: '密码', value: '仅作测试🔐', secret: true }],
      notes: '中文备注',
    };
    const encrypted = await encryptVaultEntry(entry, [{ userId: 1, publicKey: owner.publicKey }]);
    const ownerKey = await unlockVaultPrivateKey('correct horse battery staple', owner.encryptedPrivateKey);
    const strangerKey = await unlockVaultPrivateKey('a different long passphrase', stranger.encryptedPrivateKey);

    await expect(decryptVaultEntry(encrypted.ciphertext, encrypted.iv, encrypted.accesses[0].wrappedKey, ownerKey))
      .resolves.toEqual(entry);
    await expect(decryptVaultEntry(encrypted.ciphertext, encrypted.iv, encrypted.accesses[0].wrappedKey, strangerKey))
      .rejects.toThrow();

    const recovered = await recoverVaultPrivateKey(owner.recoveryCode, 'a replacement passphrase', owner.encryptedPrivateKey);
    await expect(decryptVaultEntry(encrypted.ciphertext, encrypted.iv, encrypted.accesses[0].wrappedKey, recovered.privateKey))
      .resolves.toEqual(entry);
    await expect(unlockVaultPrivateKey('a replacement passphrase', recovered.encryptedPrivateKey)).resolves.toBeDefined();
    await expect(recoverVaultPrivateKey(stranger.recoveryCode, 'another replacement', owner.encryptedPrivateKey))
      .rejects.toThrow();
  });
});
