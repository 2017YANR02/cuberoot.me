'use client';

import { useEffect, useState } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import BackHome from '@/components/BackHome';
import Link from '@/components/AppLink';
import JsonLd from '@/components/JsonLd';
import HeaderToggles from '@/components/HeaderToggles';
import { tr, T } from '@/i18n/tr';
import { F2L_CHAPTERS, type ChapterId } from './data/chapters';
import { F2L_CASES, ORDERED_BASIC_CASES } from './data/basic-cases';
import ChapterDialogue from './components/ChapterDialogue';
import TeachingTips from './components/TeachingTips';
import TutorialToolbar from './components/TutorialToolbar';
import IntroLessons from './lessons/IntroLessons';
import BasicCaseLesson from './lessons/BasicCaseLesson';
import PracticeLesson from './lessons/PracticeLesson';
import CaseCatalogLesson from './lessons/CaseCatalogLesson';
import ExtractionLesson from './lessons/ExtractionLesson';
import AlgorithmLessons from './lessons/AlgorithmLessons';
import FreePracticeLesson from './lessons/FreePracticeLesson';
import './f2l.css';

export default function F2lTutorial() {
  const [stepId, setStepId] = useQueryState('step', parseAsStringEnum(F2L_CHAPTERS.map(chapter => chapter.id)).withDefault('lesson-1').withOptions({ history: 'push', clearOnDefault: false }));
  const [caseId, setCaseId] = useQueryState('case', parseAsStringEnum(F2L_CASES.map(item => item.id)).withDefault(ORDERED_BASIC_CASES[0].id).withOptions({ history: 'replace' }));
  const [orientation, setOrientation] = useState('');
  const [pauseBetween, setPauseBetween] = useState(true);
  useEffect(() => {
    const initialStep = new URLSearchParams(window.location.search).get('step');
    if (!F2L_CHAPTERS.some(chapter => chapter.id === initialStep)) void setStepId('lesson-1', { history: 'replace' });
  }, [setStepId]);

  const navigate = (id: ChapterId) => {
    if (id !== stepId) void setCaseId(ORDERED_BASIC_CASES[0].id);
    void setStepId(id);
  };
  const nextChapter = () => {
    const next = F2L_CHAPTERS[F2L_CHAPTERS.findIndex(chapter => chapter.id === stepId) + 1];
    if (next) navigate(next.id);
  };

  return <main className="f2l-page">
    <header className="f2l-header">
      <BackHome />
      <Link href="/tutorial?puzzle=3x3" prefetch={false}><T zh="教程" en="Tutorials" /></Link>
      <HeaderToggles className="f2l-header-toggles" />
      <h1><T zh="F2L 教程" en="F2L tutorial" /></h1>
    </header>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Article', headline: tr({ zh: 'F2L 教程', en: 'F2L tutorial' }), description: tr({ zh: '从认识三步标态到顶面调整，逐步学习右前槽的棱角还原。', en: 'Recognize three-move cases, align the top layer and learn front-right pair insertions.' }) }} />
    <TutorialToolbar stepId={stepId} orientation={orientation} pauseBetween={pauseBetween}
      onChapterChange={navigate} onOrientationChange={setOrientation} onPauseBetweenChange={setPauseBetween} />
    <article className="f2l-chapter" key={stepId}>
      <ChapterDialogue stepId={stepId} />
      {(stepId === 'lesson-1' || stepId === 'lesson-2') && <IntroLessons stepId={stepId} orientation={orientation} onNextChapter={nextChapter} />}
      {(stepId === 'lesson-3' || stepId === 'lesson-4') && <BasicCaseLesson stepId={stepId} orientation={orientation} pauseBetween={pauseBetween} caseId={caseId} onCaseChange={id => { void setCaseId(id); }} onNextChapter={nextChapter} />}
      {stepId === 'lesson-5' && <PracticeLesson orientation={orientation} pauseBetween={pauseBetween} onNextChapter={nextChapter} />}
      {stepId === 'lesson-6' && <CaseCatalogLesson orientation={orientation} onNextChapter={nextChapter} />}
      {stepId === 'lesson-7' && <ExtractionLesson orientation={orientation} pauseBetween={pauseBetween} onNextChapter={nextChapter} />}
      {(stepId === 'lesson-8' || stepId === 'lesson-9') && <AlgorithmLessons stepId={stepId} orientation={orientation} pauseBetween={pauseBetween} onNextChapter={nextChapter} />}
      {stepId === 'lesson-10' && <FreePracticeLesson orientation={orientation} pauseBetween={pauseBetween} />}
      <TeachingTips stepId={stepId} />
    </article>
  </main>;
}
