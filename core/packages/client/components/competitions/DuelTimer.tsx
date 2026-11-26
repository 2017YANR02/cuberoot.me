'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { COMPETITION_STAGE_LIMIT_MS, inspectionPenalty } from '@cuberoot/shared/timer';
import { useT } from '@/hooks/useT';
import { formatWcaResult } from '@/lib/wca-format-result';
import { attemptValue } from './competition-results';
import { persistItem } from '@/lib/safe-storage';
import { recordCompetitionDuel, setCompetitionDuelPhase, type CompetitionAttemptResult, type CompetitionDuel } from '@/lib/online-competition-api';

import { useCompetitionTimerControls } from './useCompetitionTimerControls';
const DNF = { centiseconds: null, penalty: 'DNF' } as const;
type PendingResult = { result: CompetitionAttemptResult; key: string };

export function DuelTimer({ duel, clockOffset, onSaved }: { duel: CompetitionDuel; clockOffset: number; onSaved: () => void }) {
  const t = useT();
  const [localPhase, setLocalPhase] = useState<{ inspectAt: string | null; solveAt: string | null }>({ inspectAt: null, solveAt: null });
  const [clock, setClock] = useState(0);
  const [pending, setPending] = useState<PendingResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestActive = useRef(false);
  const key = `competition-duel-result:${duel.id}:${duel.gameNumber}`;
  const authority = duel.activeGame?.authoritativeTiming === true;
  const inspectAt = duel.activeGame?.inspectAt ?? localPhase.inspectAt;
  const solveAt = duel.activeGame?.solveAt ?? localPhase.solveAt;
  const limit = duel.activeGame?.inspectionSeconds ?? 15;
  const deadline = authority && duel.activeGame?.scrambleDeadlineAt ? Date.parse(duel.activeGame.scrambleDeadlineAt) : null;
  const now = clock ? clock + clockOffset : Date.parse(duel.serverNow);
  const inspection = inspectAt ? Math.max(0, now - Date.parse(inspectAt)) : 0;
  const inspectionStatus = inspectionPenalty(inspection, limit);
  const expired = solveAt ? now - Date.parse(solveAt) >= COMPETITION_STAGE_LIMIT_MS
    : inspectAt ? inspectionStatus === 'DNF' : deadline !== null && now >= deadline;

  useEffect(() => {
    if (pending || saved) return;
    const tick = () => setClock(performance.now());
    tick();
    const timer = setInterval(tick, solveAt ? 31 : 100);
    return () => clearInterval(timer);
  }, [pending, saved, solveAt]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? 'null') as PendingResult | null;
      if (stored && typeof stored.key === 'string' && ['none', '+2', 'DNF'].includes(stored.result?.penalty)
        && (stored.result.centiseconds === null || Number.isSafeInteger(stored.result.centiseconds))) setPending(stored);
    } catch { /* The current tab can still record this game. */ }
  }, [key]);

  function queue(result: CompetitionAttemptResult) {
    const submission = { result, key: crypto.randomUUID() };
    setPending(submission);
    persistItem(key, JSON.stringify(submission));
    return submission;
  }

  async function submit(submission: PendingResult) {
    if (requestActive.current || saved) return;
    requestActive.current = true;
    setBusy(true); setError('');
    try {
      const response = await recordCompetitionDuel(duel.id, duel.gameNumber, submission.result, submission.key);
      setPending({ ...submission, result: response.result });
      setSaved(true);
      try { localStorage.removeItem(key); } catch { /* The result is already on the server. */ }
      onSaved();
    } catch (cause) { setError(String(cause instanceof Error ? cause.message : cause)); }
    finally { requestActive.current = false; setBusy(false); }
  }

  async function changePhase(phase: 'inspecting' | 'solving' | 'timeout') {
    if (requestActive.current || pending || saved) return;
    requestActive.current = true;
    setBusy(true); setError('');
    const localNow = new Date(performance.now() + clockOffset).toISOString();
    try {
      const response = await setCompetitionDuelPhase(duel.id, duel.gameNumber, phase);
      if (response?.result) {
        setPending({ result: response.result, key: '' });
        setSaved(true);
        onSaved();
        return;
      }
      if (phase === 'timeout') return;
      setLocalPhase({
        inspectAt: response?.inspectAt ?? inspectAt ?? localNow,
        solveAt: response?.solveAt ?? (phase === 'solving' ? localNow : null),
      });
    } catch (cause) { setError(String(cause instanceof Error ? cause.message : cause)); }
    finally { requestActive.current = false; setBusy(false); }
  }

  function stop() {
    if (pending || saved || requestActive.current || !solveAt) return;
    const elapsed = performance.now() + clockOffset - Date.parse(solveAt);
    if (elapsed >= COMPETITION_STAGE_LIMIT_MS) { void changePhase('timeout'); return; }
    const centiseconds = Math.max(1, Math.floor(elapsed / 10));
    // Migrated games already in progress keep their original client-side inspection penalty.
    const legacyPenalty = inspectAt && !authority ? inspectionPenalty(Date.parse(solveAt) - Date.parse(inspectAt), limit) : 'ok';
    queue(legacyPenalty === 'DNF' ? DNF : { centiseconds, penalty: legacyPenalty === '+2' ? '+2' : 'none' });
  }

  // A client clock estimate can lead the service clock. Ask the service to
  // adjudicate instead of submitting a voluntary DNF when the display expires.
  const enforceExpiry = useEffectEvent(() => { void changePhase('timeout'); });
  useEffect(() => {
    if (!authority || !expired || pending || saved) return;
    enforceExpiry();
    const retry = setInterval(() => enforceExpiry(), 1000);
    return () => clearInterval(retry);
  }, [authority, expired, pending, saved]);

  const { ready: heldReady } = useCompetitionTimerControls({
    phase: solveAt ? 'solve' : inspectAt ? 'inspection' : 'scramble',
    disabled: !!pending || saved || busy || expired,
    onInspect: () => { void changePhase('inspecting'); },
    onStart: () => { void changePhase('solving'); },
    onStop: stop,
  });

  const result = pending?.result;
  const elapsedCentiseconds = solveAt ? Math.max(0, Math.floor((now - Date.parse(solveAt)) / 10)) : 0;
  const display = result ? formatWcaResult(attemptValue({ ...result, penalty: result.penalty === '+2' ? 'none' : result.penalty }), duel.project, 'single') + (result.penalty === '+2' ? ' +2' : '')
    : expired ? 'DNF' : solveAt ? (elapsedCentiseconds ? formatWcaResult(elapsedCentiseconds, duel.project, 'single') : '0.00')
      : inspectAt ? inspectionStatus === '+2' ? '+2' : `${Math.max(0, Math.ceil((limit * 1000 - inspection) / 1000))}s`
        : deadline === null ? `${limit}s` : `${Math.max(0, Math.ceil((deadline - now) / 1000))}s`;

  return <div className="competition-duel-timer">
    <output aria-label={t('对战计时', 'Match timer')} aria-live="off" data-ready={heldReady || undefined}>{display}</output>
    <p className="competition-muted">{solveAt ? t('按任意键或点击停表。', 'Press any key or tap to stop.')
      : inspectAt ? t('长按空格准备，松开起表。', 'Hold Space to get ready, then release to start.')
        : t('打乱后按空格进入观察。', 'Press Space after scrambling to start inspection.')}</p>
    {heldReady && <p role="status">{t('已就绪，松开空格起表。', 'Ready. Release Space to start.')}</p>}
    <div className="competition-toolbar">
      {pending ? <button className="competition-primary" type="button" disabled={busy || saved} onClick={() => void submit(pending)}>{t('提交本局成绩', 'Submit game result')}</button>
        : <button className="competition-primary" type="button" disabled={busy || expired} data-competition-timer-control
          onClick={solveAt ? stop : () => void changePhase(inspectAt ? 'solving' : 'inspecting')}>{solveAt ? t('停表', 'Stop timer') : inspectAt ? t('开始还原', 'Start solve') : t('打乱完成，开始观察', 'Scrambled, start inspection')}</button>}
      {!pending && <button className="competition-secondary" type="button" disabled={busy} onClick={() => queue(DNF)}>DNF</button>}
    </div>
    {error && <p className="competition-error" role="alert">{error}</p>}
  </div>;
}
