'use client';

import { useState } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { T, tr } from '@/i18n/tr';
import { LessonPane } from '../components/InteractiveTutorial';
import { BottomDiagram, EG_CORNER_VIEWS, EG_DIRECTIONS, TopDiagram } from './diagrams';
import { EgAlgDialog } from './lessons';
import {
  EG_BOTTOM, EG_CASES, EG_SETS, EG_SHAPES, egBottomRows, egCase, egCaseName, egMoves, egTopKey,
  type EgCase, type EgSet, type EgShape,
} from './lesson-data';

type Mode = 'bottom' | 'shape' | 'mixed';
type Prompt = 'set' | 'shape' | 'align';
const sampleSets = ['eg1', 'cll', 'eg2', 'cll', 'eg1', 'eg2'] as const;
const starterIds = ['S+U', 'S-U', 'O-diagonal', 'TL', 'PiU', 'UD', 'HU', 'LR'];
const yTurns = ['', 'y', 'y2', "y'"];
const uTurns = ['', 'U', 'U2', "U'"];
const shapeIds = EG_SHAPES.map(item => item.id);

function deckEntry(mode: Mode, number: number, pool: readonly EgCase[]) {
  if (mode === 'bottom') return egCase(sampleSets[number % sampleSets.length], 'S+R');
  if (mode === 'shape') {
    const shape = EG_SHAPES[number % EG_SHAPES.length];
    return egCase('cll', shape.example);
  }
  const starter = starterIds[number];
  return (starter ? pool.find(item => item.id === starter && item.set === sampleSets[number % sampleSets.length])
    ?? pool.find(item => item.id === starter) : undefined) ?? pool[(number * 17) % pool.length];
}

function trialFor(mode: Mode, number: number, pool: readonly EgCase[]) {
  const entry = deckEntry(mode, number, pool);
  const y = yTurns[(number + 1) % 4];
  const u = uTurns[(number * 3 + 1) % 4];
  return { entry, setup: egMoves(entry.setup, u, y) };
}

const prompts = {
  set: { zh: '白面做好了。该用哪套公式？', en: 'The white face is done. Which set fits?' },
  shape: { zh: '顶层属于哪个形状？', en: 'Which shape is on top?' },
  align: { zh: '把魔方摆到起手位置', en: 'Put the cube in the starting position' },
};
const hints = {
  set: { zh: '试着换个角度，数完整的同色底排。', en: 'Change the view and count matching bottom rows.' },
  shape: { zh: '先数顶面黄格，再看侧面的黄色。', en: 'Count yellow on top, then check where the side yellows sit.' },
};
export default function RecognitionPractice({ mode, set }: { mode: Mode; set?: EgSet }) {
  const [shape, setShape] = useQueryState('group', parseAsStringEnum(shapeIds));
  return <PracticeRound key={set ? shape : mode} mode={mode} set={set} shape={set ? shape ?? undefined : undefined}
    onShape={set ? value => { void setShape(value); } : undefined} />;
}

