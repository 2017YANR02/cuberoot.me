/**
 * useStackmat — React adapter over the mic Stackmat source.
 *
 * The audio pipeline, the 1200-baud decoder wiring and the phase machine now
 * live in `./source.ts`, which implements the shared `ExternalTimerSource`
 * interface (`../bluetooth/timer/types.ts`) alongside the BLE GAN / QiYi smart
 * timers. This file is the React skin on top of it and nothing more.
 *
 * The hook's public API is unchanged — `status` / `start()` / `stop()` /
 * `signalLevel`, plus `onStart` / `onStop` options — so existing callers keep
 * working untouched. New code should prefer the source directly (or the
 * unified handle a future UI pass exposes), since it works for every external
 * timing device rather than just the microphone one.
 *
 * Mic permission strategy and the phase machine are documented in
 * `./source.ts`; they did not change.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createStackmatMicSource,
  type StackmatInputDevice,
  type StackmatMicSource,
  type StackmatSnapshot,
} from './source';

export type {
  StackmatPhase, StackmatSnapshot, StackmatMicSource, StackmatInputDevice,
} from './source';
export { createStackmatMicSource, packetToPhase, phaseToTimerState } from './source';
export type { StackmatPacket } from './packet';

import type { StackmatPhase } from './source';

export interface StackmatStatus {
  phase: StackmatPhase;
  ms: number;
  listening: boolean;
  /** True while frames are actually decoding — "plugged in and talking". */
  signalPresent: boolean;
  /** Raw state byte of the last frame; '' before the first one. */
  stateByte: string;
  /** Device time resolution: 1 = ms, 10 = centiseconds, 0 = not known yet. */
  unit: 0 | 1 | 10;
  /** Audio input in use; '' = system default. */
  deviceId: string;
}

export interface StackmatHandle {
  status: StackmatStatus;
  /** Start listening. Pass a deviceId to pin a specific audio input. */
  start(deviceId?: string): Promise<void>;
  stop(): void;
  signalLevel: number;
  /** Decoder noise estimate 0..1 — high with no signal means wrong input. */
  noise: number;
  /** Audio inputs; labels only populate after mic permission is granted. */
  listInputDevices(): Promise<StackmatInputDevice[]>;
}

export interface UseStackmatOptions {
  onStart?: () => void;
  onStop?: (ms: number) => void;
}

const IDLE_STATUS: StackmatStatus = {
  phase: 'unknown', ms: 0, listening: false,
  signalPresent: false, stateByte: '', unit: 0, deviceId: '',
};

function toStatus(s: StackmatSnapshot): StackmatStatus {
  return {
    phase: s.phase, ms: s.ms, listening: s.listening,
    signalPresent: s.signalPresent, stateByte: s.stateByte,
    unit: s.unit, deviceId: s.deviceId,
  };
}

function sameStatus(a: StackmatStatus, b: StackmatStatus): boolean {
  return a.phase === b.phase && a.ms === b.ms && a.listening === b.listening
    && a.signalPresent === b.signalPresent && a.stateByte === b.stateByte
    && a.unit === b.unit && a.deviceId === b.deviceId;
}

export function useStackmat(opts: UseStackmatOptions = {}): StackmatHandle {
  const [status, setStatus] = useState<StackmatStatus>(IDLE_STATUS);
  const [signalLevel, setSignalLevel] = useState(0);
  const [noise, setNoise] = useState(0);

  const onStartRef = useRef(opts.onStart);
  const onStopRef = useRef(opts.onStop);
  useEffect(() => { onStartRef.current = opts.onStart; }, [opts.onStart]);
  useEffect(() => { onStopRef.current = opts.onStop; }, [opts.onStop]);

  const sourceRef = useRef<StackmatMicSource | null>(null);
  if (sourceRef.current === null) sourceRef.current = createStackmatMicSource();
  const source = sourceRef.current;

  // The source publishes a snapshot per audio block (~43 Hz). Drain into React
  // on requestAnimationFrame so we don't thrash setState at that rate, and
  // skip no-op status writes so an unchanged phase costs no re-render.
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<StackmatSnapshot | null>(null);
  const appliedRef = useRef<StackmatStatus>(IDLE_STATUS);

  const cancelFlush = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  useEffect(() => {
    const unsubSnapshot = source.subscribeSnapshot((snap) => {
      pendingRef.current = snap;
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const s = pendingRef.current;
        pendingRef.current = null;
        if (!s) return;
        const next = toStatus(s);
        if (!sameStatus(next, appliedRef.current)) {
          appliedRef.current = next;
          setStatus(next);
        }
        setSignalLevel(s.signalLevel);
        setNoise(s.noise);
      });
    });

    const unsubEvents = source.subscribe((ev) => {
      if (ev.state === 'RUNNING') onStartRef.current?.();
      else if (ev.state === 'STOPPED') onStopRef.current?.(ev.solveTime ?? 0);
    });

    return () => {
      unsubSnapshot();
      unsubEvents();
      cancelFlush();
      void source.disconnect();
    };
  }, [source, cancelFlush]);

  const start = useCallback(async (deviceId?: string): Promise<void> => {
    await source.connect(deviceId);
    // Reflect "listening" immediately rather than waiting for the first frame.
    const next = toStatus(source.snapshot());
    appliedRef.current = next;
    setStatus(next);
  }, [source]);

  const stop = useCallback((): void => {
    void source.disconnect();
    cancelFlush();
    const next: StackmatStatus = { ...IDLE_STATUS, deviceId: source.deviceId };
    appliedRef.current = next;
    setStatus(next);
    setSignalLevel(0);
    setNoise(0);
  }, [source, cancelFlush]);

  const listInputDevices = useCallback(() => source.listInputDevices(), [source]);

  return { status, start, stop, signalLevel, noise, listInputDevices };
}
