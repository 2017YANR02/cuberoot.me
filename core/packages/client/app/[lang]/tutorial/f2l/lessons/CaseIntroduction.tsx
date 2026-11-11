'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alg } from 'cubing/alg';
import { Color } from 'three';
import { FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import type { CubeFace } from '@/lib/cube-colors';
import { ArrowLeftRight, BookOpen } from 'lucide-react';
import { VisualCube } from '@/components/VisualCube';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import TrainingFeedbackOverlay from '@/components/TrainingFeedbackOverlay';
import { resolveSimPreviewMoves } from '@/components/AlgPlayer/player-setup';
import { T, tr } from '@/i18n/tr';
import { ORDERED_BASIC_CASES } from '../data/basic-cases';
import { f2lDiagramFacelets, f2lPlaybackSections } from '../lib/cube-preview';
import StudyActions from '../components/StudyActions';
import SectionNavigation from '../components/SectionNavigation';
import './case-introduction.css';

export default function CaseIntroduction({ orientation }: { orientation: string }) {
  const root = useRef<HTMLDivElement>(null);
  const players = useRef<(AlgPlayerHandle | null)[]>([]);
  const cubes = useRef<(HTMLDivElement | null)[]>([]);
  const motion = useRef<Animation | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState('choose');
  const [step, setStep] = useState(0);
  const [seekVersion, setSeekVersion] = useState(0);
  const [manualStage, setManualStage] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [referenceFading, setReferenceFading] = useState(false);
  const [adjustment, setAdjustment] = useState<string | null>(null);
  const [alignmentComplete, setAlignmentComplete] = useState(false);
  const [alignmentStarted, setAlignmentStarted] = useState(false);
  const [returnReady, setReturnReady] = useState(false);
  const [pairVisibility, setPairVisibility] = useState(1);
  const pairColors = useMemo(() => {
    const colors = orientedCubeFaceColors(orientation);
    return Object.fromEntries(['F5', 'R3', 'D2', 'F8', 'R6'].map(sticker => [sticker,
      new Color(FM_FIXED_COLOR[FM_IGNORED]!).lerp(new Color(colors[sticker[0] as CubeFace]), pairVisibility).getStyle()]));
  }, [orientation, pairVisibility]);
  const actualStep = useRef(0);
  const setups = useMemo(() => ORDERED_BASIC_CASES.map(item => new Alg(item.alg).invert().expand().toString()), []);
  const reference = useMemo(() => selected === null ? null : f2lDiagramFacelets(setups[selected], orientation), [selected, setups, orientation]);
  useEffect(() => {
    if (selected === null || phase !== 'transition') return;
    const element = cubes.current[selected]!;
    const start = element.getBoundingClientRect();
    const bounds = root.current!.getBoundingClientRect();
    const narrow = window.matchMedia('(max-width: 700px)').matches;
    const leftWidth = narrow ? bounds.width : bounds.width * .48;
    const endSize = Math.min(390, leftWidth);
    const large = Math.min(endSize * 1.35, bounds.width * .9);
    const frame = (x: number, y: number, size: number) => ({ transform: `translate(${x-start.x}px, ${y-start.y}px) scale(${size/start.width})` });
    const center = frame(bounds.x + (bounds.width-large)/2, bounds.y+60, large);
    const animation = element.animate([{ transform: 'none', offset: 0 }, { ...center, offset: .2 }, { ...center, offset: .75 },
      { ...frame(bounds.x + (leftWidth - endSize) / 2, bounds.y+60, endSize), offset: 1 }], {
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 3600, easing: 'ease-in-out', fill: 'forwards' });
    motion.current = animation;
    animation.onfinish = () => setPhase('prepare');
    return () => { animation.onfinish = null; };
  }, [selected, phase]);
  useEffect(() => {
    if (selected === null || (phase !== 'prepare' && phase !== 'learn')) return;
    const element = cubes.current[selected]!;
    const container = root.current!;
    const place = () => {
      const bounds = container.getBoundingClientRect();
      const origin = element.parentElement!.getBoundingClientRect();
      const leftWidth = window.matchMedia('(max-width: 700px)').matches ? bounds.width : bounds.width * .48;
      const size = Math.min(390, leftWidth);
      container.style.setProperty('--case-player-size', `${size}px`);
      const transform = `translate(${bounds.x + (leftWidth - size) / 2 - origin.x}px, ${bounds.y + 60 - origin.y - element.offsetTop}px) scale(${size / element.offsetWidth})`;
      motion.current?.cancel(); motion.current = null;
      if (element.style.transform !== transform) element.style.transform = transform;
      element.style.setProperty('--case-controls-width', `${size}px`);
      element.style.setProperty('--case-controls-scale', `${element.offsetWidth / size}`);
      const playbackBar = element.querySelector('.playback-bar');
      const contentHeight = `${playbackBar ? Math.max(size, playbackBar.getBoundingClientRect().bottom - (bounds.y + 60)) : size}px`;
      if (container.style.getPropertyValue('--case-player-content-height') !== contentHeight) container.style.setProperty('--case-player-content-height', contentHeight);
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(container); observer.observe(element);
    const playbackBar = element.querySelector('.playback-bar');
    if (playbackBar) observer.observe(playbackBar);
    window.addEventListener('resize', place);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); };
  }, [selected, phase, controlsVisible]);
  useEffect(() => {
    if (phase !== 'prepare') return;
    let frame = 0, switched = false;
    const started = performance.now();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (now: number) => {
      const elapsed = reduced ? 1600 : now - started;
      if (elapsed >= 650 && !switched) {
        switched = true;
        setAdjustment(['U', "U'", 'U2'][Math.floor(Math.random() * 3)]);
      }
      const value = elapsed < 650 ? 1 - elapsed / 650 : Math.max(0, Math.min(1, (elapsed - 950) / 650));
      setPairVisibility(value * value * (3 - 2 * value));
      if (elapsed >= 1600) { actualStep.current = 0; setStep(0); setPhase('learn'); }
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);
  useEffect(() => {
    if (phase !== 'learn' || selected === null || manualStage) return;
    let frame = 0, last = performance.now(), waited = 0, requested = actualStep.current;
    const tick = (now: number) => {
      const delta = Math.min(100, now-last); last = now;
      const player = players.current[selected];
      if (!document.hidden && player?.getPlayer() && !player.isUserMovePending?.() && actualStep.current === requested) {
        if (!controlsVisible && requested === 1 && waited === 0) setAlignmentComplete(true);
        waited += delta;
        if (!controlsVisible && requested === 1 && waited >= 5000) setReferenceFading(true);
        if (!controlsVisible && requested === 1 && waited >= 5500) {
          actualStep.current = 0; setStep(0); setControlsVisible(true); setReferenceFading(false);
          return;
        }
        if (waited >= (controlsVisible ? 2400 : 4000) && (controlsVisible || requested === 0)) {
          waited = 0;
          if (controlsVisible && requested === 3) {
            return;
          }
          if (controlsVisible || requested === 0) {
            if (!controlsVisible) setAlignmentStarted(true);
            player.playMove?.(requested++);
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, selected, seekVersion, manualStage, controlsVisible]);
  useEffect(() => {
    setReturnReady(false);
    if (phase !== 'learn' || selected === null || !controlsVisible) return;
    let frame = 0, previousReady = false, lessonFinished = false;
    const update = () => {
      const handle = players.current[selected];
      const idle = !!handle?.getPlayer() && !handle.isUserMovePending?.();
      if (idle && actualStep.current === 3) lessonFinished = true;
      const ready = lessonFinished && idle;
      if (ready !== previousReady) { previousReady = ready; setReturnReady(ready); }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [phase, selected, controlsVisible]);
  useEffect(() => {
    if (phase !== 'return' || selected === null) return;
    const element = cubes.current[selected]!;
    const transform = getComputedStyle(element).transform;
    motion.current?.cancel();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animation = element.animate([
      { transform },
      { transform: 'none' },
    ], { duration: reduced ? 0 : 1100, easing: 'ease-in-out', fill: 'forwards' });
    motion.current = animation;
    let cancelled = false;
    animation.onfinish = async () => {
      await players.current[selected]?.resetView?.(900);
      if (cancelled) return;
      const player = players.current[selected]?.getPlayer();
      if (player) player.timestamp = 0;
      element.style.transform = '';
      animation.cancel();
      motion.current = null;
      setSelected(null); setPhase('choose'); setStep(0); actualStep.current = 0;
    };
    return () => { cancelled = true; animation.onfinish = null; };
  }, [phase, selected]);
  useEffect(() => () => motion.current?.cancel(), []);
  const lesson = selected === null ? null : ORDERED_BASIC_CASES[selected];
  const sections = useMemo(() => lesson ? f2lPlaybackSections(lesson.alg) : [], [lesson]);
  const seekStage = (stage: number) => {
    if (selected === null) return;
    const handle = players.current[selected];
    if (!handle || handle.isUserMovePending?.()) return;
    const player = handle.getPlayer();
    if (!player) return;
    const target = stage === 0 ? 0 : sections[stage - 1].end;
    player.timestamp = target;
    setManualStage(true);
    actualStep.current = target; setStep(target); setSeekVersion(value => value + 1);
  };
  const demonstrateMove = (index: number) => {
    if (selected === null) return;
    const handle = players.current[selected];
    if (!handle || handle.isUserMovePending?.()) return;
    setManualStage(true);
    handle.playMove?.(index);
  };
  return <div className="f2l-study-layout">
    <SectionNavigation label={tr({ zh: '三步标态', en: 'Three-move cases' })}>
      <div className="f2l-section-list">
        <p className="f2l-section-label" aria-current="true"><T zh="三步标态" en="Three-move cases" /></p>
      </div>
    </SectionNavigation>
    <div className="f2l-study-main"><div ref={root} className="f2l-case-introduction" data-phase={phase}>
    <div className="f2l-case-grid">{ORDERED_BASIC_CASES.map((item, index) => <div key={item.id} className="f2l-case-item" data-selected={selected === index} data-hidden={selected !== null && selected !== index}>
      <div className="f2l-case-model" ref={element => { cubes.current[index] = element; }}
        onPointerDownCapture={event => {
          if (phase === 'learn' && controlsVisible && event.target instanceof Element && event.target.closest('button, input, [role="slider"]')) setManualStage(true);
        }} onKeyDownCapture={event => {
          if (phase === 'learn' && controlsVisible && event.target instanceof Element && event.target.closest('button, input, [role="slider"]')) setManualStage(true);
        }}>
        <AlgPlayer ref={value => { players.current[index] = value; }} puzzle="3x3" engine="sim" set="f2l-tutorial"
          setup={selected === index && adjustment && !controlsVisible ? `${setups[index]} ${adjustment}` : setups[index]}
          alg={selected === index && adjustment && !controlsVisible ? new Alg(adjustment).invert().toString() : item.alg}
          moveHint={selected === index && phase === 'learn' && !controlsVisible && !alignmentStarted && !alignmentComplete && adjustment ? new Alg(adjustment).invert().toString() : undefined}
          stickerColorOverrides={selected === index ? pairColors : undefined} orientation={orientation} fillPane moveDurationMs={950}
          controlMode={phase === 'learn' && selected === index && controlsVisible ? 'full' : 'none'} interactionMode={phase === 'learn' && selected === index ? 'view' : 'none'} hideResetView
          onStepChange={value => { if (selected === index) { actualStep.current = value; setStep(value); } }} />
      </div>
      <button type="button" className="f2l-case-hit" disabled={phase !== 'choose'} aria-label={tr({ zh: `学习 ${item.name}`, en: `Learn ${item.name}` })}
        onClick={() => { setSelected(index); setStep(0); actualStep.current = 0; setManualStage(false); setControlsVisible(false); setReferenceFading(false); setAdjustment(null); setAlignmentComplete(false); setAlignmentStarted(false); setPairVisibility(1); setPhase('transition'); }} />
      <span className="f2l-case-name">{item.name}</span>
    </div>)}</div>
    <p className="f2l-case-prompt"><T zh="点击选择一个三步标态，开始学习" en="Choose a three-move case to start learning" /></p>
    {phase === 'learn' && !controlsVisible && <div className="tutorial-cube-bubble f2l-case-alignment-status" data-site-surface="panel" data-fading={referenceFading} role="status">
      <span className="f2l-case-alignment-signal" aria-hidden="true"><TrainingFeedbackOverlay kind={alignmentComplete ? 'correct' : 'wrong'} correctLabel="" wrongLabel="" /></span>
      {alignmentComplete ? <T zh="顶层已对齐" en="Top layer aligned" /> : <T zh="顶层朝向需要调整" en="Adjust the top layer" />}
    </div>}
    {phase === 'learn' && lesson && reference && <div key={controlsVisible ? 'stages' : 'alignment'} className="f2l-case-narration" data-alignment={!controlsVisible} data-fading={referenceFading}>
      {!controlsVisible ? <><div className="f2l-case-reference">
        <ArrowLeftRight className="f2l-case-reference-arrow" size={40} strokeWidth={1.5} aria-hidden="true" />
        <figure className="f2l-case-reference-sheet">
          <figcaption><BookOpen size={18} aria-hidden="true" /><T zh="公式库" en="Algorithms" /><span>{lesson.name}</span></figcaption>
          <VisualCube local view="iso" size={160} faceletColors={reference} alt={tr({ zh: `${lesson.name} 公式的初始状态`, en: `Starting state for ${lesson.name}` })} />
          <code>{new Alg(lesson.alg).expand().toString().replaceAll("'", '′')}</code>
        </figure>
      </div>
      </> : <><ol className="f2l-stage-list f2l-case-stages">
        {lesson.stageTitles.map((title, index) => <li key={index}>
          <button type="button" className="f2l-stage-button" aria-current={step === index ? 'step' : undefined}
            onClick={() => seekStage(index)}>
            <span className="f2l-stage-content"><span className="f2l-stage-title">{tr(title)}</span>
            </span>
          </button>
          {index > 0 && <div className="f2l-case-stage-moves">
            {resolveSimPreviewMoves('3x3', sections[index - 1].alg).map((move, offset) => {
              const moveIndex = sections[index - 1].start + offset;
              return <button type="button" className="f2l-case-move" key={moveIndex}
                aria-current={step === moveIndex + 1 ? 'step' : undefined}
                aria-label={tr({ zh: `演示 ${move}`, en: `Demonstrate ${move}` })}
                onClick={() => demonstrateMove(moveIndex)}><code>{move.replaceAll("'", '′')}</code></button>;
            })}
          </div>}
        </li>)}
      </ol>
      </>}
    </div>}
    {phase === 'learn' && !controlsVisible && <p className="f2l-case-alignment-caption" data-fading={referenceFading} aria-live="polite">
      <span><T zh="调整顶层" en="Adjust the top layer" /></span>
      <span><T zh="使魔方和公式的初始状态一样" en="Match the cube to the algorithm’s starting state" /></span>
    </p>}
    {phase === 'learn' && controlsVisible && <div className="f2l-case-return-row" style={{ visibility: returnReady ? 'visible' : 'hidden' }}><button type="button" className="f2l-case-return-text" disabled={!returnReady} onClick={() => {
      if (selected !== null && !players.current[selected]?.isUserMovePending?.()) setPhase('return');
    }}><T zh="点击返回选择" en="Click to return to case selection" /></button></div>}
  </div><StudyActions /></div></div>;
}
