import { afterEach, expect, it, vi } from 'vitest';
import { loadSpaceBlender } from '@/app/[lang]/space/space-blender';

const loader = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: class { loadAsync = loader.load; } }));
afterEach(() => { vi.unstubAllGlobals(); loader.load.mockReset(); });

const manifest = { asset: 'shanghai', schemaVersion: 2, sha256: 'a'.repeat(64), bytes: 1_000_000 };

it('reports decoded download bytes without treating a complete download as a ready scene', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => manifest })));
  let progress!: (event: { loaded: number; total: number }) => void;
  let resolve!: (model: object) => void;
  loader.load.mockImplementation((_url, notify) => { progress = notify; return new Promise(done => { resolve = done; }); });
  const report = vi.fn();
  let ready = false;
  const pending = loadSpaceBlender('shanghai', report).then(model => { ready = true; return model; });
  await vi.waitFor(() => expect(loader.load).toHaveBeenCalledOnce());
  expect(loader.load.mock.calls[0][0]).toBe(`/assets/space/blender-v1/shanghai.glb?v=${manifest.sha256}`);
  // Content-Length may describe compressed bytes; use the manifest's decoded size.
  progress({ loaded: 500_000, total: 100_000 });
  progress({ loaded: 500_100, total: 100_000 });
  progress({ loaded: 499_000, total: 100_000 });
  expect(report).toHaveBeenCalledTimes(2);
  expect(report).toHaveBeenLastCalledWith({ phase: 'download', loaded: 500_000, total: 1_000_000 });
  progress({ loaded: 1_000_000, total: 100_000 });
  expect(report).toHaveBeenLastCalledWith({ phase: 'prepare', loaded: 1_000_000, total: 1_000_000 });
  expect(ready).toBe(false);
  const model = { scene: {} }; resolve(model);
  expect(await pending).toBe(model);
});

it('handles cached loads without progress events and rejects a missing manifest size before downloading', async () => {
  const fetch = vi.fn(async () => ({ ok: true, json: async () => manifest })); vi.stubGlobal('fetch', fetch);
  loader.load.mockResolvedValue({ scene: {} });
  const report = vi.fn();
  await loadSpaceBlender('shanghai', report);
  expect(report).toHaveBeenLastCalledWith({ phase: 'prepare', loaded: 1_000_000, total: 1_000_000 });
  fetch.mockResolvedValue({ ok: true, json: async () => ({ ...manifest, bytes: 0 }) });
  await expect(loadSpaceBlender('shanghai')).rejects.toThrow('Invalid Blender manifest');
  expect(loader.load).toHaveBeenCalledOnce();
});
