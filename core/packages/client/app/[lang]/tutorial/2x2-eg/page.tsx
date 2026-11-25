'use client';

import { useCallback } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import { PAGE_META } from '@cuberoot/shared/page-catalog';
import InteractiveTutorial, { type CourseChapter, type CoursePosition } from '../components/InteractiveTutorial';
import { TWO_BY_TWO_ORIENTATION } from '../lib/2x2-state';
import { EG_SETS, EG_SHAPES } from './lesson-data';
import { Beyond, CaseIndex, Overview, SetGuide, Walkthrough, WhyEg } from './lessons';
import RecognitionPractice from './RecognitionPractice';
import './eg-course.css';

const chapters: CourseChapter[] = [
  {
    id: 'intro', title: { zh: '引言', en: 'Introduction' },
    sections: [
      { id: 'overview', title: { zh: '概览', en: 'Overview' }, content: <Overview /> },
      { id: 'why-eg', title: { zh: '为什么用 EG', en: 'Why use EG' }, index: () => <WhyEg /> },
      { id: 'side-colors', title: { zh: '怎么看顶层', en: 'How to read the top' }, stage: () => <RecognitionPractice /> },
    ],
  },
  ...EG_SETS.map(({ id, name }): CourseChapter => ({
    id, title: { zh: name, en: name },
    sections: [
      { id: 'overview', title: { zh: '概览', en: 'Overview' }, index: select =>
        <SetGuide set={id} onSelect={shape => select(id, shape)} /> },
      ...EG_SHAPES.map((shape): CourseChapter['sections'][number] => ({
        id: shape.id, title: shape.name, index: () => <CaseIndex key={id} set={id} shape={shape.id} />,
      })),
    ],
  })),
  {
    id: 'practice', title: { zh: '实战', en: 'Full solves' },
    sections: [
      { id: 'walkthrough', title: { zh: '完整示范', en: 'Full walkthrough' }, stage: () => <Walkthrough /> },
      { id: 'inspection', title: { zh: '预判与视频', en: 'Inspection and videos' }, index: () => <Beyond /> },
    ],
  },
];

export default function Page() {
  const [{ step, section }, setLocation] = useQueryStates({ step: parseAsString, section: parseAsString });
  const chapterIndex = Math.max(0, chapters.findIndex(chapter => chapter.id === step));
  const sections = chapters[chapterIndex].sections;
  const location = { chapterIndex, sectionId: sections.find(item => item.id === section)?.id ?? sections[0].id };
  const navigate = useCallback(({ chapterIndex, sectionId }: CoursePosition, chapterChanged: boolean) => {
    const chapter = chapters[chapterIndex];
    void setLocation({ step: chapterIndex === 0 ? null : chapter.id, section: sectionId === chapter.sections[0].id ? null : sectionId },
      { history: chapterChanged ? 'push' : 'replace' });
  }, [setLocation]);
  return <InteractiveTutorial title={PAGE_META['tutorial/2x2-eg'].title} puzzle="2x2" orientation={TWO_BY_TWO_ORIENTATION}
    chapters={chapters} location={location} onNavigate={navigate} catalogHref="/tutorial?puzzle=2x2" />;
}
