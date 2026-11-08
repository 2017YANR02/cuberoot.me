'use client';

import StackmatPadControls, { type StackmatPadHost } from './StackmatPadControls';
import { usesStackmatPads, effectiveStackmatInput } from '@/components/stackmat-catalog';
import { SegmentTime } from '@cuberoot/timer-ui';
import SpeedStacksDisplayIcon from '@/components/SpeedStacksDisplayIcon';
import StackmatTimerArtwork from '@/components/StackmatTimerArtwork';
import type { StackmatGeneration } from '@/components/stackmat-catalog';
import { useSettings } from '../_lib/settings';
import './timer-readout.css';

/** Shared artwork and contact inputs; the host timer owns time, penalties and precision. */
export default function TimerReadout({ text, padHost }: { text: string; padHost?: StackmatPadHost }) {
  const settings = useSettings();
  const { timerDisplayMode, stackmatSkin } = settings;
  const stackmatInputMode = effectiveStackmatInput(settings);
  const pads = usesStackmatPads(settings) && padHost;
  if (timerDisplayMode === 'digits') return <SegmentTime text={text} />;
  if (timerDisplayMode.startsWith('stackmat-g')) return <span className="timer-stackmat-readout timer-g5-readout" role={pads ? undefined : "img"} aria-label={text}>
    <StackmatTimerArtwork generation={Number(timerDisplayMode.slice(-1)) as StackmatGeneration} indicator={padHost?.indicator} skin={stackmatSkin} padMode={stackmatInputMode === '2-pad' ? '2-pad' : '4-pad'} displayValue={text} digitColor="var(--stackmat-digit-color, #4d594c)" aria-hidden="true" />
    {pads && <StackmatPadControls generation={Number(timerDisplayMode.slice(-1)) as StackmatGeneration} mode={stackmatInputMode === '4-pad' ? '4-pad' : '2-pad'} host={pads}/>}
  </span>;
  const numeric = /^[\d.:+\-]*$/.test(text);
  return <span className="timer-stackmat-readout" role="img" aria-label={text}>
    <SpeedStacksDisplayIcon displayValue={numeric ? text : ''} digitColor="var(--stackmat-digit-color, #ff172b)" />
    {!numeric && <span className="timer-stackmat-status">{text}</span>}
  </span>;
}
