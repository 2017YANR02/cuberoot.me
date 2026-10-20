import { configureAlgFileLoader, type AlgFile } from '@cuberoot/shared/alg';
import { installOllLookup } from '@cuberoot/shared/recon/oll-lookup';
import { installPllLookup } from '@cuberoot/shared/recon/pll-lookup';
import { createWatchReplay, configureWatchAnalysisClock, configureWatchReferenceBudget, exportWatchReplayCache, importWatchReplayCache } from '@cuberoot/app-ui/watch-replay';
const runtimeLogs: string[] = [];
const log = (...values: unknown[]) => { runtimeLogs.push(values.map(String).join(' ')); if (runtimeLogs.length > 16) runtimeLogs.shift(); };
Object.assign(globalThis, { console: { log, info: log, warn: log, error: log, debug: log } });
// QuickJS has no event loop. Resume one due timer per host render tick so the
// shared lookup builders yield actual CPU time between bounded evaluations.
let nextTimer = 0;
const clock = () => (globalThis as any).__watchCpuTime?.() ?? Date.now();
configureWatchAnalysisClock(clock);
const timers = new Map<number, { at: number; callback: () => void }>();
Object.assign(globalThis, {
  setTimeout: (callback: () => void, delay = 0) => { const id = ++nextTimer; timers.set(id, { at: clock() + delay, callback }); return id; },
  clearTimeout: (id: number) => timers.delete(id),
});
const requests = new Map<string, { promise: Promise<AlgFile>; resolve: (file: AlgFile) => void; reject: (error: Error) => void }>();
(globalThis as any).WatchReplay = {
  requests: () => JSON.stringify([...requests.keys()]),
  provideAlgorithm(key: string, file: AlgFile | null) {
    const request = requests.get(key); requests.delete(key);
    if (file) request?.resolve(file); else request?.reject(new Error('Offline algorithm unavailable: ' + key));
  },
  exportCache: () => JSON.stringify(exportWatchReplayCache()),
  importCache: (cache: ReturnType<typeof exportWatchReplayCache>) => importWatchReplayCache(cache),
  configureOffline(data: any) {
    configureWatchReferenceBudget({pruningDepth:2,nodes:1000});
    configureAlgFileLoader((puzzle,set) => {
      const key = `${puzzle}/${set}`, existing = requests.get(key);
      if (existing) return existing.promise;
      let resolve!: (file: AlgFile) => void, reject!: (error: Error) => void;
      const promise = new Promise<AlgFile>((ok, fail) => { resolve = ok; reject = fail; });
      requests.set(key,{ promise,resolve,reject }); return promise;
    });
    if (data.lookup) { void installOllLookup(data.lookup.oll); installPllLookup(data.lookup.pll); }
  },
  create: createWatchReplay,
  tick() {
    const due = [...timers].find(([, timer]) => timer.at <= clock());
    if (due) { timers.delete(due[0]); due[1].callback(); }
  },
  configureAlgorithms(files: Record<string, AlgFile>) {
    configureAlgFileLoader(async (puzzle, set) => {
      log('loadAlg', puzzle, set);
      const file = files[`${puzzle}/${set}`];
      if (!file) throw new Error(`Offline algorithm set unavailable: ${puzzle}/${set}`);
      return file;
    });
  },
  diagnostics: () => runtimeLogs,
};
