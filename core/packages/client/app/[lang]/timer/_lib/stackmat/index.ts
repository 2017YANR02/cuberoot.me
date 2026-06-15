/**
 * useStackmat — React hook that listens to the microphone and decodes a
 * Stackmat Gen 3 / 4 timer signal in real time.
 *
 * Mic permission strategy:
 *   - The hook does NOT request mic access on mount. status.listening starts
 *     false; the UI shows a Connect button that calls handle.start().
 *   - start() returns a Promise. If getUserMedia is rejected (denied / no
 *     device / not on HTTPS), the promise rejects and listening stays false;
 *     the caller can surface the error.
 *   - stop() releases the MediaStream tracks and tears down the AudioContext
 *     so the browser drops the "in use" indicator.
 *
 * Phase machine:
 *   - 'unknown'    — listening but no valid packet yet (no Stackmat plugged in
 *                    or signal not yet stable).
 *   - 'idle'       — state byte ' ' or 'I' AND time == 0.
 *   - 'one-hand'   — state byte 'A' / 'L' / 'R'.
 *   - 'starting'   — state byte 'C' (both pads, ready).
 *   - 'running'    — state byte 'S'.
 *   - 'stopped'    — state byte ' ' (or 'I') with time != 0; transitioned out
 *                    of running.
 *
 * onStart fires on the first transition into 'running'; onStop fires on the
 * first transition into 'stopped' carrying the recorded ms.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createDecoder, feed, type DecoderState } from './decoder';
import type { StackmatPacket } from './packet';

export type StackmatPhase =
  | 'unknown'
  | 'idle'
  | 'one-hand'
  | 'starting'
  | 'running'
  | 'stopped';

export interface StackmatStatus {
  phase: StackmatPhase;
  ms: number;
  listening: boolean;
}

export interface StackmatHandle {
  status: StackmatStatus;
  start(): Promise<void>;
  stop(): void;
  signalLevel: number;
}

export interface UseStackmatOptions {
  onStart?: () => void;
  onStop?: (ms: number) => void;
}

function packetToPhase(pkt: StackmatPacket, prev: StackmatPhase): StackmatPhase {
  switch (pkt.state) {
    case 'S': return 'running';
    case 'C': return 'starting';
    case 'A':
    case 'L':
    case 'R': return 'one-hand';
    case ' ':
    case 'I':
      // ' ' after a run with non-zero time = stopped; otherwise idle.
      // Carry 'stopped' forward as long as we haven't moved to a hand-on state.
      if (prev === 'running' && pkt.totalMs > 0) return 'stopped';
      if (prev === 'stopped' && pkt.totalMs > 0) return 'stopped';
      return pkt.totalMs === 0 ? 'idle' : 'stopped';
    default: return prev;
  }
}

// ScriptProcessor types aren't always in the default lib for the version of
// AudioContext we're using. Define a minimal alias to avoid `any`.
interface AudioProcEvent { inputBuffer: { getChannelData(ch: number): Float32Array } }

export function useStackmat(opts: UseStackmatOptions = {}): StackmatHandle {
  const [status, setStatus] = useState<StackmatStatus>({
    phase: 'unknown',
    ms: 0,
    listening: false,
  });
  const [signalLevel, setSignalLevel] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const decoderRef = useRef<DecoderState | null>(null);
  const phaseRef = useRef<StackmatPhase>('unknown');
  const onStartRef = useRef(opts.onStart);
  const onStopRef = useRef(opts.onStop);
  const rafRef = useRef<number | null>(null);
  const pendingStatusRef = useRef<StackmatStatus | null>(null);
  const pendingLevelRef = useRef<number | null>(null);

  useEffect(() => { onStartRef.current = opts.onStart; }, [opts.onStart]);
  useEffect(() => { onStopRef.current = opts.onStop; }, [opts.onStop]);

  /** Drain pending state into React on requestAnimationFrame, so we don't
   *  thrash setState at audio-block rate (~86 Hz at 44.1 kHz / 512 samples). */
  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingStatusRef.current) {
        setStatus(pendingStatusRef.current);
        pendingStatusRef.current = null;
      }
      if (pendingLevelRef.current !== null) {
        setSignalLevel(pendingLevelRef.current);
        pendingLevelRef.current = null;
      }
    });
  }, []);

  const teardown = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (procRef.current) {
      procRef.current.onaudioprocess = null;
      try { procRef.current.disconnect(); } catch { /* noop */ }
      procRef.current = null;
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch { /* noop */ }
      sourceRef.current = null;
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    if (ctxRef.current) {
      try { void ctxRef.current.close(); } catch { /* noop */ }
      ctxRef.current = null;
    }
    decoderRef.current = null;
    phaseRef.current = 'unknown';
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return; // already running
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('mic-not-supported');
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch (err) {
      // Re-throw so caller can show a UI message.
      throw err instanceof Error ? err : new Error(String(err));
    }
    streamRef.current = stream;

    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      teardown();
      throw new Error('audio-not-supported');
    }
    const ctx = new Ctor();
    ctxRef.current = ctx;
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { /* noop */ }
    }

    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;

    // ScriptProcessorNode: deprecated but reliable. 1024 samples ~= 23ms @ 44.1kHz.
    const proc = ctx.createScriptProcessor(1024, 1, 1);
    procRef.current = proc;

    const decoder = createDecoder(ctx.sampleRate);
    decoderRef.current = decoder;

    proc.onaudioprocess = (ev: AudioProcEvent) => {
      const ch = ev.inputBuffer.getChannelData(0);
      const pkt = feed(decoder, ch);

      // Update level no matter what.
      pendingLevelRef.current = decoder.level;

      if (pkt) {
        const newPhase = packetToPhase(pkt, phaseRef.current);
        const ms = newPhase === 'idle' ? 0 : pkt.totalMs;
        if (newPhase === 'running' && phaseRef.current !== 'running') {
          onStartRef.current?.();
        }
        if (newPhase === 'stopped' && phaseRef.current !== 'stopped') {
          onStopRef.current?.(pkt.totalMs);
        }
        phaseRef.current = newPhase;
        pendingStatusRef.current = { phase: newPhase, ms, listening: true };
      }
      scheduleFlush();
    };

    source.connect(proc);
    // ScriptProcessorNode is only invoked when connected to the destination
    // in some browsers, even though we don't want to play audio out. Route
    // through a muted gain so nothing audibly plays.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    proc.connect(mute);
    mute.connect(ctx.destination);

    setStatus({ phase: 'unknown', ms: 0, listening: true });
  }, [scheduleFlush, teardown]);

  const stop = useCallback(() => {
    teardown();
    pendingStatusRef.current = null;
    pendingLevelRef.current = null;
    setStatus({ phase: 'unknown', ms: 0, listening: false });
    setSignalLevel(0);
  }, [teardown]);

  // Cleanup on unmount.
  useEffect(() => () => teardown(), [teardown]);

  return { status, start, stop, signalLevel };
}

export type { StackmatPacket } from './packet';
