'use client';

import { useCallback, useMemo, useState } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import { PAGE_META } from '@cuberoot/shared/page-catalog';
import CubeOrientationSelect from '@/components/CubeOrientationSelect';
import { SettingsPopover } from '@/components/TrainingSettings';
import { tr } from '@/i18n/tr';
import InteractiveTutorial, { type CourseChapter, type CoursePosition } from '../components/InteractiveTutorial';
import { TWO_BY_TWO_ORIENTATION } from '../lib/2x2-state';
import { FL_CASES, FL_CHAPTERS, FL_TWISTS, flSectionId, type FlChapter } from './lesson-data';
import { CaseIndex, ChapterOverview, FirstLayerDemo, Introduction, walkthroughHeading } from './course-content';
import RecognitionLesson from './RecognitionLesson';
import AlignmentExercise from './AlignmentExercise';
import './first-layer.css';

const overviewTitle = { zh: '概览', en: 'Overview' };
const recognitionTitle = { zh: '识别流程', en: 'Recognition flow' };
const alignmentTitle = { zh: '摆位与识别', en: 'Align and recognize' };
const walkthroughId = 'walkthrough';
const formulaChapters = Object.keys(FL_CHAPTERS) as FlChapter[];
const chaptersFor = (orientation: string): CourseChapter[] => [
  {
    id: 'intro',
    title: { zh: '引言', en: 'Introduction' },
    sections: [
      { id: 'overview', title: overviewTitle, content: <Introduction orientation={orientation} /> },
      { id: 'recognition', title: recognitionTitle, stage: () => <RecognitionLesson orientation={orientation} /> },
    ],
  },
  ...formulaChapters.map((chapter): CourseChapter => ({
    id: chapter,
    title: FL_CHAPTERS[chapter].title,
    sections: [
      { id: `${chapter}-overview`, title: overviewTitle, content:
        <ChapterOverview key={chapter} chapter={chapter} orientation={orientation} /> },
      { id: `${chapter}-alignment`, title: alignmentTitle, stage: select =>
        <AlignmentExercise chapter={chapter} orientation={orientation}
          onSelect={twist => select(chapter, flSectionId(chapter, twist))} /> },
      ...FL_TWISTS.map(twist => ({
        id: flSectionId(chapter, twist),
        title: { zh: twist.symbol, en: twist.symbol },
        index: () => <CaseIndex chapter={chapter} twist={twist} orientation={orientation} />,
      })),
    ],
  })),
  {
    id: walkthroughId,
    title: { zh: '完整示范', en: 'Full walkthrough' },
    sections: [{ id: walkthroughId, title: walkthroughHeading, stage: () => <FirstLayerDemo orientation={orientation} /> }],
  },
];
const cases = Object.values(FL_CASES).flat();

function positionFor(step: string | null, section: string | null, chapters: readonly CourseChapter[]): CoursePosition {
  // The former UD and DD chapter URLs both open the merged bottom chapter.
  const requestedChapter = step === 'mixed' || step === 'lesson-4' ? 'bottom' : step;
  const index = chapters.findIndex((chapter, order) => requestedChapter === chapter.id || requestedChapter === `lesson-${order + 1}`);
  const request = section ?? (index < 0 ? step : null);
  const sectionId = (cases.find(item => item.id === request)?.sectionId ?? request)?.replace(/^mixed-/, 'bottom-');
  const sectionChapter = chapters.findIndex(chapter => chapter.sections.some(item => item.id === sectionId));
  const chapterIndex = index >= 0 ? index : Math.max(0, sectionChapter);
  const choices = chapters[chapterIndex].sections;
  return { chapterIndex, sectionId: choices.find(item => item.id === sectionId)?.id ?? choices[0].id };
}

export default function Page() {
  const [orientation, setOrientation] = useState(TWO_BY_TWO_ORIENTATION);
  const chapters = useMemo(() => chaptersFor(orientation), [orientation]);
  const [{ step, section }, setLocation] = useQueryStates({ step: parseAsString, section: parseAsString });
  const navigate = useCallback(({ chapterIndex, sectionId }: CoursePosition, chapterChanged: boolean) => {
    const chapter = chapters[chapterIndex];
    const step = chapter.id === walkthroughId ? chapter.id : `lesson-${chapterIndex + 1}`;
    const section = chapter.sections[0].id === sectionId ? null : sectionId;
    void setLocation({ step, section }, { history: chapterChanged ? 'push' : 'replace' });
  }, [chapters, setLocation]);

  return <InteractiveTutorial title={PAGE_META['tutorial/2x2-fl'].title} puzzle="2x2" orientation={orientation} chapters={chapters}
    catalogHref="/tutorial?puzzle=2x2"
    location={positionFor(step, section, chapters)} onNavigate={navigate}
    headerAction={<SettingsPopover className="fl-orientation-settings" iconSize={20}
      label={tr({ zh: '教程设置', en: 'Tutorial settings' })}>
      <CubeOrientationSelect layout="bottom-front" value={orientation} onChange={setOrientation} />
    </SettingsPopover>} />;
}
