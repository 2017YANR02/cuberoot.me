'use client';

// Decorative 3D cube on the landing Trainer hero card.
// Rendered by the site's own /sim engine (three.js) — same geometry, colours and
// tween feel as the simulator, so the front door matches what it links to.
// three + the engine are dynamic-imported inside the effect so they stay out of
// the initial landing bundle; a lucide Box stands in if the import fails.

import { useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';
import type Cube from '@/app/[lang]/sim/engine/nxn/cube';

// Plays once on mount and stops. (The previous cubing.js version looped by
// rewinding its timeline, which snapped the cube back to solved every 4 moves.)
const INTRO_ALG = "S' U' M' y2";
// Frames per quarter turn @60Hz (engine default 30) — slower reads as ambient.
const INTRO_FRAMES = 42;
// Camera pull-back. /sim uses 5; tighter here so the cube fills the card slot.
const PERSPECTIVE = 4.4;
// Drag-orbit radians per pixel, same constant the recon player uses.
const ORBIT_K = 0.01;
const QUARTER = Math.PI / 2;

export default function LandingCubeHero() {
  const slotRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const mods = await Promise.all([
        import('three'),
        import('@/app/[lang]/sim/engine/world'),
        import('@/app/[lang]/sim/engine/tweenTiming'),
      ]).catch(() => null);
      if (cancelled) return;
      if (!mods) { setFailed(true); return; }
      const [THREE, { default: World }, { timing }] = mods;
      const slot = slotRef.current;
      if (!slot) return;

      // World's ctor already builds a 3x3 at the /sim iso angle. No Controller is
      // attached: this cube is never twisted by hand, and skipping it avoids the
      // controller's own rAF loop.
      const world = new World();
      world.perspective = PERSPECTIVE;
      const cube = world.cube as Cube;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.autoClear = false;
      renderer.setClearColor(0xffffff, 0);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.domElement.style.outline = 'none';
      renderer.domElement.style.display = 'block';
      // pan-y: vertical page scroll stays with the browser on touch; horizontal
      // drags orbit the cube.
      renderer.domElement.style.touchAction = 'pan-y';
      slot.appendChild(renderer.domElement);

      // Render on demand: the intro plays once, so park the rAF when the twister
      // has drained and nothing has been redrawn for a while, and wake it again on
      // pointer input or resize.
      let raf = 0;
      let idle = 0;
      const loop = () => {
        if (world.dirty) {
          renderer.clear();
          renderer.render(world.scene, world.camera);
          world.dirty = false;
          idle = 0;
        } else if (++idle > 20 && cube.twister.length === 0) {
          raf = 0;
          return;
        }
        raf = requestAnimationFrame(loop);
      };
      const wake = () => { idle = 0; if (!raf) raf = requestAnimationFrame(loop); };

      const resize = () => {
        const w = slot.clientWidth;
        const h = slot.clientHeight;
        if (w <= 0 || h <= 0) return;
        world.width = w;
        world.height = h;
        world.resize();
        renderer.setSize(w, h, true);
        world.dirty = true;
        wake();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(slot);

      // Drag to look around. Orientation lives on scene.rotation and the scene is
      // matrixAutoUpdate:false, so every write needs an explicit updateMatrix().
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      const onDown = (e: PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        try { renderer.domElement.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        world.scene.rotation.y += dx * ORBIT_K;
        world.scene.rotation.x = Math.max(-QUARTER, Math.min(QUARTER, world.scene.rotation.x + dy * ORBIT_K));
        world.scene.updateMatrix();
        world.dirty = true;
        wake();
      };
      const onUp = (e: PointerEvent) => {
        dragging = false;
        try { renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      };
      renderer.domElement.addEventListener('pointerdown', onDown);
      renderer.domElement.addEventListener('pointermove', onMove);
      renderer.domElement.addEventListener('pointerup', onUp);
      renderer.domElement.addEventListener('pointercancel', onUp);

      // Intro animation, played once. twister.update() is registered in
      // cube.callbacks and drains one queued move per tween, so pushing the whole
      // alg up front plays it gaplessly and then leaves the cube at rest.
      const prevFrames = timing.frames;
      timing.frames = INTRO_FRAMES;
      cube.twister.push(INTRO_ALG);
      wake();

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        timing.frames = prevFrames;
        renderer.domElement.removeEventListener('pointerdown', onDown);
        renderer.domElement.removeEventListener('pointermove', onMove);
        renderer.domElement.removeEventListener('pointerup', onUp);
        renderer.domElement.removeEventListener('pointercancel', onUp);
        // The tweener is a module singleton: drop the queue and flush live tweens,
        // or they keep poking a disposed cube after unmount.
        cube.twister.setup('');
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        cube.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      };
      if (cancelled) cleanup();
    })();

    return () => { cancelled = true; cleanup?.(); };
  }, []);

  // The whole card is a <Link>: swallow the click that ends a drag so orbiting
  // the cube doesn't navigate to /alg.
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    let startX = 0, startY = 0, dragged = false;
    const onMove = (m: PointerEvent) => {
      if ((m.clientX - startX) ** 2 + (m.clientY - startY) ** 2 > 16) dragged = true;
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onUp, true);
    };
    const onDown = (e: PointerEvent) => {
      startX = e.clientX; startY = e.clientY; dragged = false;
      document.addEventListener('pointermove', onMove, true);
      document.addEventListener('pointerup', onUp, true);
      document.addEventListener('pointercancel', onUp, true);
    };
    const onClick = (e: MouseEvent) => {
      if (dragged) {
        e.preventDefault();
        e.stopImmediatePropagation();
        dragged = false;
      }
    };
    slot.addEventListener('pointerdown', onDown, true);
    slot.addEventListener('click', onClick, true);
    return () => {
      slot.removeEventListener('pointerdown', onDown, true);
      slot.removeEventListener('click', onClick, true);
      onUp();
    };
  }, []);

  return (
    <div ref={slotRef} className="cube-hero-slot">
      {failed ? <div className="cube-hero-fallback"><Box size={48} strokeWidth={1.5} /></div> : null}
    </div>
  );
}
