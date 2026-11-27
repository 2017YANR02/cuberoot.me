'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { CompactSelect } from '@/components/CompactSelect';
import { T, tr } from '@/i18n/tr';
import { Demonstration } from './CompleteDemo';
import { buildWhiteUpWalkthrough } from './complete-demo-state';
import { LBL_LESSON_RUNS } from './lesson-runs';

const IGNORE_CASE_CUE = () => {};
export default function Walkthrough() {
  const [runIndex, setRunIndex] = useState(0);
  const scramble = LBL_LESSON_RUNS[runIndex].scramble;
  const { demo, scramble: displayScramble } = useMemo(() => buildWhiteUpWalkthrough(scramble), [scramble]);
  const examples = LBL_LESSON_RUNS.map((_, index) => ({
    value: String(index),
    label: tr({ zh: `示例 ${index + 1}`, en: `Example ${index + 1}` }),
  }));
  const nextRandomCase = () => {
    const offset = 1 + Math.floor(Math.random() * (LBL_LESSON_RUNS.length - 1));
    setRunIndex(current => (current + offset) % LBL_LESSON_RUNS.length);
  };

  return <main className="tutorial-course lbl-walkthrough-page" data-center-content>
    <header className="course-header">
      <AppLink className="course-back-link" href="/tutorial/lbl" prefetch={false} aria-label={tr({ zh: '返回层先法教程', en: 'Back to the LBL tutorial' })}>
        <ChevronLeft size={18} aria-hidden="true" />
      </AppLink>
      <h1><T zh="完整示范" en="Full walkthrough" /></h1>
      <CompactSelect className="lbl-walkthrough-example" ariaLabel={tr({ zh: '选择示例', en: 'Choose example' })} label={examples[runIndex].label}
        showArrow items={examples} value={String(runIndex)} onChange={value => setRunIndex(Number(value))} />
    </header>
    <Demonstration key={runIndex} stage="walkthrough" demo={demo} onCaseCueChange={IGNORE_CASE_CUE}
      walkthroughCase={{ scramble: displayScramble, onRandomCase: nextRandomCase }} />
  </main>;
}
