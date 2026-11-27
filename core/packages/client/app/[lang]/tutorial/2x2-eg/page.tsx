'use client';

import { useCallback, useState } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import { PAGE_META } from '@cuberoot/shared/page-catalog';
import CubeOrientationSelect from '@/components/CubeOrientationSelect';
import { SettingsPopover } from '@/components/TrainingSettings';
import { tr } from '@/i18n/tr';
import InteractiveTutorial, { type CourseChapter, type CoursePosition } from '../components/InteractiveTutorial';
import { TWO_BY_TWO_ORIENTATION } from '../lib/2x2-state';
import { egCase, EG_SETS, EG_SHAPES } from './lesson-data';
import { TopDiagram } from './diagrams';
import { Beyond, CaseIndex, Overview, SetGuide, Walkthrough, WhyEg } from './lessons';
import GroupSelectionPractice from './GroupSelectionPractice';
import { EgOrientationContext } from './orientation';
import './eg-course.css';

const chapters: CourseChapter[] = [
  {
    id: 'intro', title: { zh: '引言', en: 'Introduction' },
    sections: [
      { id: 'overview', title: { zh: '概览', en: 'Overview' }, content: <Overview /> },
      { id: 'why-eg', title: { zh: '为什么用 EG', en: 'Why use EG' }, index: () => <WhyEg /> },
      { id: 'side-colors', title: { zh: '选公式组', en: 'Choose an algorithm group' },
        stage: select => <GroupSelectionPractice onSelect={select} /> },
    ],
  },
  ...EG_SETS.map(({ id, name }): CourseChapter => ({
    id, title: { zh: name, en: name },
    sections: [
      { id: 'overview', title: { zh: '概览', en: 'Overview' }, index: select =>
        <SetGuide set={id} onSelect={shape => select(id, shape)} /> },
      ...EG_SHAPES.map((shape): CourseChapter['sections'][number] => ({
        id: shape.id, title: shape.name, index: () => <CaseIndex key={id} set={id} shape={shape.id} />,
        icon: <span className="eg-section-icon" aria-hidden="true">
          <TopDiagram setup={egCase(id, shape.example).setup} size={28} topOnly decorative />
        </span>,
      })),
    ],
  })),
  {
    id: 'practice', title: { zh: '完整示范', en: 'Full walkthrough' },
    sections: [
      { id: 'walkthrough', title: { zh: '完整示范', en: 'Full walkthrough' }, stage: () => <Walkthrough /> },
      { id: 'inspection', title: { zh: '预判与视频', en: 'Inspection and videos' }, index: () => <Beyond /> },
    ],
  },
];

export default function Page() {
  const [orientation, setOrientation] = useState(TWO_BY_TWO_ORIENTATION);
  const [{ step, section }, setLocation] = useQueryStates({ step: parseAsString, section: parseAsString });
  const chapterIndex = Math.max(0, chapters.findIndex(chapter => chapter.id === step));
  const sections = chapters[chapterIndex].sections;
  const location = { chapterIndex, sectionId: sections.find(item => item.id === section)?.id ?? sections[0].id };
  const navigate = useCallback(({ chapterIndex, sectionId }: CoursePosition, chapterChanged: boolean) => {
    const chapter = chapters[chapterIndex];
    void setLocation({ step: chapterIndex === 0 ? null : chapter.id, section: sectionId === chapter.sections[0].id ? null : sectionId },
      { history: chapterChanged ? 'push' : 'replace' });
  }, [setLocation]);
  return <EgOrientationContext.Provider value={orientation}>
    <InteractiveTutorial title={PAGE_META['tutorial/2x2-eg'].title} puzzle="2x2" orientation={orientation}
      chapters={chapters} location={location} onNavigate={navigate} catalogHref="/tutorial?puzzle=2x2"
      headerAction={<SettingsPopover className="eg-orientation-settings" iconSize={20}
        label={tr({ zh: '教程设置', en: 'Tutorial settings' })}>
        <CubeOrientationSelect layout="bottom" value={orientation} onChange={setOrientation} />
      </SettingsPopover>} />
  </EgOrientationContext.Provider>;
}
