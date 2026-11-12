'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import PlaybackScrubber from '@cuberoot/timer-ui/PlaybackScrubber';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import TrainingFeedbackOverlay from '@/components/TrainingFeedbackOverlay';
import { tr } from '@/i18n/tr';
import { CORNER_POSITION, LESSON_STICKERING, LBL_INITIAL_VIEW, LBL_STAGE_GOALS, LBL_LEARNING_FOCUS } from './content';
import { crossStickering, crossDaisyStickering } from './cross-display';
import { usePlayerVisible } from './use-player-visible';

const crossInitialView = { ...LBL_INITIAL_VIEW, x: -Math.PI / 9 };
const undersideTilt = -Math.PI / 2 - LBL_INITIAL_VIEW.x;
const timingScale = 1.3;
const cross = ['D1', 'D3', 'D4', 'D5', 'D7'];
const phases: readonly {
  duration: number;
  stickers?: readonly string[];
  tilt?: number;
  fadeOut?: boolean;
  fadeIntro?: boolean;
  focusIntro?: boolean;
}[] = [
  { duration: 5000 / timingScale },
  { duration: 350, fadeIntro: true },
  { duration: 850, focusIntro: true },
  { duration: 300 },
  { duration: 850, tilt: undersideTilt },
  { duration: 650, stickers: cross },
  { duration: 400 },
  { duration: 650, stickers: cross },
  { duration: 400 },
  { duration: 650, stickers: cross },
  { duration: 850, tilt: -undersideTilt },
  { duration: 450, fadeOut: true },
  { duration: 180, fadeOut: true },
];
const noStickers: readonly string[] = [];

// Use the animation's own clock, including its pauses and reset, rather than a second timer.
function updateLoopProgress(progress: (time: number) => void, timeline: readonly { duration: number }[], index: number, elapsed: number, scale: number, offset: number) {
  const completed = timeline.slice(0, index).reduce((sum, phase) => sum + phase.duration, 0);
  progress(offset + (completed + elapsed) * scale);
}

function locatePhase(timeline: readonly { duration: number }[], time: number) {
  let index = 0;
  let elapsed = Math.max(0, time);
  while (index < timeline.length - 1 && elapsed >= timeline[index].duration) elapsed -= timeline[index++].duration;
  return { index, elapsed: Math.min(elapsed, timeline[index].duration) };
}
const ease = (t: number) => t * t * (3 - 2 * t);

type PlaybackProps = {
  progress: (time: number) => void;
  clock: RefObject<number>;
  seekVersion: number;
  paused: boolean;
  onComplete: () => void;
  onFade: (fading: boolean) => void;
};

