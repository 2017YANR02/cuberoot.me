'use client';

import { useCallback } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import InteractiveTutorial, { type CourseChapter, type CoursePosition } from '../components/InteractiveTutorial';
import { TWO_BY_TWO_ORIENTATION } from '../lib/2x2-state';
import { FL_CASES, FL_GROUPS, FL_LEFT_PAIR, type FlGroup } from './lesson-data';
import { CaseIndex, FirstLayerDemo, Introduction, LeftPair } from './course-content';
import './first-layer.css';

const title = { zh: '二阶魔方 FL（第一层）', en: '2×2 First Layer (FL)' };
const groups = Object.keys(FL_GROUPS) as FlGroup[];
const chapters: CourseChapter[] = [
  {
    id: 'intro', title: { zh: '起手与摆位', en: 'Setup and alignment' },
    sections: [
      { id: 'overview', title: { zh: '概览', en: 'Overview' }, index: select => <Introduction onSelect={select} /> },
      { id: 'left-pair', title: { zh: '左侧白角对', en: 'Left pair' }, index: () => <LeftPair /> },
      FL_LEFT_PAIR,
    ],
  },
  ...groups.map((group): CourseChapter => ({
    id: group,
    title: FL_GROUPS[group].title,
    sections: [
      { id: `${group}-cases`, title: { zh: '识别图表', en: 'Case diagrams' }, index: select => <CaseIndex group={group} onSelect={select} /> },
      ...FL_CASES[group],
    ],
  })),
  {
    id: 'walkthrough', title: { zh: '完整示范', en: 'Full walkthrough' },
    sections: [{ id: 'walkthrough', title: { zh: '从打乱到第一层', en: 'From scramble to first layer' }, demonstration: <FirstLayerDemo /> }],
  },
];

function positionFor(step: string | null, section: string | null): CoursePosition {
  const index = chapters.findIndex((chapter, order) => step === chapter.id || step === `lesson-${order + 1}`);
  if (index >= 0) {
    const choices = chapters[index].sections;
    return { chapterIndex: index, sectionId: choices.find(item => item.id === section)?.id ?? choices[0].id };
  }
  const sectionChapter = chapters.findIndex(chapter => chapter.sections.some(item => item.id === step));
  return sectionChapter >= 0 && step ? { chapterIndex: sectionChapter, sectionId: step } : { chapterIndex: 0, sectionId: 'overview' };
}

export default function Page() {
  const [{ step, section }, setLocation] = useQueryStates({ step: parseAsString, section: parseAsString });
  const navigate = useCallback(({ chapterIndex, sectionId }: CoursePosition, chapterChanged: boolean) => {
    const step = `lesson-${chapterIndex + 1}`;
    const section = chapters[chapterIndex].sections[0].id === sectionId ? null : sectionId;
    void setLocation({ step, section }, { history: chapterChanged ? 'push' : 'replace' });
  }, [setLocation]);

  return <InteractiveTutorial title={title} puzzle="2x2" orientation={TWO_BY_TWO_ORIENTATION} chapters={chapters}
    basicsHref="/tutorial/lbl" location={positionFor(step, section)} onNavigate={navigate} />;
}
