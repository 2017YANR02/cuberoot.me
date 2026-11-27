'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { NavigationMenu } from '@app-foundation/navigation-ui';
import { parseAsString, useQueryState, useQueryStates } from 'nuqs';
import { ArrowLeft, ArrowRight } from '@app-foundation/icons/lucide';
import { T, tr } from '@/i18n/tr';
import { activeChapters, chapters as allChapters, lessonSourceChapter, practiceExampleOrder, practiceReviewLocation } from './curriculum';
import LessonContent from './LessonContent';
import LessonThumbnail from './LessonThumbnail';
import { SolveOverviewFlowchart } from './SolveFlowchart';
import PracticeRoute from './PracticeRoute';
import Walkthrough from './Walkthrough';
import SectionMenu from '../components/SectionMenu';
import TutorialNavigationShell, { sectionItems, sectionLink } from '../components/TutorialNavigationShell';
import ChapterNavigation from '../components/ChapterNavigation';
import CourseHeader from '../components/CourseHeader';
import './lesson-support.css';
import '@app-foundation/navigation-ui/navigation.css';
import './lbl.css';
import '../components/single-caption.css';
import '../components/responsive-layout.css';

const lessonStorageKey = 'lbl:current-lesson';
const legacyLessonStorageKey = 'lbl2:current-lesson';
const solveStages = activeChapters.filter(chapter =>
  chapter.id !== 'structure' && chapter.lessons.some(lesson => lesson.kind === 'flowchart'));

function chapterStep(id: string) {
  const index = activeChapters.findIndex(chapter => chapter.id === id);
  return index >= 0 ? `lesson-${index + 1}` : `lesson-${id}`;
}

function keepMouseNavigationUnfocused(event: MouseEvent<HTMLButtonElement>) {
  if (event.button === 0) event.preventDefault();
}

export default function LblTutorial() {
  const [view] = useQueryState('view');
  if (view === 'practice') return <PracticeRoute />;
  const archive = view === 'archive';
  return <LblLessonView key={archive ? 'archive' : 'active'} archive={archive} />;
}

