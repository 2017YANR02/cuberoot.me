'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { NavigationMenu } from '@app-foundation/navigation-ui';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronLeft } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { T, tr } from '@/i18n/tr';
import { chapters } from './curriculum';
import LessonContent from './LessonContent';
import LessonThumbnail from './LessonThumbnail';
import Practice from './Practice';
import './lesson-support.css';
import '@app-foundation/navigation-ui/navigation.css';
import './lbl2.css';

const lessonStorageKey = 'lbl2:current-lesson';

export default function Lbl2Template() {
  const [chapter, setChapter] = useState(0);
  const [section, setSection] = useState(0);
  const [revision, setRevision] = useState(0);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const currentChapter = chapters[chapter];
  const sections = currentChapter.lessons;
  const currentLesson = sections[section];
  const menu = useRef<HTMLDetailsElement>(null);
  const chapterNav = useRef<HTMLElement>(null);
  useEffect(() => {
    let saved: string | null;
    try {
      saved = sessionStorage.getItem(lessonStorageKey);
    } catch {
      return;
    }
    if (!saved) return;
    const [chapterId, lessonId] = saved.split('/');
    const chapterIndex = chapters.findIndex(item => item.id === chapterId);
    if (chapterIndex < 0) return;
    const sectionIndex = chapters[chapterIndex].lessons.findIndex(item => item.id === lessonId);
    setChapter(chapterIndex);
    setSection(Math.max(0, sectionIndex));
  }, []);
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
  useEffect(() => {
    const nav = chapterNav.current;
    if (!nav) return;
    const centerChapter = () => {
      const button = nav.querySelector<HTMLElement>('[aria-current="step"]');
      if (!button) return;
      const navRect = nav.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      nav.scrollTo({ left: nav.scrollLeft + buttonRect.left - navRect.left - (nav.clientWidth - buttonRect.width) / 2,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    };
    centerChapter();
    const resize = new ResizeObserver(centerChapter);
    resize.observe(nav);
    return () => resize.disconnect();
  }, [chapter, practiceOpen]);
  function goToLesson(chapterIndex: number, sectionIndex: number) {
    setChapter(chapterIndex);
    setSection(sectionIndex);
    setRevision(value => value + 1);
    if (menu.current) menu.current.open = false;
    const target = chapters[chapterIndex];
    try {
      sessionStorage.setItem(lessonStorageKey, `${target.id}/${target.lessons[sectionIndex].id}`);
    } catch {
      // Navigation still works when browser storage is unavailable.
    }
  }
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
    icon: <LessonThumbnail chapter={currentChapter} lesson={label} />,
  }));
  // The shared menu owns item styling; the host owns lesson selection.
  const navigation = <NavigationMenu items={items} collapsed={false} label={tr({ zh: '本章小节', en: 'Chapter sections' })}
    renderLink={({ children, href, onClick, className, ...props }) => {
      return <button className={className} aria-label={props['aria-label']} aria-current={props['aria-current']} type="button" onClick={() => { chooseSection(Number(href.replace('#section-', ''))); onClick?.(); }}>{children}</button>;
    }} />;

  if (practiceOpen) return <Practice step={currentChapter}
    initialIndex={currentLesson.id === 'white-edge' ? 0 : Math.max(0, Number(currentLesson.id.match(/^case-(\d+)$/)?.[1] ?? 0))}
    extraExample={currentLesson.id === 'white-edge' ? currentLesson.example : undefined}
    onNextChapter={chapter < chapters.length - 1 ? () => { goToLesson(chapter + 1, 0); setPracticeOpen(false); } : undefined}
    onClose={() => setPracticeOpen(false)} />;

  return <main className="lbl2-page">
    <header className="lbl2-header">
      <AppLink href="/tutorial?puzzle=3x3" prefetch={false}>
        <ChevronLeft size={17} aria-hidden="true" /><T zh="教程" en="Tutorials" />
      </AppLink>
      <h1><T zh="层先法" en="LBL" /></h1>
    </header>
    <nav className="lbl2-chapters" ref={chapterNav} aria-label={tr({ zh: '课程章节', en: 'Course chapters' })}>
      <div className="lbl2-chapter-track" style={{ '--chapter': chapter, '--chapter-count': chapters.length } as CSSProperties}>
        <span className="lbl2-indicator" aria-hidden="true" />
        {chapters.map((label, index) => <button key={index} type="button" aria-current={chapter === index ? 'step' : undefined}
          onClick={() => chooseChapter(index)}>
          <span className="lbl2-chapter-line" /><span>{tr(label.title)}</span>
        </button>)}
      </div>
    </nav>
    <div className="lbl2-body">
      <aside className="lbl2-sidebar">{navigation}</aside>
      <div className="lbl2-learning">
        <div className="lbl2-demo-toolbar" id="lbl2-demo-toolbar">
          {currentChapter.id !== 'structure' && currentChapter.examples.length > 0 && <button className="lbl-button lbl2-practice-button" type="button" onClick={() => setPracticeOpen(true)}>
            <T zh="练习本节" en="Practice this lesson" /><ArrowRight size={16} aria-hidden="true" />
          </button>}
        </div>
        <div className="lbl2-lesson-scroll" key={`${currentChapter.id}/${currentLesson.id}/${revision}`}>
          <LessonContent chapter={currentChapter} lesson={currentLesson} />
        </div>
        <footer className="lbl2-footer">
          <button type="button" disabled={chapter === 0 && section === 0} onClick={() => advance(-1)}><ArrowLeft size={17} /><T zh="上一节" en="Previous" /></button>
          <details className="lbl2-mobile-menu" ref={menu}>
            <summary><span className="lbl2-section-count">{section + 1}/{sections.length}</span><span>{tr(currentLesson.title)}</span><ChevronDown size={15} /></summary>
            <div className="lbl2-section-popover" data-site-surface="popover">{navigation}</div>
          </details>
          <button type="button" disabled={chapter === chapters.length - 1 && section === sections.length - 1} onClick={() => advance(1)}><T zh="下一节" en="Next" /><ArrowRight size={17} /></button>
        </footer>
      </div>
    </div>
  </main>;
}
