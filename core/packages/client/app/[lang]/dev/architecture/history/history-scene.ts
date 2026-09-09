import * as T from 'three';
import { renderFromSimpleQuery } from '@cuberoot/visualcube';
import { HISTORY_PLACES, HISTORY_SPACING, HISTORY_GAITS, type HistoryGait, clampHistoryPosition, historyWindow } from './history-days';
import { PaperScenery, type PaperPalette } from './history-scenery';
import { groundY, pathZ, pathY } from './history-environment';
import { buildHistoryLand } from './history-terrain';
import { PaperWeather } from './history-weather';
import { PaperLighting } from './history-lighting';
import { PaperWater } from './history-water';
import { PaperTraveler } from './history-traveler';
import { HISTORY_LANDFORMS } from './history-landforms';
import { PaperWildlife } from './history-wildlife';
import { HISTORY_SECRETS } from './history-secrets';
import { buildHistorySecret } from './history-secret-models';

export interface HistoryScene {
  seek: (position: number, immediate?: boolean) => void;
  setWeather: (variation: number) => void;
  setMotion: (enabled: boolean) => void;
  setSpeed: (multiplier: number) => void;
  setGait: (gait: HistoryGait) => void;
  /** Manual scenes use the same render path, independent of the live page's clock. */
  captureFrame: (position: number, seconds: number) => {
    canvas: HTMLCanvasElement;
    points: { index: number; x: number; y: number }[];
    ink: string;
  };
  ready: () => Promise<void>;
  dispose: () => void;
}

