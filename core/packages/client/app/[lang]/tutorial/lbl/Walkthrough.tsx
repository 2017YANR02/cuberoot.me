'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft } from '@app-foundation/icons/lucide';
import { NavigationMenu } from '@app-foundation/navigation-ui';
import AppLink from '@/components/AppLink';
import { T, tr } from '@/i18n/tr';
import { Demonstration } from './CompleteDemo';
import SectionMenu from '../components/SectionMenu';
import TutorialNavigationShell, { sectionItems, sectionLink } from '../components/TutorialNavigationShell';
import { buildWalkthroughDemo } from './complete-demo-state';
import { LBL_LESSON_RUNS } from './lesson-runs';

const IGNORE_CASE_CUE = () => {};
export default function Walkthrough() {
  const [runIndex, setRunIndex] = useState(0);
  const scramble = LBL_LESSON_RUNS[runIndex].scramble;
  const demo = useMemo(() => buildWalkthroughDemo(scramble), [scramble]);
  const examples = LBL_LESSON_RUNS.map((_, index) => ({
    id: String(index),
    onSelect: () => setRunIndex(index),
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
    <TutorialNavigationShell className="lbl-body" sections={{ items: examples }}>
      <div className="lbl-learning">
        <div className="lbl-lesson-scroll">
          <div className="lbl-complete">
            <Demonstration key={runIndex} stage="walkthrough" demo={demo} onCaseCueChange={IGNORE_CASE_CUE}
              opening={<p className="lbl-walkthrough-scramble-row">
                <span><T zh="打乱：" en="Scramble:" /></span><code className="lbl-walkthrough-scramble">{scramble}</code>
              </p>} />
          </div>
        </div>
        <div className="lbl-demo-toolbar">
          <SectionMenu label={examples[runIndex].label}>{exampleNavigation}</SectionMenu>
        </div>
      </div>
    </TutorialNavigationShell>
  </main>;
}
