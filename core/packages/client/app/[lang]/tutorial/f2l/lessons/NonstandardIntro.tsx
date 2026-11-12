'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Color } from 'three';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { resolveSimPreviewMoves } from '@/components/AlgPlayer/player-setup';
import { FM_FIXED_COLOR, FM_IGNORED, stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import PlaybackBar from '@/components/PlaybackBar';
import TrainingFeedbackOverlay from '@/components/TrainingFeedbackOverlay';
import { tr, T } from '@/i18n/tr';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import type { CubeFace } from '@/lib/cube-colors';
import { nonstandardIntroScenes, NONSTANDARD_INTRO_PAIR_STICKERS } from '../data/nonstandard-intro';
import './nonstandard-intro.css';

const frontRight = { x: Math.PI / 8, y: -Math.PI / 5, z: 0 };
const frontLeft = { ...frontRight, y: Math.PI / 7 };
const noHighlights: readonly string[] = [];
const pairMask = stickeringMaskFn(3, 'F2LPair')!;
const pairStickering = () => pairMask;
const edgeStickering = () => (initial: number, face: number) => initial === 20 ? FM_IGNORED : pairMask(initial, face);
const cornerStickering = () => (initial: number, face: number) => initial === 23 ? FM_IGNORED : pairMask(initial, face);
const crossMask = () => (initial: number, face: number) => initial === 20 || initial === 23 ? FM_IGNORED : pairMask(initial, face);

export default function NonstandardIntro({ orientation, edgeSetup, cornerSetup, onComplete }: {
  orientation: string; edgeSetup: string; cornerSetup: string; onComplete: (complete: boolean) => void;
}) {
  const scenes = useMemo(() => nonstandardIntroScenes(edgeSetup, cornerSetup, orientation), [edgeSetup, cornerSetup, orientation]);
  const player = useRef<AlgPlayerHandle>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [sceneDone, setSceneDone] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [initialView, setInitialView] = useState(frontRight);
  const [pairTransition, setPairTransition] = useState(false);
  const [pairVisibility, setPairVisibility] = useState(1);
  const pairFrame = useRef<number | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedRef = useRef(0);
  const appliedMove = useRef(-1);
  const playerStep = useRef(0);
  const viewTilt = useRef(0);
  const viewYaw = useRef(0);
  const autoplay = useRef(true);
  const index = position;
  const finished = index === scenes.length - 1 && sceneDone;
  const scene = scenes[index];
  const beat = scene.beats?.findLast(item => elapsed >= item.at);
  const moveCount = useMemo(() => resolveSimPreviewMoves('3x3', scene.alg).length, [scene.alg]);
  const pairColors = useMemo(() => {
    if (!pairTransition && !scene.flashPair) return undefined;
    const colors = orientedCubeFaceColors(orientation);
    const visibility = pairTransition ? pairVisibility : reducedMotion || !playing ? 1
      : (1 + Math.cos((elapsed - (beat?.at ?? 0)) * Math.PI / 350)) / 2;
    return Object.fromEntries(NONSTANDARD_INTRO_PAIR_STICKERS.map(sticker => [sticker,
      new Color(FM_FIXED_COLOR[FM_IGNORED]!).lerp(new Color(colors[sticker[0] as CubeFace]),
        (beat?.hideCorner && ['D2', 'F8', 'R6'].includes(sticker)) || (beat?.hideEdge && ['F5', 'R3'].includes(sticker)) ? 0 : visibility).getStyle(),
    ]));
  }, [orientation, pairTransition, pairVisibility, scene.flashPair, reducedMotion, playing, elapsed, beat]);
  const fadePair = useCallback((from: number, to: number, done: () => void) => {
    const start = performance.now();
    const tick = (now: number) => {
      const progress = reducedMotion ? 1 : Math.min(1, (now - start) / 450);
      setPairVisibility(from + (to - from) * progress * progress * (3 - 2 * progress));
      if (progress < 1) pairFrame.current = requestAnimationFrame(tick);
      else { pairFrame.current = null; done(); }
    };
    pairFrame.current = requestAnimationFrame(tick);
  }, [reducedMotion]);
  useEffect(() => () => { if (pairFrame.current !== null) cancelAnimationFrame(pairFrame.current); }, []);
  useEffect(() => {
    if (ready && pairTransition && pairVisibility === 0 && pairFrame.current === null) {
      fadePair(0, 1, () => setPairTransition(false));
    }
  }, [ready, pairTransition, pairVisibility, fadePair]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => { onComplete(finished); }, [finished, onComplete]);
  useEffect(() => () => { if (transitionTimer.current !== null) clearTimeout(transitionTimer.current); }, []);
  useEffect(() => {
    setReady(false);
    elapsedRef.current = 0; setElapsed(0);
    appliedMove.current = -1; playerStep.current = 0;
    viewTilt.current = 0;
    viewYaw.current = 0;
    let frame = 0;
    const check = () => {
      if (!player.current?.getPlayer() || player.current.isUserMovePending?.()) {
        frame = requestAnimationFrame(check); return;
      }
      setReady(true);
      if (autoplay.current) {
        autoplay.current = false;
        setPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches && !document.hidden);
      }
    };
    frame = requestAnimationFrame(check);
    return () => cancelAnimationFrame(frame);
  }, [index, orientation, generation]);

  useEffect(() => {
    if (!ready || !playing || sceneDone || fadingOut || pairTransition) return;
    let frame = 0, last = performance.now(), lastRendered = elapsedRef.current;
    const tick = (now: number) => {
      const delta = Math.min(now - last, 100); last = now;
      if (document.hidden) { setPlaying(false); return; }
      // Wait for real turns to finish; paused/loading time does not consume a shot.
      const pending = player.current?.isUserMovePending?.()
        || (appliedMove.current >= 0 && playerStep.current !== appliedMove.current + 1);
      if (!pending) {
        elapsedRef.current += delta;
        if (scene.revealLeft) {
          const progress = Math.max(0, Math.min(1, (elapsedRef.current - 600) / 2000));
          const yaw = (frontLeft.y - frontRight.y) * progress * progress * (3 - 2 * progress);
          player.current?.orbitView?.(yaw - viewYaw.current, 0);
          viewYaw.current = yaw;
        }
        if (scene.showBottom) {
          const time = elapsedRef.current;
          const ease = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
          // Negative pitch brings the D face into view; return before advancing.
          const tilt = -(scene.bottomTilt ?? 1.5) * (ease((time - 1400) / 1000) - ease((time - 4300) / 1000));
          player.current?.orbitView?.(0, tilt - viewTilt.current);
          viewTilt.current = tilt;
        }
        if (appliedMove.current + 1 < moveCount && elapsedRef.current >= (scene.moveStart ?? 500) + (appliedMove.current + 1) * (scene.moveGap ?? 100)) {
          appliedMove.current += 1;
          player.current?.playMove?.(appliedMove.current);
        } else if (elapsedRef.current >= scene.duration) {
          elapsedRef.current = scene.duration; setElapsed(scene.duration);
          setSceneDone(true); setPlaying(false);
          return;
        }
      }
      if (elapsedRef.current - lastRendered >= (scene.flashPair ? 16 : 100)) {
        lastRendered = elapsedRef.current; setElapsed(lastRendered);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, playing, sceneDone, fadingOut, pairTransition, scene, moveCount]);

  const seek = useCallback((next: number, play = false) => {
    if (transitionTimer.current !== null || pairTransition || !ready) return;
    const target = Math.max(0, Math.min(scenes.length - 1, Math.round(next)));
    const fadePieces = !!scenes[target].result && target !== index;
    const keepPlayer = fadePieces || (target === index + 1 && (sceneDone || moveCount === 0) && scenes[target].continuePrevious === true);
    setPlaying(false); setContinuous(keepPlayer);
    const enterScene = () => {
      setReady(false); setSceneDone(false); setFadingOut(false);
      autoplay.current = play;
      setPosition(target);
      if (!keepPlayer) {
        setInitialView(scenes[target].leftView ? frontLeft : frontRight);
        setGeneration(value => value + 1);
      } else if (!!scene.leftView !== !!scenes[target].leftView) {
        player.current?.orbitView?.(scenes[target].leftView ? frontLeft.y - frontRight.y : frontRight.y - frontLeft.y, 0);
      }
      elapsedRef.current = 0; setElapsed(0); appliedMove.current = -1; playerStep.current = 0;
    };
    if (fadePieces) {
      setSceneDone(false);
      setPairTransition(true);
      const from = scene.hidePair || scene.crossOnly ? 0 : 1;
      setPairVisibility(from);
      fadePair(from, 0, enterScene);
      return;
    }
    // Continuous shots reuse the mounted renderer and never hide the cube.
    if (keepPlayer) { enterScene(); return; }
    setFadingOut(true);
    // Keep the old cube mounted until it has faded out, then wait for the new
    // renderer to be ready before revealing it.
    transitionTimer.current = setTimeout(() => {
      transitionTimer.current = null;
      enterScene();
    }, reducedMotion ? 0 : 450);
  }, [ready, reducedMotion, scenes, scene, index, sceneDone, moveCount, pairTransition, fadePair]);
  useEffect(() => {
    if (sceneDone && !finished) seek(index + 1, true);
  }, [sceneDone, finished, index, seek]);
  const progress = finished ? scenes.length : index + Math.min(elapsed / scene.duration, .999);
  const emphasis = beat?.highlight ?? scene.highlight;
  const pulse = beat ? beat.pulse : true;
  const highlights = scene.flashPair ? noHighlights : !pulse || reducedMotion || !playing || Math.floor(elapsed / 900) % 2 === 0 ? emphasis : noHighlights;
  return <section className="f2l-concept-video" data-continuous={continuous} aria-label={tr({ zh: '基态与非标概念演示', en: 'Standard and non-standard cases: concept demonstration' })}>
    <div className="f2l-concept-count">{index + 1} / {scenes.length}</div>
    <div className="f2l-concept-scene">
      <div className="f2l-cube f2l-concept-cube" data-visible={(ready || continuous) && !fadingOut}><AlgPlayer key={`${orientation}:${generation}`} ref={player} puzzle="3x3" engine="sim" set="f2l-tutorial"
        setup={scene.setup} startSolved={!scene.setup.trim()} alg={scene.alg} orientation={orientation} sceneRot={initialView}
        stickerColorOverrides={pairColors}
        highlightedStickers={highlights} stickeringAtStep={scene.hidePair || scene.crossOnly ? crossMask : beat?.hideCorner ? edgeStickering : beat?.hideEdge ? cornerStickering : pairStickering}
        onStepChange={step => { playerStep.current = step; }}
        moveDurationMs={scene.moveDuration ?? 220} controlMode="none" hideResetView interactionMode="none" fillPane />
        {ready && !fadingOut && (scene.result ? elapsed >= 1000 : beat?.label) && <div className="tutorial-cube-bubble f2l-concept-result" data-target={scene.flashPair ? beat?.hideEdge ? 'corner' : beat?.hideCorner ? 'edge' : 'pair' : beat?.label ? 'slot' : undefined} data-site-surface="panel" role="status">
          {scene.result ? <>
            <div className="f2l-concept-signal" aria-hidden="true"><TrainingFeedbackOverlay
              kind={scene.result === 'standard' ? 'correct' : 'wrong'} correctLabel="" wrongLabel="" /></div>
            {scene.result === 'standard' ? <T zh="基态" en="Standard" /> : <T zh="非基态" en="Non-standard" />}
          </> : beat?.label && tr(beat.label)}
        </div>}
      </div>
      <div className="f2l-concept-caption" aria-live="polite" aria-atomic="true">
        <p key={tr(beat?.caption ?? scene.caption)} className="f2l-concept-line">{tr(beat?.caption ?? scene.caption)}</p>
      </div>
    </div>
    <PlaybackBar step={progress} total={scenes.length} playing={playing && ready} disabled={!ready || fadingOut || pairTransition}
      onScrub={value => seek(value)} onSkipStart={() => seek(0)} onStepBack={() => seek(position - 1)}
      onTogglePlay={() => finished ? seek(0, true) : sceneDone ? seek(index, true) : setPlaying(value => !value)}
      onStepForward={() => seek(position + 1, true)} onSkipEnd={() => seek(scenes.length - 1, true)}
      trailing={<button type="button" className="playback-bar-btn" disabled={!ready || fadingOut || pairTransition} onClick={() => seek(0)}
        aria-label={tr({ zh: '重置概念演示', en: 'Reset concept demonstration' })}><RotateCcw size={15} aria-hidden="true" /></button>}
      labels={{ skipStart: tr({ zh: '回到开头', en: 'Back to the beginning' }), stepBack: tr({ zh: '上一画面', en: 'Previous scene' }),
        play: tr({ zh: '播放概念演示', en: 'Play concept demonstration' }), pause: tr({ zh: '暂停概念演示', en: 'Pause concept demonstration' }),
        stepForward: tr({ zh: '下一画面', en: 'Next scene' }), skipEnd: tr({ zh: '跳到结尾', en: 'Skip to the end' }),
        scrub: tr({ zh: '概念演示播放进度', en: 'Concept demonstration progress' }) }} />
  </section>;
}
