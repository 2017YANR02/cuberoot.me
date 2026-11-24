'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check } from '@app-foundation/icons/lucide';
import { Axis } from '@cuberoot/visualcube';
import { FM_FIXED_COLOR, FM_IGNORED, FM_REGULAR } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import AlgPlayer, { type AlgPlayerHandle, type AlgStickerPlacement } from '@/components/AlgPlayer/AlgPlayer';
import SettingsDialog from '@/components/SettingsDialog';
import TrainingFeedbackOverlay from '@/components/TrainingFeedbackOverlay';
import { VisualCube } from '@/components/VisualCube';
import type { BlockedLayerTurnHandler } from '@/components/sim-embed/attachEmbeddedSimInteraction';
import { T, tr } from '@/i18n/tr';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import CornerAnswerBubble from '../components/CornerAnswerBubble';
import InteractiveQuestionCopy, { InteractiveQuestionHelpButton } from '../components/InteractiveQuestionCopy';
import { CUBE_FRAMING_EDGE, LessonPane } from '../components/InteractiveTutorial';
import AlignmentVideo, { alignmentVideoLabel } from './AlignmentVideo';
import { TwistRecognitionVideo, twistVideoLabel } from './RecognitionVideo';
import {
  FL_CASES, FL_GROUPS, FL_LAST_STICKERS, FL_TWISTS,
  FL_VIEWS, FL_WGO_HOME, FL_WRG_HOME, flAlignedTwist, flFirstLayerMask, flPalette, flRecognitionGroup,
  flSectionHeading, flSectionId, flTwistFromStickerFace, isFlPracticeTurn, randomFlAlignmentRound, randomFlFourthCornerSetup, randomFlTwistQuizSetup,
  type FlChapter, type FlTwist,
} from './lesson-data';

const questions = [
  { progressLabel: { zh: '摆第三角块', en: 'Place corner 3' } },
  { progressLabel: { zh: '摆第四角块', en: 'Place corner 4' } },
  { progressLabel: { zh: '选公式组', en: 'Choose a group' } },
];

const toTopLeft = { zh: '把第三角块摆到顶层左前', en: 'Place corner 3 at top front-left' };
const toBottomRight = { zh: '把第三角块摆到底层右前', en: 'Place corner 3 at bottom front-right' };
const liftFourth = { zh: '把第四角块提到顶层右前或右后', en: 'Lift corner 4 to top front-right or top back-right' };
const stackFourth = { zh: '第四角块在顶层，把它摆到第三角块正上方（UD）', en: 'Corner 4 is on top. Line it up directly above corner 3 (UD).' };
const openingView = (chapter: FlChapter) => chapter === 'top' ? FL_VIEWS.top : FL_VIEWS.mixed;
const thirdPlacedTitle = { zh: '第三角块摆对了！', en: 'Corner 3 is in place!' };
const placedTitle = { zh: '摆对了！', en: 'Placed correctly!' };
const placedCopy = {
  top: { zh: '第三角块在顶层左前，第四角块也在顶层', en: 'Corner 3 is at top front-left, and corner 4 is also on top.' },
  mixed: { zh: '第三角块在底层右前，第四角块在它正上方（UD）', en: 'Corner 3 is at bottom front-right, with corner 4 directly above it (UD).' },
  bottom: { zh: '第三、第四角块都在底层右侧（DD）', en: 'Corners 3 and 4 are both on the bottom right (DD).' },
};

type AlignmentProps = { chapter: FlChapter; orientation: string; onSelect: (twist: FlTwist) => void };
type AlignmentStep = 0 | 1 | 2;

