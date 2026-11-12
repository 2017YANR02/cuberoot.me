'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseAsString, useQueryState, useQueryStates } from 'nuqs';
import { ArrowRight } from 'lucide-react';
import { Shuffle, Wand2 } from '@app-foundation/icons/lucide';
import { Alg } from 'cubing/alg';
import { VisualCube } from '@/components/VisualCube';
import { Tooltip } from '@/components/Tooltip';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { tr, T } from '@/i18n/tr';
import { f2lCatalogCases, f2lCatalogDiagrams, f2lGroupName, f2lTeachingPaths } from '../lib/curriculum';
import StudyActions from '../components/StudyActions';
import SectionNavigation from '../components/SectionNavigation';
import AlgorithmPractice from './AlgorithmPractice';
import TeachingFlowGraph from '../components/TeachingFlowGraph';

const NO_STOPS: readonly number[] = [];

export default function AlgorithmLessons({ stepId, orientation, pauseBetween, flowTeaching, onNextChapter, practice = false }: {
  stepId: 'lesson-4' | 'lesson-5'; orientation: string; pauseBetween: boolean; flowTeaching: boolean; onNextChapter: () => void; practice?: boolean;
}) {
  const [caseName, setCaseName] = useQueryState('algCase', parseAsString.withDefault('').withOptions({ history: 'replace' }));
  const [{ algGroup }, setSelection] = useQueryStates({ algGroup: parseAsString, algCase: parseAsString }, { history: 'replace' });
  const [, setPracticeRoute] = useQueryStates({ view: parseAsString, step: parseAsString, algCase: parseAsString, algGroup: parseAsString });
  const player = useRef<AlgPlayerHandle>(null);
  const segmentFrame = useRef(0);
  const actualStep = useRef(0);
  const cancelSegment = () => cancelAnimationFrame(segmentFrame.current);
  const [playback, setPlayback] = useState({ key: '', step: 0 });
  const cases = useMemo(() => f2lCatalogCases(), []);
  const diagrams = useMemo(() => f2lCatalogDiagrams(cases, orientation), [cases, orientation]);
  const paths = useMemo(() => f2lTeachingPaths(cases), [cases]);
  const chapter = stepId === 'lesson-4' ? 4 : 5;
  const lessons = paths.filter(c => c.chapter === chapter);
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
  const playbackStep = playback.key === playbackKey ? playback.step : 0;
  const activeSection = lesson ? Math.max(0, lesson.sections.findIndex(section => playbackStep <= section.end)) : 0;
  const lessonGroups = [...new Set(lessons.map(c => c.group))];
  const activeGroup = selectedLesson?.group ?? (lessonGroups.includes(algGroup ?? '') ? algGroup! : lessonGroups[0]);
  const showGallery = chapter === 4 && !selectedLesson;
  const orderedLessons = chapter === 4 ? lessonGroups.flatMap(group => lessons.filter(item => item.group === group)) : lessons;
  const visibleLessons = chapter === 4 ? lessons.filter(c => c.group === activeGroup) : lessons;
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
      void setPracticeRoute({ step: 'lesson-4', algCase: null, algGroup: previousGroups.at(-1) ?? null, view: null });
    } : undefined;
  const nextSection = () => {
    if (sectionIndex < sectionCount - 1) selectSection(sectionIndex + 1);
    else onNextChapter();
  };
  const movePractice = (direction: number) => {
    const next = orderedLessons[lessonIndex + direction];
    if (next) { void setCaseName(next.name); return; }
    const otherChapter = chapter === 4 ? 5 : 4;
    const other = paths.filter(item => item.chapter === otherChapter);
    const groups = [...new Set(other.map(item => item.group))];
    const ordered = otherChapter === 4 ? groups.flatMap(group => other.filter(item => item.group === group)) : other;
    const target = direction > 0 ? ordered[0] : ordered.at(-1);
    if (target) void setPracticeRoute({ step: `lesson-${otherChapter}`, algCase: target.name }, { history: 'replace' });
  };
  if (practice && lesson) return <AlgorithmPractice key={`${stepId}:${lesson.name}:${orientation}`} lesson={lesson}
    chapter={chapter} orientation={orientation}
    onPrevious={lessonIndex > 0 || chapter === 5 ? () => movePractice(-1) : undefined}
    onNext={lessonIndex < orderedLessons.length - 1 || chapter === 4 ? () => movePractice(1) : undefined}
    onClose={() => { void setPracticeRoute({ view: null, algCase: lesson.name }, { history: 'push' }); }} />;
  const pickerLabel = (name: string, label: string) => <span className="f2l-section-label">
    <VisualCube view="iso" size={36} faceletColors={diagrams.find(c => c.name === name)!.facelets} alt="" />
    <span>{label}</span>
  </span>;
  return <>
    <div className="f2l-study-layout">

      {!lesson ? <p><T zh="本节教学案例待补充。" en="Teaching examples for this chapter are being prepared." /></p> : <>
        {chapter === 4 ? <SectionNavigation label={tr(f2lGroupName(activeGroup))}>
          <div className="f2l-section-group">
            <div className="f2l-section-list" role="group" aria-label={tr({ zh: '选择情况分组', en: 'Choose a case group' })}>
              {lessonGroups.map(group => <button className="f2l-section-button" key={group} type="button" aria-pressed={activeGroup === group}
                onClick={() => void setSelection({ algGroup: group, algCase: null })}>
                {pickerLabel(lessons.find(c => c.group === group)!.name, tr(f2lGroupName(group)))}
              </button>)}
            </div>
          </div>
        </SectionNavigation> : <SectionNavigation label={lesson.name}><div className="f2l-section-list" role="group" aria-label={tr({ zh: '选择教学情况', en: 'Choose a teaching case' })}>
          {visibleLessons.map(c => <button className="f2l-section-button" key={c.name} type="button" aria-pressed={lesson.name === c.name} onClick={() => setCaseName(c.name)}>
            {pickerLabel(c.name, c.name)}
          </button>)}
        </div></SectionNavigation>}
        <div className="f2l-study-main">
          {showGallery ? <>
            <div className="f2l-recognition f2l-teaching-cases" role="group" aria-label={tr({ zh: '选择教学情况', en: 'Choose a teaching case' })}>
              {visibleLessons.map(c => <button type="button" key={c.name} className="f2l-section-button" onClick={() => void setCaseName(c.name)}>
                <VisualCube local loading="lazy" view="iso" size={120} faceletColors={diagrams.find(item => item.name === c.name)!.facelets} alt="" />
                <span>{c.name}</span>
              </button>)}
            </div>
            <StudyActions onPrevious={previousSection} onContinue={nextSection} />
          </> : <>
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
          <div className={`f2l-lesson f2l-study-lesson f2l-algorithm-columns${flowTeaching ? ' f2l-integrated-example' : ''}`}
            onPointerDownCapture={event => { if ((event.target as Element).closest('.alg-sim-player, .f2l-flow-node')) cancelSegment(); }}
            onKeyDownCapture={event => { if ((event.target as Element).closest('.alg-sim-player, .f2l-flow-node')) cancelSegment(); }}>
            <section className="f2l-demo">
              <div className="f2l-cube"><AlgPlayer ref={player} key={orientation} puzzle="3x3" set="f2l-tutorial" engine="sim" setup={lesson.setup} alg={lesson.alg}
                orientation={orientation} fillPane moveDurationMs={850}
                onStepChange={step => { actualStep.current = step; setPlayback({ key: playbackKey, step }); }}
                sectionPauseMs={2000} pauseAfterSteps={pauseBetween ? lesson.sections.slice(0, -1).map(section => section.end) : NO_STOPS} /></div>
            </section>
            <div className="f2l-path-explanation">
            <section className="f2l-guidance f2l-teaching-guidance">

              <ol className="f2l-stage-list" aria-label={tr({ zh: '转化阶段', en: 'Transformation stages' })}>
                {lesson.sections.map((section, index) => <li key={section.start} style={flowTeaching ? {
                  top: `${(index * 180 + 151) / (lesson.sections.length * 180 + 134) * 100}%`, left: index % 2 === 0 ? '61%' : '5%',
                } : undefined}>
                  <button type="button" className="f2l-stage-button" aria-current={playbackStep > 0 && activeSection === index ? 'step' : undefined}
                    onClick={() => {
                      if (flowTeaching) { playSection(section.start, section.end); return; }
                      const current = player.current?.getPlayer();
                      if (current) current.timestamp = section.end;
                    }}>
                    <span className="f2l-stage-content">
                      <span className="f2l-stage-title">{index === lesson.sections.length - 1
                        ? <T zh="完成还原" en="Solve the pair" />
                        : <><T zh="转化为 " en="Reach " />{lesson.chain[index + 1]}</>}</span>
                      <code>{flowTeaching ? <>
                        {Array.from(new Alg(section.alg).expand().childAlgNodes(), move => move.toString()).map((move, moveIndex) => <span key={moveIndex}>
                          {moveIndex > 0 ? ' ' : ''}<span className={section.start + moveIndex < playbackStep ? 'f2l-move-complete' : undefined}>{move}</span>
                        </span>)}
                      </> : Array.from(new Alg(section.alg).expand().childAlgNodes(), move => move.toString()).join(' ')}</code>
                    </span>
                  </button>
                </li>)}</ol>
            </section>
            {flowTeaching && <TeachingFlowGraph key={playbackKey} lesson={lesson} orientation={orientation} step={playbackStep} player={player} />}
            </div>
          </div>
          {chapter === 4 && <div className="f2l-alg-return-row">
            <button type="button" className="f2l-case-return-text" onClick={() => void setSelection({ algGroup: lesson.group, algCase: null })}>
              <T zh="点击返回选择" en="Click to return to case selection" />
            </button>
          </div>}
          <StudyActions onPrevious={previousSection} onContinue={nextSection}>
            <button type="button" className="f2l-footer-button f2l-footer-next" onClick={() => {
              void setPracticeRoute({ view: 'practice', algCase: lesson.name }, { history: 'push' });
            }}><T zh="练习本节" en="Practice this lesson" /><ArrowRight size={17} aria-hidden="true" /></button>
          </StudyActions>
          </>}
        </div>
      </>}
    </div></>;
}
