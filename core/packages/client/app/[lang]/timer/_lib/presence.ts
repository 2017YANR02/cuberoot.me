'use client';

import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '@/lib/api-base';
import { authHeaders } from '@/lib/admin-api';

export interface TimerPresenceMix {
  normal: number;
  smart: number;
}

export interface TimerPresenceResult {
  label?: string;
  event: string;
  timeMs: number;
  penalty: 'ok' | '+2' | 'DNF' | 'DNS' | 'dnf';
  at?: number;
}

export interface TimerPresenceDevice {
  name: string;
  id?: string;
}

export interface TimerPresenceReport extends TimerPresenceMix {
  mode: 'solo' | 'local' | 'net';
  results: TimerPresenceResult[];
  devices: TimerPresenceDevice[];
}

export interface TimerPresenceAccount {
  ownerId: string;
  name: string;
  wcaId?: string;
}

export interface TimerPresenceSession extends TimerPresenceReport {
  sessionId: string;
  ip: string;
  account: TimerPresenceAccount | null;
  seenAt: number;
}

export interface TimerPresenceSnapshot extends TimerPresenceMix {
  total: number;
  sessions: TimerPresenceSession[];
}

const ENDPOINT = '/v1/timer/presence?v=2';
const HEARTBEAT_MS = 10_000;

function isSnapshot(value: unknown): value is TimerPresenceSnapshot {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Number.isInteger(v.normal)
    && Number.isInteger(v.smart)
    && Number.isInteger(v.total)
    && Array.isArray(v.sessions);
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
 * Production tabs report live details. Only an authenticated administrator
 * polls the snapshot; development pages never inflate the production count.
 */
export function useTimerPresence(
  report: TimerPresenceReport,
  canView: boolean,
): TimerPresenceSnapshot | null {
  const [snapshot, setSnapshot] = useState<TimerPresenceSnapshot | null>(null);
  const reportRef = useRef(report);
  reportRef.current = report;
  const sendRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const id = newPresenceId();
    const shouldReport = process.env.NODE_ENV !== 'development';

    const write = async (offline = false) => {
      if (!shouldReport) return;
      await fetch(apiUrl(ENDPOINT), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(offline
          ? { id, normal: 0, smart: 0 }
          : { id, ...reportRef.current }),
        cache: 'no-store',
        credentials: 'omit',
        keepalive: true,
      });
    };

    const read = async () => {
      if (!canView) return;
      const res = await fetch(apiUrl(ENDPOINT), {
        headers: authHeaders(false),
        cache: 'no-store',
        credentials: 'omit',
      });
      if (!res.ok) return;
      const value: unknown = await res.json();
      if (isSnapshot(value)) setSnapshot(value);
    };

    const request = async (offline = false) => {
      try {
        await write(offline);
        if (!offline) await read();
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
      else void request(true);
    };
    const onPageHide = () => { void request(true); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    sendCurrent();
    return () => {
      sendRef.current = null;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      void request(true);
    };
  }, [canView]);

  const signature = JSON.stringify(report);
  useEffect(() => {
    sendRef.current?.();
  }, [signature]);

  return canView ? snapshot : null;
}