function CrossPlayback({ progress, clock, seekVersion, paused, onComplete, onFade, opening }: PlaybackProps & { opening: RefObject<HTMLDivElement | null> }) {
  const player = useRef<AlgPlayerHandle>(null);
  const visible = usePlayerVisible(player, 'cross-overview');
  const [phaseIndex, setPhaseIndex] = useState(0);
  const phase = phases[phaseIndex];

  useEffect(() => {
    if (!visible) return;
    let frame = 0;
    let { index, elapsed } = locatePhase(phases, clock.current / timingScale);
    let previousTime: number | undefined;
    let focus = 0;
    let opacity = 1;
    let tilt = 0;
    for (let i = 0; i <= index; i++) {
      const phase = phases[i];
      const fraction = i < index ? 1 : ease(elapsed / phase.duration);
      if (phase.fadeIntro) opacity = 1 - fraction;
      if (phase.focusIntro) focus = fraction;
      tilt += (phase.tilt ?? 0) * fraction;
    }
    player.current?.resetView?.();
    player.current?.orbitView?.(0, tilt);
    opening.current?.style.setProperty('--cross-intro-opacity', String(opacity));
    opening.current?.style.setProperty('--cross-focus-shift', '0px');
    opening.current?.style.setProperty('--cross-focus-scale', '1');
    setPhaseIndex(index);
    onFade(Boolean(phases[index].fadeOut));

    const tick = (now: number) => {
      const phase = phases[index];
      const previousFraction = elapsed / phase.duration;
      const frameTime = Math.min(now - (previousTime ?? now), 50);
      elapsed = Math.min(phase.duration, elapsed + (paused ? 0 : frameTime / timingScale));
      previousTime = now;
      const row = opening.current;
      if (row) {
        if (phase.fadeIntro) row.style.setProperty('--cross-intro-opacity', String(1 - ease(elapsed / phase.duration)));
        if (phase.focusIntro) focus = ease(elapsed / phase.duration);
        const target = row.lastElementChild as HTMLElement | null;
        if (target && focus > 0) {
          // Untransformed layout coordinates keep the move centered on resize too.
          const shift = row.clientWidth / 2 - target.offsetLeft - target.offsetWidth / 2;
          row.style.setProperty('--cross-focus-shift', `${shift * focus}px`);
          row.style.setProperty('--cross-focus-scale', String(1 + .45 * focus));
        }
      }
      if (phase.tilt !== undefined) {
        player.current?.orbitView?.(0, phase.tilt * (ease(elapsed / phase.duration) - ease(previousFraction)));
      }
      if (!paused && elapsed === phase.duration && !player.current?.isUserMovePending?.()) {
        if (index === phases.length - 1) {
          updateLoopProgress(progress, phases, index, elapsed, timingScale, 0);
          onComplete();
          return;
        }
        index += 1;
        elapsed = 0;
        const next = phases[index];
        if (next.fadeOut) onFade(true);
        setPhaseIndex(index);
      }
      updateLoopProgress(progress, phases, index, elapsed, timingScale, 0);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, progress, clock, seekVersion, paused, onComplete, onFade, opening]);

  return <div className="lbl-auto-player" data-visible={visible && !phase.fadeOut}>
    <AlgPlayer ref={player} puzzle="3x3" engine="sim" set={LESSON_STICKERING.cross}
      alg="" startSolved orientation="z2" sceneRot={LBL_INITIAL_VIEW}
      stickeringAtStep={crossStickering}
      highlightedStickers={phase.stickers ?? noStickers}
      controlMode="none" hideResetView interactionMode="none" fillPane />
  </div>;
}

const bottomView = { x: -Math.PI / 2, y: 0, z: 0 };
// The J permutation exchanges DF (green) and DL (red), leaving every white edge down.
const swappedCrossSetup = `z2 ${CORNER_POSITION} z2`;
const comparisonPhases: readonly {
  duration: number; orbit?: boolean; turn?: boolean; feedback?: boolean; fadeOut?: boolean;
}[] = [
  { duration: 1300 },
  { duration: 1600, orbit: true },
  { duration: 700 },
  { duration: 1400, turn: true },
  { duration: 1400, turn: true },
  { duration: 1400, turn: true },
  { duration: 3000, feedback: true },
  { duration: 450, fadeOut: true },
  { duration: 180, fadeOut: true },
];
const overviewDuration = phases.reduce((sum, phase) => sum + phase.duration, 0) * timingScale;
const animationDuration = overviewDuration + comparisonPhases.reduce((sum, phase) => sum + phase.duration, 0);

function CrossComparison({ reducedMotion, progress, clock, seekVersion, paused, onComplete, onFade }: PlaybackProps & { reducedMotion: boolean }) {
  const left = useRef<AlgPlayerHandle>(null);
  const right = useRef<AlgPlayerHandle>(null);
  const leftVisible = usePlayerVisible(left, 'cross-comparison-left');
  const rightVisible = usePlayerVisible(right, 'cross-comparison-right');
  const visible = leftVisible && rightVisible;
  const [phaseIndex, setPhaseIndex] = useState(0);
  const phase = comparisonPhases[phaseIndex];

  useEffect(() => {
    if (!visible) return;
    let frame = 0;
    let { index, elapsed } = locatePhase(comparisonPhases, reducedMotion ? 0 : clock.current - overviewDuration);
    let pitch = 0;
    let yaw = 0;
    for (let i = 0; i <= index; i++) {
      const phase = comparisonPhases[i];
      const time = i < index ? phase.duration : elapsed;
      if (phase.orbit) {
        const fraction = ease(time / phase.duration);
        pitch += (crossInitialView.x - bottomView.x) * fraction;
        yaw += crossInitialView.y * fraction;
      }
      if (phase.turn) yaw -= Math.PI / 2 * (1 - (1 - Math.min(time / 715, 1)) ** 2);
    }
    for (const player of [left, right]) {
      player.current?.resetView?.();
      player.current?.orbitView?.(0, pitch);
      player.current?.orbitView?.(yaw, 0);
    }
    setPhaseIndex(index);
    onFade(Boolean(comparisonPhases[index].fadeOut));
    let previousTime: number | undefined;
    const tick = (now: number) => {
      const phase = comparisonPhases[index];
      const duration = reducedMotion && phase.orbit ? 1 : phase.duration;
      const previousElapsed = elapsed;
      const previousProgress = elapsed / duration;
      elapsed = Math.min(duration, elapsed + (paused ? 0 : Math.min(now - (previousTime ?? now), 50)));
      previousTime = now;
      if (phase.orbit) {
        const progress = elapsed / duration;
        const ease = (t: number) => t * t * (3 - 2 * t);
        const delta = ease(progress) - ease(previousProgress);
        for (const player of [left, right]) {
          player.current?.orbitView?.(0, (crossInitialView.x - bottomView.x) * delta);
          player.current?.orbitView?.(crossInitialView.y * delta, 0);
        }
      }
      if (phase.turn) {
        // One clock drives both views; separate move tweens start at different times.
        const turnDuration = reducedMotion ? 1 : 715;
        const easedTurn = (time: number) => 1 - (1 - Math.min(time / turnDuration, 1)) ** 2;
        const yaw = -Math.PI / 2 * (easedTurn(elapsed) - easedTurn(previousElapsed));
        for (const player of [left, right]) player.current?.orbitView?.(yaw, 0);
      }
      if (!paused && elapsed === duration && !left.current?.isUserMovePending?.() && !right.current?.isUserMovePending?.()) {
        if (reducedMotion && phase.feedback) return;
        if (index === comparisonPhases.length - 1) {
          updateLoopProgress(progress, comparisonPhases, index, elapsed, 1, overviewDuration);
          onComplete();
          return;
        }
        index += 1;
        elapsed = 0;
        const next = comparisonPhases[index];
        if (next.fadeOut) onFade(true);
        setPhaseIndex(index);
      }
      if (!reducedMotion) updateLoopProgress(progress, comparisonPhases, index, elapsed, 1, overviewDuration);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, reducedMotion, progress, clock, seekVersion, paused, onComplete, onFade]);

  return <>{[left, right].map((player, index) => <figure key={index}>
    <div className="lbl-cross-overview-cube" data-visible={visible && !phase.fadeOut}>
      <AlgPlayer ref={player} puzzle="3x3" engine="sim" set={LESSON_STICKERING.cross}
        alg="" setup={index === 0 ? swappedCrossSetup : undefined} startSolved={index === 1}
        orientation="z2" sceneRot={bottomView}
        stickeringAtStep={crossStickering}
        controlMode="none" hideResetView interactionMode="none" fillPane />
      {(phase.feedback || phase.fadeOut) && <div className="lbl-cross-comparison-feedback">
        <TrainingFeedbackOverlay kind={index === 0 ? 'wrong' : 'correct'}
          correctLabel={tr({ zh: '棱块侧面与中心颜色相同', en: 'The edge side colors match their centers' })}
          wrongLabel={tr({ zh: '棱块侧面与中心颜色不同', en: 'The edge side colors do not match their centers' })} />
      </div>}
    </div>
  </figure>)}</>;
}

export default function CrossOverviewAnimation({ daisy, cross }: { daisy: ReactNode; cross: ReactNode }) {
  const [animate, setAnimate] = useState(false);
  const [continued, setContinued] = useState(false);
  const [fading, setFading] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const opening = useRef<HTMLDivElement>(null);
  const clock = useRef(0);
  const [time, setTime] = useState(0);
  const [seekVersion, setSeekVersion] = useState(0);
  const [paused, setPaused] = useState(false);
  const progress = useCallback((value: number) => { clock.current = value; setTime(value); }, []);
  const [toolbar, setToolbar] = useState<Element | null>(null);
  const showComparison = useCallback(() => { progress(overviewDuration); setContinued(true); setFading(false); }, [progress]);
  const restart = useCallback(() => {
    progress(0);
    setSeekVersion(version => version + 1);
    setContinued(false);
    setFading(false);
  }, [progress]);
  const seek = (value: number) => {
    progress(value);
    setContinued(value >= overviewDuration);
    setSeekVersion(version => version + 1);
    setFading(false);
  };
  const playback = { progress, clock, seekVersion, paused, onFade: setFading };
  useEffect(() => {
    const resume = () => setPaused(false);
    window.addEventListener('pointerup', resume);
    window.addEventListener('pointercancel', resume);
    window.addEventListener('blur', resume);
    return () => {
      window.removeEventListener('pointerup', resume);
      window.removeEventListener('pointercancel', resume);
      window.removeEventListener('blur', resume);
    };
  }, []);
  useEffect(() => {
    setToolbar(wrapper.current?.closest('.lbl-learning')?.querySelector('.lbl-demo-toolbar') ?? null);
  }, []);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setAnimate(!motion.matches); restart(); };
    update();
    motion.addEventListener('change', update);
    return () => motion.removeEventListener('change', update);
  }, [restart]);
  return <><div ref={wrapper} className="lbl-cross-animation-scene" data-fading={fading}>
  <div key={`${continued}/${animate}`} ref={opening} data-opening={animate && !continued}
    className={`lbl-stage-overview lbl-cross-overview${continued ? ' lbl-cross-comparison' : ''}`}>
    {continued ? <CrossComparison reducedMotion={false} {...playback} onComplete={restart} /> : <>
    <figure>{animate ? <div className="lbl-cross-overview-cube">
      <AlgPlayer puzzle="3x3" engine="sim" set={LESSON_STICKERING.daisy}
        alg="" setup="F2 R2 B2 L2" orientation="z2" sceneRot={LBL_INITIAL_VIEW}
        stickeringAtStep={crossDaisyStickering}
        controlMode="none" hideResetView interactionMode="none" fillPane />
    </div> : daisy}</figure>
    <span className="lbl-stage-arrow" aria-hidden="true">⇒</span>
    <figure>{animate ? <div className="lbl-cross-overview-cube"><CrossPlayback {...playback} onComplete={showComparison} opening={opening} /></div> : cross}</figure>
    </>}
  </div>
  {animate && toolbar && createPortal(<div className="lbl-cross-animation-progress"
    onPointerDownCapture={() => setPaused(true)}
    onKeyDownCapture={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      setPaused(true);
      seek(event.key === 'Home' ? 0 : event.key === 'End' ? animationDuration
        : Math.max(0, Math.min(animationDuration, clock.current + (event.key === 'ArrowLeft' ? -500 : 500))));
    }} onKeyUpCapture={() => setPaused(false)} onBlurCapture={() => setPaused(false)}>
    <PlaybackScrubber step={time} total={animationDuration} onScrub={seek}
      ariaLabel={tr({ zh: '演示进度', en: 'Animation progress' })} />
  </div>, toolbar)}
  {continued ? <p className="lbl-lead">{tr({
    zh: '不但要看底面图形，还要对齐侧面颜色',
    en: 'Check the bottom pattern and align the side colors too.',
  })}</p> : <>
    <p className="lbl-lead">{tr(LBL_STAGE_GOALS.cross.summary!)}</p>
    <p>{tr(LBL_LEARNING_FOCUS.cross)}</p>
  </>}
  {!animate && <>
    <div className="lbl-stage-overview lbl-cross-comparison">
      <CrossComparison reducedMotion {...playback} onComplete={restart} />
    </div>
    <p className="lbl-lead">{tr({ zh: '不但要看底面图形，还要对齐侧面颜色', en: 'Check the bottom pattern and align the side colors too.' })}</p>
  </>}
  </div></>;
}
