/**
 * 3D rotating cube preview powered by three.js. Drop-in alternative to
 * `CubeNet` for NxN events.
 *
 * Lifecycle:
 *  - Init the renderer/scene once on mount.
 *  - On `event` change: tear down + rebuild (different N means different
 *    cubie count and geometry layout).
 *  - On `scramble` / `colors` change: re-color cubies in place; do NOT
 *    rebuild the scene.
 *  - On window resize: refit camera/renderer to the host size.
 *
 * Events that aren't NxN (pyra/skewb/sq1/mega/clock/etc.) render a
 * placeholder of the same `size` so callers' layout doesn't jump.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { JSX } from 'react';

import type { EventId } from '../types.ts';
import type { Face } from '../cube/moves.ts';
import { applyScramble } from '../cube/state.ts';
import { WCA_COLORS, nxnSizeForEvent } from '../cube/colors.ts';

import { createScene } from './scene.ts';
import type { SceneHandles } from './scene.ts';

export interface Cube3DProps {
  event: EventId;
  scramble: string;
  /** CSS pixel size of the (square) canvas. Default 240. */
  size?: number;
  /** Auto-rotate the cube when no user interaction is happening. Default true. */
  autoRotate?: boolean;
  /** Optional sticker-colour overrides. Falls back to WCA_COLORS for unset faces. */
  colors?: Partial<Record<Face, string>>;
  className?: string;
}

const DEFAULT_SIZE = 240;
/** How long the user has to be idle before auto-rotation resumes. */
const IDLE_RESUME_MS = 2500;
/** Auto-rotate angular speed in radians per second. */
const AUTO_ROTATE_RAD_PER_S = 0.35;

export default function Cube3D(props: Cube3DProps): JSX.Element {
  const {
    event,
    scramble,
    size = DEFAULT_SIZE,
    autoRotate = true,
    colors,
    className,
  } = props;

  const n = nxnSizeForEvent(event);

  // Effective palette (memoized so applyState's identity check is cheap).
  const palette = useMemo<Record<Face, string>>(() => ({
    ...WCA_COLORS,
    ...(colors ?? {}),
  }), [colors]);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const handlesRef = useRef<SceneHandles | null>(null);

  // Track autoRotate in a ref so the rAF loop sees the latest value
  // without us needing to tear down + rebuild the scene on toggle.
  const autoRotateRef = useRef(autoRotate);
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  // -------- Scene init / teardown (depends on event size N) --------
  useEffect(() => {
    if (n == null) return;
    const host = hostRef.current;
    if (!host) return;

    const handles = createScene(n, size, palette);
    host.appendChild(handles.renderer.domElement);
    handles.renderer.domElement.style.display = 'block';
    handles.renderer.domElement.style.width = `${size}px`;
    handles.renderer.domElement.style.height = `${size}px`;
    handles.renderer.domElement.style.touchAction = 'none';
    handlesRef.current = handles;

    // Initial colour application + first render.
    handles.applyState(applyScramble(n, scramble), palette);

    // Animation loop (auto-rotate + damped controls). We always need a
    // tick when controls have damping enabled or when auto-rotate is on,
    // and an extra tick after pointer events to settle the damping. To
    // keep it simple we run a continuous rAF loop but cheap (one render
    // per frame, ~60 fps).
    let rafId = 0;
    let lastT = performance.now();
    let lastInteraction = 0;

    const onStart = (): void => {
      lastInteraction = performance.now();
    };
    const onChange = (): void => {
      lastInteraction = performance.now();
    };
    handles.controls.addEventListener('start', onStart);
    handles.controls.addEventListener('change', onChange);

    const tick = (): void => {
      const now = performance.now();
      const dt = (now - lastT) / 1000;
      lastT = now;

      const idleMs = now - lastInteraction;
      if (autoRotateRef.current && idleMs > IDLE_RESUME_MS) {
        handles.cubeRoot.rotation.y += AUTO_ROTATE_RAD_PER_S * dt;
      }

      handles.controls.update();
      handles.renderer.render(handles.scene, handles.camera);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // Window resize: only refit if our host's size actually changed
    // relative to the prop. We don't watch ResizeObserver here — the prop
    // controls the size; this is just to keep DPI changes (zoom) sharp.
    const onWinResize = (): void => {
      handles.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      handles.resize(size);
    };
    window.addEventListener('resize', onWinResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onWinResize);
      handles.controls.removeEventListener('start', onStart);
      handles.controls.removeEventListener('change', onChange);
      const dom = handles.renderer.domElement;
      handles.dispose();
      if (dom.parentNode) dom.parentNode.removeChild(dom);
      handlesRef.current = null;
    };
    // We intentionally rebuild only when n changes (different cube size).
    // size/palette changes are handled by separate effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  // -------- Re-color on scramble / colors / event-within-same-N change --------
  useEffect(() => {
    if (n == null) return;
    const handles = handlesRef.current;
    if (!handles) return;
    handles.applyState(applyScramble(n, scramble), palette);
  }, [n, scramble, palette]);

  // -------- Resize on size prop change --------
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;
    handles.resize(size);
    const dom = handles.renderer.domElement;
    dom.style.width = `${size}px`;
    dom.style.height = `${size}px`;
  }, [size]);

  // Render
  if (n == null) {
    // Non-NxN event: placeholder block, same footprint.
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: '#888',
          border: '1px dashed #444',
          borderRadius: 4,
          boxSizing: 'border-box',
          textAlign: 'center',
          padding: 8,
        }}
      >
        3D preview not available
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        width: size,
        height: size,
        display: 'block',
        boxSizing: 'border-box',
      }}
    />
  );
}
