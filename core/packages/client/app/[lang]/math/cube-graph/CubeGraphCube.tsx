'use client';

import { useEffect, useRef, useState } from 'react';
import { planSimUpdate } from '@cuberoot/shared/timer/sim-log';
import SimStage from '@/components/sim-embed/SimStage';
import type { SimMount } from '@/components/sim-embed/mountSimWorld';
import type { customMaskFn } from '@/components/sim-embed/customStickering';
import { useT } from '@/hooks/useT';

/** The graph owns the log; /sim owns gestures, rendering and turn animation. */
export default function CubeGraphCube({ order = 3, moves, animate, locked, onMove, selected, onSelect }: {
  order?: number;
  moves: string[];
  animate: boolean;
  locked: boolean;
  onMove: (move: string) => void;
  selected?: number;
  onSelect: (id: number) => void;
}) {
  const t = useT();
  const mountRef = useRef<SimMount | null>(null);
  const latest = useRef({ moves, locked, onMove, onSelect });
  latest.current = { moves, locked, onMove, onSelect };
  const makeMask = useRef<typeof customMaskFn | null>(null);
  const shown = useRef('');
  const resetView = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);
  const turns = moves.join(' ');

  async function mount(host: HTMLElement) {
    const [{ mountSimWorld }, { attachEmbeddedSimInteraction }, { resetSceneView }, { pickedSids, customMaskFn }] = await Promise.all([
      import('@/components/sim-embed/mountSimWorld'),
      import('@/components/sim-embed/attachEmbeddedSimInteraction'),
      import('@cuberoot/puzzle-render-core/engine/viewControls'),
      import('@/components/sim-embed/customStickering'),
    ]);
    const m = mountSimWorld({ host, puzzle: order, interactive: true });
    mountRef.current = m;
    makeMask.current = customMaskFn;
    shown.current = latest.current.moves.join(' ');
    m.world.cube.twister.setup(shown.current);
    resetView.current = () => { resetSceneView(m.world); m.invalidate(); };
    const detach = attachEmbeddedSimInteraction({
      world: m.world,
      dom: m.renderer.domElement,
      mode: 'turn',
      onUserMove: move => {
        // The controller has already applied this turn. Acknowledge it before
        // updating React so the log sync does not apply the same turn twice.
        shown.current = [...latest.current.moves, move].join(' ');
        latest.current.onMove(move);
      },
    });
    m.world.controller.lock = latest.current.locked;
    const tap: typeof m.world.controller.taps[number] = (index, face, { button }) => {
      // Picking uses settled piece identities; it must never interrupt a turn.
      const cube = m.world.cube;
      if (button !== 0 || face === null || !('cubelets' in cube) || cube.busy || latest.current.locked) return;
      const [sid] = pickedSids(cube, index, face, 'sticker');
      if (sid) latest.current.onSelect('URFDLB'.indexOf(sid[0]) * order * order + Number(sid.slice(1)));
    };
    m.world.controller.taps.push(tap);
    return () => {
      const index = m.world.controller.taps.indexOf(tap);
      if (index >= 0) m.world.controller.taps.splice(index, 1);
      detach();
      m.dispose();
      mountRef.current = null;
      resetView.current = null;
    };
  }

  useEffect(() => {
    const m = mountRef.current;
    if (!ready || !m || shown.current === turns) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const plan = planSimUpdate({ turns: shown.current, pose: '' }, { turns, pose: '' }, animate && !reducedMotion);
    // An already-mounted solved cube can animate its very first turn too.
    const mode = animate && !reducedMotion && !shown.current && moves.length === 1 ? 'push' : plan.mode;
    m.world.cube.twister[mode](plan.exp);
    shown.current = turns;
    m.invalidate();
  }, [turns, moves.length, animate, ready]);

  useEffect(() => {
    if (ready && mountRef.current) mountRef.current.world.controller.lock = locked;
  }, [locked, ready]);

  useEffect(() => {
    const m = mountRef.current;
    if (!ready || !m || !makeMask.current || !('instancedRenderer' in m.world.cube)) return;
    const faceSize = order * order;
    const mask = selected === undefined ? '' : `${'URFDLB'[Math.floor(selected / faceSize)]}:${selected % faceSize}`;
    m.world.cube.instancedRenderer.setStickering(makeMask.current(order, mask, 'outline', 'dim'));
    m.invalidate();
  }, [selected, ready, order]);

  return <div role="group" aria-label={t('可拖拽转动的三维魔方', 'Drag to turn the 3D cube')}>
    <SimStage size={380} className="cube-graph-cube" mount={mount} onReady={() => setReady(true)}
      onResetView={() => resetView.current?.()} busyLabel={t('正在加载魔方', 'Loading the cube')} />
  </div>;
}
