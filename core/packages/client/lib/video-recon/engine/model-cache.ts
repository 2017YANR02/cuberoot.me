import type { ModelVariant } from './detector';

// Also reads models saved by the frame-count offline shell in previous releases.
const CACHE_NAME = 'cuberoot-video-recon-v1';

async function verify(buffer: ArrayBuffer, expectedBytes: number, revision?: string) {
  if (buffer.byteLength !== expectedBytes) return;
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (!revision || sha256.startsWith(revision)) return { bytes: new Uint8Array(buffer), sha256 };
}

async function download(url: string, size: number, report: (bytes: number) => void) {
  report(0);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Model download failed (${response.status}).`);
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    report(buffer.byteLength);
    return buffer;
  }
  const reader = response.body.getReader();
  const buffer = new Uint8Array(size);
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (received + value.byteLength > size) {
      await reader.cancel();
      throw new Error(`Model exceeds its declared size: ${url}`);
    }
    buffer.set(value, received);
    received += value.byteLength;
    report(received);
  }
  if (received !== size) throw new Error(`Incomplete model download: ${url}`);
  return buffer.buffer;
}

export async function loadModelBytes(baseUrl: string, variant: Pick<ModelVariant, 'file' | 'bytes'>, report: (bytes: number) => void) {
  const url = new URL(`models/${variant.file}`, baseUrl).href;
  const revision = variant.file.match(/\.([0-9a-f]{16})\.onnx$/)?.[1];
  let cache: Cache | undefined;
  try {
    if (revision) cache = await globalThis.caches.open(CACHE_NAME);
  } catch { /* Storage can be disabled in the browser. */ }

  async function load() {
    if (cache) {
      try {
        const saved = await cache.match(url);
        if (saved) {
          const model = await verify(await saved.arrayBuffer(), variant.bytes, revision);
          if (model) return model;
          await cache.delete(url);
        }
      } catch { /* Unreadable entries are replaced by the verified download. */ }
    }
    const buffer = await download(url, variant.bytes, report);
    const model = await verify(buffer, variant.bytes, revision);
    if (!model) throw new Error(`Model integrity check failed: ${variant.file}`);
    if (cache) {
      try { await cache.put(url, new Response(buffer)); } catch { /* Out of quota: use the downloaded bytes. */ }
    }
    return model;
  }

  // A second tab waits for the first download, then checks the same cache.
  if (cache && globalThis.navigator?.locks) return navigator.locks.request(url, load);
  return load();
}
