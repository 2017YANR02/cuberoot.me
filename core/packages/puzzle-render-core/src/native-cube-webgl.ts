import { AmbientLight, DirectionalLight, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { SIZE } from './engine/define';
import tweener from './engine/tweener';
import { createNativeCubeScene } from './native-cube-scene';
import type { NativeCubeCanvas, NativeCubeWebgl, NativeCubeWebglOptions } from './native-cube-webgl-contract';

/** Draws the same NxN scene on a native, WebGL2-capable canvas. */
export function createNativeCubeWebgl(
  canvas: NativeCubeCanvas,
  width: number,
  height: number,
  pixelRatio = 1,
  onUnavailable?: (error: unknown) => void,
  options?: NativeCubeWebglOptions,
): NativeCubeWebgl | null {
  let renderer: WebGLRenderer | undefined;
  let engine: ReturnType<typeof createNativeCubeScene> | undefined;
  let restoreTweenClock: (() => void) | undefined;
  let pending: ReturnType<typeof setTimeout> | number | undefined;
  let disposed = false;
  const useCanvasFrame = typeof canvas.requestAnimationFrame === 'function' && typeof canvas.cancelAnimationFrame === 'function';
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (pending !== undefined) {
      if (useCanvasFrame) canvas.cancelAnimationFrame!(pending as number);
      else clearTimeout(pending);
    }
    restoreTweenClock?.();
    engine?.dispose();
    // Three tears down its unused browser clock after releasing GPU resources.
    try { renderer?.dispose(); } catch (error) {
      if (typeof self !== 'undefined' && typeof self?.cancelAnimationFrame === 'function') throw error;
    }
  }
  try {
    const context = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    if (typeof context?.createVertexArray !== 'function') return null;
    // The injected context already renders into the native canvas. The browser
    // host facade supplies dimensions and event hooks without global DOM shims.
    const rendererCanvas = {
      get width() { return canvas.width; },
      set width(value: number) { canvas.width = value; },
      get height() { return canvas.height; },
      set height(value: number) { canvas.height = value; },
      addEventListener() {},
      removeEventListener() {},
    } as unknown as HTMLCanvasElement;
    renderer = new WebGLRenderer({ canvas: rendererCanvas, context, alpha: true, antialias: true });
    renderer.setClearColor(0, 0);
    const cube = engine = createNativeCubeScene(options?.solverBackdrop);
    const wasPaused = tweener.paused;
    tweener.paused = true;
    restoreTweenClock = () => { tweener.paused = wasPaused; };
    const world = new Scene();
    const light = new DirectionalLight(0xffffff, Math.PI * 0.4);
    light.position.set(SIZE, SIZE * 3, SIZE * 2);
    world.add(cube.root, new AmbientLight(0xffffff, Math.PI * 0.75), light);
    const camera = new PerspectiveCamera(50, 1, 1, SIZE * 32);
    camera.position.z = SIZE * 15;
    const draw = () => {
      pending = undefined;
      if (disposed) return;
      try {
        if (context.isContextLost()) throw new Error('Native cube canvas context lost');
        const active = cube.tick(Date.now());
        renderer!.render(world, camera);
        if (active) invalidate();
      } catch (error) {
        dispose();
        onUnavailable?.(error);
      }
    };
    function invalidate() {
      if (disposed || pending !== undefined) return;
      pending = useCanvasFrame ? canvas.requestAnimationFrame!(draw) : setTimeout(draw, 16);
    }
    function resize(nextWidth: number, nextHeight: number, rate = pixelRatio) {
      if (disposed) return;
      const w = Math.max(1, nextWidth), h = Math.max(1, nextHeight);
      renderer!.setPixelRatio(Math.max(1, rate));
      renderer!.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = 2 * Math.atan(h / Math.min(w, h) / 5) * 180 / Math.PI;
      camera.updateProjectionMatrix();
      invalidate();
    }
    resize(width, height);
    function update(apply: () => void) {
      if (disposed) return;
      apply();
      invalidate();
    }
    return {
      reset(facelets) { update(() => cube.reset(facelets)); },
      move(token, facelets, timestamp) { update(() => cube.move(token, facelets, timestamp, Date.now())); },
      gyro(pose) { update(() => cube.gyro(pose)); },
      pose(pose) { update(() => cube.pose(pose)); },
      resetOrientation(pose) { update(() => cube.resetOrientation(pose)); },
      orbit(dx, dy) { update(() => cube.orbit(dx, dy)); },
      replaySetup(algorithm) { update(() => cube.replaySetup(algorithm)); },
      replayMove(token, durationTicks) { update(() => cube.replayMove(token, durationTicks)); },
      resize, dispose,
    };
  } catch (error) {
    dispose();
    onUnavailable?.(error);
    return null;
  }
}
