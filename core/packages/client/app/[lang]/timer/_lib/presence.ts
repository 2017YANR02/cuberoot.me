'use client';

import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '@/lib/api-base';

export interface TimerPresenceMix {
  normal: number;
  smart: number;
}

export interface TimerPresenceSnapshot extends TimerPresenceMix {
  total: number;
}

const ENDPOINT = '/v1/timer/presence';
const HEARTBEAT_MS = 10_000;

function isSnapshot(value: unknown): value is TimerPresenceSnapshot {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Number.isInteger(v.normal) && Number.isInteger(v.smart) && Number.isInteger(v.total);
}

function newPresenceId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Convert local battle connections into people using ordinary vs smart cubes. */
export function battlePresenceMix(
  playerCount: number,
  cubeMode: 'own' | 'shared',
  connected: readonly boolean[],
): TimerPresenceMix {
  const count = Math.max(1, Math.min(4, Math.floor(playerCount)));
  const smart = cubeMode === 'shared'
    ? (connected[0] ? 1 : 0)
    : connected.slice(0, count).filter(Boolean).length;
  return { normal: count - smart, smart };
}

/**
 * Report only production tabs. Development pages poll the production snapshot
 * read-only, so opening localhost to inspect the panel does not inflate it.
 */
export function useTimerPresence(mix: TimerPresenceMix): TimerPresenceSnapshot | null {
  const [snapshot, setSnapshot] = useState<TimerPresenceSnapshot | null>(null);
  const mixRef = useRef(mix);
  mixRef.current = mix;
  const sendRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const id = newPresenceId();
    const shouldReport = process.env.NODE_ENV !== 'development';

    const request = async (offline = false) => {
      try {
        const res = shouldReport
          ? await fetch(apiUrl(ENDPOINT), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(offline ? { id, normal: 0, smart: 0 } : { id, ...mixRef.current }),
              cache: 'no-store',
              credentials: 'omit',
              keepalive: true,
            })
          : await fetch(apiUrl(ENDPOINT), { cache: 'no-store', credentials: 'omit' });
        if (!res.ok || offline) return;
        const value: unknown = await res.json();
        if (isSnapshot(value)) setSnapshot(value);
      } catch {
        // Presence is observational; a network failure must never disturb timing.
      }
    };

    const sendCurrent = () => {
      if (document.visibilityState === 'visible') void request();
    };
    sendRef.current = sendCurrent;

    const interval = window.setInterval(sendCurrent, HEARTBEAT_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') sendCurrent();
      else if (shouldReport) void request(true);
    };
    const onPageHide = () => { if (shouldReport) void request(true); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      sendRef.current = null;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      if (shouldReport) void request(true);
    };
  }, []);

  useEffect(() => {
    sendRef.current?.();
  }, [mix.normal, mix.smart]);

  return snapshot;
}
