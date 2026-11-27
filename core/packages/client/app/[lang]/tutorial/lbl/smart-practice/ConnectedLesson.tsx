'use client';

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ArrowRight, CircleHelp, LoaderCircle, RotateCcw } from '@app-foundation/icons/lucide';
import { invertAlg } from '@cuberoot/shared/alg-transform';
import { anchorAlgFor, LiveSmartCubeAnchor, type LiveSmartCubeAnchorSnapshot } from '@cuberoot/shared/smart-cube/anchor';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import type { Quat } from '@cuberoot/shared/smart-cube/orientation';
import { createSmartCubeGuidanceController, type SmartCubeGuidanceState } from '@cuberoot/shared/smart-cube/scramble-guidance';
import { smartCubeFixupState } from '@cuberoot/shared/smart-cube/scramble-hint';
import { orientedFaceColors } from '@cuberoot/shared/timer';
import { TimerScrambleHintText } from '@cuberoot/timer-ui';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import TrainingFeedbackOverlay from '@/components/TrainingFeedbackOverlay';
import Link from '@/components/AppLink';
import { T, tr } from '@/i18n/tr';
import { CUBE_COLOR_NAMES } from '@/lib/cube-colors';
import PracticeReferenceSheet from '../../components/PracticeReferenceSheet';
import { LBL_INITIAL_VIEW, LBL_STEPS } from '../content';
import { LBL_LESSON_STAGE_IDS, type LblLessonStageId } from '../lesson-runs';
import type { YellowCrossCase } from '../yellow-cross-demo-state';
import { buildLessonGuide, lessonCanStart, lessonFormulaHint, lessonMoveHint, lessonRotationPending, lessonStart, observeLessonTurn, PRACTICE_GRIP, type LessonAction, type LessonGuide, type LessonProgress, type PracticeCubeMove } from './lesson-guide';
import type { LessonRotationTracker } from './lesson-rotation';
import { firstLessonSetupStart, type LessonSetupPlan, type LessonSetupRequest } from './lesson-setup';
import { PracticeCube, PracticeWorkspace } from './PracticeWorkspace';
import VirtualTurnPad, { type VirtualCubeControls } from './VirtualTurnPad';

const solve333: ConstructorParameters<typeof LiveSmartCubeAnchor>[0]['solve'] =
  async state => (await import('@/lib/kociemba/random_state')).solve333(state);
const EMPTY_ANCHOR: LiveSmartCubeAnchorSnapshot = { moves: [], algAnchored: false };
type Screen = 'intro' | 'setup' | 'planning' | 'lesson';
type RunningLesson = { guide: LessonGuide; progress: LessonProgress; finish?: { anchor: LiveSmartCubeAnchorSnapshot; pose: string } };

