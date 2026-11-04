'use client';

import { useCallback, useEffect, useState } from 'react';

/** Own the camera only while enabled; late permission results must also be released. */
export function useCameraStream({ enabled = true, width = 1920, height = 1080 } = {}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    setStream(null);
    setError(null);
    if (!enabled) return;
    let cancelled = false;
    let ownedStream: MediaStream | null = null;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Unsupported');
        return;
      }
      try {
        const next = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: width }, height: { ideal: height } },
        });
        if (cancelled) { next.getTracks().forEach(track => track.stop()); return; }
        ownedStream = next;
        setStream(next);
      } catch (cause) {
        if (!cancelled) setError(cause && typeof cause === 'object' && 'name' in cause && typeof cause.name === 'string' ? cause.name : 'CameraError');
      }
    }
    void start();
    return () => {
      cancelled = true;
      ownedStream?.getTracks().forEach(track => track.stop());
    };
  }, [enabled, width, height, attempt]);

  return { stream, error, retry };
}
