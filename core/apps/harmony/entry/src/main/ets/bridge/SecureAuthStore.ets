import { asset } from '@kit.AssetStoreKit';
import { util } from '@kit.ArkTS';
import { BusinessError } from '@kit.BasicServicesKit';

const NOT_FOUND = 24000002;
const CHUNK_BYTES = 900;
const MAX_VALUE_BYTES = 16 * 1024;
const MAX_CHUNKS = Math.ceil(MAX_VALUE_BYTES / CHUNK_BYTES);
const ALLOWED_KEYS = ['session', 'pending_auth', 'net_battle_session'];

interface AssetManifest {
  bytes: number;
  chunks: number;
  generation: string;
  version: number;
}

function encode(value: string): Uint8Array {
  return new util.TextEncoder().encodeInto(value);
}

function decode(value: Uint8Array): string {
  return util.TextDecoder.create('utf-8', { ignoreBOM: true }).decodeToString(value, { stream: false });
}

function isNotFound(error: Object): boolean {
  return (error as BusinessError).code === NOT_FOUND;
}

function ensureAllowedKey(key: string): void {
  if (!ALLOWED_KEYS.includes(key)) throw new Error('unsupported secure-storage key');
}

function manifestAlias(key: string): string {
  return `cuberoot.auth.${key}.manifest`;
}

function chunkAlias(key: string, generation: string, index: number): string {
  return `cuberoot.auth.${key}.${generation}.${index}`;
}

async function readSecret(alias: string): Promise<Uint8Array | null> {
  const query: asset.AssetMap = new Map();
  query.set(asset.Tag.ALIAS, encode(alias));
  query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ALL);
  try {
    const result = await asset.query(query);
    if (result.length !== 1) return null;
    return result[0].get(asset.Tag.SECRET) as Uint8Array;
  } catch (error) {
    if (isNotFound(error as Object)) return null;
    throw error as Error;
  }
}

async function addSecret(alias: string, secret: Uint8Array): Promise<void> {
  const attributes: asset.AssetMap = new Map();
  attributes.set(asset.Tag.ALIAS, encode(alias));
  attributes.set(asset.Tag.SECRET, secret);
  attributes.set(asset.Tag.ACCESSIBILITY, asset.Accessibility.DEVICE_UNLOCKED);
  try {
    await asset.add(attributes);
  } catch (error) {
    throw error as Error;
  }
}

async function updateSecret(alias: string, secret: Uint8Array): Promise<void> {
  const query: asset.AssetMap = new Map();
  query.set(asset.Tag.ALIAS, encode(alias));
  const attributes: asset.AssetMap = new Map();
  attributes.set(asset.Tag.SECRET, secret);
  try {
    await asset.update(query, attributes);
  } catch (error) {
    if (!isNotFound(error as Object)) throw error as Error;
    await addSecret(alias, secret);
  }
}

async function removeSecret(alias: string): Promise<void> {
  const query: asset.AssetMap = new Map();
  query.set(asset.Tag.ALIAS, encode(alias));
  try {
    await asset.remove(query);
  } catch (error) {
    if (!isNotFound(error as Object)) throw error as Error;
  }
}

function decodeManifest(value: Uint8Array | null): AssetManifest | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decode(value)) as AssetManifest;
    if (parsed.version !== 1 || (parsed.generation !== 'a' && parsed.generation !== 'b') ||
      !Number.isSafeInteger(parsed.chunks) || parsed.chunks < 1 || parsed.chunks > MAX_CHUNKS ||
      !Number.isSafeInteger(parsed.bytes) || parsed.bytes < 1 || parsed.bytes > MAX_VALUE_BYTES) {
      return null;
    }
    return parsed;
  } catch (_) {
    return null;
  }
}

export class SecureAuthStore {
  private tail: Promise<void> = Promise.resolve();

  async getItem(key: string): Promise<string | null> {
    ensureAllowedKey(key);
    await this.tail;
    const manifest = decodeManifest(await readSecret(manifestAlias(key)));
    if (!manifest) return null;
    const combined = new Uint8Array(manifest.bytes);
    let offset = 0;
    for (let index = 0; index < manifest.chunks; index++) {
      const chunk = await readSecret(chunkAlias(key, manifest.generation, index));
      if (!chunk || offset + chunk.length > combined.length) return null;
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    if (offset !== manifest.bytes) return null;
    return decode(combined);
  }

  setItem(key: string, value: string): Promise<void> {
    ensureAllowedKey(key);
    const operation = this.tail.then(() => this.setItemOnce(key, value));
    this.tail = operation.catch(() => undefined);
    return operation;
  }

  removeItem(key: string): Promise<void> {
    ensureAllowedKey(key);
    const operation = this.tail.then(() => this.removeItemOnce(key));
    this.tail = operation.catch(() => undefined);
    return operation;
  }

  private async setItemOnce(key: string, value: string): Promise<void> {
    const bytes = encode(value);
    if (bytes.length < 1 || bytes.length > MAX_VALUE_BYTES) throw new Error('secure-storage value too large');
    const oldManifest = decodeManifest(await readSecret(manifestAlias(key)));
    const generation = oldManifest?.generation === 'a' ? 'b' : 'a';
    await this.removeGeneration(key, generation, MAX_CHUNKS);
    const count = Math.ceil(bytes.length / CHUNK_BYTES);
    try {
      for (let index = 0; index < count; index++) {
        const begin = index * CHUNK_BYTES;
        await addSecret(chunkAlias(key, generation, index), bytes.slice(begin, begin + CHUNK_BYTES));
      }
      const manifest: AssetManifest = { bytes: bytes.length, chunks: count, generation, version: 1 };
      await updateSecret(manifestAlias(key), encode(JSON.stringify(manifest)));
    } catch (error) {
      await this.removeGeneration(key, generation, count);
      throw error as Error;
    }
    if (oldManifest) await this.removeGeneration(key, oldManifest.generation, oldManifest.chunks);
  }

  private async removeItemOnce(key: string): Promise<void> {
    const manifest = decodeManifest(await readSecret(manifestAlias(key)));
    await removeSecret(manifestAlias(key));
    if (manifest) await this.removeGeneration(key, manifest.generation, manifest.chunks);
    await this.removeGeneration(key, manifest?.generation === 'a' ? 'b' : 'a', MAX_CHUNKS);
  }

  private async removeGeneration(key: string, generation: string, count: number): Promise<void> {
    for (let index = 0; index < count; index++) {
      await removeSecret(chunkAlias(key, generation, index));
    }
  }
}
