'use client';

import ReadingFit from '../../components/ReadingFit';

import ChatBubble from '@/components/ChatBubble';
import { AlgFormulaReadRow } from '@/components/AlgFormulaRow';
import { VisualCube } from '@/components/VisualCube';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Color } from 'three';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { resolveSimPreviewMoves } from '@/components/AlgPlayer/player-setup';
import { FM_FIXED_COLOR, FM_IGNORED, stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import ProgressSlider from '@/components/ProgressSlider';
import VideoControls from '../../components/VideoControls';
import VideoStage from '../components/VideoStage';
import TerminologySummary from '../components/TerminologySummary';
import NonstandardSummary from '../components/NonstandardSummary';
import TrainingFeedbackOverlay from '@/components/TrainingFeedbackOverlay';
import { tr, T } from '@/i18n/tr';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import type { CubeFace } from '@/lib/cube-colors';
import { nonstandardIntroScenes, NONSTANDARD_INTRO_PAIR_STICKERS, TERMINOLOGY_OUTRO_MS, type NonstandardIntroScene } from '../data/nonstandard-intro';
import type { LocalizedText } from '../data/chapters';
import { f2lDiagramFacelets } from '../lib/cube-preview';
import './nonstandard-intro.css';

const frontRight = { x: Math.PI / 8, y: -Math.PI / 5, z: 0 };
const frontLeft = { ...frontRight, y: Math.PI / 7 };
function sceneYawAt(scene: NonstandardIntroScene, time: number): number {
  const turn = scene.viewTurn;
  if (!turn) return scene.viewYaw ?? 0;
  const t = Math.max(0, Math.min(1, (time - turn.start) / turn.duration));
  return turn.from + (turn.to - turn.from) * t * t * (3 - 2 * t);
}
function sceneInitialView(scene: NonstandardIntroScene) {
  if (scene.viewTurn || scene.viewYaw !== undefined) return { ...frontRight, y: frontRight.y + sceneYawAt(scene, 0) };
  return scene.leftView ? frontLeft : frontRight;
}
const noHighlights: readonly string[] = [];
const pairMask = stickeringMaskFn(3, 'F2LPair')!;
const pairStickering = () => pairMask;
const edgeStickering = () => (initial: number, face: number) => initial === 20 ? FM_IGNORED : pairMask(initial, face);
const cornerStickering = () => (initial: number, face: number) => initial === 23 ? FM_IGNORED : pairMask(initial, face);
const crossMask = () => (initial: number, face: number) => initial === 20 || initial === 23 ? FM_IGNORED : pairMask(initial, face);

export default function NonstandardIntro({ orientation, edgeSetup = '', cornerSetup = '', onComplete, terminologyOnly = false, scenes: suppliedScenes, title, showSceneNumber = false, compactReference = false }: {
  orientation: string; edgeSetup?: string; cornerSetup?: string; onComplete?: (complete: boolean) => void; terminologyOnly?: boolean;
  scenes?: readonly NonstandardIntroScene[]; title?: LocalizedText; showSceneNumber?: boolean; compactReference?: boolean;
}) {
  const scenes = useMemo(() => suppliedScenes ?? nonstandardIntroScenes(edgeSetup, cornerSetup, orientation, terminologyOnly),
    [suppliedScenes, edgeSetup, cornerSetup, orientation, terminologyOnly]);
  const player = useRef<AlgPlayerHandle>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlayingState] = useState(true);
  const playingRef = useRef(true);
  const setPlaying = useCallback((value: boolean) => {
    playingRef.current = value;
    setPlayingState(value);
    player.current?.setAnimationPaused?.(!value);
  }, []);
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
  const [cubeVisibility, setCubeVisibility] = useState(1);
  const [stageTransition, setStageTransition] = useState(false);
  const [stageVisibility, setStageVisibility] = useState(1);
  const pairFrame = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const appliedMove = useRef(-1);
  const playerStep = useRef(0);
  const viewTilt = useRef(0);
  const viewYaw = useRef(0);
  const pendingTime = useRef<number | null>(null);
  const scrubbing = useRef(false);
  const resumeAfterScrub = useRef(false);
  const offsets = useMemo(() => {
    const times = [0];
    for (const shot of scenes) times.push(times[times.length - 1] + shot.duration);
    return times;
  }, [scenes]);
  const index = position;
  const finished = index === scenes.length - 1 && sceneDone;
  const scene = scenes[index];
  const referenceFacelets = useMemo(() => scene.reference ? f2lDiagramFacelets(scene.reference.setup, orientation) : undefined,
    [scene.reference, orientation]);
  const outroStart = terminologyOnly && index === scenes.length - 1 ? scene.duration - TERMINOLOGY_OUTRO_MS : Infinity;
  const outroTime = Math.max(0, elapsed - outroStart);
  const sceneOpacity = reducedMotion ? Number(outroTime === 0) : 1 - Math.min(1, outroTime / 600);
  const summaryOpacity = reducedMotion ? Number(outroTime > 0) : Math.max(0, Math.min(1, (outroTime - 800) / 600));
  const beat = scene.beats?.findLast(item => elapsed >= item.at);
  const moveCount = useMemo(() => resolveSimPreviewMoves('3x3', scene.alg).length, [scene.alg]);
  const applyTime = useCallback((time: number) => {
    if (scene.comparisonSummary) {
      elapsedRef.current = time;
      setElapsed(time);
      setSceneDone(time >= scene.duration);
      return;
    }
    const handle = player.current;
    const instance = handle?.getPlayer();
    if (!handle || !instance) return;
    const completed = Math.min(moveCount, Math.max(0,
      Math.floor((time - (scene.moveStart ?? 500)) / (scene.moveGap ?? 100)) + 1));
    instance.timestamp = completed;
    if (scene.viewTurn || scene.viewYaw !== undefined) {
      const yaw = sceneYawAt(scene, time);
      handle.orbitView?.(yaw - viewYaw.current, 0);
      viewYaw.current = yaw;
    }
    appliedMove.current = completed - 1;
    playerStep.current = completed;
    elapsedRef.current = time;
    setElapsed(time);
    setSceneDone(time >= scene.duration);
  }, [moveCount, scene]);
  const pairColors = useMemo(() => {
    if (!pairTransition && !scene.flashPair) return undefined;
    const colors = orientedCubeFaceColors(orientation);
    const visibility = pairTransition ? pairVisibility : scene.fadeInPair && elapsed < 650 && !reducedMotion ? elapsed / 650 : reducedMotion ? 1
      : (1 + Math.cos((elapsed - (beat?.at ?? 0)) * Math.PI / 350)) / 2;
    return Object.fromEntries(NONSTANDARD_INTRO_PAIR_STICKERS.map(sticker => [sticker,
      new Color(FM_FIXED_COLOR[FM_IGNORED]!).lerp(new Color(colors[sticker[0] as CubeFace]),
        (beat?.hideCorner && ['D2', 'F8', 'R6'].includes(sticker)) || (beat?.hideEdge && ['F5', 'R3'].includes(sticker)) ? 0 : visibility).getStyle(),
    ]));
  }, [orientation, pairTransition, pairVisibility, scene.flashPair, scene.fadeInPair, reducedMotion, playing, elapsed, beat]);
  const fade = useCallback((from: number, to: number, update: (value: number) => void, done: () => void) => {
    let last = performance.now(), elapsed = 0;
    const tick = (now: number) => {
      const delta = Math.min(100, now - last); last = now;
      if (!playingRef.current || scrubbing.current || document.hidden) { pairFrame.current = requestAnimationFrame(tick); return; }
      elapsed += delta;
      const progress = reducedMotion ? 1 : Math.min(1, elapsed / 450);
      update(from + (to - from) * progress * progress * (3 - 2 * progress));
      if (progress < 1) pairFrame.current = requestAnimationFrame(tick);
      else { pairFrame.current = null; done(); }
    };
    pairFrame.current = requestAnimationFrame(tick);
  }, [reducedMotion]);
  useEffect(() => () => { if (pairFrame.current !== null) cancelAnimationFrame(pairFrame.current); }, []);
  useEffect(() => {
    if (ready && pairTransition && pairVisibility === 0 && pairFrame.current === null) {
      fade(0, 1, setPairVisibility, () => setPairTransition(false));
    }
    if (ready && fadingOut && cubeVisibility === 0 && pairFrame.current === null) {
      fade(0, 1, setCubeVisibility, () => setFadingOut(false));
    }
    if (ready && stageTransition && stageVisibility === 0 && pairFrame.current === null) {
      fade(0, 1, setStageVisibility, () => setStageTransition(false));
    }
  }, [ready, pairTransition, pairVisibility, fadingOut, cubeVisibility, stageTransition, stageVisibility, fade]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update(); preference.addEventListener('change', update);
    if (preference.matches || document.hidden) setPlaying(false);
    const pauseHidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', pauseHidden);
    return () => { preference.removeEventListener('change', update); document.removeEventListener('visibilitychange', pauseHidden); };
  }, [setPlaying]);

  useEffect(() => { player.current?.setAnimationPaused?.(!playing || scrubbing.current); }, [playing, ready, generation]);

  useEffect(() => { onComplete?.(finished); }, [finished, onComplete]);
  useEffect(() => {
    setReady(false);
    // Keep the requested slider position while a cross-shot seek loads its cube.
    elapsedRef.current = pendingTime.current ?? 0; setElapsed(elapsedRef.current);
    appliedMove.current = -1; playerStep.current = 0;
    viewTilt.current = 0;
    viewYaw.current = sceneYawAt(scene, 0);
    // A static closing shot must also be seekable before its hidden player mounts.
    if (scene.comparisonSummary) {
      setReady(true);
      applyTime(pendingTime.current ?? 0);
      pendingTime.current = null;
      return;
    }
    let frame = 0;
    const check = () => {
      if (!player.current?.getPlayer() || player.current.isUserMovePending?.()) {
        frame = requestAnimationFrame(check); return;
      }
      setReady(true);
      if (pendingTime.current !== null) {
        applyTime(pendingTime.current);
        pendingTime.current = null;
      }
    };
    frame = requestAnimationFrame(check);
    return () => cancelAnimationFrame(frame);
  }, [index, orientation, generation, applyTime]);

  useEffect(() => {
    if (!ready || !playing || sceneDone || fadingOut || pairTransition || stageTransition) return;
    let frame = 0, last = performance.now(), lastRendered = elapsedRef.current;
    const tick = (now: number) => {
      const delta = Math.min(now - last, 100); last = now;
      if (document.hidden) { setPlaying(false); return; }
      // Wait for real turns to finish; paused/loading time does not consume a shot.
      const pending = !scene.comparisonSummary && (player.current?.isUserMovePending?.()
        || (appliedMove.current >= 0 && playerStep.current !== appliedMove.current + 1));
      if (!pending) {
        elapsedRef.current += delta;
        if (scene.viewTurn) {
          const yaw = sceneYawAt(scene, elapsedRef.current);
          player.current?.orbitView?.(yaw - viewYaw.current, 0);
          viewYaw.current = yaw;
        }
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
          lastRendered = elapsedRef.current;
          setElapsed(lastRendered);
          appliedMove.current += 1;
          player.current?.playMove?.(appliedMove.current);
        } else if (elapsedRef.current >= scene.duration) {
          elapsedRef.current = scene.duration; setElapsed(scene.duration);
          setSceneDone(true);
          if (index === scenes.length - 1) setPlaying(false);
          return;
        }
      }
      if (elapsedRef.current - lastRendered >= (scene.flashPair || elapsedRef.current >= outroStart ? 16 : 100)) {
        lastRendered = elapsedRef.current; setElapsed(lastRendered);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, playing, sceneDone, fadingOut, pairTransition, stageTransition, scene, moveCount, outroStart, index, scenes.length, setPlaying]);

  const seek = useCallback((next: number) => {
    if (fadingOut || pairTransition || stageTransition || !ready) return;
    const target = Math.max(0, Math.min(scenes.length - 1, Math.round(next)));
    const fadePieces = (!!scenes[target].result || scenes[target].fadePairTransition) && target !== index;
    const keepPlayer = fadePieces || (target === index + 1 && (sceneDone || moveCount === 0) && scenes[target].continuePrevious === true);
    setContinuous(keepPlayer);
    const enterScene = () => {
      setReady(false); setSceneDone(false);
      setPosition(target);
      if (!keepPlayer) {
        setInitialView(sceneInitialView(scenes[target]));
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
      fade(from, 0, setPairVisibility, enterScene);
      return;
    }
    if (scenes[target].comparisonSummary && target !== index) {
      setStageTransition(true);
      fade(1, 0, setStageVisibility, enterScene);
      return;
    }
    // Continuous shots reuse the mounted renderer and never hide the cube.
    if (keepPlayer) { enterScene(); return; }
    setFadingOut(true);
    // Keep the old cube mounted until it has faded out, then wait for the new
    // renderer to be ready before revealing it.
    fade(1, 0, setCubeVisibility, enterScene);
  }, [ready, scenes, scene, index, sceneDone, moveCount, pairTransition, fadingOut, stageTransition, fade]);
  useEffect(() => {
    if (playing && sceneDone && !finished && !scrubbing.current) seek(index + 1);
  }, [playing, sceneDone, finished, index, seek]);
  const seekTime = (time: number) => {
    if (pairFrame.current !== null) cancelAnimationFrame(pairFrame.current);
    pairFrame.current = null;
    setPairTransition(false);
    setFadingOut(false);
    setCubeVisibility(1);
    setStageTransition(false);
    setStageVisibility(1);
    setPlaying(false);
    const target = Math.max(0, offsets.slice(0, -1).findLastIndex(offset => offset <= time));
    const localTime = time - offsets[target];
    if (target === index && ready) {
      applyTime(localTime);
      return;
    }
    pendingTime.current = localTime;
    setElapsed(localTime);
    setSceneDone(false);
    if (target === index) return;
    setReady(false);
    setContinuous(false);
    setInitialView(sceneInitialView(scenes[target]));
    setPosition(target);
    setGeneration(value => value + 1);
  };
  const replay = () => {
    seekTime(0);
    pendingTime.current = 0;
    setPlaying(true);
    setReady(false);
    setContinuous(false);
    setInitialView(frontRight);
    setGeneration(value => value + 1);
  };
  const emphasis = beat?.highlight ?? scene.highlight;
  const pulse = beat ? beat.pulse : true;
  const highlights = scene.flashPair ? noHighlights : !pulse || reducedMotion || Math.floor((elapsed - (beat?.at ?? 0)) / 900) % 2 === 0 ? emphasis : noHighlights;
  const captionLines = tr(beat?.caption ?? scene.caption).split('\n');
  const captionStart = beat?.at ?? 0;
  const captionEnd = scene.beats?.find(item => item.at > captionStart)?.at ?? scene.duration;
  const compactCaption = captionLines[Math.min(captionLines.length - 1, Math.floor(Math.max(0, elapsed - captionStart) / Math.max(1, captionEnd - captionStart) * captionLines.length))];
  return <section className={`f2l-concept-video${compactReference ? ' f2l-treatment-video' : ''}`} data-playing={playing} data-continuous={continuous} aria-label={tr(title ?? (terminologyOnly
    ? { zh: '术语介绍', en: 'Terminology' }
    : { zh: '标态与非标概念演示', en: 'Standard and non-standard cases: concept demonstration' }))}>
    <VideoStage>
    <div className="f2l-concept-scene f2l-terminology-stage" data-tutorial-mode="timeline" data-tutorial-layout={scene.comparisonSummary || summaryOpacity > 0 ? 'F' : scene.reference ? 'C' : scene.displayAlg ? 'B' : 'A'} data-note-visible={!!scene.bubble && elapsed >= (scene.bubbleAt ?? 0) && elapsed < (scene.bubbleAt ?? 0) + 2400} data-summary-part={elapsed < scene.duration / 2 ? 'paths' : 'caption'} data-summary={!!scene.comparisonSummary} style={{ opacity: stageVisibility }}>
      {showSceneNumber && <span className="f2l-concept-scene-number"><T zh="画面" en="Scene" /> {index + 1}/{scenes.length}</span>}
      <div className="f2l-cube f2l-concept-cube" style={{ opacity: sceneOpacity * cubeVisibility }} aria-hidden={sceneOpacity === 0} data-visible={ready || continuous}><AlgPlayer key={`${orientation}:${generation}`} ref={player} puzzle="3x3" engine="sim" set="f2l-tutorial"
        setup={scene.setup} startSolved={!scene.setup.trim()} alg={scene.alg} orientation={orientation} sceneRot={initialView}
        stickerColorOverrides={pairColors}
        highlightedStickers={highlights} stickeringAtStep={scene.hidePair || scene.crossOnly ? crossMask : beat?.hideCorner ? edgeStickering : beat?.hideEdge ? cornerStickering : pairStickering}
        onStepChange={step => { playerStep.current = step; }}
        moveDurationMs={scene.moveDuration ?? 220} controlMode="none" hideResetView interactionMode="none" fillPane />
        {ready && !pairTransition && elapsed >= (scene.bubbleAt ?? 0) && scene.bubble && <ChatBubble
          tail={scene.bubbleTarget === 'edge' ? 'left' : 'bottom'} className="f2l-concept-comparison"
          data-target={scene.bubbleTarget} role="status">{tr(scene.bubble)}</ChatBubble>}
        {ready && !fadingOut && (scene.result ? elapsed >= 1000 : beat?.label) && <ChatBubble tail={scene.flashPair ? 'bottom' : beat?.label ? 'top' : 'left'} className="f2l-concept-result" data-target={scene.flashPair ? beat?.hideEdge ? 'corner' : beat?.hideCorner ? 'edge' : 'pair' : beat?.label ? 'slot' : undefined} role="status">
          {scene.result ? <>
            <div className="f2l-concept-signal" aria-hidden="true"><TrainingFeedbackOverlay
              kind={scene.result === 'standard' ? 'correct' : 'wrong'} correctLabel="" wrongLabel="" /></div>
            {scene.result === 'standard' ? <T zh="标态" en="Standard" /> : <T zh="非标" en="Non-standard" />}
          </> : beat?.label && tr(beat.label)}
        </ChatBubble>}
      </div>
      <div className={`f2l-concept-caption${!scene.displayAlg && !scene.reference ? ' tutorial-single-caption' : ''}`} style={{ opacity: sceneOpacity }} aria-hidden={sceneOpacity === 0} aria-live="polite" aria-atomic="true"><ReadingFit pane>
        <div className="f2l-concept-explanation">
          <p key={tr(beat?.caption ?? scene.caption)} className="f2l-concept-line"><span className="f2l-shot-full-caption">{tr(beat?.caption ?? scene.caption)}</span><span className="f2l-shot-compact-caption">{compactCaption}</span></p>
          {scene.displayAlg && <code>{scene.displayAlg}</code>}
        </div>
        {scene.reference && referenceFacelets && <figure className="f2l-concept-reference" data-site-surface="panel">
          <VisualCube local view="iso" size={120} faceletColors={referenceFacelets} alt={tr(scene.reference.label)} />
          <figcaption>
            <strong>{tr(scene.reference.label)}</strong>
            {scene.reference.alg && <AlgFormulaReadRow>{scene.reference.segments
              ? scene.reference.segments.map((segment, part, segments) => <span key={part} className="f2l-reference-segment"
                data-active={scene.activeReferenceSegment === part && !pairTransition && !sceneDone}>
                ({segment}){part < segments.length - 1 ? ' ' : ''}
              </span>)
              : scene.reference.alg}</AlgFormulaReadRow>}
          </figcaption>
        </figure>}
      </ReadingFit></div>
      {scene.comparisonSummary && <div className="tutorial-video-reading" data-tutorial-layout="F"><ReadingFit>
        <NonstandardSummary states={scene.comparisonSummary} orientation={orientation} caption={scene.caption} />
      </ReadingFit></div>}
      {summaryOpacity > 0 && <div className="tutorial-video-reading" data-tutorial-layout="F"><ReadingFit><div className="f2l-terminology-summary" style={{ opacity: summaryOpacity }} role="status">
        <TerminologySummary orientation={orientation} />
      </div></ReadingFit></div>}
    </div>
    </VideoStage>
    <div className="f2l-intro-progress">
      <ProgressSlider value={offsets[index] + elapsed} max={offsets[offsets.length - 1]} keyboardStep={500}
        onChange={seekTime}
        onInteractionStart={() => {
          if (scrubbing.current) return;
          resumeAfterScrub.current = !finished && playingRef.current;
          scrubbing.current = true; setPlaying(false);
        }}
        onInteractionEnd={() => {
          scrubbing.current = false;
          setPlaying(resumeAfterScrub.current && !finished);
        }}
        formatValue={value => tr({ zh: `${(value / 1000).toFixed(1)} 秒`, en: `${(value / 1000).toFixed(1)} seconds` })}
        ariaLabel={tr({ zh: '概念演示播放进度', en: 'Concept demonstration progress' })} />
      <VideoControls playing={playing && !finished}
        onTogglePlay={() => { if (finished) replay(); else setPlaying(!playingRef.current); }} onReplay={replay} />
    </div>
  </section>;
}
