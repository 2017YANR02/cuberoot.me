import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import Cube from '@/components/puzzle-models/nxn/cube';
import Cubelet from '@/components/puzzle-models/nxn/cubelet';
import { mirrorFaces } from '@/components/puzzle-models/mirror/mirrorGeometry';
import { CUBE_FILL } from '@/lib/cube-colors';
import Sq1Cube from '@cuberoot/puzzle-render-core/engine/sq1/Sq1Cube';
import PyraCube from '@cuberoot/puzzle-render-core/engine/pyra/PyraCube';
import MegaminxCube from '@cuberoot/puzzle-render-core/engine/mega/MegaminxCube';
import SkewbCube from '@cuberoot/puzzle-render-core/engine/skewb/SkewbCube';
import { movePosition, PEDESTALS, VILLA_ROOMS, floorHeight, walkFloor, walkStep, type Destination, type Level, type Layout, type SpaceObject, type Vec3 } from './space-state';
import { SpaceRoom } from './space-room';
import { pickTurn, turnBusy, turnPuzzle } from './space-turn';
import { validSpaceMove } from './space-state';
import { SpaceWeather } from './space-weather';

type Entry = { root: THREE.Group; model: Cube | Sq1Cube | PyraCube | MegaminxCube | SkewbCube; proxy: THREE.Mesh; data: SpaceObject; appliedMoves: string; turning?: boolean; materials: Map<THREE.Material, THREE.MeshPhysicalMaterial>; originals: Map<THREE.Mesh, THREE.Material | THREE.Material[]> };
export type View = Destination | 'home' | 'front' | 'side' | 'top';
export type Mode = 'translate' | 'rotate' | 'twist';

export function surfaceHit(ray: THREE.Raycaster, surfaces: THREE.Mesh[]) {
  return ray.intersectObjects(surfaces.filter(o => o.visible), false).find(hit => hit.face && hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y > 0.8);
}

// Hidden hints and hit targets do not belong to a puzzle's physical bounds.
export function visibleBounds(model: THREE.Object3D, relativeTo?: THREE.Object3D) {
  model.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  const inverse = relativeTo?.matrixWorld.clone().invert();
  const matrix = new THREE.Matrix4(), instance = new THREE.Matrix4();
  model.traverseVisible(o => {
    if (!(o instanceof THREE.Mesh) || (Array.isArray(o.material) ? o.material.every(m => !m.visible) : !o.material.visible)) return;
    const positions = o.geometry.getAttribute('position');
    for (let n = 0; n < (o instanceof THREE.InstancedMesh ? o.count : 1); n++) {
      matrix.copy(o.matrixWorld);
      if (o instanceof THREE.InstancedMesh) { o.getMatrixAt(n, instance); matrix.multiply(instance); }
      if (inverse) matrix.premultiply(inverse);
      for (let i = 0; i < positions.count; i++) box.expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(matrix));
    }
  });
  return box;
}

