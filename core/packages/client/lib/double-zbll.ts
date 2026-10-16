/** Downloaded public corpus; no solver or pruning table runs in the browser. */
import type { AlgCase, AlgFile } from '@cuberoot/shared/alg';
import { decodeDoubleZbll, validDoubleZbllManifest, type DoubleZbllManifest } from '@cuberoot/shared/double-zbll';
import { caseKey } from './trainer-case-key';
import { bestErgonomicOrientationIndex, rotateMovesToFrame } from './rotate-solution';

const ROOT = '/data/double-zbll/';
const CACHE = 'cuberoot-double-zbll-data-v1';
export const DOUBLE_ZBLL_APP_CACHE = 'cuberoot-double-zbll-app-v3';
interface Corpus { manifest: DoubleZbllManifest; file: AlgFile; data: Uint8Array; indices: Map<string, number> }
let corpus: Corpus | undefined;
let pending: Promise<Corpus> | undefined;
let checkedVersion = false;

async function digest(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}

async function readCorpus(read: (path: string) => Promise<Response | undefined>): Promise<Corpus> {
  const manifestResponse = await read(`${ROOT}manifest.json`);
  if (!manifestResponse?.ok) throw new Error('Double ZBLL corpus unavailable');
  const manifest = await manifestResponse.json() as DoubleZbllManifest;
  if (!validDoubleZbllManifest(manifest)) throw new Error('Invalid Double ZBLL manifest');
  const [dataResponse, casesResponse] = await Promise.all([read(ROOT + manifest.dataFile), read(ROOT + manifest.casesFile)]);
  if (!dataResponse?.ok || !casesResponse?.ok) throw new Error('Incomplete Double ZBLL corpus');
  const [dataBytes, casesBytes] = await Promise.all([dataResponse.arrayBuffer(), casesResponse.arrayBuffer()]);
  if (dataBytes.byteLength !== manifest.dataBytes || await digest(dataBytes) !== manifest.dataSha256
    || await digest(casesBytes) !== manifest.casesSha256) throw new Error('Double ZBLL checksum mismatch');
  const file = JSON.parse(new TextDecoder().decode(casesBytes)) as AlgFile;
  const indices = new Map(file.cases.map((c, i) => [caseKey(c), i]));
  if (file.cases.length !== manifest.caseCount || indices.size !== manifest.caseCount) throw new Error('Invalid Double ZBLL cases');
  if (manifest.caseCount === 493 && file.cases.some((c,i) => isDoubleZbllPllCase(c) !== (i >= 472))) throw new Error('Invalid Double ZBLL PLL cases');
  const data = new Uint8Array(dataBytes);
  for (let i = 0; i < manifest.pairCount; i++) decodeDoubleZbll(data, manifest.caseCount, Math.floor(i / manifest.caseCount), i % manifest.caseCount);
  return { manifest, file, data, indices };
}

export function doubleZbllReady(): boolean { return !!corpus; }
export const isDoubleZbllPllCase = (c: Pick<AlgCase,'subgroup'>): boolean => c.subgroup.startsWith('PLL/');
export function doubleZbllPllCases(): AlgCase[] { return corpus?.file.cases.filter(isDoubleZbllPllCase) ?? []; }
export function doubleZbllSupports(cases: AlgCase[]): boolean { return !!corpus && cases.every(c => corpus!.indices.has(caseKey(c))); }
export function doubleZbllScramble(top: string, bottom: string): string {
  if (!corpus) throw new Error('Double ZBLL corpus is not loaded');
  return decodeDoubleZbll(corpus.data, corpus.manifest.caseCount, corpus.indices.get(top) ?? -1, corpus.indices.get(bottom) ?? -1);
}

