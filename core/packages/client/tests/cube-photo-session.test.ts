// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { PhotoWorkers } from '@/lib/cube-photo/workers';
import { PhotoCatalogCache } from '@/lib/cube-photo/catalog-cache';
import PhotoResults from '@/components/cube-photo/PhotoResults';
import type { AlgFile } from '@cuberoot/shared/alg';
import type { PhotoAnalysisInput, PhotoAnalysisMessage } from '@cuberoot/shared/cube-photo/analyze';
import type { CubeCorners } from '@cuberoot/shared/cube-photo/geometry';
import { findPhotoAlg } from '@cuberoot/shared/cube-photo/lookup';
import { classifyPhotoColors, COLOR_RGB } from '@cuberoot/shared/cube-photo/recognize';
import fixture from '@cuberoot/shared/testing/cube-photo-algs';

vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }));
vi.mock('@/i18n/tr', () => ({ tr: ({ zh }: { zh: string }) => zh }));
vi.mock('@/components/CaseThumb', () => ({ CaseThumb: () => createElement('svg') }));
vi.mock('@/components/ReconCaseLink', () => ({ default: ({ children, ...props }: any) => createElement('a', props, children) }));

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage?: (event: { data: unknown }) => void;
  onerror?: () => void;
  onmessageerror?: () => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor(readonly url: URL) { FakeWorker.instances.push(this); }
  reply(id: number, message: unknown) { this.onmessage?.({ data: { id, message } }); }
  get request() { return this.postMessage.mock.calls.filter(([m]) => 'input' in m).at(-1)![0]; }
}
const sessions: PhotoWorkers[] = [], roots: ReturnType<typeof createRoot>[] = [];
function session() {
  vi.stubGlobal('Worker', FakeWorker);
  const workers = new PhotoWorkers(); sessions.push(workers); return workers;
}
const input: PhotoAnalysisInput = { pixels: { width: 1, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255]) },
  corners: [{ x: 1, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 2 }, { x: 0, y: 4 }, { x: 1, y: 5 }, { x: 2, y: 4 }], corrections: {} };
afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount());
  sessions.splice(0).forEach(s => s.dispose());
  FakeWorker.instances = []; document.body.replaceChildren(); vi.useRealTimers(); vi.unstubAllGlobals();
});

