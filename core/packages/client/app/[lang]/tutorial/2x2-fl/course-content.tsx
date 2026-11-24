'use client';

import { useState } from 'react';
import { Play } from '@app-foundation/icons/lucide';
import { Axis } from '@cuberoot/visualcube';
import { FM_FIXED_COLOR, FM_IGNORED, FM_REGULAR } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { AlgFormulaReadRow } from '@/components/AlgFormulaRow';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { VisualCube } from '@/components/VisualCube';
import { T, tr } from '@/i18n/tr';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { CUBE_FRAMING_EDGE, LessonPane, TutorialAlgDemo } from '../components/InteractiveTutorial';
import useTeachingFollow from '../components/useTeachingFollow';
import {
  FL_CHAPTERS, FL_EXAMPLE, FL_GROUPS, FL_RECOGNITION_EXAMPLES, FL_VIEWS,
  flCaseGroups, flCaseLabel, flPalette, flSectionHeading,
  type FlCase, type FlChapter, type FlPalette, type FlTwist,
} from './lesson-data';

// Renderer home corners 0/4 are bottom left; 1/5 are bottom right.
const colorsFor = (orientation: string, visible: readonly number[]) =>
  stageStickerColors(2, piece => visible.includes(piece) ? FM_REGULAR : FM_IGNORED, orientedCubeFaceColors(orientation));
const maskColor = FM_FIXED_COLOR[FM_IGNORED];
const underside = [[Axis.Y, 30], [Axis.X, 29]] as [Axis, number][];

function CaseDiagram({ item, orientation, alt }: { item: FlCase; orientation: string; alt: string }) {
  const visible = item.group === 'top' ? [1, 5] : [0, 1, 4, 5];
  return <VisualCube local puzzleSize={2} size={94} setup={item.setup} alt={alt}
    view={item.group === 'top' ? 'plan' : 'iso'}
    viewportRotations={item.group === 'bottom' ? underside : undefined}
    stickerColors={colorsFor(orientation, visible)}
    stickerMaskColor={maskColor} loading="lazy" />;
}

type OverviewStage = {
  title: { zh: string; en: string };
  note: { zh: string; en: string };
  setup: string;
  stickerColors: string[];
  pitch?: number;
};

function OverviewSteps({ stages }: { stages: readonly OverviewStage[] }) {
  return <ol className="course-overview-steps" data-step-count={stages.length} role="list">
    {stages.map(stage => <li key={stage.title.en}>
      <div className="course-overview-diagram">
        <VisualCube local puzzleSize={2} size={150} view="iso" setup={stage.setup} alt=""
          viewportRotations={[[Axis.Y, -30], [Axis.X, stage.pitch ?? 26]]}
          stickerColors={stage.stickerColors} stickerMaskColor={maskColor} />
      </div>
      <div>
        <h2><T {...stage.title} /></h2>
        <p><T {...stage.note} /></p>
      </div>
    </li>)}
  </ol>;
}

export function Introduction({ orientation }: { orientation: string }) {
  const { color } = flPalette(orientation);
  const bottom = color('D');
  const left = color('L');
  const front = color('F');
  const introductionStages = [
    { title: { zh: '左侧角对', en: 'Left pair' },
      note: { zh: `归位两个相邻的${bottom.zh}角。${bottom.zh}朝下、${left.zh}在左、${front.zh}在前。`,
        en: `Solve two adjacent ${bottom.en} corners. Hold ${bottom.en} down, ${left.en} left and ${front.en} front.` },
      setup: FL_EXAMPLE.leftPairSetup, stickerColors: colorsFor(orientation, [0, 4]) },
    { title: { zh: '完整第一层', en: 'Solved first layer' },
      note: { zh: `底面全${bottom.zh}，四个侧面的底排各自同色。`,
        en: `The bottom is ${bottom.en}, and the bottom row on each side matches.` },
      setup: '', stickerColors: colorsFor(orientation, [0, 1, 4, 5]) },
  ];
  return <div className="course-overview fl-overview">
    <p className="fl-overview-lead"><T zh="先做好左侧角对，再根据剩余两角的位置和朝向，用一条短公式完成第一层。"
      en="Solve the left pair, then use one short algorithm for the position and orientation of the last two corners." /></p>
    <OverviewSteps stages={introductionStages} />
  </div>;
}

export function ChapterOverview({ chapter, orientation }: { chapter: FlChapter; orientation: string }) {
  const groups = FL_CHAPTERS[chapter].groups;
  const alignedExample = FL_RECOGNITION_EXAMPLES.find(example => example.group === groups[0])!.end;
  const stickerColors = colorsFor(orientation, [0, 1, 4, 5]);
  const stages = [
    {
      title: { zh: '先摆到公式起手位', en: 'Align the last two corners' },
      note: chapter === 'top'
        ? { zh: '用 U、R 把第三角块摆到顶层左前，并让第四角块也在顶层',
          en: 'Use U and R to put the third corner at top front-left and the fourth corner anywhere on top.' }
        : { zh: '把第三角块摆到底层右前，再按第四角块所在层摆成 UD 或 DD（图为 UD）',
          en: 'Put the third corner at bottom front-right, then align for UD or DD depending on the fourth corner’s layer. The diagram shows UD.' },
      setup: alignedExample.setup,
      stickerColors,
      pitch: -26,
    },
    {
      title: { zh: '再用短公式复原底层', en: 'Solve the first layer with a short algorithm' },
      note: { zh: '从 0、+、− 中选对公式，一次归位两角。底面同色，四个侧面的底排也各自同色',
        en: 'Choose the matching algorithm from 0, + or − to solve both corners together. The bottom face and the bottom row on each side should each match.' },
      setup: '',
      stickerColors,
    },
  ];
  return <div className="course-overview fl-overview">
    <OverviewSteps stages={stages} />
  </div>;
}

