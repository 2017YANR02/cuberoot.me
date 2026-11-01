'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Alg } from 'cubing/alg';
import { AllFaces, CubeData, Face, parseAlgorithm } from '@cuberoot/visualcube';
import { ArrowRight } from '@app-foundation/icons/lucide';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import Link from '@/components/AppLink';
import { pickStickering } from '@/components/AlgPlayer/stickering';
import { FM_FIXED_COLOR, FM_IGNORED, mergeStickeringMaskFns, stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { resolveStageMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/vcStageMask';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { VisualCube } from '@/components/VisualCube';
import { T, tr } from '@/i18n/tr';
import { LESSON_STICKERING, RIGHT_SUNE } from './content';
import AlgSteps from './AlgSteps';
import { useStartInspection } from './use-start-inspection';
import type { AlgLesson as Lesson, LBL_COURSE_ENTRIES } from './alg-lessons';

const LEFT_VIEW = { x: Math.PI / 6, y: Math.PI / 6, z: 0 };
const RIGHT_VIEW = { x: Math.PI / 6, y: -Math.PI / 6, z: 0 };

// Chapter 7 look for the Sune navigation thumbs: top-face plan of the fish
// state each lesson starts from, with the yellow-face stage mask.
const suneName = pickStickering('3x3', LESSON_STICKERING['yellow-face'], 'sim');
const SUNE_THUMB_COLORS = stageStickerColors(3, mergeStickeringMaskFns([
  suneName ? stickeringMaskFn(3, suneName) ?? resolveStageMaskFn(3, suneName) : null,
  stickeringMaskFn(3, 'F2L'),
]), orientedCubeFaceColors('z2'));

export default function AlgLesson({ lesson, heading, next }: { lesson: Lesson; heading: ReactNode; next?: typeof LBL_COURSE_ENTRIES[number] }) {
  const [selected, setSelected] = useState(lesson.id === 'sune-learning' ? -1 : 0);
  const terminology = lesson.id === 'sune-learning' && selected === -1;
  const choice = lesson.algs[Math.max(0, selected)];
  return <article className="lbl-lesson lbl-alg-learning">
    <aside className="lbl-visuals">
      <div className="lbl-intro">{heading}</div>
      <div className="lbl-case-layout"><div className="lbl-cases" role="group" aria-label={tr(lesson.title)}>
        {lesson.id === 'sune-learning' && <button type="button" className="lbl-button lbl-case" aria-pressed={terminology} onClick={() => setSelected(-1)}>
          <VisualCube local stickerColors={SUNE_THUMB_COLORS} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]!}
            view="plan" scheme="yogwrb" size={52} setup={new Alg(RIGHT_SUNE).invert().toString()} outlinedFacelets={[6]} alt="" aria-hidden="true" />
          <span><T zh="鱼头和鱼鳍" en="Fish head and fins" /></span>
        </button>}
        {lesson.algs.map((item, i) => <button type="button" className="lbl-button lbl-case" key={item.alg} aria-pressed={selected === i} onClick={() => setSelected(i)}>
          {lesson.id === 'sune-learning' && <VisualCube local stickerColors={SUNE_THUMB_COLORS} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]!}
            view="plan" scheme="yogwrb" size={52} setup={new Alg(item.alg).invert().toString()} alt="" aria-hidden="true" />}
          <span>{tr(item.title)}</span>
        </button>)}
      </div></div>
    </aside>
    <section className="lbl-demonstration" aria-label={tr({ zh: '公式慢放与口诀', en: 'Slow algorithm playback and move cues' })}>
      {terminology ? <FishParts /> : <><p className="lbl-alg-learning-intro">
        <span>{lesson.id === 'sune-learning' ? tr(choice.naming).split(/(左|右|\bLeft\b|\bleft\b|\bRight\b|\bright\b)/).map((part, i) =>
          (choice.left ? ['左', 'Left', 'left'] : ['右', 'Right', 'right']).includes(part)
            ? <span className="lbl-fish-direction" key={i}>{part}</span> : part) : tr(choice.naming)}</span>
        <span>{tr(lesson.usage)}</span>
      </p>
      <SlowAlg key={choice.alg} alg={choice.alg} left={choice.left} startSolved={lesson.id !== 'sune-learning'} /></>}
      <div className="lbl-lesson-actions">
        {!terminology && <p className="lbl-muscle-memory"><T zh="先慢做、做准确，再反复练习，形成肌肉记忆。" en="Start slowly and accurately, then repeat until the moves feel natural." /></p>}
        {next && <Link className="lbl-practice lbl-next-lesson" href={`/tutorial/lbl?step=${next.id}`} prefetch={false}>
          <span><T zh="下一节：" en="Next: " />{tr(next.title)}</span><ArrowRight size={16} />
        </Link>}
      </div>
    </section>
  </article>;
}

