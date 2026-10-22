'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { Alg } from 'cubing/alg';
import { Axis } from '@cuberoot/visualcube';
import { ArrowRight } from '@app-foundation/icons/lucide';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import BackHome from '@/components/BackHome';
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
import { LBL_STEPS, LESSON_STICKERING, LBL_STAGE_GOALS, LBL_INITIAL_VIEW } from './content';
import BasicsCards from './BasicsCards';
import Practice from './Practice';
import Walkthrough from './Walkthrough';
import AlgSteps from './AlgSteps';
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

// A cropped face row illustrates the definitions using the shared cube renderer.
const definitionRows = [false, true].map(wall => {
  const colors = Array<string>(54).fill(FM_FIXED_COLOR[FM_IGNORED]!);
  for (const index of wall ? [0, 1, 2] : [0, 2]) colors[index] = orientedCubeFaceColors('z2').L;
  return colors;
});

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
  const [stepId, setStepId] = useQueryState('step', parseAsStringEnum(LBL_STEPS.map(s => s.id)).withDefault('structure').withOptions({ history: 'push' }));
  const [view] = useQueryState('view', parseAsStringEnum(['lesson', 'practice', 'walkthrough']).withDefault('lesson').withOptions({ history: 'push' }));
  const stepIndex = Math.max(0, LBL_STEPS.findIndex(s => s.id === stepId));
  const step = LBL_STEPS[stepIndex];
  const nextStep = LBL_STEPS[stepIndex + 1];
  const showComparison = !['daisy', 'cross', 'corners', 'middle'].includes(step.id);
  const lastLayer = stepIndex >= 5;
  const guidanceUnderTitle = lastLayer || step.id === 'daisy';
  const sidebarGuidance = guidanceUnderTitle ? step.paragraphs : step.paragraphs.slice(1);
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
  const [selection, setSelection] = useState({ step: '', index: 0 });
  const exampleIndex = selection.step === step.id ? Math.min(selection.index, step.examples.length - 1) : 0;
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
  const stageOverview = stageImages && <div className="lbl-stage-overview" role="group" aria-label={tr({ zh: '本步开始状态与目标', en: 'Stage start and goal' })}>
    <figure><img className="puzzle-art" src={`/tutorial/lbl/document-${stageImages[0]}.svg`} width={64} height={64} alt={tr(stageGoal.before)} /></figure>
    <ArrowRight size={22} aria-hidden="true" />
    <figure><img className="puzzle-art" src={`/tutorial/lbl/document-${stageImages[1]}.svg`} width={64} height={64} alt={tr(stageGoal.after)} /><figcaption>{tr(stageGoal.summary ?? stageGoal.after)}</figcaption></figure>
  </div>;
  if (view === 'practice') return <Practice key={step.id} step={step.id === 'structure' ? LBL_STEPS[1] : step} />;
  if (view === 'walkthrough') return <Walkthrough />;
  const stepHeading = <div className="lbl-step-heading" role="heading" aria-level={2}>
    <CompactSelect className="lbl-step-select" variant="plain" label={`${stepIndex + 1}. ${tr(step.title)}`} value={step.id} ariaLabel={tr({ zh: '选择步骤', en: 'Choose a step' })}
      items={LBL_STEPS.map((s, i) => ({ value: s.id, label: `${i + 1}. ${tr(s.title)}` }))}
      onChange={value => { void setStepId(value); }} />
  </div>;

  return <main className={`lbl-page lbl-tutorial-page${step.id === 'structure' ? ' lbl-basics-page' : ' lbl-lesson-page'}`}>
    <header className="lbl-header">
      <BackHome />
      <Link href="/tutorial?puzzle=3x3" prefetch={false}><T zh="教程" en="Tutorials" /></Link>
      <h1><T zh="层先法" en="LBL" /></h1>
      <Link href="/tutorial/lbl?view=walkthrough" prefetch={false}><T zh="完整还原" en="Full solve" /></Link>
    </header>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Article', headline: tr({ zh: '三阶魔方层先法', en: '3×3 LBL tutorial' }), description: tr({ zh: '配有交互演示的层先法入门教程。', en: 'A beginner layer-by-layer guide with interactive demonstrations.' }) }} />
    {step.id === 'structure' ?
      <BasicsCards heading={stepHeading} onStart={() => { void setStepId('daisy'); }} />
    : <article className="lbl-lesson" key={step.id}>
      <aside className="lbl-visuals" data-step={step.id}>
        <div className="lbl-intro">
          {stepHeading}
        </div>
        <div className="lbl-stage-mobile">{stageOverview}</div>
        {guidanceUnderTitle && sidebarGuidance.length > 0 && <div className="lbl-guidance lbl-guidance-under-title">
          {sidebarGuidance.map((p, i) => <p key={i}>{tr(p)}
            {['corner-position', 'edge-position'].includes(step.id) && i === 0 && <span className="lbl-definition-row">
              <VisualCube local view="plan" size={96} stickerColors={definitionRows[step.id === 'edge-position' ? 1 : 0]}
                stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]}
                alt={step.id === 'edge-position' ? tr({ zh: '墙：三个同色格', en: 'Wall: three matching stickers' }) : tr({ zh: '眼：两侧同色，中间不看', en: 'Headlights: matching ends; ignore the middle' })} />
            </span>}
            {step.id === 'corner-position' && i === 0 && <T zh="，再选择下面对应的情况。" en=", then choose the matching case below." />}
            {step.id === 'edge-position' && i === 0 && <T zh="时，转体把墙放后，再看前棱应与左侧还是右侧对齐。没有墙时，选择“无墙 · 先造墙”。" en=", rotate the whole cube to put it at the back, then check whether the front edge matches the left or right center. If there is no wall, choose “No wall · Create a wall”." />}
          </p>)}
        </div>}
        <div className="lbl-case-layout">
        <div className="lbl-cases" data-count={step.examples.length} role="group" aria-label={tr({ zh: '演示情况', en: 'Examples' })}>
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
              <VisualCube local {...diagramMask} stickerColors={planCases ? stickerColors : caseStickerColors} view={planCases ? 'plan' : 'iso'} scheme="yogwrb" size={52} setup={thumbnailSetup} viewportRotations={cornerDiagram?.viewportRotations} alt={tr(e.title)} />
              <span>{tr(e.title)}{e.caption && <small>{tr(e.caption)}</small>}</span>
            </>;
            return step.examples.length === 1
              ? <div key={i} className="lbl-case lbl-case-single">{content}</div>
              : <button type="button" key={i} className={`lbl-button lbl-case${thumbCue ? ' lbl-case-cue' : ''}`} aria-pressed={i === exampleIndex}
                onClick={() => setSelection({ step: step.id, index: i })}>{content}</button>;
          })}
        </div>
        {showComparison && <div className="lbl-comparison">
          <figure><VisualCube local {...diagramMask} stickerColors={comparisonBefore} view="plan" scheme="yogwrb" size={96} setup={setup}
            outlineMaskedTop={step.id === 'yellow-face' && exampleIndex >= 2}
            alt={tr({ zh: '转动前', en: 'Before' })} /><figcaption><T zh="转动前" en="Before" /></figcaption></figure>
          <ArrowRight size={20} aria-hidden="true" />
          <figure><VisualCube local {...diagramMask} stickerColors={comparisonAfter} view="plan" scheme="yogwrb" size={96} setup={new Alg(`${setup} ${demo.alg}`).expand().toString()} alt={tr({ zh: '转动后', en: 'After' })} /><figcaption>{step.id === 'yellow-face' && exampleIndex >= 2 ? <T zh="转动后：3灰，再判断" en="After: 3 gray; reassess" /> : step.id === 'edge-position' && exampleIndex === 2 ? <T zh="转动后：有墙，再判断" en="After: a wall; reassess" /> : <T zh="转动后" en="After" />}</figcaption></figure>
        </div>}
        </div>
        {!guidanceUnderTitle && sidebarGuidance.length > 0 && <div className="lbl-guidance">
          {sidebarGuidance.map((p, i) => <p key={i}>{tr(p)}</p>)}
        </div>}
      </aside>
      <section className="lbl-demonstration" aria-label={tr({ zh: '转动演示', en: 'Move demonstration' })}>
        <div className="lbl-stage-desktop">{stageOverview}</div>
        <LessonDemo key={`${step.id}-${exampleIndex}`} step={step.id} demo={demo} fourGray={fourGray}
          instruction={tr(lastLayer || ['daisy', 'middle'].includes(step.id) ? demo.hint : step.paragraphs[0] ?? demo.hint)} />
        <div className="lbl-lesson-actions">
          <Link className="lbl-practice lbl-lesson-practice" href={`/tutorial/lbl?step=${step.id}&view=practice&case=${exampleIndex + 1}`} prefetch={false}><T zh="练习本节" en="Practice this lesson" /><ArrowRight size={16} /></Link>
          {nextStep && <Link className="lbl-practice lbl-next-lesson" href={`/tutorial/lbl?step=${nextStep.id}`} prefetch={false}>
            <span><T zh="下一节：" en="Next: " />{nextStep.id === 'cross' ? tr({ zh: '白色十字', en: 'White cross' }) : tr(nextStep.title)}</span><ArrowRight size={16} />
          </Link>}
        </div>
      </section>
    </article>}
  </main>;
}

