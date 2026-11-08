'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import TrainingFeedbackOverlay from '@/components/TrainingFeedbackOverlay';
import { tr } from '@/i18n/tr';
import { syncPlayerToMoveCount } from '@/lib/recon-alg-utils';
import { CORNER_POSITION, LESSON_STICKERING, LBL_INITIAL_VIEW, LBL_STAGE_GOALS, LBL_LEARNING_FOCUS } from './content';
import { crossStickering, crossDaisyStickering } from './cross-display';
import { usePlayerVisible } from './use-player-visible';

const crossInitialView = { ...LBL_INITIAL_VIEW, x: -Math.PI / 9 };
const undersideTilt = -Math.PI / 2 - crossInitialView.x;
const timingScale = 1.3;
const cross = ['D1', 'D3', 'D4', 'D5', 'D7'];
// Each y brings the next home face to the front: F, R, B, L.
const phases: readonly {
  duration: number;
  stickers?: readonly string[];
  move?: number;
  tilt?: number;
  fadeOut?: boolean;
}[] = [
  { duration: 1000 },
  { duration: 850, stickers: ['F7', 'F4'] },
  { duration: 700, move: 0 },
  { duration: 850, stickers: ['R7', 'R4'] },
  { duration: 700, move: 1 },
  { duration: 850, stickers: ['B7', 'B4'] },
  { duration: 700, move: 2 },
  { duration: 850, stickers: ['L7', 'L4'] },
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

function CrossPlayback() {
  const player = useRef<AlgPlayerHandle>(null);
  const visible = usePlayerVisible(player, 'cross-overview');
  const [phaseIndex, setPhaseIndex] = useState(0);
  const phase = phases[phaseIndex];

  useEffect(() => {
    if (!visible) return;
    let frame = 0;
    let index = 0;
    let elapsed = 0;
    let previousTime: number | undefined;
    const ease = (t: number) => t * t * (3 - 2 * t);

    const tick = (now: number) => {
      const phase = phases[index];
      const previousFraction = elapsed / phase.duration;
      const frameTime = Math.min(now - (previousTime ?? now), 50);
      elapsed = Math.min(phase.duration, elapsed + frameTime / timingScale);
      previousTime = now;
      if (phase.tilt !== undefined) {
        player.current?.orbitView?.(0, phase.tilt * (ease(elapsed / phase.duration) - ease(previousFraction)));
      }
      if (elapsed === phase.duration && !player.current?.isUserMovePending?.()) {
        index = (index + 1) % phases.length;
        elapsed = 0;
        const next = phases[index];
        if (index === phases.length - 1) syncPlayerToMoveCount(player.current?.getPlayer(), 0);
        if (next.move !== undefined) player.current?.playMove?.(next.move);
        setPhaseIndex(index);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  return <div className="lbl-auto-player" data-visible={visible && !phase.fadeOut}>
    <AlgPlayer ref={player} puzzle="3x3" engine="sim" set={LESSON_STICKERING.cross}
      alg="y y y" startSolved orientation="z2" sceneRot={crossInitialView}
      stickeringAtStep={crossStickering}
      highlightedStickers={phase.stickers ?? noStickers} moveDurationMs={550 * timingScale}
      controlMode="none" hideResetView interactionMode="none" fillPane />
  </div>;
}

const bottomView = { x: -Math.PI / 2, y: 0, z: 0 };
// The J permutation exchanges DF (green) and DL (red), leaving every white edge down.
const swappedCrossSetup = `z2 ${CORNER_POSITION} z2`;
const comparisonPhases: readonly {
  duration: number; orbit?: boolean; move?: number; feedback?: boolean; fadeOut?: boolean; reset?: boolean;
}[] = [
  { duration: 1300 },
  { duration: 1600, orbit: true },
  { duration: 700 },
  { duration: 1400, move: 0 },
  { duration: 1400, move: 1 },
  { duration: 1400, move: 2 },
  { duration: 3000, feedback: true },
  { duration: 450, fadeOut: true },
  { duration: 180, fadeOut: true, reset: true },
];

function CrossComparison({ reducedMotion }: { reducedMotion: boolean }) {
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
    let index = 0;
    let elapsed = 0;
    let previousTime: number | undefined;
    const tick = (now: number) => {
      const phase = comparisonPhases[index];
      const duration = reducedMotion && phase.orbit ? 1 : phase.duration;
      const previousProgress = elapsed / duration;
      elapsed = Math.min(duration, elapsed + Math.min(now - (previousTime ?? now), 50));
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
      if (elapsed === duration && !left.current?.isUserMovePending?.() && !right.current?.isUserMovePending?.()) {
        if (reducedMotion && phase.feedback) return;
        index = (index + 1) % comparisonPhases.length;
        elapsed = 0;
        const next = comparisonPhases[index];
        for (const player of [left, right]) {
          // playMove rebuilds the setup and finishes the other player's shared tweens.
          if (next.move !== undefined) player.current?.applyUserMove?.('y');
          if (next.reset) {
            // Complete the fourth y while hidden to restore both cases without a setup reset.
            player.current?.applyUserMove?.('y');
            player.current?.resetView?.();
          }
        }
        setPhaseIndex(index);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, reducedMotion]);

  return <>{[left, right].map((player, index) => <figure key={index}>
    <div className="lbl-cross-overview-cube" data-visible={visible && !phase.fadeOut}>
      <AlgPlayer ref={player} puzzle="3x3" engine="sim" set={LESSON_STICKERING.cross}
        alg="" setup={index === 0 ? swappedCrossSetup : undefined} startSolved={index === 1}
        orientation="z2" sceneRot={bottomView}
        stickeringAtStep={crossStickering} moveDurationMs={reducedMotion ? 1 : 715}
        controlMode="none" hideResetView interactionMode="turn" lockView fillPane />
      {(phase.feedback || phase.fadeOut && !phase.reset) && <div className="lbl-cross-comparison-feedback">
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
  const wrapper = useRef<HTMLDivElement>(null);
  const [learningArea, setLearningArea] = useState<Element | null>(null);
  useEffect(() => {
    setLearningArea(wrapper.current?.closest('.lbl-lesson-scroll') ?? null);
  }, []);
  useEffect(() => {
    if (continued) return;
    const continueWithSpace = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.defaultPrevented || event.repeat || event.isComposing ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest(
        'input, textarea, select, button, a, [contenteditable], [role="slider"], [role="dialog"], .playback-bar',
      )) return;
      event.preventDefault();
      setContinued(true);
    };
    document.addEventListener('keydown', continueWithSpace);
    return () => document.removeEventListener('keydown', continueWithSpace);
  }, [continued]);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setAnimate(!motion.matches);
    update();
    motion.addEventListener('change', update);
    return () => motion.removeEventListener('change', update);
  }, []);
  return <><div ref={wrapper} className={`lbl-stage-overview lbl-cross-overview${continued ? ' lbl-cross-comparison' : ''}`}>
    {continued ? <CrossComparison key={String(animate)} reducedMotion={!animate} /> : <>
    <figure>{animate ? <div className="lbl-cross-overview-cube">
      <AlgPlayer puzzle="3x3" engine="sim" set={LESSON_STICKERING.daisy}
        alg="" setup="F2 R2 B2 L2" orientation="z2" sceneRot={LBL_INITIAL_VIEW}
        stickeringAtStep={crossDaisyStickering}
        controlMode="none" hideResetView interactionMode="none" fillPane />
    </div> : daisy}</figure>
    <span className="lbl-stage-arrow" aria-hidden="true">⇒</span>
    <figure>{animate ? <div className="lbl-cross-overview-cube"><CrossPlayback /></div> : cross}</figure>
    </>}
    {!continued && learningArea && createPortal(<>
      <button type="button" className="lbl-guide-continue" onClick={() => setContinued(true)}
        aria-label={tr({ zh: '点击学习区继续', en: 'Click the lesson area to continue' })} />
      <span className="lbl-guide-continue-hint">{tr({ zh: '点击学习区继续', en: 'Click the lesson area to continue' })}</span>
    </>, learningArea)}
  </div>
  {continued ? <p className="lbl-lead">{tr({
    zh: '不但要看底面图形，还要对齐侧面颜色',
    en: 'Check the bottom pattern and align the side colors too.',
  })}</p> : <>
    <p className="lbl-lead">{tr(LBL_STAGE_GOALS.cross.summary!)}</p>
    <p>{tr(LBL_LEARNING_FOCUS.cross)}</p>
  </>}</>;
}