export default function ConnectedLesson({ stage, variant, requestedCase, facelets, moves, gyro, brand, rotationTracker, calibrationRevision, onNext, virtual }: {
  stage: LblLessonStageId;
  variant: number;
  requestedCase?: YellowCrossCase;
  facelets: string;
  moves: RefObject<PracticeCubeMove | null>;
  gyro?: RefObject<((quat: Quat) => void) | null>;
  brand?: string;
  rotationTracker: LessonRotationTracker;
  calibrationRevision: number;
  onNext: (stage: LblLessonStageId) => void;
  virtual?: VirtualCubeControls;
}) {
  const [screen, setScreen] = useState<Screen>('intro');
  const [repeat, setRepeat] = useState(0);
  const [excludedStart, setExcludedStart] = useState<string>();
  const [anchor, setAnchor] = useState(EMPTY_ANCHOR);
  const [setupHint, setSetupHint] = useState<SmartCubeGuidanceState>();
  const [setupPlan, setSetupPlan] = useState<LessonSetupPlan>();
  const [setupRetry, setSetupRetry] = useState(0);
  const [running, setRunning] = useState<RunningLesson>();
  const [confirmedRotation, setConfirmedRotation] = useState<{ step: LessonAction; revision: number }>();
  const [planError, setPlanError] = useState(false);
  const [help, setHelp] = useState(false);
  const latest = useRef(facelets);
  const lesson = useRef<RunningLesson | undefined>(undefined);
  const setupController = useRef<ReturnType<typeof createSmartCubeGuidanceController> | null>(null);
  const preset = useMemo(() => {
    const candidate = lessonStart(stage, variant + repeat, requestedCase);
    return candidate.facelets === excludedStart ? lessonStart(stage, variant + repeat + 1, requestedCase) : candidate;
  }, [stage, variant, repeat, requestedCase, excludedStart]);
  const startEligible = useCallback((value: string) => value !== excludedStart && lessonCanStart(stage, value, requestedCase),
    [excludedStart, stage, requestedCase]);
  const setupReady = screen === 'setup' && startEligible(facelets);
  const commitLesson = useCallback((next: RunningLesson | undefined) => {
    lesson.current = next;
    setRunning(next);
  }, []);
  const checkRotation = useEffectEvent((quat?: Quat) => {
    const current = lesson.current;
    const step = screen === 'lesson' && current && !current.finish ? current.guide.actions[current.progress.index] : undefined;
    const now = performance.now();
    const confirmed = quat ? rotationTracker.observe(quat, now, step, brand) : rotationTracker.confirm(step, now);
    if (confirmed && step) {
      setConfirmedRotation({ step, revision: calibrationRevision });
    }
    return rotationTracker.confirmationAt(step);
  });
  useLayoutEffect(() => {
    if (!gyro) return;
    let confirmationTimer: number | undefined;
    gyro.current = quat => {
      const deadline = checkRotation(quat);
      window.clearTimeout(confirmationTimer);
      if (deadline !== undefined) {
        confirmationTimer = window.setTimeout(() => checkRotation(), Math.max(0, Math.ceil(deadline - performance.now())));
      }
    };
    return () => {
      window.clearTimeout(confirmationTimer);
      gyro.current = null;
    };
  }, [gyro]);
  const onState = useEffectEvent((value: string, move: string | undefined, snapshot: LiveSmartCubeAnchorSnapshot) => {
    latest.current = value;
    if (screen === 'setup') {
      if (startEligible(value) || (value === setupPlan?.facelets && setupPlan.prerequisite)) {
        setSetupHint(undefined);
        setSetupPlan(undefined);
      } else if (move) setupController.current?.observe(value, move);
      else setupController.current?.syncFacelets(value);
    }
    const current = lesson.current;
    if (screen !== 'lesson' || !current || current.finish) return;
    const next = observeLessonTurn(current.guide, current.progress, value, move);
    if (next === current.progress) return;
    commitLesson({
      ...current, progress: next,
      finish: next.index === current.guide.actions.length
        ? { anchor: snapshot, pose: current.guide.actions[current.progress.index]?.pose ?? PRACTICE_GRIP }
        : undefined,
    });
  });
  const sync = useRef<((value: string) => void) | null>(null);
  useLayoutEffect(() => {
    const mirror = new LiveSmartCubeAnchor({ solve: solve333, onChange: setAnchor });
    mirror.setConnection('lbl-smart-lesson');
    const receive = (value: string, move?: string) => {
      mirror.observeFacelets(value);
      onState(value, move, mirror.getSnapshot());
    };
    sync.current = receive;
    moves.current = (move, timestamp, value) => {
      mirror.move(move, timestamp);
      receive(value, move);
    };
    return () => {
      moves.current = null;
      sync.current = null;
      mirror.setConnection(null);
    };
  }, [moves]);
  useEffect(() => { sync.current?.(facelets); }, [facelets]);

  useEffect(() => {
    if (screen !== 'setup' || setupReady || setupPlan) return;
    const source = latest.current;
    if (startEligible(source)) return;
    if (!anchor.algAnchored || smartCubeTargetFacelets(anchor.moves.join(' ')) !== source) return;
    const fallback = () => setSetupPlan({ source, facelets: preset.facelets });
    let worker: Worker;
    try {
      worker = new Worker(new URL('./lesson-setup.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      fallback();
      return;
    }
    worker.onmessage = ({ data }: MessageEvent<LessonSetupPlan | null>) => {
      if (latest.current !== source) return;
      if (data) setSetupPlan(data);
      else fallback();
    };
    worker.onerror = () => { if (latest.current === source) fallback(); };
    worker.postMessage({ stage, source, opening: anchor.moves, requestedCase, excluded: excludedStart } satisfies LessonSetupRequest);
    return () => worker.terminate();
  }, [anchor, excludedStart, preset, requestedCase, screen, setupPlan, setupReady, setupRetry, stage, startEligible]);

  useEffect(() => {
    if (screen !== 'setup' || setupReady || !setupPlan) return;
    const { facelets: targetFacelets, source, deviceAlg } = setupPlan;
    const controller = createSmartCubeGuidanceController({
      onChange: setSetupHint,
      solve: async (from, target) => {
        if (from === source && target === targetFacelets && deviceAlg) return deviceAlg;
        const cube = smartCubeFixupState(from, target);
        if (!cube) return null;
        const alg = await solve333(cube);
        return firstLessonSetupStart(from, alg, startEligible)?.deviceAlg ?? alg;
      },
    });
    setupController.current = controller;
    controller.setConnected(true);
    controller.setContext({ id: stage, scramble: '', targetFacelets, orientation: PRACTICE_GRIP });
    controller.syncFacelets(latest.current);
    return () => {
      controller.dispose();
      setupController.current = null;
    };
  }, [screen, setupPlan, setupReady, stage, startEligible]);

  useEffect(() => {
    if (screen !== 'planning' || planError) return;
    const start = latest.current;
    const opening = start === preset.facelets ? preset.deviceAlg.split(' ') : anchor.algAnchored
      && smartCubeTargetFacelets(anchor.moves.join(' ')) === start ? anchor.moves : null;
    if (!startEligible(start)) {
      setSetupHint(undefined);
      setSetupPlan(undefined);
      setScreen('setup');
      return;
    }
    if (!opening) return;
    try {
      const guide = buildLessonGuide(stage, start, opening);
      commitLesson({ guide, progress: { index: 0, facelets: start, wrongTurns: [] } });
      setScreen('lesson');
    } catch {
      setPlanError(true);
    }
  }, [anchor, commitLesson, facelets, planError, preset, screen, stage, startEligible]);

  useEffect(() => {
    const finish = running?.finish;
    if (!finish || finish.anchor.algAnchored) return;
    let active = true;
    void anchorAlgFor(running.progress.facelets, solve333).then(turns => {
      if (active && turns && lesson.current === running) {
        commitLesson({ ...running, finish: { ...finish, anchor: { moves: turns, algAnchored: true } } });
      }
    });
    return () => { active = false; };
  }, [commitLesson, running]);

  const action = running?.guide.actions[running.progress.index];
  const finished = !!running?.finish;
  const progressing = screen === 'lesson' && action && running && !finished;
  const repairing = Boolean(progressing && (running.progress.wrongTurns?.length || running.progress.wrongTurns === null));
  const pose = running?.finish?.pose ?? (progressing ? action.pose : PRACTICE_GRIP);
  const rotationConfirmed = progressing && action === confirmedRotation?.step && confirmedRotation.revision === calibrationRevision;
  const rotation = progressing && lessonRotationPending(action, running.progress, Boolean(rotationConfirmed)) ? action.rotation : undefined;
  const displayPose = rotation ? `${pose} ${invertAlg(rotation)}` : pose;
  const setupTurn = setupReady ? undefined : setupHint?.hint?.corrections?.[0] ?? setupHint?.hint?.current ?? undefined;
  const layerHint = screen === 'setup' ? setupTurn : progressing ? lessonMoveHint(action, running.progress) : undefined;
  const moveHint = rotation ?? layerHint;
  const displayAnchor = running?.finish?.anchor ?? anchor;
  const livePosition = useMemo(() => displayAnchor.algAnchored
    ? { turns: displayAnchor.moves.join(' '), pose: displayPose } : undefined, [displayAnchor, displayPose]);
  const liveOrientation = gyro ? rotationTracker.liveOrientation : undefined;
  const presetPosition = useMemo(() => ({ turns: preset.deviceAlg, pose: PRACTICE_GRIP }), [preset.deviceAlg]);
  const canSkipSetup = screen === 'intro' && startEligible(facelets);
  const nextStage = LBL_LESSON_STAGE_IDS[LBL_LESSON_STAGE_IDS.indexOf(stage) + 1];
  const stageInfo = LBL_STEPS.find(step => step.id === stage)!;
  const exerciseTitle = requestedCase ? stageInfo.examples[variant]?.title : undefined;
  const prerequisiteTitle = LBL_STEPS.find(step => step.id === setupPlan?.prerequisite)?.title;
  const restart = (practice: boolean) => {
    if (practice) setRepeat(value => value + 1);
    setExcludedStart(practice ? latest.current : undefined);
    setSetupHint(undefined);
    setSetupPlan(undefined);
    setPlanError(false);
    setConfirmedRotation(undefined);
    commitLesson(undefined);
    setScreen('intro');
  };
  const continueLesson = () => {
    rotationTracker.start(performance.now());
    setScreen(startEligible(latest.current) ? 'planning' : 'setup');
  };
  const setupCorrection = screen === 'setup' && !setupReady && Boolean(setupHint?.hint?.corrections?.length);
  const lessonHint = progressing ? lessonFormulaHint(action, Boolean(rotation), repairing ? layerHint : undefined) : null;
  const strip = screen === 'setup' ? (setupReady ? null : setupHint?.hint) : lessonHint;
  const totalMoves = strip ? strip.done.length + Number(Boolean(strip.current)) + strip.pending.length : 0;
  const virtualPad = virtual && <VirtualTurnPad onReset={virtual.onReset} onTurn={move => virtual.onTurn(move, pose)} moveHint={layerHint} helpOpen={help} />;

  if (screen === 'intro') {
    const compare = requestedCase && !canSkipSetup;
    const visual = compare ? <div className="lbl-smart-comparison">
      <figure><div className="lbl-smart-preview"><PracticeCube position={livePosition} liveOrientation={liveOrientation} /></div><figcaption><T zh="当前状态" en="Current state" /></figcaption></figure>
      <ArrowRight size={20} aria-hidden="true" />
      <figure><div className="lbl-smart-preview"><PracticeCube position={presetPosition} /></div><figcaption><T zh="起始示例" en="Example starting state" /></figcaption></figure>
    </div> : <figure className="lbl-smart-live">
      <div className="lbl-smart-cube"><PracticeCube position={livePosition} liveOrientation={liveOrientation} /></div>
      <figcaption><T zh="当前状态" en="Current state" /></figcaption>
    </figure>;
    return <PracticeWorkspace phase="prepare" visual={visual} tools={virtualPad} actions={<button className="lbl-smart-action lbl-smart-action--primary" type="button" onClick={continueLesson}>
      {canSkipSetup ? <T zh="开始练习" en="Start practice" /> : <T zh="开始摆题" en="Start setup" />}<ArrowRight size={17} aria-hidden="true" />
    </button>}>
      {exerciseTitle && <p className="lbl-smart-context">{tr(exerciseTitle)}</p>}
      <h2>{tr(stageInfo.title)}</h2>
      <p>{canSkipSetup ? <T zh="你的魔方已经可以开始本阶段。" en="Your cube is ready for this stage." />
        : <T zh="跟着屏幕指引，把手上的魔方转到可开练的状态。" en="Follow the guide to bring your cube to a suitable starting state." />}</p>
      <p className="lbl-smart-grip"><T zh="开始时黄心朝上，绿心朝前。" en="Start with the yellow center on top and the green center facing you." /></p>
    </PracticeWorkspace>;
  }

  const visual = <figure className="lbl-smart-live">
    <div className="lbl-smart-cube">
      <PracticeCube position={livePosition} liveOrientation={liveOrientation} moveHint={rotation?.split(' ')[0] ?? layerHint}
        moveHintStyle={rotation ? 'orbit' : undefined} recovery={repairing || setupCorrection} />
      <TrainingFeedbackOverlay kind={finished ? 'correct' : null} correctLabel={tr({ zh: '本阶段完成', en: 'Stage complete' })} wrongLabel="" />
    </div>
    <figcaption><span className="lbl-smart-live-dot" aria-hidden="true" />{virtual ? <T zh="虚拟魔方" en="Virtual cube" /> : <T zh="真机状态" en="Live cube" />}</figcaption>
  </figure>;
  const actions = finished ? <>
    {nextStage && <button type="button" className="lbl-smart-action lbl-smart-action--primary" onClick={() => onNext(nextStage)}><T zh="下一阶段" en="Next stage" /><ArrowRight size={17} aria-hidden="true" /></button>}
    <button type="button" className="lbl-smart-action" onClick={() => restart(false)}><RotateCcw size={16} aria-hidden="true" /><T zh="再学一次" en="Repeat lesson" /></button>
    <button type="button" className="lbl-smart-action" onClick={() => restart(true)}><T zh="换个状态练习" en="Practice a new setup" /></button>
  </> : setupReady ? <button type="button" className="lbl-smart-action lbl-smart-action--primary" onClick={continueLesson}>
    <T zh="开始练习" en="Start practice" /><ArrowRight size={17} aria-hidden="true" />
  </button> : screen === 'planning' ? (planError && <button type="button" className="lbl-smart-action lbl-smart-action--primary" onClick={() => restart(true)}><T zh="重新摆题" en="Set up again" /></button>) : <>
    <button type="button" className="lbl-smart-action" onClick={() => setHelp(true)}><CircleHelp size={17} aria-hidden="true" /><T zh="转动记号" en="Move notation" /></button>
    {screen === 'setup' && !strip && <button type="button" className="lbl-smart-action" onClick={() => {
      setSetupPlan(undefined);
      setSetupRetry(value => value + 1);
    }}><T zh="重新计算" en="Recalculate" /></button>}
    {repairing && !moveHint && <button type="button" className="lbl-smart-action" onClick={() => restart(false)}><T zh="重新生成步骤" en="Refresh steps" /></button>}
  </>;
  return <>
    <PracticeWorkspace phase={finished ? 'complete' : screen === 'lesson' ? 'practice' : 'prepare'} visual={visual} actions={actions} tools={virtualPad}>
      {(exerciseTitle || screen === 'setup') && <p className="lbl-smart-context">
        {exerciseTitle ? tr(exerciseTitle) : <T zh="摆题" en="Set up the cube" />}
      </p>}
      <h2>{finished ? <T zh="本阶段完成" en="Stage complete" /> : tr(stageInfo.title)}</h2>
      {finished && running ? <>
        <p role="status">{tr(running.guide.done)}</p>
      </> : setupReady ? <p role="status"><T zh="摆题完成" en="Setup complete" /></p> : screen === 'planning' ? <>
        <p className="lbl-smart-loading" role="status">{!planError && <LoaderCircle size={17} aria-hidden="true" />}{planError ? <T zh="无法从当前状态生成教学步骤，可以重新摆题。" en="Could not build a lesson from this state. Set up the exercise again." />
          : <T zh="正在根据魔方状态准备教学步骤…" en="Preparing steps for your cube…" />}</p>
      </> : <>
        {moveHint && <div className="lbl-smart-next-turn" data-recovery={repairing || setupCorrection} aria-live="polite">
          <span>{repairing || setupCorrection ? <T zh="纠正动作" en="Correction" /> : <T zh="下一步" en="Next move" />}</span>
          <strong>{moveHint.replaceAll("'", '′')}</strong>
        </div>}
        {rotation && <RotationHint rotation={rotation} pose={pose} />}
        <p>{screen === 'setup' ? (prerequisiteTitle
          ? <T zh={`跟着箭头先完成「${prerequisiteTitle.zh}」。`} en={`Follow the arrows to complete ${prerequisiteTitle.en} first.`} />
          : <T zh="跟着箭头和动作，把魔方摆到起始状态。" en="Follow the turns to reach the starting state." />)
          : action?.content ? tr(action.content.text) : <T zh="照提示完成当前动作。" en="Follow the next turn." />}</p>
        {!repairing && action?.content?.detail && <p>{tr(action.content.detail)}</p>}
        {screen === 'setup' && !strip && <p className="lbl-smart-loading" role="status"><LoaderCircle size={17} aria-hidden="true" /><T zh="正在计算摆法…" en="Finding a path to the starting state…" /></p>}
        {repairing && <p className="lbl-smart-correction" role="status">{moveHint
          ? <T zh="转动偏离了指引，先按箭头退回。" en="That turn was off the guide. Follow the arrow to undo it." />
          : <T zh="当前状态和指引不同，请重新生成步骤。" en="The cube differs from the guide. Refresh the steps." />}</p>}
        {strip && totalMoves > 1 && <div className="lbl-smart-sequence">
          {screen === 'setup' && <div className="lbl-smart-step-count"><span><T zh="摆题进度" en="Setup progress" /></span><span>{strip.done.length} / {totalMoves}</span></div>}
          {screen === 'setup' && <progress value={strip.done.length} max={totalMoves} aria-label={tr({ zh: '摆题进度', en: 'Setup progress' })} />}
          <div className="lbl-smart-turns"><TimerScrambleHintText hint={strip} /></div>
        </div>}
      </>}
    </PracticeWorkspace>
    {help && <PracticeReferenceSheet title={<T zh="转动记号" en="Move notation" />} onClose={() => setHelp(false)}>
      <div className="lbl-smart-help">
        <p><T zh="以屏幕提示的中心朝向拿方。正对要转的面，字母表示顺时针，带 ′ 表示逆时针，2 表示转半圈。" en="Match the centers shown. Look straight at the face you are turning. A letter means clockwise, ′ means counterclockwise, and 2 means a half turn." /></p>
        {moveHint && <AlgPlayer puzzle="3x3" engine="sim" set="" alg={moveHint} startSolved sceneRot={LBL_INITIAL_VIEW} orientation={displayPose} autoPlay size={200} />}
        <Link href="/tutorial/lbl?step=structure&section=notation" prefetch={false}><T zh="查看转动记号教程" en="Review the notation lesson" /></Link>
      </div>
    </PracticeReferenceSheet>}
  </>;
}

function RotationHint({ rotation, pose }: { rotation: string; pose: string }) {
  const { U, F } = orientedFaceColors(pose);
  const top = CUBE_COLOR_NAMES[U];
  const front = CUBE_COLOR_NAMES[F];
  return <p className="lbl-smart-rotation">{/^y[2']?$/.test(rotation)
    ? <T zh={`转体后，${front.zh}心朝前。`} en={`After the rotation, the ${front.en} center should face you.`} />
    : <T zh={`转体后，${top.zh}心朝上，${front.zh}心朝前。`} en={`After the rotation, the ${top.en} center should be on top and the ${front.en} center should face you.`} />}
  </p>;
}
