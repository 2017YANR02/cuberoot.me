'use client';

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState, type ComponentProps, type ComponentType, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, Lightbulb, RotateCcw } from '@app-foundation/icons/lucide';
import { Color } from 'three';
import { FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import AlgPlayer, { type AlgPlayerHandle, type AlgStickerPlacement } from '@/components/AlgPlayer/AlgPlayer';
import { resolveSimPreviewMoves, type AlgPlayerPuzzle } from '@/components/AlgPlayer/player-setup';
import { animateStickerHint, dimStickerColors } from '@/components/AlgPlayer/sticker-hint-fade';
import AppLink from '@/components/AppLink';
import ChatBubble from '@/components/ChatBubble';
import { ClearButton } from '@/components/ClearButton';
import PageBackLink from '@/components/PageBackLink';
import { Tooltip } from '@/components/Tooltip';
import TrainingFeedbackOverlay from '@/components/TrainingFeedbackOverlay';
import type { BlockedLayerTurnHandler, CubeletTap } from '@/components/sim-embed/attachEmbeddedSimInteraction';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import type { CubeFace } from '@/lib/cube-colors';
import { useModalBackdrop } from '@/hooks/useModalDismiss';
import { useT } from '@/hooks/useT';
import { invertMoveString } from '@cuberoot/shared/alg-notation';
import { tr } from '@/i18n/tr';
import ChapterNavigation from './ChapterNavigation';
import CornerAnswerBubble from './CornerAnswerBubble';
import InteractiveQuestionCopy, {
  InteractiveQuestionHeading, InteractiveQuestionHelpButton, InteractiveQuestionProgress,
} from './InteractiveQuestionCopy';
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
  casesWhenPlaced?: readonly string[];
  describe?: (placement: AlgStickerPlacement) => Text;
  showAnswerHint?: boolean;
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
  | { stage: 'turning'; startCount: number } | { stage: 'changing' };
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
  } & ({ kind: 'faces' } | { kind: 'rotation'; done: Text; solvedStickers: readonly StickerGoal[] });
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
    casesWhenAligned?: Readonly<Partial<Record<number, readonly string[]>>>;
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
    practiceCases?: readonly string[];
  };
};
type CourseInteraction = {
  view: View;
  fixedOrientation?: boolean;
  orbitSnapDegrees?: number;
} & ({
  completion: Text;
  turnExploration: CourseTurnExploration;
  questions?: never;
} | {
  completion?: Text;
  turnExploration?: never;
  questions: readonly [CourseQuestion, ...CourseQuestion[]];
  hintFacelets?: boolean;
  dimStickersAfterFirstQuestion?: readonly string[];
});
type CourseObservation = { view: View; steps: readonly Text[]; stickers?: readonly string[] };
type GuidedStage = { progressLabel: Text; heading: Text; prompt: Text };
type TutorialAlgStep = { notation: string; cue?: Text; detail?: Text };
type TutorialAlg = Pick<CourseTurnExploration['insertion'], 'progressLabel' | 'demoSetup' | 'helpLabel'> & {
  steps: readonly (TutorialAlgStep & { cue: Text })[];
  demoTitle?: Text;
  showHands?: boolean | 'left';
  hideDemoDetail?: boolean;
};
export type GuidedCourseLesson = {
  view: View;
  mutedStickers?: readonly string[];
  Help?: ComponentType;
  hideHelpDuringAlgorithm?: boolean;
  rotationHintStyle?: 'orbit';
  recognition?: GuidedStage & { choices: readonly Text[]; answer: number; explanation: Text };
  alignment?: GuidedStage & {
    axes: readonly ('U' | 'y')[];
    showLeftThumb?: boolean;
    allowTurnsAfterMatch?: boolean;
    matches: (history: readonly string[]) => boolean;
  };
  algorithm: GuidedStage & TutorialAlg & {
    alternatives?: readonly Pick<TutorialAlg, 'steps' | 'demoTitle'>[];
    finishingTurn?: (history: readonly string[]) => TutorialAlg['steps'][number] | undefined;
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
type CourseStageSection = { id: string; title: Text; stage: (select: SelectCourseSection) => ReactNode };
export type CourseFlowSection = {
  id: string;
  title: Text;
  flowchart: (select: SelectCourseSection) => ReactNode;
};
export type CourseChapter = {
  id: string;
  title: Text;
  sections: readonly (CourseSection | ReadingSection | CourseIndexSection | CourseStageSection | CourseFlowSection)[];
};
export type CoursePosition = { chapterIndex: number; sectionId: string };
export type InteractiveTutorialProps = {
  title: Text;
  headerAction?: ReactNode;
  puzzle: AlgPlayerPuzzle;
  orientation?: string;
  chapters: readonly CourseChapter[];
  basicsHref?: string;
  catalogHref?: string;
  location: CoursePosition;
  onNavigate: (position: CoursePosition, chapterChanged: boolean) => void;
};

export const CUBE_FRAMING_EDGE = 380;
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
  catalog: { zh: '返回教程选择', en: 'Back to tutorial selection' },
  basics: { zh: '魔方基础与转动记号', en: 'Cube basics and notation' },
  restart: { zh: '重来', en: 'Restart' },
};

export function LessonPane({ layout, cube, children, captionProps }: {
  layout: 'B' | 'F';
  cube: ReactNode;
  children: ReactNode;
  captionProps?: ComponentProps<'div'>;
}) {
  return <section className="course-stage" data-course-stage data-tutorial-layout={layout}>
    <div className="course-grid" data-course-grid>
      <div className="course-cube-column">{cube}</div>
      <div {...captionProps} className={captionProps?.className ? `course-caption ${captionProps.className}` : 'course-caption'}
        data-course-caption>{children}</div>
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

function randomCase(cases: readonly string[], previous?: string) {
  const alternatives = cases.filter(item => item !== previous);
  const choices = alternatives.length ? alternatives : cases;
  return choices[Math.floor(Math.random() * choices.length)];
}

export function useStickerFade(active: boolean) {
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
  onQuizComplete: () => void;
};

function SectionInteraction(props: InteractionProps) {
  if (props.task.turnExploration) {
    return <TurnExploration {...props} task={props.task} />;
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

export function TutorialAlgDemo({ insertion, puzzle, orientation, view, mutedStickers, stickeringAtStep, stickerColorOverrides, onClose }: {
  insertion: Omit<TutorialAlg, 'helpLabel' | 'steps'> & { steps: readonly TutorialAlgStep[] };
  puzzle: AlgPlayerPuzzle;
  orientation?: string;
  view: View;
  mutedStickers?: readonly string[];
  onClose: () => void;
} & Pick<ComponentProps<typeof AlgPlayer>, 'stickeringAtStep' | 'stickerColorOverrides'>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const player = useRef<AlgPlayerHandle>(null);
  const interacted = useRef(false);
  const titleId = useId();
  const [cubeReady, setCubeReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [playRequest, setPlayRequest] = useState(0);
  const [step, setStep] = useState(0);
  const left = insertion.steps[0]?.notation === "L'";
  const title = insertion.demoTitle ?? (left ? { zh: '左手上勾下回', en: 'Left-hand trigger' } : insertion.progressLabel);
  const describeMove = ({ notation, detail, cue }: TutorialAlgStep, index: number): Text =>
    (insertion.demoTitle ? detail ?? cue : undefined)
    ?? triggerMoveCopy[notation]
    ?? (index === 1 ? { zh: '勾动顶层。', en: 'Hook the top layer.' } : { zh: '把顶层转回去。', en: 'Turn the top layer back.' });
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
              hiddenStickers={mutedStickers} stickeringAtStep={stickeringAtStep} stickerColorOverrides={stickerColorOverrides}
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
            {insertion.steps.map((move, index) => <li key={index} aria-current={step === index + 1 ? 'step' : undefined}>
              <button type="button" className="course-demo-cue" disabled={!ready} onClick={() => {
                interacted.current = true;
                player.current?.playMove?.(index);
              }} aria-label={move.cue ? `${tr(move.cue)} ${move.notation}. ${tr(describeMove(move, index))}` : undefined}>
                {move.cue && <span>{tr(move.cue)}</span>}<code>{move.notation}</code>
              </button>
            </li>)}
          </ol>
          {!insertion.hideDemoDetail && <p className="course-demo-detail" aria-live="polite" aria-atomic="true">
            {tr(current ? describeMove(current, step - 1)
              : { zh: '选择一个动作可以单独播放。', en: 'Select a move to play it on its own.' })}
          </p>}
        </div>
      </div>
    </div>
  </dialog>;
}

function TurnExploration({ section, task, puzzle, orientation, onQuizComplete }: InteractionProps & {
  task: Extract<CourseInteraction, { turnExploration: CourseTurnExploration }>;
}) {
  const [ready, setReady] = useState(false);
  const exploration = task.turnExploration;
  const { opening, alignment, insertion, protectedCorners } = exploration;
  const [quiz, setQuiz] = useState<0 | 1 | 2>(opening ? 0 : 1);
  const [orientationSettled, setOrientationSettled] = useState(false);
  const [inserted, setInserted] = useState(false);
  useEffect(() => { if (inserted) onQuizComplete(); }, [inserted, onQuizComplete]);
  const [attempt, setAttempt] = useState<AlignmentAttempt>({ stage: 'entry', position: null });
  const [hintRequest, setHintRequest] = useState(0);
  const [moves, setMoves] = useState<string[]>([]);
  const [settledMoveCount, setSettledMoveCount] = useState(0);
  const [insertionStart, setInsertionStart] = useState(0);
  const [changingCase, setChangingCase] = useState(false);
  const [practiceCase, setPracticeCase] = useState<{ alg: string; history: readonly string[]; start: number }>();
  const caseTransition = useRef<AbortController | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const closeDemo = useCallback(() => setDemoOpen(false), []);
  const movesRef = useRef<string[]>([]);
  const [blockedTurn, setBlockedTurn] = useState<{ face: string; message: Text; clientX: number; clientY: number } | null>(null);
  const [roundFeedback, setRoundFeedback] = useState<{ count: number; solved: boolean } | null>(null);
  const reportedRounds = useRef(0);
  const board = useRef<HTMLDivElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => {
    clearTimeout(feedbackTimer.current);
    caseTransition.current?.abort();
  }, []);
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
  const reveal = opening && !changingCase && !practiceCase ? fade : 1;
  const aligned = reveal === 1 && attempt.stage === 'complete';
  const canContinueAlignment = aligned && attempt.position !== null
    && alignment.goalPositions.includes(attempt.position.positionIndex);
  const openingComplete = rotating ? orientationSettled
    : exploration.freeFaces.every(({ face }) => tried.has(face));
  const currentComplete = inserting ? inserted : aligning ? canContinueAlignment : openingComplete;
  const steps = opening ? [opening, alignment, insertion] : [alignment, insertion];
  const progressIndex = quiz - (opening ? 0 : 1);
  const insertionMoves = moves.length - insertionStart;
  const insertionStep = insertionMoves % insertion.steps.length;
  const insertionBoundary = inserting && !inserted && insertionMoves > 0 && insertionStep === 0;
  const puzzleHistory = (history: readonly string[]) => practiceCase
    ? [...practiceCase.history, ...history.slice(practiceCase.start)] : history;
  const finishingTurn = insertionBoundary && settledMoveCount !== moves.length && section.exercise.isComplete(puzzleHistory(moves));
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
    if (!ready || !aligning || changingCase || !handle) return;
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
  }, [alignment, ready, aligning, changingCase]);

  useEffect(() => {
    const handle = player.current;
    if (!ready || changingCase || !handle) return;
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
  }, [ready, changingCase, moves.length, inserting, insertionStart, insertion.steps.length, insertion.solvedStickers, rotating, opening]);

  const changeCase = async (cases: readonly string[], nextQuiz: 1 | 2) => {
    const handle = player.current;
    if (!handle?.transitionCubeletCase || caseTransition.current || handle.isUserMovePending?.(false)) return;
    const alg = randomCase(cases, practiceCase?.alg);
    if (!alg) return;
    const start = movesRef.current.length;
    const history = [...puzzleHistory(movesRef.current), alg];
    const transition = new AbortController();
    caseTransition.current = transition;
    setChangingCase(true);
    setRoundFeedback(null);
    try {
      const changed = await handle.transitionCubeletCase(alignment.homeIndex, [section.exercise.setup, ...history].join(' '), transition.signal);
      if (changed && !transition.signal.aborted) {
        setPracticeCase({ alg, history, start });
        setQuiz(nextQuiz);
        setAttempt({ stage: 'entry', position: null });
        setInserted(false);
        reportedRounds.current = 0;
        setInsertionStart(start);
      }
    } finally {
      if (!transition.signal.aborted) {
        caseTransition.current = null;
        setChangingCase(false);
        board.current?.focus({ preventScroll: true });
      }
    }
  };

  const record = (move: string) => {
    if (!move) return;
    clearTimeout(feedbackTimer.current);
    setBlockedTurn(null);
    if (rotating) setOrientationSettled(false);
    movesRef.current = [...movesRef.current, move];
    setMoves(movesRef.current);
  };
  const allowTurn = (move: string) => {
    if (caseTransition.current) return false;
    if (rotating) return /^[xyz](?:[1-9]\d*)?'?$/.test(move);
    if (!inserting) return /^[FURBDL](?:[1-9]\d*)?'?$/.test(move)
      && exploration.freeFaces.some(item => item.face === move[0]);
    const count = movesRef.current.length - insertionStart;
    const index = count % insertion.steps.length;
    const handle = player.current;
    if (demoOpen || move !== insertion.steps[index].notation) return false;
    if (count === 0 || index !== 0 || !handle) return true;
    return handle.isUserMovePending?.(false)
      ? !section.exercise.isComplete(puzzleHistory(movesRef.current))
      : !matchesStickers(handle, insertion.solvedStickers);
  };
  const showBlockedTurn: BlockedLayerTurnHandler = (move, point) => {
    const bounds = board.current?.getBoundingClientRect();
    if (!bounds || !move || finishingTurn || caseTransition.current) return;
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
    if (!ready || inserted || demoOpen || caseTransition.current || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
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
    zh: `下一问用${hand.zh}「上勾下回」让${section.title.zh}归位。`,
    en: `Use the ${hand.en} trigger to solve the ${cornerName} in the next quiz.`,
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
      data-course-cube data-ready={ready} data-drag-enabled={ready && !changingCase} data-move-count={moves.length} data-last-move={moves.at(-1)}>
      <AlgPlayer ref={player} puzzle={puzzle} set="" orientation={orientation} engine="sim" controlMode="none"
        setup={section.exercise.setup} alg="" sceneRot={task.view} interactionMode={inserted || changingCase ? 'view' : 'turn'}
        lockView={changingCase} orbitSnapDegrees={task.orbitSnapDegrees} orbitSnapLocked={!rotating}
        wholeCubeDrag={rotating ? 'rotate-only' : undefined} hintFacelets hiddenStickers={exploration.mutedStickers}
        moveHint={inserting && !inserted && !finishingTurn && !changingCase ? insertion.steps[insertionStep].notation : undefined}
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
          <InteractiveQuestionHeading action={!inserted && !changingCase && (
            <InteractiveQuestionHelpButton video onClick={() => setDemoOpen(true)}>
              {tr(insertion.helpLabel)}
            </InteractiveQuestionHelpButton>
          )}>{tr(inserted ? { zh: `${section.title.zh}归位了！`, en: `${section.title.en} solved!` } : insertion.heading)}</InteractiveQuestionHeading>
          <p>{tr(inserted ? task.completion : insertion.prompt)}</p>
        </div>
        {inserted && insertion.practiceCases && <button type="button" className="btn-secondary course-question-action"
          disabled={changingCase} onClick={() => void changeCase(insertion.practiceCases!, 2)}>{tr({ zh: '再练一次', en: 'Practice again' })}</button>}
        {!inserted && !changingCase && <>
          <code className="course-alg">{insertion.steps.map(({ notation }, index) => <span key={index}
            aria-current={!finishingTurn && insertionStep === index ? 'step' : undefined}>{notation}{index < insertion.steps.length - 1 ? ' ' : ''}</span>)}</code>
          {demoOpen && <TutorialAlgDemo insertion={insertion} puzzle={puzzle} orientation={orientation} view={task.view} onClose={closeDemo} />}
        </>}
      </> : aligning ? <>
        <div aria-live="polite" aria-atomic="true">
          <InteractiveQuestionHeading action={!canContinueAlignment && !changingCase && (
            <InteractiveQuestionHelpButton onClick={() => setHintRequest(request => request + 1)}>
              {tr({ zh: `哪里是${slot.zh}？`, en: `Where is the ${slot.en}?` })}
            </InteractiveQuestionHelpButton>
          )}>{tr(canContinueAlignment ? { zh: '完成，可以继续', en: 'Complete. You can continue.' } : alignment.heading)}</InteractiveQuestionHeading>
          <p>{tr(alignmentPrompt)}</p>
        </div>
        <div className="course-question-status" role="status" aria-atomic="true">
          {attempt.position && reveal === 1 && tr(alignment.describe(attempt.position))}
        </div>
      </> : opening && <>
        <h2>{tr(opening.heading)}</h2>
        <p>{tr(opening.prompt)}</p>
        {opening.kind === 'faces' && <ul className="course-turn-faces" role="list" aria-label={tr({ zh: '自由转动的面', en: 'Faces that turn freely' })}>
          {exploration.freeFaces.map(({ face, label }) => <li key={face} data-face={face} data-tried={tried.has(face)}>
            <Check size={15} aria-hidden={!tried.has(face)} aria-label={tr({ zh: '已尝试', en: 'Tried' })} /><code>{face}</code> {tr(label)}
          </li>)}
        </ul>}
      </>}
      {!inserting && (!aligning || aligned) && <div className="course-question-actions">
        <button type="button" className="btn-primary course-question-action course-question-continue"
          disabled={!ready || changingCase || settledMoveCount !== moves.length || !currentComplete}
          onClick={event => {
            if (player.current?.isUserMovePending?.(false)) return;
            clearTimeout(feedbackTimer.current);
            setBlockedTurn(null);
            const caption = event.currentTarget.closest('[data-course-caption]');
            if (caption) caption.scrollTop = 0;
            const handle = player.current;
            if ((aligning || rotating) && insertion.practiceCases && handle && matchesStickers(handle, insertion.solvedStickers)) {
              void changeCase(insertion.practiceCases, 2);
              return;
            }
            if (aligning) setInsertionStart(movesRef.current.length);
            else {
              const position = handle?.getStickerPlacement?.(alignment.homeIndex, alignment.homeFace) ?? null;
              const cases = position && alignment.casesWhenAligned?.[position.positionIndex];
              if (cases?.length) {
                void changeCase(cases, 1);
                return;
              }
              const stage = !position ? 'entry' : alignment.goalPositions.includes(position.positionIndex) ? 'move-away' : 'place';
              setAttempt({ stage, position });
            }
            setQuiz(aligning ? 2 : 1);
            board.current?.focus({ preventScroll: true });
          }}>
          {tr({ zh: '继续', en: 'Continue' })}
        </button>
      </div>}
      {rotating && <div className="course-question-status course-question-opening-status" role="status" aria-atomic="true">
        <span aria-hidden={!openingComplete}>{tr(opening.done)}</span>
      </div>}
    </div>
  </LessonPane>;
}

function InteractiveQuestions({ section, task, puzzle, orientation, onQuizComplete }: InteractionProps & { task: Extract<CourseInteraction, { questions: readonly CourseQuestion[] }> }) {
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
  const placementTransition = useRef<AbortController | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => {
    clearTimeout(feedbackTimer.current);
    placementTransition.current?.abort();
  }, []);
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
    if (hintRequests.piece) return animateStickerHint(setPieceHintOpacity);
  }, [hintRequests.piece]);

  const dimStickers = task.dimStickersAfterFirstQuestion;
  const permanentFade = useStickerFade(questionIndex > 0 && !!dimStickers?.length);
  const stickerFade = Math.max(permanentFade, pieceHintOpacity);
  const stickerColorOverrides = useMemo(() => {
    if (!dimStickers || !stickerFade) return undefined;
    return dimStickerColors(dimStickers, orientation ?? '', stickerFade);
  }, [dimStickers, orientation, stickerFade]);

  const question = task.questions.at(questionIndex);
  const placement = question?.kind === 'placement' ? question : null;
  const slotHintIndex = question?.showAnswerHint && question.kind !== 'piece'
    ? question.kind === 'placement' ? question.goal.positionIndex : question.targetIndex
    : undefined;
  const cornerSlotHint = useMemo(() => slotHintIndex !== undefined && hintRequests.position
    ? { positions: [slotHintIndex], request: hintRequests.position, color: TUTORIAL_STICKER_PURPLE, includeBackFacelets: true }
    : undefined, [slotHintIndex, hintRequests.position]);
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
  const reorienting = placementProgress.stage === 'turning' || placementProgress.stage === 'changing';
  const needsReorientation = placement && placementProgress.stage === 'offer';
  const placed = placement && placementProgress.stage === 'practice'
    && moves.length > placementProgress.startCount && matchesPlacement(currentPlacement, placement.goal);
  useEffect(() => {
    if (placed) flashFeedback({ kind: 'correct' });
  }, [placed, flashFeedback]);
  const completed = !question || placed;
  useEffect(() => { if (completed) onQuizComplete(); }, [completed, onQuizComplete]);
  const hintKind = question?.kind === 'piece' ? 'piece' : 'position';
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
    if (nextQuestion?.kind === 'placement') {
      const handle = player.current;
      const pose = handle?.getStickerPlacement?.(nextQuestion.homeIndex, nextQuestion.homeFace) ?? null;
      setCurrentPlacement(pose);
      const atGoal = matchesPlacement(pose, nextQuestion.goal);
      const alg = atGoal && nextQuestion.casesWhenPlaced && randomCase(nextQuestion.casesWhenPlaced);
      if (alg && handle?.transitionCubeletCase && !handle.isUserMovePending?.(false)) {
        const transition = new AbortController();
        placementTransition.current = transition;
        setPlacementProgress({ stage: 'changing' });
        void handle.transitionCubeletCase(nextQuestion.homeIndex, [section.exercise.setup, ...moves, alg].join(' '), transition.signal)
          .then(changed => {
            if (transition.signal.aborted) return;
            placementTransition.current = null;
            setPlacementProgress(changed ? { stage: 'practice', startCount: moves.length } : { stage: 'offer' });
          });
      } else {
        setPlacementProgress(atGoal ? { stage: 'offer' } : { stage: 'practice', startCount: moves.length });
      }
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
        lockView={reorienting} orbitSnapLocked={task.fixedOrientation || needsReorientation || reorienting}
        hintFacelets={task.hintFacelets} maxFramingEdge={CUBE_FRAMING_EDGE}
        stickerColorOverrides={stickerColorOverrides} cornerSlotHint={cornerSlotHint}
        onCubeletTap={pick} onUserMove={move => {
          setMoves(previous => [...previous, move]);
          // A rotation started during identification can finish after Continue.
          if (placement && placementProgress.stage === 'offer') {
            setPlacementProgress({ stage: 'practice', startCount: moves.length + 1 });
          }
        }}
        onReady={() => setReady(true)} hideResetView fillPane />
      <div className="course-answer-feedback" role="status" aria-atomic="true">
        {wrong && <CornerAnswerBubble clientX={wrong.clientX} clientY={wrong.clientY}
          message={tr({ zh: `你选的是「${wrong.choice.zh}」。再试一次。`, en: `You chose ${wrong.choice.en}. Try again.` })} />}
      </div>
      <TrainingFeedbackOverlay kind={feedback?.kind === 'correct' && (!placement || placed) ? 'correct' : null}
        correctLabel={placement ? completedTitle : tr({ zh: '选对了！', en: 'Correct!' })} wrongLabel="" />
    </div>
  }>
    <InteractiveQuestionCopy sectionId={section.id} questions={task.questions} activeIndex={questionIndex} answer={answer}
      heading={completed ? completedTitle : tr(question.heading)}
      headingAction={!completed && !selectionConfirmed && !needsReorientation && !reorienting && question?.showAnswerHint
        ? <InteractiveQuestionHelpButton disabled={!ready}
          onClick={() => setHintRequests(previous => ({ ...previous, [hintKind]: previous[hintKind] + 1 }))}>
          {tr({ zh: '提示', en: 'Hint' })}
        </InteractiveQuestionHelpButton>
        : null}
      prompt={prompt && tr(prompt)}
      action={selectionConfirmed
        ? <button type="button" className="btn-primary course-question-action course-question-continue" onClick={continueQuestion}>
          {tr({ zh: '继续', en: 'Continue' })}
        </button>
        : (needsReorientation || placementProgress.stage === 'turning') ? <button type="button" className="btn-primary course-question-action"
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

function GuidedLesson({ section, task, puzzle, orientation, onQuizComplete }: {
  section: CourseSection;
  task: GuidedCourseLesson;
  puzzle: AlgPlayerPuzzle;
  orientation?: string;
  onQuizComplete: () => void;
}) {
  const { recognition, alignment, Help } = task;
  const [algorithm, setAlgorithm] = useState(task.algorithm);
  const [stage, setStage] = useState<'recognize' | 'align' | 'alg'>(recognition ? 'recognize' : alignment ? 'align' : 'alg');
  const [choice, setChoice] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState<GuidedTurn>({ index: 0 });
  const [settledHistory, setSettledHistory] = useState<readonly string[] | null>(null);
  const [feedback, setFeedback] = useState<{ point?: Pick<CubeletTap, 'clientX' | 'clientY'> } | null>(null);
  const [demo, setDemo] = useState<TutorialAlg | null>(null);
  const player = useRef<AlgPlayerHandle>(null);
  const board = useRef<HTMLDivElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const accepted = useRef({ history, cursor });
  const recognizing = stage === 'recognize' ? recognition : undefined;
  const preparing = stage === 'align' ? alignment : undefined;
  const revisableAlignment = preparing?.allowTurnsAfterMatch === true;
  const applying = stage === 'alg';
  const recognized = choice === recognizing?.answer;
  const settled = settledHistory === history;
  const matches = preparing?.matches(history) || (applying && cursor.index === algorithm.steps.length && section.exercise.isComplete(history));
  const current = algorithm.steps[cursor.index];
  const nextMove = cursor.half ?? current?.notation;
  const canTurnTop = preparing?.axes.includes('U') === true;
  const canRotateSideways = preparing?.axes.includes('y') === true;
  const formulaRotation = applying && !!nextMove && /^[xyz]/.test(nextMove);
  const canRotate = (canRotateSideways || formulaRotation) && (!settled || revisableAlignment);
  const steps = [recognition, alignment, algorithm].filter(step => step !== undefined);
  const question = recognizing ?? preparing ?? algorithm;
  const activeIndex = steps.indexOf(question);
  const feedbackMessage = feedback ? tr(canTurnTop && canRotateSideways
    ? { zh: '这一步只转 U 面，或做 y 方向转体', en: 'Turn only the U face or rotate the cube around the y-axis' }
    : canTurnTop
      ? { zh: '这一步只转 U 面', en: 'Turn only the U face' }
      : canRotateSideways
        ? { zh: '这一步只做左右转体', en: 'Only rotate the whole cube left or right' }
        : { zh: `这一步做 ${nextMove}`, en: `Do ${nextMove} for this move` }) : undefined;

  useEffect(() => () => clearTimeout(feedbackTimer.current), []);
  useEffect(() => {
    const handle = player.current;
    if (!ready || !matches || !handle) return;
    const update = () => {
      if (accepted.current.history === history && !handle.isUserMovePending?.(!!preparing?.showLeftThumb)) {
        setSettledHistory(history);
      }
    };
    update();
    return handle.subscribeRenderedView?.(update);
  }, [ready, matches, history, preparing?.showLeftThumb]);

  const allowTurn = (move: string) => {
    const state = accepted.current;
    if (demo || (settled && !revisableAlignment)) return false;
    if (preparing) {
      const allowed = (canTurnTop && /^U\d*'?$/.test(move)) || (canRotateSideways && /^y\d*'?$/.test(move));
      return allowed && (revisableAlignment || !preparing.matches(state.history));
    }
    return applying && !!advanceGuidedTurn(state.cursor, algorithm.steps[state.cursor.index]?.notation, move);
  };
  const clearFeedback = () => {
    clearTimeout(feedbackTimer.current);
    setFeedback(null);
  };
  const showBlockedTurn: BlockedLayerTurnHandler = (_move, point) => {
    setFeedback({ point });
    if (revisableAlignment) {
      clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setFeedback(null), ERROR_FEEDBACK_MS);
    }
  };
  const record = (move: string) => {
    if (!move || !allowTurn(move)) return;
    const state = accepted.current;
    const next = applying ? advanceGuidedTurn(state.cursor, algorithm.steps[state.cursor.index]?.notation, move)! : state.cursor;
    const history = [...state.history, move];
    accepted.current = { history, cursor: next };
    setHistory(history);
    setCursor(next);
    clearFeedback();
  };
  const keyInput = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase();
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || !/^[urfdblxyz]$/.test(key)) return;
    const move = /^[xyz]$/.test(key) ? key : key.toUpperCase();
    if (player.current?.applyUserMove?.(event.shiftKey ? `${move}'` : move)) event.preventDefault();
  };
  const nextQuestion = () => {
    if (revisableAlignment && (settledHistory !== accepted.current.history || player.current?.isUserMovePending?.())) return;
    if (preparing && algorithm.finishingTurn) {
      const history = accepted.current.history;
      const turn = algorithm.finishingTurn(history);
      if (turn) setAlgorithm({ ...algorithm, steps: [...algorithm.steps, turn],
        demoSetup: [section.exercise.setup, ...history].join(' ') });
    }
    setStage(stage === 'recognize' && alignment ? 'align' : 'alg');
    setSettledHistory(null);
    clearFeedback();
    board.current?.focus({ preventScroll: true });
  };
  const done = recognizing ? recognized : settled;
  const completion = settled && applying;
  useEffect(() => { if (completion) onQuizComplete(); }, [completion, onQuizComplete]);
  const hasConceptHelp = Help && !(applying && task.hideHelpDuringAlgorithm);
  const hasAlgorithmHelp = applying && !completion;
  return <LessonPane layout="F" cube={
    <div ref={board} className="course-cube" role="group" tabIndex={0} aria-label={tr(section.title)} onKeyDown={keyInput}
      data-course-cube data-ready={ready} data-drag-enabled={ready} data-move-count={history.length} data-last-move={history.at(-1)}>
      <AlgPlayer ref={player} puzzle={puzzle} set="" orientation={orientation} engine="sim" controlMode="none"
        setup={section.exercise.setup} alg="" sceneRot={task.view} interactionMode={recognizing || (settled && !revisableAlignment) ? 'view' : 'turn'}
        hiddenStickers={task.mutedStickers}
        showHands={alignment?.showLeftThumb ? 'left-thumb' : undefined} handsVisible={!!preparing?.showLeftThumb}
        holdReferenceThumb={!!preparing?.showLeftThumb && matches}
        orbitSnapDegrees={30} orbitSnapLocked={!canRotate}
        wholeCubeDrag={canRotate ? (canTurnTop ? 'rotate' : 'rotate-only') : undefined}
        hintFacelets moveHint={applying && !settled ? nextMove : undefined} maxFramingEdge={CUBE_FRAMING_EDGE}
        moveHintStyle={formulaRotation ? task.rotationHintStyle : undefined}
        allowUserLayerTurn={allowTurn} onBlockedUserLayerTurn={showBlockedTurn} onUserMove={record}
        onReady={() => setReady(true)} hideResetView fillPane />
      {revisableAlignment && <div className="course-answer-feedback" data-turn-feedback role="status" aria-atomic="true">
        {feedbackMessage && (feedback?.point
          ? <CornerAnswerBubble {...feedback.point} message={feedbackMessage} />
          : <ChatBubble tail="bottom" className="course-answer-bubble course-turn-hint-bubble" data-course-turn-hint>
            {feedbackMessage}
          </ChatBubble>)}
      </div>}
    </div>
  }>
    <InteractiveQuestionCopy sectionId={section.id} questions={steps} activeIndex={activeIndex} answer={done ? 'correct' : 'pending'}
      heading={tr(completion ? labels.completed : settled && preparing && !canRotateSideways
        ? { zh: '摆到位了', en: 'Aligned' } : question.heading)}
      headingAction={(hasConceptHelp || hasAlgorithmHelp) && <>
        {hasAlgorithmHelp && <InteractiveQuestionHelpButton video onClick={() => setDemo(algorithm)}>
          {tr(algorithm.helpLabel)}
        </InteractiveQuestionHelpButton>}
        {hasConceptHelp && <Help />}
        {hasAlgorithmHelp && algorithm.alternatives?.map(alternative => {
          const notation = alternative.steps.map(move => move.notation).join(' ');
          return <InteractiveQuestionHelpButton key={notation} video
            aria-label={`${tr({ zh: '演示备选公式', en: 'Watch alternative' })} ${notation}`}
            onClick={() => setDemo({ ...algorithm, ...alternative })}><code>{notation}</code></InteractiveQuestionHelpButton>;
        })}
      </>}
      prompt={tr(completion ? task.completion : recognized && recognizing ? recognizing.explanation : question.prompt)}
      status={!revisableAlignment && !done ? feedbackMessage : undefined}
      action={<>
        {recognizing && !recognized && <div className="course-question-actions">
          {recognizing.choices.map((label, index) => <button type="button" key={label.en} className="btn-secondary course-question-action"
            aria-pressed={choice === index} disabled={!ready} onClick={() => setChoice(index)}>{tr(label)}</button>)}
          {choice !== null && <p className="course-question-status" role="status">{tr({ zh: '再观察一下魔方。', en: 'Take another look at the cube.' })}</p>}
        </div>}
        {(done || revisableAlignment) && !applying && <button type="button" className="btn-primary course-question-action course-question-continue"
          onClick={nextQuestion} disabled={!done}>
          {tr({ zh: '继续', en: 'Continue' })}
        </button>}
        {applying && canRotate && nextMove && nextMove[0] !== 'x' && <button type="button" className="btn-secondary course-question-action"
          onClick={() => {
            if (player.current?.applyUserMove?.(nextMove)) board.current?.focus({ preventScroll: true });
          }}>{tr({ zh: `转体 ${nextMove}`, en: `Rotate ${nextMove}` })}</button>}
        {applying && !completion && <>
          <code className="course-alg">{algorithm.steps.map(({ notation }, index) => <span key={index}
            aria-current={index === cursor.index ? 'step' : undefined}>{notation}</span>)}</code>
          {demo && <TutorialAlgDemo insertion={demo} puzzle={puzzle} orientation={orientation} view={task.view}
            mutedStickers={task.mutedStickers} onClose={() => setDemo(null)} />}
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
          moveHintStyle={hint && /^[xyz]/.test(hint) ? section.guided?.rotationHintStyle : undefined}
          hiddenStickers={section.guided?.mutedStickers}
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

function UnfinishedQuizDialog({ onDismiss, onSkip }: { onDismiss: () => void; onSkip: () => void }) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const dismiss = () => {
    dialog.current?.close();
    onDismiss();
  };
  const backdrop = useModalBackdrop(dismiss);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="course-demo-dialog course-skip-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); dismiss(); }} {...backdrop}>
    <div className="course-demo-panel" data-site-surface="popover">
      <h2 id={titleId}>{t('本节还没学完', 'This section is unfinished')}</h2>
      <p id={descriptionId}>{t('本节还有题目没完成。要跳到下一节吗？', 'There are still questions to finish here. Skip to the next section?')}</p>
      <div className="course-skip-actions">
        <button type="button" className="btn-primary course-skip-action" onClick={dismiss}>{t('继续学习', 'Keep learning')}</button>
        <button type="button" className="btn-secondary course-skip-action" onClick={() => { dismiss(); onSkip(); }}>
          {t('跳到下一节', 'Skip to next section')}
        </button>
      </div>
    </div>
  </dialog>;
}

export default function InteractiveTutorial({ title, headerAction, puzzle, orientation, chapters, basicsHref, catalogHref, location, onNavigate }: InteractiveTutorialProps) {
  const t = useT();
  const { chapterIndex: linkedChapter, sectionId: linkedSection } = location;
  const [chapterIndex, setChapter] = useState(linkedChapter);
  const chapter = chapters[chapterIndex];
  const [selection, setSelection] = useState({ id: linkedSection, request: 0 });
  const [skipRequest, setSkipRequest] = useState<number | null>(null);
  const completedRequest = useRef(-1);
  const onQuizComplete = useCallback(() => {
    completedRequest.current = Math.max(completedRequest.current, selection.request);
  }, [selection.request]);
  const currentPosition = useRef(location);
  const [practice, setPractice] = useState(false);
  const availableSections = (index: number) => chapters[index].sections.filter(section => !practice || 'exercise' in section);
  const sections = availableSections(chapterIndex);
  const sectionIndex = Math.max(0, sections.findIndex(section => section.id === selection.id));
  const section = sections[sectionIndex];
  const exerciseSection = 'exercise' in section ? section : null;
  const readingSection = 'content' in section ? section : null;
  const indexSection = 'index' in section ? section : null;
  const stageSection = 'stage' in section ? section : null;
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
  const requestNext = () => {
    if ((interaction || guided) && completedRequest.current !== selection.request) {
      setSkipRequest(selection.request);
      return;
    }
    turnPage(1);
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

  const learning = <div className="course-content" data-reading={!!(readingSection || indexSection)}
    data-questions={!!(interaction || guided || stageSection)}>
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
    {stageSection && <Fragment key={stageSection.id}>{stageSection.stage(selectFromFlow)}</Fragment>}
    {practice && exerciseSection && <Practice key={section.id} section={exerciseSection} puzzle={puzzle} orientation={orientation} />}
    {exerciseSection && interaction && <SectionInteraction key={`${section.id}:${selection.request}`} section={exerciseSection}
      task={interaction} puzzle={puzzle} orientation={orientation} onQuizComplete={onQuizComplete} />}
    {exerciseSection && guided && <GuidedLesson key={`${section.id}:${selection.request}`} section={exerciseSection}
      task={guided} puzzle={puzzle} orientation={orientation} onQuizComplete={onQuizComplete} />}
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
      <button type="button" className="course-control" disabled={!next} aria-label={tr(labels.next)} onClick={requestNext}>
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </footer>
    {skipRequest === selection.request && <UnfinishedQuizDialog onDismiss={() => setSkipRequest(null)} onSkip={() => turnPage(1)} />}
  </div>;

  const catalogLabel = t(labels.catalog.zh, labels.catalog.en);
  return <main className="tutorial-course" data-practice={practice}>
    <header className="course-header" data-course-header>
      {catalogHref && <Tooltip content={catalogLabel}>{trigger =>
        <PageBackLink {...trigger} className="course-back-link" fallback={catalogHref} label={catalogLabel}
          acceptEntry={entry => entry.replace(/^\/(?:en|zh)(?=\/)/, '') === catalogHref} />
      }</Tooltip>}
      <h1>{tr(title)}</h1>
      {headerAction}
    </header>
    {!practice && <ChapterNavigation items={chapters.map(item => ({ id: item.id, title: tr(item.title) }))}
      selected={chapterIndex} label={tr(labels.chapters)} onSelect={index => select(index)} />}
    {practice ? learning : <TutorialNavigationShell className="course-navigation" sections={{ items: navigation }}>
      {learning}
    </TutorialNavigationShell>}
  </main>;
}
