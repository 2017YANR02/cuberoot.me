const KDF_ITERATIONS = 600_000;
const PRIVATE_KEY_AAD = new TextEncoder().encode('CubeRoot vault private key v1');
export const VAULT_RECOVERY_KEY_CONTEXT = 'CubeRoot vault recovery key v1';
const RECOVERY_KEY_AAD = new TextEncoder().encode(VAULT_RECOVERY_KEY_CONTEXT);
const ENTRY_AAD = new TextEncoder().encode('CubeRoot vault entry v1');
export const VAULT_RECOVERY_CODE_PREFIX = 'CRV1-';
// Keep the complete encrypted envelope within the API/DB 4 MiB limit.
const MAX_CIPHERTEXT_BYTES = 4 * 1024 * 1024;
export const MAX_VAULT_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_VAULT_IMAGES = 10;
export const MAX_VAULT_FIELDS = 50;
export const MAX_VAULT_ADDITIONAL_ACCOUNTS = 50;
export const MAX_VAULT_INFORMATION_GROUPS = 50;

export interface VaultImage {
  status?: VaultStatus;
  id: string;
  name: string;
  dataUrl: string;
}

export const isValidVaultPassphrase = (value: string): boolean => /^[0-9]{6}$/.test(value);

export interface VaultField {
  status?: VaultStatus;
  id: string;
  label: string;
  value: string;
  secret: boolean;
}

export type VaultStatus = 'verified' | 'problem' | 'untested';

export interface VaultAccount {
  id: string;
  name: string;
  fields: VaultField[];
  notes?: string;
  privateNotes?: string;
  accountStatus?: VaultStatus;
}

export interface VaultInformation {
  manualFieldOrder?: boolean;
  status?: VaultStatus;
  fields: VaultField[];
  notes: string;
  images?: VaultImage[];
}

export interface VaultInformationGroup extends VaultInformation {
  id: string;
  name: string;
}

export interface VaultEntry extends VaultInformation {
  id: string;
  title: string;
  privateNotes?: string;
  itemStatus?: VaultStatus;
  primaryInformationIndex?: number;
  primaryInformationRemoved?: true;
  informationName?: string;
  informationGroups?: VaultInformationGroup[];
  category?: 'personal' | 'accounts' | 'business' | 'other';
  mergedInto?: { id: string; title: string };
  accountName?: string;
  accountStatus?: VaultStatus;
  accounts?: VaultAccount[];
  /** Position of the account stored directly on the entry among all account groups. */
  primaryAccountIndex?: number;
}

export function vaultEntryImages(entry: Pick<VaultEntry, 'images' | 'informationGroups'>): VaultImage[] {
  return [...(entry.images ?? []), ...(entry.informationGroups ?? []).flatMap((group) => group.images ?? [])];
}

