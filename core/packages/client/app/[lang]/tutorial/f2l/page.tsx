'use client';

import { useMemo, useRef, useState } from 'react';
import { Alg } from 'cubing/alg';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import BackHome from '@/components/BackHome';
import Link from '@/components/AppLink';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import BoolToggle from '@/components/BoolToggle';
import { CompactSelect } from '@/components/CompactSelect';
import { SubsetSwatch, type ColorLetter } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { VisualCube } from '@/components/VisualCube';
import JsonLd from '@/components/JsonLd';
import HeaderToggles from '@/components/HeaderToggles';
import { CUBE_COLOR_NAMES, CUBE_COLOR_LETTER_FOR_FACE, type CubeFace } from '@/lib/cube-colors';
import { CUBE_ORIENTATIONS, orientedFaceColors } from '@/lib/cube-orientation';
import { tr, T } from '@/i18n/tr';
import {
  F2L_CASES, F2L_STEPS, F2L_INTRO_ALG, F2L_TOP_ADJUSTMENTS, F2L_PRACTICE_CASES,
  f2lPlaybackSections, f2lAlignmentSetup, f2lDiagramFacelets, f2lIntroStickering, f2lGoalDiagrams,
} from './content';
import './f2l.css';
import LaterLessons from './LaterLessons';
import FreePractice from './FreePractice';

const COLORS = Object.keys(CUBE_COLOR_NAMES) as CubeFace[];
const COLOR_CHOICES = CUBE_ORIENTATIONS.map(option => ({ ...option, colors: orientedFaceColors(option.value) }));
const NO_STOPS: readonly number[] = [];

