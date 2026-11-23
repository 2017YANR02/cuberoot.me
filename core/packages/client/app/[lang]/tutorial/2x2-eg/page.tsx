'use client';

import { useCallback } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import { PAGE_META } from '@cuberoot/shared/page-catalog';
import InteractiveTutorial, { type CourseChapter, type CoursePosition } from '../components/InteractiveTutorial';
import { TWO_BY_TWO_ORIENTATION } from '../lib/2x2-state';
import { EG_SETS, EG_SHAPES } from './lesson-data';
import { Beyond, BottomGuide, CaseIndex, Overview, SameShape, SetGuide, ShapeGuide, Walkthrough } from './lessons';
import RecognitionPractice from './RecognitionPractice';
import './eg-course.css';

const chapters: CourseChapter[] = [
  {
    id: 'intro', title: { zh: '入门', en: 'Start here' },
    sections: [
      { id: 'overview', title: { zh: '概览', en: 'Overview' }, index: select =>
        <Overview onPractice={() => select('intro', 'bottom')} onWalkthrough={() => select('practice')} /> },
      { id: 'bottom', title: { zh: '看底层', en: 'Read the bottom' }, stage: select =>
        <BottomGuide onPractice={() => select('intro', 'bottom-practice')} /> },
      { id: 'bottom-practice', title: { zh: '底层练习', en: 'Bottom practice' }, stage: () =>
        <RecognitionPractice mode="bottom" /> },
    ],
  },
  {
    id: 'recognition', title: { zh: '顶层识别', en: 'Top recognition' },
    sections: [
      { id: 'shapes', title: { zh: '八种顶层形状', en: 'Eight top shapes' }, index: select =>
        <ShapeGuide onSelect={shape => select('cll', shape)} /> },
      { id: 'side-colors', title: { zh: '同形不同公式', en: 'Same shape, different cases' }, index: () => <SameShape /> },
      { id: 'shape-practice', title: { zh: '形状练习', en: 'Shape practice' }, stage: () =>
        <RecognitionPractice mode="shape" /> },
    ],
  },
  ...EG_SETS.map(({ id, name }): CourseChapter => ({
    id, title: { zh: name, en: name },
    sections: [
      { id: 'overview', title: { zh: '概览', en: 'Overview' }, index: select =>
        <SetGuide set={id} onSelect={shape => select(id, shape)} onPractice={() => select(id, 'mixed')} /> },
      ...EG_SHAPES.map((shape): CourseChapter['sections'][number] => ({
        id: shape.id, title: shape.name, index: () => <CaseIndex key={id} set={id} shape={shape.id} />,
      })),
      { id: 'mixed', title: { zh: '本套练习', en: 'Practice this set' }, stage: () => <RecognitionPractice key={id} mode="mixed" set={id} /> },
    ],
  })),
  {
    id: 'practice', title: { zh: '实战', en: 'Full solves' },
    sections: [
      { id: 'walkthrough', title: { zh: '完整示范', en: 'Full walkthrough' }, stage: () => <Walkthrough /> },
      { id: 'mixed', title: { zh: '混合练习', en: 'Mixed practice' }, stage: () => <RecognitionPractice mode="mixed" /> },
      { id: 'inspection', title: { zh: '预判与视频', en: 'Inspection and videos' }, index: () => <Beyond /> },
    ],
  },
];

export default function Page() {
  const [{ step, section }, setLocation] = useQueryStates({ step: parseAsString, section: parseAsString, group: parseAsString });
  const chapterIndex = Math.max(0, chapters.findIndex(chapter => chapter.id === step));
  const sections = chapters[chapterIndex].sections;
  const location = { chapterIndex, sectionId: sections.find(item => item.id === section)?.id ?? sections[0].id };
  const navigate = useCallback(({ chapterIndex, sectionId }: CoursePosition, chapterChanged: boolean) => {
    const chapter = chapters[chapterIndex];
    void setLocation({ step: chapterIndex === 0 ? null : chapter.id, section: sectionId === chapter.sections[0].id ? null : sectionId, group: null },
      { history: chapterChanged ? 'push' : 'replace' });
  }, [setLocation]);
  return <InteractiveTutorial title={PAGE_META['tutorial/2x2-eg'].title} puzzle="2x2" orientation={TWO_BY_TWO_ORIENTATION}
    chapters={chapters} location={location} onNavigate={navigate} catalogHref="/tutorial?puzzle=2x2" />;
}
