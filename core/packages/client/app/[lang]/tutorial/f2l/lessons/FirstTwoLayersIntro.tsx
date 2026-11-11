'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Color } from 'three';
import { RotateCcw } from 'lucide-react';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import PlaybackBar from '@/components/PlaybackBar';
import { FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import type { CubeFace } from '@/lib/cube-colors';
import { tr } from '@/i18n/tr';
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
const ease = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

export default function FirstTwoLayersIntro({ orientation, method }: { orientation: string; method: 'lbl' | 'f2l' }) {
  const pairs = method === 'f2l';
  const segments = pairs ? F2L_INTRO_SEGMENTS : LBL_INTRO_SEGMENTS;
  const player = useRef<AlgPlayerHandle>(null);
  const [phase, setPhase] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [reduced, setReduced] = useState(false);
  const time = useRef(0), requested = useRef(0), actual = useRef(0);
  const tilt = useRef(0), yaw = useRef(0);
  const piece = useRef(0), focusAt = useRef(-1), holdAt = useRef(-1);
  const orbitAt = useRef(-1), orbitFrom = useRef(0), inspectionYaw = useRef(0);
  const [focusedPiece, setFocusedPiece] = useState(0);

  useEffect(() => {
    setReady(false);
    let raf = 0;
    const check = () => {
      if (!player.current?.getPlayer() || player.current.isUserMovePending?.()) { raf = requestAnimationFrame(check); return; }
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setReduced(preference); setReady(true); setPlaying(!preference && !document.hidden);
    };
    raf = requestAnimationFrame(check);
    return () => cancelAnimationFrame(raf);
  }, [generation]);

  useEffect(() => {
    if (!ready || !playing) return;
    let raf = 0, last = performance.now(), rendered = time.current;
    const advance = (next: number) => {
      time.current = 0; focusAt.current = holdAt.current = -1;
      orbitAt.current = -1; inspectionYaw.current = yaw.current;
      piece.current = next < 3 ? 0 : 4; setFocusedPiece(piece.current);
      setElapsed(0); setPhase(next);
    };
    const tick = (now: number) => {
      const delta = Math.min(100, now - last); last = now;
      if (document.hidden) { setPlaying(false); return; }
      const handle = player.current;
      // Step callbacks report the start of a move. Wait for its animation to
      // finish before marking progress or starting a camera-only shot.
      if (!handle?.isUserMovePending?.() && actual.current === requested.current) {
        setCompleted(actual.current);
        time.current += delta;
        const t = time.current;
        if (phase === 0 || phase === 2) {
          const arc = reduced ? 0 : ease((t - 1000) / 1500) - ease((t - 4500) / 1800);
          const pitch = -1.4 * arc, turn = inspectionYaw.current + (phase === 2 ? .45 * arc : 0);
          handle?.orbitView?.(turn - yaw.current, pitch - tilt.current);
          tilt.current = pitch; yaw.current = turn;
          if (t >= 7200) { advance(phase + 1); return; }
        } else if (phase === 1 || phase === 3) {
          if (t >= 1800) {
            const segment = segments[piece.current];
            if (orbitAt.current < 0) { orbitAt.current = t; orbitFrom.current = yaw.current; }
            const orbitDuration = reduced || Math.abs(segment.yaw - orbitFrom.current) < .001 ? 0 : 1600;
            const orbitProgress = orbitDuration ? ease((t - orbitAt.current) / orbitDuration) : 1;
            const turn = orbitFrom.current + (segment.yaw - orbitFrom.current) * orbitProgress;
            handle?.orbitView?.(turn - yaw.current, 0); yaw.current = turn;
            if (t - orbitAt.current < orbitDuration) {
              // Keep the solved piece visible during the slow orbit; focus the
              // next piece only once the new observation angle has settled.
            } else if (focusAt.current < 0) focusAt.current = t;
            else if (t - focusAt.current >= 3000) {
              if (requested.current < segment.end) handle?.playMove?.(requested.current++);
              else {
                if (holdAt.current < 0) holdAt.current = t;
                if (t - holdAt.current >= 1000) {
                  if (piece.current === (phase === 1 ? 3 : 7)) { advance(pairs ? 4 : phase + 1); return; }
                  piece.current += 1; setFocusedPiece(piece.current);
                  focusAt.current = holdAt.current = -1;
                  orbitAt.current = -1;
                }
              }
            }
          }
        } else {
          const finalYaw = (pairs ? -2 : -4) * Math.PI;
          const turn = inspectionYaw.current + (finalYaw - inspectionYaw.current) * (reduced ? 1 : ease((t - 1500) / 1600));
          handle?.orbitView?.(turn - yaw.current, 0); yaw.current = turn;
          if (t >= 5000) { setPlaying(false); return; }
        }
      }
      if (time.current - rendered >= 40) { rendered = time.current; setElapsed(rendered); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, ready, playing, reduced, pairs, segments]);

  const colors = useMemo(() => orientedCubeFaceColors(orientation), [orientation]);
  const cornerAlpha = phase === 0 ? 0 : phase === 1 ? ease(elapsed / 1400) : 1;
  const edgeAlpha = pairs ? cornerAlpha : phase < 3 ? 0 : phase === 3 ? ease(elapsed / 1400) : 1;
  const focusTime = elapsed - focusAt.current;
  const pulse = !reduced && (phase === 1 || phase === 3) && focusAt.current >= 0 && focusTime >= 0 && focusTime < 3000
    ? (1 + Math.cos(focusTime * Math.PI * 2 / 1000)) / 2 : 1;
  const target = segments[Math.min(focusedPiece, segments.length - 1)].stickers;
  const overrides = useMemo(() => Object.fromEntries([
    ...LBL_INTRO_CORNER_STICKERS.map(sticker => [sticker, cornerAlpha] as const),
    ...LBL_INTRO_EDGE_STICKERS.map(sticker => [sticker, edgeAlpha] as const),
  ].map(([sticker, alpha]) => [sticker, new Color(FM_FIXED_COLOR[FM_IGNORED]!).lerp(new Color(colors[sticker[0] as CubeFace]), alpha * (target.includes(sticker) ? pulse : 1)).getStyle()])), [colors, cornerAlpha, edgeAlpha, target, pulse]);
  const reset = () => {
    setPlaying(false); setReady(false); setPhase(0); setElapsed(0); setCompleted(0);
    time.current = requested.current = actual.current = tilt.current = yaw.current = 0;
    piece.current = 0; focusAt.current = holdAt.current = -1; setFocusedPiece(0);
    orbitAt.current = -1; orbitFrom.current = inspectionYaw.current = 0;
    setGeneration(value => value + 1);
  };
  const progress = phase === 0 ? elapsed / 7200 : pairs ? (phase === 4 ? 3 : 1 + completed / segments[3].end) : phase < 3
    ? 1 + (phase === 2 ? 1 : completed / segments[3].end)
    : 2 + (phase === 4 ? 1 : (completed - segments[3].end) / (segments[7].end - segments[3].end));
  const caption = pairs && phase === 1 ? { zh: '每次一起复原一组棱角', en: 'Solve one corner–edge pair at a time' }
    : pairs && phase === 4 ? { zh: '四组棱角归位，前两层完成', en: 'All four pairs are in place — the first two layers are complete' } : captions[phase];
  const progressSegments = pairs ? [...segments, ...segments] : [...segments.slice(4), ...segments.slice(0, 4)];
  return <section className="f2l-concept-video f2l-lbl-intro" data-continuous="true" aria-label={pairs ? 'F2L' : tr({ zh: '层先法的前两层', en: 'The first two layers with LBL' })}>
    <div className="f2l-concept-count">{phase === 0 ? 1 : phase < 3 ? 2 : 3} / 3</div>
    <div className="f2l-concept-scene">
      <div className="f2l-cube">
        <AlgPlayer key={generation} ref={player} puzzle="3x3" engine="sim" set="f2l-overview"
          setup={LBL_INTRO_VIDEO_SETUP} alg={pairs ? F2L_INTRO_VIDEO_ALG : LBL_INTRO_VIDEO_ALG} orientation={orientation} sceneRot={view}
          fillPane controlMode="none" hideResetView interactionMode="none"
          moveDurationMs={350}
          stickerColorOverrides={overrides} onStepChange={step => { actual.current = step; }} />
      </div>
      <div className="f2l-concept-caption" aria-live="polite">
        <p>{tr(caption)}</p>
        <div className="f2l-practice-segments" aria-label={tr({ zh: '逐块还原进度', en: 'Piece-by-piece progress' })}>
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
    <PlaybackBar step={Math.min(3, progress)} total={3} playing={playing} disabled={!ready}
      onScrub={() => {}} onSkipStart={reset} onStepBack={() => {}} onStepForward={() => {}} onSkipEnd={() => {}}
      onTogglePlay={() => phase === 4 && elapsed >= 4900 ? reset() : setPlaying(value => !value)}
      trailing={<button type="button" className="playback-bar-btn" onClick={reset} aria-label={tr({ zh: '重新播放', en: 'Replay' })}><RotateCcw size={15} aria-hidden="true" /></button>}
      labels={{ play: tr({ zh: '播放', en: 'Play' }), pause: tr({ zh: '暂停', en: 'Pause' }), scrub: tr({ zh: '演示进度', en: 'Demonstration progress' }) }} />
  </section>;
}
