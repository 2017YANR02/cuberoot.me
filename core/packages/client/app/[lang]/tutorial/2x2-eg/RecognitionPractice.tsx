'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Move } from 'cubing/alg';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { T, tr } from '@/i18n/tr';
import { CUBE_FRAMING_EDGE, LessonPane } from '../components/InteractiveTutorial';
import InteractiveQuestionCopy, { InteractiveQuestionHelpButton } from '../components/InteractiveQuestionCopy';
import { TWO_BY_TWO_ORIENTATION } from '../lib/2x2-state';
import { TopDiagram } from './diagrams';
import { EgAlgDialog } from './lessons';
import { compareEgCases, getEgRecognition, recognitionExamples, recognitionFacelets } from './case-comparison';
import { recognitionInstruction } from './RecognitionGuide';
import { EG_CASES, EG_SETS, EG_SHAPES, egBottomRows, egCaseName, egMoves, egTopKey, type EgCase } from './lesson-data';

const yTurns = ['', 'y', 'y2', "y'"];
const uTurns = ['', 'U', 'U2', "U'"];
const topView = { x: Math.PI / 6, y: -Math.PI / 9, z: 0 };
const allowTurn = (move: string) => /^[Uy]\d*'?$/.test(move);
const steps = [
  { progressLabel: { zh: '观察并选公式', en: 'Observe and choose' } },
  { progressLabel: { zh: '摆好起手朝向', en: 'Align the cube' } },
] as const;

function makeProblem(target: EgCase, topTurn: string, bodyTurn: string) {
  const group = EG_CASES.filter(entry => entry.set === target.set && entry.shape === target.shape);
  const distractors = group.filter(entry => entry !== target)
    .map(entry => ({ entry, difference: compareEgCases(target, entry)?.difference ?? 0 }))
    .sort((a, b) => b.difference - a.difference).slice(0, 2).map(item => item.entry);
  return {
    target,
    setup: egMoves(target.setup, topTurn, bodyTurn),
    targetKey: egTopKey(target.setup),
    choices: group.filter(entry => entry === target || distractors.includes(entry)),
  };
}

const firstTarget = EG_CASES.find(entry => entry.set === 'eg1' && entry.shape === 'sune')!;

