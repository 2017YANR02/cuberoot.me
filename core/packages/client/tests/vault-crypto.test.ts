import { describe, expect, it } from 'vitest';
import {
  createVaultKeyProfile,
  decryptVaultEntry,
  encryptVaultEntry,
  isValidVaultPassphrase,
  MAX_VAULT_IMAGE_BYTES,
  readVaultImages,
  validateVaultImages,
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

    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG6kAAAAASUVORK5CYII=';
    const original = Uint8Array.from(atob(png), (char) => char.charCodeAt(0));
    entry.images = await readVaultImages([new File([original], '原图.png', { type: 'image/png' })]);
    expect(entry.images[0].dataUrl).toBe(`data:image/png;base64,${png}`);
    const withImages = await encryptVaultEntry(entry, [{ userId: 1, publicKey: owner.publicKey }]);
    expect(withImages.ciphertext).not.toContain(png);
    expect(withImages.ciphertext).not.toContain('原图.png');
    await expect(decryptVaultEntry(withImages.ciphertext, withImages.iv, withImages.accesses[0].wrappedKey, ownerKey))
      .resolves.toEqual(entry);
    await expect(decryptVaultEntry(withImages.ciphertext, withImages.iv, withImages.accesses[0].wrappedKey, strangerKey))
      .rejects.toThrow();
    const damaged = (withImages.ciphertext[0] === 'A' ? 'B' : 'A') + withImages.ciphertext.slice(1);
    await expect(decryptVaultEntry(damaged, withImages.iv, withImages.accesses[0].wrappedKey, ownerKey)).rejects.toThrow();

    const recovered = await recoverVaultPrivateKey(owner.recoveryCode, 'a replacement passphrase', owner.encryptedPrivateKey);
    await expect(decryptVaultEntry(withImages.ciphertext, withImages.iv, withImages.accesses[0].wrappedKey, recovered.privateKey))
      .resolves.toEqual(entry);
    await expect(unlockVaultPrivateKey('a replacement passphrase', recovered.encryptedPrivateKey)).resolves.toBeDefined();
    await expect(recoverVaultPrivateKey(stranger.recoveryCode, 'another replacement', owner.encryptedPrivateKey))
      .rejects.toThrow();
  });

  it('rejects active formats, spoofed images and oversized attachments before encryption', async () => {
    await expect(readVaultImages([new File(['<svg/>'], 'image.svg', { type: 'image/svg+xml' })])).rejects.toThrow('vault_image_type');
    await expect(readVaultImages([new File(['<html/>'], 'fake.jpg', { type: 'image/jpeg' })])).rejects.toThrow('vault_image_type');
    await expect(readVaultImages([new File([new Uint8Array(MAX_VAULT_IMAGE_BYTES + 1)], 'large.png', { type: 'image/png' })])).rejects.toThrow('vault_image_limit');
    expect(validateVaultImages([{ id: 'a', name: 'x', dataUrl: 'https://example.com/tracker.jpg' }])).toBe(false);
    expect(validateVaultImages([{ id: 'a', name: 'x', dataUrl: 'data:image/png;base64,!!!!' }])).toBe(false);
    const jpeg = new Uint8Array(MAX_VAULT_IMAGE_BYTES); jpeg.set([255, 216, 255]);
    const images = await readVaultImages([new File([jpeg], 'large.jpg', { type: 'image/jpeg' })]);
    await expect(readVaultImages([new File([new Uint8Array([255, 216, 255])], 'more.jpg', { type: 'image/jpeg' })], images)).rejects.toThrow('vault_image_limit');
    await expect(encryptVaultEntry({ id: 'entry', title: 'test', fields: [], notes: '字'.repeat(500_000), images }, [{ userId: 1, publicKey: {} }])).rejects.toThrow('vault_entry_limit');
  });
});
