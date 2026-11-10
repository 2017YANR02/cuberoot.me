'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseAsString, useQueryState, useQueryStates } from 'nuqs';
import { ArrowRight } from 'lucide-react';
import { VisualCube } from '@/components/VisualCube';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { CompactSelect } from '@/components/CompactSelect';
import { tr, T } from '@/i18n/tr';
import { f2lCatalogCases, f2lCatalogDiagrams, f2lGroupName, f2lTeachingPaths } from '../lib/curriculum';
import StudyActions from '../components/StudyActions';
import AlgorithmPractice from './AlgorithmPractice';

const NO_STOPS: readonly number[] = [];

export default function AlgorithmLessons({ stepId, orientation, pauseBetween, onNextChapter, practice = false }: {
  stepId: 'lesson-6' | 'lesson-7'; orientation: string; pauseBetween: boolean; onNextChapter: () => void; practice?: boolean;
}) {
  const [caseName, setCaseName] = useQueryState('algCase', parseAsString.withDefault('').withOptions({ history: 'replace' }));
  const [, setPracticeRoute] = useQueryStates({ view: parseAsString, step: parseAsString, algCase: parseAsString });
  const player = useRef<AlgPlayerHandle>(null);
  const casePicker = useRef<HTMLDivElement>(null);
  const caseAttention = useRef<Animation | null>(null);
  useEffect(() => () => caseAttention.current?.cancel(), []);
  const [playback, setPlayback] = useState({ key: '', step: 0 });
  const cases = useMemo(() => f2lCatalogCases(), []);
  const diagrams = useMemo(() => f2lCatalogDiagrams(cases, orientation), [cases, orientation]);
  const paths = useMemo(() => f2lTeachingPaths(cases), [cases]);
  const chapter = stepId === 'lesson-6' ? 6 : 7;
  const lessons = paths.filter(c => c.chapter === chapter);
  const lesson = lessons.find(c => c.name === caseName) ?? lessons[0];
  const playbackKey = lesson ? lesson.name + ':' + orientation : '';
  const playbackStep = playback.key === playbackKey ? playback.step : 0;
  const activeSection = lesson ? Math.max(0, lesson.sections.findIndex(section => playbackStep <= section.end)) : 0;
  const lessonGroups = [...new Set(lessons.map(c => c.group))];
  const orderedLessons = chapter === 6 ? lessonGroups.flatMap(group => lessons.filter(item => item.group === group)) : lessons;
  const visibleLessons = chapter === 6 ? lessons.filter(c => c.group === lesson?.group) : lessons;
  const lessonIndex = orderedLessons.indexOf(lesson);
  const movePractice = (direction: number) => {
    const next = orderedLessons[lessonIndex + direction];
    if (next) { void setCaseName(next.name); return; }
    const otherChapter = chapter === 6 ? 7 : 6;
    const other = paths.filter(item => item.chapter === otherChapter);
    const groups = [...new Set(other.map(item => item.group))];
    const ordered = otherChapter === 6 ? groups.flatMap(group => other.filter(item => item.group === group)) : other;
    const target = direction > 0 ? ordered[0] : ordered.at(-1);
    if (target) void setPracticeRoute({ step: `lesson-${otherChapter}`, algCase: target.name }, { history: 'replace' });
  };
  if (practice && lesson) return <AlgorithmPractice key={`${stepId}:${lesson.name}:${orientation}`} lesson={lesson}
    chapter={chapter} orientation={orientation} index={lessonIndex} total={orderedLessons.length}
    onPrevious={lessonIndex > 0 || chapter === 7 ? () => movePractice(-1) : undefined}
    onNext={lessonIndex < orderedLessons.length - 1 || chapter === 6 ? () => movePractice(1) : undefined}
    onClose={() => { void setPracticeRoute({ view: null, algCase: lesson.name }, { history: 'push' }); }} />;
  const pickerLabel = (name: string, label: string) => <span className="f2l-section-label">
    <VisualCube view="iso" size={36} faceletColors={diagrams.find(c => c.name === name)!.facelets} alt="" />
    <span>{label}</span>
  </span>;
  return <>
    <div className="f2l-study-layout">

      {!lesson ? <p><T zh="本节教学案例待补充。" en="Teaching examples for this chapter are being prepared." /></p> : <>
        {chapter === 6 ? <div className="f2l-section-nav">
          <div className="f2l-section-group">
            <span><T zh="类型" en="Type" /></span>
            <div className="f2l-section-list" role="group" aria-label={tr({ zh: '选择情况分组', en: 'Choose a case group' })}>
              {lessonGroups.map(group => <button className="f2l-section-button" key={group} type="button" aria-pressed={lesson.group === group}
                onClick={() => setCaseName(lessons.find(c => c.group === group)!.name)}>
                {pickerLabel(lessons.find(c => c.group === group)!.name, tr(f2lGroupName(group)))}
              </button>)}
            </div>
          </div>
          <div className="f2l-section-group" ref={casePicker}>
            <span><T zh="情况" en="Case" /></span>
            <CompactSelect className="f2l-case-select" ariaLabel={tr({ zh: '选择教学情况', en: 'Choose a teaching case' })}
              value={lesson.name} valueText={lesson.name} label={pickerLabel(lesson.name, lesson.name)}
              items={visibleLessons.map(c => ({ value: c.name, label: pickerLabel(c.name, c.name) }))}
              onChange={setCaseName} />
          </div>
        </div> : <div className="f2l-section-nav"><div className="f2l-section-list" role="group" aria-label={tr({ zh: '选择教学情况', en: 'Choose a teaching case' })}>
          {visibleLessons.map(c => <button className="f2l-section-button" key={c.name} type="button" aria-pressed={lesson.name === c.name} onClick={() => setCaseName(c.name)}>
            {pickerLabel(c.name, c.name)}
          </button>)}
        </div></div>}
        <div className="f2l-study-main">
          <div className="f2l-lesson f2l-study-lesson">
            <section className="f2l-demo">

              <div className="f2l-cube"><AlgPlayer ref={player} key={orientation} puzzle="3x3" set="f2l-tutorial" engine="sim" setup={lesson.setup} alg={lesson.alg}
                orientation={orientation} fillPane moveDurationMs={850}
                onStepChange={step => setPlayback({ key: playbackKey, step })}
                sectionPauseMs={2000} pauseAfterSteps={pauseBetween ? lesson.sections.slice(0, -1).map(section => section.end) : NO_STOPS} /></div>
              <code className="f2l-alg f2l-player-alg" data-site-surface="panel">{lesson.alg}</code>
            </section>
            <section className="f2l-guidance f2l-teaching-guidance">

              <ol className="f2l-stage-list" aria-label={tr({ zh: '转化阶段', en: 'Transformation stages' })}>
                <li>
                  <button type="button" className="f2l-stage-button" aria-current={playbackStep === 0 ? 'step' : undefined}
                    onClick={() => {
                      const current = player.current?.getPlayer();
                      if (current) current.timestamp = 0;
                    }}>
                    <span className="f2l-stage-content">
                      <span className="f2l-stage-title"><T zh="初始状态" en="Initial state" /> · {lesson.name}</span>
                      <span className="f2l-stage-scramble"><span><T zh="打乱:" en="Scramble:" /></span><code>{lesson.setup}</code></span>
                    </span>
                  </button>
                </li>
                {lesson.sections.map((section, index) => <li key={section.start}>
                  <button type="button" className="f2l-stage-button" aria-current={playbackStep > 0 && activeSection === index ? 'step' : undefined}
                    onClick={() => {
                      const current = player.current?.getPlayer();
                      if (current) current.timestamp = section.end;
                    }}>
                    <span className="f2l-stage-content">
                      <span className="f2l-stage-title">{index === lesson.sections.length - 1
                        ? <T zh="完成还原" en="Solve the pair" />
                        : <><T zh="转化为 " en="Reach " />{lesson.chain[index + 1]}</>}</span>
                      <code>{section.alg}</code>
                    </span>
                  </button>
                </li>)}</ol>
            </section>
          </div>
          <StudyActions onPrevious={orderedLessons.indexOf(lesson) > 0
            ? () => setCaseName(orderedLessons[orderedLessons.indexOf(lesson) - 1].name) : undefined} onContinue={() => {
            const next = orderedLessons[orderedLessons.indexOf(lesson) + 1];
            if (next) {
              setCaseName(next.name);
              if (chapter === 6 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                caseAttention.current?.cancel();
                caseAttention.current = casePicker.current?.querySelector('button')?.animate({
                  outline: ['2px solid transparent', '2px solid var(--accent)', '2px solid transparent'],
                  outlineOffset: ['3px', '3px', '3px'],
                }, { duration: 800, easing: 'ease-in-out' }) ?? null;
              }
            }
            else onNextChapter();
          }}>
            <button type="button" className="f2l-footer-button f2l-footer-next" onClick={() => {
              void setPracticeRoute({ view: 'practice', algCase: lesson.name }, { history: 'push' });
            }}><T zh="练习本节" en="Practice this lesson" /><ArrowRight size={17} aria-hidden="true" /></button>
          </StudyActions>
        </div>
      </>}
    </div></>;
}
