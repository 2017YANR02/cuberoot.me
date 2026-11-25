'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import { ArrowRight } from '@app-foundation/icons/lucide';
import { FM_DIM, FM_FIXED_COLOR, FM_IGNORED, FM_REGULAR, stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { Axis } from '@cuberoot/visualcube';
import { VisualCube } from '@/components/VisualCube';
import { useT } from '@/hooks/useT';
import { T, tr } from '@/i18n/tr';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import InteractiveTutorial, { type CourseFlowSection, type CoursePosition } from '../components/InteractiveTutorial';
import { TWO_BY_TWO_ORIENTATION, TWO_BY_TWO_OVERVIEW, TWO_BY_TWO_SAMPLE } from './lesson-data';
import BottomFlowchart, { BottomLayerDiagram } from './BottomFlowchart';
import YellowFaceFlowchart from './YellowFaceFlowchart';
import FishRecognitionHelp from './FishRecognitionHelp';
import CornerPositionFlowchart from './CornerPositionFlowchart';
import HeadlightsHelp from './HeadlightsHelp';
import './chapter-overview.css';

const overviewTitle = { zh: '概览', en: 'Overview' };
const flowchartTitle = { zh: '流程图', en: 'Flowchart' };
const overviewPitch = -30;
const undersidePitch = 18;
const tiltDurationMs = 420;
const mouseHoverQuery = '(hover: hover) and (pointer: fine)';
const faceColors = orientedCubeFaceColors(TWO_BY_TWO_ORIENTATION);
type OverviewStep = {
  title: { zh: string; en: string };
  goal: { zh: string; en: string };
  setup: string;
  stickerColors: string[];
  yaw?: number;
};
const overviewSteps = TWO_BY_TWO_OVERVIEW.map(step => {
  const mask = stickeringMaskFn(2, step.stickering);
  const stickerColors = stageStickerColors(2, mask && ((piece, face) => {
    const style = mask(piece, face);
    // Keep the first layer visible in the yellow-face diagram.
    return style === FM_DIM ? FM_REGULAR : style;
  }), faceColors);
  return { ...step, stickerColors };
});
const introduction = {
  id: 'intro', title: { zh: '引言', en: 'Introduction' },
  sections: [{ id: 'overview', title: overviewTitle, content: <Overview steps={overviewSteps} intro={{
    zh: '层先法先复原底层，再分两步完成顶层。', en: 'Layer by layer solves the first layer, then finishes the top layer in two steps.',
  }} /> }],
};
const [bottom, yellow, corners] = TWO_BY_TWO_SAMPLE;
const [bottomGoal, yellowGoal, cornerGoal] = overviewSteps;
const unsolved = {
  setup: bottom.sections[0].exercise.setup,
  stickerColors: stageStickerColors(2, null, faceColors),
};
const bottomOverview = {
  id: 'bottom-overview',
  title: overviewTitle,
  content: <ChapterOverview before={unsolved} after={bottomGoal} showBottom />,
};
const bottomFlowchart: CourseFlowSection = {
  id: 'bottom-flowchart',
  title: flowchartTitle,
  flowchart: select => <BottomFlowchart onSelect={sectionId => select(bottom.id, sectionId)} />,
};
const yellowOverview = {
  id: 'yellow-overview',
  title: overviewTitle,
  content: <ChapterOverview before={bottomGoal} after={yellowGoal} />,
};
const yellowFlowchart: CourseFlowSection = {
  id: 'yellow-flowchart',
  title: flowchartTitle,
  flowchart: select => <YellowFaceFlowchart onSelect={select} />,
};
const yellowSections = yellow.sections.map(section => section.id === 'right-fish' || section.id === 'left-fish'
  ? { ...section, guided: { ...section.guided, Help: FishRecognitionHelp } }
  : section);
const cornerOverview = {
  id: 'corner-overview',
  title: overviewTitle,
  content: <ChapterOverview before={yellowGoal} after={cornerGoal} />,
};
const cornerFlowchart: CourseFlowSection = {
  id: 'corner-flowchart',
  title: flowchartTitle,
  flowchart: select => <CornerPositionFlowchart onSelect={select} />,
};
const cornerSections = corners.sections.map(section => ({
  ...section, guided: { ...section.guided, Help: HeadlightsHelp, hideHelpDuringAlgorithm: true },
}));
const chapters = [introduction, { ...bottom, sections: [bottomOverview, ...bottom.sections, bottomFlowchart] },
  { ...yellow, sections: [yellowOverview, ...yellowSections, yellowFlowchart] },
  { ...corners, sections: [cornerOverview, ...cornerSections, cornerFlowchart] }];

function positionFor(step: string | null, section: string | null): CoursePosition {
  const chapterIndex = chapters.findIndex((chapter, index) => step === `lesson-${index + 1}` || step === chapter.id);
  if (chapterIndex >= 0) {
    const sections = chapters[chapterIndex].sections;
    return { chapterIndex, sectionId: sections.find(item => item.id === section)?.id ?? sections[0].id };
  }
  const sectionChapter = chapters.findIndex(chapter => chapter.sections.some(item => item.id === step));
  return sectionChapter >= 0 && step
    ? { chapterIndex: sectionChapter, sectionId: step }
    : { chapterIndex: 0, sectionId: introduction.sections[0].id };
}

function ChapterOverview({ before, after, showBottom = false }: {
  before: Pick<OverviewStep, 'setup' | 'stickerColors'>;
  after: OverviewStep;
  showBottom?: boolean;
}) {
  const diagram = (state: typeof before, alt: string, translucent: boolean) => showBottom
    ? <BottomLayerDiagram {...state} size={252} alt={alt} translucent={translucent} />
    : <VisualCube local puzzleSize={2} view="iso" size={252} viewportRotations={[[Axis.Y, 30], [Axis.X, overviewPitch]]}
      setup={state.setup} stickerColors={state.stickerColors} alt={alt} />;
  return <figure className="two-lbl-chapter-overview">
    <div className="two-lbl-chapter-comparison">
      {diagram(before, tr({ zh: '本章起始状态', en: 'Starting state' }), false)}
      <ArrowRight aria-hidden="true" />
      {diagram(after, tr({ zh: '本章目标状态', en: 'Target state' }), true)}
    </div>
    <figcaption><T {...after.goal} /></figcaption>
  </figure>;
}

function OverviewDiagram({ step, tilted, pressed, onHover, onToggle }: {
  step: OverviewStep;
  tilted: boolean;
  pressed: boolean;
  onHover: (hovered: boolean) => void;
  onToggle: () => void;
}) {
  const t = useT();
  const [pitch, setPitch] = useState(overviewPitch);
  const currentPitch = useRef(overviewPitch);

  useEffect(() => {
    const target = tilted ? undersidePitch : overviewPitch;
    const from = currentPitch.current;
    if (from === target) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    let frame = requestAnimationFrame(animate);
    function animate(now: number) {
      const progress = reduceMotion ? 1 : Math.min(1, Math.max(0, (now - start) / tiltDurationMs));
      const eased = progress * progress * (3 - 2 * progress);
      currentPitch.current = progress === 1 ? target : from + (target - from) * eased;
      setPitch(currentPitch.current);
      if (progress < 1) frame = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(frame);
  }, [tilted]);

  return <button type="button" className="course-overview-diagram" aria-pressed={pressed}
    aria-label={t(`${step.title.zh} · 查看底面`, `${step.title.en} · Show underside`)}
    onPointerEnter={event => {
      if (event.pointerType === 'mouse' && window.matchMedia(mouseHoverQuery).matches) onHover(true);
    }}
    onPointerLeave={event => { if (event.pointerType === 'mouse') onHover(false); }}
    onClick={event => { if (event.detail === 0 || !window.matchMedia(mouseHoverQuery).matches) onToggle(); }}>
    <span aria-hidden="true">
      <VisualCube local view="iso" puzzleSize={2} size={180}
        viewportRotations={[[Axis.Y, step.yaw ?? 30], [Axis.X, pitch]]}
        stickerColors={step.stickerColors} stickerMaskColor={FM_FIXED_COLOR[FM_IGNORED]} setup={step.setup} alt="" />
    </span>
  </button>;
}

function Overview({ steps, intro }: { steps: readonly OverviewStep[]; intro: OverviewStep['goal'] }) {
  const [inspection, setInspection] = useState<{ index: number; trigger: 'hover' | 'toggle' } | null>(null);

  return <div className="course-overview">
    <p><T {...intro} /></p>
    <p className="course-overview-touch-hint"><T zh="轻点魔方查看底面" en="Tap a cube to see its underside" /></p>
    <ol className="course-overview-steps" data-step-count={steps.length} role="list">
      {steps.map((step, index) => {
        const tilted = inspection?.index === index;
        return <li key={step.title.en}>
          <OverviewDiagram step={step} tilted={tilted} pressed={tilted && inspection?.trigger === 'toggle'}
            onHover={hovered => setInspection(current => {
              if (hovered) return { index, trigger: 'hover' };
              return current?.index === index && current.trigger === 'hover' ? null : current;
            })}
            onToggle={() => setInspection(current => current?.index === index && current.trigger === 'toggle'
              ? null : { index, trigger: 'toggle' })} />
          <div><h2>{index + 1}. <T {...step.title} /></h2><p><T {...step.goal} /></p></div>
        </li>;
      })}
    </ol>
  </div>;
}

export default function Page() {
  const [{ step, section }, setLocation] = useQueryStates({ step: parseAsString, section: parseAsString });
  const navigate = useCallback(({ chapterIndex, sectionId }: CoursePosition, chapterChanged: boolean) => {
    const step = `lesson-${chapterIndex + 1}`;
    const section = chapters[chapterIndex].sections[0].id === sectionId ? null : sectionId;
    void setLocation({ step, section }, { history: chapterChanged ? 'push' : 'replace' });
  }, [setLocation]);

  return <InteractiveTutorial title={{ zh: '二阶魔方层先法', en: '2×2 Layer by Layer' }} puzzle="2x2" centerContent
    orientation={TWO_BY_TWO_ORIENTATION} chapters={chapters}
    catalogHref="/tutorial?puzzle=2x2" practiceEnabled={false}
    location={positionFor(step, section)} onNavigate={navigate} />;
}
