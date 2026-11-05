'use client';

import { useEffect, useMemo, useRef, useState, type ComponentProps, type RefObject } from 'react';
import { Alg } from 'cubing/alg';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { ArrowRight } from '@app-foundation/icons/lucide';
import { stickeringMaskFn, mergeStickeringMaskFns, FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { resolveStageMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/vcStageMask';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { pickStickering } from '@/components/AlgPlayer/stickering';
import { VisualCube } from '@/components/VisualCube';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { tr } from '@/i18n/tr';
import { LBL_STEPS, lblDemoView, LESSON_STICKERING, LBL_STAGE_GOALS, LBL_LEARNING_FOCUS } from './content';
import SegmentedInstructions from './SegmentedInstructions';
import { getLblAlgGroups } from './alg-cues';
import CompleteDemo, { WhiteCrossCompleteDemo } from './CompleteDemo';
import { middleAlignmentStickers, yellowFaceNonYellowStickers, yellowFaceTouchSticker, yellowFishRecognitionStickers, type CompleteDemoStage } from './complete-demo-state';
import BasicsGuide from './BasicsGuide';
import IntroLesson from './IntroLesson';
import MiddleCases from './MiddleCases';
import LastLayerTerms from './LastLayerTerms';
import { chapters, type Lesson } from './curriculum';
import { PieceLesson, NotationLesson, TriggerOverview, JOverview } from './IntroContent';
import { usePlayerVisible } from './use-player-visible';
import { whiteEdgeStickering } from './white-edge';
import { FishOverview, FishRecognition } from './FishLessons';

const ignoreCaseCue = () => {};

function colorsFor(stage: string) {
  const name = pickStickering('3x3', LESSON_STICKERING[stage] ?? 'centers-only', 'sim');
  const mask = name ? stickeringMaskFn(3, name) ?? resolveStageMaskFn(3, name) : null;
  return stageStickerColors(3, mergeStickeringMaskFns([mask, stage.startsWith('yellow-') || stage.endsWith('-position') ? stickeringMaskFn(3, 'F2L') : null]), orientedCubeFaceColors('z2'));
}
export function StageImage({ stage, size = 120 }: { stage: string; size?: number }) {
  return <VisualCube local size={size} view="iso" stickerColors={colorsFor(stage)} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]}
    setup={stage === 'daisy' ? 'F2 R2 B2 L2' : ''} alt="" />;
}

function LessonPlayer({ player, yellowCase, fishLeft, middleAlignment, ...props }: ComponentProps<typeof AlgPlayer> & { player: RefObject<AlgPlayerHandle | null>; yellowCase?: number; fishLeft?: boolean; middleAlignment?: boolean }) {
  const visible = usePlayerVisible(player, props.alg);
  const [playRequest, setPlayRequest] = useState(0);
  const interacted = useRef(false);
  const [step, setStep] = useState(0);
  const [alignmentReady, setAlignmentReady] = useState(false);
  const touchCase = yellowCase !== undefined && yellowCase >= 2;
  const recognizesFish = yellowCase !== undefined || fishLeft !== undefined;
  useEffect(() => {
    setAlignmentReady(false);
    if (!touchCase || step !== 1) return;
    let frame = 0;
    const wait = () => {
      if (player.current?.isUserMovePending?.()) frame = requestAnimationFrame(wait);
      else setAlignmentReady(true);
    };
    frame = requestAnimationFrame(wait);
    return () => cancelAnimationFrame(frame);
  }, [touchCase, step, player]);
  const highlights = useMemo(() => {
    if (middleAlignment) return middleAlignmentStickers(resolvePlayerSetup('3x3', props.alg, props.setup, props.startSolved ?? false));
    if (!recognizesFish) return undefined;
    const setup = resolvePlayerSetup('3x3', props.alg, props.setup, props.startSolved ?? false);
    const first = new Alg(props.alg).expand().toString().split(/\s+/)[0];
    if (touchCase) return step === 0 ? yellowFaceNonYellowStickers(setup, props.hiddenStickers)
      : [yellowFaceTouchSticker(`${setup} ${step === 1 && alignmentReady ? first : ''}`)];
    return yellowFishRecognitionStickers(`${setup} ${yellowCase !== undefined ? first : ''}`, fishLeft ?? yellowCase === 1);
  }, [middleAlignment, recognizesFish, props.alg, props.setup, props.startSolved, props.hiddenStickers, touchCase, step, alignmentReady, yellowCase, fishLeft]);
  useEffect(() => {
    if (!visible || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => {
      if (!interacted.current && !document.hidden) setPlayRequest(1);
    }, recognizesFish || middleAlignment ? 2000 : 1000);
    return () => clearTimeout(timer);
  }, [visible, recognizesFish, middleAlignment]);
  return <div className="lbl2-auto-player" data-visible={visible} onPointerDownCapture={() => { interacted.current = true; }} onKeyDownCapture={() => { interacted.current = true; }}>
    <AlgPlayer {...props} ref={player} playRequest={playRequest}
      highlightedStickers={(step === 0 || (touchCase && step === 1)) ? highlights : undefined}
      pauseAfterSteps={touchCase ? [1] : undefined} sectionPauseMs={touchCase ? 2000 : undefined}
      onStepChange={value => { setStep(value); props.onStepChange?.(value); }} />
  </div>;
}

