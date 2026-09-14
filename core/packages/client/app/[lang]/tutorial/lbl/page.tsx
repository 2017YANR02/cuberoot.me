'use client';

import { useEffect, useRef, useState } from 'react';
import { Alg } from 'cubing/alg';
import { ArrowRight, ChevronLeft, ChevronRight, Lightbulb, Move3d } from 'lucide-react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import BackHome from '@/components/BackHome';
import Link from '@/components/AppLink';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { VisualCube } from '@/components/VisualCube';
import { CompactSelect } from '@/components/CompactSelect';
import JsonLd from '@/components/JsonLd';
import { tr, T } from '@/i18n/tr';
import {
  DAISY_CHALLENGE_PROMPT,
  DAISY_HINT_INTRO,
  LBL_LESSON_RUNS,
  LBL_LESSON_STAGE_IDS,
  LBL_STEPS,
  type LblExample,
  type LblLessonRun,
  type LblLessonStageId,
} from './content';
import './lbl.css';

function expandedSetup(alg: string): string {
  return new Alg(alg).expand().toString();
}

type LessonFrame = { setup: string; alg: string; stageId: LblLessonStageId | null };

function resolveLessonFrame(run: LblLessonRun, stepId: string): LessonFrame {
  const stageIndex = LBL_LESSON_STAGE_IDS.findIndex(id => id === stepId);
  if (stageIndex < 0) return { setup: '', alg: '', stageId: null };

  const stageId = LBL_LESSON_STAGE_IDS[stageIndex];
  if (!stageId) throw new Error('LBL lesson stage id must exist');
  const completedStages = LBL_LESSON_STAGE_IDS.slice(0, stageIndex).map(id => run.stages[id]);
  return {
    setup: [run.scramble, ...completedStages].filter(Boolean).join(' '),
    alg: run.stages[stageId],
    stageId,
  };
}

function DaisyHintCases({ examples }: { examples: LblExample[] }) {
  return <div id="lbl-daisy-hints" className="lbl-daisy-hints" role="region" aria-label={tr({ zh: '小花情况提示', en: 'Daisy case hints' })}>
    <p className="lbl-daisy-hint-intro">{tr(DAISY_HINT_INTRO)}</p>
    <div className="lbl-daisy-hint-grid">
      {examples.map(example => {
        const setup = expandedSetup(resolvePlayerSetup('3x3', example.alg, example.setup, example.startSolved ?? false));
        return <article className="lbl-daisy-hint-card" key={example.title.en}>
          <VisualCube local view="iso" scheme="yogwrb" size={76} setup={setup} alt={tr(example.title)} />
          <div>
            <h3>{tr(example.title)}</h3>
            <p>{tr(example.hint)}</p>
            <code>{example.alg}</code>
          </div>
        </article>;
      })}
    </div>
  </div>;
}

function DaisyChallenge({ examples, open, onToggle, onNextScramble }: { examples: LblExample[]; open: boolean; onToggle: () => void; onNextScramble: () => void }) {
  return <section className="lbl-daisy-challenge lbl-glass" aria-labelledby="lbl-daisy-prompt">
    <p id="lbl-daisy-prompt" className="lbl-daisy-prompt"><Lightbulb size={20} aria-hidden="true" /><span>{tr(DAISY_CHALLENGE_PROMPT)}</span></p>
    <div className="lbl-daisy-actions">
      <button type="button" className="lbl-daisy-hint-toggle" onClick={onNextScramble}>
        <T zh="换一套打乱" en="Try another scramble" />
      </button>
      <button type="button" className="lbl-daisy-hint-toggle" aria-expanded={open} aria-controls="lbl-daisy-hints" onClick={onToggle}>
        <Lightbulb size={16} aria-hidden="true" />
        <T zh={open ? '收起提示' : '给我一点提示'} en={open ? 'Hide hints' : 'Show me a hint'} />
      </button>
    </div>
    {open && <DaisyHintCases examples={examples} />}
  </section>;
}