export interface EncryptedPrivateKey {
  version: 1;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  recovery: {
    version: 1;
    iv: string;
    ciphertext: string;
  };
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

export function bytesToBase64(bytes: Uint8Array): string {
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

function vaultImageBytes(value: unknown): number | null {
  if (typeof value !== 'string' || value.length > 4 * Math.ceil(MAX_VAULT_IMAGE_BYTES / 3) + 32) return null;
  const prefix = /^data:image\/(jpeg|png|webp);base64,/.exec(value);
  if (!prefix) return null;
  const encoded = value.slice(prefix[0].length);
  if (!encoded.length || encoded.length % 4 || /[^A-Za-z0-9+/=]/.test(encoded)
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return null;
  const bytes = base64ToBytes(encoded);
  const signature = prefix[1] === 'jpeg'
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : prefix[1] === 'png'
      ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)
      : new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  return signature ? bytes.length : null;
}

export function validateVaultImages(images: unknown): images is VaultImage[] {
  if (!Array.isArray(images) || images.length > MAX_VAULT_IMAGES) return false;
  const ids = new Set<string>();
  let total = 0;
  for (const image of images) {
    if (!image || !isOptionalVaultStatus(image.status) || typeof image.id !== 'string' || !image.id || image.id.length > 100 || ids.has(image.id)
      || typeof image.name !== 'string' || !image.name.trim() || image.name.length > 200) return false;
    ids.add(image.id);
    const size = vaultImageBytes(image.dataUrl);
    if (size === null) return false;
    total += size;
    if (total > MAX_VAULT_IMAGE_BYTES) return false;
  }
  return true;
}

/** Original bytes stay in the encrypted entry; never use the public image uploader. */
export async function readVaultImages(files: File[], existing: VaultImage[] = []): Promise<VaultImage[]> {
  if (existing.length + files.length > MAX_VAULT_IMAGES
    || files.reduce((sum, file) => sum + file.size, 0) > MAX_VAULT_IMAGE_BYTES) throw new Error('vault_image_limit');
  const added: VaultImage[] = [];
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('vault_image_type');
    const image = {
      id: crypto.randomUUID(), name: file.name.slice(0, 200),
      dataUrl: `data:${file.type};base64,${bytesToBase64(new Uint8Array(await file.arrayBuffer()))}`,
    };
    if (vaultImageBytes(image.dataUrl) === null) throw new Error('vault_image_type');
    added.push(image);
  }
  const images = [...existing, ...added];
  if (!validateVaultImages(images)) throw new Error('vault_image_limit');
  return images;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function recoveryKeyBytes(code: string): Uint8Array<ArrayBuffer> {
  const value = code.trim();
  if (!value.startsWith(VAULT_RECOVERY_CODE_PREFIX)) throw new Error('invalid recovery code');
  const encoded = value.slice(VAULT_RECOVERY_CODE_PREFIX.length);
  if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) throw new Error('invalid recovery code');
  return base64ToBytes(encoded.replace(/-/g, '+').replace(/_/g, '/') + '=');
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

async function encryptPrivateKeyWithPassphrase(
  privateKeyBytes: ArrayBuffer,
  passphrase: string,
): Promise<Omit<EncryptedPrivateKey, 'recovery'>> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await passphraseKey(passphrase, salt, KDF_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: PRIVATE_KEY_AAD },
    key,
    privateKeyBytes,
  );
  return {
    version: 1,
    iterations: KDF_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

async function importVaultPrivateKey(privateKeyBytes: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  );
}

export async function createVaultKeyProfile(passphrase: string): Promise<{
  publicKey: JsonWebKey;
  encryptedPrivateKey: EncryptedPrivateKey;
  recoveryCode: string;
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
  const recoveryBytes = crypto.getRandomValues(new Uint8Array(32));
  const recoveryIv = crypto.getRandomValues(new Uint8Array(12));
  const recoveryKey = await crypto.subtle.importKey('raw', recoveryBytes, 'AES-GCM', false, ['encrypt']);
  const recoveryCiphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: recoveryIv, additionalData: RECOVERY_KEY_AAD },
    recoveryKey,
    privateKeyBytes,
  );
  const passphraseEnvelope = await encryptPrivateKeyWithPassphrase(privateKeyBytes, passphrase);
  return {
    publicKey,
    encryptedPrivateKey: {
      ...passphraseEnvelope,
      recovery: {
        version: 1,
        iv: bytesToBase64(recoveryIv),
        ciphertext: bytesToBase64(new Uint8Array(recoveryCiphertext)),
      },
    },
    recoveryCode: `${VAULT_RECOVERY_CODE_PREFIX}${bytesToBase64Url(recoveryBytes)}`,
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
  return importVaultPrivateKey(privateKey);
}

export async function recoverVaultPrivateKey(
  recoveryCode: string,
  newPassphrase: string,
  envelope: EncryptedPrivateKey,
): Promise<{ privateKey: CryptoKey; encryptedPrivateKey: EncryptedPrivateKey }> {
  if (envelope.recovery?.version !== 1) throw new Error('recovery unavailable');
  const iv = base64ToBytes(envelope.recovery.iv);
  if (iv.length !== 12) throw new Error('invalid recovery profile');
  const key = await crypto.subtle.importKey('raw', recoveryKeyBytes(recoveryCode), 'AES-GCM', false, ['decrypt']);
  const privateKeyBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: RECOVERY_KEY_AAD },
    key,
    base64ToBytes(envelope.recovery.ciphertext),
  );
  return {
    privateKey: await importVaultPrivateKey(privateKeyBytes),
    encryptedPrivateKey: {
      ...await encryptPrivateKeyWithPassphrase(privateKeyBytes, newPassphrase),
      recovery: envelope.recovery,
    },
  };
}

function isVaultFields(value: unknown): value is VaultField[] {
  return Array.isArray(value) && value.length <= MAX_VAULT_FIELDS && value.every((field) => {
    if (!field || typeof field !== 'object') return false;
    const item = field as Record<string, unknown>;
    return typeof item.id === 'string' && item.id.length <= 100
      && typeof item.label === 'string' && item.label.length <= 100
      && typeof item.value === 'string' && item.value.length <= 100_000
      && typeof item.secret === 'boolean' && isOptionalVaultStatus(item.status);
  });
}

function isOptionalVaultStatus(value: unknown): boolean {
  return value === undefined || value === 'verified' || value === 'problem' || value === 'untested';
}

