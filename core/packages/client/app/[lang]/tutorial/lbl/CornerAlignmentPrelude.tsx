'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { tr } from '@/i18n/tr';
import ReadingFit from '../components/ReadingFit';
import VideoProgress from '../components/VideoProgress';
import { CORNER_ALIGNMENT_COPY, LEFT, LESSON_STICKERING, RIGHT, lblDemoView } from './content';
import { usePlayerVisible } from './use-player-visible';

type Text = { zh: string; en: string };
type Beat = { at: number; caption: Text; stickers: readonly string[]; flash?: boolean };
type CornerAlignment = {
  alignment: string;
  alg: string;
  alignedSetup: string;
  hint: Text;
  left?: boolean;
  turnTimes: readonly number[];
  beats: readonly Beat[];
};

const flashInterval = 650;
const noStickers: readonly string[] = [];
const alignedSetup = (alg: string) => `(${alg})'`;

function sideAlignment(left: boolean): CornerAlignment {
  const alg = left ? LEFT : RIGHT;
  const white = left ? 'D0' : 'D2';
  const front = left ? 'F6' : 'F8';
  const pair = [front, 'F4'];
  return {
    alignment: left ? 'U d' : "U' d'",
    alg, alignedSetup: alignedSetup(alg), left,
    hint: left ? { zh: '做左公式', en: 'Do the left trigger' } : { zh: '做右公式', en: 'Do the right trigger' },
    turnTimes: [5900, 15100],
    beats: [
      { at: 0, caption: CORNER_ALIGNMENT_COPY.find, stickers: [white], flash: true },
      { at: 4200, caption: CORNER_ALIGNMENT_COPY.placeSide, stickers: [front], flash: true },
      { at: 8800, caption: { zh: '当前角块绿色朝前\n转下两层\n与绿色中心对齐', en: 'The corner’s green sticker faces front\nTurn the lower two layers\nMatch it with the green center' }, stickers: pair, flash: true },
      { at: 18200, caption: { zh: '绿格和绿心对齐了', en: 'The green sticker and center line up' }, stickers: pair },
    ],
  };
}

const whiteUpAlg = `(${RIGHT})3`;
const orangePair = ['R6', 'R4'];
const greenPair = ['F8', 'F4'];
export const CORNER_ALIGNMENTS: Readonly<Record<string, CornerAlignment | undefined>> = {
  'case-0': sideAlignment(false),
  'case-2': sideAlignment(true),
  'case-3': {
    alignment: 'U d',
    alg: whiteUpAlg,
    alignedSetup: alignedSetup(whiteUpAlg),
    hint: { zh: '做三遍右公式', en: 'Do the right trigger three times' },
    turnTimes: [5900, 10500],
    beats: [
      { at: 0, caption: CORNER_ALIGNMENT_COPY.find, stickers: ['D2'], flash: true },
      { at: 4200, caption: CORNER_ALIGNMENT_COPY.placeUp, stickers: ['D2'], flash: true },
      { at: 8800, caption: CORNER_ALIGNMENT_COPY.crossAlign, stickers: ['R6', 'F8'], flash: true },
      { at: 13300, caption: { zh: '前面的橙格\n对右边的橙心', en: 'Orange sticker at the front\nOrange center on the right' }, stickers: orangePair, flash: true },
      { at: 17700, caption: { zh: '右边的绿格\n对前面的绿心', en: 'Green sticker on the right\nGreen center at the front' }, stickers: greenPair, flash: true },
      { at: 22100, caption: CORNER_ALIGNMENT_COPY.crossAligned, stickers: [...orangePair, ...greenPair] },
    ],
  },
};

export default function CornerAlignmentPrelude({ lesson, sceneRot, onContinue }: {
  lesson: CornerAlignment;
  sceneRot: ReturnType<typeof lblDemoView>;
  onContinue: () => void;
}) {
  const { alignment, alignedSetup, turnTimes, beats } = lesson;
  const setup = `${alignedSetup} (${alignment})'`;
  const duration = beats[beats.length - 1].at;
  const root = useRef<HTMLDivElement>(null);
  const player = useRef<AlgPlayerHandle>(null);
  const clock = useRef(0);
  const appliedTurns = useRef(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [toolbar, setToolbar] = useState<Element | null>(null);
  const ready = usePlayerVisible(player, setup);
  const finished = ready && time >= duration;
  const beat = beats.findLast(item => time >= item.at) ?? beats[0];
  const flashStep = Math.floor((time - beat.at) / flashInterval);
  const hideOutline = beat.flash && !reducedMotion && flashStep < 4 && flashStep % 2 === 1;

  useEffect(() => {
    setToolbar(root.current?.closest('.lbl-learning')?.querySelector('.lbl-demo-toolbar') ?? null);
  }, []);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!ready || !playing || finished) return;
    let frame = 0;
    let previous: number | undefined;
    const tick = (now: number) => {
      if (!document.hidden) {
        clock.current = Math.min(duration, clock.current + Math.min(now - (previous ?? now), 50));
        const turn = appliedTurns.current;
        if (turn < turnTimes.length && clock.current >= turnTimes[turn]) {
          player.current?.playMove?.(turn);
          appliedTurns.current = turn + 1;
        }
      }
      previous = now;
      if (clock.current >= duration && !player.current?.isUserMovePending?.(false)) {
        setTime(duration);
        setPlaying(false);
        return;
      }
      setTime(Math.min(clock.current, duration - 1));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, playing, finished, duration, turnTimes]);

  const seek = (value: number) => {
    if (!ready) return;
    const handle = player.current;
    const adapter = handle?.getPlayer();
    appliedTurns.current = turnTimes.filter(at => value >= at).length;
    handle?.setAnimationPaused?.(false);
    if (adapter) adapter.timestamp = appliedTurns.current;
    clock.current = value;
    setTime(value);
    if (value >= duration) setPlaying(false);
  };

  return <div ref={root} className="lbl-content lbl-content-example lbl-special-case-prelude" data-tutorial-mode="timeline" data-tutorial-layout="A">
    <section className="lbl-demonstration">
      <div className="lbl-auto-player" data-visible={ready}>
        <AlgPlayer ref={player} puzzle="3x3" engine="sim" set={LESSON_STICKERING.corners}
          additionalStickering="centers-only" setup={setup} alg={alignment} orientation="z2" sceneRot={sceneRot}
          highlightedStickers={hideOutline ? noStickers : beat.stickers} controlMode="none" hideResetView lockView interactionMode="none" fillPane />
      </div>
    </section>
    <section className="lbl-explanation tutorial-single-caption" style={{ textAlign: 'center' }}><ReadingFit pane>
      <p className="lbl-lead">{tr(beat.caption)}</p>
      {finished && <button type="button" className="lbl-guide-continue lbl-guide-continue-hint" onClick={onContinue}>{tr({ zh: '点击继续', en: 'Click to continue' })}</button>}
    </ReadingFit></section>
    {toolbar && createPortal(<div className="lbl-cross-animation-progress"><VideoProgress time={time} duration={duration} playing={playing}
      onPlayingChange={next => {
        player.current?.setAnimationPaused?.(!next);
        setPlaying(next);
      }}
      onSeek={seek} onReplay={() => seek(0)} /></div>, toolbar)}
  </div>;
}
