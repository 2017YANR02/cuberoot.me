/** Downloaded public corpus; no solver or pruning table runs in the browser. */
import type { AlgCase, AlgFile } from '@cuberoot/shared/alg';
import { decodeDoubleZbll, DOUBLE_ZBLL_MOVES, DOUBLE_ZBLL_RECORD_BYTES, type DoubleZbllManifest } from '@cuberoot/shared/double-zbll';
import { caseKey } from './trainer-case-key';

const ROOT = '/data/double-zbll/';
const CACHE = 'cuberoot-double-zbll-data-v1';
export const DOUBLE_ZBLL_APP_CACHE = 'cuberoot-double-zbll-app-v1';
interface Corpus { manifest: DoubleZbllManifest; file: AlgFile; data: Uint8Array; indices: Map<string, number> }
let corpus: Corpus | undefined;
let pending: Promise<Corpus> | undefined;

async function digest(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}

async function readCorpus(read: (path: string) => Promise<Response | undefined>): Promise<Corpus> {
  const manifestResponse = await read(`${ROOT}manifest.json`);
  if (!manifestResponse?.ok) throw new Error('Double ZBLL corpus unavailable');
  const manifest = await manifestResponse.json() as DoubleZbllManifest;
  if (manifest.schema !== 1 || manifest.caseCount !== 472 || manifest.pairCount !== 472 ** 2
    || manifest.recordBytes !== DOUBLE_ZBLL_RECORD_BYTES || manifest.metric !== 'HTM'
    || JSON.stringify(manifest.moves) !== JSON.stringify(DOUBLE_ZBLL_MOVES)
    || !/^pairs-[a-f0-9]{16}\.bin$/.test(manifest.dataFile)
    || !/^cases-[a-f0-9]{16}\.json$/.test(manifest.casesFile)
    || manifest.dataBytes !== manifest.pairCount * DOUBLE_ZBLL_RECORD_BYTES) throw new Error('Invalid Double ZBLL manifest');
  const [dataResponse, casesResponse] = await Promise.all([read(ROOT + manifest.dataFile), read(ROOT + manifest.casesFile)]);
  if (!dataResponse?.ok || !casesResponse?.ok) throw new Error('Incomplete Double ZBLL corpus');
  const [dataBytes, casesBytes] = await Promise.all([dataResponse.arrayBuffer(), casesResponse.arrayBuffer()]);
  if (dataBytes.byteLength !== manifest.dataBytes || await digest(dataBytes) !== manifest.dataSha256
    || await digest(casesBytes) !== manifest.casesSha256) throw new Error('Double ZBLL checksum mismatch');
  const file = JSON.parse(new TextDecoder().decode(casesBytes)) as AlgFile;
  const indices = new Map(file.cases.map((c, i) => [caseKey(c), i]));
  if (file.cases.length !== manifest.caseCount || indices.size !== manifest.caseCount) throw new Error('Invalid Double ZBLL cases');
  const data = new Uint8Array(dataBytes);
  for (let i = 0; i < manifest.pairCount; i++) decodeDoubleZbll(data, manifest.caseCount, Math.floor(i / manifest.caseCount), i % manifest.caseCount);
  return { manifest, file, data, indices };
}

export function doubleZbllReady(): boolean { return !!corpus; }
export function doubleZbllSupports(cases: AlgCase[]): boolean { return !!corpus && cases.every(c => corpus!.indices.has(caseKey(c))); }
export function doubleZbllScramble(top: string, bottom: string): string {
  if (!corpus) throw new Error('Double ZBLL corpus is not loaded');
  return decodeDoubleZbll(corpus.data, corpus.manifest.caseCount, corpus.indices.get(top) ?? -1, corpus.indices.get(bottom) ?? -1);
}

/** Cache-first: offline readers keep the complete, verified version they downloaded. */
export async function loadDoubleZbll(): Promise<Corpus> {
  if (corpus) return corpus;
  if (pending) return pending;
  pending = (async () => {
    const cache = typeof caches === 'undefined' ? undefined : await caches.open(CACHE);
    if (cache) {
      try { corpus = await readCorpus(path => cache.match(path)); return corpus; } catch { /* absent or evicted: fetch a complete version */ }
    }
    const responses = new Map<string, Response>();
    const result = await readCorpus(async path => {
      const response = await fetch(path, { cache: 'no-cache', signal: AbortSignal.timeout(60000) });
      responses.set(path, response.clone());
      return response;
    });
    // Publish the manifest last, after both immutable resources are safely stored.
    if (cache) {
      for (const [path, response] of responses) if (!path.endsWith('/manifest.json')) await cache.put(path, response);
      await cache.put(`${ROOT}manifest.json`, responses.get(`${ROOT}manifest.json`)!);
    }
    corpus = result;
    return result;
  })().finally(() => { pending = undefined; });
  return pending;
}

