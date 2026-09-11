import { decryptPrivateData, encryptPrivateData, parsePrivateDataKey } from '../utils/private_data_encryption.js';
import { PlatformApiError } from './errors.js';

const KEY_VERSION = 1;
const AAD = Buffer.from('cuberoot:platform:private-data:v1', 'utf8');

function encryptionKey(): Buffer {
  const encoded = process.env.PLATFORM_DATA_ENCRYPTION_KEY_V1?.trim();
  if (!encoded) {
    throw new PlatformApiError('DATA_ENCRYPTION_NOT_CONFIGURED', 503, 'Private data encryption is not configured');
  }
  try {
    return parsePrivateDataKey(encoded);
  } catch {
    throw new PlatformApiError('DATA_ENCRYPTION_NOT_CONFIGURED', 503, 'Private data encryption key is invalid');
  }
}

export function encryptPlatformPrivateData(value: Record<string, unknown>): { payload: Buffer; keyVersion: number } {
  return { payload: encryptPrivateData(value, encryptionKey(), AAD), keyVersion: KEY_VERSION };
}

export function decryptPlatformPrivateData(payload: Buffer, keyVersion: number): Record<string, unknown> {
  if (keyVersion !== KEY_VERSION) {
    throw new PlatformApiError('PRIVATE_DATA_UNREADABLE', 500, 'Private data could not be decrypted');
  }
  try {
    return decryptPrivateData(payload, encryptionKey(), AAD);
  } catch (error) {
    if (error instanceof PlatformApiError) throw error;
    throw new PlatformApiError('PRIVATE_DATA_UNREADABLE', 500, 'Private data could not be decrypted');
  }
}
