import { AmbientLight, DirectionalLight, Group, PerspectiveCamera, Scene, WebGLRenderer, type Object3D } from 'three';
import { SIZE } from '../engine/define';
import { HOME_SCENE_ROT, ORBIT_K } from '../engine/viewControls';

interface ReplaySceneOptions {
  interactive?: boolean;
  framingSize?: number;
  sceneRotation?: { x: number; y: number; z: number };
  wrapLights?: boolean;
}

const PERSPECTIVE = 5;
const MAX_PITCH = Math.PI / 2;

/** Mount a caller-owned puzzle model with on-demand rendering and orbit controls. */
export function mountReplayScene(host: HTMLElement, object: Object3D, {
  interactive = true,
  framingSize = SIZE * 3,
  sceneRotation = HOME_SCENE_ROT,
  wrapLights = false,
}: ReplaySceneOptions = {}): { invalidate(): void; dispose(): void } {
  const ownerWindow = host.ownerDocument.defaultView;
  if (!ownerWindow) throw new Error('The player needs a browser document');
  const view = ownerWindow;
  const canvas = host.ownerDocument.createElement('canvas');
  const cleanups: Array<() => void> = [];
  let disposed = false;
  let frame: number | undefined;

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    if (frame !== undefined) view.cancelAnimationFrame(frame);
    for (const cleanup of cleanups.reverse()) {
      try { cleanup(); } catch { /* Continue releasing the remaining resources. */ }
    }
  }

  try {
    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    cleanups.push(() => renderer.forceContextLoss(), () => renderer.dispose());
    const scene = new Scene();
    const model = new Group();
    model.rotation.set(sceneRotation.x, sceneRotation.y, sceneRotation.z);
    model.add(object);
    cleanups.push(() => model.remove(object));

    const light = new DirectionalLight(0xffffff, Math.PI * 0.4);
    light.position.set(SIZE, SIZE * 3, SIZE * 2);
    scene.add(model, new AmbientLight(0xffffff, Math.PI * 0.75), light);
    if (wrapLights) {
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
        const fill = new DirectionalLight(0xffffff, Math.PI * 0.15);
        fill.position.set(x * SIZE * 3, y * SIZE * 3, z * SIZE * 3);
        scene.add(fill);
      }
    }
    const distance = framingSize * PERSPECTIVE;
    const camera = new PerspectiveCamera(50, 1, distance - framingSize * 1.5, distance + framingSize * 3);
    camera.position.z = distance;

    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    cleanups.push(() => canvas.remove());

    function invalidate(): void {
      if (disposed || frame !== undefined) return;
      frame = view.requestAnimationFrame(() => {
        frame = undefined;
        if (!disposed) renderer.render(scene, camera);
      });
    }

    function resize(width: number, height: number): void {
      if (width <= 0 || height <= 0) return;
      renderer.setPixelRatio(Math.min(view.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = 2 * Math.atan(height / Math.min(width, height) / PERSPECTIVE) * 180 / Math.PI;
      camera.updateProjectionMatrix();
      invalidate();
    }

    const resizeObserver = new view.ResizeObserver(([entry]) => {
      if (entry) resize(entry.contentRect.width, entry.contentRect.height);
    });
    cleanups.push(() => resizeObserver.disconnect());
    resizeObserver.observe(host);

    const events = new view.AbortController();
    cleanups.push(() => events.abort());
    const listeners = { signal: events.signal };
    canvas.addEventListener('webglcontextrestored', invalidate, listeners);
    if (interactive) {
      canvas.style.touchAction = 'pinch-zoom';
      canvas.style.cursor = 'grab';
      let drag: { id: number; x: number; y: number } | undefined;
      canvas.addEventListener('pointerdown', event => {
        if (!event.isPrimary || event.button !== 0) return;
        canvas.setPointerCapture(event.pointerId);
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
        canvas.style.cursor = 'grabbing';
      }, listeners);
      canvas.addEventListener('pointermove', event => {
        if (drag?.id !== event.pointerId) return;
        model.rotation.y += (event.clientX - drag.x) * ORBIT_K;
        const pitch = model.rotation.x + (event.clientY - drag.y) * ORBIT_K;
        model.rotation.x = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
        drag.x = event.clientX;
        drag.y = event.clientY;
        invalidate();
      }, listeners);
      canvas.addEventListener('lostpointercapture', () => {
        drag = undefined;
        canvas.style.cursor = 'grab';
      }, listeners);
    }
    return { invalidate, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
