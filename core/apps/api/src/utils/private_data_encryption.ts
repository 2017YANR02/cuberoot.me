import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// One AES-GCM envelope for server-owned secrets. Callers own key rotation and AAD domains.
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export function parsePrivateDataKey(encoded: string): Buffer {
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
    throw new Error('Invalid private data key');
  }
  return key;
}

export function encryptPrivateData(value: Record<string, unknown>, key: Buffer, aad: Buffer): Buffer {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]);
}

export function decryptPrivateData(payload: Buffer, key: Buffer, aad: Buffer): Record<string, unknown> {
  if (payload.length <= NONCE_BYTES + TAG_BYTES) throw new Error('Invalid private data envelope');
  const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(0, NONCE_BYTES));
  decipher.setAAD(aad);
  decipher.setAuthTag(payload.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES));
  const parsed: unknown = JSON.parse(Buffer.concat([
    decipher.update(payload.subarray(NONCE_BYTES + TAG_BYTES)), decipher.final(),
  ]).toString('utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Invalid private data');
  return parsed as Record<string, unknown>;
}