export class SpaceScene {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.05, 20000);
  private disposed = false;
  private sky: THREE.DataTexture | null = null;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private ao: GTAOPass;
  private hemisphere = new THREE.HemisphereLight(0xcbdfff, 0x383328, 0.3);
  private sun = new THREE.DirectionalLight(0xffe2b5, 2.5);
  private fill = new THREE.DirectionalLight(0xc4daff, 0.25);
  private interiorLight = new THREE.SpotLight(0xffe2bb, 0, 35, Math.PI / 2.8, 1, 2);
  private orbit: OrbitControls;
  private transform: TransformControls;
  private entries = new Map<string, Entry>();
  private surfaces: THREE.Mesh[] = [];
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private outline = new THREE.Box3Helper(new THREE.Box3());
  private grid = new THREE.GridHelper(40, 80);
  private drop = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.35, 40), new THREE.MeshBasicMaterial({ depthWrite: false, side: THREE.DoubleSide }));
  private floorMaterial = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  private pedestalMaterial = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  private room: SpaceRoom | null = null;
  private environment: THREE.WebGLRenderTarget;
  private outdoorEnvironment?: THREE.WebGLRenderTarget;
  private weather: SpaceWeather;
  private weatherKey = '';
  private weatherMotion = true;
  private weatherTimer = 0;
  private shadowDirty = true;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private currentView: View = 'home';
  private flight: { start: number; from: THREE.Vector3; to: THREE.Vector3; fromTarget: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private observer: ResizeObserver;
  private themeObserver: MutationObserver;
  private media = window.matchMedia('(prefers-color-scheme: dark)');
  private events = new AbortController();
  private frame = 0;
  private themeFrame = 0;
  private selected: string | null = null;
  private placing = false;
  private snap = false;
  private mode: Mode = 'translate';
  private cancelling = false;
  private touches = new Map<number, PointerEvent>();
  private consumedTouch: number | null = null;
  private forwarding = false;
  private drag: { id: number; entry: Entry; before: SpaceObject; plane: THREE.Plane; offset: THREE.Vector3; x: number; y: number; moved: boolean } | null = null;
  private press: { x: number; y: number; blank: boolean } | null = null;
  private turnDrag: { id: number; x: number; y: number; entry: Entry; resolve: (dx: number, dy: number) => string | null; fired: boolean } | null = null;
  walking = false;
  private walkKeys = new Set<string>();
  private walkTime = 0;
  private walkLook: { id: number; x: number; y: number } | null = null;

  constructor(private host: HTMLDivElement, private callbacks: {
    select: (id: string | null) => void;
    change: (object: SpaceObject) => void;
    place: (position: [number, number], level: Level, scale: number) => void;
    unavailable: () => void;
    walking: (active: boolean) => void;
    weatherError: () => void;
  }) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.weather = new SpaceWeather(host.clientWidth < 600, this.renderer, this.render, callbacks.weatherError);
    this.scene.add(this.weather.root);
    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = new GTAOPass(this.scene, this.camera, 1, 1);
    this.ao.updateGtaoMaterial({ radius: 0.24, thickness: 0.5, distanceExponent: 1.4 });
    this.ao.blendIntensity = 0.6;
    const renderAO = this.ao.render.bind(this.ao);
    this.ao.render = (...args) => {
      // Glass, reflection surfaces and invisible editing proxies must not occlude
      // the room's depth pass. Their opaque backing supplies the physical surface.
      const hidden: THREE.Object3D[] = [];
      this.scene.traverseVisible(o => {
        if (o === this.transform.getHelper() || o.userData.spaceBackdrop || o instanceof THREE.Mesh &&
          (o.type === 'Reflector' || (Array.isArray(o.material) ? o.material : [o.material]).every(m => !m.visible || m.transparent))) hidden.push(o);
      });
      hidden.forEach(o => { o.visible = false; });
      try { renderAO(...args); } finally { hidden.forEach(o => { o.visible = true; }); }
    };
    this.composer.addPass(this.ao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.65, 1.1);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new FXAAPass());
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', host.getAttribute('aria-label') ?? '3D cube space');
    canvas.setAttribute('aria-describedby', 'space-instructions');
    host.appendChild(canvas);
    this.orbit = new OrbitControls(this.camera, canvas);
    this.orbit.minDistance = 4;
    this.orbit.maxDistance = 240;
    this.orbit.maxPolarAngle = Math.PI / 2 - 0.025;
    this.orbit.maxTargetRadius = 70;
    this.orbit.screenSpacePanning = false;
    this.orbit.addEventListener('change', this.cameraChanged);
    this.transform = new TransformControls(this.camera, canvas);
    this.transform.setSize(0.85);
    this.scene.add(this.transform.getHelper());
    this.transform.addEventListener('change', this.render);
    this.transform.addEventListener('dragging-changed', e => { this.orbit.enabled = !e.value; });
    this.transform.addEventListener('objectChange', () => {
      const entry = this.selected && this.entries.get(this.selected);
      if (entry) { this.settle(entry); this.render(); }
    });
    this.transform.addEventListener('mouseUp', () => {
      const entry = this.selected && this.entries.get(this.selected);
      if (entry && !this.cancelling) this.callbacks.change(this.read(entry));
    });
    this.scene.add(this.hemisphere);
    const light = this.sun;
    light.position.set(-12, 10, 9);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    Object.assign(light.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 0.5, far: 180 });
    light.shadow.bias = -0.0002;
    light.shadow.normalBias = 0.025;
    light.shadow.radius = 3;
    this.scene.add(light);
    const fill = this.fill;
    fill.position.set(6, 5, 10);
    this.scene.add(fill);
    this.interiorLight.castShadow = true;
    this.interiorLight.shadow.mapSize.set(1024, 1024);
    this.interiorLight.shadow.normalBias = 0.018;
    this.interiorLight.shadow.bias = -0.0001;
    this.interiorLight.shadow.radius = 4;
    this.scene.add(this.interiorLight, this.interiorLight.target);
    const environmentScene = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(environmentScene);
    this.scene.environment = this.environment.texture;
    environmentScene.dispose();
    pmrem.dispose();
    new HDRLoader().load('/assets/space/v1/sunset.hdr.bin', texture => {
      if (!this.disposed) {
        const generator = new THREE.PMREMGenerator(this.renderer);
        this.outdoorEnvironment = generator.fromEquirectangular(texture);
        if (!this.weatherKey) this.scene.environment = this.outdoorEnvironment.texture;
        generator.dispose(); this.render();
        texture.mapping = THREE.EquirectangularReflectionMapping; this.sky = texture;
        if (!this.weatherKey) this.scene.background = texture;
        this.scene.backgroundIntensity = 0.12;
        return;
      }
      texture.dispose();
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), this.floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.32;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.surfaces.push(floor);
    for (const p of PEDESTALS) {
      const pedestal = new THREE.Mesh(new RoundedBoxGeometry(p.width, p.height, p.depth, 2, 0.035), this.pedestalMaterial);
      pedestal.position.set(p.x, p.height / 2, p.z);
      pedestal.castShadow = pedestal.receiveShadow = true;
      this.scene.add(pedestal);
      this.surfaces.push(pedestal);
    }
    this.grid.position.y = 0.006;
    this.grid.visible = false;
    this.scene.add(this.grid);
    this.drop.rotation.x = -Math.PI / 2;
    this.drop.visible = false;
    this.scene.add(this.drop);
    this.outline.visible = false;
    this.scene.add(this.outline);
    this.observer = new ResizeObserver(() => {
      // A hidden canvas has no renderable area; keep its last valid targets.
      const width = host.clientWidth, height = host.clientHeight;
      if (!width || !height) return;
      this.camera.aspect = width / height;
      this.camera.fov = ['interior', 'study', 'bedroom', 'bathroom', 'courtyard', 'garage', 'cinema', 'gym'].includes(this.currentView) ? (width < 600 ? 76 : this.room?.style === 'company' ? 65 : 58) : width < 600 ? 60 : 46;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.composer.setSize(width, height);
      this.ao.setSize(Math.ceil(width * 0.75), Math.ceil(height * 0.75));
      this.room?.resize(width);
      this.render();
    });
    this.observer.observe(host);
    this.themeObserver = new MutationObserver(this.theme);
    this.themeObserver.observe(document.documentElement, { attributes: true });
    this.media.addEventListener('change', this.theme);
    this.reducedMotion.addEventListener('change', this.render, { signal: this.events.signal });
    document.addEventListener('visibilitychange', () => {
      clearTimeout(this.weatherTimer);
      if (document.hidden) { cancelAnimationFrame(this.frame); this.frame = 0; }
      else this.render();
    }, { signal: this.events.signal });
    // Appearance previews animate CSS tokens after the attribute mutation.
    for (const event of ['transitionend', 'transitioncancel'] as const) {
      document.documentElement.addEventListener(event, e => {
        if (e.propertyName === '--background' || e.propertyName === '--muted' || e.propertyName === '--accent') this.theme();
      }, { signal: this.events.signal });
    }
    this.theme();
    const options = { capture: true, signal: this.events.signal };
    canvas.addEventListener('pointerdown', this.down, options);
    canvas.addEventListener('wheel', () => { this.flight = null; }, { passive: true, signal: this.events.signal });
    canvas.addEventListener('pointermove', this.move, options);
    canvas.addEventListener('pointerleave', () => { this.drop.visible = false; this.render(); }, { signal: this.events.signal });
    canvas.addEventListener('pointerup', this.up, options);
    canvas.addEventListener('pointercancel', e => { this.touches.delete(e.pointerId); this.consumedTouch = null; this.cancel(); }, options);
    canvas.addEventListener('lostpointercapture', this.cancel, options);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.callbacks.unavailable(); }, { signal: this.events.signal });
    window.addEventListener('blur', () => { this.touches.clear(); this.consumedTouch = null; this.cancel(); }, { signal: this.events.signal });
    const movement: Record<string, string> = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
    canvas.addEventListener('keydown', event => {
      if (!this.walking || event.ctrlKey || event.metaKey || event.altKey) return;
      const direction = movement[event.code];
      if (direction) { event.preventDefault(); this.walkInput(direction, true); }
    }, { signal: this.events.signal });
    window.addEventListener('keyup', event => { const direction = movement[event.code]; if (direction) this.walkInput(direction, false); }, { signal: this.events.signal });
    this.view('interior');
  }

  private theme = () => {
    cancelAnimationFrame(this.themeFrame);
    this.themeFrame = requestAnimationFrame(this.updateTheme);
  };

  private updateTheme = () => {
    const probe = document.createElement('span');
    this.host.appendChild(probe);
    // Canvas resolves CSS Color 4 / animated oklab tokens to sRGB for Three.js.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    const color = (token: string) => {
      probe.style.color = `var(${token})`;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = getComputedStyle(probe).color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
      return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    };
    (this.outline.material as THREE.LineBasicMaterial).color.copy(color('--accent'));
    this.drop.material.color.copy(color('--accent'));
    const gridMaterial = this.grid.material as THREE.LineBasicMaterial;
    gridMaterial.color.copy(color('--border-strong'));
    gridMaterial.vertexColors = false;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.35;
    probe.remove();
    this.render();
  };

  private render = () => {
    this.shadowDirty = true;
    if (this.room) this.weather.patchSurfaces(this.room.root);
    this.scheduleRender();
  };

  private scheduleRender = () => {
    if (this.disposed || this.frame || document.hidden) return;
    this.frame = requestAnimationFrame(time => {
      this.frame = 0;
      if (this.walking && this.walkKeys.size && this.room) {
        const dt = this.walkTime ? Math.min(0.05, (time - this.walkTime) / 1000) : 0;
        this.walkTime = time;
        const forward = this.camera.getWorldDirection(new THREE.Vector3()); forward.y = 0; forward.normalize();
        const right = new THREE.Vector3(-forward.z, 0, forward.x);
        const movement = forward.multiplyScalar(Number(this.walkKeys.has('forward')) - Number(this.walkKeys.has('back'))).addScaledVector(right, Number(this.walkKeys.has('right')) - Number(this.walkKeys.has('left'))).normalize().multiplyScalar(dt * 2.2);
        const p = this.camera.position, foot = p.y - 1.65;
        const next = walkStep([p.x, foot, p.z], movement.x, movement.z, this.room.style, this.room.obstacles);
        const delta = new THREE.Vector3(next[0] - p.x, next[1] - foot, next[2] - p.z);
        this.camera.position.add(delta); this.orbit.target.add(delta); this.render();
      } else this.walkTime = 0;
      if (this.flight) {
        const t = Math.min(1, (time - this.flight.start) / 450);
        const eased = t * t * (3 - 2 * t);
        this.camera.position.lerpVectors(this.flight.from, this.flight.to, eased);
        this.orbit.target.lerpVectors(this.flight.fromTarget, this.flight.target, eased);
        this.camera.lookAt(this.orbit.target);
        if (t === 1) { this.flight = null; this.orbit.update(); }
        else this.render();
      }
      const entry = this.selected && this.entries.get(this.selected);
      if (entry) this.outline.box.setFromObject(entry.proxy);
      for (const e of this.entries.values()) {
        if (turnBusy(e.model)) this.render();
        else if (e.turning) { e.turning = false; this.apply(e, e.data); }
      }
      this.room?.update(this.camera, ['home', 'front', 'side', 'top'].includes(this.currentView));
      const animateWeather = this.weather.update(time, this.camera, this.weatherMotion && !this.reducedMotion.matches);
      if (this.room?.style !== 'company' && this.weather.environment) this.scene.environment = this.weather.environment;
      // Weather changes don't move the building or cubes; retain their shadow maps.
      this.renderer.shadowMap.needsUpdate = this.shadowDirty;
      this.shadowDirty = false;
      this.composer.render();
      clearTimeout(this.weatherTimer);
      if (animateWeather) this.weatherTimer = window.setTimeout(this.scheduleRender, Math.max(0, 33 - (performance.now() - time)));
    });
  };

  private create(data: SpaceObject): Entry {
    const model = data.kind === 'sq1' ? new Sq1Cube() : data.kind === 'pyram' ? new PyraCube() :
      data.kind === 'minx' ? new MegaminxCube() : data.kind === 'skewb' ? new SkewbCube() :
        new Cube(data.kind === 'mirror' ? 3 : Number(data.kind[0]), data.kind === 'mirror');
    if (model instanceof Cube) {
      model.instancedRenderer.thickness = true;
      const faces = model.isMirror ? mirrorFaces() : CUBE_FILL;
      model.instancedRenderer.setFaceColorOverride(faces);
      if (model.isMirror) {
        model.instancedRenderer.setRawCore(true, faces, Cubelet.CORE.color.getStyle(), true);
      }
    }
    const bounds = visibleBounds(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const normalizer = new THREE.Group();
    const factor = 1.55 / Math.max(size.x, size.y, size.z);
    normalizer.scale.setScalar(factor);
    // Keep the engine's own frozen matrices, orientation and normalization intact.
    const centered = new THREE.Group();
    centered.position.copy(center).negate();
    centered.add(model);
    normalizer.add(centered);
    const root = new THREE.Group();
    root.add(normalizer);
    // Give the room its own physical finish while retaining the simulator's shaders
    // and materials for their original owner to dispose. Shared materials stay intact.
    const materials: Entry['materials'] = new Map();
    const originals: Entry['originals'] = new Map();
    model.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = o.receiveShadow = true;
      originals.set(o, o.material);
      const finish = (source: THREE.Material) => {
        if (!source.visible || source.transparent || source.side === THREE.BackSide) return source;
        let material = materials.get(source);
        if (!material) {
          const original = source as THREE.MeshPhongMaterial;
          material = new THREE.MeshPhysicalMaterial({
            color: original.color, map: original.map ?? null, vertexColors: source.vertexColors,
            side: source.side, roughness: data.kind === 'mirror' ? 0.16 : 0.28,
            metalness: data.kind === 'mirror' ? 0.94 : 0.04, clearcoat: 0.5, clearcoatRoughness: 0.2,
            polygonOffset: source.polygonOffset, polygonOffsetFactor: source.polygonOffsetFactor,
            polygonOffsetUnits: source.polygonOffsetUnits, depthWrite: source.depthWrite,
          });
          material.onBeforeCompile = source.onBeforeCompile;
          material.customProgramCacheKey = () => source.customProgramCacheKey();
          materials.set(source, material);
        }
        return material;
      };
      o.material = Array.isArray(o.material) ? o.material.map(finish) : finish(o.material);
    });
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(size.x * factor, size.y * factor, size.z * factor), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.userData.spaceId = data.id;
    root.add(proxy);
    this.scene.add(root);
    return { root, model, proxy, data, appliedMoves: '', materials, originals };
  }

  private apply(entry: Entry, data: SpaceObject) {
    const moves = (data.moves ?? []).join(' ');
    if (moves !== entry.appliedMoves) {
      entry.model.twister.setup('');
      for (const move of data.moves ?? []) turnPuzzle(entry.model, move, true);
      entry.appliedMoves = moves;
    }
    entry.data = data;
    if (turnBusy(entry.model)) return;
    entry.root.position.set(data.position[0], 0, data.position[1]);
    entry.root.rotation.set(...data.rotation);
    entry.root.scale.setScalar(data.scale);
    this.settle(entry, false);
  }

  private settle(entry: Entry, snap = this.snap) {
    const position = movePosition([entry.root.position.x, entry.root.position.z], snap);
    entry.root.position.set(position[0], 0, position[1]);
    const box = visibleBounds(entry.model);
    const level = entry.data.level ?? 0;
    let height = this.room?.style === 'company' ? 0 : floorHeight(position[0], position[1], level);
    // ponytail: platform contact uses bounding boxes; stacking needs a collision solver.
    for (const p of this.room?.style === 'company' || level === 1 ? [] : PEDESTALS) {
      if (box.max.x > p.x - p.width / 2 && box.min.x < p.x + p.width / 2 &&
        box.max.z > p.z - p.depth / 2 && box.min.z < p.z + p.depth / 2) height = Math.max(height, p.height);
    }
    this.room?.root.updateWorldMatrix(true, true);
    const supportRay = new THREE.Raycaster(new THREE.Vector3(position[0], level * 5 + 1.5, position[1]), new THREE.Vector3(0, -1, 0), 0, 1.6);
    const support = surfaceHit(supportRay, this.room?.surfaces ?? []);
    if (support) height = Math.max(height, support.point.y);
    entry.root.position.y = height - box.min.y;
    entry.root.updateMatrixWorld(true);
    const localBounds = visibleBounds(entry.model, entry.root);
    entry.proxy.geometry.dispose(); entry.proxy.geometry = new THREE.BoxGeometry(...localBounds.getSize(new THREE.Vector3()).toArray());
    entry.proxy.position.copy(localBounds.getCenter(new THREE.Vector3()));
  }

  private read(entry: Entry): SpaceObject {
    const { rotation, position } = entry.root;
    return { ...entry.data, position: [position.x, position.z], rotation: [rotation.x, rotation.y, rotation.z] as Vec3 };
  }

  sync(layout: Layout, selected: string | null, mode: Mode, snap: boolean, placing: boolean) {
    // An external edit/undo cancels any unfinished gesture before reconciling models.
    if (!this.turnDrag || mode !== this.mode || selected !== this.selected || layout.objects.find(o => o.id === selected)?.moves?.join(' ') !== this.turnDrag.entry.appliedMoves) this.cancel();
    const style = layout.room ?? 'minimal';
    if (this.room?.style !== style) {
      this.weather.forgetRoom();
      this.room?.dispose();
      this.room = new SpaceRoom(style, [this.transform.getHelper(), this.outline, this.grid, this.drop], this.render);
      this.scene.add(this.room.root);
      this.room.resize(this.host.clientWidth);
      const p = this.room.palette;
      this.scene.background = this.sky && style !== 'cyberpunk' && style !== 'company' ? this.sky : new THREE.Color(p.sky);
      this.scene.fog = new THREE.Fog(style === 'cyberpunk' || style === 'company' ? p.sky : 0x827e7d, 120, 550);
      this.scene.backgroundRotation.y = 2;
      this.scene.environmentRotation.y = style === 'company' ? 0 : 2;
      const cyber = style === 'cyberpunk';
      this.scene.environment = style === 'company' ? this.environment.texture : (this.outdoorEnvironment ?? this.environment).texture;
      this.scene.environmentIntensity = cyber ? 0.3 : style === 'company' ? 0.25 : 0.38;
      this.hemisphere.color.setHex(style === 'company' ? 0xf3f3ef : 0xcbdfff);
      this.hemisphere.intensity = cyber ? 0.06 : style === 'company' ? 0.16 : 0.1;
      this.sun.color.setHex(cyber ? 0x8cb8ff : 0xffead4);
      this.sun.intensity = cyber ? 0.15 : 2.2;
      this.sun.position.set(-35, 32, 42);
      this.sun.target.position.set(-9, 0, -3); this.scene.add(this.sun.target);
      if (style === 'company') this.sun.intensity = 0.12;
      this.fill.intensity = cyber ? 0.08 : 0.12;
      this.bloom.strength = cyber ? 0.18 : 0.04;
      this.renderer.toneMappingExposure = cyber ? 0.85 : 0.92;
      this.floorMaterial.color.setHex(p.ground);
      this.pedestalMaterial.color.setHex(p.stone);
      this.pedestalMaterial.metalness = style === 'cyberpunk' ? 0.65 : 0.2;
      this.pedestalMaterial.roughness = 0.22;
      // The room owns terrain and paving; the legacy plane would cover them.
      this.surfaces.forEach((surface, i) => { surface.visible = style !== 'company' && i > 0; });
      this.view(style === 'company' ? 'interior' : this.currentView);
    }
    this.weatherMotion = layout.weatherMotion ?? true;
    const weather = layout.weather ?? 'sunny', weatherKey = `${style}:${weather}`;
    if (weatherKey !== this.weatherKey) {
      this.weatherKey = weatherKey;
      this.weather.set(weather, style, this.room!.root);
      this.scene.background = null;
      const light = this.weather.lighting(), cyber = style === 'cyberpunk', company = style === 'company';
      this.scene.environment = company ? this.environment.texture : this.weather.environment ?? this.environment.texture;
      this.scene.environmentIntensity = company ? 0.25 : cyber ? 0.45 : 0.8;
      this.scene.environmentRotation.y = 0;
      this.scene.fog = light.fog;
      this.sun.intensity = (cyber ? 0.15 : company ? 0.12 : 2.2) * light.sun;
      this.hemisphere.intensity = (cyber ? 0.08 : company ? 0.16 : 0.28) * light.ambient;
      this.fill.intensity = (cyber ? 0.08 : 0.12) * light.ambient;
    }
    for (const [id, entry] of this.entries) {
      if (!layout.objects.some(o => o.id === id && o.kind === entry.data.kind)) {
        this.transform.detach();
        this.remove(entry);
        this.entries.delete(id);
      }
    }
    for (const data of layout.objects) {
      let entry = this.entries.get(data.id);
      if (!entry) { entry = this.create(data); this.entries.set(data.id, entry); }
      this.apply(entry, data);
    }
    this.selected = selected;
    this.mode = mode;
    this.snap = snap;
    this.placing = placing;
    this.drop.visible = false;
    this.grid.visible = snap;
    this.transform.setMode(mode === 'twist' ? 'rotate' : mode);
    this.transform.showY = mode === 'rotate';
    this.transform.setTranslationSnap(snap ? 0.5 : null);
    this.transform.setRotationSnap(snap ? Math.PI / 12 : null);
    const entry = selected && this.entries.get(selected);
    if (entry && !placing && !this.walking && mode !== 'twist') this.transform.attach(entry.root);
    else this.transform.detach();
    this.outline.visible = !!entry && !placing;
    this.renderer.domElement.style.cursor = placing ? 'crosshair' : 'grab';
    this.render();
  }

  twist(token: string, entry = this.selected ? this.entries.get(this.selected) : undefined) {
    if (!entry || (entry.data.moves?.length ?? 0) >= 2000 || !validSpaceMove(entry.data.kind, token)) return false;
    if (!turnPuzzle(entry.model, token)) return false;
    entry.data = { ...entry.data, moves: [...entry.data.moves ?? [], token] };
    entry.appliedMoves = entry.data.moves!.join(' ');
    entry.turning = true;
    this.callbacks.change(this.read(entry));
    this.render();
    return true;
  }

  private cameraChanged = () => {
    const r = VILLA_ROOMS[this.currentView as keyof typeof VILLA_ROOMS];
    if (r && this.room?.style !== 'company' && !this.flight && !this.walking) {
      this.camera.position.clamp(new THREE.Vector3(r.x - r.width / 2 + 0.3, r.level * 5 + 0.4, r.z - r.depth / 2 + 0.3), new THREE.Vector3(r.x + r.width / 2 - 0.3, r.ceiling - 0.3, r.z + r.depth / 2 - 0.3));
      this.camera.lookAt(this.orbit.target);
    }
    this.render();
  };

  view(view: View) {
    this.setWalking(false);
    this.cancel();
    this.currentView = view;
    const inside = ['interior', 'study', 'bedroom', 'bathroom', 'courtyard', 'garage', 'cinema', 'gym'].includes(view);
    this.scene.backgroundIntensity = 0.12;
    this.orbit.minDistance = inside ? 0.2 : 4;
    const mobile = this.host.clientWidth < 600;
    this.camera.fov = inside ? (mobile ? 76 : this.room?.style === 'company' ? 65 : 58) : mobile ? 60 : 46;
    this.camera.updateProjectionMatrix();
    const target = new THREE.Vector3(-9, 3, -2);
    const direction = new THREE.Vector3(...(({ home: [0.72, 0.85, 1], front: [0, 0.2, 1], side: [1, 0.35, 0], top: [0, 1, 0.001] } as Partial<Record<View, Vec3>>)[view] ?? [0.85, 0.35, 1])).normalize();
    const position = target.clone().addScaledVector(direction, mobile ? 76 : 62);
    if (view === 'exterior') { position.set(mobile ? 75 : 42, mobile ? 36 : 21, mobile ? 97 : 57); target.set(0, 3, 4); }
    if (view === 'exterior' && (this.room?.style === 'penthouse' || this.room?.style === 'cyberpunk')) {
      target.set(0, -3, 4);
      position.set(mobile ? 95 : 55, mobile ? 55 : 27, mobile ? 115 : 64);
    }
    const cameras: Partial<Record<View, [Vec3, Vec3]>> = this.room?.style === 'company' ? {
      interior: [[-21.5, 1.7, 4.9], [-23.3, 1.15, 0.8]], study: [[-8.2, 1.65, 3.8], [-13.3, 1.25, -2.4]], courtyard: [[-14.3, 1.7, 12], [-16.5, 1.15, 8.6]],
    } : {
      interior: [[-9.3, 1.65, -3.4], [-4.8, 1.2, -6.5]], study: [[-20, 1.75, 5], [-25, 1.35, -0.5]], bedroom: [[-20, 6.75, 3.8], [-24.3, 6.1, -0.9]], bathroom: [[-19.9, 7, -5.1], [-23.5, 6.5, -11.5]], courtyard: [[-13.4, 2.1, 10], [-13.4, 2.5, -5]],
      garage: [[13.7, 1.65, -5.2], [22, 0.85, -11]], cinema: [[13.8, 1.65, 7.8], [26, 1.4, 2.8]], gym: [[13.3, 1.65, 15.5], [24, 1.1, 19]],
    };
    if (cameras[view]) { position.set(...cameras[view][0]); target.set(...cameras[view][1]); }
    const lighting: Partial<Record<View, [Vec3, Vec3]>> = this.room?.style === 'company' ? {
      interior: [[-23, 2.65, 2], [-23, 0, 1.5]], study: [[-13, 3.15, 2], [-13, 0, -1]], courtyard: [[-17, 3.2, 11], [-17, 0, 9]],
    } : {
      interior: [[-7, 6.8, -3], [-4, 0, -6]], study: [[-24, 4.4, 2], [-25, 0, 0]], bedroom: [[-23, 8.8, 2], [-24, 5, 0]], bathroom: [[-24, 9, -10], [-24, 5, -11]],
      garage: [[21, 3.8, -10], [21, 0, -10]], gym: [[21, 3.8, 18], [21, 0, 20]],
    };
    this.interiorLight.intensity = lighting[view] ? (this.room?.style === 'company' ? 22 : this.room?.style === 'cyberpunk' ? 35 : 100) : 0;
    this.interiorLight.penumbra = view === 'garage' ? 0.25 : 1;
    this.interiorLight.color.setHex(this.room?.style === 'company' ? 0xf1f4ef : this.room?.style === 'cyberpunk' ? 0x5bb9ff : 0xffe2bb);
    if (lighting[view]) { this.interiorLight.position.set(...lighting[view][0]); this.interiorLight.target.position.set(...lighting[view][1]); }
    this.fly(position, target);
  }

  private fly(to: THREE.Vector3, target: THREE.Vector3) {
    if (!this.room || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.flight = null;
      this.camera.position.copy(to);
      this.orbit.target.copy(target);
      this.orbit.update();
    } else {
      this.flight = { start: performance.now(), from: this.camera.position.clone(), to, fromTarget: this.orbit.target.clone(), target };
    }
    this.render();
  }

  focus() {
    this.setWalking(false);
    const entry = this.selected && this.entries.get(this.selected);
    if (!entry) return;
    this.currentView = 'home';
    this.orbit.minDistance = 0.15;
    const direction = this.camera.position.clone().sub(this.orbit.target).normalize();
    this.fly(entry.root.position.clone().addScaledVector(direction, Math.max(0.3, entry.data.scale * 5)), entry.root.position.clone());
  }

  private cast(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
  }

  setWalking(active: boolean) {
    if (active === this.walking) return;
    if (active && !this.room) return;
    if (active && !['interior', 'study', 'bedroom', 'bathroom', 'courtyard', 'garage', 'cinema', 'gym'].includes(this.currentView)) this.view('interior');
    if (active && this.flight) {
      this.camera.position.copy(this.flight.to); this.orbit.target.copy(this.flight.target); this.camera.lookAt(this.orbit.target); this.flight = null;
    }
    if (active) {
      const p = this.camera.position;
      const floor = walkFloor(p.x, p.z, p.y > 5 ? 5 : 0, this.room!.style);
      if (floor === null) return;
      const delta = floor + 1.65 - p.y; p.y += delta; this.orbit.target.y += delta;
      this.transform.detach(); this.outline.visible = false;
      this.renderer.domElement.focus({ preventScroll: true });
    }
    this.walking = active; this.walkKeys.clear(); this.walkLook = null; this.walkTime = 0;
    this.orbit.enabled = this.transform.enabled = !active;
    this.callbacks.walking(active); this.render();
  }

  walkInput(direction: string, pressed: boolean) {
    if (!this.walking || !['forward', 'back', 'left', 'right'].includes(direction)) return;
    if (pressed) this.walkKeys.add(direction); else this.walkKeys.delete(direction);
    this.render();
  }

  private placementHit() {
    const hit = surfaceHit(this.ray, [...this.surfaces, ...this.room?.surfaces ?? []]);
    if (!hit) return undefined;
    // A table behind a wall is not a visible placement target.
    const point = new THREE.Vector3();
    if (this.room?.obstacles.some(o => this.ray.ray.intersectBox(new THREE.Box3(new THREE.Vector3(o.minX, o.minY, o.minZ), new THREE.Vector3(o.maxX, o.maxY, o.maxZ)), point) && point.distanceTo(this.ray.ray.origin) < hit.distance - 0.025)) return undefined;
    return hit;
  }

  private down = (event: PointerEvent) => {
    if (this.forwarding) return;
    if (this.walking) {
      if (event.button === 0 && !this.walkLook) {
        this.renderer.domElement.focus({ preventScroll: true });
        this.walkLook = { id: event.pointerId, x: event.clientX, y: event.clientY };
        this.renderer.domElement.setPointerCapture(event.pointerId);
      }
      event.stopImmediatePropagation(); return;
    }
    this.flight = null;
    if (event.pointerType === 'touch') this.touches.set(event.pointerId, event);
    if (this.touches.size > 1) {
      this.cancel();
      // Hand a touch that began on a cube back to OrbitControls for pinch/pan.
      const first = this.consumedTouch !== null && this.touches.get(this.consumedTouch);
      this.consumedTouch = null;
      this.transform.enabled = false;
      if (first) {
        this.forwarding = true;
        this.renderer.domElement.dispatchEvent(new PointerEvent('pointerdown', first));
        this.forwarding = false;
      }
      return;
    }
    if (event.button !== 0) return;
    this.renderer.domElement.focus({ preventScroll: true });
    this.cast(event);
    this.press = { x: event.clientX, y: event.clientY, blank: false };
    if (this.placing) {
      this.orbit.enabled = false;
      if (event.pointerType === 'touch') this.consumedTouch = event.pointerId;
      this.renderer.domElement.setPointerCapture(event.pointerId);
      event.stopImmediatePropagation(); return;
    }
    if (this.mode !== 'twist') {
      this.transform.pointerHover(new PointerEvent('pointermove', { clientX: this.pointer.x, clientY: this.pointer.y, button: event.button }));
      if (this.transform.axis) return;
    }
    const hit = this.ray.intersectObjects([...this.entries.values()].map(e => e.proxy), false)[0];
    const entry = hit && this.entries.get(hit.object.userData.spaceId);
    this.press.blank = !entry;
    if (!entry) return;
    if (this.selected !== entry.data.id) {
      if (event.pointerType === 'touch') this.consumedTouch = event.pointerId;
      this.callbacks.select(entry.data.id); event.stopImmediatePropagation(); return;
    }
    if (this.mode === 'twist') {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const resolve = pickTurn(entry.model, this.scene, this.camera, event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
      if (!resolve) return;
      this.turnDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, entry, resolve, fired: false };
      this.orbit.enabled = this.transform.enabled = false;
      if (event.pointerType === 'touch') this.consumedTouch = event.pointerId;
      this.renderer.domElement.setPointerCapture(event.pointerId);
      event.stopImmediatePropagation(); return;
    }
    if (this.mode !== 'translate') return;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -hit.point.y);
    this.drag = { id: event.pointerId, entry, before: this.read(entry), plane, offset: entry.root.position.clone().sub(hit.point), x: event.clientX, y: event.clientY, moved: false };
    this.orbit.enabled = false;
    this.transform.enabled = false;
    if (event.pointerType === 'touch') this.consumedTouch = event.pointerId;
    this.renderer.domElement.setPointerCapture(event.pointerId);
    event.stopImmediatePropagation();
  };

  private move = (event: PointerEvent) => {
    if (this.walking) {
      if (this.walkLook?.id === event.pointerId) {
        const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
        euler.y -= (event.clientX - this.walkLook.x) * 0.003;
        euler.x = THREE.MathUtils.clamp(euler.x - (event.clientY - this.walkLook.y) * 0.003, -1.3, 1.3);
        this.camera.quaternion.setFromEuler(euler);
        this.orbit.target.copy(this.camera.position).add(this.camera.getWorldDirection(new THREE.Vector3()));
        this.walkLook.x = event.clientX; this.walkLook.y = event.clientY; this.render();
      }
      event.stopImmediatePropagation(); return;
    }
    if (this.touches.has(event.pointerId)) this.touches.set(event.pointerId, event);
    if (this.turnDrag?.id === event.pointerId) {
      const drag = this.turnDrag, dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.fired && Math.hypot(dx, dy) > 12) {
        const token = drag.resolve(dx, dy);
        if (token) { drag.fired = true; this.twist(token, drag.entry); }
      }
      event.stopImmediatePropagation(); return;
    }
    if (this.placing) {
      this.cast(event);
      const hit = this.placementHit();
      this.drop.visible = !!hit;
      if (hit) {
        const [x, z] = movePosition([hit.point.x, hit.point.z], this.snap);
        this.drop.position.set(x, hit.point.y + 0.02, z);
      }
      this.render();
    }
    if (!this.drag || this.drag.id !== event.pointerId) return;
    this.cast(event);
    const point = this.ray.ray.intersectPlane(this.drag.plane, new THREE.Vector3());
    if (point && Math.hypot(event.clientX - this.drag.x, event.clientY - this.drag.y) > 3) {
      this.drag.moved = true;
      this.drag.entry.root.position.copy(point).add(this.drag.offset);
      this.settle(this.drag.entry);
      this.render();
    }
    event.stopImmediatePropagation();
  };

  private up = (event: PointerEvent) => {
    if (this.walking) {
      if (this.walkLook?.id === event.pointerId) { this.walkLook = null; if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId); }
      event.stopImmediatePropagation(); return;
    }
    this.touches.delete(event.pointerId);
    if (this.consumedTouch === event.pointerId) this.consumedTouch = null;
    if (!this.touches.size) this.transform.enabled = true;
    if (this.turnDrag?.id === event.pointerId) {
      this.turnDrag = null; this.press = null;
      this.orbit.enabled = this.transform.enabled = true;
      if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
      event.stopImmediatePropagation(); return;
    }
    if (this.drag?.id === event.pointerId) {
      const drag = this.drag;
      this.drag = null;
      this.orbit.enabled = this.transform.enabled = true;
      if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
      if (drag.moved) this.callbacks.change(this.read(drag.entry));
      event.stopImmediatePropagation();
    } else if (this.press && Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y) < 5) {
      if (this.placing) {
        this.cast(event);
        const hit = this.placementHit();
        if (hit) {
          const level = hit.point.y > 4 ? 1 : 0;
          const tabletop = !this.surfaces.includes(hit.object as THREE.Mesh) && hit.point.y > level * 5 + 0.12;
          this.callbacks.place(movePosition([hit.point.x, hit.point.z], this.snap), level, this.room?.style === 'company' || tabletop ? 0.06 : 1);
        }
        this.orbit.enabled = true;
        if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
        event.stopImmediatePropagation();
      } else if (this.press.blank && !this.transform.dragging) this.callbacks.select(null);
    }
    if (this.placing) this.orbit.enabled = true;
    this.press = null;
  };

  cancel = () => {
    this.walkKeys.clear(); this.walkLook = null; this.walkTime = 0;
    if (this.turnDrag && this.renderer.domElement.hasPointerCapture(this.turnDrag.id)) this.renderer.domElement.releasePointerCapture(this.turnDrag.id);
    this.turnDrag = null;
    const drag = this.drag;
    this.drag = null;
    this.press = null;
    if (drag) {
      this.apply(drag.entry, drag.before);
      if (this.renderer.domElement.hasPointerCapture(drag.id)) this.renderer.domElement.releasePointerCapture(drag.id);
    }
    if (this.transform.dragging) {
      this.cancelling = true;
      this.transform.reset();
      this.transform.pointerUp(new PointerEvent('pointerup', { button: 0 }));
      this.cancelling = false;
    }
    this.orbit.enabled = this.transform.enabled = !this.walking;
    this.render();
  };

  private remove(entry: Entry) {
    this.scene.remove(entry.root);
    entry.originals.forEach((material, mesh) => { mesh.material = material; });
    entry.materials.forEach(material => material.dispose());
    entry.model.dispose();
    entry.proxy.geometry.dispose();
    (entry.proxy.material as THREE.Material).dispose();
  }

  dispose() {
    this.disposed = true;
    this.flight = null;
    this.cancel();
    this.events.abort();
    this.observer.disconnect();
    this.themeObserver.disconnect();
    this.media.removeEventListener('change', this.theme);
    this.transform.dispose();
    this.orbit.dispose();
    for (const entry of this.entries.values()) this.remove(entry);
    for (const surface of this.surfaces) surface.geometry.dispose();
    this.scene.traverse(o => { if (o instanceof THREE.DirectionalLight) o.shadow.dispose(); });
    this.floorMaterial.dispose();
    this.pedestalMaterial.dispose();
    this.room?.dispose();
    clearTimeout(this.weatherTimer);
    this.weather.dispose();
    this.environment.dispose();
    this.interiorLight.shadow.dispose();
    this.outdoorEnvironment?.dispose();
    this.sky?.dispose();
    this.drop.geometry.dispose();
    this.drop.material.dispose();
    this.outline.dispose();
    this.grid.dispose();
    this.composer.passes.forEach(pass => pass.dispose());
    this.composer.dispose();
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.themeFrame);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
