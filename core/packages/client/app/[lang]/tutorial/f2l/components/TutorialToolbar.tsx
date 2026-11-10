'use client';

import ChapterNavigation from '../../components/ChapterNavigation';
import { tr } from '@/i18n/tr';
import { F2L_NAV_CHAPTERS, type ChapterId } from '../data/chapters';

export default function TutorialToolbar({ stepId, onChapterChange }: {
  stepId: ChapterId; onChapterChange: (id: ChapterId) => void;
}) {
  const stepIndex = F2L_NAV_CHAPTERS.findIndex(chapter => chapter.id === stepId);
  return <div className="f2l-toolbar">
    <ChapterNavigation label={tr({ zh: '课程章节', en: 'Course chapters' })} selected={stepIndex}
      items={F2L_NAV_CHAPTERS.map(item => ({ id: item.id, title: tr(item.title) }))}
      onSelect={index => onChapterChange(F2L_NAV_CHAPTERS[index].id)} />
  </div>;
}
