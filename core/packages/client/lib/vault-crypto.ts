const KDF_ITERATIONS = 600_000;
const PRIVATE_KEY_AAD = new TextEncoder().encode('CubeRoot vault private key v1');
const ENTRY_AAD = new TextEncoder().encode('CubeRoot vault entry v1');

export interface VaultField {
  id: string;
  label: string;
  value: string;
  secret: boolean;
}

export interface VaultEntry {
  id: string;
  title: string;
  fields: VaultField[];
  notes: string;
}

export interface EncryptedPrivateKey {
  version: 1;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface VaultRecipientKey {
  userId: number;
  publicKey: JsonWebKey;
}

export interface EncryptedVaultEntry {
  ciphertext: string;
  iv: string;
  accesses: { userId: number; wrappedKey: string }[];
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function passphraseKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function createVaultKeyProfile(passphrase: string): Promise<{
  publicKey: JsonWebKey;
  encryptedPrivateKey: EncryptedPrivateKey;
}> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  );
  const [publicKey, privateKeyBytes] = await Promise.all([
    crypto.subtle.exportKey('jwk', pair.publicKey),
    crypto.subtle.exportKey('pkcs8', pair.privateKey),
  ]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await passphraseKey(passphrase, salt, KDF_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: PRIVATE_KEY_AAD },
    key,
    privateKeyBytes,
  );
  return {
    publicKey,
    encryptedPrivateKey: {
      version: 1,
      iterations: KDF_ITERATIONS,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    },
  };
}

export async function unlockVaultPrivateKey(
  passphrase: string,
  envelope: EncryptedPrivateKey,
): Promise<CryptoKey> {
  if (envelope.version !== 1 || envelope.iterations !== KDF_ITERATIONS) throw new Error('unsupported key profile');
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  if (salt.length !== 16 || iv.length !== 12) throw new Error('invalid key profile');
  const key = await passphraseKey(passphrase, salt, envelope.iterations);
  const privateKey = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: PRIVATE_KEY_AAD },
    key,
    base64ToBytes(envelope.ciphertext),
  );
  return crypto.subtle.importKey(
    'pkcs8',
    privateKey,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  );
}

function isVaultEntry(value: unknown): value is VaultEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== 'string' || entry.id.length > 100
    || typeof entry.title !== 'string' || entry.title.length > 200
    || typeof entry.notes !== 'string' || entry.notes.length > 500_000
    || !Array.isArray(entry.fields) || entry.fields.length > 50) return false;
  return entry.fields.every((field) => {
    if (!field || typeof field !== 'object') return false;
    const item = field as Record<string, unknown>;
    return typeof item.id === 'string' && item.id.length <= 100
      && typeof item.label === 'string' && item.label.length <= 100
      && typeof item.value === 'string' && item.value.length <= 100_000
      && typeof item.secret === 'boolean';
  });
}

export async function encryptVaultEntry(
  entry: VaultEntry,
  recipients: VaultRecipientKey[],
): Promise<EncryptedVaultEntry> {
  if (!isVaultEntry(entry) || recipients.length === 0) throw new Error('invalid vault entry');
  const contentKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const rawKey = await crypto.subtle.exportKey('raw', contentKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: ENTRY_AAD },
    contentKey,
    new TextEncoder().encode(JSON.stringify(entry)),
  );
  const accesses = await Promise.all(recipients.map(async ({ userId, publicKey }) => {
    const key = await crypto.subtle.importKey(
      'jwk',
      publicKey,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    );
    const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, rawKey);
    return { userId, wrappedKey: bytesToBase64(new Uint8Array(wrappedKey)) };
  }));
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    accesses,
  };
}

export async function decryptVaultEntry(
  ciphertext: string,
  iv: string,
  wrappedKey: string,
  privateKey: CryptoKey,
): Promise<VaultEntry> {
  const rawKey = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, base64ToBytes(wrappedKey));
  const contentKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv), additionalData: ENTRY_AAD },
    contentKey,
    base64ToBytes(ciphertext),
  );
  const entry: unknown = JSON.parse(new TextDecoder().decode(plaintext));
  if (!isVaultEntry(entry)) throw new Error('invalid vault entry');
  return entry;
}
