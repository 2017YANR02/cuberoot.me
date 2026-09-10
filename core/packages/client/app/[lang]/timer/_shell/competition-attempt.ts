import { useCallback, useEffect, useRef, useState } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { apiUrl } from '@/lib/api-base';
import { listCompetitionRegistrations, type CompetitionAttempt } from '@/lib/online-competition-api';
import { useAuthStore } from '@/lib/auth-store';

type Attempt = CompetitionAttempt & { telemetry?: { runId: string; status: 'started' | 'device_reported' } | null };
type Device = { brand: string; deviceName: string };
type Report = {
  runId: string; serverIssuedAt: string; scramble: string; durationMs: number;
  moves: Array<{ move: string; elapsedMs: number }>;
  startFacelets: string; endFacelets: string; deviceBrand: string; deviceName: string;
  disconnected: boolean;
};
type Run = { runId: string; attempt: Attempt; startFacelets: string; device: Device; reported: boolean; disconnected: boolean };

async function request<T>(url: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  return handleApi<T>(await fetch(apiUrl(url), {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
    headers: { ...authHeaders(body !== undefined), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}

/** Competition orchestration only. Bluetooth, scramble guidance and timing stay in SoloView. */
export function useCompetitionAttempt() {
  const [competitionId] = useQueryState('competition', parseAsString.withDefault(''));
  const [registrationId] = useQueryState('entry', parseAsString.withDefault(''));
  const enabled = Boolean(competitionId || registrationId);
  const userId = useAuthStore(state => state.user?.uid);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const run = useRef<Run | null>(null);
  const pendingReport = useRef<Report | null>(null);
  const reportKey = useRef('');
  const startKeys = useRef(new Map<string, string>());
  const locked = useRef(false);
  const generation = useRef(0);
  const base = `/v1/platform/competitions/registrations/${encodeURIComponent(registrationId)}/attempts`;
  const currentBase = useRef(base);
  currentBase.current = base;

  useEffect(() => {
    generation.current += 1;
    locked.current = false; setBusy(false);
    setAttempt(null); setAuthorized(false); setError(''); run.current = null; pendingReport.current = null;
    if (!enabled || !competitionId || !registrationId || !userId) return () => { generation.current += 1; };
    let cancelled = false;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const { registrations } = await listCompetitionRegistrations(competitionId);
        const own = registrations.find(item => item.id === registrationId && item.userId === userId
          && item.device === 'smart' && item.project === '333' && item.checkedInAt && !item.resultRecordedAt
          && ['confirmed', 'attended'].includes(item.status));
        if (!own) { if (!cancelled) setAuthorized(false); return; }
        const result = await request<{ attempts: Attempt[] }>(base);
        if (cancelled) return;
        setAuthorized(true);
        setAttempt(result.attempts.find(item => !item.recordedAt) ?? null);
      } catch (err) { if (!cancelled) setError(String(err instanceof Error ? err.message : err)); }
      finally { refreshing = false; }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 3000);
    return () => { generation.current += 1; cancelled = true; window.clearInterval(interval); };
  }, [base, competitionId, enabled, registrationId, userId]);

  const attemptKey = attempt ? `${attempt.attemptNumber}:${attempt.issuedAt}` : '';
  useEffect(() => {
    generation.current += 1;
    locked.current = false; setBusy(false);
    if (run.current && `${run.current.attempt.attemptNumber}:${run.current.attempt.issuedAt}` !== attemptKey) {
      run.current = null; pendingReport.current = null; setRevision(value => value + 1);
    }
  }, [attemptKey]);

  const begin = useCallback(async (startFacelets: string, device: Device): Promise<boolean> => {
    const key = attempt ? `${base}/${attempt.attemptNumber}/${attempt.issuedAt}` : '';
    if (!authorized || !attempt || (attempt.telemetry && !(attempt.telemetry.status === 'started' && startKeys.current.has(key))) || run.current || locked.current) return false;
    const requestGeneration = generation.current;
    locked.current = true; setBusy(true); setError('');
    try {
      if (!startKeys.current.has(key)) startKeys.current.set(key, crypto.randomUUID());
      const result = await request<{ runId: string }>(`${base}/${attempt.attemptNumber}/telemetry/start`, {
        serverIssuedAt: attempt.issuedAt, scramble: attempt.scramble,
      }, startKeys.current.get(key));
      if (currentBase.current !== base || generation.current !== requestGeneration) return false;
      run.current = { runId: result.runId, attempt, startFacelets, device, reported: false, disconnected: false };
      setRevision(value => value + 1);
      return true;
    } catch (err) { if (generation.current === requestGeneration) setError(String(err instanceof Error ? err.message : err)); return false; }
    finally { if (generation.current === requestGeneration) { locked.current = false; setBusy(false); } }
  }, [attempt, authorized, base]);

  const sendReport = useCallback(async () => {
    const report = pendingReport.current;
    const current = run.current;
    if (!report || !current || locked.current) return;
    const requestGeneration = generation.current;
    locked.current = true; setBusy(true); setError('');
    try {
      await request(`${base}/${current.attempt.attemptNumber}/telemetry`, report, reportKey.current);
      if (generation.current === requestGeneration && pendingReport.current === report) pendingReport.current = null;
    } catch (err) { if (generation.current === requestGeneration) setError(String(err instanceof Error ? err.message : err)); }
    finally { if (generation.current === requestGeneration) { locked.current = false; setBusy(false); setRevision(value => value + 1); } }
  }, [base]);

  const complete = useCallback((durationMs: number, moves: Array<{ m: string; ts: number }>, endFacelets: string, disconnected: boolean) => {
    const current = run.current;
    if (!current || current.reported) return;
    current.reported = true;
    current.disconnected = disconnected;
    reportKey.current = crypto.randomUUID();
    pendingReport.current = {
      runId: current.runId, serverIssuedAt: current.attempt.issuedAt, scramble: current.attempt.scramble,
      durationMs: Math.round(durationMs),
      moves: moves.map(move => ({ move: move.m, elapsedMs: Math.round(move.ts) })),
      startFacelets: current.startFacelets, endFacelets,
      deviceBrand: current.device.brand, deviceName: current.device.deviceName, disconnected,
    };
    setRevision(value => value + 1);
    void sendReport();
  }, [sendReport]);

  const canRetryStart = Boolean(attempt?.telemetry?.status === 'started' && startKeys.current.has(`${base}/${attempt.attemptNumber}/${attempt.issuedAt}`));
  return {
    enabled, competitionId, registrationId, attempt, attemptKey, authorized, error, busy, revision,
    interrupted: Boolean(run.current?.disconnected || (attempt?.telemetry?.status === 'started' && !run.current && !canRetryStart)),
    reported: Boolean(run.current?.reported || attempt?.telemetry?.status === 'device_reported'),
    canPrepare: authorized && Boolean(attempt) && (!attempt?.telemetry || canRetryStart) && !run.current && !busy,
    canStart: () => authorized && Boolean(run.current && !run.current.reported),
    run: () => run.current,
    pendingReport: Boolean(pendingReport.current), begin, complete, retry: sendReport,
  };
}
