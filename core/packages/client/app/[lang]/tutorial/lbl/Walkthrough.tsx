'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronLeft } from '@app-foundation/icons/lucide';
import { NavigationMenu } from '@app-foundation/navigation-ui';
import AppLink from '@/components/AppLink';
import { T, tr } from '@/i18n/tr';
import { Demonstration } from './CompleteDemo';
import SectionMenu from '../components/SectionMenu';
import TutorialNavigationShell, { sectionItems, sectionLink } from '../components/TutorialNavigationShell';
import ChapterNavigation from '../components/ChapterNavigation';
import { buildCompleteDemo, buildWalkthroughRun, walkthroughCrossPhases } from './complete-demo-state';
import { LBL_STEPS } from './content';
import { LBL_LESSON_RUNS, LBL_LESSON_STAGE_IDS } from './lesson-runs';

const IGNORE_CASE_CUE = () => {};
export default function Walkthrough() {
  const [runIndex, setRunIndex] = useState(0);
  const [selected, setSelected] = useState(0);
  const scramble = LBL_LESSON_RUNS[runIndex].scramble;
  const run = useMemo(() => buildWalkthroughRun(scramble, true), [scramble]);
  const stages = useMemo(() => {
    let setup = run.scramble;
    return LBL_LESSON_STAGE_IDS.map(id => {
      const lesson = LBL_STEPS.find(item => item.id === id)!;
      const alg = run.stages[id];
      const demo = id === 'cross' ? { setup, alg, phases: walkthroughCrossPhases(setup, alg),
        done: { zh: '底面十字完成，四条侧色对齐中心。', en: 'Bottom cross complete. All four side colors match their centers.' } }
        : buildCompleteDemo(id, setup, true);
      setup += ' ' + alg;
      return { id, lesson, demo };
    });
  }, [run]);
  const step = stages[selected].lesson;
  const advanceStage = useCallback(() => setSelected(index => Math.min(index + 1, stages.length - 1)), [stages.length]);
  const examples = LBL_LESSON_RUNS.map((_, index) => ({
    id: String(index),
    onSelect: () => { if (index !== runIndex) { setRunIndex(index); setSelected(0); } },
    label: tr({ zh: `示例 ${index + 1}`, en: `Example ${index + 1}` }),

    active: index === runIndex,
  }));
  const exampleNavigation = <NavigationMenu items={sectionItems(examples)} collapsed={false} label={tr({ zh: '示例', en: 'Examples' })} renderLink={sectionLink(examples)} />;
  return <main className="lbl-page lbl-walkthrough">
    <header className="lbl-header">
      <AppLink href="/tutorial/lbl" prefetch={false}>
        <ChevronLeft size={17} aria-hidden="true" /><T zh="层先法" en="LBL" />
      </AppLink>
      <h1><T zh="完整还原" en="Full solve" /></h1>
    </header>
    <ChapterNavigation items={stages.map(stage => ({
      id: stage.id, title: tr(stage.lesson.title), completed: stages.indexOf(stage) < selected,
    }))} label={tr({ zh: '播放范围', en: 'Playback range' })} selected={selected}
      onSelect={setSelected} />
    <TutorialNavigationShell className="lbl-body" sections={{ items: examples }}>
      <div className="lbl-learning">
        <div className="lbl-lesson-scroll">
          <div className="lbl-walkthrough-meta">
              <p className="lbl-walkthrough-scramble-row"><span><T zh="打乱：" en="Scramble:" /></span><code className="lbl-walkthrough-scramble">{run.scramble}</code></p>
              <p><T zh="当前进度：" en="Current progress: " />{step
                ? <AppLink className="lbl-walkthrough-chapter" href={`/tutorial/lbl?step=${step.id}`} prefetch={false}>{tr(step.title)}</AppLink>
                : <T zh="已复原" en="Solved" />}</p>
          </div>
          <div className="lbl-complete">
            <Demonstration key={runIndex + ':' + selected} stage={stages[selected].id} demo={stages[selected].demo}
              walkthrough onCaseCueChange={IGNORE_CASE_CUE} onComplete={selected < stages.length - 1 ? advanceStage : undefined} />
          </div>
        </div>
        <div className="lbl-demo-toolbar">
          <SectionMenu label={examples[runIndex].label}>{exampleNavigation}</SectionMenu>
        </div>
      </div>
    </TutorialNavigationShell>
  </main>;
}
