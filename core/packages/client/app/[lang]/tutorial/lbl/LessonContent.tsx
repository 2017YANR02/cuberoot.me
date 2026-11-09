'use client';

import { useEffect, useId, useMemo, useRef, useState, type ComponentProps, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Alg } from 'cubing/alg';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { syncPlayerToMoveCount } from '@/lib/recon-alg-utils';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { tr } from '@/i18n/tr';
import { LBL_STEPS, lblDemoView, LESSON_STICKERING, LBL_STAGE_GOALS, LBL_LEARNING_FOCUS, RIGHT, LEFT, LBL_LEFT_VIEW_YAW } from './content';
import SegmentedInstructions from './SegmentedInstructions';
import { getLblAlgGroups } from './alg-cues';
import CompleteDemo, { FishExample, WhiteCrossCompleteDemo } from './CompleteDemo';
import { BLUE_RED_BOTTOM_CORNER_SETUP, daisyBlockedStickers, bottomCornerPreview, middleLessonHiddenStickers, middleDirectionStickers, middleEdgePreview, middleAlignmentStickers, yellowFaceNonYellowStickers, yellowFaceTouchSticker, yellowFishRecognitionStickers, type CompleteDemoStage } from './complete-demo-state';
import BasicsGuide from './BasicsGuide';
import IntroLesson from './IntroLesson';
import MiddleCases from './MiddleCases';
import LastLayerTerms from './LastLayerTerms';
import { chapters, type Lesson } from './curriculum';
import { PieceLesson, NotationLesson, TriggerOverview, JOverview, JExplanation } from './IntroContent';
import { usePlayerVisible } from './use-player-visible';
import { useSideTurnView } from './use-side-turn-view';
import { SIDE_VIEW_PAUSE_MS, SIDE_VIEW_TURN_MS } from './schedule-demo-play';
import { whiteEdgeStickering } from './white-edge';
import { FishOverview, FishRecognition } from './FishLessons';
import { DaisyTerms } from './DaisyTerms';
import CrossOverviewAnimation from './CrossOverviewAnimation';
import { crossStickering } from './cross-display';
import AlgSteps from './AlgSteps';
import SolveFlowchart from './SolveFlowchart';
import { StageImage } from './StageImage';
export { StageImage } from './StageImage';
import EdgeObservation from './EdgeObservation';

const ignoreCaseCue = () => {};
const cornerPreviews = [
  { setup: `(${RIGHT})2`, caption: { zh: '角块在底层，是特殊情况', en: 'A corner in the bottom layer is a special case.' } },
  { setup: `(${RIGHT})2`, caption: { zh: '情况1：白色朝左', en: 'Case 1: White faces left' } },
  { setup: `(${RIGHT})4`, caption: { zh: '情况2：白色朝右', en: 'Case 2: White faces right' } },
  { setup: BLUE_RED_BOTTOM_CORNER_SETUP, caption: { zh: '情况3：颜色不对（与中心颜色不同）', en: 'Case 3: Wrong colors (different from the centers)' } },
  { setup: BLUE_RED_BOTTOM_CORNER_SETUP, caption: { zh: '无论哪种特殊情况，都做右公式', en: 'For any of these special cases, do the right trigger' } },
];

