'use client';

import ReadingFit from '../../components/ReadingFit';

import useTeachingFollow from '../../components/useTeachingFollow';
import TutorialNavigationShell from '../../components/TutorialNavigationShell';

import { useMemo, useRef, useState } from 'react';
import { Alg } from 'cubing/alg';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { VisualCube } from '@/components/VisualCube';
import { tr } from '@/i18n/tr';
import { ORDERED_BASIC_CASES, type BasicCaseId } from '../data/basic-cases';
import { f2lPlaybackSections, f2lDiagramFacelets } from '../lib/cube-preview';
import StudyActions from '../components/StudyActions';
import SectionNavigation from '../components/SectionNavigation';

const NO_STOPS: readonly number[] = [];

export default function BasicCaseLesson({ orientation, pauseBetween, caseId, onCaseChange, onNextChapter }: {
  orientation: string; pauseBetween: boolean;
  caseId: BasicCaseId; onCaseChange: (id: BasicCaseId) => void; onNextChapter: () => void;
}) {
  const chapterCases = ORDERED_BASIC_CASES;
  const lesson = chapterCases.find(item => item.id === caseId) ?? chapterCases[0];
  const player = useRef<AlgPlayerHandle>(null);
  const playbackKey = lesson.id + ':' + orientation;
  const [playback, setPlayback] = useState({ key: '', step: 0 });
  const playbackStep = playback.key === playbackKey ? playback.step : 0;
  const { paneProps, playbackProps } = useTeachingFollow(playbackStep, playbackKey);
  const setPlaybackStep = (step: number) => setPlayback({ key: playbackKey, step });
  const sections = useMemo(() => f2lPlaybackSections(lesson.alg), [lesson.alg]);
  const boundaries = useMemo(() => sections.slice(0, -1).map(section => section.end), [sections]);
  const activeSection = Math.max(0, sections.findIndex(section => playbackStep <= section.end));
  const diagrams = useMemo(() => chapterCases.map(item => f2lDiagramFacelets(new Alg(item.alg).invert().expand().toString(), orientation)), [orientation, chapterCases]);
  const seek = (index: number) => {
    const current = player.current?.getPlayer();
    if (current) current.timestamp = index;
  };
  const selectCase = (id: BasicCaseId) => {
    seek(0);
    setPlaybackStep(0);
    onCaseChange(id);
  };
  const nextCase = () => {
    const next = chapterCases[chapterCases.indexOf(lesson) + 1];
    if (next) selectCase(next.id);
    else onNextChapter();
  };
  return <>
        <TutorialNavigationShell className="f2l-study-layout">
          <SectionNavigation label={lesson.name} items={chapterCases.map((item, index) => ({ id: String(item.id), label: item.name, active: lesson.id === item.id, onSelect: () => selectCase(item.id), icon: <VisualCube view="iso" size={36} faceletColors={diagrams[index]} alt=""/> }))} />
          <div className="f2l-study-main">
            <div className="f2l-lesson f2l-study-lesson" data-tutorial-layout="B">
              <section {...playbackProps} className="f2l-demo" aria-label={tr({ zh: '魔方演示', en: 'Cube demonstration' })}>
                <div className="f2l-cube">
                  <AlgPlayer key={orientation} ref={player} puzzle="3x3" set="f2l-tutorial" engine="sim"
                    alg={lesson.alg} orientation={orientation} fillPane moveDurationMs={850}
                    sectionPauseMs={2000} pauseAfterSteps={pauseBetween ? boundaries : NO_STOPS} onStepChange={setPlaybackStep} />
                </div>
                <code className="f2l-alg f2l-player-alg" data-site-surface="panel">{lesson.alg}</code>

              </section>
              <section {...paneProps} className="f2l-guidance tutorial-follow-pane"><ReadingFit pane>

                <ol className="f2l-stage-list">
                  <li><button type="button" className="f2l-stage-button" aria-current={playbackStep === 0 ? 'step' : undefined} onClick={() => seek(0)}>
                    <span className="f2l-stage-content"><span className="f2l-stage-title">{tr(lesson.stageTitles[0])}</span></span>
                  </button></li>
                  {sections.map((section, index) => <li key={section.start}>
                    <button type="button" className="f2l-stage-button" aria-current={playbackStep > 0 && activeSection === index ? 'step' : undefined} onClick={() => seek(section.end)}>
                      <span className="f2l-stage-content"><span className="f2l-stage-title">{tr(lesson.stageTitles[index + 1])}</span><code>{section.alg.replace(/[()]/g, '')}</code></span>
                    </button>
                  </li>)}
                </ol>
              </ReadingFit></section>
            </div>
            <StudyActions onPrevious={chapterCases.indexOf(lesson) > 0
              ? () => selectCase(chapterCases[chapterCases.indexOf(lesson) - 1].id) : undefined} onContinue={nextCase} />
          </div></TutorialNavigationShell></>;
}