export default function AlignmentExercise({ chapter, orientation, onSelect }: AlignmentProps) {
  const [demo, setDemo] = useState<'third' | 'fourth' | 'twist'>();
  const [round, setRound] = useState<(ReturnType<typeof randomFlAlignmentRound> & { revision: number })>();
  const [activeIndex, setActiveIndex] = useState<AlignmentStep>(0);
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setRound({ ...randomFlAlignmentRound(chapter), revision: 0 });
  }, [chapter]);

  if (!round) return <LessonPane layout="F" cube={null}>{null}</LessonPane>;
  const resetPractice = (step: AlignmentStep, twist?: FlTwist) => {
    const revision = round.revision + 1;
    if (step === 0) {
      setRound({ ...randomFlAlignmentRound(chapter, round.pose), revision });
    } else if (twist) {
      const setup = step === 1 ? randomFlFourthCornerSetup(chapter, twist) : randomFlTwistQuizSetup(chapter, twist);
      setRound({ ...round, setup, revision });
    }
  };
  const continueStep = (thirdTwist?: FlTwist) => {
    if (activeIndex === 0) {
      if (!thirdTwist) return;
      resetPractice(1, thirdTwist);
      setActiveIndex(1);
    } else {
      setActiveIndex(2);
    }
  };
  return <>
    <AlignmentRound key={round.revision} chapter={chapter} orientation={orientation} setup={round.setup} videoOpen={!!demo}
      activeIndex={activeIndex} onContinue={continueStep} onRetry={twist => resetPractice(activeIndex, twist)} onSelect={onSelect}
      onWatch={() => setDemo(activeIndex === 0 ? 'third' : activeIndex === 1 ? 'fourth' : 'twist')} />
    {demo === 'twist' && <SettingsDialog label={tr(twistVideoLabel)} heading panelClassName="fl-walkthrough-dialog"
      onClose={() => setDemo(undefined)}>
      <TwistRecognitionVideo chapter={chapter} orientation={orientation} />
    </SettingsDialog>}
    {demo && demo !== 'twist' && <SettingsDialog label={tr(alignmentVideoLabel)} heading panelClassName="fl-walkthrough-dialog"
      onClose={() => setDemo(undefined)}>
      <AlignmentVideo chapter={chapter} corner={demo} orientation={orientation} />
    </SettingsDialog>}
  </>;
}

const topFrontLeft = 6;
const bottomFrontRight = 5;
const mutedFourthCorner = Object.fromEntries(FL_LAST_STICKERS
  .map(sticker => [sticker, FM_FIXED_COLOR[FM_IGNORED]!]));

