'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react';
import { Check, Play } from '@app-foundation/icons/lucide';
import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import { engineHomeSid } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { animateStickerHint, dimStickerColors } from '@/components/AlgPlayer/sticker-hint-fade';
import SettingsDialog from '@/components/SettingsDialog';
import TrainingFeedbackOverlay, { type TrainingFeedbackKind } from '@/components/TrainingFeedbackOverlay';
import type { BlockedLayerTurnHandler, CubeletTap } from '@/components/sim-embed/attachEmbeddedSimInteraction';
import { T, tr } from '@/i18n/tr';
import CornerAnswerBubble from '../components/CornerAnswerBubble';
import InteractiveQuestionCopy, { InteractiveQuestionHelpButton } from '../components/InteractiveQuestionCopy';
import { CUBE_FRAMING_EDGE, LessonPane, TutorialAlgDemo } from '../components/InteractiveTutorial';
import { FL_LAST_STICKERS, FL_REFERENCE_STICKERS, FL_VIEWS, FL_WGO_HOME, FL_WRG_HOME, flCornerLayer, flFirstLayerMask, flPalette, isFlPracticeTurn, randomFlLayerQuizSetup } from './lesson-data';
import { FL_LEFT_BACK, FL_LEFT_FRONT, FL_LEFT_PAIR_GOAL, flCornerPairState, randomFlCornerQuizSetup, randomFlLeftPairSetup, solveFlLeftPair } from './left-pair';
import RecognitionVideo, { CornerIdentificationVideo } from './RecognitionVideo';

const mutedRightPair = Object.fromEntries([...FL_REFERENCE_STICKERS, ...FL_LAST_STICKERS]
  .map(sticker => [sticker, FM_FIXED_COLOR[FM_IGNORED]!]));
// Top-layer pieces are already gray in the first-layer mask.
const leftPairHintStickers = [
  ...[FACE.D, FACE.B, FACE.L].map(face => engineHomeSid(FL_LEFT_BACK, face, 2)),
  ...[FACE.D, FACE.F, FACE.L].map(face => engineHomeSid(FL_LEFT_FRONT, face, 2)),
];
const thirdCornerHintStickers = [...leftPairHintStickers, ...FL_LAST_STICKERS];
const fourthCornerHintStickers = [...leftPairHintStickers, ...FL_REFERENCE_STICKERS];
const pairHeading = { zh: '复原左侧角对', en: 'Solve the left pair' };
const videoLabels = {
  corners: { zh: '第三、第四角块', en: 'The third and fourth corners' },
  layer: { zh: '识别视频', en: 'Recognition video' },
};
type VideoKind = keyof typeof videoLabels;
const questions = [
  { progressLabel: { zh: '左侧角对', en: 'Left pair' } },
  { progressLabel: { zh: '辨认角块', en: 'Find the corners' } },
  { progressLabel: { zh: '判断层位', en: 'Identify the layer' } },
];
const cornerQuestions = [
  { homeIndex: FL_WRG_HOME, heading: { zh: '找出第三角块', en: 'Find the third corner' },
    prompt: { zh: '点选要归位到底层右前的角块', en: 'Select the piece that belongs at bottom front-right' } },
  { homeIndex: FL_WGO_HOME, heading: { zh: '找出第四角块', en: 'Find the fourth corner' },
    prompt: { zh: '点选要归位到底层右后的角块', en: 'Select the piece that belongs at bottom back-right' } },
];
const layerChoices = [
  { layer: 'U', label: { zh: '顶层', en: 'Top layer' } },
  { layer: 'D', label: { zh: '底层', en: 'Bottom layer' } },
] as const;
type Layer = ReturnType<typeof flCornerLayer>;
type LayerAnswer = { status: 'pending' | 'wrong' | 'retry' } | { status: 'correct'; layer: Layer };
const layerFeedback = {
  pending: null,
  correct: { zh: '判断正确', en: 'Correct' },
  wrong: { zh: '再看看这个角块当前在哪一层', en: 'Check which layer the corner is on now' },
  retry: { zh: '盘面已转动，请重新作答', en: 'The cube has moved. Answer again.' },
};

