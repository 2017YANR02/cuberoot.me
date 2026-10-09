'use client';

import { useEffect, useState, type RefObject } from 'react';
import { GyroRecorder } from '@cuberoot/shared/smart-cube/gyro-track';
import type { Quat } from '@cuberoot/shared/smart-cube/orientation';
import { buildCoreTrack } from '@cuberoot/shared/timer/reconstruct/core-track';
import { tr } from '@/i18n/tr';
import './inspection-rotation-debug.css';

/** Admin-only caller owns visibility and enables the existing gyro subscription. */
export function InspectionRotationDebug({ enabled, onToggle, quatRef, brand, phase, resetKey }: {
  enabled: boolean;
  onToggle(): void;
  quatRef: RefObject<Quat | null>;
  brand?: string | null;
  phase: string;
  resetKey: string;
}) {
  const [notation, setNotation] = useState('');
  const [hasSample, setHasSample] = useState(false);
  const observing = ['idle', 'inspecting', 'holding', 'ready'].includes(phase);
  useEffect(() => {
    if (!enabled) { setNotation(''); setHasSample(false); return; }
    if (!observing) return;
    // Independent debug buffer: never add inspection samples to solve recordings.
    const recorder = new GyroRecorder();
    const start = performance.now();
    setNotation('');
    setHasSample(false);
    const update = () => {
      const q = quatRef.current;
      if (!q) return;
      recorder.push(q, performance.now() - start);
      setHasSample(true);
      const track = buildCoreTrack(recorder.snapshot(), { brand });
      setNotation(track?.events.map(event => event.token).join(' ') ?? '');
    };
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [enabled, observing, quatRef, brand, resetKey]);

  return <div className="inspection-rotation-debug" data-no-timer>
    <button className="inspection-rotation-debug-toggle" type="button" aria-pressed={enabled} onClick={onToggle}>
      {enabled
        ? tr({ zh: '关闭观察转体调试', en: 'Hide inspection rotation debug' })
        : tr({ zh: '观察转体调试', en: 'Inspection rotation debug' })}
    </button>
    {enabled && <div className="inspection-rotation-debug-moves">
      {notation || (hasSample ? '—' : tr({ zh: '等待陀螺仪数据', en: 'Waiting for gyroscope data' }))}
    </div>}
  </div>;
}
