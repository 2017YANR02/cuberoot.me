'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { NavigationMenu } from '@app-foundation/navigation-ui';
import { parseAsString, useQueryState, useQueryStates } from 'nuqs';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronLeft } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { T, tr } from '@/i18n/tr';
import { activeChapters, chapters as allChapters, lessonSourceChapter, practiceExampleOrder, practiceReviewLocation } from './curriculum';
import LessonContent from './LessonContent';
import LessonThumbnail from './LessonThumbnail';
import PracticeRoute from './PracticeRoute';
import Walkthrough from './Walkthrough';
import ChapterNavigation from '../components/ChapterNavigation';
import './lesson-support.css';
import '@app-foundation/navigation-ui/navigation.css';
import './lbl.css';

const lessonStorageKey = 'lbl:current-lesson';
const legacyLessonStorageKey = 'lbl2:current-lesson';

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
  if (view === 'walkthrough') return <Walkthrough />;
  const archive = view === 'archive';
  return <LblLessonView key={archive ? 'archive' : 'active'} archive={archive} />;
}

function LblLessonView({ archive }: { archive: boolean }) {
  const chapters = archive ? allChapters : activeChapters;
  const storageSuffix = archive ? ':archive' : '';
  const storageKey = `${lessonStorageKey}${storageSuffix}`;
  const legacyStorageKey = `${legacyLessonStorageKey}${storageSuffix}`;
  const [linkedStep] = useQueryState('step');
  const [linkedCase] = useQueryState('case');
  const [chapter, setChapter] = useState(0);
  const [section, setSection] = useState(0);
  const [revision, setRevision] = useState(0);
  const observedRoute = useRef<string | null>(null);
  const appliedRoute = useRef<{ step: string; case: string | null } | null>(null);

  const [, setPracticeRoute] = useQueryStates({ view: parseAsString, step: parseAsString, case: parseAsString });

  const [daisyLiftIndex, setDaisyLiftIndex] = useState(0);
  const [showDaisyTerms, setShowDaisyTerms] = useState(false);
  const currentChapter = chapters[chapter];
  const sections = currentChapter.lessons;
  const currentLesson = sections[section];
  const sourceChapter = lessonSourceChapter(currentChapter, currentLesson);
  const isDaisyLift = currentChapter.id === 'daisy' && currentLesson.id === 'case-0';
  const isDaisyOverview = currentChapter.id === 'daisy' && currentLesson.kind === 'overview';
  const menu = useRef<HTMLDetailsElement>(null);
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
    const routeKey = JSON.stringify([linkedStep, linkedCase]);
    if (observedRoute.current === routeKey) return;
    const initial = observedRoute.current === null;
    observedRoute.current = routeKey;
    // Ignore the URL update from our own navigation: it already selected the section.
    if (appliedRoute.current?.step === linkedStep && appliedRoute.current.case === linkedCase) return;
    let saved: string | null = null;
    try {
      if (initial) saved = sessionStorage.getItem(storageKey) ?? sessionStorage.getItem(legacyStorageKey);
    } catch {
      // Direct chapter links also work without browser storage.
    }
    const [savedChapter, savedLesson] = saved?.split('/') ?? [];
    // Existing practice review links still use the internal chapter ID.
    const linkedChapter = chapters.findIndex(item => chapterStep(item.id) === linkedStep || item.id === linkedStep);
    const chapterIndex = linkedStep ? Math.max(0, linkedChapter)
      : Math.max(0, chapters.findIndex(item => item.id === savedChapter));
    const target = chapters[chapterIndex];
    const savedLeftLift = target.id === 'daisy' && savedLesson === 'case-1';
    const sectionIndex = initial && savedChapter === target.id
      ? Math.max(0, target.lessons.findIndex(item => item.id === (savedLeftLift ? 'case-0' : savedLesson))) : 0;
    const review = linkedChapter >= 0 && linkedCase ? practiceReviewLocation(target, linkedCase)
      : { section: sectionIndex, daisyLiftIndex: savedLeftLift ? 1 : 0 };
    const step = chapterStep(target.id);
    appliedRoute.current = { step, case: linkedCase };
    setChapter(chapterIndex);
    setSection(review.section);
    setDaisyLiftIndex(review.daisyLiftIndex);
    setShowDaisyTerms(false);
    if (linkedStep !== step) void setPracticeRoute({ step }, { history: 'replace' });
    try {
      sessionStorage.setItem(storageKey, `${target.id}/${target.lessons[review.section].id}`);
    } catch {
      // Navigation still works when browser storage is unavailable.
    }
  }, [chapters, linkedStep, linkedCase, storageKey, legacyStorageKey, setPracticeRoute]);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);
  const goToLesson = useCallback((chapterIndex: number, sectionIndex: number) => {
    setChapter(chapterIndex);
    setSection(sectionIndex);
    setDaisyLiftIndex(0);
    setShowDaisyTerms(false);
    setRevision(value => value + 1);
    if (menu.current) menu.current.open = false;
    const target = chapters[chapterIndex];
    const step = chapterStep(target.id);
    appliedRoute.current = { step, case: null };
    void setPracticeRoute({ step, case: null }, { history: chapterIndex !== chapter ? 'push' : 'replace' });
    try {
      sessionStorage.setItem(storageKey, `${target.id}/${target.lessons[sectionIndex].id}`);
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
  const items = sections.map((label, index) => ({
    id: label.id, href: `#section-${index}`, label: tr(label.title), active: section === index,
    icon: <LessonThumbnail chapter={lessonSourceChapter(currentChapter, label)} lesson={label} />,
  }));
  // The shared menu owns item styling; the host owns lesson selection.
  const navigation = <NavigationMenu items={items} collapsed={false} label={tr({ zh: '本章小节', en: 'Chapter sections' })}
    renderLink={({ children, href, onClick, className, ...props }) => {
      return <button className={`lbl-section-button ${className ?? ''}`} aria-label={props['aria-label']} aria-current={props['aria-current']} type="button" onMouseDown={keepMouseNavigationUnfocused} onClick={() => { chooseSection(Number(href.replace('#section-', ''))); onClick?.(); }}>{children}</button>;
    }} />;

  const chapterNavigation = <ChapterNavigation label={tr({ zh: '课程章节', en: 'Course chapters' })} selected={chapter}
      items={chapters.map(item => ({ id: item.id, title: <>{tr(item.title)}{item.archived && <T zh="（归档）" en=" (Archived)" />}</> }))}
      onSelect={chooseChapter} onMouseDown={keepMouseNavigationUnfocused} />;

  return <main className="lbl-page">
    <header className="lbl-header">
      <AppLink href="/tutorial?puzzle=3x3" prefetch={false}>
        <ChevronLeft size={17} aria-hidden="true" /><T zh="教程" en="Tutorials" />
      </AppLink>
      <div className="lbl-header-title">
        {!archive && <AppLink href="/tutorial/lbl?view=walkthrough" prefetch={false}><T zh="完整还原" en="Full solve" /></AppLink>}
        <h1><T zh="层先法" en="LBL" /></h1>
      </div>
    </header>
    {chapterNavigation}
    <div className="lbl-body">
      <aside className="lbl-sidebar">{navigation}</aside>
      <div className="lbl-learning">
        <div className="lbl-lesson-scroll" key={`${currentChapter.id}/${currentLesson.id}/${revision}`}
          onClick={isDaisyLift ? event => {
            if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea, [role="slider"], .playback-bar')) return;
            setDaisyLiftIndex(index => 1 - index);
          } : undefined}>
          {isDaisyOverview ? <div className="lbl-daisy-overview-content">
            <LessonContent key={String(showDaisyTerms)} chapter={sourceChapter}
              lesson={showDaisyTerms ? { ...currentLesson, kind: 'terms' } : currentLesson} hostChapterId={currentChapter.id} />
            {!showDaisyTerms && <><button type="button" className="lbl-guide-continue" onClick={() => setShowDaisyTerms(true)}
              aria-label={tr({ zh: '点击学习区继续', en: 'Click the lesson area to continue' })} />
            <span className="lbl-guide-continue-hint">{tr({ zh: '点击学习区继续', en: 'Click the lesson area to continue' })}</span></>}
          </div> : isDaisyLift ? <div className="lbl-daisy-lift-content">
            <LessonContent key={daisyLiftIndex} chapter={sourceChapter}
              lesson={{ ...currentLesson, example: currentChapter.examples[daisyLiftIndex] }} hostChapterId={currentChapter.id} />
            <button type="button" className="lbl-guide-continue"
              onClick={() => setDaisyLiftIndex(index => 1 - index)}
              aria-label={tr(daisyLiftIndex === 0
                ? { zh: '切换为左手上', en: 'Switch to lift left' }
                : { zh: '切换为右手上', en: 'Switch to lift right' })} />
            <span className="lbl-guide-continue-hint">{tr(daisyLiftIndex === 0
              ? { zh: '右手上，点击空白区切换为左手', en: 'Lift right. Click an empty area to switch to the left hand.' }
              : { zh: '左手上，点击空白区切换为右手', en: 'Lift left. Click an empty area to switch to the right hand.' })}</span>
          </div> : <LessonContent chapter={sourceChapter} lesson={currentLesson} hostChapterId={currentChapter.id} onSelectLesson={id => {
            const target = sections.findIndex(item => item.id === id);
            if (target >= 0) chooseSection(target);
          }} />}
        </div>
        <div className="lbl-demo-toolbar">
          <details className="lbl-mobile-menu" ref={menu}>
            <summary><span className="lbl-section-count">{section + 1}/{sections.length}</span><span>{tr(currentLesson.title)}</span><ChevronDown size={15} /></summary>
            <div className="lbl-section-popover" data-site-surface="popover">{navigation}</div>
          </details>
        </div>
        <footer className="lbl-footer">
          <button className="lbl-footer-button" type="button" disabled={chapter === 0 && section === 0} onClick={() => advance(-1)}><ArrowLeft size={17} /><T zh="上一节" en="Previous" /></button>
          <div className="lbl-footer-actions" id="lbl-footer-actions">
            {currentLesson.kind !== 'overview' && currentLesson.kind !== 'complete' && currentLesson.kind !== 'flowchart' && currentLesson.kind !== 'layers' &&
            !(currentLesson.kind === 'terms' && ['daisy', 'middle'].includes(sourceChapter.id)) &&
            sourceChapter.id !== 'structure' && sourceChapter.examples.length > 0 && <button className="lbl-footer-button lbl-footer-next lbl-practice-button" type="button" onClick={() => { const order = practiceExampleOrder(currentChapter); const index = isDaisyLift ? daisyLiftIndex : (currentLesson.practiceIndices?.[0] ?? order[0]); void setPracticeRoute({ view: 'practice', step: currentChapter.id, case: currentLesson.id === 'white-edge' ? 'white-edge' : String(Math.max(0, order.indexOf(index)) + 1) }, { history: 'push' }); }}>
            <T zh="练习本节" en="Practice this lesson" /><ArrowRight size={17} aria-hidden="true" />
          </button>}
          </div>
          <button className="lbl-footer-button lbl-footer-next" type="button" disabled={chapter === chapters.length - 1 && section === sections.length - 1} onClick={() => advance(1)}><T zh="下一节" en="Next" /><ArrowRight size={17} /></button>
        </footer>
      </div>
    </div>
  </main>;
}