/** Keep the optimal solution, choosing only its easiest axis-preserving frame. */
export function orientDoubleZbllScramble(scramble: string): { scramble: string; swapped: boolean; rotation: string } {
  const candidates = [false, true].flatMap(swapped => ['', 'y', 'y2', "y'"].map(y => {
    const rotation = [swapped ? 'z2' : '', y].filter(Boolean).join(' ');
    return { scramble: rotateMovesToFrame(scramble, rotation), swapped, rotation };
  }));
  return candidates[bestErgonomicOrientationIndex(candidates.map(candidate => candidate.scramble))];
}

export function doubleZbllTrainingPair(top: string, bottom: string): { key: string; bottomKey: string; scramble: string } {
  const oriented = orientDoubleZbllScramble(doubleZbllScramble(top, bottom));
  return { key: oriented.swapped ? bottom : top, bottomKey: oriented.swapped ? top : bottom, scramble: oriented.scramble };
}

/** Check for a new version once per page load; retain the verified offline copy on failure. */
export async function loadDoubleZbll(): Promise<Corpus> {
  if (corpus && checkedVersion) return corpus;
  if (pending) return pending;
  pending = (async () => {
    const cache = typeof caches === 'undefined' ? undefined : await caches.open(CACHE);
    let saved = corpus;
    if (!saved && cache) {
      try { saved = await readCorpus(path => cache.match(path)); } catch { /* absent or evicted */ }
    }
    const responses = new Map<string, Response>();
    let result: Corpus;
    try {
      // The query also bypasses manifest entries held by an older cache-first
      // service worker. Only publish the canonical cache key after validation.
      const fresh = await fetch(`${ROOT}manifest.json?check=1`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!fresh.ok) throw new Error('Double ZBLL version unavailable');
      const version = await fresh.clone().json() as DoubleZbllManifest;
      if (saved && version.dataSha256 === saved.manifest.dataSha256 && version.casesSha256 === saved.manifest.casesSha256) {
        corpus = saved; checkedVersion = true; return saved;
      }
      result = await readCorpus(async path => {
        const response = path.endsWith('/manifest.json') ? fresh.clone()
          : (await cache?.match(path)) ?? await fetch(path, { cache: 'no-cache', signal: AbortSignal.timeout(60000) });
        responses.set(path, response.clone());
        return response;
      });
    } catch (error) {
      if (!saved) throw error;
      corpus = saved; checkedVersion = true; return saved;
    }
    // Publish the manifest last, after both immutable resources are safely stored.
    if (cache) {
      for (const [path, response] of responses) if (!path.endsWith('/manifest.json')) await cache.put(path, response);
      await cache.put(`${ROOT}manifest.json`, responses.get(`${ROOT}manifest.json`)!);
    }
    corpus = result;
    checkedVersion = true;
    return result;
  })().finally(() => { pending = undefined; });
  return pending;
}

export async function cachedDoubleZbllCases(): Promise<AlgFile | undefined> {
  const zbllOnly = (file: AlgFile): AlgFile => ({ ...file, cases: file.cases.filter(c => !isDoubleZbllPllCase(c)) });
  if (corpus) return zbllOnly(corpus.file);
  if (typeof caches === 'undefined') return undefined;
  try { corpus = await readCorpus(path => caches.open(CACHE).then(cache => cache.match(path))); return zbllOnly(corpus.file); }
  catch { return undefined; }
}

export function doubleZbllOfflinePages(pathname: string): { scope: string; pages: string[]; marker: string } {
  const prefix = pathname.startsWith('/zh/') ? '/zh' : '';
  if (pathname === `${prefix}/timer`) {
    const scope = `${prefix}/timer`;
    // The timer has one public shell; training state is read from the URL after hydration.
    return { scope, pages: [scope], marker: scope + '?double-zbll-offline-ready=1' };
  }
  const scope = `${prefix}/alg/3x3/zbll/`;
  return { scope, pages: [scope + 'run', scope + 'select'], marker: scope + '__offline_ready' };
}

export function doubleZbllScope(): string {
  return doubleZbllOfflinePages(location.pathname).scope;
}

