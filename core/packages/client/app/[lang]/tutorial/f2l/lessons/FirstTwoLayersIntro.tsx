'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Color } from 'three';
import { RotateCcw } from 'lucide-react';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import PlaybackBar from '@/components/PlaybackBar';
import ChatBubble from '@/components/ChatBubble';
import { FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import type { CubeFace } from '@/lib/cube-colors';
import { tr } from '@/i18n/tr';
import { syncPlayerToMoveCount } from '@/lib/recon-alg-utils';
import { createIntroTimeline, introFrame, INTRO_CROSS_MS, INTRO_INSPECTION_RETURN_MS } from '../lib/intro-timeline';
import { LBL_INTRO_SEGMENTS, F2L_INTRO_SEGMENTS, F2L_INTRO_VIDEO_ALG, LBL_INTRO_VIDEO_ALG, LBL_INTRO_VIDEO_SETUP, LBL_INTRO_CORNER_STICKERS, LBL_INTRO_EDGE_STICKERS } from '../data/lbl-intro';
import './nonstandard-intro.css';
import './algorithm-practice.css';
import './lbl-intro.css';

const view = { x: Math.PI / 8, y: -Math.PI / 5, z: 0 };
const captions = [
  { zh: '以完成底十字为起点', en: 'Start with the bottom cross solved' },
  { zh: '先复原四个底层角块', en: 'First, solve the four bottom-layer corners' },
  { zh: '四个角块归位，底层完成', en: 'All four corners are in place — the first layer is complete' },
  { zh: '再复原四个中层棱块', en: 'Then solve the four middle-layer edges' },
  { zh: '先角块，后棱块，前两层就完成了', en: 'Corners first, then edges — the first two layers are complete' },
];
export default function FirstTwoLayersIntro({ orientation, method, comparisonStage, comparisonClock, seekVersion = 0, controlledPlaying, onReady }: {
  orientation: string; method: 'lbl' | 'f2l'; comparisonStage?: 'cross' | 'split' | 'compare';
  comparisonClock?: RefObject<number>; seekVersion?: number; controlledPlaying?: boolean; onReady?: () => void;
}) {
  const comparison = comparisonStage !== undefined;
  const pairs = method === 'f2l';
  const segments = pairs ? F2L_INTRO_SEGMENTS : LBL_INTRO_SEGMENTS;
  const player = useRef<AlgPlayerHandle>(null);
  const timeline = useMemo(() => createIntroTimeline(method, comparison), [method, comparison]);
  const [frame, setFrame] = useState(() => introFrame(timeline, 0, false));
  const [playing, setPlaying] = useState(false);
  const running = controlledPlaying ?? playing;
  const [ready, setReady] = useState(false);
  const [replayVersion, setReplayVersion] = useState(0);
  const [reduced, setReduced] = useState(false);
  const localClock = useRef(0);
  const clock = comparisonClock ?? localClock;
  const requested = useRef(-1);
  const tilt = useRef(0), yaw = useRef(0);
  const pendingSeek = useRef(false);
  const { phase, step: completed, cornerAlpha, edgeAlpha, pulse } = frame;

  useEffect(() => {
    setReady(false);
    let raf = 0;
    const check = () => {
      if (!player.current?.getPlayer() || player.current.isUserMovePending?.()) { raf = requestAnimationFrame(check); return; }
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setReduced(preference); setReady(true); setPlaying(!preference && !document.hidden);
      onReady?.();
    };
    raf = requestAnimationFrame(check);
    return () => cancelAnimationFrame(raf);
  }, [onReady]);

  useEffect(() => {
    pendingSeek.current = true;
  }, [seekVersion, replayVersion]);

  useEffect(() => {
    if (!ready) return;
    let raf = 0, last = performance.now(), rendered = -Infinity, renderedTime = NaN;
    const tick = (now: number) => {
      const delta = Math.min(50, now - last); last = now;
      if (document.hidden) setPlaying(false);
      const handle = player.current;
      if (!comparison && running && !document.hidden && !pendingSeek.current) {
        clock.current = Math.min(timeline.duration, clock.current + delta);
      }
      // The preloaded right cube stays at home until the opening shot ends.
      const t = comparison && pairs && clock.current < INTRO_CROSS_MS ? 0 : clock.current;
      const next = introFrame(timeline, t, reduced);
      if (pendingSeek.current) {
        syncPlayerToMoveCount(handle?.getPlayer(), next.step);
        requested.current = next.step - 1;
        pendingSeek.current = false;
        // Seek both scenes before either starts its next move. Sequential
        // playback then uses playMove without resetting the shared engine.
      } else if (running && !document.hidden && next.move !== undefined && next.move > requested.current) {
        handle?.playMove?.(next.move);
        requested.current = next.move;
      }
      if (next.yaw !== yaw.current || next.pitch !== tilt.current) handle?.orbitView?.(next.yaw - yaw.current, next.pitch - tilt.current);
      yaw.current = next.yaw; tilt.current = next.pitch;
      if (next.time !== renderedTime && now - rendered >= 40) { rendered = now; renderedTime = next.time; setFrame(next); }
      if (!comparison && clock.current >= timeline.duration) setPlaying(false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, running, reduced, pairs, comparison, clock, timeline]);

  const colors = useMemo(() => orientedCubeFaceColors(orientation), [orientation]);
  const target = segments[Math.min(frame.piece, segments.length - 1)].stickers;
  const overrides = useMemo(() => Object.fromEntries([
    ...LBL_INTRO_CORNER_STICKERS.map(sticker => [sticker, cornerAlpha] as const),
    ...LBL_INTRO_EDGE_STICKERS.map(sticker => [sticker, edgeAlpha] as const),
  ].map(([sticker, alpha]) => [sticker, new Color(FM_FIXED_COLOR[FM_IGNORED]!).lerp(new Color(colors[sticker[0] as CubeFace]), alpha * (target.includes(sticker) ? pulse : 1)).getStyle()])), [colors, cornerAlpha, edgeAlpha, target, pulse]);
  const reset = () => {
    localClock.current = 0; setPlaying(true);
    setReplayVersion(value => value + 1);
  };
  const caption = comparisonStage === 'compare' ? (pairs ? { zh: 'F2L', en: 'F2L' } : { zh: '层先法', en: 'LBL' })
    : comparison && frame.time >= INTRO_INSPECTION_RETURN_MS
      ? { zh: '看看层先法和 F2L 各自怎么完成前两层', en: 'Let’s see how LBL and F2L each solve the first two layers' }
    : pairs && phase === 1 ? { zh: '每次一起复原一组棱角', en: 'Solve one corner–edge pair at a time' }
    : pairs && phase === 4 ? { zh: '四组棱角归位，前两层完成', en: 'All four pairs are in place — the first two layers are complete' } : captions[phase];
  const progressSegments = pairs ? [...segments, ...segments] : [...segments.slice(4), ...segments.slice(0, 4)];
  return <section className="f2l-concept-video f2l-lbl-intro" data-continuous="true" aria-label={pairs ? 'F2L' : tr({ zh: '层先法的前两层', en: 'The first two layers with LBL' })}>
    <div className="f2l-concept-scene">
      <div className="f2l-cube">
        <AlgPlayer ref={player} puzzle="3x3" engine="sim" set="f2l-overview"
          setup={LBL_INTRO_VIDEO_SETUP} alg={pairs ? F2L_INTRO_VIDEO_ALG : LBL_INTRO_VIDEO_ALG} orientation={orientation} sceneRot={view}
          fillPane controlMode="none" hideResetView interactionMode="none"
          moveDurationMs={timeline.moveMs}
          stickerColorOverrides={overrides} />
        {comparisonStage === 'compare' && pairs && phase === 4 && <ChatBubble tail="bottom" className="f2l-intro-result" role="status">
          {tr({ zh: '同时复原前2层，更高效', en: 'Solve the first two layers together, more efficiently' })}
        </ChatBubble>}
      </div>
      <div className="f2l-concept-caption" aria-live="polite">
        <p>{tr(caption)}</p>
        <div className="f2l-practice-segments" aria-hidden={comparison && comparisonStage !== 'compare'} aria-label={tr({ zh: '逐块还原进度', en: 'Piece-by-piece progress' })}>
          {progressSegments.map((segment, index) => {
            const fraction = Math.max(0, Math.min(1, (completed - segment.start) / (segment.end - segment.start)));
            const label = tr(index < 4 ? { zh: `棱 ${index + 1}`, en: `Edge ${index + 1}` } : { zh: `角 ${index - 3}`, en: `Corner ${index - 3}` });
            return <div className="f2l-practice-segment" key={index} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)} aria-label={label}>
              <span className={fraction === 1 ? 'is-complete' : undefined} data-active={fraction > 0 && fraction < 1}>{label}
                <span className="f2l-practice-segment-progress" aria-hidden="true" style={{ width: `${fraction * 100}%` }} />
              </span>
            </div>;
          })}
        </div>
      </div>
    </div>
    {!comparison && <PlaybackBar step={frame.time} total={timeline.duration} playing={playing} disabled={!ready}
      onScrub={() => {}} onSkipStart={reset} onStepBack={() => {}} onStepForward={() => {}} onSkipEnd={() => {}}
      onTogglePlay={() => frame.time >= timeline.duration ? reset() : setPlaying(value => !value)}
      trailing={<button type="button" className="playback-bar-btn" onClick={reset} aria-label={tr({ zh: '重新播放', en: 'Replay' })}><RotateCcw size={15} aria-hidden="true" /></button>}
      labels={{ play: tr({ zh: '播放', en: 'Play' }), pause: tr({ zh: '暂停', en: 'Pause' }), scrub: tr({ zh: '演示进度', en: 'Demonstration progress' }) }} />}
  </section>;
}
