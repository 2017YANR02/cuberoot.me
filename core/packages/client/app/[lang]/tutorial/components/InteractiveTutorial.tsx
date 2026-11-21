'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, Lightbulb, RotateCcw } from '@app-foundation/icons/lucide';
import { Color } from 'three';
import { FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import AlgPlayer, { type AlgPlayerHandle, type AlgStickerPlacement } from '@/components/AlgPlayer/AlgPlayer';
import { resolveSimPreviewMoves, type AlgPlayerPuzzle } from '@/components/AlgPlayer/player-setup';
import { createStickerHintFade } from '@/components/AlgPlayer/sticker-hint-fade';
import AppLink from '@/components/AppLink';
import ChatBubble from '@/components/ChatBubble';
import { ClearButton } from '@/components/ClearButton';
import TrainingFeedbackOverlay from '@/components/TrainingFeedbackOverlay';
import type { BlockedLayerTurnHandler, CubeletTap } from '@/components/sim-embed/attachEmbeddedSimInteraction';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import type { CubeFace } from '@/lib/cube-colors';
import { useModalBackdrop } from '@/hooks/useModalDismiss';
import { invertMoveString } from '@cuberoot/shared/alg-notation';
import { tr } from '@/i18n/tr';
import ChapterNavigation from './ChapterNavigation';
import CornerAnswerBubble from './CornerAnswerBubble';
import InteractiveQuestionCopy, { InteractiveQuestionProgress } from './InteractiveQuestionCopy';
import ReadingFit from './ReadingFit';
import SectionMenu from './SectionMenu';
import TutorialNavigationShell from './TutorialNavigationShell';
import TutorialFlowCanvas from './TutorialFlowCanvas';
import { TUTORIAL_STICKER_PURPLE } from './tutorial-colors';
import './interactive-tutorial.css';

type Text = { zh: string; en: string };
type View = { x: number; y: number; z: number };
export type CourseExercise = {
  setup: string;
  solution: string;
  goal: Text;
  rotationOnly?: boolean;
  stateKey: (history: readonly string[]) => string;
  isComplete: (history: readonly string[]) => boolean;
};
type PlacementQuestion = {
  kind: 'placement';
  homeIndex: number;
  homeFace: CubeFace;
  goal: AlgStickerPlacement;
  describe?: (placement: AlgStickerPlacement) => Text;
};
type CourseQuestion = {
  progressLabel: Text;
  heading: Text;
  prompt: Text;
} & ({
  kind: 'piece' | 'position';
  targetIndex: number;
  choices: readonly Text[];
  hint?: Text;
  showAnswerHint?: boolean;
} | PlacementQuestion);
type QuestionFeedback = { kind: 'correct' } | { kind: 'wrong'; choice: Text; clientX: number; clientY: number };
type PlacementProgress = { stage: 'offer' } | { stage: 'practice'; startCount: number }
  | { stage: 'turning'; startCount: number };
type AlignmentAttempt = {
  stage: 'entry' | 'move-away' | 'return' | 'place' | 'complete';
  position: AlgStickerPlacement | null;
};
type StickerGoal = { homeIndex: number; homeFace: CubeFace; placement: AlgStickerPlacement };
type CourseTurnExploration = {
  opening?: {
    progressLabel: Text;
    heading: Text;
    prompt: Text;
    done: Text;
  } & ({ kind: 'faces'; inProgress: Text } | { kind: 'rotation'; solvedStickers: readonly StickerGoal[] });
  protectedCorners: Text;
  freeFaces: readonly { face: CubeFace; label: Text }[];
  mutedStickers: readonly string[];
  alignment: {
    progressLabel: Text;
    side: 'left' | 'right';
    homeIndex: number;
    homeFace: CubeFace;
    stickers: readonly string[];
    goalPositions: readonly number[];
    heading: Text;
    prompt: Text;
    describe: (placement: AlgStickerPlacement) => Text;
  };
  insertion: {
    progressLabel: Text;
    heading: Text;
    prompt: Text;
    steps: readonly { notation: string; cue: Text }[];
    demoSetup: string;
    helpLabel: Text;
    solvedStickers: readonly StickerGoal[];
  };
};
type CourseInteraction = {
  completion: Text;
  view: View;
  fixedOrientation?: boolean;
  orbitSnapDegrees?: number;
} & ({
  turnExploration: CourseTurnExploration;
  questions?: never;
} | {
  turnExploration?: never;
  questions: readonly [CourseQuestion, ...CourseQuestion[]];
  hintFacelets?: boolean;
  dimStickersAfterFirstQuestion?: readonly string[];
});
type CourseObservation = { view: View; steps: readonly Text[]; stickers?: readonly string[] };
type GuidedStage = { progressLabel: Text; heading: Text; prompt: Text };
type TutorialAlg = Pick<CourseTurnExploration['insertion'], 'progressLabel' | 'demoSetup' | 'helpLabel'> & {
  steps: readonly { notation: string; cue: Text; detail?: Text }[];
  demoTitle?: Text;
  showHands?: 'left';
};
export type GuidedCourseLesson = {
  view: View;
  recognition: GuidedStage & { choices: readonly Text[]; answer: number; explanation: Text; Help?: ComponentType };
  alignment?: GuidedStage & { axis: 'U' | 'y'; showLeftThumb?: boolean; matches: (history: readonly string[]) => boolean };
  algorithm: GuidedStage & TutorialAlg & {
    alternatives?: readonly Pick<TutorialAlg, 'steps' | 'demoTitle'>[];
  };
  completion: Text;
};
type CourseSection = {
  id: string;
  title: Text;
  exercise: CourseExercise;
} & ({ interaction: CourseInteraction; observation?: never; guided?: never }
  | { interaction?: never; observation: CourseObservation; guided?: never }
  | { interaction?: never; observation?: never; guided: GuidedCourseLesson });
type ReadingSection = { id: string; title: Text; content: ReactNode };
type SelectCourseSection = (chapterId: string, sectionId?: string) => void;
type CourseIndexSection = { id: string; title: Text; index: (select: SelectCourseSection) => ReactNode };
type CourseDemoSection = { id: string; title: Text; demonstration: ReactNode };
export type CourseFlowSection = {
  id: string;
  title: Text;
  flowchart: (select: SelectCourseSection) => ReactNode;
};
export type CourseChapter = {
  id: string;
  title: Text;
  sections: readonly (CourseSection | ReadingSection | CourseIndexSection | CourseDemoSection | CourseFlowSection)[];
};
export type CoursePosition = { chapterIndex: number; sectionId: string };
export type InteractiveTutorialProps = {
  title: Text;
  puzzle: AlgPlayerPuzzle;
  orientation?: string;
  chapters: readonly CourseChapter[];
  basicsHref?: string;
  location: CoursePosition;
  onNavigate: (position: CoursePosition, chapterChanged: boolean) => void;
};

const CUBE_FRAMING_EDGE = 380;
const STICKER_FADE_MS = 720;
const ERROR_FEEDBACK_MS = 2400;
const practiceQuarterTurn = 'y';
const labels = {
  previous: { zh: '上一节', en: 'Previous section' },
  next: { zh: '下一节', en: 'Next section' },
  practice: { zh: '练习本节', en: 'Practice' },
  review: { zh: '回看本节教程', en: 'Review this section' },
  completed: { zh: '已完成', en: 'Complete' },
  chapters: { zh: '章节', en: 'Chapters' },
  basics: { zh: '魔方基础与转动记号', en: 'Cube basics and notation' },
  restart: { zh: '重来', en: 'Restart' },
};

export function LessonPane({ layout, cube, children }: { layout: 'B' | 'F'; cube: ReactNode; children: ReactNode }) {
  return <section className="course-stage" data-course-stage data-tutorial-layout={layout}>
    <div className="course-grid" data-course-grid>
      <div className="course-cube-column">{cube}</div>
      <div className="course-caption" data-course-caption>{children}</div>
    </div>
  </section>;
}

function matchesPlacement(actual: AlgStickerPlacement | null, goal: AlgStickerPlacement) {
  return actual?.positionIndex === goal.positionIndex && actual.face === goal.face;
}

function matchesStickers(player: AlgPlayerHandle, goals: readonly StickerGoal[]) {
  return goals.every(({ homeIndex, homeFace, placement }) =>
    matchesPlacement(player.getStickerPlacement?.(homeIndex, homeFace) ?? null, placement));
}

function useStickerFade(active: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(1);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function fade(now) {
      const progress = Math.min(1, (now - start) / STICKER_FADE_MS);
      setValue(progress * progress * (3 - 2 * progress));
      if (progress < 1) frame = requestAnimationFrame(fade);
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);
  return value;
}

type InteractionProps = {
  section: CourseSection;
  task: CourseInteraction;
  puzzle: AlgPlayerPuzzle;
  orientation?: string;
};

function SectionInteraction(props: InteractionProps) {
  if (props.task.turnExploration) {
    return <TurnExploration {...props} exploration={props.task.turnExploration} />;
  }
  return <InteractiveQuestions {...props} task={props.task} />;
}

const triggerPauses = [1, 2, 3] as const;
const triggerMoveCopy: Record<string, Text> = {
  "L'": { zh: '把左层向上转。', en: 'Turn the left layer up.' },
  L: { zh: '把左层转下来。', en: 'Turn the left layer down.' },
  R: { zh: '把右层向上转。', en: 'Turn the right layer up.' },
  "R'": { zh: '把右层转下来。', en: 'Turn the right layer down.' },
};

function TutorialAlgDemo({ insertion, puzzle, orientation, view, onClose }: {
  insertion: TutorialAlg;
  puzzle: AlgPlayerPuzzle;
  orientation?: string;
  view: View;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const player = useRef<AlgPlayerHandle>(null);
  const interacted = useRef(false);
  const titleId = useId();
  const [cubeReady, setCubeReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [playRequest, setPlayRequest] = useState(0);
  const [step, setStep] = useState(0);
  const left = insertion.steps[0]?.notation === "L'";
  const title = insertion.demoTitle ?? (left ? { zh: '左手上钩下回', en: 'Left-hand trigger' } : insertion.progressLabel);
  const describeMove = (notation: string, index: number): Text => insertion.demoTitle ? insertion.steps[index].detail ?? insertion.steps[index].cue
    : triggerMoveCopy[notation] ?? (index === 1 ? { zh: '勾动顶层。', en: 'Hook the top layer.' } : { zh: '把顶层转回去。', en: 'Turn the top layer back.' });
  const current = insertion.steps[step - 1];
  const close = () => {
    dialog.current?.close();
    onClose();
  };
  const backdrop = useModalBackdrop(close);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    if (!cubeReady) return;
    let frame = requestAnimationFrame(function waitForHands() {
      if (!player.current?.isUserMovePending?.()) setReady(true);
      else frame = requestAnimationFrame(waitForHands);
    });
    return () => cancelAnimationFrame(frame);
  }, [cubeReady]);
  useEffect(() => {
    if (!ready || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => {
      if (!document.hidden && !interacted.current) setPlayRequest(1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [ready]);

  return <dialog ref={dialog} className="course-demo-dialog" data-long-alg={insertion.steps.length > 4 || undefined} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close(); }} {...backdrop}>
    <div className="course-demo-panel" data-site-surface="popover">
      <header>
        <h2 id={titleId}>{tr(title)}</h2>
        <ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭演示', en: 'Close demonstration' })} onClick={close} />
      </header>
      <div className="course-demo-body">
        <div className="course-demo-stage" data-demo-ready={ready}>
          <div className="course-demo-player" inert={!ready}
            onPointerDownCapture={() => { interacted.current = true; }}
            onKeyDownCapture={() => { interacted.current = true; }}>
            <AlgPlayer ref={player} puzzle={puzzle} set="" orientation={orientation} engine="sim"
              setup={insertion.demoSetup} alg={insertion.steps.map(({ notation }) => notation).join(' ')} sceneRot={view}
              showHands={insertion.showHands ?? !insertion.demoTitle} moveDurationMs={720}
              pauseAfterSteps={insertion.demoTitle ? undefined : triggerPauses} sectionPauseMs={300}
              onStepChange={setStep} playRequest={playRequest} onReady={() => setCubeReady(true)} fillPane />
          </div>
          {cubeReady && !ready && <span className="course-demo-loading" role="status">
            {tr({ zh: '正在加载手部演示', en: 'Loading the hand demonstration' })}
          </span>}
        </div>
        <div className="course-demo-guide">
          <ol className="course-demo-cues" role="list">
            {insertion.steps.map(({ notation, cue }, index) => <li key={index} aria-current={step === index + 1 ? 'step' : undefined}>
              <button type="button" className="course-demo-cue" disabled={!ready} onClick={() => {
                interacted.current = true;
                player.current?.playMove?.(index);
              }} aria-label={`${tr(cue)} ${notation}. ${tr(describeMove(notation, index))}`}>
                <span>{tr(cue)}</span><code>{notation}</code>
              </button>
            </li>)}
          </ol>
          <p className="course-demo-detail" aria-live="polite" aria-atomic="true">
            {tr(current ? describeMove(current.notation, step - 1)
              : { zh: '选择一个动作可以单独播放。', en: 'Select a move to play it on its own.' })}
          </p>
        </div>
      </div>
    </div>
  </dialog>;
}

function TurnExploration({ section, task, puzzle, orientation, exploration }: InteractionProps & {
  exploration: CourseTurnExploration;
}) {
  const [ready, setReady] = useState(false);
  const { opening, alignment, insertion, protectedCorners } = exploration;
  const [quiz, setQuiz] = useState<0 | 1 | 2>(opening ? 0 : 1);
  const [orientationSettled, setOrientationSettled] = useState(false);
  const [inserted, setInserted] = useState(false);
  const [attempt, setAttempt] = useState<AlignmentAttempt>({ stage: 'entry', position: null });
  const [hintRequest, setHintRequest] = useState(0);
  const [moves, setMoves] = useState<string[]>([]);
  const [settledMoveCount, setSettledMoveCount] = useState(0);
  const [insertionStart, setInsertionStart] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);
  const closeDemo = useCallback(() => setDemoOpen(false), []);
  const movesRef = useRef<string[]>([]);
  const [blockedTurn, setBlockedTurn] = useState<{ face: string; message: Text; clientX: number; clientY: number } | null>(null);
  const [roundFeedback, setRoundFeedback] = useState<{ count: number; solved: boolean } | null>(null);
  const reportedRounds = useRef(0);
  const board = useRef<HTMLDivElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(feedbackTimer.current), []);
  useEffect(() => {
    if (!roundFeedback) return;
    const timer = setTimeout(() => setRoundFeedback(null), 2400);
    return () => clearTimeout(timer);
  }, [roundFeedback]);
  const player = useRef<AlgPlayerHandle>(null);
  const tried = new Set(moves.map(move => move[0]));
  const aligning = quiz === 1;
  const inserting = quiz === 2;
  const rotating = quiz === 0 && opening?.kind === 'rotation';
  const fade = useStickerFade(quiz > 0 && !!opening);
  const reveal = opening ? fade : 1;
  const aligned = reveal === 1 && attempt.stage === 'complete';
  const canContinueAlignment = aligned && attempt.position !== null
    && alignment.goalPositions.includes(attempt.position.positionIndex);
  const openingComplete = rotating ? orientationSettled
    : exploration.freeFaces.every(({ face }) => tried.has(face));
  const currentComplete = inserting ? inserted : aligning ? aligned : openingComplete;
  const steps = opening ? [opening, alignment, insertion] : [alignment, insertion];
  const progressIndex = quiz - (opening ? 0 : 1);
  const insertionMoves = moves.length - insertionStart;
  const insertionStep = insertionMoves % insertion.steps.length;
  const insertionBoundary = inserting && !inserted && insertionMoves > 0 && insertionStep === 0;
  const finishingTurn = insertionBoundary && settledMoveCount !== moves.length && section.exercise.isComplete(moves);
  const cornerSlotHint = useMemo(() => aligning && hintRequest
    ? { positions: alignment.goalPositions, request: hintRequest, color: TUTORIAL_STICKER_PURPLE }
    : undefined, [aligning, alignment.goalPositions, hintRequest]);
  const stickerColorOverrides = useMemo(() => {
    if (!reveal) return undefined;
    const colors = orientedCubeFaceColors(orientation ?? '');
    const gray = new Color(FM_FIXED_COLOR[FM_IGNORED]!);
    const displayColor = new Color();
    return Object.fromEntries(alignment.stickers.map(sticker => [sticker,
      displayColor.set(colors[sticker[0] as CubeFace]).lerp(gray, 1 - reveal).getStyle()]));
  }, [alignment.stickers, orientation, reveal]);

  useEffect(() => {
    const handle = player.current;
    if (!ready || !aligning || !handle) return;
    const updatePosition = () => {
      const position = handle.getStickerPlacement?.(alignment.homeIndex, alignment.homeFace);
      if (!position) return;
      const pending = handle.isUserMovePending?.(false);
      const atGoal = alignment.goalPositions.includes(position.positionIndex);
      setAttempt(previous => {
        let { stage } = previous;
        if (stage === 'entry') {
          if (pending) return previous;
          stage = atGoal ? 'move-away' : 'place';
        } else if (stage === 'move-away' && !atGoal) {
          stage = 'return';
        } else if ((stage === 'place' || stage === 'return') && atGoal) {
          stage = 'complete';
        }
        return stage === previous.stage && matchesPlacement(previous.position, position) ? previous : { stage, position };
      });
    };
    updatePosition();
    return handle.subscribeSettledCube?.(updatePosition);
  }, [alignment, ready, aligning]);

  useEffect(() => {
    const handle = player.current;
    if (!ready || !handle) return;
    const checkRound = (queuedMoves: number) => {
      const completedMoves = movesRef.current.length - insertionStart - queuedMoves;
      if (completedMoves <= 0 || completedMoves % insertion.steps.length !== 0) return;
      const count = completedMoves / insertion.steps.length;
      if (count <= reportedRounds.current) return;
      const solved = matchesStickers(handle, insertion.solvedStickers);
      reportedRounds.current = count;
      setRoundFeedback({ count, solved });
      if (solved) setInserted(true);
    };
    const checkSettled = () => {
      if (handle.isUserMovePending?.(false)) return;
      setSettledMoveCount(moves.length);
      if (rotating) setOrientationSettled(matchesStickers(handle, opening.solvedStickers));
      else if (inserting) checkRound(0);
    };
    checkSettled();
    const unsubscribeView = handle.subscribeRenderedView?.(checkSettled);
    const unsubscribeRounds = inserting ? handle.subscribeSettledCube?.(checkRound) : undefined;
    return () => {
      unsubscribeView?.();
      unsubscribeRounds?.();
    };
  }, [ready, moves.length, inserting, insertionStart, insertion.steps.length, insertion.solvedStickers, rotating, opening]);

  const record = (move: string) => {
    if (!move) return;
    clearTimeout(feedbackTimer.current);
    setBlockedTurn(null);
    if (rotating) setOrientationSettled(false);
    movesRef.current = [...movesRef.current, move];
    setMoves(movesRef.current);
  };
  const allowTurn = (move: string) => {
    if (rotating) return /^[xyz](?:[1-9]\d*)?'?$/.test(move);
    if (!inserting) return /^[FURBDL](?:[1-9]\d*)?'?$/.test(move)
      && exploration.freeFaces.some(item => item.face === move[0]);
    const count = movesRef.current.length - insertionStart;
    const index = count % insertion.steps.length;
    const handle = player.current;
    if (demoOpen || move !== insertion.steps[index].notation) return false;
    if (count === 0 || index !== 0 || !handle) return true;
    return handle.isUserMovePending?.(false)
      ? !section.exercise.isComplete(movesRef.current)
      : !matchesStickers(handle, insertion.solvedStickers);
  };
  const showBlockedTurn: BlockedLayerTurnHandler = (move, point) => {
    const bounds = board.current?.getBoundingClientRect();
    if (!bounds || !move || finishingTurn) return;
    clearTimeout(feedbackTimer.current);
    const face = move[0].toUpperCase();
    const expected = insertion.steps[(movesRef.current.length - insertionStart) % insertion.steps.length].notation;
    const message = inserting
      ? { zh: `这一步转 ${expected}`, en: `Do ${expected} for this step` }
      : { zh: `转 ${face} 面会带动${protectedCorners.zh}。`, en: `Turning ${face} would move ${protectedCorners.en}.` };
    setBlockedTurn({ face, message, clientX: point?.clientX ?? bounds.left + bounds.width / 2,
      clientY: point?.clientY ?? bounds.top + bounds.height / 2 });
    feedbackTimer.current = setTimeout(() => setBlockedTurn(null), ERROR_FEEDBACK_MS);
  };
  const keyInput = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase();
    if (!ready || inserted || demoOpen || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
    if (!(rotating ? /^[xyz]$/ : /^[furbdl]$/).test(key)) return;
    const move = rotating ? key : key.toUpperCase();
    if (player.current?.applyUserMove?.(event.shiftKey ? move + "'" : move)) event.preventDefault();
  };
  const leftSide = alignment.side === 'left';
  const slot = leftSide ? { zh: '左前方', en: 'front-left' } : { zh: '右前方', en: 'front-right' };
  const hand = leftSide ? { zh: '左手', en: 'left-hand' } : { zh: '右手', en: 'right-hand' };
  const cornerName = section.title.en.toLowerCase();
  let alignmentPrompt = alignment.prompt;
  if (canContinueAlignment) alignmentPrompt = {
    zh: `下一问用${hand.zh}「上钩下回」让${section.title.zh}归位。`,
    en: `Use the ${hand.en} trigger to solve the ${cornerName} in the next quiz.`,
  };
  else if (aligned) alignmentPrompt = {
    zh: `继续前，先把${section.title.zh}转回${slot.zh}。`,
    en: `Bring the corner back to the ${slot.en} before continuing.`,
  };
  else if (reveal === 1 && attempt.stage === 'move-away') alignmentPrompt = {
    zh: `${section.title.zh}已经在${slot.zh}。先把它转离${slot.zh}，再转回来。`,
    en: `The ${cornerName} already starts at the ${slot.en}. Turn it away, then bring it back.`,
  };
  else if (reveal === 1 && attempt.stage === 'return') alignmentPrompt = {
    zh: `现在把${section.title.zh}转回${slot.zh}。`,
    en: `Now bring the ${cornerName} back to the ${slot.en}.`,
  };
  const faceList = exploration.freeFaces.map(({ face }) => face);

  return <LessonPane layout="F" cube={
    <div ref={board} className="course-cube" role="group" tabIndex={0} aria-label={tr(inserted
      ? { zh: `${section.title.zh}已归位。拖动可查看魔方。`, en: `The ${cornerName} is solved. Drag to inspect the cube.` }
      : rotating
      ? { zh: '拖动调整视角，越过边界时转体。也可用 X、Y、Z，Shift 反向。', en: 'Drag to change the view. Drag past the limit to rotate the cube. You can also use X, Y, or Z. Shift reverses.' }
      : aligning
      ? { zh: `用 ${faceList.join('、')} 转层，Shift 反向。`, en: `Use ${faceList.join(', ')} for layer turns. Shift reverses.` }
      : { zh: '试转魔方。用 F、U、R、B、D、L 转层，Shift 反向。', en: 'Try turning the cube. Use F, U, R, B, D, and L for layer turns. Shift reverses.' })} onKeyDown={keyInput}
      data-course-cube data-ready={ready} data-drag-enabled={ready} data-move-count={moves.length} data-last-move={moves.at(-1)}>
      <AlgPlayer ref={player} puzzle={puzzle} set="" orientation={orientation} engine="sim" controlMode="none"
        setup={section.exercise.setup} alg="" sceneRot={task.view} interactionMode={inserted ? 'view' : 'turn'}
        orbitSnapDegrees={task.orbitSnapDegrees} orbitSnapLocked={!rotating}
        wholeCubeDrag={rotating ? 'rotate-only' : undefined} hintFacelets hiddenStickers={exploration.mutedStickers}
        moveHint={inserting && !inserted && !finishingTurn ? insertion.steps[insertionStep].notation : undefined}
        maxFramingEdge={CUBE_FRAMING_EDGE}
        stickerColorOverrides={stickerColorOverrides} cornerSlotHint={cornerSlotHint}
        allowUserLayerTurn={allowTurn} onBlockedUserLayerTurn={showBlockedTurn}
        onUserMove={record} onReady={() => setReady(true)} hideResetView fillPane />
      <div className="course-answer-feedback" data-turn-feedback role="status" aria-atomic="true">
        {blockedTurn && <CornerAnswerBubble clientX={blockedTurn.clientX} clientY={blockedTurn.clientY}
          message={tr(blockedTurn.message)} />}
        {!blockedTurn && roundFeedback && <ChatBubble tail="bottom" data-course-round-bubble
          className="course-answer-bubble course-round-bubble">
          {tr({
            zh: `已完成 ${roundFeedback.count} 次${roundFeedback.solved ? '' : '，继续'}`,
            en: `Completed ${roundFeedback.count} ${roundFeedback.count === 1 ? 'round' : 'rounds'}${roundFeedback.solved ? '.' : '. Keep going!'}`,
          })}
        </ChatBubble>}
      </div>
    </div>
  }>
    <div className="course-copy course-question-copy" data-course-section={section.id}
      data-course-question={progressIndex + 1} data-course-answer={quiz > 0 ? (currentComplete ? 'correct' : 'pending') : undefined}
      data-corner-reveal={aligning ? reveal : undefined} data-course-turn-exploration={quiz === 0 || undefined}
      data-blocked-face={blockedTurn?.face}>
      <InteractiveQuestionProgress steps={steps} activeIndex={progressIndex}
        currentComplete={currentComplete} />
      {inserting ? <>
        <div aria-live="polite" aria-atomic="true">
          <h2>{tr(inserted ? { zh: `${section.title.zh}归位了！`, en: `${section.title.en} solved!` } : insertion.heading)}</h2>
          <p>{tr(inserted ? task.completion : insertion.prompt)}</p>
        </div>
        {!inserted && <>
          <code className="course-alg">{insertion.steps.map(({ notation }, index) => <span key={index}
            aria-current={!finishingTurn && insertionStep === index ? 'step' : undefined}>{notation}{index < insertion.steps.length - 1 ? ' ' : ''}</span>)}</code>
          <button type="button" className="btn-secondary course-question-action" aria-haspopup="dialog" onClick={() => setDemoOpen(true)}>
            {tr(insertion.helpLabel)}
          </button>
          {demoOpen && <TutorialAlgDemo insertion={insertion} puzzle={puzzle} orientation={orientation} view={task.view} onClose={closeDemo} />}
        </>}
      </> : aligning ? <>
        <div aria-live="polite" aria-atomic="true">
          <h2>{canContinueAlignment ? tr({ zh: '完成，可以继续', en: 'Complete. You can continue.' })
            : aligned ? tr({ zh: '摆位已完成', en: 'Placement complete' }) : tr(alignment.heading)}</h2>
          <p>{tr(alignmentPrompt)}</p>
        </div>
        {!canContinueAlignment && <button type="button" className="btn-secondary course-question-action"
          onClick={() => setHintRequest(request => request + 1)}>
          {tr({ zh: `哪里是${slot.zh}？`, en: `Where is the ${slot.en}?` })}
        </button>}
        <div className="course-question-status" role="status" aria-atomic="true">
          {attempt.position && reveal === 1 && tr(alignment.describe(attempt.position))}
        </div>
      </> : opening && <>
        <h2>{tr(opening.heading)}</h2>
        <p>{tr(opening.prompt)}</p>
        {opening.kind === 'faces' && <>
          <p className="course-question-hint">{tr({ zh: '拖贴纸转层，拖外围空白查看魔方。', en: 'Drag a sticker to turn a layer. Drag the empty area to adjust the view.' })}</p>
          <ul className="course-turn-faces" role="list" aria-label={tr({ zh: '自由转动的面', en: 'Faces that turn freely' })}>
            {exploration.freeFaces.map(({ face, label }) => <li key={face} data-face={face} data-tried={tried.has(face)}>
              <Check size={15} aria-hidden={!tried.has(face)} aria-label={tr({ zh: '已尝试', en: 'Tried' })} /><code>{face}</code> {tr(label)}
            </li>)}
          </ul>
        </>}
      </>}
      {!inserting && (!aligning || aligned) && <div className="course-question-actions">
        <button type="button" className="btn-primary course-question-action"
          disabled={!ready || settledMoveCount !== moves.length || !currentComplete || (aligning && !canContinueAlignment)}
          onClick={event => {
            if (player.current?.isUserMovePending?.(false)) return;
            clearTimeout(feedbackTimer.current);
            setBlockedTurn(null);
            const caption = event.currentTarget.closest('[data-course-caption]');
            if (caption) caption.scrollTop = 0;
            if (aligning) setInsertionStart(movesRef.current.length);
            else {
              const position = player.current?.getStickerPlacement?.(alignment.homeIndex, alignment.homeFace) ?? null;
              const stage = !position ? 'entry' : alignment.goalPositions.includes(position.positionIndex) ? 'move-away' : 'place';
              setAttempt({ stage, position });
            }
            setQuiz(aligning ? 2 : 1);
            board.current?.focus({ preventScroll: true });
          }}>
          {tr({ zh: '继续', en: 'Continue' })}
        </button>
      </div>}
      {quiz === 0 && opening && <div className="course-question-status course-question-opening-status" role="status" aria-atomic="true">
        <span aria-hidden={!openingComplete}>{tr(opening.done)}</span>
        {opening.kind === 'faces' && <span aria-hidden={openingComplete || moves.length === 0}>{tr(opening.inProgress)}</span>}
      </div>}
    </div>
  </LessonPane>;
}

function InteractiveQuestions({ section, task, puzzle, orientation }: InteractionProps & { task: Extract<CourseInteraction, { questions: readonly CourseQuestion[] }> }) {
  const [ready, setReady] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectionConfirmed, setSelectionConfirmed] = useState(false);
  const [feedback, setFeedback] = useState<QuestionFeedback | null>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const [currentPlacement, setCurrentPlacement] = useState<AlgStickerPlacement | null>(null);
  const [hintRequests, setHintRequests] = useState({ piece: 0, position: 0 });
  const [pieceHintOpacity, setPieceHintOpacity] = useState(0);
  const [placementProgress, setPlacementProgress] = useState<PlacementProgress>(() =>
    task.questions[0].kind === 'placement' && section.exercise.isComplete([])
      ? { stage: 'offer' } : { stage: 'practice', startCount: 0 });
  const player = useRef<AlgPlayerHandle>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(feedbackTimer.current), []);
  const flashFeedback = useCallback((value: QuestionFeedback) => {
    clearTimeout(feedbackTimer.current);
    setFeedback(value);
    feedbackTimer.current = setTimeout(() => setFeedback(null), value.kind === 'correct' ? 850 : ERROR_FEEDBACK_MS);
  }, []);

  useEffect(() => {
    if (placementProgress.stage !== 'turning') return;
    const { startCount } = placementProgress;
    let frame = requestAnimationFrame(finishTurn);
    function finishTurn() {
      if (player.current?.isUserMovePending?.(false)) {
        frame = requestAnimationFrame(finishTurn);
        return;
      }
      setMoves(previous => [...previous, practiceQuarterTurn]);
      setPlacementProgress({ stage: 'practice', startCount: startCount + 1 });
    }
    return () => cancelAnimationFrame(frame);
  }, [placementProgress]);

  useEffect(() => {
    if (!hintRequests.piece) return;
    const started = performance.now();
    const fade = createStickerHintFade(started, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setPieceHintOpacity(fade(started).opacity);
    let frame = requestAnimationFrame(function update(now) {
      const { opacity, complete } = fade(now);
      setPieceHintOpacity(opacity);
      if (!complete) frame = requestAnimationFrame(update);
    });
    return () => cancelAnimationFrame(frame);
  }, [hintRequests.piece]);

  const dimStickers = task.dimStickersAfterFirstQuestion;
  const permanentFade = useStickerFade(questionIndex > 0 && !!dimStickers?.length);
  const stickerFade = Math.max(permanentFade, pieceHintOpacity);
  const stickerColorOverrides = useMemo(() => {
    if (!dimStickers || !stickerFade) return undefined;
    const colors = orientedCubeFaceColors(orientation ?? '');
    const gray = new Color(FM_FIXED_COLOR[FM_IGNORED]!);
    const displayColor = new Color();
    return Object.fromEntries(dimStickers.map(sticker => [sticker,
      displayColor.set(colors[sticker[0] as CubeFace]).lerp(gray, stickerFade).getStyle()]));
  }, [dimStickers, orientation, stickerFade]);

  const question = task.questions.at(questionIndex);
  const cornerSlotHint = useMemo(() => question?.kind === 'position' && question.showAnswerHint && hintRequests.position
    ? { positions: [question.targetIndex], request: hintRequests.position, color: TUTORIAL_STICKER_PURPLE, includeBackFacelets: true }
    : undefined, [question, hintRequests.position]);
  const placement = question && 'goal' in question ? question : null;
  useEffect(() => {
    const handle = player.current;
    if (!ready || !placement || !handle) return;
    const updatePlacement = () => {
      const pose = handle.getStickerPlacement?.(placement.homeIndex, placement.homeFace);
      if (pose) setCurrentPlacement(previous => matchesPlacement(previous, pose) ? previous : pose);
    };
    updatePlacement();
    return handle.subscribeRenderedView?.(updatePlacement);
  }, [ready, placement]);
  const reorienting = placementProgress.stage === 'turning';
  const needsReorientation = placement && placementProgress.stage === 'offer';
  const placed = placement && placementProgress.stage === 'practice'
    && moves.length > placementProgress.startCount && matchesPlacement(currentPlacement, placement.goal);
  useEffect(() => {
    if (placed) flashFeedback({ kind: 'correct' });
  }, [placed, flashFeedback]);
  const completed = !question || placed;
  const placementStatus = currentPlacement ? placement?.describe?.(currentPlacement) : undefined;
  const wrong = feedback?.kind === 'wrong' ? feedback : null;
  const answer = completed || selectionConfirmed ? 'correct' : wrong ? 'wrong' : 'pending';
  const questionHint = !selectionConfirmed && question && 'hint' in question ? question.hint : undefined;
  const hint = completed ? placementStatus && task.completion : questionHint;
  let prompt = completed ? placementStatus ?? task.completion : question.prompt;
  if (selectionConfirmed) prompt = question?.kind === 'piece'
    ? { zh: '找到目标角块了。', en: 'You found the right corner.' }
    : { zh: '目标位置找对了。', en: 'You found the right spot.' };
  if (needsReorientation) prompt = { zh: '你已经摆对了。换个朝向，试着把它摆回来。', en: 'You already have it right. Start from a new angle and try putting it back.' };
  if (reorienting) prompt = { zh: '魔方正在换朝向。', en: 'The cube is turning to a new starting position.' };
  const pick = ({ homeIndex, positionIndex, clientX, clientY }: CubeletTap) => {
    if (!ready || selectionConfirmed || !question || 'goal' in question) return;
    const index = question.kind === 'piece' ? homeIndex : positionIndex;
    const choice = question.choices[index];
    if (!choice) return;
    const isCorrect = index === question.targetIndex;
    flashFeedback(isCorrect ? { kind: 'correct' } : { kind: 'wrong', choice, clientX, clientY });
    if (isCorrect) setSelectionConfirmed(true);
  };
  const continueQuestion = () => {
    if (!selectionConfirmed) return;
    const nextIndex = questionIndex + 1;
    const nextQuestion = task.questions[nextIndex];
    if (nextQuestion && 'goal' in nextQuestion) {
      const pose = player.current?.getStickerPlacement?.(nextQuestion.homeIndex, nextQuestion.homeFace) ?? null;
      setCurrentPlacement(pose);
      setPlacementProgress(matchesPlacement(pose, nextQuestion.goal)
        ? { stage: 'offer' } : { stage: 'practice', startCount: moves.length });
    }
    clearTimeout(feedbackTimer.current);
    setFeedback(null);
    setSelectionConfirmed(false);
    setQuestionIndex(nextIndex);
  };
  const reorient = () => {
    if (reorienting || !player.current?.playSingleTurn?.(practiceQuarterTurn, 400)) return;
    clearTimeout(feedbackTimer.current);
    setFeedback(null);
    const startCount = placementProgress.stage === 'offer' ? moves.length : placementProgress.startCount;
    setPlacementProgress({ stage: 'turning', startCount });
  };
  const completedTitle = tr({ zh: '摆对了！', en: 'Placed correctly!' });

  return <LessonPane layout="F" cube={
    <div className="course-cube" data-course-cube data-ready={ready} data-drag-enabled={ready && !reorienting}
      data-move-count={moves.length} data-last-move={moves.at(-1)}>
      <AlgPlayer ref={player} puzzle={puzzle} set="" orientation={orientation} engine="sim" controlMode="none"
        setup={section.exercise.setup} alg="" sceneRot={task.view} interactionMode="view" orbitSnapDegrees={task.orbitSnapDegrees}
        lockView={reorienting} orbitSnapLocked={task.fixedOrientation || selectionConfirmed || placed || needsReorientation || reorienting}
        hintFacelets={task.hintFacelets} maxFramingEdge={CUBE_FRAMING_EDGE}
        stickerColorOverrides={stickerColorOverrides} cornerSlotHint={cornerSlotHint}
        onCubeletTap={pick} onUserMove={move => setMoves(previous => [...previous, move])}
        onReady={() => setReady(true)} hideResetView fillPane />
      <div className="course-answer-feedback" role="status" aria-atomic="true">
        {wrong && <CornerAnswerBubble clientX={wrong.clientX} clientY={wrong.clientY}
          message={tr({ zh: `你选的是「${wrong.choice.zh}」。再试一次。`, en: `You chose ${wrong.choice.en}. Try again.` })} />}
      </div>
      <TrainingFeedbackOverlay kind={feedback?.kind === 'correct' ? 'correct' : null}
        correctLabel={placed ? completedTitle : tr({ zh: '选对了！', en: 'Correct!' })} wrongLabel="" />
    </div>
  }>
    <InteractiveQuestionCopy sectionId={section.id} questions={task.questions} activeIndex={questionIndex} answer={answer}
      heading={completed ? completedTitle : tr(question.heading)}
      headingAction={!selectionConfirmed && question && 'showAnswerHint' in question && question.showAnswerHint
        ? <button type="button" className="btn-secondary course-question-heading-action" disabled={!ready}
          onClick={() => setHintRequests(previous => ({ ...previous, [question.kind]: previous[question.kind] + 1 }))}>
          {tr({ zh: '提示', en: 'Hint' })}
        </button>
        : null}
      prompt={tr(prompt)}
      action={selectionConfirmed
        ? <button type="button" className="btn-primary course-question-action" onClick={continueQuestion}>
          {tr({ zh: '继续', en: 'Continue' })}
        </button>
        : (needsReorientation || reorienting) ? <button type="button" className="btn-primary course-question-action"
          onClick={reorient} disabled={reorienting}>{tr({ zh: '换个朝向练一次', en: 'Try from a new angle' })}</button>
        : null}
      hint={hint && tr(hint)}
      status={!completed && !needsReorientation && !reorienting && placementStatus ? tr(placementStatus) : undefined} />
  </LessonPane>;
}

