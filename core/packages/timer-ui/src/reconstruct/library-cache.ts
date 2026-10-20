import { loadAlg, type AlgFile } from '@cuberoot/shared/alg';

// Public library data only. A short TTL bounds how long an administrator's edit
// can remain hidden; storage also survives the analysis worker's idle shutdown.
const MAX_AGE_MS = 5 * 60_000;
const CACHE_NAME = 'cuberoot-reconstruction-libraries-v1';
const WARM_SETS = ['f2l', 'oll', 'pll', 'zbll', 'ollcp'];
interface CachedLibrary { savedAt: number; file: AlgFile }

export function createReconstructionLibraryCache(
  fetchFile: (set: string) => Promise<AlgFile> = set => loadAlg('3x3', set),
  storage: CacheStorage | undefined = globalThis.caches,
  now: () => number = Date.now,
) {
  const memory = new Map<string, CachedLibrary>();
  const pending = new Map<string, Promise<AlgFile>>();
  const fresh = (entry: CachedLibrary | undefined): entry is CachedLibrary => Boolean(entry
    && Number.isFinite(entry.savedAt) && now() >= entry.savedAt && now() - entry.savedAt < MAX_AGE_MS
    && Array.isArray(entry.file?.cases));
  const cacheKey = (set: string) => new URL(`/__reconstruction-library__/3x3/${encodeURIComponent(set)}`,
    globalThis.location?.origin ?? 'https://cuberoot.me').href;

  async function read(set: string): Promise<AlgFile> {
    let cache: Cache | undefined;
    try {
      cache = await storage?.open(CACHE_NAME);
      const response = await cache?.match(cacheKey(set));
      const entry = response ? await response.json() as CachedLibrary : undefined;
      if (fresh(entry)) { memory.set(set, entry); return entry.file; }
    } catch { /* Private mode, quota or corrupt data must not block a report. */ }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let file: AlgFile;
    try {
      file = await Promise.race([fetchFile(set), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Reconstruction library timed out')), 15_000);
      })]);
    } finally { clearTimeout(timer); }
    const entry = { savedAt: now(), file };
    memory.set(set, entry);
    try {
      await cache?.put(cacheKey(set), new Response(JSON.stringify(entry), {
        headers: { 'Content-Type': 'application/json' },
      }));
    } catch { /* Memory caching still works when browser storage is unavailable. */ }
    return file;
  }

  function load(set: string): Promise<AlgFile> {
    const entry = memory.get(set);
    if (fresh(entry)) return Promise.resolve(entry.file);
    const active = pending.get(set);
    if (active) return active;
    const job = read(set).finally(() => pending.delete(set));
    pending.set(set, job);
    return job;
  }

  async function warm(): Promise<void> {
    // Two requests at a time, shared with any report already asking for a set.
    const queue = [...WARM_SETS];
    await Promise.all([0, 1].map(async () => {
      for (let set = queue.shift(); set; set = queue.shift()) {
        await load(set).catch(() => undefined);
      }
    }));
  }
  return { load, warm };
}

export const reconstructionLibraries = createReconstructionLibraryCache();
