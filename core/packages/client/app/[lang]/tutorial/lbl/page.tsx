'use client';

import { useEffect, useState } from 'react';
import { Alg } from 'cubing/alg';
import { ArrowRight, ChevronLeft, ChevronRight, Lightbulb, Move3d } from 'lucide-react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import BackHome from '@/components/BackHome';
import Link from '@/components/AppLink';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { Spinner } from '@/components/Spinner/Spinner';
import { VisualCube } from '@/components/VisualCube';
import { CompactSelect } from '@/components/CompactSelect';
import JsonLd from '@/components/JsonLd';
import { normalizeScramble } from '@/lib/cross-solver';
import { buildDaisyPlayback, resolveDaisyScramble, selectWhiteDaisyFace } from '@/lib/lbl-daisy';
import { tr, T } from '@/i18n/tr';
import { DAISY_CHALLENGE_PROMPT, DAISY_HINT_INTRO, LBL_STEPS, type LblExample } from './content';
import './lbl.css';

type DaisyLessonState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; scramble: string; setup: string; alg: string; displayAlg: string; length: number }
  | { status: 'error' };

function useDaisyLesson(enabled: boolean): { state: DaisyLessonState; retry: () => void } {
  const [state, setState] = useState<DaisyLessonState>({ status: 'idle' });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      try {
        const [{ pooledScramble, randomMoveScrambleNxN }, { getRustCrossPool, poolSizeForDevice }] = await Promise.all([
          import('@/lib/cubing-scramble'),
          import('@/lib/rust-cross-pool'),
        ]);
        let rawScramble: string | null = null;
        try {
          rawScramble = await pooledScramble('333');
        } catch {
          // cubing.js's random-state worker can be unavailable in embedded browsers;
          // the local random-move generator still produces an analyzable 3x3 state.
        }
        const scramble = normalizeScramble(resolveDaisyScramble(rawScramble, randomMoveScrambleNxN(3)));
        if (!scramble) throw new Error('scramble unavailable');
        const pool = getRustCrossPool('daisy', Math.min(2, poolSizeForDevice()));
        await pool.ready;
        const scores = await pool.solveDaisyStage(scramble);
        const face = selectWhiteDaisyFace(scores);
        if (face === null) throw new Error('daisy orientation unavailable');
        const result = await pool.solveDaisyMoves(scramble, face, { extra: 0, cap: 1 });
        const displayAlg = result.sols[0]?.m ?? '';
        if (!displayAlg.trim()) throw new Error('daisy solution unavailable');
        const playback = buildDaisyPlayback(scramble, displayAlg);
        if (!cancelled) setState({ status: 'ready', scramble, ...playback, length: result.len });
      } catch (error) {
        console.warn('[LBL daisy] guided demo unavailable:', error);
        if (!cancelled) setState({ status: 'error' });
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, retryCount]);

  return { state, retry: () => setRetryCount(value => value + 1) };
}

function expandedSetup(alg: string): string {
  return new Alg(alg).expand().toString();
}

