'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseAsString, parseAsStringEnum, useQueryState, useQueryStates } from 'nuqs';
import PageBackLink from '@/components/PageBackLink';
import Link from '@/components/AppLink';
import JsonLd from '@/components/JsonLd';
import { tr, T } from '@/i18n/tr';
import { F2L_CHAPTERS, F2L_NAV_CHAPTERS, type ChapterId } from './data/chapters';
import { F2L_CASES, ORDERED_BASIC_CASES } from './data/basic-cases';
import xPlusFlow from './data/x-plus-flow.json';
import ChatBubble from '@/components/ChatBubble';
import TeachingTips from './components/TeachingTips';
import TutorialToolbar from './components/TutorialToolbar';
import TutorialSettings from './components/TutorialSettings';
import StudyActions, { StudyNavigation } from './components/StudyActions';
import IntroLessons from './lessons/IntroLessons';
import CaseIntroduction from './lessons/CaseIntroduction';
import BasicCaseLesson from './lessons/BasicCaseLesson';
import PracticeLesson from './lessons/PracticeLesson';
import CaseCatalogLesson from './lessons/CaseCatalogLesson';
import ExtractionLesson from './lessons/ExtractionLesson';
import AlgorithmLessons from './lessons/AlgorithmLessons';
import FreePracticeLesson from './lessons/FreePracticeLesson';
import FlowchartLesson from './lessons/FlowchartLesson';
import ThreeMoveLesson from './lessons/ThreeMoveLesson';
import './f2l.css';

