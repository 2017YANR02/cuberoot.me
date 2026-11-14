'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alg } from 'cubing/alg';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import ProgressSlider from '@/components/ProgressSlider';
import VideoControls from '../components/VideoControls';
import VideoStage from '../components/VideoStage';
import { VisualCube } from '@/components/VisualCube';
import { tr, T } from '@/i18n/tr';
import { ORDERED_BASIC_CASES } from '../data/basic-cases';
import { F2L_INTRO_ALG, LBL_INTRO_ALG, lblIntroStickering, f2lDiagramFacelets, f2lIntroStickering } from '../lib/cube-preview';
// import { f2lGoalDiagrams } from '../lib/cube-preview';
import StudyActions from '../components/StudyActions';
import SectionNavigation from '../components/SectionNavigation';
import FirstTwoLayersIntro from './FirstTwoLayersIntro';
import NonstandardIntro from './NonstandardIntro';
import { INTRO_COMPARE_AT, INTRO_CROSS_MS, INTRO_SPLIT_MS, INTRO_VIDEO_DURATION, introEase } from '../lib/intro-timeline';

function IntroComparison({ orientation, onContinue }: { orientation: string; onContinue: () => void }) {
  const [playRequest, setPlayRequest] = useState(0);
  return <div className="f2l-intro-comparison">
    <div className="f2l-intro-players">
      <section className="f2l-demo" aria-label={tr({ zh: '层先法逐块复原演示', en: 'LBL piece-by-piece demonstration' })}>
        <div className="f2l-cube"><AlgPlayer puzzle="3x3" set="f2l-overview" engine="sim" alg={LBL_INTRO_ALG}
          orientation={orientation} fillPane moveDurationMs={650} stickeringAtStep={lblIntroStickering}
          autoPlay playRequest={playRequest} /></div>
        <h3>LBL</h3>
      </section>
      <section className="f2l-demo" aria-label={tr({ zh: 'F2L 成对复原演示', en: 'F2L pair-by-pair demonstration' })}>
        <div className="f2l-cube"><AlgPlayer puzzle="3x3" set="f2l-overview" engine="sim" alg={F2L_INTRO_ALG}
          orientation={orientation} fillPane moveDurationMs={650} stickeringAtStep={f2lIntroStickering}
          autoPlay playRequest={playRequest} /></div>
        <h3>F2L</h3>
      </section>
    </div>
    <StudyActions onContinue={onContinue}>
      <button type="button" className="f2l-restart" onClick={() => setPlayRequest(current => current + 1)}><T zh="重新播放" en="Replay" /></button>
    </StudyActions>
  </div>;
}


