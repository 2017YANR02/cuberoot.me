'use client';

import useTeachingFollow from '../../components/useTeachingFollow';
import TutorialNavigationShell from '../../components/TutorialNavigationShell';
import ReadingFit from '../../components/ReadingFit';
import useReferenceFitFallback from '../../components/useReferenceFitFallback';

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseAsString, useQueryState, useQueryStates } from 'nuqs';
import { Play, Shuffle, Wand2 } from '@app-foundation/icons/lucide';
import { Alg } from 'cubing/alg';
import { VisualCube } from '@/components/VisualCube';
import { Tooltip } from '@/components/Tooltip';
import SettingsDialog from '@/components/SettingsDialog';
import { AlgFormulaReadRow } from '@/components/AlgFormulaRow';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { tr, T } from '@/i18n/tr';
import ClassifiedSectionNavigation from '../components/ClassifiedSectionNavigation';
import { f2lCatalogCases, f2lCatalogDiagrams, f2lGroupName, f2lTeachingPaths } from '../lib/curriculum';
import StudyActions from '../components/StudyActions';
import SectionNavigation from '../components/SectionNavigation';
import AlgorithmPractice from './AlgorithmPractice';
import TeachingFlowGraph from '../components/TeachingFlowGraph';
import { F2L_CLASSIFICATION_SECTIONS } from '../data/classification';

const NO_STOPS: readonly number[] = [];