const offlineInstalls = new Map<string, Promise<void>>();
/** One background check/install per scope, including concurrent React mounts. */
export function ensureDoubleZbllOffline(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || typeof caches === 'undefined' || navigator.onLine === false) return Promise.resolve();
  const scope = doubleZbllScope();
  const pending = offlineInstalls.get(scope);
  if (pending) return pending;
  const task = (async () => {
    if (!await doubleZbllOfflineReady()) await installDoubleZbllOffline(() => {});
  })().finally(() => { offlineInstalls.delete(scope); });
  offlineInstalls.set(scope, task);
  return task;
}

/** Cache the public trainer shell(s) and their assets; never cache account/API responses. */
export async function installDoubleZbllOffline(onProgress: (done: number, total: number) => void): Promise<void> {
  const { scope, pages, marker } = doubleZbllOfflinePages(location.pathname);
  const queue = new Set<string>(pages);
  const allowed = (url: URL) => url.origin === location.origin && /^\/(?:_next\/static\/|fonts\/|cubing-chunks\/)/.test(url.pathname);
  const collect = (entries: PerformanceEntry[]) => {
    for (const entry of entries) {
      const url = new URL(entry.name);
      if (allowed(url)) queue.add(url.href);
    }
  };
  collect(performance.getEntriesByType('resource'));
  // Capture lazy preloads even if the browser's resource timing buffer fills up.
  let observer: PerformanceObserver | undefined;
  try {
    observer = new PerformanceObserver(list => collect(list.getEntries()));
    observer.observe({ type: 'resource', buffered: true });
  } catch { observer?.disconnect(); observer = undefined; }
  for (const element of document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src], link[href]')) {
    const url = new URL(element instanceof HTMLScriptElement ? element.src : element.href, location.href);
    if (allowed(url)) queue.add(url.href);
  }
  try {
    await loadDoubleZbll();
    if (!('serviceWorker' in navigator) || typeof caches === 'undefined') throw new Error('Offline storage unavailable');
    if (pages.length === 1) {
      // A direct timer/run entry may never have loaded the selector's lazy chunk.
      // Warm the existing modules without mounting them or starting another session.
      await Promise.all([
        import('@/app/[lang]/alg/[puzzle]/[set]/run/TrainerRunClient'),
        import('@/app/[lang]/alg/[puzzle]/[set]/select/TrainerSetClient'),
      ]);
    }
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
    collect(observer?.takeRecords() ?? []);
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
      // Set iteration also visits entries added by HTML/CSS parsing or the observer.
      collect(observer?.takeRecords() ?? []);
      onProgress(++done, queue.size);
    }
    await cache.put(marker, new Response(JSON.stringify({ savedAt: Date.now(), version: corpus!.manifest.version, resources: [...queue] })));
    void navigator.storage?.persist?.();
  } finally {
    observer?.disconnect();
  }
}

export async function doubleZbllOfflineReady(): Promise<boolean> {
  if (typeof caches === 'undefined' || !('serviceWorker' in navigator)) return false;
  const { scope, pages, marker: markerPath } = doubleZbllOfflinePages(location.pathname);
  const [cache, registration] = await Promise.all([caches.open(DOUBLE_ZBLL_APP_CACHE), navigator.serviceWorker.getRegistration(scope)]);
  const marker = await cache.match(markerPath);
  if (!marker) return false;
  const saved = await marker.json() as { resources?: string[]; version?: string };
  try { if (saved.version !== (await loadDoubleZbll()).manifest.version) return false; } catch { return false; }
  if (!Array.isArray(saved.resources) || !saved.resources.length) return false;
  const resourcesPresent = (await Promise.all(saved.resources.map(path => cache.match(path)))).every(Boolean);
  return resourcesPresent && !!registration?.active && registration.scope === new URL(scope, location.href).href
    && registration.active.scriptURL === new URL('/double-zbll-sw.js', location.href).href
    && (await Promise.all(pages.map(path => cache.match(path)))).every(Boolean)
    && !!await cachedDoubleZbllCases();
}
