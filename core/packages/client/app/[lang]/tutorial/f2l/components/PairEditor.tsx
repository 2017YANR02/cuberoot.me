'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Vector3 } from 'three';
import { MousePointer2 } from 'lucide-react';
import type Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import SimStage from '@/components/sim-embed/SimStage';
import type { SimMount } from '@/components/sim-embed/mountSimWorld';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { tr, T } from '@/i18n/tr';

/** Editor only: reuse the same mount, controller taps and orbit gestures as /predict. */
export default function PairEditor({ setup, orientation, onPiece, guide, onReady }: {
  setup: string; orientation: string; onPiece: (position: number) => void;
  guide?: { position: number; clicking: boolean };
  onReady?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<SimMount | null>(null);
  const resetView = useRef<(() => void) | null>(null);
  const latest = useRef({ setup, orientation, onPiece, guide, onReady });
  latest.current = { setup, orientation, onPiece, guide, onReady };
  const pointer = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(320);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize(Math.max(1, Math.min(440, entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const mount = useCallback(async (element: HTMLElement) => {
    let current: SimMount | null = null;
    let detach: (() => void) | undefined;
    try {
      const [{ mountSimWorld }, { attachEmbeddedSimInteraction }, { resetSceneView }] = await Promise.all([
        import('@/components/sim-embed/mountSimWorld'),
        import('@/components/sim-embed/attachEmbeddedSimInteraction'),
        import('@/app/[lang]/sim/engine/viewControls'),
      ]);
      if (!element.isConnected) return;
      const instance = mountSimWorld({ host: element, puzzle: 3, interactive: true });
      current = instance;
      engine.current = instance;
      const cube = instance.world.cube as Cube;
      cube.instancedRenderer.setStickering(stickeringMaskFn(3, 'F2LPair')!);
      cube.instancedRenderer.setFaceColorOverride(orientedCubeFaceColors(latest.current.orientation));
      cube.twister.setup(latest.current.setup);
      detach = attachEmbeddedSimInteraction({ world: instance.world, dom: instance.renderer.domElement, mode: 'view' });
      const tap: typeof instance.world.controller.taps[number] = (position, face, options) => {
        if (!latest.current.guide && face !== null && options.button === 0) latest.current.onPiece(position);
      };
      instance.world.controller.taps.push(tap);
      resetView.current = () => { resetSceneView(instance.world); instance.invalidate(); };
      instance.invalidate();
      return () => {
        const index = instance.world.controller.taps.indexOf(tap);
        if (index >= 0) instance.world.controller.taps.splice(index, 1);
        detach?.();
        instance.dispose();
        if (engine.current === instance) { engine.current = null; resetView.current = null; }
      };
    } catch {
      detach?.();
      current?.dispose();
      engine.current = null;
      if (element.isConnected) setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    const instance = engine.current;
    if (!ready || !instance) return;
    const cube = instance.world.cube as Cube;
    cube.twister.setup(setup);
    cube.instancedRenderer.setFaceColorOverride(orientedCubeFaceColors(orientation));
    instance.invalidate();
  }, [setup, orientation, ready]);

  useEffect(() => {
    if (!ready || !guide) return;
    let frame = 0;
    const project = () => {
      const instance = engine.current, element = pointer.current;
      if (instance && element && host.current) {
        const position = latest.current.guide!.position;
        // Guide examples use top-layer pieces; point at the center of their U sticker.
        const point = new Vector3((position % 3 - 1) * 64, 96, (Math.floor(position / 9) - 1) * 64);
        instance.world.scene.updateMatrixWorld(true);
        instance.world.cube.localToWorld(point);
        point.project(instance.world.camera);
        const canvas = instance.renderer.domElement.getBoundingClientRect();
        const bounds = host.current.getBoundingClientRect();
        element.style.left = `${canvas.left - bounds.left + (point.x + 1) * canvas.width / 2}px`;
        element.style.top = `${canvas.top - bounds.top + (1 - point.y) * canvas.height / 2}px`;
      }
      frame = requestAnimationFrame(project);
    };
    frame = requestAnimationFrame(project);
    return () => cancelAnimationFrame(frame);
  }, [ready, !!guide]);

  return <div className="f2l-editor-stage" ref={host}>
    <SimStage size={size} mount={mount} onReady={() => { setReady(true); latest.current.onReady?.(); }}
      onResetView={() => resetView.current?.()} busyLabel={tr({ zh: '正在加载练习魔方', en: 'Loading the practice cube' })} />
    {guide && <div ref={pointer} className="f2l-guide-pointer" data-clicking={guide.clicking} aria-hidden="true"><span /><MousePointer2 size={60} /></div>}
    {loadFailed && <p role="alert"><T zh="魔方加载失败，请刷新页面重试。" en="The cube could not be loaded. Please refresh the page to try again." /></p>}
  </div>;
}