type GuidedTurn = { index: number; half?: string };

function advanceGuidedTurn(cursor: GuidedTurn, expected: string | undefined, move: string): GuidedTurn | null {
  if (!expected) return null;
  const next = { index: cursor.index + 1 };
  if (cursor.half) return cursor.half === move ? next : null;
  if (expected[1] !== '2') return expected === move ? next : null;
  const face = expected[0];
  if (move === `${face}2` || move === `${face}2'`) return next;
  return move === face || move === `${face}'` ? { ...cursor, half: move } : null;
}

function GuidedLesson({ section, task, puzzle, orientation }: {
  section: CourseSection;
  task: GuidedCourseLesson;
  puzzle: AlgPlayerPuzzle;
  orientation?: string;
}) {
  const [stage, setStage] = useState<'recognize' | 'align' | 'alg'>('recognize');
  const [choice, setChoice] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState<GuidedTurn>({ index: 0 });
  const [settled, setSettled] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [demo, setDemo] = useState<TutorialAlg | null>(null);
  const player = useRef<AlgPlayerHandle>(null);
  const board = useRef<HTMLDivElement>(null);
  const accepted = useRef({ history, cursor });
  const { recognition, alignment, algorithm } = task;
  const RecognitionHelp = recognition.Help;
  const preparing = stage === 'align' ? alignment : undefined;
  const applying = stage === 'alg';
  const recognized = choice === recognition.answer;
  const matches = preparing?.matches(history) || (applying && cursor.index === algorithm.steps.length && section.exercise.isComplete(history));
  const current = algorithm.steps[cursor.index];
  const nextMove = cursor.half ?? current?.notation;
  const rotation = preparing?.axis === 'y' || (applying && !!nextMove && /^[xyz]/.test(nextMove));
  const steps = alignment ? [recognition, alignment, algorithm] : [recognition, algorithm];
  const question = preparing ?? (applying ? algorithm : recognition);
  const activeIndex = steps.indexOf(question);

  useEffect(() => {
    const handle = player.current;
    if (!ready || !matches || !handle) return;
    const update = () => { if (!handle.isUserMovePending?.(!!preparing?.showLeftThumb)) setSettled(true); };
    update();
    return handle.subscribeRenderedView?.(update);
  }, [ready, matches, preparing?.showLeftThumb]);

  const allowTurn = (move: string) => {
    const state = accepted.current;
    if (demo || settled) return false;
    if (preparing) return move[0] === preparing.axis && !preparing.matches(state.history);
    return applying && !!advanceGuidedTurn(state.cursor, algorithm.steps[state.cursor.index]?.notation, move);
  };
  const record = (move: string) => {
    if (!move || !allowTurn(move)) return;
    const state = accepted.current;
    const next = applying ? advanceGuidedTurn(state.cursor, algorithm.steps[state.cursor.index]?.notation, move)! : state.cursor;
    const history = [...state.history, move];
    accepted.current = { history, cursor: next };
    setHistory(history);
    setCursor(next);
    setFeedback(false);
  };
  const keyInput = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase();
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || !/^[urfdblxyz]$/.test(key)) return;
    const move = /^[xyz]$/.test(key) ? key : key.toUpperCase();
    if (player.current?.applyUserMove?.(event.shiftKey ? `${move}'` : move)) event.preventDefault();
  };
  const nextQuestion = () => {
    setStage(stage === 'recognize' && alignment ? 'align' : 'alg');
    setSettled(false);
    setFeedback(false);
    board.current?.focus({ preventScroll: true });
  };
  const done = stage === 'recognize' ? recognized : settled;
  const completion = settled && applying;
  return <LessonPane layout="F" cube={
    <div ref={board} className="course-cube" role="group" tabIndex={0} aria-label={tr(section.title)} onKeyDown={keyInput}
      data-course-cube data-ready={ready} data-drag-enabled={ready} data-move-count={history.length} data-last-move={history.at(-1)}>
      <AlgPlayer ref={player} puzzle={puzzle} set="" orientation={orientation} engine="sim" controlMode="none"
        setup={section.exercise.setup} alg="" sceneRot={task.view} interactionMode={stage === 'recognize' || settled ? 'view' : 'turn'}
        showHands={alignment?.showLeftThumb ? 'left-thumb' : undefined} handsVisible={!!preparing?.showLeftThumb}
        holdReferenceThumb={!!preparing?.showLeftThumb && matches}
        orbitSnapDegrees={30} orbitSnapLocked={!rotation || settled} wholeCubeDrag={rotation && !settled ? 'rotate-only' : undefined}
        hintFacelets moveHint={applying && !settled ? nextMove : undefined} maxFramingEdge={CUBE_FRAMING_EDGE}
        allowUserLayerTurn={allowTurn} onBlockedUserLayerTurn={() => setFeedback(true)} onUserMove={record}
        onReady={() => setReady(true)} hideResetView fillPane />
    </div>
  }>
    <InteractiveQuestionCopy sectionId={section.id} questions={steps} activeIndex={activeIndex} answer={done ? 'correct' : 'pending'}
      heading={tr(completion ? labels.completed : settled && preparing
        ? { zh: '摆到位了', en: 'Aligned' } : question.heading)}
      headingAction={RecognitionHelp && <RecognitionHelp />}
      prompt={tr(completion ? task.completion : recognized && stage === 'recognize' ? recognition.explanation : question.prompt)}
      status={feedback && !done ? tr(preparing
        ? { zh: `这一步只转 ${preparing.axis}`, en: `Use ${preparing.axis} for this step` }
        : { zh: `这一步做 ${nextMove}`, en: `Do ${nextMove} for this move` }) : undefined}
      action={<>
        {stage === 'recognize' && !recognized && <div className="course-question-actions">
          {recognition.choices.map((label, index) => <button type="button" key={label.en} className="btn-secondary course-question-action"
            aria-pressed={choice === index} disabled={!ready} onClick={() => setChoice(index)}>{tr(label)}</button>)}
          {choice !== null && <p className="course-question-status" role="status">{tr({ zh: '再观察一下魔方。', en: 'Take another look at the cube.' })}</p>}
        </div>}
        {done && !applying && <button type="button" className="btn-primary course-question-action" onClick={nextQuestion}>
          {tr({ zh: '继续', en: 'Continue' })}
        </button>}
        {!done && rotation && <div className="course-question-actions">
          {(preparing ? ['y', "y'"] : [nextMove!]).map(move => <button type="button" key={move} className="btn-secondary course-question-action"
            onClick={() => {
              if (player.current?.applyUserMove?.(move)) board.current?.focus({ preventScroll: true });
            }}>{tr({ zh: `转体 ${move}`, en: `Rotate ${move}` })}</button>)}
        </div>}
        {applying && !completion && <>
          <code className="course-alg">{algorithm.steps.map(({ notation }, index) => <span key={index}
            aria-current={index === cursor.index ? 'step' : undefined}>{notation}</span>)}</code>
          <button type="button" className="btn-secondary course-question-action" aria-haspopup="dialog"
            onClick={() => setDemo(algorithm)}>{tr(algorithm.helpLabel)}</button>
          {!!algorithm.alternatives?.length && <fieldset className="course-alternatives">
            <legend>{tr({ zh: '备选公式', en: 'Alternative algorithms' })}</legend>
            <div className="course-question-actions">
              {algorithm.alternatives.map(alternative => {
                const notation = alternative.steps.map(move => move.notation).join(' ');
                return <button key={notation} type="button" className="btn-secondary course-question-action" aria-haspopup="dialog"
                  aria-label={`${tr({ zh: '演示备选公式', en: 'Watch alternative' })} ${notation}`}
                  onClick={() => setDemo({ ...algorithm, ...alternative })}><code>{notation}</code></button>;
              })}
            </div>
          </fieldset>}
          {demo && <TutorialAlgDemo insertion={demo} puzzle={puzzle} orientation={orientation} view={task.view} onClose={() => setDemo(null)} />}
        </>}
      </>} />
  </LessonPane>;
}

