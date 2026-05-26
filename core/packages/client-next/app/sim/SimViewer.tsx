'use client';

/**
 * SimViewer — minimal cuber-engine bootstrap for /sim.
 * Renders a 3x3 cube via World + THREE.WebGLRenderer with mouse-orbit + keyboard moves.
 * See ./page.tsx header for deferred features (PlayerControls, AlgsPanel, etc.).
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { HelpCircle, Maximize2, Minimize2 } from 'lucide-react';
import * as THREE from 'three';
import World from './cuber/world';
import Cubelet from './cuber/cubelet';
import Toucher from './Toucher';
import { TwistAction } from './cuber/twister';
import LangToggle from '@/components/LangToggle';
import ThemeToggle from '@/components/ThemeToggle';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './sim.css';

interface SimCube {
  twister: { twist: (a: TwistAction, fast: boolean, force: boolean) => boolean; setup: (e: string) => void };
}

// Default keymap mirroring the most common bindings in the original keymap.ts.
// Lowercase = clockwise, uppercase = counterclockwise.
const DEFAULT_KEYMAP: Record<string, { sign: string; rev: boolean }> = {
  j: { sign: 'U', rev: false },  J: { sign: 'U', rev: true },
  f: { sign: 'U', rev: true },   F: { sign: 'U', rev: false },
  i: { sign: 'R', rev: false },  I: { sign: 'R', rev: true },
  k: { sign: 'R', rev: true },   K: { sign: 'R', rev: false },
  h: { sign: 'F', rev: false },  H: { sign: 'F', rev: true },
  g: { sign: 'F', rev: true },   G: { sign: 'F', rev: false },
  d: { sign: 'L', rev: false },  D: { sign: 'L', rev: true },
  e: { sign: 'L', rev: true },   E: { sign: 'L', rev: false },
  s: { sign: 'D', rev: false },  S: { sign: 'D', rev: true },
  l: { sign: 'D', rev: true },   L: { sign: 'D', rev: false },
  w: { sign: 'B', rev: false },  W: { sign: 'B', rev: true },
  o: { sign: 'B', rev: true },   O: { sign: 'B', rev: false },
  ';': { sign: 'y', rev: false }, ':': { sign: 'y', rev: true },
  a: { sign: 'y', rev: true },
  y: { sign: 'x', rev: false }, Y: { sign: 'x', rev: true },
  t: { sign: 'x', rev: false }, T: { sign: 'x', rev: true },
  p: { sign: 'z', rev: false }, P: { sign: 'z', rev: true },
  q: { sign: 'z', rev: true },  Q: { sign: 'z', rev: false },
};

export default function SimViewer() {
  useDocumentTitle('模拟器', 'Sim');

  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const toucherRef = useRef<Toucher | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (worldRef.current) return;

    const world = new World();
    worldRef.current = world;
    const renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, preserveDrawingBuffer: true,
    });
    renderer.autoClear = false;
    renderer.setClearColor(0xffffff, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.outline = 'none';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.display = 'block';

    const toucher = new Toucher();
    toucher.init(renderer.domElement, world.controller.touch);
    toucherRef.current = toucher;

    // Orbit dragging: just rotate the scene; no snap-to-axis (PlayerControls path skipped).
    const ORBIT_K = 0.005;
    world.controller.onOrbit = (dx, dy) => {
      world.scene.rotation.y += dx * ORBIT_K;
      world.scene.rotation.x += dy * ORBIT_K;
      world.scene.updateMatrix();
      world.dirty = true;
    };

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      world.width = w;
      world.height = h;
      world.resize();
      renderer.setSize(w, h, true);
      world.dirty = true;
    };
    resize();
    window.addEventListener('resize', resize);
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Wheel zoom — straight copy of the original (no slider feedback).
    const SCALE_MIN = 0.3;
    const SCALE_MAX = 8;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const w = worldRef.current;
      if (!w) return;
      const oldScale = w.scale;
      const newScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, oldScale * (e.deltaY > 0 ? 0.92 : 1.08)));
      if (newScale === oldScale) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const minDim = Math.min(w.width, w.height);
      const halfH = (Cubelet.SIZE * 3 * w.height) / (minDim * oldScale);
      const halfW = halfH * (w.width / w.height);
      const t = 1 - oldScale / newScale;
      w.panX += nx * halfW * t;
      w.panY += ny * halfH * t;
      w.scale = newScale;
      w.resize();
    };
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // Keyboard moves.
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const m = DEFAULT_KEYMAP[e.key];
      if (!m) return;
      const cube = world.cube as unknown as SimCube;
      cube.twister.twist(new TwistAction(m.sign, m.rev, 1), false, false);
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (world.dirty) {
        renderer.clear();
        renderer.render(world.scene, world.camera);
        world.dirty = false;
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
      renderer.domElement.removeEventListener('wheel', onWheel);
      ro.disconnect();
      toucher.destroy();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      worldRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  return (
    <div className={`sim-root${fullscreen ? ' sim-fullscreen' : ''}`}>
      <header className="sim-header">
        <Link href="/" className="sim-home" aria-label="Home">
          <HelpCircle size={18} />
        </Link>
        <h1 className="sim-title">Sim</h1>
        <div className="sim-spacer" />
        <LangToggle variant="inline" />
        <ThemeToggle />
      </header>
      <div className="sim-body">
        <div className="sim-canvas-wrap" ref={containerRef}>
          <button
            className="sim-fullscreen-exit"
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
        <aside className="sim-side" style={{ padding: 16, fontSize: 13, color: '#888' }}>
          <p style={{ marginTop: 0 }}>
            <strong>Sim viewer (Next.js port shell)</strong>
          </p>
          <p>
            Alg controls / scramble generators / algorithm library / video recorder are
            not ported yet. Use the <Link href="/" style={{ color: 'inherit', textDecoration: 'underline' }}>Vite site</Link> meanwhile.
          </p>
          <p>Try: drag to orbit, scroll to zoom, j/f/i/k/d/e/s/l/h/g/w/o to twist.</p>
        </aside>
      </div>
    </div>
  );
}
