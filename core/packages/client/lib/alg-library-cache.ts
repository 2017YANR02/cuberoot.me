import { ALG_PUZZLES, loadAlg as loadSourceAlg, type AlgFile, type AlgPuzzle } from '@cuberoot/shared/alg';

/** Public PG snapshots only. Reads show the last snapshot while checking for edits.
 * This cache belongs to the library UI; trainers/validation keep their fresh reads. */
const PREFIX = 'alg-library:v1:';
const MAX_AGE = 24 * 60 * 60 * 1000;
const RECHECK_AFTER = 5000;
const MAX_ENTRIES = 8;
// CMLL carries WeakSet provenance for imported OH rows; JSON cannot preserve it.
const canPersist = (key: string) => key !== 'file:3x3/cmll';
type Entry = { value: unknown; json: string; checked: number; saved: number };
const entries = new Map<string, Entry>();
const requests = new Map<string, Promise<unknown>>();
const initialReads = new Map<string, Promise<unknown>>();
const listeners = new Map<string, Set<() => void>>();
const generations = new Map<string, number>();

// One intent-prepared destination; reuse the already aligned list data, including
// in-memory provenance that must not be serialized (e.g. merged OH formulas).
let navigationFile: { path: string; file: AlgFile; generation: number; expires: number } | null = null;
const navigationVersions = new WeakMap<AlgFile, number>();
export const algLibraryGeneration = (puzzle: string, set: string): number => generations.get(algLibraryKey(puzzle, set)) ?? 0;
/** Called only when a guarded library load finishes, never for optimistic edits. */
export function rememberAlgNavigationVersion(file: AlgFile, generation: number): AlgFile {
  navigationVersions.set(file, generation);
  return file;
}
export function prepareAlgNavigationFile(href: string, file: AlgFile): void {
  const generation = navigationVersions.get(file);
  if (generation === undefined) { navigationFile = null; return; }
  const path = new URL(href, window.location.href).pathname;
  navigationFile = { path, file, generation, expires: Date.now() + 30_000 };
}
export function peekAlgNavigationFile(path: string): AlgFile | null {
  if (typeof window === 'undefined' || navigationFile?.path !== path || Date.now() >= navigationFile.expires) return null;
  const { file, generation } = navigationFile;
  return generation === (generations.get(algLibraryKey(file.puzzle, file.set)) ?? 0) ? file : null;
}

function notify(key: string) { for (const listener of listeners.get(key) ?? []) listener(); }
export function subscribeAlgLibrary(key: string, listener: () => void): () => void {
  const group = listeners.get(key) ?? new Set();
  group.add(listener);
  listeners.set(key, group);
  const storageChanged = (event: StorageEvent) => {
    if (event.key !== PREFIX + key) return;
    try {
      const incoming = JSON.parse(event.newValue ?? 'null');
      if (incoming?.gzip && incoming.gzip === JSON.parse(event.oldValue ?? 'null')?.gzip) return;
      if (event.newValue && !JSON.parse(event.newValue).invalidated && JSON.stringify(JSON.parse(event.newValue).value) === entries.get(key)?.json) return; } catch { /* discard corrupt snapshots */ }
    generations.set(key, (generations.get(key) ?? 0) + 1);
    entries.delete(key);
    requests.delete(key);
    initialReads.delete(key);
    listener();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', storageChanged);
  return () => {
    group.delete(listener);
    if (!group.size) listeners.delete(key);
    if (typeof window !== 'undefined') window.removeEventListener('storage', storageChanged);
  };
}
function restore(key: string): Entry | undefined {
  const memory = entries.get(key);
  if (memory && Date.now() - memory.saved <= MAX_AGE) return memory;
  entries.delete(key);
  if (typeof window === 'undefined' || !canPersist(key)) return;
  try {
    const saved = JSON.parse(localStorage.getItem(PREFIX + key) ?? 'null');
    if (!saved || saved.invalidated || saved.value == null || typeof saved.saved !== 'number' || Date.now() - saved.saved > MAX_AGE) return;
    const entry = { value: saved.value, json: JSON.stringify(saved.value), saved: saved.saved, checked: 0 };
    entries.set(key, entry);
    return entry;
  } catch { return; }
}
function saveSnapshot(key: string, value: object) {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX) && k !== PREFIX + key);
    keys.sort((a, b) => (JSON.parse(localStorage.getItem(a) ?? '{}').saved ?? 0) - (JSON.parse(localStorage.getItem(b) ?? '{}').saved ?? 0));
    while (keys.length >= MAX_ENTRIES) localStorage.removeItem(keys.shift()!);
    const json = JSON.stringify(value);
    for (;;) {
      // allow-raw-localstorage: retry with eviction limited to this library's snapshots, preserving other features' data.
      try { localStorage.setItem(PREFIX + key, json); break; }
      catch { if (!keys.length) break; localStorage.removeItem(keys.shift()!); }
    }
  } catch { /* Storage unavailable: in-memory reads still work. */ }
}
function persist(key: string, entry: Entry) {
  if (typeof window === 'undefined' || !canPersist(key)) return;
  if (entry.json.length > 500_000 && typeof CompressionStream !== 'undefined') {
    // Large sets must not consume the whole localStorage quota. Compression is
    // asynchronous and never holds up rendering or removes another feature's data.
    void (async () => {
      const stream = new Blob([entry.json]).stream().pipeThrough(new CompressionStream('gzip'));
      const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      if (entries.get(key) === entry) saveSnapshot(key, { gzip: btoa(binary), saved: entry.saved });
    })().catch(() => {});
  } else saveSnapshot(key, { value: entry.value, saved: entry.saved });
}

