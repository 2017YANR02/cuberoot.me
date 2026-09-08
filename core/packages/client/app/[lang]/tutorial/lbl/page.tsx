'use client';

import { useState } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import BackHome from '@/components/BackHome';
import Link from '@/components/AppLink';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { CompactSelect } from '@/components/CompactSelect';
import JsonLd from '@/components/JsonLd';
import { tr, T } from '@/i18n/tr';
import { LBL_STEPS } from './content';
import './lbl.css';

export default function LblTutorial() {
  const [stepId, setStepId] = useQueryState('step', parseAsStringEnum(LBL_STEPS.map(s => s.id)).withDefault('structure').withOptions({ history: 'push' }));
  const stepIndex = Math.max(0, LBL_STEPS.findIndex(s => s.id === stepId));
  const step = LBL_STEPS[stepIndex];
  // Keep example selection tied to its step, including browser back/forward navigation.
  const [selection, setSelection] = useState({ step: '', index: 0 });
  const exampleIndex = selection.step === step.id ? Math.min(selection.index, step.examples.length - 1) : 0;
  const demo = step.examples[exampleIndex];
  const simQuery = new URLSearchParams({ puzzle: '3x3', alg: demo.alg, anchor: demo.startSolved || demo.setup ? 'start' : 'end', stickeringRot: 'z2' });
  if (demo.setup) simQuery.set('setup', demo.setup);

  return <main className="lbl-page">
    <header className="lbl-header">
      <BackHome />
      <Link href="/tutorial?puzzle=3x3" prefetch={false}><T zh="教程" en="Tutorials" /></Link>
      <h1><T zh="层先法" en="LBL" /></h1>
      <p><T zh="三阶魔方，从第一朵小花到六面复原。" en="Solve the 3×3, from your first daisy to all six faces." /></p>
    </header>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Article', headline: tr({ zh: '三阶魔方层先法', en: '3×3 LBL tutorial' }), description: tr({ zh: '配有交互演示的层先法入门教程。', en: 'A beginner layer-by-layer guide with interactive demonstrations.' }) }} />
    <nav className="lbl-nav" aria-label={tr({ zh: '教程步骤', en: 'Tutorial steps' })}>
      <span className="lbl-progress">{stepIndex + 1} / {LBL_STEPS.length}</span>
      <CompactSelect label={tr(step.title)} value={step.id} ariaLabel={tr({ zh: '选择步骤', en: 'Choose a step' })}
        items={LBL_STEPS.map((s, i) => ({ value: s.id, label: `${i + 1}. ${tr(s.title)}` }))}
        onChange={value => { void setStepId(value); }} />
    </nav>
    <article className="lbl-lesson" key={step.id}>
      <div className="lbl-copy">
        <h2>{tr(step.title)}</h2>
        <p className="lbl-goal">{tr(step.goal)}</p>
        {step.paragraphs.map((p, i) => <p key={i}>{tr(p)}</p>)}
      </div>
      <div className="lbl-demo">
        <CompactSelect label={tr(demo.title)} value={exampleIndex} ariaLabel={tr({ zh: '选择演示情况', en: 'Choose an example' })}
          items={step.examples.map((e, i) => ({ value: i, label: tr(e.title) }))}
          onChange={index => setSelection({ step: step.id, index })} />
        <div className="lbl-cube">
          <AlgPlayer key={`${step.id}-${exampleIndex}`} puzzle="3x3" set="" engine="sim" orientation="z2"
            alg={demo.alg} setup={demo.setup} startSolved={demo.startSolved} fillPane moveDurationMs={650} />
        </div>
        <code className="lbl-alg">{demo.alg}</code>
        <p>{tr(demo.hint)}</p>
        <p className="lbl-help"><T zh="拖动魔方换视角，用下方按钮播放或逐步观察。" en="Drag the cube to change your view. Use the controls to play or step through." /></p>
        <Link href={`/sim?${simQuery}`} prefetch={false}><T zh="在模拟器中自由练习" en="Practice freely in the simulator" /></Link>
      </div>
    </article>
    <nav className="lbl-footer" aria-label={tr({ zh: '步骤导航', en: 'Step navigation' })}>
      <button type="button" disabled={stepIndex === 0} onClick={() => { void setStepId(LBL_STEPS[stepIndex - 1].id); }}><T zh="上一步" en="Previous step" /></button>
      <button type="button" disabled={stepIndex === LBL_STEPS.length - 1} onClick={() => { void setStepId(LBL_STEPS[stepIndex + 1].id); }}><T zh="下一步" en="Next step" /></button>
    </nav>
  </main>;
}