function CaseGrid({ cases, orientation, palette, onPlay }: {
  cases: readonly FlCase[];
  orientation: string;
  palette: FlPalette;
  onPlay: (item: FlCase, alg: string) => void;
}) {
  return <ul className="fl-case-grid" role="list">
      {cases.map(item => <li key={item.id} className="fl-diagram-card">
        <figure>
          <CaseDiagram item={item} orientation={orientation} alt={tr(flCaseLabel(item, palette))} />
        </figure>
        <div className="fl-algorithms">
          {item.algs.map((alg, index) => <AlgFormulaReadRow key={alg} selected={index === 0}
            actions={<button type="button" className="fl-alg-play" aria-haspopup="dialog"
              aria-label={`${tr({ zh: '演示', en: 'Play' })} ${alg}`} onClick={() => onPlay(item, alg)}>
              <Play aria-hidden="true" />
            </button>}>
            <code>{alg}</code>
          </AlgFormulaReadRow>)}
        </div>
      </li>)}
  </ul>;
}

export function CaseIndex({ chapter, twist, orientation }: { chapter: FlChapter; twist: FlTwist; orientation: string }) {
  const [demo, setDemo] = useState<{ item: FlCase; alg: string } | null>(null);
  const palette = flPalette(orientation);
  const demoTitle = demo && flCaseLabel(demo.item, palette);
  return <div className="fl-reading fl-cases">
    <h2><T {...flSectionHeading(chapter, twist, palette, true)} /></h2>
    {flCaseGroups(chapter, twist).map(({ group, cases }) => <div className="fl-case-subgroup" key={group}>
      {group !== 'top' && <h3>{FL_GROUPS[group].code} · <T {...FL_GROUPS[group].title} /></h3>}
      <CaseGrid cases={cases} orientation={orientation} palette={palette} onPlay={(item, alg) => setDemo({ item, alg })} />
    </div>)}
    {demo && demoTitle && <TutorialAlgDemo puzzle="2x2" orientation={orientation} view={FL_VIEWS[demo.item.group]}
      handToggle onClose={() => setDemo(null)} insertion={{
        progressLabel: demoTitle,
        demoTitle,
        demoSetup: demo.item.setup,
        steps: demo.alg.split(/\s+/).map(notation => ({ notation })),
        hideDemoDetail: true,
      }} />}
  </div>;
}

function walkthroughStages({ color, backLeft, frontLeft, reference, last }: FlPalette) {
  const bottom = color('D');
  const left = color('L');
  return [
    { from: 0, alg: FL_EXAMPLE.leftPairMoves, title: { zh: '拼左侧角对', en: 'Build the left pair' },
      note: { zh: `先放${backLeft.zh}，再插入${frontLeft.zh}，让${left.zh}格在左侧并排。`,
        en: `Place the ${backLeft.en}, then insert the ${frontLeft.en} to make a ${left.en} row on the left.` } },
    { from: 2, alg: FL_EXAMPLE.alignment, title: { zh: `把${reference.zh}摆到顶层左前`, en: 'Align at top front-left' },
      note: { zh: `${reference.zh}的${bottom.zh}格朝上，是 0 组。${last.zh}在顶层右后，也是${bottom.zh}格朝上。`,
        en: `The ${reference.en} has ${bottom.en} on top, so this is group 0. The ${last.en} is at top back-right with ${bottom.en} up.` } },
    { from: 3, alg: FL_EXAMPLE.case.algs[0], title: { zh: '一起归位剩下两角', en: 'Insert the last two corners' },
      note: { zh: `检查底面四格全${bottom.zh}，四个侧面的底排各自同色。`,
        en: `Check the four ${bottom.en} stickers on the bottom and the matching bottom rows on all sides.` } },
  ];
}
const markers = [2, 3];
export const walkthroughHeading = { zh: '从打乱到第一层', en: 'From scramble to first layer' };

export function FirstLayerDemo({ orientation }: { orientation: string }) {
  const [step, setStep] = useState(0);
  const stages = walkthroughStages(flPalette(orientation));
  const activeStage = stages.findLastIndex(stage => step >= stage.from);
  const { paneProps, playbackProps } = useTeachingFollow(step, 'fl-walkthrough');
  return <LessonPane layout="B" captionProps={{ ...paneProps, className: 'tutorial-follow-pane fl-walkthrough-caption' }}
    cube={<div className="course-cube" data-course-cube {...playbackProps}>
    <AlgPlayer puzzle="2x2" set="" orientation={orientation} engine="sim" fillPane maxFramingEdge={CUBE_FRAMING_EDGE}
      setup={FL_EXAMPLE.setup} alg={FL_EXAMPLE.moves} sceneRot={FL_VIEWS.top}
      stepMarkers={markers} pauseAfterSteps={markers} sectionPauseMs={600} moveDurationMs={720}
      onStepChange={setStep} />
  </div>}>
    <div className="course-copy fl-demo-copy" data-course-section="walkthrough">
      <h2><T {...walkthroughHeading} /></h2>
      {step === 0 && <p className="fl-scramble"><T zh="打乱" en="Scramble" /> <code>{FL_EXAMPLE.setup}</code></p>}
      <ol className="fl-demo-stages" aria-label={tr({ zh: '示范步骤', en: 'Walkthrough stages' })}>
        {stages.map((stage, index) => <li key={stage.from} aria-current={index === activeStage ? 'step' : undefined}>
          <h3><T {...stage.title} /></h3>
          <code>{stage.alg}</code>
          <p><T {...stage.note} /></p>
        </li>)}
      </ol>
    </div>
  </LessonPane>;
}