const DAISY_TARGET_STICKERS = [['D5'], ['D5'], ['D3'], ['D5'], ['D5'], ['D5']] as const;
// These cases end with choosing the next case, rather than another cube move.
const NEXT_CASE_STEPS: Record<string, readonly number[]> = {
  corners: [1], middle: [2], 'yellow-cross': [2], 'yellow-face': [2, 3],
  'corner-position': [1], 'edge-position': [2],
};

function LessonDemo({ step, demo, fourGray, instruction }: { step: string; demo: LblExample; fourGray: boolean; instruction: string }) {
  const [playbackStep, setPlaybackStep] = useState(0);
  const demoPlayer = useRef<AlgPlayerHandle>(null);
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
  return <>
    <div className="lbl-demo lbl-demo-split" data-step={step}>
    <div className="lbl-cube" onPointerDownCapture={() => { viewInterrupted.current = true; }}>
      <AlgPlayer ref={demoPlayer} puzzle="3x3" set={LESSON_STICKERING[step] ?? ''} engine="sim" orientation="z2"
        additionalStickering={['yellow-cross', 'yellow-face', 'corner-position', 'edge-position'].includes(step) ? 'F2L' : undefined}
        hiddenStickers={fourGray ? FOUR_GRAY_HIDDEN_STICKERS : undefined}
        outlinedStickers={step === 'daisy' ? DAISY_TARGET_STICKERS[exampleIndex] : undefined}
        sceneRot={step === 'cross' ? CROSS_INITIAL_VIEW : fourGray ? FOUR_GRAY_VIEW : demo.sceneRot ?? (['yellow-cross', 'yellow-face', 'corner-position', 'edge-position'].includes(step) ? ANGLED_LAST_LAYER_VIEW : LBL_INITIAL_VIEW)} onStepChange={setPlaybackStep}
        highlightDaisyAlignment={step === 'cross'}
        stepMarkers={stepMarkers}
        autoPlay
        alg={demo.alg} setup={demo.setup} startSolved={demo.startSolved} fillPane moveDurationMs={step === 'cross' ? 1500 : 1000} />
    </div>
    <ol className="lbl-demo-stages" aria-label={tr({ zh: '操作步骤', en: 'Teaching steps' })}>
      {rows.map((row, i) => <li className="lbl-demo-stage" key={i}>
        <span className="lbl-demo-stage-number" aria-hidden="true">{i + 1}</span>
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
    {['yellow-face', 'edge-position'].includes(step) && <div className="lbl-trigger-legend">
      <span><T zh="右鱼公式＝右手上勾下勾上连拨下" en="Right Sune = right hand: up, hook, down, hook, up, double flick, down" /></span>
      <span><T zh="左鱼公式＝左手上勾下勾上连拨下" en="Left Sune = left hand: up, hook, down, hook, up, double flick, down" /></span>
    </div>}
    {step === 'cross' && <p className="lbl-alg-note"><T zh="对齐要看自己的魔方，不必照抄演示的转动次数。" en="Match colors on your own cube; the number of alignment turns can differ from this demonstration." /></p>}
    </div>
  </>;
}