function DaisyLoadingState({ state, onRetry }: { state: DaisyLessonState; onRetry: () => void }) {
  if (state.status === 'loading') {
    return <div className="lbl-daisy-status" role="status" aria-live="polite">
      <Spinner size={18} label={tr({ zh: '正在准备小花演示', en: 'Preparing the daisy demo' })} />
      <span><T zh="正在生成随机打乱并寻找小花解法…" en="Generating a random scramble and finding a daisy solve…" /></span>
    </div>;
  }
  if (state.status !== 'error') return null;
  return <div className="lbl-daisy-status" role="alert">
    <span><T zh="随机演示暂时没有准备好。" en="The random demo is not ready yet." /></span>
    <button type="button" className="lbl-button lbl-daisy-retry" onClick={onRetry}>
      <T zh="重新生成" en="Try again" />
    </button>
  </div>;
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

function DaisyChallenge({ examples, open, onToggle }: { examples: LblExample[]; open: boolean; onToggle: () => void }) {
  return <section className="lbl-daisy-challenge lbl-glass" aria-labelledby="lbl-daisy-prompt">
    <p id="lbl-daisy-prompt" className="lbl-daisy-prompt"><Lightbulb size={20} aria-hidden="true" /><span>{tr(DAISY_CHALLENGE_PROMPT)}</span></p>
    <button type="button" className="lbl-daisy-hint-toggle" aria-expanded={open} aria-controls="lbl-daisy-hints" onClick={onToggle}>
      <Lightbulb size={16} aria-hidden="true" />
      <T zh={open ? '收起提示' : '给我一点提示'} en={open ? 'Hide hints' : 'Show me a hint'} />
    </button>
    {open && <DaisyHintCases examples={examples} />}
  </section>;
}

export default function LblTutorial() {
  const [stepId, setStepId] = useQueryState('step', parseAsStringEnum(LBL_STEPS.map(s => s.id)).withDefault('structure').withOptions({ history: 'push' }));
  const stepIndex = Math.max(0, LBL_STEPS.findIndex(s => s.id === stepId));
  const step = LBL_STEPS[stepIndex];
  const isDaisyStep = step.id === 'daisy';
  const daisyLesson = useDaisyLesson(isDaisyStep);
  const [daisyHintOpen, setDaisyHintOpen] = useState(false);
  useEffect(() => {
    if (!isDaisyStep) setDaisyHintOpen(false);
  }, [isDaisyStep]);
  // Keep example selection tied to its step, including browser back/forward navigation.
  const [selection, setSelection] = useState({ step: '', index: 0 });
  const exampleIndex = selection.step === step.id ? Math.min(selection.index, step.examples.length - 1) : 0;
  const demo = step.examples[exampleIndex];
  const setup = new Alg(resolvePlayerSetup('3x3', demo.alg, demo.setup, demo.startSolved ?? false)).expand().toString();
  const daisyDemo = isDaisyStep && daisyLesson.state.status === 'ready' ? daisyLesson.state : null;
  const beforeSetup = daisyDemo ? expandedSetup(daisyDemo.scramble) : setup;
  const afterSetup = daisyDemo ? expandedSetup(`${daisyDemo.scramble} ${daisyDemo.displayAlg}`) : expandedSetup(`${setup} ${demo.alg}`);
  const simQuery = daisyDemo
    ? new URLSearchParams({ puzzle: '3x3', alg: daisyDemo.displayAlg, anchor: 'start', stickeringRot: 'z2', setup: daisyDemo.scramble })
    : new URLSearchParams({ puzzle: '3x3', alg: demo.alg, anchor: demo.startSolved || demo.setup ? 'start' : 'end', stickeringRot: 'z2' });
  if (!daisyDemo && demo.setup) simQuery.set('setup', demo.setup);

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
    <article className="lbl-lesson" key={step.id}>
      <div className="lbl-intro">
        <h2>{tr(step.title)}</h2>
        <p className="lbl-goal">{tr(step.goal)}</p>
      </div>
      <div className="lbl-demo">
        <div className="lbl-cube">
          {isDaisyStep
            ? daisyDemo
              ? <AlgPlayer key={`daisy-${daisyDemo.scramble}-${daisyDemo.displayAlg}`} puzzle="3x3" set="" engine="sim" orientation="z2"
                alg={daisyDemo.alg} setup={daisyDemo.setup} autoPlay fillPane moveDurationMs={1500} />
              : <DaisyLoadingState state={daisyLesson.state} onRetry={daisyLesson.retry} />
            : <AlgPlayer key={`${step.id}-${exampleIndex}`} puzzle="3x3" set="" engine="sim" orientation="z2"
              alg={demo.alg} setup={demo.setup} startSolved={demo.startSolved} fillPane moveDurationMs={650} />}
        </div>
        {daisyDemo
          ? <div className="lbl-daisy-sequence">
            <span><T zh="本次小花解法" en="This daisy solve" /></span>
            <code className="lbl-alg">{daisyDemo.displayAlg}</code>
          </div>
          : !isDaisyStep && <code className="lbl-alg">{demo.alg}</code>}
        <p className="lbl-help"><Move3d size={16} /><T zh="拖动看视角，播放学动作" en="Drag to explore. Play to learn." /></p>
        {daisyDemo && <DaisyChallenge examples={step.examples} open={daisyHintOpen} onToggle={() => setDaisyHintOpen(open => !open)} />}
      </div>
      <aside className="lbl-visuals">
        {!isDaisyStep && <div className="lbl-cases" role="group" aria-label={tr({ zh: '选择演示情况', en: 'Choose an example' })}>
          {step.examples.map((e, i) => <button type="button" key={i} className="lbl-button lbl-case" aria-pressed={i === exampleIndex}
            onClick={() => setSelection({ step: step.id, index: i })}>
            <VisualCube local view="iso" scheme="yogwrb" size={84} setup={new Alg(resolvePlayerSetup('3x3', e.alg, e.setup, e.startSolved ?? false)).expand().toString()} alt={tr(e.title)} />
            <span>{tr(e.title)}</span>
          </button>)}
        </div>}
        {daisyDemo
          ? <>
            <div className="lbl-daisy-scramble">
              <span><T zh="随机打乱" en="Random scramble" /></span>
              <code>{daisyDemo.scramble}</code>
            </div>
            <div className="lbl-comparison">
              <figure><VisualCube local view="plan" scheme="yogwrb" size={90} setup={beforeSetup} alt={tr({ zh: '打乱状态', en: 'Scrambled state' })} /><figcaption><T zh="打乱状态" en="Scrambled" /></figcaption></figure>
              <ArrowRight size={20} aria-hidden="true" />
              <figure><VisualCube local view="plan" scheme="yogwrb" size={90} setup={afterSetup} alt={tr({ zh: '小花状态', en: 'Daisy state' })} /><figcaption><T zh="小花状态" en="Daisy" /></figcaption></figure>
            </div>
            <Link className="lbl-practice lbl-glass" href={`/sim?${simQuery}`} prefetch={false}><T zh="自己试一遍" en="Try it yourself" /><ArrowRight size={16} /></Link>
          </>
          : !isDaisyStep && <>
            <div className="lbl-comparison">
              <figure><VisualCube local view="plan" scheme="yogwrb" size={90} setup={beforeSetup} alt={tr({ zh: '转动前', en: 'Before' })} /><figcaption><T zh="转动前" en="Before" /></figcaption></figure>
              <ArrowRight size={20} aria-hidden="true" />
              <figure><VisualCube local view="plan" scheme="yogwrb" size={90} setup={afterSetup} alt={tr({ zh: '转动后', en: 'After' })} /><figcaption><T zh="转动后" en="After" /></figcaption></figure>
            </div>
            <p className="lbl-hint">{tr(demo.hint)}</p>
            <Link className="lbl-practice lbl-glass" href={`/sim?${simQuery}`} prefetch={false}><T zh="自由练习" en="Practice" /><ArrowRight size={16} /></Link>
          </>}
        {isDaisyStep && !daisyDemo && <p className="lbl-daisy-side-status"><T zh="小花演示准备好后，会在这里显示打乱状态和完成状态。" en="The scramble and finished state will appear here when the daisy demo is ready." /></p>}
      </aside>
      <details className="lbl-details">
        <summary><T zh="详细说明" en="More guidance" /></summary>
        {step.paragraphs.map((p, i) => <p key={i}>{tr(p)}</p>)}
      </details>
    </article>
  </main>;
}