export default function AlgorithmLessons({ stepId, orientation, pauseBetween, flowTeaching, onNextChapter, practice = false }: {
  stepId: 'lesson-4' | 'lesson-15' | 'lesson-16'; orientation: string; pauseBetween: boolean; flowTeaching: boolean; onNextChapter: () => void; practice?: boolean;
}) {
  const [caseName, setCaseName] = useQueryState('algCase', parseAsString.withDefault('').withOptions({ history: 'replace' }));
  const [{ algGroup }, setSelection] = useQueryStates({ algGroup: parseAsString, algCase: parseAsString }, { history: 'replace' });
  const [, setPracticeRoute] = useQueryStates({ view: parseAsString, step: parseAsString, algCase: parseAsString, algGroup: parseAsString });
  const [dialogContainer, setDialogContainer] = useState<HTMLDivElement | null>(null);
  const player = useRef<AlgPlayerHandle>(null);
  const segmentFrame = useRef(0);
  const actualStep = useRef(0);
  const cancelSegment = () => cancelAnimationFrame(segmentFrame.current);
  const [playback, setPlayback] = useState({ key: '', step: 0 });
  const cases = useMemo(() => f2lCatalogCases(), []);
  const diagrams = useMemo(() => f2lCatalogDiagrams(cases, orientation), [cases, orientation]);
  const paths = useMemo(() => f2lTeachingPaths(cases), [cases]);
  const classified = stepId === 'lesson-4';
  const chapter = stepId === 'lesson-16' ? 5 : 4;
  const lessons = classified ? paths : paths.filter(c => c.chapter === chapter);
  const selectedLesson = lessons.find(c => c.name === caseName);
  const lesson = selectedLesson ?? lessons[0];
  const playbackKey = lesson ? lesson.name + ':' + orientation : '';
  useEffect(() => () => cancelAnimationFrame(segmentFrame.current), [playbackKey, practice]);
  const playSection = (start: number, end: number) => {
    cancelSegment();
    const handle = player.current;
    if (!handle?.playMove) return;
    let requested = start;
    handle.playMove(requested);
    const advance = () => {
      if (actualStep.current === requested + 1 && !handle.isUserMovePending?.()) {
        requested += 1;
        if (requested >= end) return;
        handle.playMove?.(requested);
      }
      segmentFrame.current = requestAnimationFrame(advance);
    };
    segmentFrame.current = requestAnimationFrame(advance);
  };
  const { compactFallback, onReferenceFit } = useReferenceFitFallback(.72, `${stepId}:${playbackKey}:${flowTeaching}`);
  const showFlow = flowTeaching && !compactFallback;
  const playbackStep = playback.key === playbackKey ? playback.step : 0;
  const { paneProps, playbackProps } = useTeachingFollow(playbackStep, `${stepId}:${playbackKey}:${showFlow}`);
  const activeSection = lesson ? Math.max(0, lesson.sections.findIndex(section => playbackStep <= section.end)) : 0;
  const lessonGroups = classified ? F2L_CLASSIFICATION_SECTIONS.map(section => section.id) : [...new Set(lessons.map(c => c.group))];
  const groupOf = (item: typeof lessons[number]) => classified
    ? F2L_CLASSIFICATION_SECTIONS.find(section => section.cases.includes(item.name))?.id
    : item.group;
  const activeGroup = (selectedLesson && groupOf(selectedLesson)) ?? lessonGroups.find(group => group === algGroup) ?? lessonGroups[0];
  const activeCategory = classified ? F2L_CLASSIFICATION_SECTIONS.find(section => section.id === activeGroup) : undefined;
  const showGallery = chapter === 4 && !selectedLesson;
  const orderedLessons = chapter === 4 ? lessonGroups.flatMap(group => lessons.filter(item => groupOf(item) === group)) : lessons;
  const visibleLessons = chapter === 4 ? orderedLessons.filter(c => groupOf(c) === activeGroup) : lessons;
  const lessonIndex = orderedLessons.indexOf(lesson);
  const sectionIndex = chapter === 4 ? lessonGroups.indexOf(activeGroup) : lessonIndex;
  const sectionCount = chapter === 4 ? lessonGroups.length : orderedLessons.length;
  const selectSection = (index: number) => {
    if (chapter === 4) {
      void setSelection({ algGroup: lessonGroups[index], algCase: null });
    } else {
      void setCaseName(orderedLessons[index].name);
    }
  };
  const previousSection = sectionIndex > 0 ? () => selectSection(sectionIndex - 1)
    : chapter === 5 ? () => {
      const previousGroups = [...new Set(paths.filter(item => item.chapter === 4).map(item => item.group))];
      void setPracticeRoute({ step: 'lesson-15', algCase: null, algGroup: previousGroups.at(-1) ?? null, view: null });
    } : undefined;
  const nextSection = () => {
    if (sectionIndex < sectionCount - 1) selectSection(sectionIndex + 1);
    else onNextChapter();
  };
  const movePractice = (direction: number) => {
    const next = orderedLessons[lessonIndex + direction];
    if (next) { void setCaseName(next.name); return; }
    if (classified) return;
    const otherChapter = chapter === 4 ? 5 : 4;
    const other = paths.filter(item => item.chapter === otherChapter);
    const groups = [...new Set(other.map(item => item.group))];
    const ordered = otherChapter === 4 ? groups.flatMap(group => other.filter(item => item.group === group)) : other;
    const target = direction > 0 ? ordered[0] : ordered.at(-1);
    if (target) void setPracticeRoute({ step: otherChapter === 4 ? 'lesson-15' : 'lesson-16', algCase: target.name }, { history: 'replace' });
  };
  if (practice && lesson) return <AlgorithmPractice key={`${stepId}:${lesson.name}:${orientation}`} lesson={lesson}
    chapter={classified ? 'classified' : chapter} orientation={orientation}
    onPrevious={lessonIndex > 0 || chapter === 5 ? () => movePractice(-1) : undefined}
    onNext={lessonIndex < orderedLessons.length - 1 || (!classified && chapter === 4) ? () => movePractice(1) : undefined}
    onClose={() => { void setPracticeRoute({ view: null, algCase: lesson.name }, { history: 'push' }); }} />;
  const sectionIcon = (name: string) => <VisualCube local view="iso" size={18} faceletColors={diagrams.find(c => c.name === name)!.facelets} alt="" />;
  const stageButtons = !showGallery && lesson ? lesson.sections.map((section, index) => (
    <button type="button" className="f2l-stage-button" aria-current={playbackStep > 0 && activeSection === index ? 'step' : undefined}
      onClick={() => {
        if (showFlow) { playSection(section.start, section.end); return; }
        const current = player.current?.getPlayer();
        if (current) current.timestamp = section.end;
      }}>
      <span className="f2l-stage-content">
        <span className="f2l-stage-title">{index === lesson.sections.length - 1
          ? <T zh="完成还原" en="Solve the pair" />
          : <><T zh="转化为 " en="Reach " />{lesson.chain[index + 1]}</>}</span>
        <code>{showFlow ? <>
          {Array.from(new Alg(section.alg).expand().childAlgNodes(), move => move.toString()).map((move, moveIndex) => <span key={moveIndex}>
            {moveIndex > 0 ? ' ' : ''}<span className={section.start + moveIndex < playbackStep ? 'f2l-move-complete' : undefined}>{move}</span>
          </span>)}
        </> : Array.from(new Alg(section.alg).expand().childAlgNodes(), move => move.toString()).join(' ')}</code>
      </span>
    </button>
  )) : [];
  const startPractice = () => {
    cancelSegment();
    void setPracticeRoute({ view: 'practice', algCase: lesson.name }, { history: 'push' });
  };
  const teachingContent = lesson ? <>
          <div className="f2l-teaching-alg-summary">
            <div className="f2l-teaching-alg-row">
              <Tooltip content={tr({ zh: '打乱', en: 'Scramble' })}>{tip =>
                <span {...tip} className="f2l-teaching-alg-icon" tabIndex={0} role="img" aria-label={tr({ zh: '打乱', en: 'Scramble' })}><Shuffle size={13} aria-hidden="true" /></span>
              }</Tooltip>
              <code aria-label={tr({ zh: '打乱公式', en: 'Scramble' })}>{lesson.setup}</code>
            </div>
            <div className="f2l-teaching-alg-row">
              <Tooltip content={tr({ zh: '复原', en: 'Solution' })}>{tip =>
                <span {...tip} className="f2l-teaching-alg-icon" tabIndex={0} role="img" aria-label={tr({ zh: '复原', en: 'Solution' })}><Wand2 size={13} aria-hidden="true" /></span>
              }</Tooltip>
              <code aria-label={tr({ zh: '复原公式', en: 'Solution' })}>{lesson.alg}</code>
            </div>
          </div>
          <div className="f2l-algorithm-stage"><div data-tutorial-layout={showFlow ? 'C' : 'B'} className={`f2l-lesson f2l-study-lesson f2l-algorithm-columns${showFlow ? ' f2l-integrated-example' : ''}`}
            onPointerDownCapture={event => { if ((event.target as Element).closest('.alg-sim-player, .f2l-flow-node')) cancelSegment(); }}
            onKeyDownCapture={event => { if ((event.target as Element).closest('.alg-sim-player, .f2l-flow-node')) cancelSegment(); }}>
            <section {...playbackProps} className="f2l-demo">
              <div className="f2l-cube"><AlgPlayer ref={player} key={orientation} puzzle="3x3" set="f2l-tutorial" engine="sim" setup={lesson.setup} alg={lesson.alg}
                orientation={orientation} fillPane moveDurationMs={850}
                onStepChange={step => { actualStep.current = step; setPlayback({ key: playbackKey, step }); }}
                sectionPauseMs={2000} pauseAfterSteps={pauseBetween ? lesson.sections.slice(0, -1).map(section => section.end) : NO_STOPS} /></div>
            </section>
            <div {...paneProps} className="f2l-path-explanation tutorial-follow-pane"><ReadingFit pane onFit={showFlow ? onReferenceFit : undefined}>
            {showFlow ? <TeachingFlowGraph key={playbackKey} lesson={lesson} orientation={orientation}
              step={playbackStep} player={player} stageButtons={stageButtons} /> : <section className="f2l-guidance f2l-teaching-guidance">
              <ol className="f2l-stage-list" aria-label={tr({ zh: '转化阶段', en: 'Transformation stages' })}>
                {stageButtons.map((button, index) => <li key={lesson.sections[index].start}>{button}</li>)}
              </ol>
            </section>}
          {chapter === 4 && !classified && <>
            <button type="button" className="f2l-case-return-text tutorial-inline-action" onClick={() => void setSelection({ algGroup: activeGroup, algCase: null })}>
              <T zh="点击返回选择" en="Click to return to case selection" />
            </button>
          </>}
            </ReadingFit></div>
          </div></div>

  </> : null;
  return <>
    <div ref={setDialogContainer} className="f2l-alg-dialog-host" />
    <TutorialNavigationShell className="f2l-study-layout">

      {!lesson ? <p><T zh="本节教学案例待补充" en="Teaching examples for this chapter are being prepared." /></p> : <>
        {classified && activeCategory ? <ClassifiedSectionNavigation active={activeCategory} orientation={orientation}
          onSelect={id => void setSelection({ algGroup: id, algCase: null })} /> : chapter === 4 ? <SectionNavigation label={tr(f2lGroupName(activeGroup))} items={lessonGroups.map((group) => ({ id: String(group), icon: sectionIcon(lessons.find(c => c.group === group)!.name), label: tr(f2lGroupName(group)), active: activeGroup === group, onSelect: () => void setSelection({ algGroup: group, algCase: null }) }))} /> : <SectionNavigation label={lesson.name} items={visibleLessons.map((c) => ({ id: String(c.name), icon: sectionIcon(c.name), label: c.name, active: lesson.name === c.name, onSelect: () => setCaseName(c.name) }))} />}
        <div className="f2l-study-main">
          {!classified && !showGallery && activeCategory?.recognition && <p>{tr(activeCategory.recognition)}</p>}
          {(classified || showGallery) ? <>
            <ReadingFit><div data-tutorial-layout="E">
            {activeCategory?.recognition && <p>{tr(activeCategory.recognition)}</p>}
            {classified ? <ul className="f2l-alg-card-grid" aria-label={tr({ zh: '选择教学情况', en: 'Choose a teaching case' })}>
              {visibleLessons.map(c => <li key={c.name} data-site-surface="panel">
                <button type="button" className="f2l-alg-card-preview" aria-haspopup="dialog" onClick={() => void setCaseName(c.name)}>
                  <VisualCube local loading="lazy" view="iso" size={104} faceletColors={diagrams.find(item => item.name === c.name)!.facelets} alt="" />
                  <span>{c.name}</span>
                </button>
                <AlgFormulaReadRow selected actions={<button type="button" className="f2l-alg-card-play" aria-haspopup="dialog"
                  aria-label={tr({ zh: '演示', en: 'Play' }) + ' ' + c.name} onClick={() => void setCaseName(c.name)}><Play size="1em" aria-hidden="true" /></button>}>
                  <code>{c.alg}</code>
                </AlgFormulaReadRow>
              </li>)}
            </ul> : <div className="f2l-recognition f2l-teaching-cases" role="group" aria-label={tr({ zh: '选择教学情况', en: 'Choose a teaching case' })}>
              {visibleLessons.map(c => <button type="button" key={c.name} className="f2l-section-button" onClick={() => void setCaseName(c.name)}>
                <VisualCube local loading="lazy" view="iso" size={120} faceletColors={diagrams.find(item => item.name === c.name)!.facelets} alt="" />
                <span>{c.name}</span>
              </button>)}
            </div>}

            </div></ReadingFit>
            <StudyActions onPrevious={previousSection} onContinue={nextSection} />
          </> : <>
          {teachingContent}

          <StudyActions onPrevious={previousSection} onContinue={nextSection}>
            <button type="button" className="f2l-footer-button f2l-footer-next tutorial-practice-button" onClick={startPractice}><T zh="练习" en="Practice" /></button>
          </StudyActions>
          </>}
        </div>
      </>}
    </TutorialNavigationShell>
    {classified && selectedLesson && dialogContainer && <SettingsDialog label={lesson.name} heading surface="dialog"
      panelClassName="f2l-alg-dialog f2l-study-layout" portalContainer={dialogContainer}
      onCloseStart={cancelSegment}
      onClose={() => void setSelection({ algGroup: activeGroup, algCase: null })}>
      <div className="f2l-study-main f2l-alg-dialog-content">{teachingContent}</div>
      <div className="f2l-alg-dialog-actions">
        <button type="button" className="btn-primary" onClick={startPractice}><T zh="练习" en="Practice" /></button>
      </div>
    </SettingsDialog>}
  </>;
}