function PracticeRound({ mode, set, shape, onShape }: {
  mode: Mode; set?: EgSet; shape?: EgShape; onShape?: (shape: EgShape | null) => void;
}) {
  const pool = EG_CASES.filter(item => (!set || item.set === set) && (!shape || item.shape === shape));
  const [number, setNumber] = useState(0);
  const [trial, setTrial] = useState(() => trialFor(mode, 0, pool));
  const [prompt, setPrompt] = useState<Prompt>(mode === 'shape' ? 'shape' : 'set');
  const [answer, setAnswer] = useState<string | null>(null);
  const [corner, setCorner] = useState(0);
  const [lookBottom, setLookBottom] = useState(false);
  const [topTurns, setTopTurns] = useState(0);
  const [bodyTurns, setBodyTurns] = useState(0);
  const [showAlg, setShowAlg] = useState(false);
  const { entry, setup } = trial;
  const goal = prompt === 'set' ? entry.set : entry.shape;
  const matched = answer === goal;
  const state = egMoves(setup, uTurns[topTurns], yTurns[bodyTurns]);
  const checkingBottom = prompt === 'set' || (prompt === 'align' && lookBottom);
  const bar = prompt === 'align' && entry.set === 'eg1'
    ? egBottomRows(state).findIndex(([a, b]) => a === b)
    : -1;
  const topMatches = prompt === 'align' && egTopKey(state) === egTopKey(entry.setup);
  const aligned = topMatches && (entry.set !== 'eg1' || bar === 2);
  const shapeInfo = EG_SHAPES.find(item => item.id === entry.shape)!;

  function next() {
    setNumber(number + 1);
    setTrial(trialFor(mode, number + 1, pool));
    setPrompt(mode === 'shape' ? 'shape' : 'set');
    setAnswer(null);
    setCorner(0);
    setLookBottom(false);
    setTopTurns(0);
    setBodyTurns(0);
  }

  function advance() {
    if (mode !== 'mixed') { next(); return; }
    setPrompt(prompt === 'set' ? 'shape' : 'align');
    setAnswer(null);
  }

  function turn(move: string) {
    const update = move.startsWith('y') ? setBodyTurns : setTopTurns;
    update(value => (value + (move.endsWith("'") ? 3 : 1)) % 4);
  }

  return <LessonPane layout="F" cube={<div className="eg-observation">
    {checkingBottom
      ? <BottomDiagram setup={state} corner={corner} size={260} />
      : <TopDiagram setup={state} size={260} yellowOnly={prompt === 'shape'} />}
    <div className="eg-observation-actions">
      {checkingBottom && <button type="button" className="btn-secondary eg-control" onClick={() => setCorner(value => (value + 1) % 4)}>
        <T zh="换个角度" en="Change view" />
      </button>}
      {prompt === 'align' && entry.set === 'eg1' &&
        <button type="button" className="btn-secondary eg-control" onClick={() => setLookBottom(value => !value)}>
          {lookBottom ? <T zh="看顶层" en="View top" /> : <T zh="看底层" en="View bottom" />}
        </button>}
    </div>
    <span aria-live="polite">{checkingBottom ? <T {...EG_CORNER_VIEWS[corner]} /> : <T zh="下方是前面" en="Front is at the bottom" />}</span>
  </div>}>
    <div className="course-copy eg-copy">
      {onShape && <label className="eg-practice-filter">
        <T zh="练习范围" en="Practice scope" />
        <select className="eg-shape-filter" value={shape ?? ''} onChange={event => onShape((event.target.value || null) as EgShape | null)}>
          <option value="">{tr({ zh: '全部形状', en: 'All shapes' })}</option>
          {EG_SHAPES.map(item => <option key={item.id} value={item.id}>{tr(item.name)}</option>)}
        </select>
      </label>}
      <p className="eg-question-number"><T zh={`第 ${number + 1} 题`} en={`Question ${number + 1}`} /></p>
      <h2><T {...prompts[prompt]} /></h2>
      {prompt === 'align' ? <>
        <div className="eg-target">
          <TopDiagram setup={entry.setup} size={96} />
          <div>
            <strong><T {...egCaseName(entry.id)} /></strong>
            {entry.set === 'eg1' && <p><T zh="先用 y 转整颗魔方，把底层的棒放到后面。"
              en="First use y to turn the whole cube and move the bottom bar to the back." /></p>}
            <p><T zh="用 U 只转顶层，对齐图中的黄格和侧色关系。"
              en="Use U to turn just the top and match the target’s yellows and side-color relationships." /></p>
          </div>
        </div>
        <div className="eg-actions" role="group" aria-label={tr({ zh: '摆位转动', en: 'Alignment moves' })}>
          {(entry.set === 'eg1' ? ['y', "y'", 'U', "U'"] : ['U', "U'"]).map(move =>
            <button key={move} type="button" className="btn-secondary eg-turn eg-control" onClick={() => turn(move)}><code>{move}</code></button>)}
        </div>
        <div className="eg-feedback" aria-live="polite">
          {bar >= 0 && <p><T zh={`棒在${EG_DIRECTIONS[bar].zh}面。`} en={`Bottom bar: ${EG_DIRECTIONS[bar].en.toLowerCase()}.`} /></p>}
          {topMatches ? <p className="course-completed"><T zh="顶层已经对齐。" en="The top is aligned." /></p>
            : <p><T zh="顶层还需要调整。" en="The top still needs an adjustment." /></p>}
        </div>
        <div className="eg-actions">
          <button type="button" className="btn-primary eg-control" disabled={!aligned} aria-haspopup="dialog" onClick={() => setShowAlg(true)}>
            <T zh="看公式并跟练" en="See and practice the algorithm" />
          </button>
          <button type="button" className="btn-secondary eg-control" disabled={!aligned} onClick={next}><T zh="下一题" en="Next case" /></button>
        </div>
      </> : <>
        <div className="eg-actions eg-answers" role="group" aria-label={tr({ zh: '选择答案', en: 'Choose an answer' })}>
          {prompt === 'set'
            ? EG_SETS.map(item => <button type="button" className="btn-secondary eg-control" key={item.id}
                aria-pressed={answer === item.id} disabled={matched && item.id !== goal} onClick={() => setAnswer(item.id)}>{item.name}</button>)
            : EG_SHAPES.map(item => <button type="button" className="btn-secondary eg-control" key={item.id}
                aria-pressed={answer === item.id} disabled={matched && item.id !== goal} onClick={() => setAnswer(item.id)}>
                <T {...item.name} />
              </button>)}
        </div>
        <div className="eg-feedback" aria-live="polite">
          {matched ? <p className="course-completed"><T {...(prompt === 'set' ? EG_BOTTOM[entry.set] : shapeInfo.clue)} /></p>
            : <p>{answer && <T zh="再看一次。" en="Take another look. " />}<T {...hints[prompt]} /></p>}
        </div>
        <button type="button" className="btn-primary eg-control" disabled={!matched} onClick={advance}>
          {mode === 'mixed'
            ? prompt === 'set' ? <T zh="继续看顶层" en="Continue to the top" /> : <T zh="继续摆位" en="Align the cube" />
            : <T zh="下一题" en="Next case" />}
        </button>
      </>}
    </div>
    {showAlg && <EgAlgDialog entry={entry} setup={state} onClose={() => setShowAlg(false)} />}
  </LessonPane>;
}
