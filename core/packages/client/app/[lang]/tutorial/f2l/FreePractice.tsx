'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import SimStage from '@/components/sim-embed/SimStage';
import type { SimMount } from '@/components/sim-embed/mountSimWorld';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { tr, T } from '@/i18n/tr';
import { f2lPlaybackSections } from './content';
import { buildFreePracticeCases, freePlacementKey, placeFreePiece, SOLVED_FREE_PLACEMENT } from './free-practice';

const NO_STOPS: readonly number[] = [];

/** Editor only: reuse the same mount, controller taps and orbit gestures as /predict. */
function PairEditor({ setup, orientation, onPiece }: {
  setup: string; orientation: string; onPiece: (position: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<SimMount | null>(null);
  const resetView = useRef<(() => void) | null>(null);
  const latest = useRef({ setup, orientation, onPiece });
  latest.current = { setup, orientation, onPiece };
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
        if (face !== null && options.button === 0) latest.current.onPiece(position);
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

  return <div className="f2l-editor-stage" ref={host}>
    <SimStage size={size} mount={mount} onReady={() => setReady(true)}
      onResetView={() => resetView.current?.()} busyLabel={tr({ zh: '正在加载练习魔方', en: 'Loading the practice cube' })} />
    {loadFailed && <p role="alert"><T zh="魔方加载失败，请刷新页面重试。" en="The cube could not be loaded. Please refresh the page to try again." /></p>}
  </div>;
}

export default function FreePractice({ orientation, pauseBetween }: { orientation: string; pauseBetween: boolean }) {
  const table = useMemo(buildFreePracticeCases, []);
  const [placement, setPlacement] = useState(SOLVED_FREE_PLACEMENT);
  const [preview, setPreview] = useState(false);
  const exercise = table.get(freePlacementKey(placement));
  const choosePiece = useCallback((position: number) => setPlacement(current => placeFreePiece(current, position)), []);

  return <>
    <p className="f2l-lead"><T zh="对照手中的魔方，点击顶层或 FR槽的棱、角来选择位置，再次点击同一块切换朝向。拖动魔方可调整视角。如果目标棱或角位于其他槽，请先按第 7 章的方法转化为标态，再来设置。" en="Match the cube in your hands: click an edge or corner on top or in FR to choose its position. Click the same piece again to change its orientation. Drag to adjust the view. If either target piece is in another slot, first use the method in Chapter 7 to turn it into a standard case, then set it up here." /></p>
    <div className="f2l-lesson">
      <section className="f2l-demo" aria-label={tr({ zh: '自由练习魔方', en: 'Free practice cube' })}>
        <div className="f2l-cube">
          {preview && exercise ? <AlgPlayer puzzle="3x3" set="f2l-tutorial" engine="sim" setup={exercise.setup} alg={exercise.alg}
            orientation={orientation} fillPane autoPlay moveDurationMs={850} sectionPauseMs={2000}
            pauseAfterSteps={pauseBetween ? f2lPlaybackSections(exercise.alg).slice(0, -1).map(section => section.end) : NO_STOPS} />
            : <PairEditor setup={exercise?.setup ?? ''} orientation={orientation} onPiece={choosePiece} />}
        </div>
        {exercise?.alg && <>
          <p className="f2l-caption"><T zh="复原公式" en="Solution" /> · {exercise.name}</p>
          <code className="f2l-alg f2l-player-alg" data-site-surface="panel">{exercise.alg}</code>
        </>}
        <button type="button" className="f2l-restart" disabled={!preview && !exercise?.alg} onClick={() => setPreview(current => !current)}>
          {preview ? <T zh="重新摆放" en="Edit the case" /> : <T zh="演示复原" en="Play the solution" />}
        </button>
        {preview && <p className="f2l-caption"><T zh="点击“重新摆放”可返回刚才设置的情况。" en="Choose “Edit the case” to return to the position you set." /></p>}
      </section>
      <section className="f2l-guidance" aria-live="polite">
        {!exercise ? <p><T zh="暂未收录这个情况的教学解法。" en="A teaching solution for this case is not available yet." /></p>
          : !exercise.alg ? <p><T zh="这组棱角已经还原。点击其他棱、角位置，摆出你想练习的情况。" en="This pair is already solved. Click other edge and corner positions to set up a case to practice." /></p> : <>
            <h3><T zh="打乱公式" en="Scramble" /></h3>
            <p><code className="f2l-alg f2l-player-alg f2l-scramble-alg" data-site-surface="panel">{exercise.setup}</code></p>
            <p className="f2l-caption"><T zh="先复原前两层，再按上方所选朝向执行打乱。" en="Solve the first two layers, then apply the scramble with the orientation selected above." /></p>
          </>}
      </section>
    </div>
  </>;
}