export default function IntroLessons({ stepId, orientation, onNextChapter }: {
  stepId: 'lesson-1' | 'lesson-2' | 'lesson-14'; orientation: string; onNextChapter: () => void;
}) {
  const [section, setSection] = useState<'comparison' | 'lbl' | 'f2l'>('lbl');
  const [showTerminology, setShowTerminology] = useState(false);
  const clock = useRef(0);
  const scene = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(0);
  const [seekVersion, setSeekVersion] = useState(0);
  const [comparisonPlaying, setComparisonPlaying] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const scrubbingActive = useRef(false);
  const [leftReady, setLeftReady] = useState(false);
  const [rightReady, setRightReady] = useState(false);
  const comparisonReady = leftReady && rightReady;
  const comparisonComplete = time >= INTRO_VIDEO_DURATION;
  const playing = comparisonPlaying && !comparisonComplete && !scrubbing;
  const comparisonStage = time < INTRO_CROSS_MS ? 'cross' : time < INTRO_COMPARE_AT ? 'split' : 'compare';
  const prepareLeft = useCallback(() => setLeftReady(true), []);
  const prepareRight = useCallback(() => setRightReady(true), []);
  const beginScrub = () => { scrubbingActive.current = true; setScrubbing(true); };
  const endScrub = useCallback(() => {
    if (!scrubbingActive.current) return;
    scrubbingActive.current = false; setScrubbing(false); setComparisonPlaying(true);
  }, []);
  const updateSplit = useCallback((value: number) => {
    const progress = Math.max(0, Math.min(1, (value - INTRO_CROSS_MS) / INTRO_SPLIT_MS));
    const split = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? Number(progress > 0) : introEase(progress);
    const style = scene.current?.style;
    if (!style) return;
    const joined = String(1 - split), opacity = String(Math.min(progress * 4, 1));
    if (style.getPropertyValue('--f2l-intro-joined') !== joined) style.setProperty('--f2l-intro-joined', joined);
    if (style.getPropertyValue('--f2l-intro-clone-opacity') !== opacity) style.setProperty('--f2l-intro-clone-opacity', opacity);
  }, []);
  const seek = useCallback((value: number) => {
    clock.current = Math.max(0, Math.min(INTRO_VIDEO_DURATION, value));
    setTime(clock.current); updateSplit(clock.current);
    setSeekVersion(version => version + 1);
  }, [updateSplit]);
  useEffect(() => {
    if (comparisonReady) setComparisonPlaying(!document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, [comparisonReady]);
  useEffect(() => {
    const pauseHidden = () => { if (document.hidden) setComparisonPlaying(false); };
    document.addEventListener('visibilitychange', pauseHidden);
    return () => document.removeEventListener('visibilitychange', pauseHidden);
  }, []);
  useEffect(() => {
    if (!comparisonReady || !playing) return;
    let raf = 0, last = performance.now(), rendered = last;
    const tick = (now: number) => {
      if (document.hidden) return;
      clock.current = Math.min(INTRO_VIDEO_DURATION, clock.current + Math.min(50, now - last)); last = now;
      updateSplit(clock.current);
      if (now - rendered >= 40 || clock.current === INTRO_VIDEO_DURATION) { setTime(clock.current); rendered = now; }
      if (clock.current === INTRO_VIDEO_DURATION) return;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [comparisonReady, playing, updateSplit]);
  const chapterCases = ORDERED_BASIC_CASES;
  const diagrams = useMemo(() => chapterCases.map(item => f2lDiagramFacelets(new Alg(item.alg).invert().expand().toString(), orientation)), [orientation, chapterCases]);
  // const goalDiagrams = useMemo(() => f2lGoalDiagrams(orientation), [orientation]);
  if (stepId === 'lesson-1') {
    const label = tr({ zh: 'F2L与层先法的区别', en: 'F2L vs. layer-by-layer' });
    const terminology = tr({ zh: '术语介绍', en: 'Terminology' });
    const openTerminology = () => {
      setComparisonPlaying(false);
      setLeftReady(false);
      setRightReady(false);
      seek(0);
      setShowTerminology(true);
    };
    return <div className="f2l-study-layout">
      <SectionNavigation label={showTerminology ? terminology : label}>
        <div className="f2l-section-list">
          <button type="button" className="f2l-section-button" aria-pressed={!showTerminology} onClick={() => setShowTerminology(false)}>{label}</button>
          <button type="button" className="f2l-section-button" aria-pressed={showTerminology} onClick={openTerminology}>{terminology}</button>
        </div>
      </SectionNavigation>
      <div className="f2l-study-main">
        {showTerminology ? <NonstandardIntro orientation={orientation} terminologyOnly /> :
        <div className="f2l-intro-film f2l-concept-video">
        <VideoStage>
        <div ref={scene} className="f2l-intro-methods" data-stage={comparisonStage} data-playing={playing}>
          <div className="f2l-intro-method">
            <FirstTwoLayersIntro key={orientation} orientation={orientation} method="lbl"
              comparisonStage={comparisonStage} comparisonClock={clock} seekVersion={seekVersion}
              controlledPlaying={playing} onReady={prepareLeft} />
          </div>
          <div className="f2l-intro-method" inert={comparisonStage !== 'compare'} aria-hidden={comparisonStage !== 'compare'}>
            <FirstTwoLayersIntro key={orientation} orientation={orientation} method="f2l"
              comparisonStage={comparisonStage} comparisonClock={clock} seekVersion={seekVersion}
              controlledPlaying={playing} onReady={prepareRight} />
          </div>
        </div>
        </VideoStage>
        <div className="f2l-intro-progress">
          <ProgressSlider value={time} max={INTRO_VIDEO_DURATION} disabled={!comparisonReady} onChange={seek}
            keyboardStep={500} onInteractionStart={beginScrub} onInteractionEnd={endScrub}
            formatValue={value => tr({ zh: `${(value / 1000).toFixed(1)} 秒`, en: `${(value / 1000).toFixed(1)} seconds` })}
            ariaLabel={tr({ zh: '演示进度', en: 'Animation progress' })} />
          <VideoControls playing={playing} disabled={!comparisonReady}
            onTogglePlay={() => {
              if (comparisonComplete) { seek(0); setComparisonPlaying(true); }
              else setComparisonPlaying(value => !value);
            }}
            onReplay={() => { seek(0); setComparisonPlaying(true); }} />
        </div>
        </div>}
        <StudyActions onPrevious={showTerminology ? () => setShowTerminology(false) : undefined}
          onContinue={showTerminology ? onNextChapter : openTerminology} />
      </div>
    </div>;
  }

  return <>{stepId === 'lesson-14' && <div className="f2l-study-layout">
        <SectionNavigation label={tr(section === 'comparison' ? { zh: 'F2L与层先法的区别', en: 'F2L vs. layer-by-layer' } : section === 'lbl' ? { zh: '层先法的前两层', en: 'The first two layers with LBL' } : { zh: 'F2L', en: 'F2L' })}>
          <div className="f2l-section-list">
            <button type="button" className="f2l-section-button" aria-pressed={section === 'comparison'} onClick={() => setSection('comparison')}><T zh="F2L与层先法的区别" en="F2L vs. layer-by-layer" /></button>
            <button type="button" className="f2l-section-button" aria-pressed={section === 'lbl'} onClick={() => setSection('lbl')}><T zh="层先法的前两层" en="The first two layers with LBL" /></button>
            <button type="button" className="f2l-section-button" aria-pressed={section === 'f2l'} onClick={() => setSection('f2l')}>F2L</button>
          </div>
        </SectionNavigation>
        <div className="f2l-study-main">
        {/* {goalDiagrams && <figure className="f2l-goal">
          <div className="f2l-goal-diagrams">
            <div className="f2l-goal-cube">
              <VisualCube view="iso" size={190} faceletColors={goalDiagrams[0]} alt={tr({ zh: 'A：底十字已完成', en: 'A: solved bottom cross' })} />
              <span><T zh="A · 底十字完成" en="A · Cross solved" /></span>
            </div>
            <div className="f2l-goal-lbl-arrow">
              <span>LBL</span>
              <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M 3 23 Q 24 2 45 23 M 36 21 L 45 23 L 43 14" /></svg>
            </div>
            <div className="f2l-goal-cube">
              <VisualCube view="iso" size={190} faceletColors={goalDiagrams[1]} alt={tr({ zh: 'B：底层已完成', en: 'B: solved first layer' })} />
              <span><T zh="B · 完成底层" en="B · First layer solved" /></span>
            </div>
            <div className="f2l-goal-lbl-arrow">
              <span>LBL</span>
              <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M 3 23 Q 24 2 45 23 M 36 21 L 45 23 L 43 14" /></svg>
            </div>
            <div className="f2l-goal-cube">
              <VisualCube view="iso" size={190} faceletColors={goalDiagrams[2]} alt={tr({ zh: 'C：前两层已完成', en: 'C: solved first two layers' })} />
              <span><T zh="C · 前两层完成" en="C · First two layers solved" /></span>
            </div>
          </div>
          <div className="f2l-goal-f2l-arrow">
            <svg viewBox="0 0 720 90" preserveAspectRatio="none" aria-hidden="true"><path d="M 95 4 C 95 86 625 86 625 4 M 618 13 L 625 4 L 632 13" /></svg>
            <span>F2L</span>
          </div>

        </figure>} */}

        {section === 'comparison' && <IntroComparison orientation={orientation} onContinue={() => setSection('lbl')} />}
        {section === 'lbl' && <>
          <FirstTwoLayersIntro key={`lbl-${orientation}`} orientation={orientation} method="lbl" />
          <StudyActions onPrevious={() => setSection('comparison')} onContinue={() => setSection('f2l')} />
        </>}
        {section === 'f2l' && <>
          <FirstTwoLayersIntro key={`f2l-${orientation}`} orientation={orientation} method="f2l" />
          <StudyActions onPrevious={() => setSection('lbl')} onContinue={onNextChapter} />
        </>}
        </div>
      </div>}

      {stepId === 'lesson-2' && <div className="f2l-study-layout">
        <SectionNavigation label={tr({ zh: '认识四种三步基态', en: 'Meet the four three-move cases' })}>
          <div className="f2l-section-list"><p className="f2l-section-label" aria-current="true"><T zh="认识四种三步基态" en="Meet the four three-move cases" /></p></div>
        </SectionNavigation>
        <div className="f2l-study-main">

        <div className="f2l-recognition">
          {chapterCases.map((item, index) => <figure key={item.id}>
            <VisualCube view="iso" size={190} faceletColors={diagrams[index]} interactive enlargeable alt={item.name} />
            <figcaption>{item.name}</figcaption>
          </figure>)}
        </div>

        <StudyActions onContinue={onNextChapter} />
        </div>
      </div>}

</>;
}
