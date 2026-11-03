'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Alg } from 'cubing/alg';
import { Axis } from '@cuberoot/visualcube';
import { ArrowRight, Play } from '@app-foundation/icons/lucide';
import { parseAsString, parseAsStringEnum, useQueryState, useQueryStates } from 'nuqs';
import PageBackLink from '@/components/PageBackLink';
import Link from '@/components/AppLink';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { pickStickering } from '@/components/AlgPlayer/stickering';
import { stickeringMaskFn, mergeStickeringMaskFns, FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { resolveStageMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/vcStageMask';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { VisualCube } from '@/components/VisualCube';
import { CompactSelect } from '@/components/CompactSelect';
import JsonLd from '@/components/JsonLd';
import { tr, T } from '@/i18n/tr';
import { LBL_STEPS, LESSON_STICKERING, LBL_STAGE_GOALS, LBL_INITIAL_VIEW, LBL_LEARNING_FOCUS } from './content';
import BasicsCards from './BasicsCards';
import Practice from './Practice';
import Walkthrough from './Walkthrough';
import CompleteDemo, { type DemoCaseCue } from './CompleteDemo';
import MiddleCases, { MiddleCaseDiagram } from './MiddleCases';
import LastLayerTerms, { LastLayerTermDiagram } from './LastLayerTerms';
import { COMPLETE_DEMO_STAGES, yellowFaceTouchSticker, yellowFishRecognitionStickers, type CompleteDemoStage } from './complete-demo-state';
import { useStartInspection } from './use-start-inspection';
import { usePlayerVisible } from './use-player-visible';
import AlgSteps from './AlgSteps';
import AlgLesson from './AlgLesson';
import ContinueButton from './ContinueButton';
import ChapterProgress from './ChapterProgress';
import { ALG_LESSONS, LBL_COURSE_ENTRIES } from './alg-lessons';
import { getLblAlgGroups } from './alg-cues';
import { INSTRUCTION_PHASES, splitInstruction } from './instruction-phases';
import type { LblExample } from './content';
import './lbl.css';

// Select established simulator stages; masks follow piece identity during turns.
// Semantic grip cues, not playable cube states. VisualCube uses U R F D L B order:
// U1/U3/U4/U5/U7 form the cross; F0 or L2 marks the front-left corner's yellow side.
const thumbCueColors = [18, 38].map((side, index) => {
  const colors = Array<string>(54).fill(FM_FIXED_COLOR[FM_IGNORED]!);
  for (const index of [1, 3, 4, 5, 7, side]) colors[index] = orientedCubeFaceColors('z2').U;
  if (index === 0) for (const corner of [0, 2]) colors[corner] = orientedCubeFaceColors('z2').U;
  return colors;
});

// Four-gray lesson only: retain U6 so the thumb touches visible yellow before
// positioning; U2 becomes the fish head. Hide only the remaining U8 sticker.
const FOUR_GRAY_HIDDEN_STICKERS = ['U8'] as const;
const ANGLED_LAST_LAYER_VIEW = { x: 25 * Math.PI / 180, y: -25 * Math.PI / 180, z: 0 };
const FOUR_GRAY_VIEW = { x: 25 * Math.PI / 180, y: 30 * Math.PI / 180, z: 0 };
const CROSS_INITIAL_VIEW = { x: Math.PI / 18, y: -Math.PI / 8, z: 0 };
const CROSS_FINISH_VIEW = { x: -Math.PI / 4, y: -Math.PI / 6, z: 0 };

// Recognition thumbnails show the target white corner after positioning, before
// the trigger. Keep the full preparation sequence in the animation unchanged.
const cornerCaseDiagrams = LBL_STEPS.find(step => step.id === 'corners')!.examples.map((example, index) => {
  const moves = new Alg(example.alg).expand().toString().split(/\s+/);
  const preparation = moves.slice(0, index === 1 ? 1 : 2).join(' ');
  return {
    setup: new Alg(`${resolvePlayerSetup('3x3', example.alg, example.setup, example.startSolved ?? false)} ${preparation}`).expand().toString(),
    viewportRotations: [[Axis.Y, index === 2 ? -30 : 30], [Axis.X, -25]] as [Axis, number][],
  };
});

// Original SVGs embedded in LBL-CHS.docx; each completed stage starts the next.
const documentStageImages: Record<string, [string, string]> = {
  daisy: ['centers', 'daisy'],
  cross: ['daisy', 'white-cross'],
  corners: ['white-cross', 'first-layer'],
  middle: ['first-layer', 'middle'],
  'yellow-cross': ['middle', 'yellow-cross'],
  'yellow-face': ['yellow-cross', 'yellow-face'],
  'corner-position': ['yellow-face', 'corner-position'],
  'edge-position': ['corner-position', 'edge-position'],
};

export default function LblTutorial() {
  const [{ step: stepId }, setChapterQuery] = useQueryStates({
    step: parseAsStringEnum(LBL_COURSE_ENTRIES.map(s => s.id)).withDefault('structure'),
    topic: parseAsString,
    basics: parseAsString,
  }, { history: 'push' });
  const setStepId = (id: string) => setChapterQuery({ step: id, ...(id === 'structure' ? { topic: null, basics: null } : {}) });
  const [view] = useQueryState('view', parseAsStringEnum(['lesson', 'practice', 'walkthrough']).withDefault('lesson').withOptions({ history: 'push' }));
  const stepIndex = Math.max(0, LBL_STEPS.findIndex(s => s.id === stepId));
  const step = LBL_STEPS[stepIndex];
  const courseIndex = Math.max(0, LBL_COURSE_ENTRIES.findIndex(s => s.id === stepId));
  const entry = LBL_COURSE_ENTRIES[courseIndex];
  const algLesson = ALG_LESSONS.find(lesson => lesson.id === stepId);
  const nextStep = LBL_COURSE_ENTRIES[courseIndex + 1];
  const progress = <ChapterProgress current={algLesson ? LBL_STEPS[LBL_STEPS.findIndex(s => s.id === algLesson.after) + 1].id : step.id} />;
  const lastLayer = stepIndex >= 5;
  const planCases = step.id === 'yellow-face' || step.id === 'corner-position';
  const stickerColors = useMemo(() => {
    const name = pickStickering('3x3', LESSON_STICKERING[step.id] ?? '', 'sim');
    const mask = name ? stickeringMaskFn(3, name) ?? resolveStageMaskFn(3, name) : null;
    return stageStickerColors(3, mask, orientedCubeFaceColors('z2'));
  }, [step.id]);
  const diagramMask = { stickerColors, stickerMaskColor: FM_FIXED_COLOR[FM_IGNORED] };
  const caseStickerColors = useMemo(() => {
    if (!lastLayer) return stickerColors;
    const name = pickStickering('3x3', LESSON_STICKERING[step.id], 'sim');
    const mask = name ? stickeringMaskFn(3, name) ?? resolveStageMaskFn(3, name) : null;
    return stageStickerColors(3, mergeStickeringMaskFns([mask, stickeringMaskFn(3, 'F2L')]), orientedCubeFaceColors('z2'));
  }, [lastLayer, step.id, stickerColors]);
  // Keep example selection tied to its step, including browser back/forward navigation.
  const [selection, setSelection] = useState({ step: '', index: -1 });
  const continueChapter = nextStep ? () => { setSelection({ step: '', index: -1 }); void setStepId(nextStep.id); } : undefined;
  const [demoCaseCue, setDemoCaseCue] = useState<DemoCaseCue>(null);
  const overview = selection.step !== step.id || selection.index === -1;
  const overviewTransition = useRef<ViewTransition | null>(null);
  useEffect(() => () => {
    overviewTransition.current?.skipTransition();
    document.documentElement.classList.remove('lbl-overview-transition');
  }, []);
  const selectSubsection = (index: number) => {
    overviewTransition.current?.skipTransition();
    const update = () => setSelection({ step: step.id, index });
    if (!overview || index === -1 || !document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 1050px)').matches) {
      document.documentElement.classList.remove('lbl-overview-transition');
      update();
      return;
    }
    // Snapshot only the named diagrams, never the newly mounted WebGL canvas.
    document.documentElement.classList.add('lbl-overview-transition');
    const transition = document.startViewTransition(() => flushSync(update));
    overviewTransition.current = transition;
    void transition.finished.catch(() => {}).then(() => {
      if (overviewTransition.current !== transition) return;
      overviewTransition.current = null;
      document.documentElement.classList.remove('lbl-overview-transition');
    });
  };
  const middleCore = step.id === 'middle' && selection.step === step.id && selection.index === -2;
  const hasTerms = ['middle', 'corner-position', 'edge-position'].includes(step.id);
  const lastLayerTerms = hasTerms && step.id !== 'middle' && selection.step === step.id && selection.index === -2;
  const hasCompleteDemo = COMPLETE_DEMO_STAGES.includes(step.id as CompleteDemoStage);
  const completeDemo = hasCompleteDemo && selection.step === step.id && selection.index === step.examples.length;
  const subsectionOrder = [-1, ...(hasTerms ? [-2] : []), ...step.examples.map((_, i) => i), ...(hasCompleteDemo ? [step.examples.length] : [])];
  const selectedSubsection = selection.step === step.id ? selection.index : -1;
  const nextSubsection = subsectionOrder[subsectionOrder.indexOf(selectedSubsection) + 1];
  const exampleIndex = selection.step === step.id ? Math.max(0, Math.min(selection.index, step.examples.length - 1)) : 0;
  const demo = step.examples[exampleIndex];
  const fourGray = step.id === 'yellow-face' && exampleIndex === 3;
  const fourGrayColors = stickerColors.map((color, i) =>
    FOUR_GRAY_HIDDEN_STICKERS.some(id => id === `U${i}`) ? FM_FIXED_COLOR[FM_IGNORED]! : color);
  // Keep the same stickers visible before and after, including the future fish head.
  const comparisonBefore = fourGray ? fourGrayColors : stickerColors;
  const comparisonAfter = fourGray ? fourGrayColors : stickerColors;
  const setup = new Alg(resolvePlayerSetup('3x3', demo.alg, demo.setup, demo.startSolved ?? false)).expand().toString();
  const stageImages = documentStageImages[step.id];
  const stageGoal = LBL_STAGE_GOALS[step.id];
  const stageDiagram = (id: string, size: number, alt: string) => {
    const name = id === 'structure' ? 'centers-only' : pickStickering('3x3', LESSON_STICKERING[id], 'sim');
    const mask = name ? stickeringMaskFn(3, name) ?? resolveStageMaskFn(3, name) : null;
    const merged = mergeStickeringMaskFns([mask, ['yellow-cross', 'yellow-face', 'corner-position', 'edge-position'].includes(id) ? stickeringMaskFn(3, 'F2L') : null]);
    const colors = stageStickerColors(3, merged, orientedCubeFaceColors('z2'));
    let diagramSetup = id === 'daisy' ? 'F2 R2 B2 L2' : '';
    if (step.id === 'daisy' && id === 'structure') {
      colors.fill(FM_FIXED_COLOR[FM_IGNORED]!);
      colors[4] = orientedCubeFaceColors('z2').U;
      for (const index of [1, 3, 4, 5, 7]) colors[27 + index] = orientedCubeFaceColors('z2').D;
      diagramSetup = "R U F' L2 B R2";
    }
    if (step.id === 'cross' && id === 'daisy') {
      const fullColors = orientedCubeFaceColors('z2');
      for (const [face, offset] of [['R', 9], ['F', 18], ['L', 36], ['B', 45]] as const)
        for (const index of [4, 7]) colors[offset + index] = fullColors[face];
    }
    return <VisualCube local stickerColors={colors}
      stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]} view="iso" scheme="yogwrb" size={size}
      setup={diagramSetup} alt={alt} />;
  };
  const beforeStage = LBL_STEPS[Math.max(0, stepIndex - 1)].id;
  const caseComparison = !overview && !middleCore && !lastLayerTerms && !completeDemo;
  const stageOverview = stageImages && <div key={`${step.id}:${selectedSubsection}`} className="lbl-stage-overview" role="group" aria-label={tr({ zh: '本步开始状态与目标', en: 'Stage start and goal' })}>
    <figure><span className="lbl-stage-image" style={{ viewTransitionName: 'lbl-stage-before' }}>{caseComparison ? <VisualCube local {...diagramMask} stickerColors={comparisonBefore} view="iso" scheme="yogwrb" size={64} setup={setup}
      outlineMaskedTop={step.id === 'yellow-face' && exampleIndex >= 2}
      alt={tr({ zh: '转动前', en: 'Before' })} /> : stageDiagram(beforeStage, 64, tr(stageGoal.before))}</span></figure>
    <ArrowRight size={22} aria-hidden="true" style={{ viewTransitionName: 'lbl-stage-arrow' }} />
    <figure><span className="lbl-stage-image" style={{ viewTransitionName: 'lbl-stage-after' }}>{caseComparison ? <VisualCube local {...diagramMask} stickerColors={comparisonAfter} view="iso" scheme="yogwrb" size={64} setup={new Alg(`${setup} ${demo.alg}`).expand().toString()}
      alt={tr({ zh: '转动后', en: 'After' })} /> : stageDiagram(step.id, 64, tr(stageGoal.after))}</span>
      <figcaption>{tr(stageGoal.summary ?? stageGoal.after)}</figcaption></figure>
  </div>;
  if (view === 'practice' && !algLesson) return <Practice key={step.id} step={step.id === 'structure' ? LBL_STEPS[1] : step} />;
  if (view === 'walkthrough') return <Walkthrough />;
  const stepHeading = <div className="lbl-step-heading" role="heading" aria-level={2}>
    <CompactSelect className="lbl-step-select" variant="plain" label={`${entry.number === null ? '' : `${entry.number}. `}${tr(entry.title)}`} value={entry.id} ariaLabel={tr({ zh: '选择步骤', en: 'Choose a step' })}
      items={LBL_COURSE_ENTRIES.map(s => ({ value: s.id, label: `${s.number === null ? '' : `${s.number}. `}${tr(s.title)}` }))}
      onChange={value => { void setStepId(value); }} />
  </div>;

  return <main className={`lbl-page lbl-tutorial-page${!algLesson && step.id === 'structure' ? ' lbl-basics-page' : ' lbl-lesson-page'}`}>
    <header className="lbl-header">
      <PageBackLink fallback="/tutorial?puzzle=3x3" />
      <Link href="/tutorial?puzzle=3x3" prefetch={false}><T zh="教程" en="Tutorials" /></Link>
      <h1><T zh="层先法" en="LBL" /></h1>
      {/* Hide until the full-solve walkthrough follows the algorithms taught here.
      <Link href="/tutorial/lbl?view=walkthrough" prefetch={false}><T zh="完整还原" en="Full solve" /></Link>
      */}
    </header>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Article', headline: tr({ zh: '三阶魔方层先法', en: '3×3 LBL tutorial' }), description: tr({ zh: '配有交互演示的层先法入门教程。', en: 'A beginner layer-by-layer guide with interactive demonstrations.' }) }} />
    {algLesson ? <AlgLesson key={algLesson.id} lesson={algLesson} heading={stepHeading} progress={progress} onNext={continueChapter} /> : step.id === 'structure' ?
      <BasicsCards heading={stepHeading} progress={progress} onStart={() => { setSelection({ step: '', index: -1 }); void setStepId('daisy'); }} />
    : <article className="lbl-lesson" key={step.id}>
      {progress}
      <aside className="lbl-visuals" data-step={step.id}>
        <div className="lbl-intro">
          {stepHeading}
        </div>
        <CompactSelect className="lbl-subsection-select" value={String(selectedSubsection)} label={tr(selectedSubsection === -1 ? { zh: '概览', en: 'Overview' }
          : selectedSubsection === -2 ? { zh: '术语介绍', en: 'Terminology' }
          : completeDemo ? { zh: '完整演示', en: 'Complete demonstration' } : demo.title)}
          ariaLabel={tr({ zh: '选择小节', en: 'Choose a section' })}
          items={subsectionOrder.map(index => ({ value: String(index), label: tr(index === -1 ? { zh: '概览', en: 'Overview' }
            : index === -2 ? { zh: '术语介绍', en: 'Terminology' }
            : index === step.examples.length ? { zh: '完整演示', en: 'Complete demonstration' } : step.examples[index].title) }))}
          onChange={value => selectSubsection(Number(value))} />
        <div className="lbl-case-layout">
        <div className="lbl-cases" data-count={step.examples.length + 1 + (hasTerms ? 1 : 0) + (hasCompleteDemo ? 1 : 0)} role="group" aria-label={tr({ zh: '演示情况', en: 'Examples' })}>
          <button type="button" className="lbl-button lbl-case lbl-case-overview" aria-pressed={overview}
            onClick={() => selectSubsection(-1)}>
            {stageDiagram(step.id, 52, '')}
            <span><T zh="概览" en="Overview" /></span>
          </button>
          {hasTerms && <button type="button" className="lbl-button lbl-case" aria-pressed={middleCore || lastLayerTerms}
            onClick={() => selectSubsection(-2)}>
            {step.id === 'middle' ? <MiddleCaseDiagram size={52} /> : <LastLayerTermDiagram wall={step.id === 'edge-position'} size={52} />}<span><T zh="术语介绍" en="Terminology" /></span>
          </button>}
          {step.examples.map((e, i) => {
            const thumbCue = step.id === 'yellow-face' && (i === 2 || i === 3);
            const cornerDiagram = step.id === 'corners' ? cornerCaseDiagrams[i] : undefined;
            // Recognition thumbnails show the named orientation after preparation.
            const thumbnailPreparation = step.id === 'corner-position' && i === 0 ? 'y'
              : step.id === 'yellow-cross' && i < 2 ? 'U' : '';
            const thumbnailSetup = cornerDiagram?.setup ?? new Alg(`${resolvePlayerSetup('3x3', e.alg, e.setup, e.startSolved ?? false)} ${thumbnailPreparation}`).expand().toString();
            const content = thumbCue ? <>
              <strong>{tr(e.title)}</strong>
              <span>{i === 2 ? <T zh="双头鱼" en="Two-headed fish" /> : <T zh="无头鱼" en="Headless fish" />}</span>
              <VisualCube local stickerColors={thumbCueColors[i - 2]} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]} view="plan" algorithm="" size={52} alt={tr(e.title)} />
              <strong className="lbl-cue-action"><T zh="右鱼公式 → 鱼形" en="Right Sune → fish" /></strong>
            </> : <>
              <VisualCube local {...diagramMask} stickerColors={planCases ? stickerColors : caseStickerColors} view={planCases ? 'plan' : 'iso'} scheme="yogwrb" size={52} setup={thumbnailSetup}
                viewportRotations={step.id === 'middle' && i < 2 ? [[Axis.Y, i === 1 ? -30 : 30], [Axis.X, -30]] : cornerDiagram?.viewportRotations} alt={tr(e.title)} />
              <span>{tr(e.title)}{e.caption && <small>{tr(e.caption)}</small>}</span>
            </>;
            return <button type="button" key={i} className={`lbl-button lbl-case${thumbCue ? ' lbl-case-cue' : ''}`}
                data-demo-cue={completeDemo && demoCaseCue?.index === i ? 'true' : undefined}
                data-cue-paused={demoCaseCue && !demoCaseCue.playing ? 'true' : undefined}
                onClick={() => selectSubsection(i)} aria-pressed={!overview && !middleCore && !lastLayerTerms && !completeDemo && i === exampleIndex}>{content}</button>;
          })}
          {hasCompleteDemo && <button type="button" className="lbl-button lbl-case"
            aria-pressed={completeDemo} onClick={() => selectSubsection(step.examples.length)}>
            <span className="puzzle-art lbl-case-preview" aria-hidden="true">
              {stageDiagram(step.id, 52, '')}
              <Play className="lbl-case-play" size={26} />
            </span>
            <span><T zh="完整演示" en="Complete demonstration" /></span>
          </button>}
        </div>
        </div>
      </aside>
      <section className="lbl-demonstration" aria-label={tr({ zh: '转动演示', en: 'Move demonstration' })}>
        {!overview && stageOverview}
        {overview && stageImages ? <div className="lbl-chapter-overview">
          <div className="lbl-overview-diagrams">
            <span className="lbl-overview-image" style={{ viewTransitionName: 'lbl-stage-before' }}>{stageDiagram(beforeStage, 160, tr(stageGoal.before))}</span>
            <ArrowRight size={28} aria-hidden="true" style={{ viewTransitionName: 'lbl-stage-arrow' }} />
            <span className="lbl-overview-image" style={{ viewTransitionName: 'lbl-stage-after' }}>{stageDiagram(step.id, 160, tr(stageGoal.after))}</span>
          </div>
          <p>{tr(stageGoal.summary ?? stageGoal.after)}</p>
          <p className="lbl-overview-focus">{tr(LBL_LEARNING_FOCUS[step.id])}</p>
        </div> : middleCore ? <MiddleCases /> : lastLayerTerms ? <LastLayerTerms wall={step.id === 'edge-position'} /> : completeDemo ? <CompleteDemo key={step.id} stage={step.id as CompleteDemoStage} onCaseCueChange={setDemoCaseCue} />
          : <LessonDemo key={`${step.id}-${exampleIndex}`} step={step.id} demo={demo} fourGray={fourGray}
          instruction={tr(lastLayer || ['daisy', 'middle'].includes(step.id) ? demo.hint : step.paragraphs[0] ?? demo.hint)} />}
        <div className="lbl-lesson-actions">
          <Link className="lbl-practice lbl-lesson-practice" href={`/tutorial/lbl?step=${step.id}&view=practice&case=${completeDemo ? 1 : exampleIndex + 1}`} prefetch={false}><T zh="练习本节" en="Practice this lesson" /><ArrowRight size={16} /></Link>
          {nextSubsection !== undefined ? <ContinueButton onClick={() => selectSubsection(nextSubsection)} />
            : continueChapter && <ContinueButton onClick={continueChapter} />}
        </div>
      </section>
    </article>}
  </main>;
}