function RecognitionSteps({ setup, orientation, cornerGuideOpen, onRandomize, onWatchVideo }: {
  setup: string;
  orientation: string;
  cornerGuideOpen: boolean;
  onRandomize: () => void;
  onWatchVideo: (kind: VideoKind) => void;
}) {
  const board = useRef<HTMLDivElement>(null);
  const player = useRef<AlgPlayerHandle>(null);
  const userMoves = useRef<string[]>([]);
  const [ready, setReady] = useState(false);
  const [turning, setTurning] = useState(false);
  const [hintDemo, setHintDemo] = useState<ComponentProps<typeof TutorialAlgDemo>['insertion'] | null>(null);
  const [pairState, setPairState] = useState<number | null>(null);
  const [recognitionSetup, setRecognitionSetup] = useState<string | null>(null);
  const [identifiedCount, setIdentifiedCount] = useState(0);
  const [cornerFeedback, setCornerFeedback] = useState<{ kind: TrainingFeedbackKind } | null>(null);
  const [layerQuiz, setLayerQuiz] = useState(false);
  const [pieceHintRequest, setPieceHintRequest] = useState(0);
  const [pieceHintOpacity, setPieceHintOpacity] = useState(0);
  const [layerAnswer, setLayerAnswer] = useState<LayerAnswer>({ status: 'pending' });
  const [blockedTurn, setBlockedTurn] = useState<{ clientX: number; clientY: number } | null>(null);
  const recognizing = recognitionSetup !== null;
  const identifying = recognizing && !layerQuiz;
  const cornerQuestion = cornerQuestions[identifiedCount];
  const cornersIdentified = identifiedCount === cornerQuestions.length;
  const canFindAgain = identifying && cornersIdentified;
  const hintStickers = identifying && cornerQuestion?.homeIndex === FL_WGO_HOME
    ? fourthCornerHintStickers : thirdCornerHintStickers;
  const pairComplete = pairState === FL_LEFT_PAIR_GOAL;
  const { color, backLeft, frontLeft, reference } = flPalette(orientation);
  const bottom = color('D');

  const recognitionHintColors = useMemo(() => pieceHintOpacity
    ? dimStickerColors(hintStickers, orientation, pieceHintOpacity) : undefined, [hintStickers, orientation, pieceHintOpacity]);

  useEffect(() => {
    if (pieceHintRequest) return animateStickerHint(setPieceHintOpacity);
  }, [pieceHintRequest]);

  useEffect(() => {
    const handle = player.current;
    if (!ready || !handle) return;
    const readPositions = (queuedMoves: number) => {
      setTurning(queuedMoves > 0);
      if (recognizing) return;
      const back = handle.getStickerPlacement?.(FL_LEFT_BACK, 'D');
      const front = handle.getStickerPlacement?.(FL_LEFT_FRONT, 'D');
      if (back && front) setPairState(flCornerPairState(back, front));
    };
    readPositions(handle.isUserMovePending?.(false) ? 1 : 0);
    return handle.subscribeSettledCube?.(readPositions);
  }, [ready, recognizing]);

  useEffect(() => {
    if (!blockedTurn) return;
    const timer = setTimeout(() => setBlockedTurn(null), 2400);
    return () => clearTimeout(timer);
  }, [blockedTurn]);

  useEffect(() => {
    if (!cornerFeedback) return;
    const timer = setTimeout(() => setCornerFeedback(null), 800);
    return () => clearTimeout(timer);
  }, [cornerFeedback]);

  const openHint = () => {
    if (pairState === null || pairComplete || player.current?.isUserMovePending?.(false)) return;
    setHintDemo({
      demoTitle: pairHeading,
      progressLabel: questions[0].progressLabel,
      demoSetup: [setup, ...userMoves.current].join(' '),
      hideDemoDetail: true,
      steps: solveFlLeftPair(pairState).map(notation => ({ notation })),
    });
  };

  const turnWithKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || !/^[rludfbxyz]$/i.test(event.key)) return;
    const handle = player.current;
    if (!handle || handle.isUserMovePending?.(false)) return;
    const key = event.key.toLowerCase();
    const move = 'xyz'.includes(key) ? key : key.toUpperCase();
    const turn = event.shiftKey ? `${move}'` : move;
    if (handle.applyUserMove?.(turn)) event.preventDefault();
  };

  const showBlockedTurn: BlockedLayerTurnHandler = (_move, point) => {
    const bounds = board.current?.getBoundingClientRect();
    if (!bounds) return;
    setBlockedTurn({
      clientX: point?.clientX ?? bounds.left + bounds.width / 2,
      clientY: point?.clientY ?? bounds.top + bounds.height / 2,
    });
  };

  const continueToRecognition = () => {
    if (!pairComplete || player.current?.isUserMovePending?.(false)) return;
    setReady(false);
    setRecognitionSetup(randomFlLayerQuizSetup());
  };

  const findAgain = () => {
    const handle = player.current;
    const third = handle?.getStickerPlacement?.(FL_WRG_HOME, 'D');
    const fourth = handle?.getStickerPlacement?.(FL_WGO_HOME, 'D');
    if (!third || !fourth) return;
    const nextSetup = randomFlCornerQuizSetup(flCornerPairState(third, fourth));
    setReady(false);
    setRecognitionSetup(nextSetup);
    setIdentifiedCount(0);
    setCornerFeedback(null);
    setPieceHintRequest(0);
    setPieceHintOpacity(0);
  };

  const identifyCorner = (homeIndex: CubeletTap['homeIndex']) => {
    if (!ready || !identifying || !cornerQuestion) return;
    const correct = homeIndex === cornerQuestion.homeIndex;
    setCornerFeedback({ kind: correct ? 'correct' : 'wrong' });
    if (correct) {
      setPieceHintRequest(0);
      setPieceHintOpacity(0);
      setIdentifiedCount(identifiedCount + 1);
    }
  };

  const chooseLayer = (layer: Layer) => {
    const handle = player.current;
    if (!handle || handle.isUserMovePending?.(false)) return;
    const placement = handle.getStickerPlacement?.(FL_WRG_HOME, 'D');
    if (placement) setLayerAnswer(flCornerLayer(placement.positionIndex) === layer
      ? { status: 'correct', layer } : { status: 'wrong' });
  };
  const feedback = layerQuiz ? layerFeedback[layerAnswer.status]
    : identifying ? null : pairComplete ? { zh: '两个角都已归位', en: 'Both corners are solved' } : null;
  const answer = layerQuiz ? layerAnswer.status === 'retry' ? 'pending' : layerAnswer.status
    : identifying ? cornersIdentified ? 'correct' : cornerFeedback?.kind === 'wrong' ? 'wrong' : 'pending'
    : pairComplete ? 'correct' : 'pending';
  const correctLayer = layerAnswer.status === 'correct' ? layerAnswer.layer : null;
  const heading = layerQuiz ? { zh: '第三角块在哪一层？', en: 'Which layer is the third corner on?' }
    : identifying ? cornerQuestion?.heading ?? { zh: '第三、第四角块都找到了', en: 'You found both corners' }
    : pairHeading;
  const prompt = layerQuiz ? {
    zh: `第三角块是${reference.zh}。看它当前在顶层还是底层`,
    en: `The third corner is the ${reference.en}. Check which layer it is on now.`,
  } : identifying ? cornerQuestion?.prompt : {
    zh: `把${backLeft.zh}放到底层左后，${frontLeft.zh}放到底层左前，两个${bottom.zh}格都朝下`,
    en: `Place the ${backLeft.en} at bottom back-left and the ${frontLeft.en} at bottom front-left, with both ${bottom.en} stickers facing down`,
  };
  const cubeLabel = layerQuiz
    ? { zh: '左侧角对已归位的魔方。可转 U、R 面，拖空白可微调视角', en: 'Cube with the left pair solved. Turn U or R, or drag empty space to adjust the view slightly.' }
    : identifying
      ? { zh: '点选角块。拖动可微调视角', en: 'Select a corner. Drag to adjust the view slightly.' }
      : { zh: '识别魔方。拖贴纸转层，拖空白转视角。', en: 'Recognition cube. Drag stickers to turn layers and drag empty space to orbit.' };

  return <LessonPane layout="F" cube={
    <div ref={board} className="course-cube" tabIndex={identifying ? undefined : 0} role="group"
      aria-label={tr(cubeLabel)} data-course-cube data-ready={ready} data-drag-enabled={ready}
      data-corner-guide-open={cornerGuideOpen || undefined}
      onKeyDown={identifying ? undefined : turnWithKey}>
      <AlgPlayer key={recognitionSetup ?? 'left-pair'} ref={player} puzzle="2x2" engine="sim" set=""
        setup={recognitionSetup ?? setup} alg=""
        orientation={orientation} sceneRot={FL_VIEWS.mixed}
        controlMode="none" interactionMode={identifying ? 'view' : 'turn'} fillPane maxFramingEdge={CUBE_FRAMING_EDGE}
        hideResetView
        stickeringAtStep={flFirstLayerMask} wholeCubeDrag={recognizing ? undefined : 'rotate'}
        orbitSnapDegrees={30} orbitSnapLocked={recognizing}
        stickerColorOverrides={recognizing ? recognitionHintColors : mutedRightPair}
        allowUserLayerTurn={layerQuiz ? isFlPracticeTurn : undefined}
        onBlockedUserLayerTurn={layerQuiz ? showBlockedTurn : undefined}
        onCubeletTap={identifying ? ({ homeIndex }) => identifyCorner(homeIndex) : undefined}
        onUserMove={move => {
          if (layerQuiz) {
            setBlockedTurn(null);
            setLayerAnswer(previous => previous.status === 'correct' || previous.status === 'wrong'
              ? { status: 'retry' } : previous);
          } else if (!recognizing) userMoves.current.push(move);
          setTurning(player.current?.isUserMovePending?.(false) === true);
        }}
        onReady={() => setReady(true)} />
      {identifying && <TrainingFeedbackOverlay kind={cornerFeedback?.kind ?? null}
        correctLabel={tr({ zh: '找对了', en: 'Correct' })}
        wrongLabel={tr({ zh: '再看一下这个角块要归位到哪里', en: 'Check where this corner belongs' })} />}
      {layerQuiz && <div className="course-answer-feedback" data-turn-feedback role="status" aria-atomic="true">
        {blockedTurn && <CornerAnswerBubble {...blockedTurn}
          message={tr({ zh: '为了保护左下方角块，只转 U、R 面', en: 'Turn only U and R to keep the bottom-left corners solved' })} />}
      </div>}
    </div>
  }>
    <InteractiveQuestionCopy sectionId="recognition" questions={questions} activeIndex={layerQuiz ? 2 : identifying ? 1 : 0}
      answer={answer} heading={tr(heading)}
      headingAction={recognizing && <InteractiveQuestionHelpButton disabled={!ready}
        onClick={canFindAgain ? findAgain : () => setPieceHintRequest(request => request + 1)}>
        {canFindAgain ? <T zh="再找一次" en="Find again" /> : <T zh="提示" en="Hint" />}
      </InteractiveQuestionHelpButton>}
      prompt={prompt && tr(prompt)}
      hint={layerQuiz ? tr({ zh: '可转 U、R 面观察，转动后请重新作答', en: 'You can turn U or R to inspect the cube. Answer again after turning.' }) : undefined}
      reserveStatus status={feedback ? tr(feedback) : null}
      action={<>
        <div className="course-question-actions">
          {layerQuiz ? <>
            {layerChoices.map(({ layer, label }) => (
              <button type="button" key={layer} className="btn-secondary course-question-action fl-layer-choice"
                disabled={!ready || turning} onClick={() => chooseLayer(layer)}>
                <T {...label} />
                {correctLayer === layer && <Check size={15} aria-hidden="true" />}
              </button>
            ))}
            <button type="button" className="btn-secondary course-question-action fl-watch-recognition"
              aria-haspopup="dialog" onClick={() => onWatchVideo('layer')}>
              <Play size={15} aria-hidden="true" />
              <T zh="观看识别视频" en="Watch the recognition video" />
            </button>
          </> : identifying ? <>
            <button type="button" className="btn-primary course-question-action course-question-continue"
              disabled={!cornersIdentified} onClick={() => {
                setCornerFeedback(null);
                setLayerQuiz(true);
              }}>
              <T zh="继续" en="Continue" />
            </button>
            <button type="button" className="btn-secondary course-question-action fl-watch-recognition"
              aria-haspopup="dialog" onClick={() => onWatchVideo('corners')}>
              <Play size={15} aria-hidden="true" />
              <T zh="观看角块讲解" en="Watch the corner guide" />
            </button>
          </> : <>
            <button type="button" className="btn-primary course-question-action course-question-continue"
              disabled={!pairComplete || turning} onClick={continueToRecognition}>
              <T zh="继续" en="Continue" />
            </button>
            <button type="button" className="btn-secondary course-question-action" aria-haspopup="dialog"
              disabled={pairState === null || turning || pairComplete} onClick={openHint}>
              <T zh="提示" en="Hint" />
            </button>
            <button type="button" className="btn-secondary course-question-action" onClick={onRandomize}>
              <T zh="重新随机" en="Randomize again" />
            </button>
          </>}
        </div>
        {hintDemo && <TutorialAlgDemo insertion={hintDemo} puzzle="2x2" orientation={orientation} view={FL_VIEWS.mixed}
          stickeringAtStep={flFirstLayerMask} stickerColorOverrides={mutedRightPair} onClose={() => setHintDemo(null)} />}
      </>} />
  </LessonPane>;
}

export default function RecognitionLesson({ orientation }: { orientation: string }) {
  const [round, setRound] = useState<{ setup: string; revision: number } | null>(null);
  const [video, setVideo] = useState<VideoKind | null>(null);
  const initialized = useRef(false);
  const randomize = useCallback(() => {
    const setup = randomFlLeftPairSetup();
    setRound(previous => ({ setup, revision: (previous?.revision ?? 0) + 1 }));
  }, []);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    randomize();
  }, [randomize]);

  if (!round) return <LessonPane layout="F" cube={null}>{null}</LessonPane>;
  return <>
    <RecognitionSteps key={round.revision} setup={round.setup} orientation={orientation} cornerGuideOpen={video === 'corners'}
      onRandomize={randomize} onWatchVideo={setVideo} />
    {video && <SettingsDialog label={tr(videoLabels[video])} heading panelClassName="fl-walkthrough-dialog"
      onClose={() => setVideo(null)}>
      {video === 'corners' ? <CornerIdentificationVideo orientation={orientation} /> : <RecognitionVideo orientation={orientation} />}
    </SettingsDialog>}
  </>;
}