function FishParts() {
  const setup = new Alg(RIGHT_SUNE).invert().toString();
  return <div className="lbl-middle-core">
    <div className="lbl-middle-core-cases lbl-fish-parts">
      <figure>
        <VisualCube local stickerColors={SUNE_THUMB_COLORS} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]!}
          view="plan" scheme="yogwrb" size={220} setup={setup} outlinedFacelets={[1, 3, 4, 5, 6, 7]}
          alt={tr({ zh: '顶面平面图，圈出组成小鱼的全部黄色格', en: 'Top view highlighting all yellow stickers forming the fish' })} />
        <figcaption><strong><T zh="小鱼" en="Fish" /></strong>
          <span><T zh="顶面的黄色格组成小鱼" en="The yellow stickers on top form a fish" /></span></figcaption>
      </figure>
      <figure>
        <VisualCube local stickerColors={SUNE_THUMB_COLORS} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]!}
          view="plan" scheme="yogwrb" size={220} setup={setup} outlinedFacelets={[6]}
          alt={tr({ zh: '顶面平面图，圈出唯一朝黄的角格', en: 'Top view highlighting the only yellow corner on top' })} />
        <figcaption><strong><T zh="鱼头" en="Fish head" /></strong>
          <span><T zh="顶面唯一朝黄的角格" en="The only yellow corner sticker on top" /></span></figcaption>
      </figure>
      <figure>
        <VisualCube local stickerColors={SUNE_THUMB_COLORS} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]!}
          view="iso" scheme="yogwrb" size={220} setup={setup} outlinedFacelets={[11, 20, 47]}
          alt={tr({ zh: '立体图，圈出侧面的黄色角格', en: 'Cube view highlighting the yellow corner stickers on the sides' })} />
        <figcaption><strong><T zh="鱼鳍" en="Fish fins" /></strong>
          <span><T zh="侧面的黄色角格" en="The yellow corner stickers on the sides" /></span></figcaption>
      </figure>
    </div>
  </div>;
}

function SlowAlg({ alg, left, startSolved }: { alg: string; left: boolean; startSolved: boolean }) {
  const player = useRef<AlgPlayerHandle>(null);
  const [step, setStep] = useState(0);
  const inspecting = useStartInspection(!startSolved, player, step);
  const highlights = useMemo(() => {
    if (startSolved) return [];
    const cube = new CubeData(3, Object.fromEntries(AllFaces.map(face =>
      [face, Array.from({ length: 9 }, (_, i) => `${Face[face]}${i}`)])));
    for (const turn of parseAlgorithm(new Alg(alg).invert().expand().toString())) cube.turn(turn);
    return [cube.faces[Face.U][left ? 8 : 6], cube.faces[Face.F][left ? 0 : 2]];
  }, [alg, left, startSolved]);
  return <div className="lbl-demo lbl-demo-split lbl-alg-learning-demo">
    <div className="lbl-cube"><AlgPlayer ref={player} puzzle="3x3" set="" engine="sim"
      sceneRot={left ? LEFT_VIEW : RIGHT_VIEW} orientation="z2" alg={alg} startSolved={startSolved}
      highlightedStickers={inspecting && step === 0 ? highlights : undefined}
      fillPane autoPlay={!inspecting} loop moveDurationMs={1800} onStepChange={setStep} /></div>
    <div className="lbl-alg-learning-cues"><AlgSteps step="alg-learning" alg={alg} activeMove={Math.max(0, step - 1)} onMoveClick={index => player.current?.playMove?.(index)} /></div>
    <div className="lbl-complete-legend-space" aria-hidden="true" />
  </div>;
}