async function storedCompressed<T>(key: string): Promise<T | undefined> {
  if (!canPersist(key) || typeof DecompressionStream === 'undefined') return;
  try {
    const saved = JSON.parse(localStorage.getItem(PREFIX + key) ?? 'null');
    if (!saved?.gzip || Date.now() - saved.saved > MAX_AGE) return;
    const bytes = Uint8Array.from(atob(saved.gzip), ch => ch.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text()) as T;
  } catch { return; }
}

export function readAlgLibrary<T>(key: string, fetcher: () => Promise<T>, fresh = false, bootstrap?: () => Promise<T>): Promise<T> {
  const cached = restore(key);
  const existing = requests.get(key) as Promise<T> | undefined;
  if (existing) return cached && !fresh ? Promise.resolve(cached.value as T)
    : !fresh ? (initialReads.get(key) as Promise<T> | undefined) ?? existing : existing;
  if (cached && !fresh && Date.now() - cached.checked < RECHECK_AFTER) return Promise.resolve(cached.value as T);
  const generation = generations.get(key) ?? 0;
  const pending = Promise.resolve().then(fetcher).then(value => {
    if ((generations.get(key) ?? 0) !== generation) return value;
    const json = JSON.stringify(value);
    const previous = entries.get(key) ?? cached;
    const changed = previous && previous.json !== json;
    const entry = { value: previous?.json === json ? previous.value : value, json, checked: Date.now(), saved: Date.now() };
    entries.delete(key);
    entries.set(key, entry);
    while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
    persist(key, entry);
    if (changed) notify(key);
    return entry.value as T;
  }).finally(() => { if (requests.get(key) === pending) requests.delete(key); });
  requests.set(key, pending);
  if (cached && !fresh) {
    // A transient network error must not replace a working library with a blank page.
    void pending.catch(() => {});
    return Promise.resolve(cached.value as T);
  }
  let invalidated = generation > 0;
  try { invalidated ||= !!JSON.parse(localStorage.getItem(PREFIX + key) ?? 'null')?.invalidated; } catch { /* unavailable */ }
  let compressed = false;
  try { compressed = !!JSON.parse(localStorage.getItem(PREFIX + key) ?? 'null')?.gzip; } catch { /* unavailable */ }
  if ((bootstrap || compressed) && !fresh && !invalidated) {
    const seed = (async () => {
      const stored = await storedCompressed<T>(key);
      if (stored !== undefined) return stored;
      if (bootstrap) return bootstrap();
      throw new Error('No usable stored snapshot');
    })().then(value => {
      if ((generations.get(key) ?? 0) !== generation) return value;
      const current = entries.get(key);
      if (current) return current.value as T;
      const entry = { value, json: JSON.stringify(value), checked: 0, saved: Date.now() };
      entries.set(key, entry);
      while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
      persist(key, entry);
      return value;
    });
    // Both requests may fail independently. The first successful snapshot paints;
    // only the live request can mark it checked or announce a new revision.
    const first = Promise.any([pending, seed]).finally(() => {
      if (initialReads.get(key) === first) initialReads.delete(key);
    });
    initialReads.set(key, first);
    return first;
  }
  return pending;
}

export const algLibraryKey = (puzzle: string, set: string) => `file:${puzzle}/${set}`;
export function loadLibrarySource(puzzle: AlgPuzzle, set: string): Promise<AlgFile> {
  return readAlgLibrary(algLibraryKey(puzzle, set), () => loadSourceAlg(puzzle, set), false,
    () => loadSourceAlg(puzzle, set, { loader: async (p, s) => {
      const response = await fetch(`/api/alg/snapshot/${encodeURIComponent(p)}/${encodeURIComponent(s)}`);
      if (!response.ok) throw new Error(`Alg snapshot HTTP ${response.status}`);
      return await response.json() as AlgFile;
    } }));
}
export function invalidateAlgLibrary(puzzle: string, set?: string): void {
  const keys = [`catalog:${puzzle}`, ...(set ? [algLibraryKey(puzzle, set)] : [])];
  // CMLL includes OH source algorithms.
  if (set === 'oh-cmll') keys.push(algLibraryKey(puzzle, 'cmll'));
  for (const key of keys) {
    generations.set(key, (generations.get(key) ?? 0) + 1);
    entries.delete(key);
    requests.delete(key);
    initialReads.delete(key);
    saveSnapshot(key, { invalidated: true, saved: Date.now() });
    notify(key);
  }
}

/** Fetch only the destination the user points at, never every card in a large grid. */
export function prefetchAlgLibrary(href: string): void {
  const match = href.match(/^(?:\/zh)?\/alg\/([^/]+)\/([^/?#]+)(?:[/?#]|$)/);
  if (!match || !(ALG_PUZZLES as readonly string[]).includes(match[1])) return;
  void loadLibrarySource(match[1] as AlgPuzzle, decodeURIComponent(match[2])).catch(() => {});
}