function Observe({ section, task, puzzle, orientation }: {
  section: CourseSection;
  task: CourseObservation;
  puzzle: AlgPlayerPuzzle;
  orientation?: string;
}) {
  const [ready, setReady] = useState(false);
  return <LessonPane layout="B" cube={
    <div className="course-cube" data-course-cube data-ready={ready} data-drag-enabled={ready}>
      <AlgPlayer puzzle={puzzle} set="" orientation={orientation} engine="sim" controlMode="none"
        setup={section.exercise.setup} alg="" sceneRot={task.view} interactionMode="view"
        maxFramingEdge={CUBE_FRAMING_EDGE} highlightedStickers={task.stickers}
        onReady={() => setReady(true)} hideResetView fillPane />
    </div>
  }>
    <div className="course-copy" data-course-section={section.id}>
      <h2>{tr(section.title)}</h2>
      {task.steps.map(step => <p key={step.en}>{tr(step)}</p>)}
      <code className="course-alg">{section.exercise.solution.split(' ').map((move, index) =>
        <span key={index}>{move}</span>)}</code>
    </div>
  </LessonPane>;
}

/** Match this puzzle's actual state against the taught path, also after reversible detours. */
function nextHint(exercise: CourseExercise, solution: readonly string[], history: readonly string[]) {
  const current = exercise.stateKey(history);
  const position = solution.findLastIndex((_, index) => exercise.stateKey(solution.slice(0, index)) === current);
  if (position >= 0) return solution[position];
  const last = history.at(-1);
  if (!last) return solution[0];
  const previous = exercise.stateKey(history.slice(0, -1));
  const before = solution.findLastIndex((_, index) => exercise.stateKey(solution.slice(0, index)) === previous);
  if (before >= 0 && solution[before].includes('2') && exercise.stateKey([...history, last]) === exercise.stateKey(solution.slice(0, before + 1))) return last;
  return invertMoveString(last);
}