export default function LessonContent({ chapter, lesson }: { chapter: typeof chapters[number]; lesson: Lesson }) {
  const player = useRef<AlgPlayerHandle>(null);
  const [move, setMove] = useState(0);
  const [finalMoveSettled, setFinalMoveSettled] = useState(false);
  const [moveReplay, setMoveReplay] = useState(0);
  const example = lesson.example;
  const instructionStep = lesson.id.startsWith('l-alg-learning') ? 'corner-position' : chapter.id;
  const finalMove = useMemo(() => example ? getLblAlgGroups(instructionStep, example.alg).flat().length : 0, [example, instructionStep]);
  useEffect(() => {
    if (!finalMove || move !== finalMove) return;
    let frame = 0;
    const waitForTurn = () => {
      if (player.current?.isUserMovePending?.()) frame = requestAnimationFrame(waitForTurn);
      else setFinalMoveSettled(true);
    };
    frame = requestAnimationFrame(waitForTurn);
    return () => cancelAnimationFrame(frame);
  }, [move, finalMove, moveReplay]);
  const explanation = useRef<HTMLElement>(null);
  const following = useRef(true);
  const lastRow = useRef<HTMLElement | null>(null);
  const [followRevision, setFollowRevision] = useState(0);
  useEffect(() => {
    const pane = explanation.current;
    if (!pane || !following.current || !window.matchMedia('(max-width: 760px)').matches) return;
    const row = pane.querySelector<HTMLElement>('[data-current-step]');
    if (!row || row === lastRow.current || pane.scrollHeight <= pane.clientHeight) return;
    lastRow.current = row;

    const bounds = pane.getBoundingClientRect();
    const stepBounds = row.getBoundingClientRect();
    const top = bounds.top + 12;
    const bottom = bounds.bottom - 12;
    if (stepBounds.top >= top && stepBounds.bottom <= bottom) return;
    const offset = stepBounds.top < top || stepBounds.height > bottom - top
      ? stepBounds.top - top : stepBounds.bottom - bottom;
    pane.scrollBy({ top: offset, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [move, followRevision, finalMoveSettled]);
  function pauseFollowing() {
    if (!following.current) return;
    following.current = false;
    const pane = explanation.current;
    pane?.scrollTo({ top: pane.scrollTop, behavior: 'instant' });
  }
  function resumeFollowing() {
    if (following.current) return;
    following.current = true;
    lastRow.current = null;
    setFollowRevision(value => value + 1);
  }
  if (chapter.id === 'structure' && ['facelet', 'centers', 'corners', 'edges'].includes(lesson.id)) return <PieceLesson id={lesson.id} />;
  if (lesson.kind === 'notation') return <NotationLesson />;
  if (chapter.id === 'trigger-learning' && lesson.kind === 'overview') return <TriggerOverview />;
  if (chapter.id === 'l-alg-learning' && lesson.kind === 'overview') return <JOverview />;
  if (chapter.id === 'sune-learning' && ['overview', 'recognition'].includes(lesson.kind)) return <div className="lbl2-content lbl2-content-reading">
    <section className="lbl2-explanation">{lesson.kind === 'overview' ? <FishOverview /> : <FishRecognition />}</section>
  </div>;
  if (lesson.kind === 'complete' && chapter.id === 'cross') return <div className="lbl2-complete"><WhiteCrossCompleteDemo /></div>;
  const middleAlignment = chapter.id === 'middle' && ['case-0', 'case-1'].includes(lesson.id);
  if (example) return <div className="lbl2-content lbl2-content-example">
    <section className="lbl2-demonstration" aria-label={tr({ zh: '魔方演示', en: 'Cube demonstration' })}
      onClickCapture={event => {
        if (event.target instanceof Element && event.target.closest('.playback-bar button:not(:disabled):not(.playback-bar-reset-view)')) resumeFollowing();
      }} onInputCapture={event => {
        if (event.target instanceof Element && event.target.closest('.playback-bar-scrub')) resumeFollowing();
      }}>
      <LessonPlayer player={player} puzzle="3x3" engine="sim" set={lesson.id === 'white-edge' ? '' : lesson.mask ?? LESSON_STICKERING[chapter.id] ?? ''}
        middleAlignment={middleAlignment}
        stickeringAtStep={lesson.id === 'white-edge' ? whiteEdgeStickering : undefined}
        yellowCase={chapter.id === 'yellow-face' ? chapter.examples.indexOf(example) : undefined}
        fishLeft={chapter.id === 'sune-learning' ? lesson.id.endsWith('-0') : undefined}
        outlinedStickers={chapter.id === 'daisy' ? [['D5'], ['D3'], ['D5'], ['D5'], ['D5'], ['D5']][chapter.examples.indexOf(example)] : undefined}
        highlightDaisyAlignment={chapter.id === 'cross'}
        hiddenStickers={chapter.id === 'yellow-face' && lesson.id === 'case-3' ? ['U8'] : undefined}
        additionalStickering={chapter.id.startsWith('yellow-') || chapter.id.endsWith('-position') ? 'F2L' : undefined}
        alg={example.alg} setup={example.setup} startSolved={example.startSolved} orientation="z2" sceneRot={lblDemoView()}
        fillPane onStepChange={step => { setFinalMoveSettled(false); setMove(step); }} />
    </section>
    <section ref={explanation} className="lbl2-explanation" aria-label={tr({ zh: '公式、口诀与解释', en: 'Algorithm, cues and explanation' })}
      onTouchMove={pauseFollowing} onWheel={pauseFollowing}>
      <SegmentedInstructions step={instructionStep} alg={example.alg} playbackStep={move} finalMoveSettled={finalMoveSettled}
        preparation={middleAlignment ? tr(chapter.paragraphs[0]) : undefined}
        exampleIndex={lesson.id === 'white-edge' ? 1 : chapter.examples.indexOf(example)} instruction={tr(lesson.id !== 'white-edge' && ['corners', 'cross'].includes(chapter.id) ? chapter.paragraphs[0] ?? example.hint : example.hint)}
        onMoveClick={index => {
          resumeFollowing();
          if (move === finalMove && index + 1 === finalMove && !player.current?.isUserMovePending?.()) {
            setFinalMoveSettled(false);
            setMoveReplay(value => value + 1);
          }
          player.current?.playMove?.(index);
        }} />
      {lesson.paragraphs?.map((text, index) => <p key={index}>{tr(text)}</p>)}
      {!['structure', 'corners', 'cross', 'middle', 'corner-position'].includes(chapter.id) && !lesson.paragraphs && chapter.paragraphs.map((text, index) => text.zh !== example.hint.zh && <p key={index}>{tr(text)}</p>)}
    </section>
  </div>;
  if (lesson.kind === 'complete') return <div className="lbl2-complete">
    <CompleteDemo stage={chapter.id as CompleteDemoStage} onCaseCueChange={ignoreCaseCue} />
  </div>;
  const goal = LBL_STAGE_GOALS[chapter.id];
  const previous = LBL_STEPS[Math.max(0, LBL_STEPS.findIndex(item => item.id === chapter.id) - 1)];
  return <div className="lbl2-content lbl2-content-reading">
    <section className="lbl2-explanation" aria-label={tr({ zh: '教学说明', en: 'Instructions' })}>
      {lesson.kind === 'overview' && (chapter.id === 'structure' ? <IntroLesson /> : <>
        <div className="lbl2-stage-overview">
          <figure><StageImage stage={previous.id} size={180} /></figure>
          <ArrowRight size={22} aria-hidden="true" />
          <figure><StageImage stage={chapter.id} size={180} /></figure>
        </div>
        <p className="lbl2-lead">{tr(goal.summary ?? chapter.goal)}</p>
        {LBL_LEARNING_FOCUS[chapter.id] && <p>{tr(LBL_LEARNING_FOCUS[chapter.id])}</p>}
      </>)}
      {lesson.kind === 'layers' && <div className="lbl2-layers"><BasicsGuide section="layers" /></div>}
      {lesson.kind === 'terms' && (chapter.id === 'middle' ? <MiddleCases /> : <LastLayerTerms wall={chapter.id === 'edge-position'} />)}
    </section>
  </div>;
}