/** Tutorial-only composition; shared picker behavior and API stay unchanged. */
function F2lColorSelect({ value, colors, label, choices, onChange }: {
  value: string;
  colors: ColorLetter[];
  label: string;
  choices: { key: string; colors: ColorLetter[]; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return <CompactSelect
    open={open} onOpenChange={setOpen}
    value={value} items={[]} onChange={onChange} ariaLabel={label}
    valueText={choices.find(choice => choice.key === value)?.label}
    triggerClassName="f2l-color-trigger"
    label={<span className="subset-swatch is-static" aria-hidden="true"><SubsetSwatch colors={colors} /></span>}
    panelContent={<div className="subset-picker-swatches" role="group" aria-label={label}>
      {choices.map(choice => <button key={choice.key} type="button"
        className={`subset-swatch${choice.key === value ? ' is-active' : ''}`}
        aria-label={choice.label} aria-pressed={choice.key === value}
        onClick={() => { onChange(choice.key); setOpen(false); }}>
        <SubsetSwatch colors={choice.colors} />
      </button>)}
    </div>}
  />;
}

export default function F2lTutorial() {
  const [stepId, setStepId] = useQueryState('step', parseAsStringEnum(F2L_STEPS.map(item => item.id)).withDefault('intro').withOptions({ history: 'push' }));
  const [caseId, setCaseId] = useQueryState('case', parseAsStringEnum(F2L_CASES.map(item => item.id)).withDefault(F2L_CASES[0].id).withOptions({ history: 'push' }));
  const stepIndex = Math.max(0, F2L_STEPS.findIndex(item => item.id === stepId));
  const tutorialStep = F2L_STEPS[stepIndex];
  const lesson = F2L_CASES.find(item => item.id === caseId) ?? F2L_CASES[0];
  const [bottom, setBottom] = useState<CubeFace>('D');
  const [orientation, setOrientation] = useState<string | null>('');
  const [alignment, setAlignment] = useState<string>(F2L_TOP_ADJUSTMENTS[0]);
  const [pauseBetween, setPauseBetween] = useState(true);
  const [playbackStep, setPlaybackStep] = useState(0);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const practice = F2L_PRACTICE_CASES[practiceIndex];
  const player = useRef<AlgPlayerHandle>(null);
  const sections = useMemo(() => f2lPlaybackSections(lesson.alg), [lesson.alg]);
  const boundaries = useMemo(() => sections.slice(0, -1).map(section => section.end), [sections]);
  const selectedColors = orientation !== null ? orientedFaceColors(orientation) : null;
  const activeSection = Math.max(0, sections.findIndex(section => playbackStep <= section.end));
  const diagrams = useMemo(() => orientation === null ? [] : F2L_CASES.map(item =>
    f2lDiagramFacelets(new Alg(item.alg).invert().expand().toString(), orientation),
  ), [orientation]);
  const chosenDiagram = diagrams[F2L_CASES.indexOf(lesson)];
  const goalDiagrams = useMemo(() => orientation === null ? null : f2lGoalDiagrams(orientation), [orientation]);

  const seek = (index: number) => {
    const current = player.current?.getPlayer();
    if (current) current.timestamp = index;
  };
  const selectCase = (id: typeof caseId) => {
    seek(0);
    setPlaybackStep(0);
    void setCaseId(id);
  };
  const navigate = (id: typeof stepId) => {
    setPlaybackStep(0);
    void setStepId(id);
  };
  const colorName = (face: CubeFace) => tr(CUBE_COLOR_NAMES[face]);
  const colorLetter = (face: CubeFace) => CUBE_COLOR_LETTER_FOR_FACE[face] as ColorLetter;
  const slotName = (front: CubeFace, right: CubeFace) => tr({
    zh: '前：' + colorName(front) + ' · 右：' + colorName(right),
    en: 'Front: ' + colorName(front) + ' · Right: ' + colorName(right),
  });
  const colorPrompt = <div className="f2l-placeholder"><T zh="请在上方选择底色和 FR槽颜色，查看与你朝向一致的魔方。" en="Choose a bottom color and FR slot colors above to match the cube to your orientation." /></div>;
  const pairReminder = <p className="f2l-focus"><T zh="FR 是右前槽；整个教程先在这个槽位学习。" en="FR means front-right, the target slot used throughout these lessons." /></p>;

  return <main className="f2l-page">
    <header className="f2l-header">
      <BackHome />
      <Link href="/tutorial?puzzle=3x3" prefetch={false}><T zh="教程" en="Tutorials" /></Link>
      <HeaderToggles className="f2l-header-toggles" />
      <h1><T zh="F2L 教程" en="F2L tutorial" /></h1>
    </header>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Article', headline: tr({ zh: 'F2L 教程', en: 'F2L tutorial' }), description: tr({ zh: '从认识三步标态到顶面调整，逐步学习右前槽的棱角还原。', en: 'Recognize three-move cases, align the top layer and learn front-right pair insertions.' }) }} />

    <div className="f2l-toolbar">
      <nav className="f2l-nav" aria-label={tr({ zh: '教程步骤', en: 'Tutorial steps' })}>
        <button className="f2l-nav-arrow" type="button" disabled={stepIndex === 0} aria-label={tr({ zh: '上一步', en: 'Previous step' })} onClick={() => navigate(F2L_STEPS[stepIndex - 1].id)}><ChevronLeft size={18} /></button>
        <span className="f2l-progress">{stepIndex + 1} / {F2L_STEPS.length}</span>
        <CompactSelect className="f2l-step-select" label={tr(tutorialStep.title)} value={tutorialStep.id} ariaLabel={tr({ zh: '选择步骤', en: 'Choose a step' })}
          items={F2L_STEPS.map((item, index) => ({ value: item.id, label: String(index + 1) + '. ' + tr(item.title) }))}
          onChange={navigate} />
        <button className="f2l-nav-arrow" type="button" disabled={stepIndex === F2L_STEPS.length - 1} aria-label={tr({ zh: '下一步', en: 'Next step' })} onClick={() => navigate(F2L_STEPS[stepIndex + 1].id)}><ChevronRight size={18} /></button>
      </nav>
      <div className="f2l-colors" role="group" aria-label={tr({ zh: '教程配色', en: 'Tutorial colors' })}>
        <span className="f2l-color-field">
          <span><T zh="底色" en="Bottom" /></span>
          <F2lColorSelect label={tr({ zh: '选择底色', en: 'Choose bottom color' })}
            value={bottom} colors={[colorLetter(bottom)]}
            choices={COLORS.map(face => ({ key: face, colors: [colorLetter(face)], label: colorName(face) }))}
            onChange={value => {
              const nextBottom = value as CubeFace;
              const options = COLOR_CHOICES.filter(option => option.colors.D === nextBottom);
              setBottom(nextBottom);
              setOrientation((options.find(option => option.colors.F === selectedColors?.F) ?? options[0]).value);
              setPlaybackStep(0);
            }} />
        </span>
        <span className="f2l-color-field">
          <span><T zh="FR槽" en="FR slot" /></span>
          <F2lColorSelect label={tr({ zh: '选择 FR 槽颜色', en: 'Choose FR slot colors' })}
            value={orientation ?? ''} colors={selectedColors ? [colorLetter(selectedColors.F), colorLetter(selectedColors.R)] : []}
            choices={COLOR_CHOICES.filter(option => option.colors.D === bottom).map(option => ({
              key: option.value, colors: [colorLetter(option.colors.F), colorLetter(option.colors.R)],
              label: slotName(option.colors.F, option.colors.R),
            }))}
            onChange={value => { setOrientation(value); setPlaybackStep(0); }} />
        </span>
      </div>
      <div className="f2l-playback-setting">
        <BoolToggle value={pauseBetween} onChange={setPauseBetween} label={tr({ zh: '分段停顿', en: 'Pause between sections' })} />
      </div>
    </div>

    <article className="f2l-chapter" key={tutorialStep.id}>
      <h2>{tr(tutorialStep.title)}</h2>
      <p className="f2l-chapter-summary">{tr(tutorialStep.summary)}</p>

      {stepId === 'intro' && <>
        {goalDiagrams && <figure className="f2l-goal">
          <div className="f2l-goal-diagrams">
            <div className="f2l-goal-cube">
              <VisualCube view="iso" size={190} faceletColors={goalDiagrams[0]} alt={tr({ zh: 'A：底十字已完成', en: 'A: solved bottom cross' })} />
              <span><T zh="A · 底十字完成" en="A · Cross solved" /></span>
            </div>
            <div className="f2l-goal-lbl-arrow">
              <span>LBL</span>
              <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M 3 23 Q 24 2 45 23 M 36 21 L 45 23 L 43 14" /></svg>
            </div>
            <div className="f2l-goal-cube">
              <VisualCube view="iso" size={190} faceletColors={goalDiagrams[1]} alt={tr({ zh: 'B：底层已完成', en: 'B: solved first layer' })} />
              <span><T zh="B · 完成底层" en="B · First layer solved" /></span>
            </div>
            <div className="f2l-goal-lbl-arrow">
              <span>LBL</span>
              <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M 3 23 Q 24 2 45 23 M 36 21 L 45 23 L 43 14" /></svg>
            </div>
            <div className="f2l-goal-cube">
              <VisualCube view="iso" size={190} faceletColors={goalDiagrams[2]} alt={tr({ zh: 'C：前两层已完成', en: 'C: solved first two layers' })} />
              <span><T zh="C · 前两层完成" en="C · First two layers solved" /></span>
            </div>
          </div>
          <div className="f2l-goal-f2l-arrow">
            <svg viewBox="0 0 720 90" preserveAspectRatio="none" aria-hidden="true"><path d="M 95 4 C 95 86 625 86 625 4 M 618 13 L 625 4 L 632 13" /></svg>
            <span>F2L</span>
          </div>
          <figcaption><T zh="层先法沿 A → B → C，先完成底层，再完成中层。F2L 从 A 直接走向 C，逐对还原四组棱角，完成前两层。" en="LBL follows A → B → C, solving the first layer before the middle layer. F2L goes from A directly to C, solving four edge-corner pairs to complete the first two layers." /></figcaption>
        </figure>}
        <p className="f2l-lead"><T zh="F2L 是 First Two Layers，意思是“前两层”。开始前，请先掌握层先法（LBL），能够独立复原三阶，并认识 R、U、F、撇号和 2 等转动符号。" en="F2L stands for First Two Layers. Before starting, learn LBL well enough to solve a 3×3 independently and understand move notation, including R, U, F, primes and 2." /></p>
        <p><Link href="/tutorial/lbl" prefetch={false}><T zh="复习层先法与转动符号" en="Review LBL and move notation" /></Link></p>
        <div className="f2l-lesson">
          <section className="f2l-demo" aria-label={tr({ zh: '从十字到前两层', en: 'From cross to F2L' })}>
            {orientation !== null ? <div className="f2l-cube"><AlgPlayer puzzle="3x3" set="f2l-overview" engine="sim" alg={F2L_INTRO_ALG} orientation={orientation} fillPane moveDurationMs={650} stickeringAtStep={f2lIntroStickering} /></div> : colorPrompt}
            <p className="f2l-caption"><T zh="从底十字已经完成的状态开始，四组棱角依次归位，每完成一组就整体转动魔方。现在只观察目标，不必记动作。" en="Start with the bottom cross solved. Watch four pairs fill the slots, rotating the cube after each pair. Just observe the goal; there is no need to memorize moves." /></p>
          </section>
          <section className="f2l-guidance">
            <h3><T zh="与层先法有什么不同？" en="How is this different from LBL?" /></h3>
            <p><T zh="层先法：先复原底层的四个角，再复原中层的四条棱。" en="LBL solves the four bottom-layer corners first, followed by the four middle-layer edges." /></p>
            <p><T zh="F2L：每次把一个底层角和与它对应的中层棱作为一对（pair）处理，一起放入槽位。四对完成，前两层就完成了。" en="F2L treats a bottom-layer corner and its matching middle-layer edge as a pair and solves them into a slot together. Four pairs complete the first two layers." /></p>
            <h3><T zh="接下来怎样学？" en="What will you learn next?" /></h3>
            <p><T zh="先认识四种三步标态的图案，再理解顶层对位，然后逐步学习三步还原。以后遇到更复杂的情况，再把它们转化为这些熟悉的标态。" en="First recognize four three-move cases, then learn top-layer alignment and the three-move insertions. Later, more complex cases can be turned into these familiar cases." /></p>
            <p><T zh="只需三步即可还原的四种基本情况，本教程称为“三步标态”。初学时都以右前槽（FR）为目标。" en="This tutorial calls these the four three-move cases. For now, every insertion targets the front-right (FR) slot." /></p>
          </section>
        </div>
      </>}

      {stepId === 'basic-cases' && <>
        <p className="f2l-lead"><T zh="先看图案，不急着学动作。四种情况都只需三步就能归位。找到有底色贴纸的角和对应的双色棱，留意它们的相对位置。" en="Study the pictures before learning moves. Each case can be solved in three moves. Find the corner with the bottom-color sticker and the matching two-color edge, and notice their relative positions." /></p>
        {pairReminder}
        {orientation !== null ? <div className="f2l-recognition">
          {F2L_CASES.map((item, index) => <figure key={item.id}>
            <VisualCube view="iso" size={190} faceletColors={diagrams[index]} alt={item.name} />
            <figcaption>{item.name}</figcaption>
          </figure>)}
        </div> : colorPrompt}
        <p><T zh="这一步只建立图案印象。比较角的底色贴纸朝向，以及角、棱是怎样相邻或分开的。还原动作会在第 4 步学习。" en="This step is only for recognizing the shapes. Compare the bottom-color sticker's direction and how the corner and edge sit next to or apart from each other. You will learn the insertions in step 4." /></p>
      </>}

      {(stepId === 'top-adjustment' || stepId === 'basic-insertions') && <>
        <p className="f2l-lead">{stepId === 'top-adjustment'
          ? <T zh="当目标棱角都在顶层时，仅相差 U、U′ 或 U2 的位置属于同一个 case。转顶层不会破坏已经完成的底十字和槽位，也不会改变这两块之间的配对关系。先对位，再认标态。" en="When both target pieces are on top, positions differing only by U, U′ or U2 belong to the same case. Turning the top preserves the solved cross and slots, and the relationship between those two pieces. Align first, then recognize the case." />
          : <T zh="现在逐步学习怎样还原三步标态。先确认朝向，再观察每一步对目标棱角的影响。" en="Now learn how to solve each three-move case. Check the cube orientation, then observe what each move does to the corner and edge." />}</p>
        <div className="f2l-cases" role="group" aria-label={tr({ zh: '选择三步标态', en: 'Choose a three-move case' })}>
          {F2L_CASES.map((item, index) => <button key={item.id} type="button" aria-pressed={lesson.id === item.id} onClick={() => selectCase(item.id)}>
            {orientation !== null && <VisualCube view="iso" size={78} faceletColors={diagrams[index]} alt="" />}
            <span>{item.name}</span>
            {stepId === 'basic-insertions' && <code>{item.alg.replace(/[()]/g, '')}</code>}
          </button>)}
        </div>

        {stepId === 'top-adjustment' ? <>
          <div className="f2l-align-options" role="group" aria-label={tr({ zh: '选择顶层对位动作', en: 'Choose a top-layer alignment' })}>
            <span><T zh="尝试不同的对位方向" en="Try different alignment directions" /></span>
            {F2L_TOP_ADJUSTMENTS.map(move => <button key={move} type="button" aria-pressed={alignment === move} onClick={() => setAlignment(move)}><code>{move}</code></button>)}
          </div>
          <div className="f2l-lesson">
            <section className="f2l-demo" aria-label={tr({ zh: '顶层对位演示', en: 'Top-layer alignment demonstration' })}>
              {orientation !== null ? <div className="f2l-cube"><AlgPlayer key={lesson.id + ':' + alignment} puzzle="3x3" set="f2l-tutorial" engine="sim"
                setup={f2lAlignmentSetup(lesson.alg, alignment)} alg={alignment} orientation={orientation} fillPane moveDurationMs={850} /></div> : colorPrompt}
              <code className="f2l-alg f2l-player-alg" data-site-surface="panel">{alignment}</code>
              <p className="f2l-caption"><T zh="左侧从差一次顶层转动的情况开始，只执行对位，不执行三步还原。" en="The left cube starts one top-layer adjustment away. It plays only the alignment, not the insertion." /></p>
            </section>
            <section className="f2l-guidance">
              <h3><T zh="对位后的目标图案" en="The picture to align to" /></h3>
              {chosenDiagram && <VisualCube view="iso" size={190} faceletColors={chosenDiagram} alt={tr({ zh: '对位后的三步标态', en: 'The aligned three-move case' })} />}
              <p><T zh="播放后，对照两边的棱角位置和底色贴纸朝向。虽然顶层所在的位置变了，但它仍是同一种情况。" en="After playing, compare the pair positions and the bottom-color sticker on both cubes. Its top-layer position changed, but it is still the same case." /></p>
              <p><T zh="切换 U、U′、U2，会换成需要相应动作才能对位的起始情况。顶层不需要对位时，就直接进入三步还原。" en="Choosing U, U′ or U2 loads a starting position that needs that adjustment. If it is already aligned, go straight to the three-move insertion." /></p>
              {pairReminder}
            </section>
          </div>
        </> : <div className="f2l-lesson">
          <section className="f2l-demo" aria-label={tr({ zh: '魔方演示', en: 'Cube demonstration' })}>
            {orientation !== null ? <div className="f2l-cube">
              <AlgPlayer key={lesson.id + ':' + orientation} ref={player} puzzle="3x3" set="f2l-tutorial" engine="sim"
                alg={lesson.alg} orientation={orientation} fillPane moveDurationMs={850}
                sectionPauseMs={2000} pauseAfterSteps={pauseBetween ? boundaries : NO_STOPS} onStepChange={setPlaybackStep} />
            </div> : colorPrompt}
            <code className="f2l-alg f2l-player-alg" data-site-surface="panel">{lesson.alg}</code>
            <p className="f2l-caption"><T zh="本节每步为一段。开启后每步结束停顿 2 秒，再自动继续；关闭则连贯播放。你可以随时点击暂停。拖动魔方只改变视角。" en="Each move is one section here. Pause for 2 seconds after each move, then continue automatically, or disable pauses for continuous playback. You can pause manually at any time. Drag to change the view." /></p>
          </section>
          <section className="f2l-guidance">
            <h3>{tr(lesson.title)}</h3>
            <p>{tr(lesson.observe)}</p>
            {pairReminder}
            {selectedColors && <p><T zh="目标角的三色：" en="Target corner colors: " />{[selectedColors.D, selectedColors.F, selectedColors.R].map(colorName).join(' · ')}<br />
              <T zh="目标棱的两色：" en="Target edge colors: " />{[selectedColors.F, selectedColors.R].map(colorName).join(' · ')}</p>}
            <ol className="f2l-steps">
              {sections.map((section, index) => <li key={section.start}>
                <button type="button" disabled={orientation === null} aria-current={activeSection === index ? 'step' : undefined} onClick={() => seek(section.end)}>
                  <strong><code>{section.alg.replace(/[()]/g, '')}</code></strong>
                  <span>{tr(lesson.guidance[index])}</span>
                  <small><T zh="查看这一步之后" en="View after this step" /></small>
                </button>
              </li>)}
            </ol>
            <div className="f2l-check" data-site-surface="panel">
              <h3><T zh="怎样算完成？" en="How to check" /></h3>
              <p><T zh="目标角在右前下方，目标棱在它正上方；它们的前、右侧颜色分别对齐中心，底十字恢复。只要求这对归位，不要求整颗魔方复原。" en="The corner is at bottom-front-right, with the edge directly above it. Their front and right colors match the centers, and the cross is restored. The goal is this pair, not the entire cube." /></p>
            </div>
            <button type="button" className="f2l-restart" disabled={orientation === null} onClick={() => seek(0)}><T zh="回到起始情况，再观察一次" en="Return to the starting case" /></button>
          </section>
        </div>}
      </>}

      {stepId === 'lesson-5' && <>
        <p className="f2l-lead"><T zh="拿起你的魔方，先按层先法复原前两层，并按上方选择的底色和 FR槽颜色拿好。再执行打乱公式，得到只剩最后一组棱角需要还原的练习状态。" en="Pick up your cube and solve the first two layers using LBL. Hold it with the bottom and FR colors selected above, then apply the scramble to leave just one pair to solve." /></p>
        <div className="f2l-lesson">
          <section className="f2l-demo" aria-label={tr({ zh: '三步标态练习演示', en: 'Three-move case practice demonstration' })}>
            {orientation !== null && <div className="f2l-cube"><AlgPlayer key={practice.id} puzzle="3x3" set="f2l-overview" engine="sim"
              setup={practice.setup} alg={practice.alg} orientation={orientation} fillPane moveDurationMs={850}
              sectionPauseMs={2000} pauseAfterSteps={pauseBetween ? practice.boundaries : NO_STOPS} /></div>}
            <code className="f2l-alg f2l-player-alg" data-site-surface="panel">{practice.alg}</code>
          </section>
          <section className="f2l-guidance">
            <h3><T zh="打乱公式" en="Scramble" /></h3>
            <p><code className="f2l-alg f2l-player-alg f2l-scramble-alg" data-site-surface="panel">{practice.setup}</code></p>
            <p><T zh="打乱前请确认前两层已复原。每次更换练习，也先还原前两层，再执行新的打乱。" en="Check that F2L is solved before scrambling. Before each new exercise, solve F2L again and then apply the new scramble." /></p>
            <p><T zh="先观察是否需要 U、U2 或 U′ 对位，再用三步标态还原，共 3～4 步。括号将顶面调整（如果需要）与最后三步分开；开启分段停顿后，演示会在对位完成后停顿 2 秒，再自动继续。" en="Look for a U, U2 or U′ adjustment, then use a three-move insertion: 3–4 moves in total. Parentheses separate any top adjustment from the insertion. With section pauses enabled, the animation waits 2 seconds after alignment, then continues automatically." /></p>
            <button type="button" className="f2l-restart" onClick={() => {
              const candidate = Math.floor(Math.random() * (F2L_PRACTICE_CASES.length - 1));
              setPracticeIndex(candidate >= practiceIndex ? candidate + 1 : candidate);
            }}><T zh="重新随机" en="Randomize again" /></button>
          </section>
        </div>
      </>}
      {stepIndex >= 5 && stepIndex <= 8 && orientation !== null && <LaterLessons stepId={stepId} orientation={orientation} pauseBetween={pauseBetween} />}
      {stepId === 'experiment' && orientation !== null && <FreePractice orientation={orientation} pauseBetween={pauseBetween} />}
    </article>

  </main>;
}