function Practice({ section, puzzle, orientation }: { section: CourseSection; puzzle: AlgPlayerPuzzle; orientation?: string }) {
  const { exercise } = section;
  const fixedView = section.interaction?.fixedOrientation ? section.interaction : undefined;
  const [history, setHistory] = useState<string[]>([]);
  const [revision, reset] = useState(0);
  const [ready, setReady] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const player = useRef<AlgPlayerHandle>(null);
  const finished = exercise.isComplete(history);
  const hint = showHint && !finished ? nextHint(exercise, resolveSimPreviewMoves(puzzle, exercise.solution), history) : undefined;
  const cubeLabel = exercise.rotationOnly ? {
    zh: '练习魔方。X、Y、Z 转体，Shift 反向。',
    en: 'Practice cube. X, Y, Z rotate the puzzle. Shift reverses.',
  } : fixedView ? {
    zh: '练习魔方。R、L、U、D、B、F 转层，Shift 反向。',
    en: 'Practice cube. R, L, U, D, B, F turn layers. Shift reverses.',
  } : {
    zh: '练习魔方。R、L、U、D、B、F 转层，X、Y、Z 转体，Shift 反向。',
    en: 'Practice cube. R, L, U, D, B, F turn layers. X, Y, Z rotate the puzzle. Shift reverses.',
  };
  const record = (move: string) => setHistory(previous => exercise.isComplete(previous) ? previous : [...previous, move]);
  const keyInput = (event: KeyboardEvent<HTMLDivElement>) => {
    if (finished || !ready || event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const key = event.key.toLowerCase();
    const allowed = exercise.rotationOnly ? 'xyz' : fixedView ? 'rludbf' : 'rludbfxyz';
    if (key.length !== 1 || !allowed.includes(key)) return;
    const move = 'xyz'.includes(key) ? key : key.toUpperCase();
    if (player.current?.applyUserMove?.(event.shiftKey ? move + "'" : move)) event.preventDefault();
  };

  return <>
    <LessonPane layout="F" cube={
      <div className="course-cube" role="group" tabIndex={0} aria-label={tr(cubeLabel)}
        onKeyDown={keyInput} data-course-cube data-ready={ready} data-drag-enabled={ready} data-move-count={history.length}
        data-last-move={history.at(-1)} data-complete={finished}>
        <AlgPlayer key={revision} ref={player} puzzle={puzzle} set="" orientation={orientation}
          engine="sim" controlMode="none" setup={exercise.setup} alg="" moveHint={hint}
          maxFramingEdge={CUBE_FRAMING_EDGE}
          interactionMode={finished ? 'view' : 'turn'} wholeCubeDrag={fixedView ? undefined : exercise.rotationOnly ? 'rotate-only' : 'rotate'}
          sceneRot={fixedView?.view} orbitSnapDegrees={fixedView?.orbitSnapDegrees} orbitSnapLocked={!!fixedView}
          onUserMove={record} onReady={() => setReady(true)} hideResetView fillPane />
        <TrainingFeedbackOverlay kind={finished ? 'correct' : null}
          correctLabel={tr(labels.completed)} wrongLabel={tr({ zh: '未完成', en: 'Try again' })} />
      </div>
    }>
      <div className="course-copy" data-course-section={section.id}>
        <h2>{tr(section.title)}</h2>
        <p>{tr(exercise.goal)}</p>
        {exercise.rotationOnly && <p>{tr({
          zh: '拖动整颗魔方。也可用 X、Y、Z 转体，按住 Shift 反向。',
          en: 'Drag to rotate the cube. You can also use X, Y, Z, with Shift to reverse.',
        })}</p>}
        {hint && <code className="course-alg" aria-live="polite">{hint}</code>}
        {finished && <p className="course-completed">{tr(labels.completed)}</p>}
      </div>
    </LessonPane>
    <div className="course-transport course-practice-tools" data-course-transport>
      <button type="button" className="course-control" onClick={() => { setReady(false); setHistory([]); reset(value => value + 1); }}>
        <RotateCcw size={16} aria-hidden="true" />{tr(labels.restart)}
      </button>
      <button type="button" className="course-control" aria-expanded={showHint} disabled={finished} onClick={() => setShowHint(value => !value)}>
        <Lightbulb size={16} aria-hidden="true" />
        {tr(showHint ? { zh: '关闭提示', en: 'Hide hint' } : { zh: '获取提示', en: 'Show hint' })}
      </button>
    </div>
  </>;
}

export default function InteractiveTutorial({ title, puzzle, orientation, chapters, basicsHref, location, onNavigate }: InteractiveTutorialProps) {
  const { chapterIndex: linkedChapter, sectionId: linkedSection } = location;
  const [chapterIndex, setChapter] = useState(linkedChapter);
  const chapter = chapters[chapterIndex];
  const [selection, setSelection] = useState({ id: linkedSection, request: 0 });
  const currentPosition = useRef(location);
  const [practice, setPractice] = useState(false);
  const availableSections = (index: number) => chapters[index].sections.filter(section => !practice || 'exercise' in section);
  const sections = availableSections(chapterIndex);
  const sectionIndex = Math.max(0, sections.findIndex(section => section.id === selection.id));
  const section = sections[sectionIndex];
  const exerciseSection = 'exercise' in section ? section : null;
  const readingSection = 'content' in section ? section : null;
  const indexSection = 'index' in section ? section : null;
  const flowSection = 'flowchart' in section ? section : null;
  const interaction = practice ? undefined : exerciseSection?.interaction;
  const guided = practice ? undefined : exerciseSection?.guided;

  useEffect(() => {
    // Our own URL writes already selected the section. A history traversal needs a fresh seek.
    if (currentPosition.current.chapterIndex === linkedChapter && currentPosition.current.sectionId === linkedSection) return;
    currentPosition.current = { chapterIndex: linkedChapter, sectionId: linkedSection };
    setChapter(linkedChapter);
    setSelection(previous => ({ id: linkedSection, request: previous.request + 1 }));
    setPractice(false);
  }, [linkedChapter, linkedSection]);

  const select = (index: number, id = chapters[index].sections[0].id) => {
    if (!chapters[index].sections.some(section => 'exercise' in section)) setPractice(false);
    const position = { chapterIndex: index, sectionId: id };
    currentPosition.current = position;
    setChapter(index);
    setSelection(previous => ({ id, request: previous.request + 1 }));
    onNavigate(position, !practice && index !== chapterIndex);
  };
  const adjacentChapter = (direction: -1 | 1) => {
    for (let index = chapterIndex + direction; index >= 0 && index < chapters.length; index += direction) {
      if (availableSections(index).length) return index;
    }
    return -1;
  };
  const previousChapter = adjacentChapter(-1);
  const nextChapter = adjacentChapter(1);
  const previous = sectionIndex > 0 || previousChapter >= 0;
  const next = sectionIndex < sections.length - 1 || nextChapter >= 0;
  const turnPage = (direction: -1 | 1) => {
    const target = sections[sectionIndex + direction];
    if (target) { select(chapterIndex, target.id); return; }
    const index = direction > 0 ? nextChapter : previousChapter;
    if (index < 0) return;
    select(index, availableSections(index).at(direction > 0 ? 0 : -1)?.id);
  };
  const toggleExercise = () => {
    select(chapterIndex, section.id);
    setPractice(value => !value);
  };
  const navigation = chapter.sections.map(item => ({
    id: item.id, label: tr(item.title), active: item.id === section.id,
    onSelect: () => select(chapterIndex, item.id),
  }));

  const selectFromFlow = (chapterId: string, sectionId?: string) => {
    const index = chapters.findIndex(item => item.id === chapterId);
    if (index >= 0) select(index, sectionId);
  };

  const learning = <div className="course-content" data-reading={!!(readingSection || indexSection)} data-questions={!!(interaction || guided)}>
    {readingSection && <section className="course-reading" data-course-reading data-course-section={readingSection.id}
      data-tutorial-layout="E" aria-label={tr(readingSection.title)}>
      <ReadingFit>{readingSection.content}</ReadingFit>
    </section>}
    {indexSection && <section key={indexSection.id} className="course-reading" data-course-reading data-course-section={indexSection.id}
      data-tutorial-layout="E" aria-label={tr(indexSection.title)}>
      {indexSection.index(selectFromFlow)}
    </section>}
    {flowSection && <section className="course-reading course-flow" data-course-section={flowSection.id} data-tutorial-layout="G">
      <TutorialFlowCanvas key={flowSection.id} label={tr(flowSection.title)}>
        {flowSection.flowchart(selectFromFlow)}
      </TutorialFlowCanvas>
    </section>}
    {'demonstration' in section && <div key={section.id} className="course-demonstration">{section.demonstration}</div>}
    {practice && exerciseSection && <Practice key={section.id} section={exerciseSection} puzzle={puzzle} orientation={orientation} />}
    {exerciseSection && interaction && <SectionInteraction key={`${section.id}:${selection.request}`} section={exerciseSection}
      task={interaction} puzzle={puzzle} orientation={orientation} />}
    {exerciseSection && guided && <GuidedLesson key={`${section.id}:${selection.request}`} section={exerciseSection}
      task={guided} puzzle={puzzle} orientation={orientation} />}
    {!practice && exerciseSection?.observation &&
      <Observe key={`${chapter.id}:${section.id}:${selection.request}`} section={exerciseSection} task={exerciseSection.observation}
        puzzle={puzzle} orientation={orientation} />}
    <footer className="course-footer" data-course-footer>
      <button type="button" className="course-control" disabled={!previous} aria-label={tr(labels.previous)} onClick={() => turnPage(-1)}>
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
      {!practice && <div className="course-section-picker">
        <SectionMenu label={tr(section.title)}>
          {navigation.map(item => <button key={item.id} type="button" className="course-section-option" aria-current={item.active ? 'page' : undefined} onClick={item.onSelect}>{item.label}</button>)}
          {basicsHref && <AppLink href={basicsHref} prefetch={false} className="course-section-option">{tr(labels.basics)}</AppLink>}
        </SectionMenu>
      </div>}
      {exerciseSection && <button type="button" className="course-control course-action" onClick={toggleExercise}>{tr(practice ? labels.review : labels.practice)}</button>}
      <button type="button" className="course-control" disabled={!next} aria-label={tr(labels.next)} onClick={() => turnPage(1)}>
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </footer>
  </div>;

  return <main className="tutorial-course" data-practice={practice}>
    <header className="course-header" data-course-header>
      <h1>{tr(title)}</h1>
    </header>
    {!practice && <ChapterNavigation items={chapters.map(item => ({ id: item.id, title: tr(item.title) }))}
      selected={chapterIndex} label={tr(labels.chapters)} onSelect={index => select(index)} />}
    {practice ? learning : <TutorialNavigationShell className="course-navigation" sections={{ items: navigation }}>
      {learning}
    </TutorialNavigationShell>}
  </main>;
}
