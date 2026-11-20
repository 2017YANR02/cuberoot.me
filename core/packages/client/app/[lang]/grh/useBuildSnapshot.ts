'use client';

import { useEffect, useState } from 'react';
import { statsUrl } from '@/lib/stats-base';

export const phases = ['main-build', 'rh-axioms', 'kernel-replay'] as const;
export type Phase = typeof phases[number];
const stages = [...phases, 'preparing', 'completed', 'failed'] as const;
type Stage = typeof stages[number];

interface Snapshot {
  stage: Stage;
  failedStage: Phase | null;
  completed: number;
  total: number;
  ratePerMin: number | null;
  etaSeconds: number | null;
  updatedAt: string;
  elapsedSeconds: number | null;
  processFootprintGiB: number | null;
  peakFootprintGiB: number | null;
  workerCount: number | null;
  recent: { name: string; duration: string | null }[];
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function parseSnapshot(value: unknown): Snapshot | null {
  if (!value || typeof value !== 'object') return null;
  const s = value as Record<string, unknown>;
  if (!stages.some(stage => stage === s.stage) || typeof s.updatedAt !== 'string'
      || !Number.isFinite(Date.parse(s.updatedAt))) return null;
  const done = number(s.completed), total = number(s.total);
  if (done == null || total == null || total === 0 || done > total ||
      !Number.isInteger(done) || !Number.isInteger(total)) return null;
  const recent: Snapshot['recent'] = [];
  if (Array.isArray(s.recent)) {
    for (const row of s.recent.slice(0, 5)) {
      if (row && typeof row.name === 'string') {
        recent.push({ name: row.name, duration: typeof row.duration === 'string' ? row.duration : null });
      }
    }
  }
  if (!recent.length && typeof s.latestModule === 'string') recent.push({ name: s.latestModule, duration: null });
  return {
    stage: s.stage as Stage, failedStage: phases.find(key => key === s.failedStage) ?? null,
    completed: done, total, updatedAt: s.updatedAt, recent, ratePerMin: number(s.ratePerMin),
    etaSeconds: number(s.etaSeconds), elapsedSeconds: number(s.elapsedSeconds),
    processFootprintGiB: number(s.processFootprintGiB), peakFootprintGiB: number(s.peakFootprintGiB),
    workerCount: number(s.workerCount),
  };
}

export function useBuildSnapshot() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    let mounted = true;
    let pending: AbortController | null = null;
    async function refresh() {
      if (pending || document.hidden) return;
      pending = new AbortController();
      const controller = pending;
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      try {
        const bucket = Math.floor(Date.now() / 30000);
        const url = statsUrl('/stats/grh/progress.json') + '?t=' + bucket;
        const response = await fetch(url, { cache: 'no-store', credentials: 'omit', signal: controller.signal });
        if (!response.ok) throw new Error('Status snapshot unavailable');
        const next = parseSnapshot(await response.json());
        if (!next) throw new Error('Invalid status snapshot');
        if (mounted) {
          setData(previous => previous && Date.parse(previous.updatedAt) > Date.parse(next.updatedAt) ? previous : next);
          setError(false);
        }
      } catch {
        if (mounted) setError(true);
      } finally {
        window.clearTimeout(timeout);
        pending = null;
        if (mounted) setNow(Date.now());
      }
    }
    void refresh();
    const interval = window.setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      mounted = false;
      pending?.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const terminal = data?.stage === 'failed' || data?.stage === 'completed';
  const stale = !!data && !terminal && now - Date.parse(data.updatedAt) >= 180000;
  return { data, stale, error };
}
