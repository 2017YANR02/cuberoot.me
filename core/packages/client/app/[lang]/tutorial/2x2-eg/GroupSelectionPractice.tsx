'use client';

import { useState } from 'react';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { T, tr } from '@/i18n/tr';
import { CUBE_FRAMING_EDGE, LessonPane } from '../components/InteractiveTutorial';
import InteractiveQuestionCopy from '../components/InteractiveQuestionCopy';
import { TopDiagram } from './diagrams';
import GroupSelectionVideoHelp from './GroupSelectionVideoHelp';
import { EG_BOTTOM_ROW_LABELS, EG_CASES, EG_SETS, EG_SHAPES, egCase, type EgSet, type EgShape } from './lesson-data';
import { egPalette, useEgOrientation } from './orientation';

const introView = { x: Math.PI / 6, y: Math.PI / 5, z: 0 };
const steps = [
  { progressLabel: { zh: '看底层选一套', en: 'Choose CLL, EG-1, or EG-2' } },
  { progressLabel: { zh: '看顶层选公式组', en: 'Choose the top group' } },
] as const;

type Selection = { step: 'bottom'; choice: EgSet | null } | { step: 'top'; choice: EgShape | null };
const firstSelection: Selection = { step: 'bottom', choice: null };
const firstTarget = egCase('eg1', 'S+U');

export default function GroupSelectionPractice({ onSelect }: { onSelect: (set: EgSet, shape: EgShape) => void }) {
  const orientation = useEgOrientation();
  const top = egPalette(orientation).name('U');
  const [target, setTarget] = useState(firstTarget);
  const [selection, setSelection] = useState<Selection>(firstSelection);
  const [attempt, setAttempt] = useState(0);
  const atBottom = selection.step === 'bottom';
  const correct = atBottom ? selection.choice === target.set : selection.choice === target.shape;
  const set = EG_SETS.find(item => item.id === target.set)!;
  const shape = EG_SHAPES.find(item => item.id === target.shape)!;
  const matchingRows = EG_BOTTOM_ROW_LABELS[set.id];

  function retry() {
    setSelection(firstSelection);
    setAttempt(previous => previous + 1);
  }

  function nextProblem() {
    const pool = EG_CASES.filter(entry => entry.set !== target.set && entry.shape !== target.shape);
    setTarget(pool[Math.floor(Math.random() * pool.length)]);
    retry();
  }

  const prompt = atBottom
    ? tr({ zh: '底面已经拼好。拖动魔方，数数有几个侧面的底排两格同色', en: 'One face is already complete. Drag the cube and count the matching bottom rows on its four sides' })
    : tr({ zh: `只看顶层的${top.zh}格，比较它们在顶面和侧面的位置`, en: `Look at the ${top.en} stickers in the top layer. Match their pattern on the top and sides` });
  const status = correct
    ? atBottom
      ? tr({ zh: `${matchingRows.zh}，选 ${set.name}`, en: `${matchingRows.en} means ${set.name}` })
      : tr({ zh: `${set.name} 的 ${shape.name.zh} 组`, en: `${set.name} / ${shape.name.en}` })
    : selection.choice && (atBottom
      ? tr({ zh: '再数一下四个侧面的同色底排', en: 'Count the matching bottom rows again' })
      : tr({ zh: `再对照顶层${top.zh}格的位置`, en: `Compare the positions of the ${top.en} stickers again` }));

  return <LessonPane layout="F" captionProps={{ className: 'eg-quiz-caption' }} cube={
    <div className="course-cube eg-quiz-cube" data-course-cube>
      <AlgPlayer key={attempt} puzzle="2x2" engine="sim" set="" setup={target.setup} alg=""
        orientation={orientation} sceneRot={introView} maxFramingEdge={CUBE_FRAMING_EDGE}
        interactionMode="view" controlMode="none" hintFacelets fillPane />
    </div>
  }>
    <InteractiveQuestionCopy sectionId="side-colors" questions={steps} activeIndex={atBottom ? 0 : 1}
      answer={correct ? 'correct' : selection.choice ? 'wrong' : 'pending'} prompt={prompt} status={status} reserveStatus
      heading={atBottom ? <T zh="底层用哪一套？" en="Which set fits the bottom?" /> : <T zh="顶层是哪一组？" en="Which group fits the top?" />}
      headingAction={<GroupSelectionVideoHelp key={selection.step} bottom={atBottom} target={target} />}
      action={<>
        {atBottom ? <div className="eg-actions eg-quiz-choices" role="group" aria-label={tr({ zh: '按底层选公式', en: 'Choose the bottom set' })}>
          {EG_SETS.map(({ id, name }) => <button key={id} type="button" className="btn-secondary eg-control eg-quiz-choice"
            aria-pressed={selection.choice === id} onClick={() => setSelection({ step: 'bottom', choice: id })}>{name}</button>)}
        </div> : <div className="eg-actions eg-quiz-choices eg-quiz-groups" role="group" aria-label={tr({ zh: '选择顶层公式组', en: 'Choose the top group' })}>
          {EG_SHAPES.map(group => <button key={group.id} type="button" className="btn-secondary eg-control eg-quiz-choice"
            aria-pressed={selection.choice === group.id} onClick={() => setSelection({ step: 'top', choice: group.id })}>
            <TopDiagram setup={egCase(target.set, group.example).setup} size={56} topOnly decorative />
            <strong><T {...group.name} /></strong>
          </button>)}
        </div>}
        <div className="course-question-actions">
          {atBottom ? <button type="button" className="btn-primary course-question-action course-question-continue"
            disabled={!correct} onClick={() => setSelection({ step: 'top', choice: null })}>
            <T zh="继续" en="Continue" />
          </button> : <>
            <button type="button" className="btn-primary course-question-action course-question-continue"
              disabled={!correct} onClick={() => onSelect(target.set, target.shape)}>
              <T zh="去学这一组" en="Learn this group" />
            </button>
            <button type="button" className="btn-secondary course-question-action" disabled={!correct} onClick={retry}>
              <T zh="再练一次" en="Practice again" />
            </button>
            <button type="button" className="btn-secondary course-question-action" onClick={nextProblem}>
              <T zh="换一题" en="Try another" />
            </button>
          </>}
        </div>
      </>} />
  </LessonPane>;
}