function LblLessonView({ archive }: { archive: boolean }) {
  const chapters = archive ? allChapters : activeChapters;
  const storageSuffix = archive ? ':archive' : '';
  const storageKey = `${lessonStorageKey}${storageSuffix}`;
  const legacyStorageKey = `${legacyLessonStorageKey}${storageSuffix}`;
  const [{ view: linkedView, step: linkedStep, case: linkedCase, section: linkedSection }, setPracticeRoute] = useQueryStates({
    view: parseAsString, step: parseAsString, case: parseAsString, section: parseAsString,
  });
  const [chapter, setChapter] = useState(0);
  const [section, setSection] = useState(0);
  const [revision, setRevision] = useState(0);
  const observedRoute = useRef<string | null>(null);
  const appliedRoute = useRef<{ step: string; case: string | null; section: string | null } | null>(null);

  const [daisyLiftIndex, setDaisyLiftIndex] = useState(0);
  const [showDaisyTerms, setShowDaisyTerms] = useState(false);
  const currentChapter = chapters[chapter];
  const sections = currentChapter.lessons;
  const currentLesson = sections[section];
  const isWalkthrough = currentLesson.kind === 'walkthrough';
  const sourceChapter = lessonSourceChapter(currentChapter, currentLesson);
  const isDaisyLift = currentChapter.id === 'daisy' && currentLesson.id === 'case-0';
  const isDaisyOverview = currentChapter.id === 'daisy' && currentLesson.kind === 'overview';
  const practiceOrder = practiceExampleOrder(currentChapter);
  const practiceIndex = isDaisyLift ? daisyLiftIndex : (currentLesson.practiceIndices?.[0] ?? practiceOrder[0]);
  const practiceLocation = {
    step: currentChapter.id,
    case: currentLesson.id === 'white-edge' ? 'white-edge' : String(Math.max(0, practiceOrder.indexOf(practiceIndex)) + 1),
  };
  useEffect(() => {
    if ((!isDaisyLift && (!isDaisyOverview || showDaisyTerms))) return;
    function switchHandWithSpace(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.defaultPrevented || event.repeat || event.isComposing ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest(
        'input, textarea, select, button, a, [contenteditable], [role="slider"], [role="dialog"], .playback-bar',
      )) return;
      event.preventDefault();
      if (isDaisyOverview) setShowDaisyTerms(true);
      else setDaisyLiftIndex(index => 1 - index);
    }
    document.addEventListener('keydown', switchHandWithSpace);
    return () => document.removeEventListener('keydown', switchHandWithSpace);
  }, [isDaisyLift, isDaisyOverview, showDaisyTerms]);
  useEffect(() => {
    const walkthroughLink = linkedView === 'walkthrough';
    const routeKey = JSON.stringify([linkedView, linkedStep, linkedCase, linkedSection]);
    if (observedRoute.current === routeKey) return;
    const initial = observedRoute.current === null;
    observedRoute.current = routeKey;
    // Ignore the URL update from our own navigation: it already selected the section.
    if (!walkthroughLink && appliedRoute.current?.step === linkedStep && appliedRoute.current.case === linkedCase &&
        appliedRoute.current.section === linkedSection) return;
    let saved: string | null = null;
    try {
      if (initial) saved = sessionStorage.getItem(storageKey) ?? sessionStorage.getItem(legacyStorageKey);
    } catch {
      // Direct chapter links also work without browser storage.
    }
    const [savedChapter, savedLesson] = saved?.split('/') ?? [];
    // Existing practice review links still use the internal chapter ID.
    const requestedChapter = walkthroughLink ? 'walkthrough' : linkedStep;
    const linkedChapter = chapters.findIndex(item => chapterStep(item.id) === requestedChapter || item.id === requestedChapter);
    const chapterIndex = requestedChapter ? Math.max(0, linkedChapter)
      : Math.max(0, chapters.findIndex(item => item.id === savedChapter));
    const target = chapters[chapterIndex];
    const linkedSectionIndex = (!linkedStep || linkedChapter >= 0) && linkedSection
      ? target.lessons.findIndex(lesson => lesson.id === linkedSection) : -1;
    const savedLeftLift = target.id === 'daisy' && savedLesson === 'case-1';
    const sectionIndex = initial && savedChapter === target.id
      ? Math.max(0, target.lessons.findIndex(item => item.id === (savedLeftLift ? 'case-0' : savedLesson))) : 0;
    const review = linkedSectionIndex >= 0 ? { section: linkedSectionIndex, daisyLiftIndex: 0 }
      : linkedChapter >= 0 && linkedCase ? practiceReviewLocation(target, linkedCase)
        : { section: sectionIndex, daisyLiftIndex: savedLeftLift ? 1 : 0 };
    const step = chapterStep(target.id);
    appliedRoute.current = { step, case: linkedCase, section: linkedSection };
    setChapter(chapterIndex);
    setSection(review.section);
    setDaisyLiftIndex(review.daisyLiftIndex);
    setShowDaisyTerms(false);
    if (walkthroughLink) void setPracticeRoute({ view: null, step, case: null, section: null }, { history: 'replace' });
    else if (linkedStep !== step) void setPracticeRoute({ step }, { history: 'replace' });
    try {
      sessionStorage.setItem(storageKey, `${target.id}/${target.lessons[review.section].id}`);
    } catch {
      // Navigation still works when browser storage is unavailable.
    }
  }, [chapters, linkedView, linkedStep, linkedCase, linkedSection, storageKey, legacyStorageKey, setPracticeRoute]);
  const goToLesson = useCallback((chapterIndex: number, sectionIndex: number) => {
    setChapter(chapterIndex);
    setSection(sectionIndex);
    setDaisyLiftIndex(0);
    setShowDaisyTerms(false);
    setRevision(value => value + 1);
    const target = chapters[chapterIndex];
    const step = chapterStep(target.id);
    const lesson = target.lessons[sectionIndex];
    const linkedSection = lesson.kind === 'flowchart' ? lesson.id : null;
    appliedRoute.current = { step, case: null, section: linkedSection };
    void setPracticeRoute({ step, case: null, section: linkedSection }, { history: chapterIndex !== chapter ? 'push' : 'replace' });
    try {
      sessionStorage.setItem(storageKey, `${target.id}/${lesson.id}`);
    } catch {
      // Navigation still works when browser storage is unavailable.
    }
  }, [chapter, chapters, setPracticeRoute, storageKey]);
  useEffect(() => {
    function navigateWithArrows(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
      if (window.matchMedia('(max-width: 760px)').matches) return;
      if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable], [role="slider"], .lbl-demonstration, .lbl-complete-player')) return;
      const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
      if (!horizontal && event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      if (horizontal) {
        const next = chapter + direction;
        if (next >= 0 && next < chapters.length) goToLesson(next, 0);
      } else {
        const next = section + direction;
        if (next >= 0 && next < sections.length) goToLesson(chapter, next);
      }
    }
    document.addEventListener('keydown', navigateWithArrows);
    return () => document.removeEventListener('keydown', navigateWithArrows);
  }, [chapter, section, chapters.length, sections.length, goToLesson]);
  function chooseChapter(index: number) {
    if (index !== chapter) goToLesson(index, 0);
  }
  function chooseSection(index: number) {
    goToLesson(chapter, index);
  }
  function advance(direction: number) {
    const next = section + direction;
    if (next < 0) {
      goToLesson(chapter - 1, chapters[chapter - 1].lessons.length - 1);
    } else if (next >= sections.length) chooseChapter(chapter + 1);
    else chooseSection(next);
  }
  const items = isWalkthrough ? [] : sections.map((label, index) => ({
    id: label.id, onSelect: () => chooseSection(index), label: tr(label.title), active: section === index,
    icon: <LessonThumbnail chapter={lessonSourceChapter(currentChapter, label)} lesson={label} size={18} />,
  }));
  const navigation = <NavigationMenu items={sectionItems(items)} collapsed={false} label={tr({ zh: '本章小节', en: 'Chapter sections' })} renderLink={sectionLink(items)} />;

  const chapterNavigation = <ChapterNavigation label={tr({ zh: '课程章节', en: 'Course chapters' })} selected={chapter}
      items={chapters.map(item => ({ id: item.id, title: <>{tr(item.title)}{item.archived && <T zh="（归档）" en=" (Archived)" />}</> }))}
      onSelect={chooseChapter} onMouseDown={keepMouseNavigationUnfocused} />;

  return <main className={isWalkthrough ? 'lbl-page tutorial-course lbl-walkthrough-page' : 'lbl-page'} data-center-content={isWalkthrough || undefined}>
    <CourseHeader title={tr({ zh: '三阶魔方层先法', en: '3×3 LBL' })} catalogHref="/tutorial?puzzle=3x3" />
    {chapterNavigation}
    {isWalkthrough ? <Walkthrough onPrevious={() => advance(-1)} /> : <TutorialNavigationShell className="lbl-body" sections={{ items }}>
      <div className="lbl-learning">
        <div className="lbl-lesson-scroll" key={`${currentChapter.id}/${currentLesson.id}/${revision}`}>
          {currentChapter.id === 'structure' && currentLesson.kind === 'flowchart' ?
            <SolveOverviewFlowchart label={tr(currentLesson.title)} stages={solveStages} onSelectStage={id => {
              const chapterIndex = chapters.findIndex(item => item.id === id);
              const sectionIndex = chapters[chapterIndex]?.lessons.findIndex(item => item.kind === 'flowchart') ?? -1;
              if (sectionIndex >= 0) goToLesson(chapterIndex, sectionIndex);
            }} />
          : isDaisyOverview ? <div className="lbl-daisy-overview-content">
            <LessonContent key={String(showDaisyTerms)} chapter={sourceChapter}
              lesson={showDaisyTerms ? { ...currentLesson, kind: 'terms' } : currentLesson} hostChapterId={currentChapter.id} inlineAction={!showDaisyTerms && <button type="button" className="lbl-guide-continue lbl-guide-continue-hint" onClick={() => setShowDaisyTerms(true)}>{tr({ zh: '点击继续', en: 'Click to continue' })}</button>} />
          </div> : isDaisyLift ? <div className="lbl-daisy-lift-content">
            <LessonContent key={daisyLiftIndex} chapter={sourceChapter}
              lesson={{ ...currentLesson, example: currentChapter.examples[daisyLiftIndex] }} hostChapterId={currentChapter.id} inlineAction={<button type="button" className="lbl-guide-continue lbl-guide-continue-hint lbl-daisy-lift-switch"
              onClick={() => setDaisyLiftIndex(index => 1 - index)}>{tr(daisyLiftIndex === 0
              ? { zh: '点击切换为左手', en: 'Click to switch to the left hand' }
              : { zh: '点击切换为右手', en: 'Click to switch to the right hand' })}</button>} />

          </div> : <LessonContent chapter={sourceChapter} lesson={currentLesson} hostChapterId={currentChapter.id} onSelectLesson={id => {
            const target = sections.findIndex(item => item.id === id);
            if (target >= 0) chooseSection(target);
          }} />}
        </div>
        <div className="lbl-demo-toolbar" />
        <footer className="lbl-footer">
          <button className="lbl-footer-button tutorial-page-button" aria-label={tr({ zh: '上一节', en: 'Previous section' })} type="button" disabled={chapter === 0 && section === 0} onClick={() => advance(-1)}><ArrowLeft size={17} aria-hidden="true" /></button>
          <SectionMenu label={tr(currentLesson.title)}>{navigation}</SectionMenu>
          <div className="lbl-footer-actions" id="lbl-footer-actions">
            {currentLesson.kind !== 'overview' && currentLesson.kind !== 'complete' && currentLesson.kind !== 'flowchart' && currentLesson.kind !== 'layers' &&
            !(currentLesson.kind === 'terms' && ['daisy', 'middle'].includes(sourceChapter.id)) &&
            sourceChapter.id !== 'structure' && (sourceChapter.examples.length > 0 || currentLesson.practiceIndices?.some(index => currentChapter.examples[index])) && <button className="lbl-footer-button lbl-footer-next lbl-practice-button tutorial-practice-button" type="button" onClick={() => void setPracticeRoute({ view: 'practice', step: practiceLocation.step, case: practiceLocation.case }, { history: 'push' })}>
            <T zh="练习" en="Practice" />
          </button>}
          </div>
          <button className="lbl-footer-button lbl-footer-next tutorial-page-button" aria-label={tr({ zh: '下一节', en: 'Next section' })} type="button" disabled={chapter === chapters.length - 1 && section === sections.length - 1} onClick={() => advance(1)}><ArrowRight size={17} aria-hidden="true" /></button>
        </footer>
      </div>
    </TutorialNavigationShell>}
  </main>;
}