it('keeps successful workers, rejects obsolete replies, recovers after timeout/crash and disposes on exit', () => {
  vi.useFakeTimers();
  const workers = session(); workers.warmup(); workers.warmup();
  expect(FakeWorker.instances).toHaveLength(2);
  const [detector, analyzer] = FakeWorker.instances;
  const detected = vi.fn();
  workers.detect(input.pixels, detected);
  const firstId = detector.request.id;
  const success = { detection: { candidates: [], lineCount: 0, reason: 'no-grid' }, elapsedMs: 2 };
  detector.reply(firstId, success);
  expect(detected).toHaveBeenCalledExactlyOnceWith(success);
  expect(detector.terminate).not.toHaveBeenCalled();
  workers.detect(input.pixels, detected);
  detector.reply(firstId, success);
  expect(detected).toHaveBeenCalledTimes(1);
  expect(detector.request.input.data).not.toBe(input.pixels.data);
  expect(detector.request.input.data).toEqual(input.pixels.data);
  vi.advanceTimersByTime(20000);
  expect(detected).toHaveBeenLastCalledWith({ error: 'detection_failed' });
  expect(detector.terminate).toHaveBeenCalledOnce();
  workers.detect(input.pixels, detected);
  expect(FakeWorker.instances).toHaveLength(3);
  const receive = vi.fn();
  const cancel = workers.analyze(input, receive);
  const oldId = analyzer.request.id;
  workers.analyze(input, receive); cancel(); // an old cleanup cannot cancel the new request
  analyzer.reply(oldId, { type: 'done' });
  expect(receive).not.toHaveBeenCalled();
  analyzer.reply(analyzer.request.id, { type: 'done' });
  expect(receive).toHaveBeenCalledExactlyOnceWith({ type: 'done' });
  expect(analyzer.terminate).not.toHaveBeenCalled();
  workers.analyze(input, receive); analyzer.onerror?.();
  expect(receive).toHaveBeenLastCalledWith({ type: 'error' });
  workers.analyze(input, receive);
  expect(FakeWorker.instances).toHaveLength(4);
  workers.dispose();
  for (const worker of FakeWorker.instances) expect(worker.terminate).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it('deduplicates catalogs, revalidates after expiry/explicit retry and never caches failures', async () => {
  let now = 0;
  const file = fixture.libraries.oll as AlgFile;
  const fetch = vi.fn(async () => file);
  const cache = new PhotoCatalogCache(fetch, () => now);
  const a = cache.load('oll'), b = cache.load('oll');
  expect(a).toBe(b); await a;
  now = 29999; expect(await cache.load('oll')).toBe(file);
  expect(fetch).toHaveBeenCalledExactlyOnceWith('oll', false);
  now = 30000; await cache.load('oll');
  expect(fetch).toHaveBeenCalledTimes(2);
  await cache.load('oll', true);
  expect(fetch).toHaveBeenLastCalledWith('oll', true);
  fetch.mockRejectedValueOnce(new Error('offline'));
  await expect(cache.load('cmll')).rejects.toThrow('offline');
  await expect(cache.load('cmll')).resolves.toBe(file);
  expect(fetch).toHaveBeenCalledTimes(5);
});

it('an older failed fetch cannot evict a newer forced refresh', async () => {
  let reject!: (error: Error) => void;
  const file = fixture.libraries.oll as AlgFile;
  const fetch = vi.fn().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }))
    .mockResolvedValue(file);
  const cache = new PhotoCatalogCache(fetch);
  const first = cache.load('oll');
  const rejected = expect(first).rejects.toThrow('old');
  await Promise.resolve();
  const fresh = cache.load('oll', true); await fresh;
  reject(new Error('old')); await rejected;
  expect(cache.load('oll')).toBe(fresh);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('starts first lookup immediately, streams ready formulas, debounces only corner edits and hides old state', async () => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const workers = session();
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); roots.push(root);
  const props = { workers, pixels: input.pixels, corners: input.corners, width: 1, height: 1 };
  await act(async () => root.render(createElement(PhotoResults, props)));
  const analyzer = FakeWorker.instances[0];
  expect(analyzer.postMessage).toHaveBeenCalledOnce(); // no initial 250ms timer
  const id = analyzer.request.id;
  const centers = classifyPhotoColors([COLOR_RGB.blue, COLOR_RGB.red]);
  const state: PhotoAnalysisMessage = { type: 'state', recognition: { status: 'ok', samples: [],
    centers: { F: centers[0], R: centers[1] }, candidates: [{ facelet: fixture.states.cross, frame: { U: 'yellow', F: 'blue', R: 'red', D: 'white', B: 'green', L: 'orange' } }] } };
  await act(async () => analyzer.reply(id, state));
  expect(host.querySelectorAll('[data-alg-set]')).toHaveLength(4);
  const match = findPhotoAlg(fixture.states.cross, 'oll', fixture.libraries.oll as AlgFile)!;
  await act(async () => analyzer.reply(id, { type: 'alg', result: { set: 'oll', status: 'found', match, alternatives: [] } }));
  expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
  expect(host.querySelector('code')?.textContent).toBe(match.alg); // before other sets/done
  const changed = { ...props, corners: input.corners.map(p => ({ ...p, x: p.x + .1 })) as CubeCorners };
  await act(async () => root.render(createElement(PhotoResults, changed)));
  expect(host.querySelector('code')).toBeNull();
  await act(async () => analyzer.reply(id, { type: 'done' }));
  expect(host.querySelector('code')).toBeNull();
  expect(analyzer.request.id).toBe(id);
  await act(async () => vi.advanceTimersByTime(249));
  expect(analyzer.request.id).toBe(id);
  await act(async () => vi.advanceTimersByTime(1));
  expect(analyzer.request.id).not.toBe(id);
  expect(FakeWorker.instances).toHaveLength(1);
  await act(async () => analyzer.reply(analyzer.request.id, { type: 'error' }));
  await act(async () => host.querySelector<HTMLButtonElement>('.cube-photo-retry')!.click());
  expect(analyzer.request.fresh).toBe(true);
  expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
});
