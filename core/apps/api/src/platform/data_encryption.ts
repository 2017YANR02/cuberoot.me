import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { PlatformApiError } from './errors.js';

const KEY_VERSION = 1;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const AAD = Buffer.from('cuberoot:platform:private-data:v1', 'utf8');

function encryptionKey(): Buffer {
  const encoded = process.env.PLATFORM_DATA_ENCRYPTION_KEY_V1?.trim();
  if (!encoded) {
    throw new PlatformApiError('DATA_ENCRYPTION_NOT_CONFIGURED', 503, 'Private data encryption is not configured');
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
    throw new PlatformApiError('DATA_ENCRYPTION_NOT_CONFIGURED', 503, 'Private data encryption key is invalid');
  }
  return key;
}

export function encryptPlatformPrivateData(value: Record<string, unknown>): { payload: Buffer; keyVersion: number } {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { payload: Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]), keyVersion: KEY_VERSION };
}

export function decryptPlatformPrivateData(payload: Buffer, keyVersion: number): Record<string, unknown> {
  if (keyVersion !== KEY_VERSION || payload.length <= NONCE_BYTES + TAG_BYTES) {
    throw new PlatformApiError('PRIVATE_DATA_UNREADABLE', 500, 'Private data could not be decrypted');
  }
  try {
    const nonce = payload.subarray(0, NONCE_BYTES);
    const tag = payload.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES);
    const ciphertext = payload.subarray(NONCE_BYTES + TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), nonce);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    const parsed: unknown = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Invalid payload');
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof PlatformApiError) throw error;
    throw new PlatformApiError('PRIVATE_DATA_UNREADABLE', 500, 'Private data could not be decrypted');
  }
}