function isVaultAccounts(value: unknown): value is VaultAccount[] {
  if (!Array.isArray(value) || value.length > MAX_VAULT_ADDITIONAL_ACCOUNTS) return false;
  const ids = new Set<string>();
  return value.every((account) => {
    if (!account || typeof account !== 'object') return false;
    const { id, name, fields, notes, privateNotes, accountStatus } = account as Record<string, unknown>;
    if (typeof id !== 'string' || !id || id.length > 100 || ids.has(id)
      || typeof name !== 'string' || name.length > 200 || !isVaultFields(fields)
      || !isOptionalVaultStatus(accountStatus)
      || (notes !== undefined && (typeof notes !== 'string' || notes.length > 500_000))
      || (privateNotes !== undefined && (typeof privateNotes !== 'string' || privateNotes.length > 500_000))) return false;
    ids.add(id);
    return true;
  });
}

function isVaultInformationGroups(value: unknown): value is VaultInformationGroup[] {
  if (!Array.isArray(value) || value.length > MAX_VAULT_INFORMATION_GROUPS) return false;
  const ids = new Set<string>();
  return value.every((group) => {
    if (!group || typeof group !== 'object') return false;
    const { id, name, fields, notes, images, status, manualFieldOrder } = group as Record<string, unknown>;
    if (typeof id !== 'string' || !id || id.length > 100 || ids.has(id)
      || typeof name !== 'string' || name.length > 200
      || (manualFieldOrder !== undefined && typeof manualFieldOrder !== 'boolean')
      || !isOptionalVaultStatus(status) || !isVaultFields(fields) || typeof notes !== 'string' || notes.length > 500_000
      || (images !== undefined && !Array.isArray(images))) return false;
    ids.add(id);
    return true;
  });
}

export function isVaultEntry(value: unknown): value is VaultEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  if (entry.mergedInto !== undefined) {
    const target = entry.mergedInto as Record<string, unknown> | null;
    if (!target || typeof target !== 'object' || typeof target.id !== 'string' || !target.id || target.id.length > 100
      || typeof target.title !== 'string' || target.title.length > 200) return false;
  }
  if (typeof entry.id !== 'string' || entry.id.length > 100
    || typeof entry.title !== 'string' || entry.title.length > 200
    || typeof entry.notes !== 'string' || entry.notes.length > 500_000
    || (entry.privateNotes !== undefined && (typeof entry.privateNotes !== 'string' || entry.privateNotes.length > 500_000))
    || (entry.images !== undefined && !Array.isArray(entry.images))
    || (entry.primaryInformationRemoved !== undefined && entry.primaryInformationRemoved !== true)
    || (entry.manualFieldOrder !== undefined && typeof entry.manualFieldOrder !== 'boolean')
    || (entry.informationName !== undefined && (typeof entry.informationName !== 'string' || entry.informationName.length > 200))
    || (entry.informationGroups !== undefined && !isVaultInformationGroups(entry.informationGroups))
    || (entry.category !== undefined && !['personal', 'accounts', 'business', 'other'].includes(entry.category as string))
    || (entry.accountName !== undefined && (typeof entry.accountName !== 'string' || entry.accountName.length > 200))
    || !isOptionalVaultStatus(entry.accountStatus)
    || (entry.accounts !== undefined && !isVaultAccounts(entry.accounts))) return false;
  if (!isOptionalVaultStatus(entry.status) || !isOptionalVaultStatus(entry.itemStatus)) return false;
  const infoIndex = entry.primaryInformationIndex;
  if (infoIndex !== undefined && (typeof infoIndex !== 'number' || !Number.isInteger(infoIndex)
    || infoIndex < 0 || infoIndex > (Array.isArray(entry.informationGroups) ? entry.informationGroups.length : 0))) return false;
  const index = entry.primaryAccountIndex;
  if (index !== undefined && (typeof index !== 'number' || !Number.isInteger(index)
    || index < 0 || index > (Array.isArray(entry.accounts) ? entry.accounts.length : 0))) return false;
  return isVaultFields(entry.fields) && validateVaultImages(vaultEntryImages({
    images: entry.images as VaultImage[] | undefined,
    informationGroups: entry.informationGroups as VaultInformationGroup[] | undefined,
  }));
}

export async function encryptVaultEntry(
  entry: VaultEntry,
  recipients: VaultRecipientKey[],
): Promise<EncryptedVaultEntry> {
  if (!isVaultEntry(entry) || recipients.length === 0) throw new Error('invalid vault entry');
  const plaintext = new TextEncoder().encode(JSON.stringify(entry));
  if (4 * Math.ceil((plaintext.byteLength + 16) / 3) > MAX_CIPHERTEXT_BYTES) throw new Error('vault_entry_limit');
  const contentKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const rawKey = await crypto.subtle.exportKey('raw', contentKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: ENTRY_AAD },
    contentKey,
    plaintext,
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