/** The camera follows one bounded coordinate; navigation never rotates the artwork. */
export function mountHistoryScene(host: HTMLDivElement, nodes: (HTMLButtonElement | null)[], initial: number,
  onProgress: (position: number) => void, onSettle: (position: number) => void, onFailure: () => void,
  secretNodes: (HTMLButtonElement | null)[] = [],
  capture?: { labelHeight: number }): HistoryScene {
  const style = getComputedStyle(host);
  const palette = Object.fromEntries(['paper', 'limestone', 'jade', 'forest', 'water', 'vermilion', 'gold', 'mist', 'ink', 'ice', 'snow', 'ocean', 'clay', 'sand', 'heather']
    .map(key => [key, style.getPropertyValue(`--scroll-${key}`).trim()])) as PaperPalette;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  const scene = new T.Scene();
  const art = new PaperScenery(palette);
  const goldGlow = new T.Color(palette.gold).lerp(new T.Color(palette.paper), .18);
  const camera = new T.OrthographicCamera(-20, 20, 14, -14, .1, 150);
  let disposed = false, frame = 0, width = 1, height = 1, previousTime = 0, labelHeight = 0;
  let visible = true, motion = true, variation = 0, animationTime = 0, lastRender = 0, reportedPosition = -1;
  let speed = 1;
  let gait: HistoryGait = 'walk';
  let weather: PaperWeather | undefined;
  let lighting: PaperLighting | undefined;
  let water: PaperWater | undefined;
  let traveler: PaperTraveler | undefined;
  let position = clampHistoryPosition(initial), target = position, settled = position;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  motion = !capture && !reducedMotion.matches;
  const images: HTMLImageElement[] = [];
  const exhibitMaterials: T.MeshBasicMaterial[] = [];
  const secretAnchors = new Map<number, T.Vector3>();
  const passages = new Map<number, { root: T.Group; landmark: T.Group; art: PaperScenery; wildlife?: PaperWildlife }>();
  let drawFrame: (time: number) => void = () => {};
  let renderNow: () => void = () => {};
  let drag: { id: number; x: number; position: number } | null = null;
  const canvas = renderer.domElement;
  const observer = new ResizeObserver(resize);
  const visibilityObserver = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? false;
    previousTime = 0;
    if (visible) invalidate(); else { cancelAnimationFrame(frame); frame = 0; }
  });
  const viewport = window.visualViewport;
  const gl = renderer.getContext();
  const maxBufferSide = Math.min(renderer.capabilities.maxTextureSize, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
  let densityQuery: MediaQueryList | undefined;

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame); observer.disconnect(); visibilityObserver.disconnect();
    window.removeEventListener('resize', resize);
    viewport?.removeEventListener('resize', resize);
    densityQuery?.removeEventListener('change', densityChanged);
    canvas.removeEventListener('wheel', wheel);
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
    canvas.removeEventListener('webglcontextlost', contextLost);
    reducedMotion.removeEventListener('change', motionChanged);
    document.removeEventListener('visibilitychange', visibilityChanged);
    images.forEach(img => { img.onload = null; img.onerror = null; });
    weather?.dispose();
    lighting?.dispose();
    water?.dispose();
    traveler?.dispose();
    passages.forEach(disposePassage); passages.clear();
    scene.traverse(o => { if (o instanceof T.Mesh) o.geometry.dispose(); });
    art.dispose(); exhibitMaterials.forEach(m => m.dispose());
    renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
  }

  function disposePassage(passage: { root: T.Group; art: PaperScenery }) {
    passage.root.removeFromParent();
    passage.root.traverse(o => { if (o instanceof T.Mesh) o.geometry.dispose(); });
    passage.art.dispose();
  }

  function addExhibits(day: number, landmark: T.Group) {
    if (HISTORY_PLACES[day].motif !== 7) return;
    const parent = landmark.userData.exhibitRoot as T.Group;
    exhibitMaterials.forEach((material, i) => {
      if (parent.getObjectByName(`cube-exhibit-${i}`)) return;
      const exhibit = new T.Mesh(new T.PlaneGeometry(2.3, 2.3), material);
      exhibit.name = `cube-exhibit-${i}`;
      exhibit.position.set(-4.7 + i * 4.6, .7 + i * .62 + 1.85, -1.14);
      parent.add(exhibit);
    });
  }

  function prepareExhibit(img: HTMLImageElement, index: number) {
    if (disposed || exhibitMaterials[index]) return;
    const texture = new T.Texture(img); texture.colorSpace = T.SRGBColorSpace; texture.needsUpdate = true; art.textures.add(texture);
    exhibitMaterials[index] = new T.MeshBasicMaterial({ map: texture });
    passages.forEach((passage, day) => addExhibits(day, passage.landmark)); invalidate();
  }

  function syncPassages() {
    const wanted = new Set(historyWindow(position));
    for (const [day, passage] of passages) if (!wanted.has(day)) { disposePassage(passage); passages.delete(day); secretAnchors.delete(day); }
    for (const day of wanted) if (!passages.has(day)) {
      const localArt = new PaperScenery(palette), root = new T.Group();
      // Register ownership before construction, so even a failed build is cleaned up.
      const passage: { root: T.Group; landmark: T.Group; art: PaperScenery; wildlife?: PaperWildlife } = { root, landmark: new T.Group(), art: localArt }; passages.set(day, passage); scene.add(root);
      buildHistoryLand(localArt, root, day, water!.material);
      passage.landmark = localArt.buildDay(day); root.add(passage.landmark);
      passage.wildlife = new PaperWildlife(localArt, day); root.add(passage.wildlife.root);
      const secret = HISTORY_SECRETS.find(item => item.day === day);
      if (secret) {
        const object = new T.Group(), x = day * HISTORY_SPACING + 7.6;
        buildHistorySecret(localArt, object, secret);
        localArt.flatten(object);
        object.scale.setScalar(1.2);
        object.rotation.z = Math.atan2(groundY(x + .1) - groundY(x - .1), .2);
        object.position.set(x, groundY(x) - .03, pathZ(x) + 2.2);
        root.add(object);
        object.updateMatrixWorld(true);
        secretAnchors.set(day, new T.Box3().setFromObject(object).getCenter(new T.Vector3()));
      }
      addExhibits(day, passage.landmark);
      renderer.shadowMap.needsUpdate = true;
    }
  }

  try {
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    canvas.setAttribute('aria-hidden', 'true');
    host.append(canvas);
    scene.background = new T.Color(palette.paper);
    scene.fog = new T.Fog(palette.paper, 62, 105);
    lighting = new PaperLighting(palette, style.getPropertyValue('--scroll-night').trim());
    scene.add(lighting.root, lighting.ambient, lighting.sun, lighting.sun.target);

    water = new PaperWater(palette);
    syncPassages();
    weather = new PaperWeather(art, host.clientWidth < 700); scene.add(weather.root);
    traveler = new PaperTraveler(art); scene.add(traveler.root);

    // Tutorial exhibits use the site's canonical cube renderer, with real first/two/three-layer states.
    const setups = ["U R U' R' U' F' U F", "R U R' U R U2 R'", ''];
    setups.forEach((alg, i) => {
      const svg = renderFromSimpleQuery({ alg, view: 'iso', size: 384, bg: palette.paper });
      const img = new Image(); images.push(img);
      img.onload = () => prepareExhibit(img, i);
      img.onerror = () => { if (!disposed) onFailure(); };
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });

    let shadowPosition = -1;
    function render() {
      if (disposed || (!capture && (document.hidden || !visible))) return;
      const x = position * HISTORY_SPACING;
      const elevation = groundY(x);
      syncPassages();
      camera.position.set(x + 7.8, 29 + elevation, 38);
      camera.lookAt(x, 3.5 + elevation, .3);
      camera.updateMatrixWorld();
      // Reserve room for the longest translated annotation while keeping its dot on the road.
      // One shared height avoids a camera jump when the current day's text changes.
      if (!labelHeight) labelHeight = capture?.labelHeight ?? Math.max(0, ...nodes.map(node => node?.offsetHeight ?? 0));
      const road = new T.Vector3(x, pathY(x), pathZ(x)).project(camera);
      const overflow = (-road.y * .5 + .5) * height + labelHeight - 14 - (height - 46);
      if (overflow > 0) {
        camera.translateY(-overflow * (camera.top - camera.bottom) / height);
        camera.updateMatrixWorld();
      }
      if (shadowPosition !== position) { renderer.shadowMap.needsUpdate = true; shadowPosition = position; }
      passages.forEach(passage => { passage.art.update(animationTime, position); passage.wildlife?.update(animationTime); });
      art.update(animationTime, position);
      traveler!.update(animationTime, position, width < 700, gait);
      const currentWeather = weather!.update(animationTime, position, variation, !!capture || !reducedMotion.matches, canvas.width / width, width < 700);
      weather!.fitView(camera);
      host.dataset.weather = currentWeather;
      host.dataset.lightning = weather!.lightningStrength.toFixed(3);
      const light = lighting!.update(position, animationTime, currentWeather, camera, width < 700, canvas.width / width);
      water!.update(animationTime, currentWeather, light.night, lighting!.horizonColor, lighting!.sun.color);
      scene.fog!.color.copy(lighting!.horizonColor);
      host.parentElement?.style.setProperty('--scroll-sky-ink', light.night > .5 ? palette.paper : palette.ink);
      host.parentElement?.style.setProperty('--scroll-caption-wash', light.night > .5 ? 'var(--scroll-night)' : palette.paper);
      host.parentElement?.style.setProperty('--scroll-label-ink', lighting!.skyInk(1 - light.night));
      passages.forEach(passage => {
        const gold = passage.art.materials.get(palette.gold);
        if (gold) { gold.emissive.copy(goldGlow); gold.emissiveIntensity = light.night * .28; }
      });
      renderer.render(scene, camera);
      nodes.forEach((node, i) => {
        if (!node) return;
        if (Math.abs(i - position) > 2) { node.style.visibility = 'hidden'; node.tabIndex = -1; return; }
        const point = new T.Vector3(i * HISTORY_SPACING, pathY(i * HISTORY_SPACING), pathZ(i * HISTORY_SPACING)).project(camera);
        const px = (point.x * .5 + .5) * width, py = (-point.y * .5 + .5) * height;
        const half = node.offsetWidth / 2;
        const visible = px > half + 8 && px < width - half - 8 && py > 145 && py + node.offsetHeight - 14 < height - 42;
        node.style.transform = `translate(${px.toFixed(2)}px,${py.toFixed(2)}px) translate(-50%,-14px)`;
        node.style.visibility = visible ? 'visible' : 'hidden'; node.tabIndex = visible ? 0 : -1;
      });
      secretNodes.forEach((node, i) => {
        if (!node) return;
        const anchor = secretAnchors.get(HISTORY_SECRETS[i].day);
        if (!anchor) { node.style.visibility = 'hidden'; node.tabIndex = -1; return; }
        const point = anchor.clone().project(camera);
        const px = (point.x * .5 + .5) * width, py = (-point.y * .5 + .5) * height;
        const visible = px > 36 && px < width - 36 && py > 180 && py < height - 70;
        node.style.transform = `translate(${px.toFixed(2)}px,${py.toFixed(2)}px) translate(-50%,-50%)`;
        node.style.visibility = visible ? 'visible' : 'hidden'; node.tabIndex = visible ? 0 : -1;
      });
      host.dataset.position = position.toFixed(3);
      host.dataset.landform = HISTORY_LANDFORMS[Math.round(clampHistoryPosition(position))];
      host.dataset.animals = passages.get(Math.round(clampHistoryPosition(position)))?.wildlife?.species ?? '';
      host.dataset.drawCalls = String(renderer.info.render.calls);
      host.dataset.triangles = String(renderer.info.render.triangles);
      host.dataset.geometries = String(renderer.info.memory.geometries);
      host.dataset.textures = String(renderer.info.memory.textures);
      host.dataset.passages = String(passages.size);
      host.dataset.animationTime = animationTime.toFixed(3);
      host.dataset.elevation = elevation.toFixed(3);
      host.dataset.travelerX = traveler!.root.position.x.toFixed(3);
      host.dataset.gait = gait;
      host.dataset.solarHour = light.hour.toFixed(3);
      host.dataset.daylight = light.daylight.toFixed(3);
      host.dataset.timeOfDay = light.phase;
    }

    function tick(time: number) {
      frame = 0;
      if (disposed || document.hidden || !visible) return;
      const travelling = Math.abs(target - position) > .0005;
      // Atmospheric motion is capped at 30 fps; travel retains the display's frame rate.
      if (!travelling && time - lastRender < 32) { invalidate(); return; }
      const elapsed = previousTime ? Math.min(80, time - previousTime) : 16;
      previousTime = time;
      lastRender = time;
      // Stopping to look around pauses the traveller, while wildlife and water keep their natural clock.
      if (!reducedMotion.matches) animationTime += elapsed / 1000;
      if (motion && !travelling && !drag) {
        // Only automatic travel uses the multiplier; atmosphere keeps its natural clock.
        // The last date is a stop, never a turnaround or loop.
        target = clampHistoryPosition(position + HISTORY_GAITS[gait].speed * speed * elapsed / 1000 / HISTORY_SPACING);
        position = target;
      } else {
        position += (target - position) * (reducedMotion.matches ? 1 : 1 - Math.exp(-elapsed / 110));
      }
      const moving = Math.abs(target - position) > .0005;
      if (!moving) position = target;
      render();
      if (reportedPosition !== position) { reportedPosition = position; onProgress(position); }
      if (!moving && settled !== position) { settled = position; onSettle(position); }
      if (moving || motion || !reducedMotion.matches) invalidate(); else previousTime = 0;
    }
    drawFrame = tick;
    renderNow = render;
    observer.observe(host);
    visibilityObserver.observe(host);
    window.addEventListener('resize', resize);
    viewport?.addEventListener('resize', resize);
    watchDensity();
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('webglcontextlost', contextLost);
    reducedMotion.addEventListener('change', motionChanged);
    document.addEventListener('visibilitychange', visibilityChanged);
    resize();
    return { seek, dispose,
      ready: async () => {
        await Promise.all(images.map(image => image.decode()));
        // SVG decode can resolve before its load event attaches the exhibit meshes.
        images.forEach(prepareExhibit);
      },
      captureFrame(value, seconds) {
        if (!capture || disposed) throw new Error('History capture is unavailable');
        position = target = clampHistoryPosition(value);
        animationTime = seconds;
        render();
        return {
          canvas,
          points: historyWindow(position).map(index => {
            const point = new T.Vector3(index * HISTORY_SPACING, pathY(index * HISTORY_SPACING), pathZ(index * HISTORY_SPACING)).project(camera);
            return { index, x: (point.x * .5 + .5) * width, y: (-point.y * .5 + .5) * height };
          }),
          ink: host.parentElement!.style.getPropertyValue('--scroll-label-ink'),
        };
      },
      setWeather(value) { variation = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0; invalidate(); },
      setMotion(enabled) { motion = enabled; if (!enabled) target = position; previousTime = 0; invalidate(); },
      setSpeed(value) { speed = [1, 2, 5, 10].includes(value) ? value : 1; invalidate(); },
      setGait(value) { gait = value === 'run' ? 'run' : 'walk'; invalidate(); },
    };
  } catch (error) { dispose(); throw error; }

  // Input listeners and scheduler stay outside the construction block for deterministic teardown.
  function seek(value: number, immediate = false) {
    target = clampHistoryPosition(value);
    if (immediate || reducedMotion.matches || Math.abs(target - position) > 3) position = target;
    invalidate();
  }
  function invalidate() { if (!capture && !disposed && !frame && !document.hidden && visible) frame = requestAnimationFrame(time => drawFrame(time)); }
  function resize() {
    if (disposed) return;
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    labelHeight = 0;
    // Keep a complete local scene in portrait while showing adjacent dates in landscape.
    const viewHeight = Math.max(38, 30 * height / width);
    camera.left = -viewHeight * width / height / 2; camera.right = -camera.left;
    camera.top = viewHeight / 2; camera.bottom = -camera.top; camera.updateProjectionMatrix();
    // Page zoom changes DPR; touchpad/pinch zoom changes the visual viewport instead.
    // Re-render at the displayed density, with a total-pixel budget for extreme zoom.
    const density = capture ? 1 : (window.devicePixelRatio || 1) * (viewport?.scale ?? 1);
    const scale = Math.min(density, Math.sqrt(16_777_216 / (width * height)), maxBufferSide / width, maxBufferSide / height);
    const bufferWidth = Math.max(1, Math.floor(width * scale)), bufferHeight = Math.max(1, Math.floor(height * scale));
    if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) renderer.setSize(bufferWidth, bufferHeight, false);
    renderNow(); invalidate();
  }
  function watchDensity() {
    densityQuery?.removeEventListener('change', densityChanged);
    densityQuery = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    densityQuery.addEventListener('change', densityChanged);
  }
  function densityChanged() { watchDensity(); resize(); }
  function wheel(event: WheelEvent) {
    if (event.ctrlKey) return;
    const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
    const next = clampHistoryPosition(target + delta / 950);
    if (next === target) return;
    event.preventDefault(); seek(next);
  }
  function down(event: PointerEvent) {
    if (event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, position: target };
    canvas.setPointerCapture(event.pointerId); canvas.classList.add('is-dragging');
  }
  function move(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return;
    seek(drag.position + (drag.x - event.clientX) / width * (camera.right - camera.left) / HISTORY_SPACING);
  }
  function up(event: PointerEvent) {
    if (drag?.id !== event.pointerId) return;
    drag = null; canvas.classList.remove('is-dragging');
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  function motionChanged() { motion = !reducedMotion.matches; if (reducedMotion.matches) seek(target, true); else invalidate(); }
  function visibilityChanged() { previousTime = 0; if (!document.hidden) invalidate(); else { cancelAnimationFrame(frame); frame = 0; } }
  function contextLost(event: Event) { event.preventDefault(); if (!disposed) onFailure(); }
}
