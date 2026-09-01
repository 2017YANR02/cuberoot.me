import { describe, expect, it } from 'vitest';
import {
  createVaultKeyProfile,
  decryptVaultEntry,
  encryptVaultEntry,
  unlockVaultPrivateKey,
  type VaultEntry,
} from '@/lib/vault-crypto';

describe('private vault crypto', () => {
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
  });
});
