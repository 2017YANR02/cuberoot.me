import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpaceScene } from '@/app/[lang]/space/space-scene';
import { INITIAL_LAYOUT, type Environment } from '@/app/[lang]/space/space-state';
import type { SpaceAssetProgress } from '@/app/[lang]/space/space-blender';

type Asset = {
  root: THREE.Group;
  ready: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
  dispose: ReturnType<typeof vi.fn>;
  progress?: (progress: SpaceAssetProgress) => void;
};
const assets = vi.hoisted(() => ({ rooms: [] as Asset[], cities: [] as Asset[] }));

vi.mock('@/app/[lang]/space/space-room', async () => {
  const { Group } = await import('three');
  return { SpaceRoom: class {
    root = new Group();
    palette = { sky: 0, ground: 0, stone: 0 };
    resolve!: () => void;
    reject!: (error: Error) => void;
    ready = new Promise<void>((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
    dispose = vi.fn();
    resize = vi.fn();
    update = vi.fn();
    constructor(readonly style: string, _helpers: unknown, readonly invalidate: () => void, readonly environment: string, _source?: string, readonly progress?: (progress: SpaceAssetProgress) => void) { assets.rooms.push(this); }
  } };
});
vi.mock('@/app/[lang]/space/space-shanghai', async () => {
  const { Group } = await import('three');
  return { SHANGHAI_VIEWS: {}, ShanghaiScene: class {
    root = new Group();
    resolve!: () => void;
    reject!: (error: Error) => void;
    ready = new Promise<void>((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
    dispose = vi.fn();
    setWeather = vi.fn();
    update = vi.fn();
    constructor(_narrow: boolean, _changed: () => void, _source?: string, readonly progress?: (progress: SpaceAssetProgress) => void) { assets.cities.push(this); }
  } };
});

function fixture(environment: Environment = 'original') {
  const scene = Object.create(SpaceScene.prototype) as SpaceScene;
  const graph = new THREE.Scene(), camera = new THREE.PerspectiveCamera(27);
  camera.position.set(11, 22, 33);
  const layout = { ...INITIAL_LAYOUT, room: 'modern' as const, environment, weather: 'rain' as const, timeOfDay: '20:00', objects: [INITIAL_LAYOUT.objects[0]] };
  const root = new THREE.Group(), entry = { root, data: layout.objects[0] };
  const callbacks = { roomState: vi.fn(), cityState: vi.fn(), assetProgress: vi.fn(), cruising: vi.fn(), change: vi.fn(), unavailable: vi.fn() };
  const view = vi.fn(), create = vi.fn((_data: typeof entry.data) => entry), render = vi.fn();
  const renderer = { domElement: { style: {} }, compileAsync: vi.fn(async () => graph), getRenderTarget: () => null, setRenderTarget: vi.fn() };
  const weather = { forgetRoom: vi.fn(), patchSurfaces: vi.fn(), set: vi.fn(), setTime: vi.fn(),
    engine: { ready: Promise.resolve(), abort: new AbortController() }, daylight: { day: .2, sun: .1, direction: new THREE.Vector3(0, 1, 0) },
    lighting: () => ({ fog: new THREE.Fog(0, 1, 10), sun: 1, ambient: 1 }), update: vi.fn() };
  Object.assign(scene, { scene: graph, camera, host: { clientWidth: 800 }, disposed: false, contextLost: false,
    room: null, city: null, cityPreparation: 0, preparingCity: false, cityCompilation: null,
    weather, renderer, composer: { readBuffer: null }, environment: { texture: new THREE.Texture() },
    hemisphere: new THREE.HemisphereLight(), sun: new THREE.DirectionalLight(), fill: new THREE.DirectionalLight(), bloom: {}, ao: {},
    floorMaterial: new THREE.MeshStandardMaterial(), pedestalMaterial: new THREE.MeshStandardMaterial(),
    orbit: { target: new THREE.Vector3(4, 5, 6) }, transform: { getHelper: () => new THREE.Group(), setMode: vi.fn(), setTranslationSnap: vi.fn(), setRotationSnap: vi.fn(), attach: vi.fn(), detach: vi.fn() },
    outline: {}, grid: {}, drop: {}, surfaces: [], entries: new Map(), callbacks,
    view, create, apply: vi.fn(), render, cancel: vi.fn(), navigation: 'orbit', currentView: 'interior',
  });
  const sync = () => scene.sync(layout, entry.data.id, 'rotate', true, false);
  return { scene, layout, entry, camera, callbacks, view, create, renderer, weather, render, sync };
}

describe('space asset recovery', () => {
  beforeEach(() => { assets.rooms.length = 0; assets.cities.length = 0; });

  it('resets progress on replacement and ignores retired or unavailable scene downloads', () => {
    const f = fixture('shanghai'); f.sync();
    const oldRoom = assets.rooms[0], oldCity = assets.cities[0];
    const progress = { phase: 'download' as const, loaded: 50, total: 100 };
    oldCity.progress?.(progress);
    expect(f.callbacks.assetProgress).toHaveBeenLastCalledWith('city', progress);
    f.scene.sync({ ...f.layout, environment: 'original' }, null, 'translate', false, false);
    expect(f.callbacks.assetProgress).toHaveBeenCalledWith('city', null);
    expect(f.callbacks.assetProgress).toHaveBeenLastCalledWith('room', null);
    f.callbacks.assetProgress.mockClear();
    oldRoom.progress?.(progress); oldCity.progress?.(progress);
    expect(f.callbacks.assetProgress).not.toHaveBeenCalled();
    assets.rooms[1].progress?.(progress);
    expect(f.callbacks.assetProgress).toHaveBeenCalledExactlyOnceWith('room', progress);
    Object.assign(f.scene, { contextLost: true });
    assets.rooms[1].progress?.({ ...progress, loaded: 75 });
    expect(f.callbacks.assetProgress).toHaveBeenCalledTimes(1);
  });

  it('retries a failed room without replacing puzzles, moving the camera or changing the layout', async () => {
    const f = fixture(), log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      f.sync();
      const first = assets.rooms[0];
      first.reject(new Error('offline'));
      await vi.waitFor(() => expect(f.callbacks.roomState).toHaveBeenLastCalledWith('error'));
      f.scene.retryAssets(f.layout);
      const second = assets.rooms[1];
      expect(first.dispose).toHaveBeenCalledOnce(); expect(first.root.parent).toBeNull();
      expect(f.callbacks.roomState).toHaveBeenLastCalledWith('loading');
      expect(f.create).toHaveBeenCalledOnce(); expect(f.scene['entries'].get(f.entry.data.id)).toBe(f.entry);
      expect(f.view).toHaveBeenCalledTimes(1); expect(f.camera.position.toArray()).toEqual([11, 22, 33]); expect(f.camera.fov).toBe(27);
      expect(f.scene['selected']).toBe(f.entry.data.id); expect(f.scene['mode']).toBe('rotate'); expect(f.scene['snap']).toBe(true);
      expect(f.weather.set).toHaveBeenLastCalledWith('rain', 'modern', second.root, false, false);
      expect(f.weather.setTime).toHaveBeenLastCalledWith('20:00'); expect(f.callbacks.change).not.toHaveBeenCalled();
      vi.mocked(f.scene['apply']).mockClear();
      second.resolve(); await vi.waitFor(() => expect(f.callbacks.roomState).toHaveBeenLastCalledWith('ready'));
      expect(f.scene['apply']).toHaveBeenCalledExactlyOnceWith(f.entry, f.entry.data);
    } finally { log.mockRestore(); }
  });

  it('ignores completion from a room replaced by a retry', async () => {
    const f = fixture(); f.sync(); const first = assets.rooms[0];
    f.scene.retryAssets(f.layout);
    f.callbacks.roomState.mockClear();
    first.resolve(); await first.ready; await Promise.resolve();
    expect(f.callbacks.roomState).not.toHaveBeenCalled();
    assets.rooms[1].resolve(); await vi.waitFor(() => expect(f.callbacks.roomState).toHaveBeenCalledExactlyOnceWith('ready'));
  });

  it('keeps a newly started cruise running when React confirms that placement ended', () => {
    const f = fixture();
    f.scene.sync(f.layout, f.entry.data.id, 'rotate', true, true);
    const city = { route: new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(1000, 0, 0)), cruising: false, distance: 0 };
    Object.assign(f.scene, { city });
    // The real cancel method stops cruise; retain that effect without pointer APIs.
    const cancel = vi.fn(() => f.scene.cruise(false)); Object.assign(f.scene, { cancel });
    f.scene.cruise(true);
    f.scene.sync(f.layout, f.entry.data.id, 'rotate', true, false);
    expect(city.cruising).toBe(true); expect(cancel).not.toHaveBeenCalled();
    expect(f.create).toHaveBeenCalledOnce(); expect(f.callbacks.cruising).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('only reconciles the edited puzzle, retaining other picking bounds when controls or weather change', () => {
    const f = fixture();
    const second = { ...INITIAL_LAYOUT.objects[1] }, third = { ...INITIAL_LAYOUT.objects[2] };
    f.layout.objects.push(second, third);
    f.create.mockImplementation(data => ({ root: new THREE.Group(), data }));
    f.sync();
    const apply = vi.mocked(f.scene['apply']); apply.mockClear();
    f.scene.sync(f.layout, second.id, 'twist', false, false);
    const weatherLayout = { ...f.layout, weather: 'snow' as const };
    f.scene.sync(weatherLayout, second.id, 'twist', false, false);
    expect(apply).not.toHaveBeenCalled();
    const edited = { ...second, position: [2, 3] as [number, number] };
    const editedLayout = { ...weatherLayout, objects: [f.layout.objects[0], edited, third] };
    f.scene.sync(editedLayout, second.id, 'translate', false, false);
    expect(apply).toHaveBeenCalledExactlyOnceWith(f.scene['entries'].get(second.id), edited);
    expect(f.create).toHaveBeenCalledTimes(3);
    apply.mockClear();
    f.scene.retryAssets(editedLayout);
    expect(apply).toHaveBeenCalledTimes(3);
  });

  it('patches weather when a room adds assets, ignoring callbacks from replaced rooms', () => {
    const f = fixture(); f.sync();
    const first = assets.rooms[0] as Asset & { invalidate: () => void };
    f.weather.patchSurfaces.mockClear(); f.render.mockClear();
    first.invalidate();
    expect(f.weather.patchSurfaces).toHaveBeenCalledExactlyOnceWith(first.root);
    expect(f.render).toHaveBeenCalledOnce();
    f.scene.retryAssets(f.layout);
    f.weather.patchSurfaces.mockClear(); f.render.mockClear();
    first.invalidate();
    expect(f.weather.patchSurfaces).not.toHaveBeenCalled(); expect(f.render).not.toHaveBeenCalled();
    const current = assets.rooms[1] as Asset & { invalidate: () => void };
    current.invalidate(); expect(f.weather.patchSurfaces).toHaveBeenCalledExactlyOnceWith(current.root);
  });

  it('recovers a failed city compilation and waits for the new assets before reporting ready', async () => {
    const f = fixture('shanghai'), log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      f.renderer.compileAsync.mockRejectedValueOnce(new Error('compile failed'));
      f.sync(); assets.rooms[0].resolve(); assets.cities[0].resolve();
      await vi.waitFor(() => expect(f.callbacks.cityState).toHaveBeenLastCalledWith('error'));
      expect(f.scene['preparingCity']).toBe(false);
      f.scene.retryAssets(f.layout);
      expect(assets.rooms[0].dispose).toHaveBeenCalledOnce(); expect(assets.cities[0].dispose).toHaveBeenCalledOnce();
      expect(f.callbacks.cityState).toHaveBeenLastCalledWith('loading');
      f.scene.retryAssets(f.layout); expect(assets.cities).toHaveLength(2);
      assets.rooms[1].resolve(); await assets.rooms[1].ready;
      expect(f.renderer.compileAsync).toHaveBeenCalledTimes(1);
      assets.cities[1].resolve(); await vi.waitFor(() => expect(f.callbacks.cityState).toHaveBeenLastCalledWith('ready'));
      expect(f.renderer.compileAsync).toHaveBeenCalledTimes(2); expect(f.create).toHaveBeenCalledOnce();
      expect(f.view).toHaveBeenCalledTimes(1); expect(f.scene['preparingCity']).toBe(false);
    } finally { log.mockRestore(); }
  });

  it('does not rebuild assets or resume a completed load after graphics become unavailable', async () => {
    const f = fixture(); f.sync(); f.callbacks.roomState.mockClear();
    const cancelFrame = vi.fn(); vi.stubGlobal('cancelAnimationFrame', cancelFrame);
    try {
      Object.assign(f.scene, { frame: 123 });
      const event = new Event('webglcontextlost', { cancelable: true });
      f.scene['loseContext'](event);
      expect(event.defaultPrevented).toBe(true); expect(f.weather.engine.abort.signal.aborted).toBe(true);
      expect(cancelFrame).toHaveBeenCalledWith(123); expect(f.callbacks.unavailable).toHaveBeenCalledOnce();
      f.scene.retryAssets(f.layout); f.sync(); f.scene['resize']();
      expect(assets.rooms).toHaveLength(1);
      assets.rooms[0].resolve(); await assets.rooms[0].ready; await Promise.resolve();
      expect(f.callbacks.roomState).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});
