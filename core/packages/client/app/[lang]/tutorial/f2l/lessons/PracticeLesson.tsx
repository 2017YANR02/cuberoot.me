'use client';

import ReadingFit from '../../components/ReadingFit';

import useTeachingFollow from '../../components/useTeachingFollow';
import TutorialNavigationShell from '../../components/TutorialNavigationShell';

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { VisualCube } from '@/components/VisualCube';
import { Alg } from 'cubing/alg';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { T, tr } from '@/i18n/tr';
import { F2L_PRACTICE_CASES, F2L_TOP_ADJUSTMENTS, ORDERED_BASIC_CASES, type BasicCaseId } from '../data/basic-cases';
import { f2lDiagramFacelets, f2lPlaybackSections } from '../lib/cube-preview';
import StudyActions from '../components/StudyActions';
import SectionNavigation from '../components/SectionNavigation';

const NO_STOPS: readonly number[] = [];

export default function PracticeLesson({ orientation, pauseBetween, onNextChapter, caseId, onCaseChange }: {
  orientation: string; pauseBetween: boolean; onNextChapter: () => void;
  caseId: BasicCaseId; onCaseChange: (id: BasicCaseId) => void;
}) {
  const [alignment, setAlignment] = useQueryState('auf', parseAsStringEnum([...F2L_TOP_ADJUSTMENTS]).withOptions({ history: 'replace' }));
  const lesson = ORDERED_BASIC_CASES.find(item => item.id === caseId) ?? ORDERED_BASIC_CASES[0];
  const previousCase = useRef<BasicCaseId | null>(null);
  useEffect(() => {
    const changedCase = previousCase.current !== null && previousCase.current !== lesson.id;
    previousCase.current = lesson.id;
    // Keep an explicit URL state on refresh; draw a new adjustment when selecting another case.
    if (!alignment || changedCase) void setAlignment(F2L_TOP_ADJUSTMENTS[Math.floor(Math.random() * F2L_TOP_ADJUSTMENTS.length)]);
  }, [lesson.id, alignment, setAlignment]);
  const practice = F2L_PRACTICE_CASES.find(item => item.id === `${lesson.id}:${alignment ?? F2L_TOP_ADJUSTMENTS[0]}`)!;
  const diagrams = useMemo(() => ORDERED_BASIC_CASES.map(item => f2lDiagramFacelets(new Alg(item.alg).invert().toString(), orientation)), [orientation]);
  const practiceSections = useMemo(() => f2lPlaybackSections(practice.alg), [practice.alg]);
  const playbackKey = practice.id + ':' + orientation;
  const [playback, setPlayback] = useState({ key: '', step: 0 });
  const playbackStep = playback.key === playbackKey ? playback.step : 0;
  const { paneProps, playbackProps } = useTeachingFollow(playbackStep, playbackKey);
  const setPlaybackStep = (step: number) => setPlayback({ key: playbackKey, step });
  const practiceActiveSection = Math.max(0, practiceSections.findIndex(section => playbackStep <= section.end));
  const player = useRef<AlgPlayerHandle>(null);
  const seek = (index: number) => {
    const current = player.current?.getPlayer();
    if (current) current.timestamp = index;
  };
  return <TutorialNavigationShell className="f2l-study-layout">
        <SectionNavigation label={lesson.name} items={ORDERED_BASIC_CASES.map((item, index) => ({ id: String(item.id), label: item.name, active: lesson.id === item.id, onSelect: () => onCaseChange(item.id), icon: <VisualCube view="iso" size={36} faceletColors={diagrams[index]} alt=""/> }))} />
        <div className="f2l-study-main">
          <div className="f2l-lesson f2l-study-lesson" data-tutorial-layout="B">
            <section {...playbackProps} className="f2l-demo" aria-label={tr({ zh: '三步基态练习演示', en: 'Three-move case practice demonstration' })}>
              <div className="f2l-cube"><AlgPlayer key={orientation} ref={player} puzzle="3x3" set="f2l-overview" engine="sim"
                setup={practice.setup} alg={practice.alg} orientation={orientation} fillPane moveDurationMs={850}
                onStepChange={setPlaybackStep} sectionPauseMs={2000} pauseAfterSteps={pauseBetween ? practice.boundaries : NO_STOPS} /></div>
              <code className="f2l-alg f2l-player-alg" data-site-surface="panel">{practice.alg}</code>
            </section>
            <section {...paneProps} className="f2l-guidance tutorial-follow-pane"><ReadingFit pane>
              <ol className="f2l-stage-list">
                <li><button type="button" className="f2l-stage-button" aria-current={playbackStep === 0 ? 'step' : undefined} onClick={() => seek(0)}>
                  <span className="f2l-stage-content">
                    <span className="f2l-stage-title"><T zh="初始状态" en="Initial state" /> · {lesson.name}</span>
                    <span className="f2l-stage-scramble"><span><T zh="打乱:" en="Scramble:" /></span><code>{practice.setup}</code></span>
                  </span>
                </button></li>
                {practiceSections.map((section, index) => <li key={section.start}>
                  <button type="button" className="f2l-stage-button" aria-current={playbackStep > 0 && practiceActiveSection === index ? 'step' : undefined} onClick={() => seek(section.end)}>
                    <span className="f2l-stage-content">
                      <span className="f2l-stage-title">{index === practiceSections.length - 1 ? <T zh="完成还原" en="Solve the pair" /> : <T zh="顶面调整" en="Top-layer alignment" />}</span>
                      <code>{section.alg}</code>
                    </span>
                  </button>
                </li>)}
              </ol>
            </ReadingFit></section>
          </div>
          <StudyActions onPrevious={ORDERED_BASIC_CASES.indexOf(lesson) > 0
            ? () => onCaseChange(ORDERED_BASIC_CASES[ORDERED_BASIC_CASES.indexOf(lesson) - 1].id) : undefined}
            onContinue={() => {
              const next = ORDERED_BASIC_CASES[ORDERED_BASIC_CASES.indexOf(lesson) + 1];
              if (next) onCaseChange(next.id);
              else onNextChapter();
            }} />
        </div>
      </TutorialNavigationShell>;
}
