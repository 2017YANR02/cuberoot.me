import { sessionFetch } from '@/lib/session-fetch';
import { useCallback, useEffect, useRef, useState } from 'react';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { parseAsString, useQueryState } from 'nuqs';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { apiUrl } from '@/lib/api-base';
import { getCompetitionDuel, listCompetitionRegistrations, setCompetitionDuelPhase, type CompetitionAttempt } from '@/lib/online-competition-api';
import { useAuthUser } from '@/lib/auth-store';

type Attempt = CompetitionAttempt & { telemetry?: { runId: string; status: 'started' | 'device_reported' } | null };
type Device = { brand: string; deviceName: string };
type Report = {
  runId: string; serverIssuedAt: string; scramble: string; durationMs: number;
  moves: Array<{ move: string; elapsedMs: number }>;
  startFacelets: string; endFacelets: string; deviceBrand: string; deviceName: string;
  disconnected: boolean;
  inspectionMs?: number;
};
type Run = { runId: string; attempt: Attempt; startFacelets: string; device: Device; reported: boolean; disconnected: boolean };

async function request<T>(url: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  return handleApi<T>(await sessionFetch(apiUrl(url), {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
    headers: { ...authHeaders(body !== undefined), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
}

/** Competition orchestration only. Bluetooth, scramble guidance and timing stay in SoloView. */
export function useCompetitionAttempt() {
  const [competitionId] = useQueryState('competition', parseAsString.withDefault(''));
  const [registrationId] = useQueryState('entry', parseAsString.withDefault(''));
  const [matchId] = useQueryState('match', parseAsString.withDefault(''));
  const enabled = Boolean(competitionId || registrationId || matchId);
  const [automatic, setAutomatic] = useState(false);
  const [videoRegistrationId, setVideoRegistrationId] = useState('');
  const userId = useAuthUser()?.uid;
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
  const base = matchId ? `/v1/platform/competitions/matches/${encodeURIComponent(matchId)}/games`
    : `/v1/platform/competitions/registrations/${encodeURIComponent(registrationId)}/attempts`;
  const currentBase = useRef(base);
  currentBase.current = base;

  useEffect(() => {
    generation.current += 1;
    locked.current = false; setBusy(false);
    setAttempt(null); setAuthorized(false); setAutomatic(false); setVideoRegistrationId(''); setError(''); run.current = null; pendingReport.current = null;
    if (!enabled || !competitionId || (!registrationId && !matchId) || !userId) return () => { generation.current += 1; };
    let cancelled = false;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        if (matchId) {
          const duel = await getCompetitionDuel(matchId);
          if (cancelled) return;
          const allowed = duel.eventId === competitionId && duel.device === 'smart' && duel.project === '333';
          setAuthorized(allowed);
          setAutomatic(true);
          setVideoRegistrationId(duel.requiresSupervision ? duel.registrationId ?? '' : '');
          setAttempt(allowed && duel.canPlay && duel.startAt && duel.scramble && !duel.ownResult ? {
            attemptNumber: duel.gameNumber, scramble: duel.scramble, issuedAt: duel.startAt,
            centiseconds: null, penalty: null, recordedAt: null,
            telemetry: duel.runId ? { runId: duel.runId, status: 'started' } : null,
          } : null);
          return;
        }
        const { registrations } = await listCompetitionRegistrations(competitionId);
        const own = registrations.find(item => item.id === registrationId && item.userId === userId
          && item.device === 'smart' && item.project === '333' && item.checkedInAt && !item.resultRecordedAt
          && ['confirmed', 'attended'].includes(item.status));
        if (!own) { if (!cancelled) setAuthorized(false); return; }
        const result = await request<{ attempts: Attempt[] }>(base);
        if (cancelled) return;
        setAuthorized(true);
        setAutomatic(own.sessionKind === 'self_service');
        setVideoRegistrationId(own.sessionKind === 'self_service' ? '' : own.id);
        setAttempt(result.attempts.find(item => !item.recordedAt) ?? null);
      } catch (err) { if (!cancelled) setError(String(err instanceof Error ? err.message : err)); }
      finally { refreshing = false; }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 3000);
    return () => { generation.current += 1; cancelled = true; window.clearInterval(interval); };
  }, [base, competitionId, enabled, matchId, registrationId, userId]);

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

  const telemetryRunId = attempt?.telemetry?.runId;
  useEffect(() => {
    if (!telemetryRunId || pendingReport.current) return;
    try {
      const stored = JSON.parse(localStorage.getItem(`competition-device-report:${telemetryRunId}`) ?? 'null');
      if (stored?.report?.runId === telemetryRunId && typeof stored.key === 'string') {
        pendingReport.current = stored.report;
        reportKey.current = stored.key;
        setRevision(value => value + 1);
      }
    } catch { /* The current tab can still submit a new recording. */ }
  }, [telemetryRunId]);

  const queueReport = useCallback((report: Report) => {
    reportKey.current = crypto.randomUUID();
    pendingReport.current = report;
    try { localStorage.setItem(`competition-device-report:${report.runId}`, JSON.stringify({ key: reportKey.current, report })); }
    catch { /* The current tab retains the pending report. */ }
    setRevision(value => value + 1);
  }, []);

  const sendReport = useCallback(async () => {
    const report = pendingReport.current;
    if (!report || !attempt || report.serverIssuedAt !== attempt.issuedAt || locked.current) return;
    const requestGeneration = generation.current;
    locked.current = true; setBusy(true); setError('');
    try {
      await request(`${base}/${attempt.attemptNumber}/telemetry`, report, reportKey.current);
      try { localStorage.removeItem(`competition-device-report:${report.runId}`); } catch { /* Already recorded on the server. */ }
      if (generation.current === requestGeneration && pendingReport.current === report) pendingReport.current = null;
    } catch (err) { if (generation.current === requestGeneration) setError(String(err instanceof Error ? err.message : err)); }
    finally { if (generation.current === requestGeneration) { locked.current = false; setBusy(false); setRevision(value => value + 1); } }
  }, [attempt, base]);

  const complete = useCallback((durationMs: number, moves: Array<{ m: string; ts: number }>, endFacelets: string, disconnected: boolean, inspectionMs?: number) => {
    const current = run.current;
    if (!current || current.reported) return;
    current.reported = true;
    current.disconnected = disconnected;
    queueReport({
      runId: current.runId, serverIssuedAt: current.attempt.issuedAt, scramble: current.attempt.scramble,
      durationMs: Math.round(durationMs),
      moves: moves.map(move => ({ move: move.m, elapsedMs: Math.round(move.ts) })),
      startFacelets: current.startFacelets, endFacelets,
      deviceBrand: current.device.brand, deviceName: current.device.deviceName, disconnected,
      ...(inspectionMs !== undefined ? { inspectionMs: Math.max(0, Math.round(inspectionMs)) } : {}),
    });
    void sendReport();
  }, [queueReport, sendReport]);

  function abandon() {
    if (!automatic || !attempt?.telemetry || pendingReport.current) return;
    const start = smartCubeTargetFacelets(attempt.scramble);
    if (!start) return;
    queueReport({
      runId: attempt.telemetry.runId, serverIssuedAt: attempt.issuedAt, scramble: attempt.scramble,
      durationMs: 0, moves: [], startFacelets: start, endFacelets: start, deviceBrand: 'Interrupted', deviceName: '', disconnected: true,
    });
    void sendReport();
  }

  function markSolving() {
    if (matchId && run.current) {
      void setCompetitionDuelPhase(matchId, run.current.attempt.attemptNumber, 'solving').catch(() => {});
    }
  }

  const canRetryStart = Boolean(attempt?.telemetry?.status === 'started' && startKeys.current.has(`${base}/${attempt.attemptNumber}/${attempt.issuedAt}`));
  return {
    enabled, competitionId, registrationId, matchId, automatic, videoRegistrationId, attempt, attemptKey, authorized, error, busy, revision,
    interrupted: Boolean(run.current?.disconnected || (attempt?.telemetry?.status === 'started' && !run.current && !canRetryStart)),
    reported: Boolean(run.current?.reported || attempt?.telemetry?.status === 'device_reported'),
    canPrepare: authorized && Boolean(attempt) && (!attempt?.telemetry || canRetryStart) && !run.current && !busy,
    canStart: () => authorized && Boolean(run.current && !run.current.reported),
    run: () => run.current,
    pendingReport: Boolean(pendingReport.current), begin, complete, abandon, markSolving, retry: sendReport,
  };
}
