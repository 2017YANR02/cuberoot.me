'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { T, tr } from '@/i18n/tr';
import { F2L_PRACTICE_CASES } from '../data/basic-cases';
import { f2lPlaybackSections } from '../lib/cube-preview';
import StudyActions from '../components/StudyActions';

const NO_STOPS: readonly number[] = [];

export default function PracticeLesson({ orientation, pauseBetween, onNextChapter }: {
  orientation: string; pauseBetween: boolean; onNextChapter: () => void;
}) {
  const [practiceIndex, setPracticeIndex] = useState(0);
  useEffect(() => {
    setPracticeIndex(Math.floor(Math.random() * F2L_PRACTICE_CASES.length));
  }, []);
  const practice = F2L_PRACTICE_CASES[practiceIndex];
  const practiceSections = useMemo(() => f2lPlaybackSections(practice.alg), [practice.alg]);
  const playbackKey = practice.id + ':' + orientation;
  const [playback, setPlayback] = useState({ key: '', step: 0 });
  const playbackStep = playback.key === playbackKey ? playback.step : 0;
  const setPlaybackStep = (step: number) => setPlayback({ key: playbackKey, step });
  const practiceActiveSection = Math.max(0, practiceSections.findIndex(section => playbackStep <= section.end));
  const player = useRef<AlgPlayerHandle>(null);
  const seek = (index: number) => {
    const current = player.current?.getPlayer();
    if (current) current.timestamp = index;
  };
  return <div className="f2l-study-layout">
        <aside className="f2l-section-nav">
          <div className="f2l-section-list"><p className="f2l-section-label" aria-current="true"><T zh="练习三步标态" en="Practice the three-move cases" /></p></div>
        </aside>
        <div className="f2l-study-main">
          <div className="f2l-lesson f2l-study-lesson">
            <section className="f2l-demo" aria-label={tr({ zh: '三步标态练习演示', en: 'Three-move case practice demonstration' })}>
              <div className="f2l-cube"><AlgPlayer key={orientation} ref={player} puzzle="3x3" set="f2l-overview" engine="sim"
                setup={practice.setup} alg={practice.alg} orientation={orientation} fillPane moveDurationMs={850}
                onStepChange={setPlaybackStep} sectionPauseMs={2000} pauseAfterSteps={pauseBetween ? practice.boundaries : NO_STOPS} /></div>
              <code className="f2l-alg f2l-player-alg" data-site-surface="panel">{practice.alg}</code>
            </section>
            <section className="f2l-guidance">
              <ol start={0} className="f2l-stage-list">
                <li><button type="button" className="f2l-stage-button" aria-current={playbackStep === 0 ? 'step' : undefined} onClick={() => seek(0)}>
                  <span className="f2l-stage-number">00</span><span className="f2l-stage-content">
                    <span className="f2l-stage-title"><T zh="初始状态" en="Initial state" /></span>
                    <span className="f2l-stage-scramble"><span><T zh="打乱:" en="Scramble:" /></span><code>{practice.setup}</code></span>
                  </span>
                </button></li>
                {practiceSections.map((section, index) => <li key={section.start}>
                  <button type="button" className="f2l-stage-button" aria-current={playbackStep > 0 && practiceActiveSection === index ? 'step' : undefined} onClick={() => seek(section.end)}>
                    <span className="f2l-stage-number">{String(index + 1).padStart(2, '0')}</span><span className="f2l-stage-content">
                      <span className="f2l-stage-title">{index === practiceSections.length - 1 ? <T zh="完成还原" en="Solve the pair" /> : <T zh="顶面调整" en="Top-layer alignment" />}</span>
                      <code>{section.alg}</code>
                    </span>
                  </button>
                </li>)}
              </ol>
            </section>
          </div>
          <StudyActions onContinue={onNextChapter}>
            <button type="button" className="f2l-restart" onClick={() => {
              const candidate = Math.floor(Math.random() * (F2L_PRACTICE_CASES.length - 1));
              setPlaybackStep(0);
              setPracticeIndex(candidate >= practiceIndex ? candidate + 1 : candidate);
            }}><T zh="重新随机" en="Randomize again" /></button>
          </StudyActions>
        </div>
      </div>;
}
