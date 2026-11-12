'use client';

import { useMemo, useRef, useState } from 'react';
import { Alg } from 'cubing/alg';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { VisualCube } from '@/components/VisualCube';
import TrainingFeedbackOverlay from '@/components/TrainingFeedbackOverlay';
import { T, tr } from '@/i18n/tr';
import { ORDERED_BASIC_CASES, F2L_PRACTICE_CASES, F2L_TOP_ADJUSTMENTS, type BasicCaseId } from '../data/basic-cases';
import { THREE_MOVE_PARTS } from '../data/three-move-lesson';
import { f2lDiagramFacelets, f2lPlaybackSections } from '../lib/cube-preview';
import { isF2lPracticeSolved } from '../lib/algorithm-practice';
import StudyActions from '../components/StudyActions';
import SectionNavigation from '../components/SectionNavigation';
import './three-move-lesson.css';

type BasicCase = typeof ORDERED_BASIC_CASES[number];
const NO_STOPS: readonly number[] = [];
const TOP_TURNS = ['U', "U'", 'U2'] as const;

/** A short narrated sequence, driven by the player's actual position, including seeking. */
function ThreeMoveFilm({ lesson, orientation, pauseBetween, alignment }: {
  lesson: BasicCase; orientation: string; pauseBetween: boolean; alignment: boolean;
}) {
  const player = useRef<AlgPlayerHandle>(null);
  const [step, setStep] = useState(0);
  const setup = useMemo(() => new Alg(lesson.alg).invert().expand().toString(), [lesson]);
  const alg = alignment ? '(U) (U) (U) (U)' : lesson.alg;
  const sections = useMemo(() => f2lPlaybackSections(alg), [alg]);
  const boundaries = useMemo(() => sections.slice(0, -1).map(section => section.end), [sections]);
  const current = Math.min(sections.length, Math.ceil(step));
  const caption = alignment
    ? tr(current === 0 || current === 4
      ? { zh: `这就是教材中的 ${lesson.name} 起始朝向。`, en: `This is the reference orientation for ${lesson.name}.` }
      : { zh: `图案转到了另一个位置，但它仍然是 ${lesson.name}。`, en: `The pattern has moved around the top, but it is still ${lesson.name}.` })
    : tr(lesson.stageTitles[current]);
  return <div className="f2l-lesson f2l-study-lesson">
    <section className="f2l-demo" aria-label={tr({ zh: '三步基态短片', en: 'Three-move walkthrough' })}>
      <div className="f2l-cube"><AlgPlayer ref={player} puzzle="3x3" engine="sim" set="f2l-tutorial"
        setup={setup} alg={alg} orientation={orientation} fillPane moveDurationMs={1100}
        onStepChange={setStep} pauseAfterSteps={pauseBetween ? boundaries : NO_STOPS} sectionPauseMs={2000} /></div>
      <p className="f2l-film-caption" aria-live="polite">{caption}</p>
    </section>
    <section className="f2l-guidance">
      {alignment ? <figure className="f2l-merged-reference">
        <VisualCube local view="iso" size={200} faceletColors={f2lDiagramFacelets(setup, orientation)} alt={lesson.name} />
        <figcaption><T zh="教材图形" en="Reference pattern" /> · {lesson.name}</figcaption>
      </figure> : <ol className="f2l-stage-list">
        {lesson.stageTitles.map((title, index) => <li key={index}>
          <button type="button" className="f2l-stage-button" aria-current={current === index ? 'step' : undefined}
            onClick={() => { const instance = player.current?.getPlayer(); if (instance) instance.timestamp = index; }}>
            <span className="f2l-stage-content"><span>{tr(title)}</span>
              {index > 0 && <code>{sections[index - 1].alg.replace(/[()]/g, '')}</code>}
            </span>
          </button>
        </li>)}
      </ol>}
    </section>
  </div>;
}