export default function LblTutorial() {
  const [stepId, setStepId] = useQueryState('step', parseAsStringEnum(LBL_STEPS.map(s => s.id)).withDefault('structure').withOptions({ history: 'push' }));
  const stepIndex = Math.max(0, LBL_STEPS.findIndex(s => s.id === stepId));
  const step = LBL_STEPS[stepIndex];
  const isDaisyStep = step.id === 'daisy';
  const [lessonIndex, setLessonIndex] = useState(0);
  const lessonDrawn = useRef(false);
  const [daisyHintOpen, setDaisyHintOpen] = useState(false);
  useEffect(() => {
    if (lessonDrawn.current) return;
    lessonDrawn.current = true;
    setLessonIndex(Math.floor(Math.random() * LBL_LESSON_RUNS.length));
  }, []);
  useEffect(() => {
    if (!isDaisyStep) setDaisyHintOpen(false);
  }, [isDaisyStep]);
  const lesson = LBL_LESSON_RUNS[lessonIndex] ?? LBL_LESSON_RUNS[0];
  if (!lesson) throw new Error('LBL lesson runs must not be empty');
  const frame = resolveLessonFrame(lesson, step.id);
  const beforeSetup = expandedSetup(frame.setup);
  const afterSetup = frame.alg ? expandedSetup(`${frame.setup} ${frame.alg}`) : beforeSetup;
  const simQuery = frame.alg
    ? new URLSearchParams({ puzzle: '3x3', alg: frame.alg, anchor: 'start', stickeringRot: 'z2', setup: frame.setup })
    : null;

  return <main className="lbl-page">
    <header className="lbl-header">
      <BackHome />
      <Link href="/tutorial?puzzle=3x3" prefetch={false}><T zh="教程" en="Tutorials" /></Link>
      <h1><T zh="层先法" en="LBL" /></h1>
    </header>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Article', headline: tr({ zh: '三阶魔方层先法', en: '3×3 LBL tutorial' }), description: tr({ zh: '配有交互演示的层先法入门教程。', en: 'A beginner layer-by-layer guide with interactive demonstrations.' }) }} />
    <nav className="lbl-nav lbl-glass" aria-label={tr({ zh: '教程步骤', en: 'Tutorial steps' })}>
      <button className="lbl-button" type="button" disabled={stepIndex === 0} aria-label={tr({ zh: '上一步', en: 'Previous step' })} onClick={() => { void setStepId(LBL_STEPS[stepIndex - 1].id); }}><ChevronLeft size={18} /></button>
      <span className="lbl-progress">{stepIndex + 1} / {LBL_STEPS.length}</span>
      <CompactSelect label={tr(step.title)} value={step.id} ariaLabel={tr({ zh: '选择步骤', en: 'Choose a step' })}
        items={LBL_STEPS.map((s, i) => ({ value: s.id, label: `${i + 1}. ${tr(s.title)}` }))}
        onChange={value => { void setStepId(value); }} />
      <button className="lbl-button" type="button" disabled={stepIndex === LBL_STEPS.length - 1} aria-label={tr({ zh: '下一步', en: 'Next step' })} onClick={() => { void setStepId(LBL_STEPS[stepIndex + 1].id); }}><ChevronRight size={18} /></button>
    </nav>
    <article className="lbl-lesson" key={`${lessonIndex}-${step.id}`}>
      <div className="lbl-intro">
        <h2>{tr(step.title)}</h2>
        <p className="lbl-goal">{tr(step.goal)}</p>
      </div>
      <div className="lbl-demo">
        <div className="lbl-cube">
          <AlgPlayer key={`${lessonIndex}-${step.id}`} puzzle="3x3" set="" engine="sim" orientation="z2"
            alg={frame.alg} setup={frame.setup} fillPane moveDurationMs={isDaisyStep ? 1500 : 650} />
        </div>
        {frame.stageId && <div className="lbl-daisy-sequence">
          <span><T zh="本步解法" en="This step's algorithm" /></span>
          <code className="lbl-alg">{frame.alg || tr({ zh: '已经是黄色十字，无需操作', en: 'Yellow cross already complete' })}</code>
        </div>}
        <p className="lbl-help"><Move3d size={16} /><T zh="拖动看视角，播放学动作" en="Drag to explore. Play to learn." /></p>
        {isDaisyStep && <DaisyChallenge examples={step.examples} open={daisyHintOpen}
          onToggle={() => setDaisyHintOpen(open => !open)}
          onNextScramble={() => {
            lessonDrawn.current = true;
            setLessonIndex(index => (index + 1) % LBL_LESSON_RUNS.length);
            setDaisyHintOpen(false);
          }} />}
      </div>
      <aside className="lbl-visuals">
        {!isDaisyStep && <div className="lbl-cases" role="group" aria-label={tr({ zh: '常见情况参考', en: 'Common case references' })}>
          {step.examples.map(e => <article key={e.title.en} className="lbl-case lbl-reference-case">
            <VisualCube local view="iso" scheme="yogwrb" size={84} setup={new Alg(resolvePlayerSetup('3x3', e.alg, e.setup, e.startSolved ?? false)).expand().toString()} alt={tr(e.title)} />
            <span>{tr(e.title)}</span>
            <code>{e.alg}</code>
          </article>)}
        </div>}
        {frame.stageId
          ? <>
            <div className="lbl-daisy-scramble">
              <span><T zh="本次初始打乱" en="Initial scramble for this lesson" /></span>
              <code>{lesson.scramble}</code>
            </div>
            <div className="lbl-comparison">
              <figure><VisualCube local view="plan" scheme="yogwrb" size={90} setup={beforeSetup} alt={tr({ zh: '本步开始状态', en: 'State before this step' })} /><figcaption><T zh="本步开始" en="Before this step" /></figcaption></figure>
              <ArrowRight size={20} aria-hidden="true" />
              <figure><VisualCube local view="plan" scheme="yogwrb" size={90} setup={afterSetup} alt={tr({ zh: '本步完成状态', en: 'State after this step' })} /><figcaption><T zh="本步完成" en="After this step" /></figcaption></figure>
            </div>
            {simQuery && <Link className="lbl-practice lbl-glass" href={`/sim?${simQuery}`} prefetch={false}><T zh="自己试一遍本步" en="Practice this step" /><ArrowRight size={16} /></Link>}
          </>
          : <div className="lbl-comparison">
            <figure><VisualCube local view="plan" scheme="yogwrb" size={90} setup={beforeSetup} alt={tr({ zh: '复原状态', en: 'Solved state' })} /><figcaption><T zh="复原状态" en="Solved state" /></figcaption></figure>
          </div>}
      </aside>
      <details className="lbl-details">
        <summary><T zh="详细说明" en="More guidance" /></summary>
        {step.paragraphs.map((p, i) => <p key={i}>{tr(p)}</p>)}
      </details>
    </article>
  </main>;
}