const DAISY_TARGET_STICKERS = [['D5'], ['D3'], ['D5'], ['D5'], ['D5'], ['D5']] as const;
// These cases end with choosing the next case, rather than another cube move.
const NEXT_CASE_STEPS: Record<string, readonly number[]> = {
  corners: [1], middle: [2, 3], 'yellow-cross': [2], 'yellow-face': [2, 3],
  'corner-position': [1], 'edge-position': [2],
};

function LessonDemo({ step, demo, fourGray, instruction }: { step: string; demo: LblExample; fourGray: boolean; instruction: string }) {
  const [playbackStep, setPlaybackStep] = useState(0);
  const demoPlayer = useRef<AlgPlayerHandle>(null);
  const playerVisible = usePlayerVisible(demoPlayer, `${step}:${demo.alg}:${demo.setup ?? ''}`);
  const yellowFaceCase = step === 'yellow-face';
  const touchCase = yellowFaceCase && LBL_STEPS.find(item => item.id === step)!.examples.indexOf(demo) >= 2;
  const inspecting = useStartInspection(yellowFaceCase, demoPlayer, playbackStep);
  const [alignmentReady, setAlignmentReady] = useState(false);
  useEffect(() => {
    setAlignmentReady(false);
    if (!touchCase || playbackStep !== 1) return;
    let frame = 0;
    const settled = () => {
      if (demoPlayer.current?.isUserMovePending?.()) frame = requestAnimationFrame(settled);
      else setAlignmentReady(true);
    };
    frame = requestAnimationFrame(settled);
    return () => cancelAnimationFrame(frame);
  }, [touchCase, playbackStep]);
  const touchHighlights = useMemo(() => {
    if (!yellowFaceCase) return undefined;
    const index = LBL_STEPS.find(item => item.id === step)!.examples.indexOf(demo);
    const setup = resolvePlayerSetup('3x3', demo.alg, demo.setup, demo.startSolved ?? false);
    if (index >= 2) return [yellowFaceTouchSticker(`${setup} ${playbackStep === 1 ? new Alg(demo.alg).expand().toString().split(/\s+/)[0] : ''}`)];
    // Follow the same head and fin before the example's opening U alignment.
    const alignment = new Alg(demo.alg).expand().toString().split(/\s+/)[0];
    return yellowFishRecognitionStickers(`${setup} ${alignment}`, index === 1);
  }, [yellowFaceCase, step, demo, playbackStep]);
  const groups = getLblAlgGroups(step, demo.alg);
  const moveCount = groups.reduce((count, group) => count + group.length, 0);
  const showingWhiteFace = useRef(false);
  const viewInterrupted = useRef(false);
  useEffect(() => {
    if (step !== 'cross') return;
    if (playbackStep !== moveCount) {
      if (showingWhiteFace.current) demoPlayer.current?.resetView?.();
      showingWhiteFace.current = false;
      return;
    }
    viewInterrupted.current = false;
    let frame = 0;
    let started: number | undefined;
    let previous = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reveal = (now: number) => {
      if (viewInterrupted.current) return;
      if (demoPlayer.current?.isUserMovePending?.()) {
        frame = requestAnimationFrame(reveal);
        return;
      }
      if (started === undefined) {
        started = now;
        demoPlayer.current?.resetView?.();
        showingWhiteFace.current = true;
      }
      const progress = reducedMotion ? 1 : Math.min((now - started) / 800, 1);
      const eased = progress * progress * (3 - 2 * progress);
      const delta = eased - previous;
      demoPlayer.current?.orbitView?.((CROSS_FINISH_VIEW.y - CROSS_INITIAL_VIEW.y) * delta, (CROSS_FINISH_VIEW.x - CROSS_INITIAL_VIEW.x) * delta);
      previous = eased;
      if (progress < 1) frame = requestAnimationFrame(reveal);
    };
    frame = requestAnimationFrame(reveal);
    return () => cancelAnimationFrame(frame);
  }, [step, playbackStep, moveCount]);
  const phrases = instruction.split(' → ');
  const groupedInstruction = step === 'middle' && phrases.length === groups.length && phrases.length > 1;
  const activeMove = Math.max(0, playbackStep - 1);
  const exampleIndex = LBL_STEPS.find(item => item.id === step)!.examples.indexOf(demo);
  const phases = INSTRUCTION_PHASES[step]?.[exampleIndex] ?? [];
  const instructionParts = splitInstruction(instruction, phases, tr);
  const rows: { text: string; moves: number[]; note: string }[] = [];
  if (groupedInstruction) {
    phrases.forEach((text, i) => rows.push({ text, moves: groups[i].map(move => move.index + 1), note: '' }));
  } else {
    let prefix = '';
    for (const part of instructionParts) {
      if (part.moves) {
        rows.push({ text: prefix + part.text, moves: part.moves, note: '' });
        prefix = '';
      } else if (rows.length) {
        // Keep observation and next-case guidance beside the phase it follows.
        rows[rows.length - 1].note += part.text;
      } else prefix += part.text;
    }
  }
  const stepMarkers = rows.slice(0, -1).map(row => Math.max(...row.moves));
  const cleanNote = (text: string) => {
    const note = text.replace(/^[\s，。、；：,.!;:→“”]+|[\s，。、；：,.!;:→]+$/g, '').trim();
    return /^(再|先|做|做完|then(?: do)?|and(?: then)?(?: do)?)$/.test(note) ? '' : note;
  };
  if (NEXT_CASE_STEPS[step]?.includes(exampleIndex) && rows.length) {
    const lastRow = rows[rows.length - 1];
    const nextCaseText = step === 'edge-position'
      ? tr({ zh: '找到墙，选择对应情况继续', en: 'Find the wall, then choose the matching case to continue' })
      : cleanNote(lastRow.note);
    if (nextCaseText) {
      lastRow.note = '';
      rows.push({ text: nextCaseText, moves: [], note: '' });
    }
  }
  const activeRow = playbackStep >= moveCount && rows.at(-1)?.moves.length === 0
    ? rows.length - 1 : Math.max(0, rows.findIndex(row => row.moves.includes(Math.max(1, playbackStep))));
  return <>
    <div className="lbl-demo lbl-demo-split" data-step={step} data-player-ready={playerVisible} aria-busy={!playerVisible}>
    <div className="lbl-cube" data-player-ready={playerVisible} aria-busy={!playerVisible} onPointerDownCapture={() => { viewInterrupted.current = true; }}>
      <AlgPlayer ref={demoPlayer} puzzle="3x3" set={LESSON_STICKERING[step] ?? ''} engine="sim" orientation="z2"
        additionalStickering={['yellow-cross', 'yellow-face', 'corner-position', 'edge-position'].includes(step) ? 'F2L' : undefined}
        hiddenStickers={fourGray ? FOUR_GRAY_HIDDEN_STICKERS : undefined}
        outlinedStickers={step === 'daisy' ? DAISY_TARGET_STICKERS[exampleIndex] : undefined}
        highlightedStickers={(inspecting && playbackStep === 0) || (touchCase && playbackStep === 1 && alignmentReady) ? touchHighlights : undefined}
        pauseAfterSteps={touchCase ? [1] : undefined} sectionPauseMs={touchCase ? 2000 : undefined}
        sceneRot={step === 'cross' ? CROSS_INITIAL_VIEW : fourGray ? FOUR_GRAY_VIEW : demo.sceneRot ?? (['yellow-cross', 'yellow-face', 'corner-position', 'edge-position'].includes(step) ? ANGLED_LAST_LAYER_VIEW : LBL_INITIAL_VIEW)} onStepChange={setPlaybackStep}
        highlightDaisyAlignment={step === 'cross'}
        stepMarkers={stepMarkers}
        autoPlay={playerVisible && !inspecting}
        alg={demo.alg} setup={demo.setup} startSolved={demo.startSolved} fillPane moveDurationMs={step === 'cross' ? 1500 : 1000} />
    </div>
    <ol className="lbl-demo-stages" aria-label={tr({ zh: '操作步骤', en: 'Teaching steps' })}>
      {rows.map((row, i) => <li className="lbl-demo-stage" key={i} data-mobile-current={i === activeRow}>
        <span className="lbl-demo-stage-number" aria-hidden="true">{i + 1}<span className="lbl-mobile-step-count"> / {rows.length}</span></span>
        <div className="lbl-demo-stage-body">
          <p className="lbl-instruction-phase" aria-current={row.moves.includes(activeMove + 1) ? 'step' : undefined}>{row.text}</p>
          {row.moves.length > 0 && <AlgSteps step={step} alg={demo.alg} activeMove={activeMove} moveIndices={row.moves.map(move => move - 1)} onMoveClick={index => demoPlayer.current?.playMove?.(index)} />}
          {cleanNote(row.note) && <p className="lbl-demo-stage-note">{cleanNote(row.note)}</p>}
        </div>
      </li>)}
    </ol>
    {step === 'corners' && <div className="lbl-trigger-legend">
      <span><T zh="右公式＝右手上勾下回" en="Right trigger = right hand: up, hook, down, back" /></span>
      <span><T zh="左公式＝左手上勾下回" en="Left trigger = left hand: up, hook, down, back" /></span>
    </div>}
    {step === 'yellow-cross' && <div className="lbl-trigger-legend">
      <span><T zh="右公式＝右手上勾下回" en="Right trigger = right hand: up, hook, down, back" /></span>
    </div>}
    {step === 'cross' && <p className="lbl-alg-note"><T zh="对齐要看自己的魔方，不必照抄演示的转动次数。" en="Match colors on your own cube; the number of alignment turns can differ from this demonstration." /></p>}
    </div>
  </>;
}