function AlignmentExercise({ lesson, orientation, adjustment, onRestart }: {
  lesson: BasicCase; orientation: string; adjustment: string; onRestart: () => void;
}) {
  const player = useRef<AlgPlayerHandle>(null);
  const [history, setHistory] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [demonstrating, setDemonstrating] = useState(false);
  const practice = F2L_PRACTICE_CASES.find(item => item.id === `${lesson.id}:${adjustment}`)!;
  const reference = useMemo(() => f2lDiagramFacelets(new Alg(lesson.alg).invert().toString(), orientation), [lesson, orientation]);
  // Completing the known insertion must solve ALL lower layers. This compares actual
  // sticker identities, permits whole-cube rotations, and never uses display colors.
  const check = () => {
    if (player.current?.isUserMovePending?.()) return;
    setResult(isF2lPracticeSolved(`${practice.setup} ${history} ${lesson.alg}`) ? 'correct' : 'wrong');
  };
  return <div className="f2l-lesson f2l-study-lesson">
    <section className="f2l-demo" aria-label={tr({ zh: '顶层调整练习', en: 'Top-layer alignment exercise' })}>
      <div className="f2l-cube">
        <AlgPlayer key={demonstrating ? 'solution' : 'exercise'} ref={player} puzzle="3x3" engine="sim" set="f2l-overview"
          setup={demonstrating ? `${practice.setup} ${history}` : practice.setup} alg={demonstrating ? lesson.alg : ''}
          orientation={orientation} fillPane controlMode={demonstrating ? 'full' : 'none'} autoPlay={demonstrating}
          interactionMode={demonstrating ? 'view' : 'turn'} moveDurationMs={650}
          onUserMove={move => { setResult(null); setHistory(previous => `${previous} ${move}`.trim()); }} />
        {!demonstrating && <TrainingFeedbackOverlay kind={result}
          correctLabel={tr({ zh: '已对齐教材图形', en: 'Reference matched' })}
          wrongLabel={tr({ zh: '还没有对齐，再观察一下', en: 'Not aligned yet. Compare again.' })} />}
      </div>
      {!demonstrating && <div className="f2l-merged-controls" role="group" aria-label={tr({ zh: '转动顶层', en: 'Turn the top layer' })}>
        {TOP_TURNS.map(move => <button type="button" className="f2l-restart" key={move}
          onClick={() => player.current?.applyUserMove?.(move)}>{move.replace("'", '′')}</button>)}
        <button type="button" className="f2l-restart" onClick={check}><T zh="检查朝向" en="Check alignment" /></button>
      </div>}
      {demonstrating && <code className="f2l-alg f2l-player-alg">{lesson.alg}</code>}
    </section>
    <section className="f2l-guidance">
      <figure className="f2l-merged-reference">
        <VisualCube local view="iso" size={200} faceletColors={reference} alt={lesson.name} />
        <figcaption><T zh="对齐这个图形" en="Match this pattern" /> · {lesson.name}</figcaption>
      </figure>
      <p><T zh="保持底色和前面不变，只调整顶层。也可以拿手中的魔方一起练习。" en="Keep the bottom and front fixed; adjust only the top. You can also practise on your own cube." /></p>
      <p className="f2l-stage-scramble"><span><T zh="打乱:" en="Scramble:" /></span><code>{practice.setup}</code></p>
      <div className="f2l-merged-controls">
        {result === 'correct' && !demonstrating && <button type="button" className="f2l-restart" onClick={() => setDemonstrating(true)}><T zh="接上三步还原" en="Finish in three moves" /></button>}
        <button type="button" className="f2l-restart" onClick={onRestart}><T zh="再试一次" en="Try again" /></button>
      </div>
    </section>
  </div>;
}

export default function ThreeMoveLesson({ orientation, pauseBetween, caseId, onCaseChange, onComplete }: {
  orientation: string; pauseBetween: boolean; caseId: BasicCaseId; onCaseChange: (id: BasicCaseId) => void; onComplete: () => void;
}) {
  const [part, setPart] = useState(0);
  const [exercise, setExercise] = useState<{ adjustment: string; generation: number } | null>(null);
  const lesson = ORDERED_BASIC_CASES.find(item => item.id === caseId) ?? ORDERED_BASIC_CASES[0];
  const diagrams = useMemo(() => ORDERED_BASIC_CASES.map(item => f2lDiagramFacelets(new Alg(item.alg).invert().toString(), orientation)), [orientation]);
  const startExercise = () => setExercise(previous => ({
    adjustment: F2L_TOP_ADJUSTMENTS[Math.floor(Math.random() * F2L_TOP_ADJUSTMENTS.length)], generation: (previous?.generation ?? 0) + 1,
  }));
  const selectPart = (index: number) => { setExercise(null); setPart(index); };
  const next = () => {
    if (part < 2) selectPart(part + 1);
    else if (!exercise) startExercise();
    else {
      const nextCase = ORDERED_BASIC_CASES[ORDERED_BASIC_CASES.indexOf(lesson) + 1];
      if (nextCase) { onCaseChange(nextCase.id); selectPart(1); }
      else onComplete();
    }
  };
  return <div className="f2l-study-layout f2l-merged-lesson">
    <SectionNavigation label={lesson.name}>
      <div className="f2l-section-list" role="group" aria-label={tr({ zh: '选择三步基态', en: 'Choose a three-move case' })}>
        {ORDERED_BASIC_CASES.map((item, index) => <button type="button" className="f2l-section-button" key={item.id}
          aria-pressed={item.id === lesson.id} onClick={() => onCaseChange(item.id)}>
          <span className="f2l-section-label"><VisualCube local view="iso" size={48} faceletColors={diagrams[index]} alt="" /><span>{item.name}</span></span>
        </button>)}
      </div>
    </SectionNavigation>
    <div className="f2l-study-main">
      <div className="f2l-merged-parts" role="group" aria-label={tr({ zh: '学习环节', en: 'Learning sections' })}>
        {THREE_MOVE_PARTS.map((item, index) => <button type="button" key={index} className="f2l-section-button"
          aria-pressed={part === index} onClick={() => selectPart(index)}>{tr(item.title)}</button>)}
      </div>
      <p>{tr(THREE_MOVE_PARTS[part].copy)}</p>
      {part === 0 ? <div className="f2l-recognition">
        {ORDERED_BASIC_CASES.map((item, index) => <figure key={item.id}>
          <VisualCube local view="iso" size={190} faceletColors={diagrams[index]} interactive enlargeable alt={item.name} />
          <figcaption>{item.name}</figcaption>
        </figure>)}
      </div> : exercise ? <AlignmentExercise key={`${lesson.id}:${orientation}:${exercise.generation}`} lesson={lesson} orientation={orientation}
        adjustment={exercise.adjustment} onRestart={startExercise} />
        : <ThreeMoveFilm key={`${lesson.id}:${orientation}:${part}`} lesson={lesson} orientation={orientation} pauseBetween={pauseBetween} alignment={part === 2} />}
      <StudyActions onPrevious={exercise ? () => setExercise(null) : part > 0 ? () => selectPart(part - 1) : undefined} onContinue={next}>
        {part === 2 && !exercise && <button type="button" className="f2l-restart" onClick={startExercise}><T zh="自己调整顶层" en="Try aligning it" /></button>}
      </StudyActions>
    </div>
  </div>;
}