function CornerCasePrelude({ index, onAdvance, previews = cornerPreviews, middle = false, observation = false, left = false }: {
  index: number; onAdvance: (index: number) => void; previews?: typeof cornerPreviews; middle?: boolean; observation?: boolean; left?: boolean;
}) {
  const player = useRef<AlgPlayerHandle>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const visible = usePlayerVisible(player, String(index));
  const { setup } = previews[index];
  const sceneRot = useMemo(() => {
    const view = lblDemoView();
    return observation && left ? { ...view, y: -view.y } : view;
  }, [observation, left]);
  const alignmentMove = left ? "U'" : 'U';
  const [alignmentSettled, setAlignmentSettled] = useState(false);
  useEffect(() => {
    if (!observation || index !== 1 || !visible) return;
    setAlignmentSettled(false);
    player.current?.playMove?.(0);
    let frame = 0;
    const wait = () => {
      if (player.current?.isUserMovePending?.()) frame = requestAnimationFrame(wait);
      else setAlignmentSettled(true);
    };
    frame = requestAnimationFrame(wait);
    return () => cancelAnimationFrame(frame);
  }, [observation, index, visible]);
  useEffect(() => {
    if (!middle || index !== 2 || !visible || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    let started: number | undefined;
    let yaw = 0;
    const tick = (now: number) => {
      started ??= now;
      const amplitude = observation ? (left ? -LBL_LEFT_VIEW_YAW : LBL_LEFT_VIEW_YAW) : -.45;
      const nextYaw = amplitude * (1 - Math.cos((now - started) / 8000 * Math.PI * 2)) / 2;
      player.current?.orbitView?.(nextYaw - yaw, 0);
      yaw = nextYaw;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [middle, observation, left, index, visible]);
  const purpleCorner = !observation && (index === 0 || index === previews.length - 1);
  const [outlineVisible, setOutlineVisible] = useState(true);
  useEffect(() => {
    setOutlineVisible(true);
    if (!visible || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setOutlineVisible(value => !value), 650);
    return () => window.clearInterval(timer);
  }, [visible, index]);
  const { highlights, hiddenStickers, centers } = useMemo(() => middle ? middleEdgePreview(setup) : bottomCornerPreview(setup), [setup, middle]);
  const observationHiddenStickers = useMemo(() => observation ? middleLessonHiddenStickers(setup) : hiddenStickers, [observation, setup, hiddenStickers]);
  const outlined = useMemo(() => {
    if (observation) {
      if (index === 0) return middleAlignmentStickers(setup).slice(0, 2);
      return index === 2 ? middleDirectionStickers(setup, left) : middleAlignmentStickers(setup);
    }
    return index === (middle ? 2 : 3) ? [...highlights, ...centers] : highlights;
  }, [index, middle, observation, setup, left, highlights, centers]);
  const stickerColors = useMemo(() => purpleCorner
    ? Object.fromEntries(highlights.map(sticker => [sticker, '#a855f7'])) : undefined, [purpleCorner, highlights]);
  const learningArea = visible ? wrapper.current?.closest('.lbl-lesson-scroll') : null;
  const advanced = useRef(false);
  useEffect(() => { advanced.current = false; }, [index]);
  function advance() {
    if (!visible || advanced.current || (observation && index === 1 && !alignmentSettled)) return;
    advanced.current = true;
    onAdvance(index + 1);
  }
  useEffect(() => {
    if (!visible) return;
    const continueWithSpace = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, button, a, [contenteditable="true"], [role="dialog"]')) return;
      event.preventDefault();
      if (advanced.current || (observation && index === 1 && !alignmentSettled)) return;
      advanced.current = true;
      onAdvance(index + 1);
    };
    document.addEventListener('keydown', continueWithSpace);
    return () => document.removeEventListener('keydown', continueWithSpace);
  }, [visible, index, onAdvance, observation, alignmentSettled]);
  return <div ref={wrapper} className="lbl-auto-player lbl-notation-player" data-visible={visible}>
    <AlgPlayer key={observation ? 'observation' : index} ref={player} puzzle="3x3" engine="sim" additionalStickering={middle ? undefined : 'centers-only'} set={middle ? LESSON_STICKERING.middle : LESSON_STICKERING.corners}
      alg={observation ? alignmentMove : ''} setup={observation ? `${previews[0].setup} ${left ? 'U' : "U'"}` : setup} orientation="z2" sceneRot={sceneRot} highlightedStickers={outlineVisible && (!observation || index === 0 || alignmentSettled) ? outlined : []} hiddenStickers={observationHiddenStickers}
      stickerColorOverrides={stickerColors}
      frontFaceArrow={observation && index === 2 ? { from: 1, to: left ? 3 : 5 } : undefined}
      controlMode="none" hideResetView lockView interactionMode="none" fillPane />
    {learningArea && createPortal(
      <>
        <button type="button" className="lbl-guide-continue" onClick={advance}
          aria-label={tr({ zh: '点击继续', en: 'Click to continue' })} />
        <span className="lbl-guide-continue-hint">{tr({ zh: '点击学习区继续', en: 'Click the lesson area to continue' })}</span>
      </>,
      learningArea,
    )}
  </div>;
}


function LessonPlayer({ player, interacted, yellowCase, fishLeft, middleAlignment, cornerAlignment, showCornerResult = false, showMiddleResult = false, initialLeftView = false, pauseAfterObservation = false, ...props }: ComponentProps<typeof AlgPlayer> & { player: RefObject<AlgPlayerHandle | null>; interacted: RefObject<boolean>; yellowCase?: number; fishLeft?: boolean; middleAlignment?: boolean; cornerAlignment?: 'left' | 'right'; showCornerResult?: boolean; showMiddleResult?: boolean; initialLeftView?: boolean; pauseAfterObservation?: boolean }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const thumbShadingId = useId();
  const visible = usePlayerVisible(player, props.alg);
  const [playRequest, setPlayRequest] = useState(0);
  const [step, setStep] = useState(0);
  const sidePauseSteps = useSideTurnView(player, props.alg, step, visible && !props.showHands, initialLeftView ? LBL_LEFT_VIEW_YAW : 0);
  const [alignmentReady, setAlignmentReady] = useState(false);
  const observingCorner = cornerAlignment !== undefined && step === 2;
  const touchCase = yellowCase !== undefined && yellowCase >= 2;
  const recognizesFish = yellowCase !== undefined || fishLeft !== undefined;
  useEffect(() => {
    setAlignmentReady(false);
    if (!(touchCase && step === 1) && !observingCorner) return;
    let frame = 0;
    const wait = () => {
      if (player.current?.isUserMovePending?.()) frame = requestAnimationFrame(wait);
      else setAlignmentReady(true);
    };
    frame = requestAnimationFrame(wait);
    return () => cancelAnimationFrame(frame);
  }, [touchCase, observingCorner, step, player]);
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
    if (!visible || middleAlignment || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    let timer = 0;
    let started: number | undefined;
    let returnStarted: number | undefined;
    let yaw = 0;
    let returnYaw = 0;
    const targetYaw = props.alg === LEFT ? LBL_LEFT_VIEW_YAW : 0;
    const schedulePlay = () => {
      timer = window.setTimeout(() => {
        if (!interacted.current && !document.hidden) setPlayRequest(1);
      }, props.showHands || recognizesFish || middleAlignment ? 2000 : 1000);
    };
    const waitForHands = (now: number) => {
      if (interacted.current) return;
      started ??= now;
      if (pauseAfterObservation && (player.current?.isUserMovePending?.(false)
        || props.alg.startsWith('L') && now - started < SIDE_VIEW_TURN_MS)) {
        frame = requestAnimationFrame(waitForHands);
        return;
      }
      if (props.showHands && player.current?.isUserMovePending?.()) {
        const nextYaw = .12 * Math.sin((now - started) / 3600 * Math.PI * 2);
        player.current.orbitView?.(nextYaw - yaw, 0);
        yaw = nextYaw;
        frame = requestAnimationFrame(waitForHands);
        return;
      }
      if (props.showHands && yaw !== targetYaw) {
        if (returnStarted === undefined) {
          returnStarted = now;
          returnYaw = yaw;
        }
        const progress = Math.min((now - returnStarted) / 450, 1);
        const nextYaw = progress === 1 ? targetYaw : returnYaw + (targetYaw - returnYaw) * progress * progress * (3 - 2 * progress);
        player.current?.orbitView?.(nextYaw - yaw, 0);
        yaw = nextYaw;
        if (progress < 1) {
          frame = requestAnimationFrame(waitForHands);
          return;
        }
      }
      schedulePlay();
    };
    frame = requestAnimationFrame(waitForHands);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [visible, recognizesFish, middleAlignment, interacted, player, props.alg, props.showHands, pauseAfterObservation]);
  const thumbStage = visible && touchCase && step === 1 && alignmentReady
    ? wrapper.current?.querySelector('.sim-stage')
    : null;
  const resultStage = visible && (showCornerResult || showMiddleResult) ? wrapper.current?.querySelector('.sim-stage') : null;
  return <div ref={wrapper} className="lbl-auto-player" data-visible={visible} onPointerDownCapture={() => { interacted.current = true; }} onKeyDownCapture={() => { interacted.current = true; }}>
    <AlgPlayer {...props} ref={player} playRequest={playRequest}
      highlightedStickers={(step === 0 || ((touchCase || yellowCase === 1) && step === 1)) ? highlights : undefined}
      frontFaceArrow={observingCorner && alignmentReady ? { from: cornerAlignment === 'left' ? 0 : 2, to: cornerAlignment === 'left' ? 6 : 8 } : props.frontFaceArrow}
      lockView={touchCase || props.lockView}
      hideResetView={touchCase || props.hideResetView}
      pauseAfterSteps={cornerAlignment ? [2, ...sidePauseSteps] : touchCase ? [1, ...sidePauseSteps] : sidePauseSteps}
      sectionPauseMs={cornerAlignment || touchCase ? 2000 : sidePauseSteps.length ? SIDE_VIEW_PAUSE_MS : undefined}
      onStepChange={value => { setStep(value); props.onStepChange?.(value); }} />
    {resultStage && createPortal(
      <span className="lbl-left-thumb-overlay">
        <span className={`lbl-left-thumb-bubble ${showMiddleResult ? 'lbl-middle-result-bubble' : 'lbl-corner-result-bubble'}`} data-site-surface="panel" role="status">
          {tr(showMiddleResult
            ? { zh: '需要根据实际情况选择去右或去左', en: 'Choose the right or left insertion according to your case' }
            : { zh: '此时应根据实际情况判断白块朝向', en: 'Now check which way the white sticker faces in your case' })}
        </span>
      </span>,
      resultStage,
    )}
    {thumbStage && createPortal(
      <span className="lbl-left-thumb-overlay">
        <svg viewBox="0 0 32 30" aria-hidden="true">
          <defs>
            <radialGradient id={thumbShadingId} cx="35%" cy="30%" r="80%">
              <stop stopColor="color-mix(in srgb, var(--accent) 45%, var(--accent-foreground))" />
              <stop offset="100%" stopColor="var(--accent)" />
            </radialGradient>
          </defs>
          <path fill={`url(#${thumbShadingId})`} d="M5.2 10.4C8.5 5.7 15.8 2 22 1.8c4.8-.2 8 2.4 8.8 6.8.8 4.8-1.4 9.2-5.2 12.9-3.4 3.3-7.8 6.1-12 6.4-4 .4-7.6-1.6-9.6-5.2-2.2-3.9-1.7-8.2 1.2-12.3Z" />
          <path className="lbl-left-thumb-nail" d="M12.9 10.5c2.6-2.6 6.5-4.8 9.8-5 2.8-.2 4.5 1.3 4.7 3.7.2 2.5-1.3 5-3.3 7.1-2 2-4.7 3.9-7.1 4.1-2.1.2-4.2-1.3-5.3-3.3-1.2-2.1-.7-4.7 1.2-6.6Z" />
          <path className="lbl-left-thumb-lunula" d="M11 15.1q4.7-.9 7.4 4.9c-.5.2-1 .4-1.4.4-2.1.2-4.2-1.3-5.3-3.3-.4-.6-.6-1.3-.7-2Z" />
        </svg>
        <span className="lbl-left-thumb-bubble" data-site-surface="panel">
          {yellowCase === 2
            ? tr({ zh: '顶面有 2 格非黄，左拇指碰黄。', en: 'Two non-yellow corners on top. Left thumb touches yellow.' })
            : tr({ zh: '顶面有 4 格非黄，左拇指不碰黄。', en: 'Four non-yellow corners on top. Left thumb stays off yellow.' })}
        </span>
      </span>,
      thumbStage,
    )}
  </div>;
}

function DaisyBlockedPrelude({ setup, onDone }: { setup: string; onDone: () => void }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const player = useRef<AlgPlayerHandle>(null);
  const visible = usePlayerVisible(player, setup);
  const [stage, setStage] = useState(0);
  const stickers = useMemo(() => daisyBlockedStickers(setup), [setup]);
  const [outlineVisible, setOutlineVisible] = useState(true);
  useEffect(() => {
    setOutlineVisible(true);
    if (!visible || stage >= 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setOutlineVisible(value => !value), 650);
    return () => window.clearInterval(timer);
  }, [visible, stage]);
  function advance() {
    if (!visible) return;
    if (stage < 2) setStage(value => value + 1);
    else onDone();
  }
  const highlighted = stage < 2 ? outlineVisible ? [stickers[stage]] : [] : stickers;
  const [learningArea, setLearningArea] = useState<Element | null>(null);
  useEffect(() => {
    setLearningArea(wrapper.current?.closest('.lbl-lesson-scroll') ?? null);
  }, []);
  useEffect(() => {
    function continueWithSpace(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.defaultPrevented || event.repeat || event.isComposing ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest('button, input, select, textarea, a, [contenteditable], [role="dialog"]')) return;
      event.preventDefault();
      advance();
    }
    document.addEventListener('keydown', continueWithSpace);
    return () => document.removeEventListener('keydown', continueWithSpace);
  }, [onDone, visible, stage]);
  const bubbleStage = visible ? wrapper.current?.querySelector('.sim-stage') : null;
  return <div ref={wrapper} className="lbl-content lbl-content-example lbl-daisy-blocked-prelude">
    <section className="lbl-demonstration lbl-daisy-blocked-player">
      <div className="lbl-auto-player" data-visible={visible}>
        <AlgPlayer ref={player} puzzle="3x3" engine="sim" playRequest={stage >= 2 ? 1 : 0}
          set={LESSON_STICKERING.daisy} alg="R R' R R'" loop setup={setup} orientation="z2" sceneRot={lblDemoView()}
          highlightedStickers={highlighted} moveDurationMs={2400}
          controlMode="none" hideResetView lockView interactionMode="none" fillPane />
      </div>
      {bubbleStage && stage < 2 && createPortal(<span className="lbl-left-thumb-overlay">
        <span className="lbl-left-thumb-bubble lbl-daisy-blocked-bubble" data-floor={stage === 0 ? 'middle' : 'top'} data-site-surface="panel" role="status">
        {tr(stage === 0 ? { zh: '二楼棱块', en: 'Middle-floor edge' }
          : { zh: '有其他棱块挡住', en: 'Another edge is in the way' })}
      </span></span>, bubbleStage)}
    </section>
    <section className="lbl-explanation">
      <p className="lbl-lead">{tr({ zh: '顶面挡住时，直接右手上会怎样？', en: 'What happens if you lift right while the top slot is occupied?' })}</p>
      <p hidden={stage < 2}>{tr({ zh: '白棱上去了，原来的白花瓣却被转走了。', en: 'The white edge moves up, but the existing white petal moves away.' })}</p>
    </section>
    {learningArea && createPortal(<>
      <button type="button" className="lbl-guide-continue" onClick={advance}
        aria-label={tr({ zh: '点击学习区继续', en: 'Click the lesson area to continue' })} />
      <span className="lbl-guide-continue-hint">{tr({ zh: '点击学习区继续', en: 'Click the lesson area to continue' })}</span>
    </>, learningArea)}
  </div>;
}

export default function LessonContent({ chapter, lesson, hostChapterId, onSelectLesson }: {
  chapter: typeof chapters[number]; lesson: Lesson; hostChapterId: string; onSelectLesson?: (id: string) => void;
}) {
  const player = useRef<AlgPlayerHandle>(null);
  const interacted = useRef(false);
  const [move, setMove] = useState(0);
  const [selectedStepStart, setSelectedStepStart] = useState<number | null>(null);
  const [finalMoveSettled, setFinalMoveSettled] = useState(false);
  const [moveReplay, setMoveReplay] = useState(0);
  const [cornerPreview, setCornerPreview] = useState(0);
  const [edgeObservationDone, setEdgeObservationDone] = useState(false);
  const [daisyBlockedPreludeDone, setDaisyBlockedPreludeDone] = useState(false);
  const example = useMemo(() => {
    const original = lesson.example;
    if (!edgeObservationDone || chapter.id !== 'edge-position' || !original) return original;
    const moves = new Alg(original.alg).expand().toString().split(/\s+/);
    const preparation: string[] = [];
    while (moves[0]?.startsWith('y')) preparation.push(moves.shift()!);
    if (!preparation.length) return original;
    return { ...original, alg: moves.join(' '), startSolved: false,
      setup: `${resolvePlayerSetup('3x3', original.alg, original.setup, original.startSolved ?? false)} ${preparation.join(' ')}`,
      hint: { zh: original.hint.zh.split(' → ').slice(1).join(' → '), en: original.hint.en.split(' → ').slice(1).join(' → ') } };
  }, [lesson.example, chapter.id, edgeObservationDone]);
  const middleHiddenStickers = useMemo(() => chapter.id === 'middle' && ['case-0', 'case-1'].includes(lesson.id) && example?.setup ? middleLessonHiddenStickers(example.setup) : undefined, [chapter.id, lesson.id, example?.setup]);
  const initialLeftView = chapter.id === 'middle' && lesson.id === 'case-1';
  const sceneRot = useMemo(() => {
    const view = lblDemoView();
    return initialLeftView ? { ...view, y: -view.y } : view;
  }, [initialLeftView]);
  const instructionStep = lesson.id.startsWith('l-alg-learning') ? 'corner-position' : chapter.id;
  const groups = useMemo(() => example ? getLblAlgGroups(instructionStep, example.alg) : [], [example, instructionStep]);
  const finalMove = groups.at(-1)?.at(-1)?.index ?? -1;
  const moveCount = finalMove + 1;
  const stepMarkers = useMemo(() => groups.slice(1).map(group => group[0].index), [groups]);
  useEffect(() => {
    if (!moveCount || move !== moveCount) return;
    let frame = 0;
    const waitForTurn = () => {
      if (player.current?.isUserMovePending?.()) frame = requestAnimationFrame(waitForTurn);
      else setFinalMoveSettled(true);
    };
    frame = requestAnimationFrame(waitForTurn);
    return () => cancelAnimationFrame(frame);
  }, [move, moveCount, moveReplay]);
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
  }, [move, followRevision, finalMoveSettled, selectedStepStart]);
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
  if (chapter.id === 'daisy' && lesson.id === 'case-2' && example?.setup && !daisyBlockedPreludeDone) {
    return <DaisyBlockedPrelude setup={example.setup} onDone={() => setDaisyBlockedPreludeDone(true)} />;
  }
  if (lesson.kind === 'flowchart') return <SolveFlowchart stageId={chapter.id} onSelectLesson={onSelectLesson} />;
  if (lesson.kind === 'notation') return <NotationLesson />;
  if (chapter.id === 'edge-position' && lesson.kind === 'example' && example && !edgeObservationDone) {
    return <EdgeObservation example={example} caseIndex={chapter.examples.indexOf(example)} onDone={() => setEdgeObservationDone(true)} />;
  }
  if (chapter.id === 'trigger-learning' && lesson.kind === 'overview') return <TriggerOverview />;
  if (chapter.id === 'l-alg-learning' && lesson.kind === 'overview') return <JOverview />;
  if (chapter.id === 'sune-learning' && ['overview', 'recognition'].includes(lesson.kind)) return <div className="lbl-content lbl-content-reading">
    <section className="lbl-explanation">{lesson.kind === 'overview' ? <FishOverview /> : <FishRecognition />}</section>
  </div>;
  if (lesson.kind === 'complete' && chapter.id === 'cross') return <div className="lbl-complete"><WhiteCrossCompleteDemo /></div>;
  if (hostChapterId === 'yellow-face' && chapter.id === 'sune-learning' && lesson.kind === 'example') {
    return <div className="lbl-complete"><FishExample left={lesson.id === 'sune-learning-0'} /></div>;
  }
  const middleAlignment = chapter.id === 'middle' && ['case-0', 'case-1'].includes(lesson.id);
  const triggerHandsDemo = chapter.id === 'trigger-learning' && (example?.alg === RIGHT || example?.alg === LEFT);
  const cornerEjection = chapter.id === 'corners' && lesson.id === 'case-1';
  const middleEjection = chapter.id === 'middle' && lesson.id === 'case-2';
  const previews = middleEjection ? [
    { setup: chapter.examples[2].setup!, caption: { zh: '棱块在中层，是特殊情况', en: 'An unsolved edge in the middle layer is a special case.' } },
    { setup: chapter.examples[2].setup!, caption: { zh: '情况1：朝向反了', en: 'Case 1: Flipped orientation.' } },
    { setup: `${chapter.examples[3].setup!} y`, caption: { zh: '情况2：颜色不对', en: 'Case 2: The colors do not match.' } },
    { setup: chapter.examples[2].setup!, caption: { zh: '无论哪种特殊情况，都做“去右”', en: 'For either special case, use the right insertion.' } },
  ] : middleAlignment ? [
    { setup: example!.setup!, caption: { zh: '转顶层，让棱块侧面与中心同色', en: 'Turn the top layer to match the edge’s side color to the center.' } },
    { setup: example!.setup!, caption: { zh: '棱块侧面与中心同色，形成“倒T”', en: 'The edge’s side color matches the center, forming an upside-down T.' } },
    { setup: example!.setup!, caption: lesson.id === 'case-1'
      ? { zh: '观察棱块，该放入左边', en: 'Observe the edge. It belongs on the left.' }
      : { zh: '观察棱块，该放入右边', en: 'Observe the edge. It belongs on the right.' } },
  ] : cornerPreviews;
  const previewCaption = cornerEjection || middleEjection || middleAlignment ? previews[cornerPreview]?.caption : undefined;
  const stackTrigger = hostChapterId === 'corners' && triggerHandsDemo;
  const showJExplanation = hostChapterId === 'corner-position' && chapter.id === 'l-alg-learning';
  if (example) return <div className={`lbl-content lbl-content-example${stackTrigger ? ' lbl-content-trigger' : ''}${cornerEjection ? ' lbl-content-corner-ejection' : ''}${middleEjection || middleAlignment ? ' lbl-content-middle-ejection' : ''}`}>
    <section className="lbl-demonstration" aria-label={tr({ zh: '魔方演示', en: 'Cube demonstration' })}
      onClickCapture={event => {
        if (event.target instanceof Element && event.target.closest('.playback-bar button:not(:disabled):not(.playback-bar-reset-view)')) resumeFollowing();
      }} onInputCapture={event => {
        if (event.target instanceof Element && event.target.closest('.playback-bar-scrub')) {
          setSelectedStepStart(null);
          resumeFollowing();
        }
      }}>
      {previewCaption ? <CornerCasePrelude observation={middleAlignment} left={lesson.id === 'case-1'} middle={middleEjection || middleAlignment} previews={previews} index={cornerPreview} onAdvance={setCornerPreview} />
        : <LessonPlayer player={player} interacted={interacted} puzzle="3x3" engine="sim" set={lesson.id === 'white-edge' ? '' : lesson.mask ?? LESSON_STICKERING[chapter.id] ?? ''}
        middleAlignment={false}
        pauseAfterObservation={chapter.id === 'edge-position' && ['case-0', 'case-1', 'case-2'].includes(lesson.id)}
        showCornerResult={cornerEjection && finalMoveSettled}
        showMiddleResult={middleEjection && finalMoveSettled}
        cornerAlignment={chapter.id === 'corners' && ['case-0', 'case-3'].includes(lesson.id) ? 'right' : chapter.id === 'corners' && lesson.id === 'case-2' ? 'left' : undefined}
        initialLeftView={initialLeftView}
        stickeringAtStep={lesson.id === 'white-edge' ? whiteEdgeStickering : chapter.id === 'cross' ? crossStickering : undefined}
        yellowCase={chapter.id === 'yellow-face' ? chapter.examples.indexOf(example) : undefined}
        fishLeft={chapter.id === 'sune-learning' ? lesson.id.endsWith('-0') : undefined}
        outlinedStickers={chapter.id === 'daisy' ? [['D5'], ['D3'], ['D5'], ['D5'], ['D5'], ['D5']][chapter.examples.indexOf(example)] : undefined}
        highlightDaisyAlignment={chapter.id === 'cross'}
        showHands={triggerHandsDemo}
        hiddenStickers={middleHiddenStickers ?? (chapter.id === 'yellow-face' && lesson.id === 'case-3' ? ['U8'] : undefined)}
        additionalStickering={chapter.id.startsWith('yellow-') || chapter.id.endsWith('-position') ? 'F2L' : hostChapterId === 'corners' ? 'centers-only' : undefined}
        alg={example.alg} setup={example.setup} startSolved={example.startSolved} orientation="z2" sceneRot={sceneRot} stepMarkers={stepMarkers}
        fillPane onStepChange={step => {
          setSelectedStepStart(start => start === step ? start : null);
          setFinalMoveSettled(false);
          setMove(step);
        }} />}
    </section>
    <section ref={explanation} className="lbl-explanation" aria-label={tr({ zh: '公式、口诀与解释', en: 'Algorithm, cues and explanation' })}
      onTouchMove={pauseFollowing} onWheel={pauseFollowing}>
      {previewCaption ? <>
        <p className="lbl-lead lbl-corner-case-caption" aria-live="polite">{middleAlignment && cornerPreview === 2
          ? tr(previewCaption).split(/(左|右|\bleft\b|\bright\b)/i).map((part, index) => index % 2 ? <span className="lbl-direction-emphasis" key={index}>{part}</span> : part)
          : tr(previewCaption)}</p>
        {cornerEjection && cornerPreview === cornerPreviews.length - 1 && <AlgSteps step="trigger-learning" alg={RIGHT} />}
      </>
        : <SegmentedInstructions onHeadlights={onSelectLesson ? () => onSelectLesson('case-0') : undefined} onMiddleRight={onSelectLesson ? () => onSelectLesson('case-0') : undefined} onWhiteRight={onSelectLesson ? () => onSelectLesson('case-0') : undefined} step={instructionStep} alg={example.alg} playbackStep={move} finalMoveSettled={finalMoveSettled}
        selectedStepStart={selectedStepStart}
        onLine={onSelectLesson ? () => onSelectLesson('case-0') : undefined}
        onFish={onSelectLesson ? () => onSelectLesson(chapter.examples.indexOf(example) === 2 ? 'sune-learning-0' : 'sune-learning-1') : undefined}
        introduction={showJExplanation ? <JExplanation /> : undefined}
        exampleIndex={lesson.id === 'white-edge' ? 1 : chapter.examples.indexOf(lesson.example!)} instruction={tr(lesson.id !== 'white-edge' && ['corners', 'cross'].includes(chapter.id) ? chapter.paragraphs[0] ?? example.hint : example.hint)}
        onStepClick={moveCount => {
          interacted.current = true;
          resumeFollowing();
          setSelectedStepStart(moveCount);
          syncPlayerToMoveCount(player.current?.getPlayer(), moveCount);
        }}
        onMoveClick={index => {
          interacted.current = true;
          setSelectedStepStart(null);
          resumeFollowing();
          if (move === moveCount && index === finalMove && !player.current?.isUserMovePending?.()) {
            setFinalMoveSettled(false);
            setMoveReplay(value => value + 1);
          }
          player.current?.playMove?.(index);
        }} />}
      {lesson.paragraphs?.map((text, index) => <p key={index}>{tr(text)}</p>)}
      {!['structure', 'corners', 'cross', 'middle', 'corner-position'].includes(chapter.id) && !lesson.paragraphs && chapter.paragraphs.map((text, index) => text.zh !== example.hint.zh && <p key={index}>{tr(text)}</p>)}
    </section>
  </div>;
  if (lesson.kind === 'complete') return <div className="lbl-complete">
    <CompleteDemo stage={chapter.id as CompleteDemoStage} onCaseCueChange={ignoreCaseCue} />
  </div>;
  const goal = LBL_STAGE_GOALS[chapter.id];
  const previous = LBL_STEPS[Math.max(0, LBL_STEPS.findIndex(item => item.id === chapter.id) - 1)];
  return <div className="lbl-content lbl-content-reading">
    <section className="lbl-explanation" aria-label={tr({ zh: '教学说明', en: 'Instructions' })}>
      {lesson.kind === 'overview' && (chapter.id === 'structure' ? <IntroLesson /> : <>
        {chapter.id === 'cross' ? <CrossOverviewAnimation
          daisy={<StageImage stage="daisy" size={280} brightCenters />}
          cross={<StageImage stage="cross" size={280} />} />
        : <div className="lbl-stage-overview">
          <figure><StageImage stage={previous.id} size={280} /></figure>
          <span className="lbl-stage-arrow" aria-hidden="true">⇒</span>
          <figure><StageImage stage={chapter.id} size={280} /></figure>
        </div>}
        {chapter.id !== 'cross' && <><p className="lbl-lead">{tr(goal.summary ?? chapter.goal)}</p>
        {LBL_LEARNING_FOCUS[chapter.id] && <p>{tr(LBL_LEARNING_FOCUS[chapter.id])}</p>}</>}
      </>)}
      {lesson.kind === 'layers' && <>
        <div className="lbl-layers"><BasicsGuide section="layers" /></div>
        <p style={{ fontSize: 'var(--lbl-text-small)' }}>{tr({ zh: '处理优先级二楼>一楼和三楼>地下室', en: 'Priority: middle floor > bottom and top floors > basement' })}</p>
      </>}
      {lesson.kind === 'terms' && (chapter.id === 'daisy' ? <DaisyTerms />
        : chapter.id === 'middle' ? <MiddleCases /> : <LastLayerTerms wall={chapter.id === 'edge-position'} />)}
    </section>
  </div>;
}