export async function cachedDoubleZbllCases(): Promise<AlgFile | undefined> {
  if (corpus) return corpus.file;
  if (typeof caches === 'undefined') return undefined;
  try { corpus = await readCorpus(path => caches.open(CACHE).then(cache => cache.match(path))); return corpus.file; }
  catch { return undefined; }
}

export function doubleZbllScope(): string {
  return `${location.pathname.startsWith('/zh/') ? '/zh' : ''}/alg/3x3/zbll/`;
}

/** Cache the two public page shells and their own assets; never cache account/API responses. */
export async function installDoubleZbllOffline(onProgress: (done: number, total: number) => void): Promise<void> {
  await loadDoubleZbll();
  if (!('serviceWorker' in navigator) || typeof caches === 'undefined') throw new Error('Offline storage unavailable');
  const scope = doubleZbllScope();
  const registration = await navigator.serviceWorker.register('/double-zbll-sw.js', { scope });
  const worker = registration.installing ?? registration.waiting;
  if (worker && worker.state !== 'activated') await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Offline worker activation timed out')), 30000);
    const check = () => {
      if (worker.state === 'activated' || worker.state === 'redundant') {
        clearTimeout(timeout); worker.removeEventListener('statechange', check);
        if (worker.state === 'activated') resolve(); else reject(new Error('Offline worker failed'));
      }
    };
    worker.addEventListener('statechange', check); check();
  });
  const cache = await caches.open(DOUBLE_ZBLL_APP_CACHE);
  const queue = new Set<string>([scope + 'run', scope + 'select']);
  const allowed = (url: URL) => url.origin === location.origin && /^\/(?:_next\/static\/|fonts\/|cubing-chunks\/)/.test(url.pathname);
  for (const entry of performance.getEntriesByType('resource')) {
    const url = new URL(entry.name);
    if (allowed(url)) queue.add(url.href);
  }
  let done = 0;
  // HTML exposes route chunks even when the selection page has not been visited yet.
  for (const path of queue) {
    const response = await fetch(path, { cache: 'reload', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('Could not download an offline resource');
    const type = response.headers.get('content-type') ?? '';
    if (type.includes('text/html') || type.includes('text/css')) {
      const content = await response.clone().text();
      const refs = type.includes('text/html')
        ? Array.from(content.matchAll(/(?:src|href)=["']([^"']+)["']/g), m => m[1])
        : Array.from(content.matchAll(/url\(["']?([^"')]+)["']?\)/g), m => m[1]);
      for (const ref of refs) { const url = new URL(ref, new URL(path, location.href)); if (allowed(url)) queue.add(url.href); }
    }
    await cache.put(path, response);
    onProgress(++done, queue.size);
  }
  await cache.put(scope + '__offline_ready', new Response(JSON.stringify({ savedAt: Date.now(), version: corpus!.manifest.version, resources: [...queue] })));
  void navigator.storage?.persist?.();
}

export async function doubleZbllOfflineReady(): Promise<boolean> {
  if (typeof caches === 'undefined' || !('serviceWorker' in navigator)) return false;
  const scope = doubleZbllScope();
  const [cache, registration] = await Promise.all([caches.open(DOUBLE_ZBLL_APP_CACHE), navigator.serviceWorker.getRegistration(scope)]);
  const marker = await cache.match(scope + '__offline_ready');
  if (!marker) return false;
  const saved = await marker.json() as { resources?: string[] };
  if (!Array.isArray(saved.resources) || !saved.resources.length) return false;
  const resourcesPresent = (await Promise.all(saved.resources.map(path => cache.match(path)))).every(Boolean);
  return resourcesPresent && !!registration?.active && registration.scope === new URL(scope, location.href).href
    && registration.active.scriptURL === new URL('/double-zbll-sw.js', location.href).href
    && !!await cache.match(scope + '__offline_ready')
    && !!await cache.match(scope + 'run') && !!await cache.match(scope + 'select') && !!await cachedDoubleZbllCases();
}