function AlignmentRound({ chapter, orientation, setup, videoOpen, activeIndex, onContinue, onRetry, onSelect, onWatch }: AlignmentProps & {
  setup: string;
  videoOpen: boolean;
  activeIndex: AlignmentStep;
  onContinue: (thirdTwist?: FlTwist) => void;
  onRetry: (twist?: FlTwist) => void;
  onWatch: () => void;
}) {
  const player = useRef<AlgPlayerHandle>(null);
  const board = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [turning, setTurning] = useState(false);
  const [corners, setCorners] = useState<{ third: AlgStickerPlacement; fourth: number }>();
  const [feedback, setFeedback] = useState<'wrong' | 'correct'>();
  const [blockedPoint, setBlockedPoint] = useState<Parameters<BlockedLayerTurnHandler>[1]>();
  const [lastMove, setLastMove] = useState<string>();
  const placingThird = activeIndex === 0;
  const recognizing = activeIndex === 2;
  const top = chapter === 'top';
  const thirdInPlace = corners?.third.positionIndex === (top ? topFrontLeft : bottomFrontRight);
  const group = corners && flRecognitionGroup(corners.third.positionIndex, corners.fourth);
  const twist = group && corners && flAlignedTwist(group, corners.third, corners.fourth);
  const placed = !turning && (placingThird ? thirdInPlace : !recognizing && Boolean(twist));
  const face = !corners || recognizing ? null : placingThird ? (top ? 'U' : 'R') : (top ? 'R' : 'U');
  const faceColors = useMemo(() => orientedCubeFaceColors(orientation), [orientation]);
  const palette = flPalette(orientation);
  const bottom = palette.color('D');
  const groupReferenceColors = useMemo(() => stageStickerColors(2,
    home => home === FL_WRG_HOME ? FM_REGULAR : FM_IGNORED, faceColors), [faceColors]);

  useEffect(() => {
    const handle = player.current;
    if (!ready || !handle) return;
    const readPositions = (queuedMoves: number) => {
      setTurning(queuedMoves > 0);
      if (queuedMoves) return;
      const third = handle.getStickerPlacement?.(FL_WRG_HOME, 'D');
      const fourth = handle.getStickerPlacement?.(FL_WGO_HOME, 'D');
      if (third && fourth) setCorners({ third, fourth: fourth.positionIndex });
      setFeedback(undefined);
    };
    readPositions(0);
    return handle.subscribeSettledCube?.(readPositions);
  }, [ready]);

  useEffect(() => {
    if (ready && recognizing && !top) player.current?.setSceneRotation?.(FL_VIEWS.bottom);
  }, [ready, recognizing, top]);

  useEffect(() => {
    if (!blockedPoint) return;
    const timer = setTimeout(() => setBlockedPoint(undefined), 2400);
    return () => clearTimeout(timer);
  }, [blockedPoint]);

  const allowTurn = (move: string) => face !== null && isFlPracticeTurn(move, face);
  const showBlockedTurn: BlockedLayerTurnHandler = (_move, point) => {
    if (!face) return;
    const bounds = board.current?.getBoundingClientRect();
    if (bounds) setBlockedPoint(point ?? { clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2 });
  };
  const turnWithKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.key.toUpperCase() !== face) return;
    const handle = player.current;
    if (!handle || handle.isUserMovePending?.(false)) return;
    event.preventDefault();
    handle.applyUserMove?.(event.shiftKey ? face + "'" : face);
  };

  const thirdPlacedCopy = top
    ? { zh: '第三角块已在顶层左前', en: 'Corner 3 is now at top front-left.' }
    : { zh: '第三角块已在底层右前', en: 'Corner 3 is now at bottom front-right.' };
  const thirdPrompt = placed ? thirdPlacedCopy : top ? toTopLeft : toBottomRight;
  const fourthPrompt = placed && group ? placedCopy[group] : top ? liftFourth : stackFourth;
  const chooseTwist = {
    zh: '看第三角块的' + bottom.zh + '格朝哪个方向',
    en: 'Which way does the ' + bottom.en + ' sticker on corner 3 face?',
  };
  const messages = {
    wrong: { zh: '再对照一下第三角块的底色朝向', en: 'Compare the bottom-color sticker on corner 3 again' },
    correct: { zh: '选对了，进组后看第四角块找公式', en: 'Correct. Use corner 4 to match the case in this group.' },
  };
  const answer = placed ? 'correct' : feedback ?? 'pending';
  const resultLabel = group && group !== 'top' ? FL_GROUPS[group].code : undefined;
  const successHeading = placingThird ? thirdPlacedTitle : placedTitle;
  const heading = recognizing ? { zh: '选 0、+ 或 −', en: 'Choose 0, + or −' }
    : placed ? successHeading : questions[activeIndex].progressLabel;
  const prompt = recognizing ? chooseTwist : placingThird ? thirdPrompt : fourthPrompt;
  const status = feedback ? messages[feedback] : lastMove && face && !placed && !turning
    ? { zh: '还没摆到目标位置', en: 'The corner is still out of place' }
    : null;

  const turnHint = face && tr({ zh: `这一步只转 ${face} 面`, en: `Turn only the ${face} face on this step` });

  return <LessonPane layout="F" captionProps={{ className: 'fl-alignment-caption' }} cube={<div ref={board} className="course-cube fl-alignment-cube" role="group" tabIndex={0}
    aria-label={tr({ zh: '摆位魔方。拖贴纸转层，拖空白微调视角', en: 'Alignment cube. Drag stickers to turn, or drag empty space to adjust the view.' })}
    data-course-cube data-canvas-texture data-ready={ready} data-drag-enabled={!!face} data-alignment-video-open={videoOpen || undefined}
    data-last-move={lastMove} onKeyDown={turnWithKey}>
    <AlgPlayer ref={player} puzzle="2x2" engine="sim" set="" setup={setup} alg="" orientation={orientation}
      sceneRot={openingView(chapter)} controlMode="none" interactionMode="turn" fillPane hideResetView
      maxFramingEdge={CUBE_FRAMING_EDGE} stickeringAtStep={flFirstLayerMask}
      orbitSnapDegrees={30} orbitSnapLocked stickerColorOverrides={placingThird ? mutedFourthCorner : undefined}
      allowUserLayerTurn={allowTurn}
      onBlockedUserLayerTurn={showBlockedTurn}
      onUserMove={move => {
        if (move) setLastMove(move);
        setTurning(player.current?.isUserMovePending?.(false) === true);
        setFeedback(undefined);
        setBlockedPoint(undefined);
      }}
      onReady={() => setReady(true)} />
    <div className="course-answer-feedback" data-turn-feedback role="status" aria-atomic="true">
      {blockedPoint && turnHint && <CornerAnswerBubble {...blockedPoint} message={turnHint} />}
    </div>
    <TrainingFeedbackOverlay key={activeIndex} kind={placed ? 'correct' : null} correctLabel={tr(successHeading)} wrongLabel="" />
  </div>}>
    <InteractiveQuestionCopy sectionId={chapter + '-alignment'} questions={questions} activeIndex={activeIndex}
      answer={answer} heading={tr(heading)}
      headingAction={<InteractiveQuestionHelpButton video onClick={onWatch}>
        {recognizing ? <T zh="如何识别" en="How to recognize" /> : <T {...alignmentVideoLabel} />}
      </InteractiveQuestionHelpButton>}
      prompt={tr(prompt)}
      status={status && tr(status)}
      action={<>
        {recognizing && twist && group && <div className="fl-twist-choices">
          {FL_TWISTS.map(choice => {
            const item = FL_CASES[group].find(item => item.sectionId === flSectionId(group, choice))!;
            const correct = answer === 'correct' && choice === twist;
            return <button type="button" key={choice.id} className="btn-secondary fl-twist-choice"
              onClick={() => setFeedback(choice === twist ? 'correct' : 'wrong')}>
              <VisualCube local puzzleSize={2} size={52} setup={item.setup} alt="" view={top ? 'plan' : 'iso'}
                viewportRotations={top ? undefined : [[Axis.Y, 30], [Axis.X, 29]]}
                stickerColors={groupReferenceColors} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]} />
              <span><T {...flSectionHeading(chapter, choice, palette)} />{correct && <Check size={14} aria-hidden="true" />}</span>
            </button>;
          })}
        </div>}
        <div className="course-question-actions">
          {recognizing && twist && answer === 'correct' && <button type="button" className="btn-primary course-question-action" onClick={() => onSelect(twist)}>
            <T zh={'查看 ' + twist.symbol + ' 组公式'} en={'See group ' + twist.symbol + ' algorithms'} />
            {resultLabel ? ' · ' + resultLabel : null}
          </button>}
          {placed && <button type="button" className="btn-primary course-question-action course-question-continue"
            onClick={() => {
              setLastMove(undefined);
              setBlockedPoint(undefined);
              onContinue(corners && flTwistFromStickerFace(chapter, corners.third.face));
            }}>
            <T zh="继续" en="Continue" />
          </button>}
          {(placed || (recognizing && twist)) && <button type="button" className="btn-secondary course-question-action"
            onClick={() => onRetry(twist)}><T zh="再练一次" en="Practice again" /></button>}
        </div>
      </>} />
  </LessonPane>;
}