export default function RecognitionPractice() {
  const [{ target, setup, targetKey, choices }, setProblem] = useState(() => makeProblem(firstTarget, 'U', 'y'));
  const [selected, setSelected] = useState<EgCase | null>(null);
  const player = useRef<AlgPlayerHandle>(null);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [turning, setTurning] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [topTurns, setTopTurns] = useState(0);
  const [bodyTurns, setBodyTurns] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showAlg, setShowAlg] = useState(false);

  const state = egMoves(setup, uTurns[topTurns], yTurns[bodyTurns]);
  const [leftBack, rightBack] = egBottomRows(state)[2];
  const needsBottomBar = target.set === 'eg1';
  const barAtBack = !needsBottomBar || leftBack === rightBack;
  const topMatches = egTopKey(state) === targetKey;
  const chosen = selected?.id === target.id;
  const completed = chosen && barAtBack && topMatches && !turning;

  useEffect(() => {
    if (!ready) return;
    return player.current?.subscribeSettledCube?.(queuedMoves => setTurning(queuedMoves > 0));
  }, [attempt, ready]);

  function recordTurn(notation: string) {
    if (!allowTurn(notation)) return;
    const move = new Move(notation);
    const update = move.family === 'y' ? setBodyTurns : setTopTurns;
    update(value => ((value + move.amount) % 4 + 4) % 4);
    setTurning(player.current?.isUserMovePending?.(false) === true);
    setBlocked(false);
  }

  function turnWithKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key !== 'u' && key !== 'y') return;
    const notation = key === 'u' ? 'U' : key;
    if (player.current?.applyUserMove?.(event.shiftKey ? notation + "'" : notation)) event.preventDefault();
  }

  function nextProblem() {
    const pool = EG_CASES.filter(entry => entry !== target);
    const next = pool[Math.floor(Math.random() * pool.length)];
    setProblem(makeProblem(next, uTurns[1 + Math.floor(Math.random() * 3)], yTurns[Math.floor(Math.random() * 4)]));
    setReady(false);
    setAttempt(value => value + 1);
    setSelected(null);
    setTopTurns(0);
    setBodyTurns(0);
    setTurning(false);
    setBlocked(false);
    setShowHint(false);
    setShowAlg(false);
  }

  const method = getEgRecognition(target.shape);
  const examples = method ? recognitionExamples(method, target.set) : [];
  const sample = examples.find(example => example.entry.id === target.id);
  const mismatch = selected && !chosen ? compareEgCases(target, selected) : null;
  const check = method?.checks[mismatch?.difference ?? 0];
  const shapeName = tr(EG_SHAPES.find(shape => shape.id === target.shape)!.name);
  const setName = EG_SETS.find(set => set.id === target.set)!.name;
  const prompt = chosen
    ? needsBottomBar
      ? tr({ zh: '把底层的棒放在后面，再转 U 对齐公式起手图。', en: 'Put the bottom bar at the back, then turn U to match the algorithm starting position.' })
      : tr({ zh: '转 U 对齐公式起手图。', en: 'Turn U to match the algorithm starting position.' })
    : tr({ zh: `这题用 ${setName}。对齐 ${shapeName} 组的黄格，选择相同的案例。`,
      en: `Use ${setName}. Match the yellow pattern for ${shapeName} and choose the case.` });
  let status: string | null = null;
  if (blocked) {
    status = tr({ zh: '这题只转 U 层，或沿 y 轴转整颗魔方。', en: 'Turn only the U layer, or rotate the whole cube around the y-axis.' });
  } else if (completed) {
    status = tr({ zh: '公式选对了，起手朝向也对齐了。', en: 'The algorithm and starting orientation both match.' });
  } else if (chosen && !turning) {
    status = barAtBack
      ? tr({ zh: '公式选对了。转 U 对齐起手位。', en: 'That is the right algorithm. Turn U to match its starting position.' })
      : tr({ zh: '公式选对了。把底层的棒放到后面。', en: 'That is the right algorithm. Put the bottom bar at the back.' });
  } else if (selected && !chosen && check) {
    status = tr(recognitionInstruction(check));
  }

  return <LessonPane layout="F" captionProps={{ className: 'eg-quiz-caption' }} cube={
    <div className="course-cube eg-quiz-cube" role="group" tabIndex={0} onKeyDown={turnWithKey}
      aria-label={tr({ zh: '可操作的二阶魔方', en: 'Interactive 2×2 cube' })} data-course-cube data-ready={ready} data-drag-enabled={ready}>
      <AlgPlayer key={attempt} ref={player} puzzle="2x2" engine="sim" set="" setup={setup} alg=""
        orientation={TWO_BY_TWO_ORIENTATION} sceneRot={topView} maxFramingEdge={CUBE_FRAMING_EDGE}
        interactionMode="turn" wholeCubeDrag="rotate" orbitSnapDegrees={30} hintFacelets
        controlMode="none" hideResetView fillPane allowUserLayerTurn={allowTurn} onUserMove={recordTurn}
        onBlockedUserLayerTurn={() => setBlocked(true)} onReady={() => setReady(true)} />
    </div>
  }>
    <InteractiveQuestionCopy sectionId="side-colors" questions={steps} activeIndex={chosen ? 1 : 0}
      answer={completed ? 'correct' : selected && !chosen ? 'wrong' : 'pending'}
      heading={<T zh="选公式和起手朝向" en="Choose an algorithm and starting orientation" />}
      headingAction={<InteractiveQuestionHelpButton onClick={() => setShowHint(value => !value)}>
        {showHint ? <T zh="收起提示" en="Hide hint" /> : <T zh="提示" en="Hint" />}
      </InteractiveQuestionHelpButton>}
      prompt={prompt}
      hint={showHint && chosen ? tr({ zh: '轻拖画布空白处查看底排，横拖可转体。拖动顶层贴纸转 U。',
        en: 'Drag in empty space to check the bottom rows, or farther sideways to rotate the cube. Drag a top sticker to turn U.' }) : undefined}
      status={status} reserveStatus
      action={<>
        {showHint && !chosen && check && sample && <div className="eg-practice-reference">
          <TopDiagram setup={sample.setup} size={76} yellowOnly
            outlinedFacelets={check.kind === 'relation' ? recognitionFacelets(check, sample) : undefined} />
          <p>
            {needsBottomBar && <T zh="先把底层的棒放在后面。" en="Keep the bottom bar at the back. " />}
            {check.kind === 'relation' && <T zh="转 U 对齐黄格。" en="Turn U to line up the yellow stickers. " />}
            <T {...recognitionInstruction(check)} />
          </p>
        </div>}
        <div className="eg-actions eg-quiz-choices" role="group" aria-label={tr({ zh: '选择公式', en: 'Choose an algorithm' })}>
          {choices.map(entry => <button type="button" className="btn-secondary eg-control eg-quiz-choice" key={entry.id}
            aria-pressed={selected?.id === entry.id} onClick={() => setSelected(entry)}>
            <TopDiagram setup={chosen ? entry.setup : examples.find(example => example.entry.id === entry.id)?.setup ?? entry.setup} size={64} />
            <strong><T {...egCaseName(entry.id)} /></strong>
          </button>)}
        </div>
        {completed && <div className="eg-actions">
          <button type="button" className="btn-primary eg-control" aria-haspopup="dialog" onClick={() => setShowAlg(true)}>
            <T zh="看公式演示" en="Watch the algorithm" />
          </button>
          <button type="button" className="btn-secondary eg-control" onClick={nextProblem}><T zh="再练一例" en="Try another case" /></button>
        </div>}
      </>} />
    {showAlg && <EgAlgDialog entry={target} setup={state} onClose={() => setShowAlg(false)} />}
  </LessonPane>;
}