export default function F2lTutorial() {
  const page = useRef<HTMLElement>(null);
  const [mobileMenuTarget, setMobileMenuTarget] = useState<HTMLDivElement | null>(null);
  const [{ step: stepId }, setStepId] = useQueryStates({
    step: parseAsStringEnum(F2L_CHAPTERS.map(chapter => chapter.id)).withDefault('lesson-1').withOptions({ history: 'push', clearOnDefault: false }),
    case: parseAsString,
    algCase: parseAsString,
    algGroup: parseAsString,
    auf: parseAsString,
    flowAlg: parseAsString,
    view: parseAsString,
  });
  const [caseId, setCaseId] = useQueryState('case', parseAsStringEnum(F2L_CASES.map(item => item.id)).withDefault(ORDERED_BASIC_CASES[0].id).withOptions({ history: 'replace' }));
  const [flowPathId, setFlowPathId] = useQueryState('flowAlg', parseAsStringEnum(xPlusFlow.paths.map(path => path.id)).withDefault('1'));
  const [orientation, setOrientation] = useState('');
  const [view] = useQueryState('view', parseAsString);
  const isPractice = view === 'practice' && (stepId === 'lesson-4' || stepId === 'lesson-5');
  const [pauseBetween, setPauseBetween] = useState(true);
  const [flowTeaching, setFlowTeaching] = useState(true);
  useEffect(() => {
    const initialStep = new URLSearchParams(window.location.search).get('step');
    if (!F2L_CHAPTERS.some(chapter => chapter.id === initialStep)) void setStepId({ step: 'lesson-1' }, { history: 'replace' });
  }, [setStepId]);

  const navigate = useCallback((id: ChapterId) => {
    if (id === stepId) return;
    // Change chapters and clear their local selections in one URL update.
    void setStepId({ step: id, case: null, algCase: null, algGroup: null, auf: null, flowAlg: null, view: null });
  }, [stepId, setStepId]);
  useEffect(() => {
    const onArrowKey = (event: KeyboardEvent) => {
      if (isPractice) return;
      const direction = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[event.key];
      if (!direction || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (window.matchMedia('(max-width: 760px)').matches) return;
      const root = page.current;
      if (!root) return;
      if (event.target instanceof Element) {
        if (event.target !== document.body && event.target !== document.documentElement && !root.contains(event.target)) return;
        if (event.target.closest('input, select, textarea, [contenteditable], [role="slider"], [role="dialog"], [aria-haspopup], .compact-select, .alg-sim-player, twisty-player, .f2l-editor-stage, .puzzle-art')) return;
      }
      if (document.querySelector('[aria-modal="true"], [role="listbox"], [role="menu"]')) return;
      event.preventDefault();
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const index = F2L_NAV_CHAPTERS.findIndex(chapter => chapter.id === stepId);
        const next = index >= 0 ? F2L_NAV_CHAPTERS[index + direction] : undefined;
        if (next) navigate(next.id);
        return;
      }
      // Reuse the primary section buttons so each lesson keeps its own selection/reset logic.
      // Secondary controls (AUF choices and the case dropdown) retain their own keyboard handling.
      const sectionList = root.querySelector('.f2l-section-nav .f2l-section-list');
      const sections = Array.from(sectionList?.querySelectorAll<HTMLButtonElement>('button.f2l-section-button') ?? []);
      const selected = sections.findIndex(button => button.getAttribute('aria-pressed') === 'true');
      if (selected >= 0) sections[selected + direction]?.click();
    };
    document.addEventListener('keydown', onArrowKey);
    return () => document.removeEventListener('keydown', onArrowKey);
  }, [stepId, navigate, isPractice]);
  const nextChapter = () => {
    const index = F2L_NAV_CHAPTERS.findIndex(chapter => chapter.id === stepId);
    const next = index >= 0 ? F2L_NAV_CHAPTERS[index + 1] : undefined;
    if (next) navigate(next.id);
  };
  const chapterIndex = F2L_NAV_CHAPTERS.findIndex(chapter => chapter.id === stepId);
  const dialogue = F2L_CHAPTERS.find(chapter => chapter.id === stepId)!;

  return <main className={`f2l-page${isPractice ? ' f2l-practice-page' : ''}`} ref={page}>
    <header className="f2l-header">
      <div className="f2l-header-links">
        <PageBackLink fallback="/tutorial?puzzle=3x3" />
        <Link href="/tutorial?puzzle=3x3" prefetch={false}><T zh="教程" en="Tutorials" /></Link>
      </div>
      <div className="f2l-header-title">
        <TutorialSettings orientation={orientation} pauseBetween={pauseBetween} flowTeaching={flowTeaching} onFlowTeachingChange={setFlowTeaching}
          onOrientationChange={setOrientation} onPauseBetweenChange={setPauseBetween} />
        <h1><T zh="F2L 教程" en="F2L tutorial" /></h1>
      </div>
    </header>
    <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Article', headline: tr({ zh: 'F2L 教程', en: 'F2L tutorial' }), description: tr({ zh: '从认识三步基态到顶面调整，逐步学习右前槽的棱角还原。', en: 'Recognize three-move cases, align the top layer and learn front-right pair insertions.' }) }} />
    {!isPractice && <TutorialToolbar stepId={stepId} onChapterChange={navigate} />}
    <article className="f2l-chapter">
      <StudyNavigation.Provider value={{
        mobileMenuTarget, setMobileMenuTarget,
        previous: chapterIndex > 0 ? () => navigate(F2L_NAV_CHAPTERS[chapterIndex - 1].id) : undefined,
        next: chapterIndex >= 0 && chapterIndex < F2L_NAV_CHAPTERS.length - 1 ? nextChapter : undefined,
      }}>
      <div className="f2l-chapter-body">
      {!isPractice && stepId !== 'lesson-10' && <div className="f2l-chapter-dialogue">
        <ChatBubble tail="right" className="f2l-dialogue-question">{tr(dialogue.question)}</ChatBubble>
        <ChatBubble tail="left" className="f2l-dialogue-answer">
          {dialogue.answer.map((paragraph, index) => <p key={index}>{tr(paragraph)}</p>)}
        </ChatBubble>
      </div>}
      {(stepId === 'lesson-1' || stepId === 'lesson-14') && <IntroLessons key={stepId === 'lesson-1' ? `${stepId}:${orientation}` : stepId} stepId={stepId} orientation={orientation}
        onNextChapter={stepId === 'lesson-14' ? () => navigate('lesson-2') : nextChapter} />}
      {stepId === 'lesson-2' && <CaseIntroduction key={orientation} orientation={orientation} />}
      {stepId === 'lesson-12' && <BasicCaseLesson orientation={orientation} pauseBetween={pauseBetween} caseId={caseId} onCaseChange={id => { void setCaseId(id); }} onNextChapter={nextChapter} />}
      {stepId === 'lesson-13' && <PracticeLesson orientation={orientation} pauseBetween={pauseBetween} caseId={caseId} onCaseChange={id => { void setCaseId(id); }} onNextChapter={nextChapter} />}
      {stepId === 'lesson-3' && <CaseCatalogLesson orientation={orientation} onNextChapter={nextChapter} />}
      {(stepId === 'lesson-4' || stepId === 'lesson-5') && <AlgorithmLessons stepId={stepId} orientation={orientation} pauseBetween={pauseBetween} flowTeaching={flowTeaching} onNextChapter={nextChapter} practice={isPractice} />}
      {stepId === 'lesson-6' && <ExtractionLesson orientation={orientation} pauseBetween={pauseBetween} onNextChapter={nextChapter} />}
      {stepId === 'lesson-7' && <FreePracticeLesson orientation={orientation} pauseBetween={pauseBetween} />}
      {stepId === 'lesson-10' && <FlowchartLesson orientation={orientation} pauseBetween={pauseBetween} pathId={flowPathId} onPathChange={id => { void setFlowPathId(id); }} />}
      {stepId === 'lesson-10' && <StudyActions />}
      {stepId === 'lesson-11' && <ThreeMoveLesson orientation={orientation} pauseBetween={pauseBetween} caseId={caseId}
        onCaseChange={id => { void setCaseId(id); }} onComplete={() => navigate('lesson-3')} />}
      </div>
      </StudyNavigation.Provider>
      {!isPractice && <div className="f2l-tips-sidebar"><TeachingTips key={stepId} stepId={stepId} /></div>}
    </article>
  </main>;
}
