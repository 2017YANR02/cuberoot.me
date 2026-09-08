'use client';

import { useState } from 'react';
import { Alg } from 'cubing/alg';
import { ArrowRight, ChevronLeft, ChevronRight, Move3d } from 'lucide-react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import BackHome from '@/components/BackHome';
import Link from '@/components/AppLink';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { VisualCube } from '@/components/VisualCube';
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
  const setup = new Alg(resolvePlayerSetup('3x3', demo.alg, demo.setup, demo.startSolved ?? false)).expand().toString();
  const simQuery = new URLSearchParams({ puzzle: '3x3', alg: demo.alg, anchor: demo.startSolved || demo.setup ? 'start' : 'end', stickeringRot: 'z2' });
  if (demo.setup) simQuery.set('setup', demo.setup);

  return <main className="lbl-page">
    <header className="lbl-header">
      <BackHome />
      <Link href="/tutorial?puzzle=3x3" prefetch={false}><T zh="教程" en="Tutorials" /></Link>
      <h1><T zh="层先法" en="LBL" /></h1>
    </header>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Article', headline: tr({ zh: '三阶魔方层先法', en: '3×3 LBL tutorial' }), description: tr({ zh: '配有交互演示的层先法入门教程。', en: 'A beginner layer-by-layer guide with interactive demonstrations.' }) }} />
    <nav className="lbl-nav lbl-glass" aria-label={tr({ zh: '教程步骤', en: 'Tutorial steps' })}>
      <button type="button" disabled={stepIndex === 0} aria-label={tr({ zh: '上一步', en: 'Previous step' })} onClick={() => { void setStepId(LBL_STEPS[stepIndex - 1].id); }}><ChevronLeft size={18} /></button>
      <span className="lbl-progress">{stepIndex + 1} / {LBL_STEPS.length}</span>
      <CompactSelect label={tr(step.title)} value={step.id} ariaLabel={tr({ zh: '选择步骤', en: 'Choose a step' })}
        items={LBL_STEPS.map((s, i) => ({ value: s.id, label: `${i + 1}. ${tr(s.title)}` }))}
        onChange={value => { void setStepId(value); }} />
      <button type="button" disabled={stepIndex === LBL_STEPS.length - 1} aria-label={tr({ zh: '下一步', en: 'Next step' })} onClick={() => { void setStepId(LBL_STEPS[stepIndex + 1].id); }}><ChevronRight size={18} /></button>
    </nav>
    <article className="lbl-lesson" key={step.id}>
      <div className="lbl-intro">
        <h2>{tr(step.title)}</h2>
        <p className="lbl-goal">{tr(step.goal)}</p>
      </div>
      <div className="lbl-demo">
        <div className="lbl-cube">
          <AlgPlayer key={`${step.id}-${exampleIndex}`} puzzle="3x3" set="" engine="sim" orientation="z2"
            alg={demo.alg} setup={demo.setup} startSolved={demo.startSolved} fillPane moveDurationMs={650} />
        </div>
        <code className="lbl-alg">{demo.alg}</code>
        <p className="lbl-help"><Move3d size={16} /><T zh="拖动看视角，播放学动作" en="Drag to explore. Play to learn." /></p>
      </div>
      <aside className="lbl-visuals">
        <div className="lbl-cases" role="group" aria-label={tr({ zh: '选择演示情况', en: 'Choose an example' })}>
          {step.examples.map((e, i) => <button type="button" key={i} className="lbl-case" aria-pressed={i === exampleIndex}
            onClick={() => setSelection({ step: step.id, index: i })}>
            <VisualCube local view="iso" scheme="yogwrb" size={84} setup={new Alg(resolvePlayerSetup('3x3', e.alg, e.setup, e.startSolved ?? false)).expand().toString()} alt={tr(e.title)} />
            <span>{tr(e.title)}</span>
          </button>)}
        </div>
        <div className="lbl-comparison">
          <figure><VisualCube local view="plan" scheme="yogwrb" size={90} setup={setup} alt={tr({ zh: '转动前', en: 'Before' })} /><figcaption><T zh="转动前" en="Before" /></figcaption></figure>
          <ArrowRight size={20} aria-hidden="true" />
          <figure><VisualCube local view="plan" scheme="yogwrb" size={90} setup={new Alg(`${setup} ${demo.alg}`).expand().toString()} alt={tr({ zh: '转动后', en: 'After' })} /><figcaption><T zh="转动后" en="After" /></figcaption></figure>
        </div>
        <p className="lbl-hint">{tr(demo.hint)}</p>
        <Link className="lbl-practice lbl-glass" href={`/sim?${simQuery}`} prefetch={false}><T zh="自由练习" en="Practice" /><ArrowRight size={16} /></Link>
      </aside>
      <details className="lbl-details">
        <summary><T zh="详细说明" en="More guidance" /></summary>
        {step.paragraphs.map((p, i) => <p key={i}>{tr(p)}</p>)}
      </details>
    </article>
  </main>;
}
