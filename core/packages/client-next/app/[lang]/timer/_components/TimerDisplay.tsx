'use client';

import { formatMs } from '../_lib/stats';
import type { TimerPhase } from '../_lib/useTimer';
import { useSettings } from '../_lib/settings';

interface Props {
  phase: TimerPhase;
  displayMs: number;
  inspectionDisplayMs: number;
  /** Last solve's effective penalty for color hint after stop. */
  lastPenalty?: 'ok' | '+2' | 'DNF' | null;
}

export default function TimerDisplay({ phase, displayMs, inspectionDisplayMs, lastPenalty }: Props) {
  const settings = useSettings();
  const inspectionLimit = settings.inspection;

  const cls = (() => {
    if (phase === 'holding') return 'holding';
    if (phase === 'ready') return 'ready';
    if (phase === 'running') return 'running';
    if (phase === 'inspecting') {
      const sec = Math.floor(inspectionDisplayMs / 1000);
      if (sec >= inspectionLimit + 2) return 'inspection-dnf';
      if (sec >= inspectionLimit) return 'inspection-plus2';
      if (sec >= 12) return 'inspection-warn-12';
      if (sec >= 8) return 'inspection-warn-8';
      return 'inspection';
    }
    if (phase === 'stopped' && lastPenalty === 'DNF') return 'dnf';
    return '';
  })();

  let text: string;
  if (phase === 'inspecting') {
    const remaining = Math.max(0, Math.ceil((inspectionLimit * 1000 - inspectionDisplayMs) / 1000));
    if (inspectionDisplayMs > inspectionLimit * 1000 + 2000) {
      text = 'DNF';
    } else if (inspectionDisplayMs > inspectionLimit * 1000) {
      text = '+2';
    } else {
      text = remaining.toString();
    }
  } else if (phase === 'running') {
    if (settings.hideTime) {
      text = '…';
    } else {
      text = formatMs(displayMs, 2).replace(/\.\d+$/, '');
    }
  } else if (phase === 'stopped' && lastPenalty === 'DNF') {
    text = 'DNF';
  } else if (phase === 'stopped' && lastPenalty === '+2') {
    text = formatMs(displayMs + 2000, settings.precision) + '+';
  } else {
    text = formatMs(displayMs, settings.precision);
  }

  const fontSize = `calc(clamp(64px, 14vw, 192px) * ${settings.timerFontScale})`;

  return (
    <div className={`timer-display ${cls}`} style={{ fontSize }}>
      {text}
    </div>
  );
}
