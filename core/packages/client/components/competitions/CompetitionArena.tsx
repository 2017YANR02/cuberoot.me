'use client';

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { CircleCheck, CircleMinus, Play, Trophy } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { competitionHref } from '@/lib/competition-links';
import { TimerScrambleStrip } from '@cuberoot/timer-ui';
import { COMPETITION_CHECK_IN_LEAD_MS, type Solve } from '@cuberoot/shared/timer';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import MoreToggle from '@/components/MoreToggle';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { displayCuberName } from '@/lib/cuber-name-display';
import { competitionDateTime } from '@/lib/competition-date';
import { formatWcaResult } from '@/lib/wca-format-result';
import {
  checkInCompetition, completeCompetitionSelfAttempt, getCompetitionArena, getCompetitionAttemptReplay, getCompetitionDuel, getCompetitionDuelReplay,
  nextCompetitionSelfAttempt, readyCompetitionArena, readyCompetitionDuel, setCompetitionArenaPhase,
  type CompetitionCheckInDevice, type CompetitionEvidence, type CompetitionSelfResult,
  type CompetitionArenaAttempt, type CompetitionArenaPlayer, type CompetitionAttemptResult,
  type CompetitionBracketMatch, type CompetitionBracketStanding, type CompetitionDuelGame, type CompetitionRegistration, type OnlineCompetition,
} from '@/lib/online-competition-api';
import { persistItem } from '@/lib/safe-storage';
import { useCompetitionCube } from './useCompetitionCube';
import { ArenaBoardToggle, ArenaCountdown, ArenaLobby, ArenaReadinessDeadline, ArenaIdentity, ArenaLocalCube, ArenaRemoteCube, ArenaReadout, ArenaStatus, ArenaTop, arenaPersonReadout, type ArenaCube, type Readout } from './CompetitionArenaParts';
import { CompetitionRecap, CompetitionReplayButton, CompetitionReplayDialog, replaySolve } from './CompetitionReconstruction';
import { ao5ReportData, CompetitionRank, CompetitionReport, CompetitionReportShare, useCompetitionResults } from './CompetitionReport';
import { attemptValue, competitionAo5, competitionBracketRound, competitionMatchCode, competitionMatchFeeder, rankArena, validResult } from './competition-results';
import { CompetitionSelfTimer } from './CompetitionSelfTimer';
import { CompetitionMatchEnter, CompetitionMatchFeeder, CompetitionMatchPassport } from './CompetitionMatchPassport';
import { DuelTimer } from './DuelTimer';
import type { CompetitionCameraState } from './CompetitionVideoRoom';
import './competition-arena.css';

const VideoRoom = dynamic(() => import('./CompetitionVideoRoom').then(module => module.CompetitionVideoRoom), { ssr: false });
const SelfRecording = dynamic(() => import('./CompetitionVideoRoom').then(module => module.CompetitionSelfRecording), { ssr: false });

function useSnapshot<T extends { serverNow: string }>(id: string | null, load: (id: string) => Promise<T>) {
  const [snapshot, setSnapshot] = useState<{ id: string; value: T; offset: number } | null>(null);
  const [error, setError] = useState('');
  const read = useRef<() => void>(() => {});
  const refresh = useCallback(() => read.current(), []);
  useEffect(() => {
    if (!id) return;
    let active = true;
    let pending = false;
    let queued = false;
    const get = async (urgent = false) => {
      if (!active) return;
      if (pending) { queued ||= urgent; return; }
      pending = true;
      queued = false;
      const sent = performance.now();
      try {
        const value = await load(id);
        const received = performance.now();
        if (active) {
          const measured = Date.parse(value.serverNow) - (sent + received) / 2;
          setSnapshot(previous => ({ id, value, offset: previous?.id === id && Math.abs(previous.offset - measured) < 100 ? previous.offset : measured }));
          setError('');
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        pending = false;
        if (queued) void get();
      }
    };
    read.current = () => void get(true);
    void get();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void get(); }, 1200);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [id, load, refresh]);
  return { snapshot: snapshot?.id === id ? snapshot : null, error, refresh };
}

function useReveal(at: number | null, refresh: () => void) {
  useEffect(() => {
    if (at === null) return;
    const timer = setTimeout(refresh, Math.max(0, at - performance.now()) + 20);
    return () => clearTimeout(timer);
  }, [at, refresh]);
}

function useReady(enabled: boolean, ready: (key: string) => Promise<unknown>, refresh: () => void) {
  const [error, setError] = useState('');
  const action = useEffectEvent(ready);
  useEffect(() => {
    if (!enabled) return;
    setError('');
    const key = crypto.randomUUID();
    let active = true;
    let sending = false;
    const submit = async () => {
      if (!active || sending) return;
      sending = true;
      try { await action(key); if (active) { setError(''); refresh(); } }
      catch (cause) { if (active) setError(cause instanceof Error ? cause.message : String(cause)); }
      finally { sending = false; }
    };
    void submit();
    const retry = setInterval(() => void submit(), 2500);
    return () => { active = false; clearInterval(retry); };
  }, [enabled, refresh]);
  return enabled ? error : '';
}

function useSmartCubeCheckIn(id: string | null, checkedIn: boolean, cube: ArenaCube, onCheckedIn: () => void) {
  const [current, setCurrent] = useState<{ id: string; status: 'saving' | 'checked' | 'error' } | null>(null);
  const saving = useRef<string | null>(null);
  const { connected, brand, deviceName: rawName } = cube.cube.status;
  const facelets = cube.cube.facelets;
  const deviceName = rawName?.trim();
  const device: CompetitionCheckInDevice | null = connected && brand && brand.length <= 100
    && deviceName && deviceName.length <= 100 && facelets?.length === 54 && /^[URFDLB]{54}$/.test(facelets)
    && [...'URFDLB'].every(face => facelets.split(face).length === 10)
    ? { deviceBrand: brand, deviceName, facelets } : null;
  const status = current?.id === id ? current?.status : undefined;
  const confirmed = checkedIn || status === 'checked';

  async function submit() {
    if (!id || !device || confirmed || saving.current === id) return;
    saving.current = id;
    setCurrent({ id, status: 'saving' });
    try {
      await checkInCompetition(id, device);
      setCurrent({ id, status: 'checked' });
      onCheckedIn();
    } catch {
      setCurrent({ id, status: 'error' });
    } finally {
      if (saving.current === id) saving.current = null;
    }
  }

  const autoSubmit = useEffectEvent(submit);
  const deviceReady = !!device;
  // Pairing and the first state packet can finish at different times.
  useEffect(() => {
    if (id && !confirmed && deviceReady) void autoSubmit();
  }, [id, confirmed, deviceReady]);

  return {
    confirmed, deviceReady, pending: !!id && !confirmed,
    busy: status === 'saving', error: status === 'error' && !confirmed,
    activate: () => connected ? submit() : cube.openDevice(true),
  };
}

function SmartCubeCheckInPrompt({ cube, checkIn }: { cube: ArenaCube; checkIn: ReturnType<typeof useSmartCubeCheckIn> }) {
  const t = useT();
  const connected = cube.cube.status.connected;
  return <div className="competition-arena-check-in">
    {!connected && <p>{t('唤醒魔方后配对。若需要 MAC 地址，按弹窗指引填写。',
      'Wake your cube and pair it. If asked for a MAC address, follow the dialog instructions.')}{checkIn.pending &&
      t(' 连接后自动检录。', ' Check-in is automatic after pairing.')}</p>}
    <button type="button" className="competition-primary"
      disabled={cube.connecting || checkIn.busy || (connected && !checkIn.deviceReady)}
      onClick={() => void checkIn.activate()}>
      {checkIn.busy ? t('检录中…', 'Checking in…')
        : !connected ? checkIn.pending ? t('连接魔方并检录', 'Connect cube and check in') : t('连接魔方', 'Connect cube')
          : checkIn.deviceReady ? t('检录', 'Check in') : t('正在读取魔方状态…', 'Reading cube state…')}
    </button>
    {checkIn.error && <span role="alert">{t('检录失败，请重试', 'Check-in failed. Try again.')}</span>}
  </div>;
}

function ArenaReadiness({ preparing, videoId, supervisorIdentity, camera, onCameraState, localRecording, recording, onRecordingChange, error, duel = false }: {
  preparing: boolean; videoId?: string | null; supervisorIdentity?: string | null; camera: CompetitionCameraState;
  onCameraState(state: CompetitionCameraState): void;
  localRecording: boolean; recording: boolean; onRecordingChange(active: boolean): void;
  error: string; duel?: boolean;
}) {
  const t = useT();
  const cameraBlocked = error === 'The entrant and supervisor must both be connected with their cameras on'
    || error === 'The entrant and independent supervisor must be checked in with their cameras connected';
  const cameraMessage = videoId && (preparing || cameraBlocked) ? {
    disconnected: t('开启摄像头后才能开赛。', 'Turn on your camera before the arena can start.'),
    connecting: t('正在连接监督视频…', 'Connecting to supervision video…'),
    camera_off: t('请在监督视频中开启摄像头。', 'Turn on your camera in the video panel.'),
    waiting_for_supervisor: t('等待裁判进入监督视频并开启摄像头。', 'Waiting for your judge to join and turn on their camera.'),
    ready: cameraBlocked ? duel
      ? t('本席摄像头已就绪，等待对手及其裁判完成检录和摄像头检查。', 'Your video is ready. Waiting for the opponent and their judge to complete check-in and camera checks.')
      : t('正在确认双方摄像头已开启…', 'Confirming that both cameras are on…')
      : '',
  }[camera] : '';
  return <div className="competition-arena-support" data-preparing={preparing || undefined}>
    {videoId && <details open={preparing || undefined}>
      <MoreToggle as="summary">{t('监督视频', 'Supervision video')}</MoreToggle>
      {cameraMessage && <p className="competition-arena-readiness-message" role="status">{cameraMessage}</p>}
      <VideoRoom key={videoId} {...(duel ? { matchId: videoId, supervisorIdentity } : { registrationId: videoId })}
        onCameraState={onCameraState} prominent={preparing} />
    </details>}
    {localRecording && <div>
      {preparing && !recording && <p className="competition-arena-readiness-message" role="status">
        {t('开始本机录制后即可开赛。', 'Start a local recording to get ready.')}
      </p>}
      <SelfRecording onRecordingChange={onRecordingChange} primaryStart={preparing} />
    </div>}
    {error && !cameraBlocked && <p role="status">{error}</p>}
  </div>;
}

function useWaitingReplay(id: string, number: number, waiting: boolean, duel: boolean) {
  const [loaded, setLoaded] = useState<{ id: string; solve: Solve } | null>(null);
  const key = `${id}:${number}`;
  useEffect(() => {
    if (!waiting) return;
    let active = true;
    const request = duel ? getCompetitionDuelReplay(id, number).then(res => res.own)
      : getCompetitionAttemptReplay(id, number).then(res => res.report);
    void request.then(report => {
      const solve = replaySolve(key, report);
      if (active && solve) setLoaded({ id: key, solve });
    }).catch(() => {});
    return () => { active = false; };
  }, [id, number, waiting, duel, key]);
  return waiting && loaded?.id === key ? loaded.solve : null;
}

function SmartScramble({ scramble, cube, readout, round, smart }: { scramble: string; cube: ArenaCube; readout: Readout; round: number; smart: boolean }) {
  const t = useT();
  return <div className="competition-arena-scramble" data-stage={readout.stage} data-smart={smart || undefined}>
    {scramble && <TimerScrambleStrip key={`${round}:${scramble}`} scramble={scramble} compact hint={cube.guidance.hint} match={cube.guidance.match}
      correctionActive={cube.guidance.correctionActive} copiedLabel={t('已复制', 'Copied')}
      verificationLabels={{ copiedCorrection: t('已复制纠错步', 'Correction copied') }} />}
  </div>;
}

function localReadout(cube: ArenaCube, fallback: Readout): Readout {
  const phase = cube.phase;
  if (fallback.result || !phase) return fallback;
  if (phase.kind === 'finished') return { stage: phase.kind, at: phase.at, reason: phase.reason, duration: phase.durationMs };
  return { stage: phase.kind, at: phase.at, ...(phase.kind === 'running' ? { inspectionMs: phase.inspectionMs } : {}) };
}

function attemptText(result: CompetitionAttemptResult | CompetitionArenaAttempt | null, project: string) {
  return result?.penalty ? formatWcaResult(attemptValue(result), project, 'single') + (result.penalty === '+2' ? ' (+2)' : '') : '—';
}

function ArenaRankings({ rows, id, project, number, finished, allowReplay, final = false, overall = false, publishedRanks }: {
  rows: ReturnType<typeof rankArena>; id: string; project: string; number: number; finished: number; allowReplay: boolean; final?: boolean; overall?: boolean; publishedRanks?: ReadonlyMap<string, number | null | undefined>;
}) {
  const t = useT();
  const table = useRef<HTMLTableSectionElement>(null);
  const previous = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    for (const row of Array.from(table.current?.rows ?? [])) {
      if (!row.dataset.player || row.offsetHeight === 0) continue;
      const top = row.offsetTop;
      const before = previous.current.get(row.dataset.player);
      if (!reduce && before !== undefined && before !== top && row.dataset.own === undefined) {
        row.animate?.([{ transform: `translateY(${before - top}px)` }, { transform: 'none' }],
          { duration: 220, easing: 'cubic-bezier(.22, 1, .36, 1)' });
      }
      next.set(row.dataset.player, top);
    }
    previous.current = next;
  }, [rows]);
  return <aside className="competition-arena-board">
    <header data-site-surface="heading">
      <strong>{final ? t('最终排名', 'Final standings') : t('实时排名', 'Live standings')} · {number}/5</strong><span>{finished}/{rows.length}</span>
      <progress value={finished} max={rows.length || 1} aria-label={t('本轮完赛进度', 'Round completion')} />
    </header>
    <table><colgroup><col className="competition-arena-rank-column" /><col /><col className="competition-arena-result-column" /></colgroup>
      <thead><tr><th scope="col">{t('名次', 'Rank')}</th><th scope="col">{t('选手', 'Competitor')}</th><th scope="col">{t('成绩', 'Result')}</th></tr></thead>
      <tbody ref={table}>{rows.map(({ player, metrics, count, current }, index) => {
        const value = overall && count === 5 ? formatWcaResult(metrics.average, project, 'average')
          : current?.penalty ? attemptText(current, project) : current?.solveAt ? t('复原中', 'Solving')
            : current?.inspectAt ? t('观察中', 'Inspecting') : current ? t('打乱中', 'Scrambling') : '—';
        return <tr key={player.id} data-player={player.id} data-own={player.id === id || undefined}>
          <td><CompetitionRank rank={publishedRanks ? publishedRanks.get(player.id) : index + 1} final={final} /></td>
          <th scope="row"><ArenaIdentity person={player} /></th>
          <td><strong data-dnf={current?.penalty === 'DNF' || undefined}>
            {current?.replay && allowReplay ? <CompetitionReplayButton registrationId={player.id} number={number}>{value}</CompetitionReplayButton> : value}
          </strong>
            {count > 0 && <small>{overall ? `${t('最佳', 'Best')} ${formatWcaResult(metrics.best, project, 'single')}`
              : count === 5 ? `Ao5 ${formatWcaResult(metrics.average, project, 'average')}`
              : count >= 3 ? `BPA ${formatWcaResult(metrics.bpa, project, 'average')}`
                : `${t('最佳', 'Best')} ${formatWcaResult(metrics.best, project, 'single')}`}</small>}
          </td>
        </tr>;
      })}</tbody>
    </table>
  </aside>;
}

function AttemptsDock({ id, project, number, allowReplay, attempts }: {
  id: string; project: string; number: number; allowReplay: boolean; attempts: CompetitionArenaAttempt[];
}) {
  const t = useT();
  const scores = attempts.flatMap(attempt => validResult(attempt) ?? []);
  const summary = competitionAo5(scores, project);
  return <div className="competition-arena-dock">
    <ol aria-label={t('个人五把成绩', 'Your five attempts')}>
      {Array.from({ length: 5 }, (_, index) => {
        const n = index + 1;
        const attempt = attempts.find(a => a.attemptNumber === n);
        const label = attempt?.penalty === '+2' ? formatWcaResult(attemptValue(attempt), project, 'single') : attemptText(attempt ?? null, project);
        return <li key={n} data-current={number === n || undefined} data-recorded={!!attempt?.penalty || undefined}
          aria-current={number === n ? 'step' : undefined}>
          <span>#{n}</span><strong data-dnf={attempt?.penalty === 'DNF' || undefined}>
            {attempt?.replay && allowReplay ? <CompetitionReplayButton registrationId={id} number={n}>{label}</CompetitionReplayButton> : label}
          </strong>
          {attempt?.penalty === '+2' && <small>+2</small>}
        </li>;
      })}
    </ol>
    {scores.length > 0 && <div className="competition-arena-summary">
      <span>{t('最佳', 'Best')} <strong>{formatWcaResult(summary.best, project, 'single')}</strong></span>
      {scores.length >= 3 && (scores.length === 5 ? <span>Ao5 <strong>{formatWcaResult(summary.average, project, 'average')}</strong></span>
        : <><span>BPA <strong>{formatWcaResult(summary.bpa, project, 'average')}</strong></span>
          <span>WPA <strong>{formatWcaResult(summary.wpa, project, 'average')}</strong></span></>)}
    </div>}
  </div>;
}

export function CompetitionAo5Arena({ competition, registration, legacySeat, reviewActions, evidence, onCheckedIn, onFinished, resultRevision = 0 }: {
  competition: OnlineCompetition; registration: CompetitionRegistration; legacySeat: ReactNode; reviewActions?: ReactNode;
  onCheckedIn?: () => void; onFinished?: () => void; resultRevision?: number;
  evidence?: (number: number, onFilesChange: (files: CompetitionEvidence[]) => void) => ReactNode;
}) {
  const t = useT();
  const id = registration.id;
  const smart = registration.device === 'smart';
  const supervised = registration.sessionKind === 'supervised';
  const { snapshot, error, refresh } = useSnapshot(id, getCompetitionArena);
  const [recording, setRecording] = useState(false);
  const [camera, setCamera] = useState<CompetitionCameraState>('disconnected');
  const [replay, setReplay] = useState<Solve | null>(null);
  const [dismissed, setDismissed] = useState('');
  const value = snapshot?.value;
  const offset = snapshot?.offset ?? 0;
  const number = value?.roundNumber ?? 1;
  const own = value?.players.find(player => player.id === id);
  const attempt = own?.attempts.find(item => item.attemptNumber === number);
  const result = validResult(attempt);
  const opened = value?.startsAt && value.scramble && value.seated ? value.startsAt : null;
  const countdownAt = value?.startsAt && !value.scramble && value.seated ? Date.parse(value.startsAt) - offset : null;
  const displayNumber = countdownAt !== null && number > 1 ? number - 1 : number;
  const displayedAttempt = own?.attempts.find(item => item.attemptNumber === displayNumber);
  const displayedResult = validResult(displayedAttempt);
  const recorded = !!registration.resultRecordedAt;
  const completed = !!value && (recorded || (value.legacy ? value.completed : !!own?.attempts.some(item => item.attemptNumber === 5 && !!item.penalty)));
  const wasPlaying = useRef(false);
  const [settled, setSettled] = useState(false);
  const finish = useEffectEvent(() => {
    if (wasPlaying.current || !recorded) onFinished?.();
  });
  const playing = !!value?.seated && !completed;
  useEffect(() => {
    if (playing) wasPlaying.current = true;
  }, [playing]);
  useEffect(() => {
    if (!completed) return;
    finish();
    if (wasPlaying.current) {
      const timer = setTimeout(() => setSettled(true), 1800);
      return () => clearTimeout(timer);
    }
  }, [completed]);
  const settling = completed && wasPlaying.current && !settled;
  const lobbyAt = value?.waitingForStart && value.sessionStartsAt ? Date.parse(value.sessionStartsAt) - offset : null;
  useReveal(completed ? null : countdownAt ?? lobbyAt, refresh);
  const cube = useCompetitionCube({
    id, duel: false, smart, roomId: completed || value?.completed ? null : value?.roomId ?? null,
    credentials: value?.credentials ?? null, roundNumber: number,
    round: opened && value?.scramble ? { number, issued: opened, scramble: value.scramble, inspectAt: value.inspectAt } : null,
    settled: completed || !!result || !value?.seated, offset, refresh,
  });
  const checkedIn = value?.checkedIn ?? !!registration.checkedInAt;
  const checkIn = useSmartCubeCheckIn(smart && value && registration.canCheckIn ? id : null, checkedIn, cube, () => {
    refresh();
    onCheckedIn?.();
  });
  const ready = (smart ? checkIn.deviceReady : supervised || recording) && (!supervised || camera === 'ready');
  const needsSeat = value?.legacy ? smart && registration.sessionKind === 'self_service' && !value.scramble : !value?.seated && !value?.ownReady;
  const canReady = !!value && needsSeat && !value.completed && !completed && checkIn.confirmed && ready;
  const readyError = useReady(canReady, key => value?.legacy ? nextCompetitionSelfAttempt(id) : readyCompetitionArena(id, key), refresh);
  const readout = countdownAt === null
    ? localReadout(cube, arenaPersonReadout(opened, value?.inspectAt, value?.solveAt, offset, result, attempt?.dnfReason, smart))
    : arenaPersonReadout(null, null, null, offset, displayedResult, displayedAttempt?.dnfReason);
  const rows = useMemo(() => rankArena(value?.players ?? [], displayNumber, registration.project), [value?.players, displayNumber, registration.project]);
  const finished = rows.filter(row => row.current?.penalty).length;
  const allowReplay = readout.stage === 'finished';
  const restored = useWaitingReplay(id, displayNumber, !!displayedAttempt?.replay && allowReplay && !cube.recap, false);
  const selectedRecap = cube.recap ?? restored;
  const recap = allowReplay && selectedRecap?.id !== dismissed && displayedResult?.penalty !== 'DNF' ? selectedRecap : null;
  const priorBest = own?.attempts.filter(item => item.attemptNumber < displayNumber && attemptValue(item) > 0)
    .reduce((best, item) => Math.min(best, attemptValue(item)), Infinity) ?? Infinity;
  const best = !!displayedResult && attemptValue(displayedResult) > 0 && attemptValue(displayedResult) < priorBest;
  useEffect(() => { if (!allowReplay || (completed && !settling)) setReplay(null); }, [allowReplay, completed, settling]);

  if (!snapshot) return <div className="competition-arena" data-no-timer>
    <ArenaTop competition={competition} project={registration.project} round="Ao5" status={null} />
    {error ? <p role="alert">{error}</p> : <LoadingIndicator>{t('正在打开赛场…', 'Opening arena…')}</LoadingIndicator>}
  </div>;
  if (completed && !settling) {
    return <Ao5Settlement competition={competition} registration={registration} attempts={own?.attempts ?? []}
      players={value?.roomId ? value.players : []} resultRevision={resultRevision} reviewActions={reviewActions} />;
  }
  if (value?.legacy && !smart) {
    return <div className="competition-arena" data-no-timer>
      <ArenaTop competition={competition} project={registration.project} round="Ao5" status={null} />
      {legacySeat}
    </div>;
  }

  const leaderboard = <ArenaRankings rows={rows} id={id} project={registration.project}
    number={displayNumber} finished={finished} allowReplay={allowReplay} />;
  const ownRank = rows.findIndex(row => row.player.id === id);
  const beforeSolve = !opened || readout.stage === 'scrambling';
  const preparing = (needsSeat || (beforeSolve && (supervised ? camera !== 'ready' : !smart && !recording))) && !value?.completed && !completed;
  const showCheckIn = !completed && !value?.completed && smart && (checkIn.pending || (beforeSolve && !cube.cube.status.connected));
  const showScramble = !!opened && !settling && countdownAt === null && !result && readout.stage !== 'finished';
  const showReadout = !!opened || !!displayedResult || settling;
  return <div className="competition-arena competition-arena--ao5" data-running={readout.stage === 'running' || undefined} data-no-timer>
    <div className="competition-arena-shell">
      <ArenaTop competition={competition} project={registration.project} round={`R${number} / 5`} cube={smart ? cube : undefined}
        showConnectionPrompt={showCheckIn} status={<ArenaStatus readout={readout} countdownAt={countdownAt} finished={finished} total={rows.length}
          completed={completed || !!value?.completed} ready={ready} correction={cube.guidance.correctionActive} cube={smart ? cube : undefined} />} />
      {!completed && !value?.completed && <ArenaReadiness preparing={preparing} videoId={supervised && checkIn.confirmed ? id : null}
        camera={camera} onCameraState={setCamera} localRecording={!smart && !supervised && checkIn.confirmed}
        recording={recording} onRecordingChange={setRecording} error={error || readyError || (cube.syncError ? t('等待同步…', 'Syncing…') : '')} />}
      <div className="competition-arena-grid" data-board={rows.length > 0 || undefined}>
        {rows.length > 0 && <>
          <div className="competition-arena-desktop-board">{leaderboard}</div>
          <ArenaBoardToggle stage={readout.stage} summary={<>
            {ownRank >= 0 && <strong>{t(`第 ${ownRank + 1} / ${rows.length} 名`, `Rank ${ownRank + 1} / ${rows.length}`)}</strong>}
            <span>{t('榜首', 'Leader')} {attemptText(rows[0].current ?? null, registration.project)}</span>
            <span>{t('完赛', 'Finished')} {finished}/{rows.length}</span>
          </>}>{leaderboard}</ArenaBoardToggle>
        </>}
        <section className="competition-arena-stage" data-stage={readout.stage}>
          {showCheckIn && <SmartCubeCheckInPrompt cube={cube} checkIn={checkIn} />}
          {showScramble && <SmartScramble round={number} scramble={value?.scramble ?? ''} cube={cube} readout={readout} smart={smart} />}
          {(smart || showScramble) &&
            <ArenaLocalCube cube={smart ? cube : undefined} project={registration.project} scramble={value?.scramble ?? ''} />}
          {showReadout && (showScramble && !smart && !completed ? <OrdinaryAo5Attempt key={number} id={id} number={number}
            project={registration.project} recording={recording} supervised={supervised} refresh={refresh} evidence={evidence} />
            : <ArenaReadout value={readout} project={registration.project} moves={selectedRecap?.moves?.length ?? cube.moves} best={best} automatic={smart} />)}
          {lobbyAt !== null && value?.waitingForStart && <ArenaLobby at={lobbyAt}
            total={value.totalEntrants} ready={value.readyCount} players={value.lobbyPlayers} />}
          {countdownAt !== null && <ArenaCountdown key={number} at={countdownAt} number={number} />}
          {settling && <p className="competition-arena-finish" role="status">{t('五把完成', 'Five attempts complete')}</p>}
          {value?.completed && !value.seated && <p role="status">{t('本场轮次已结束', 'All rounds have ended')}</p>}
          <AttemptsDock id={id} project={registration.project} number={displayNumber} allowReplay={allowReplay} attempts={own?.attempts ?? []} />
          {recap && <CompetitionRecap key={recap.id} solve={recap} onDismiss={() => setDismissed(recap.id)} onFull={() => setReplay(recap)} />}
        </section>
      </div>
    </div>
    {allowReplay && replay && <CompetitionReplayDialog own={replay} onClose={() => setReplay(null)} />}
  </div>;
}

function Ao5Settlement({ competition, registration, attempts, players, resultRevision, reviewActions }: {
  competition: OnlineCompetition; registration: CompetitionRegistration; attempts: CompetitionArenaAttempt[];
  players: CompetitionArenaPlayer[];
  resultRevision: number; reviewActions?: ReactNode;
}) {
  const t = useT();
  const lang = useLang();
  const { results, error } = useCompetitionResults(competition.id, resultRevision);
  const { id, project, device } = registration;
  const published = results.find(row => row.id === id);
  const division = results.filter(row => row.project === project && row.device === device);
  const final = !!competition.finalizedAt;
  const publishedStandings = division.length > 0 && (final || !players.length);
  const rows = rankArena(publishedStandings ? division.map(row => ({
    id: row.id, name: row.displayName, wcaId: row.wcaId ?? null, countryCode: row.countryCode ?? null,
    attempts: row.attempts.map((attempt, index) => ({
      ...attempt, attemptNumber: index + 1, inspectAt: null, solveAt: null, dnfReason: null, replay: false,
    })),
  })) : players, 5, project);
  const ownRank = rows.findIndex(row => row.player.id === id);
  const scores = published?.attempts ?? registration.attempts ?? attempts.flatMap(attempt => validResult(attempt) ?? []);
  const report = scores.length === 5 ? ao5ReportData(competition, {
    ...registration, attempts: scores, rank: published ? published.rank : ownRank >= 0 ? ownRank + 1 : null,
    recordedAt: registration.resultRecordedAt ?? undefined, finalizedAt: published?.finalizedAt ?? competition.finalizedAt ?? null,
  }, t, lang) : null;
  const finished = rows.filter(row => row.count === 5).length;
  return <div className="competition-arena" data-no-timer>
    <ArenaTop competition={competition} project={project} round="Ao5" status={null} />
    <div className="competition-arena-settlement">
      <div className="competition-arena-settlement-summary">
        {report ? <CompetitionReport data={report} share={false} renderAttempt={(label, number) => {
          const privateReplay = attempts.some(attempt => attempt.attemptNumber === number && attempt.replay);
          const publicReplay = !!published?.replayAttempts?.includes(number);
          return privateReplay || publicReplay
            ? <CompetitionReplayButton registrationId={id} number={number} publicReplay={!privateReplay && publicReplay && !!published?.finalizedAt && !competition.isTest}>{label}</CompetitionReplayButton>
            : label;
        }} /> : <p role="status">{t('已完赛，成绩已记录。', 'Finished. Your result is recorded.')}</p>}
        <div className="competition-toolbar competition-arena-settlement-actions">
          {report && <CompetitionReportShare data={report} />}
          <AppLink className="competition-primary" href={`${competitionHref(competition.slug || competition.id)}#competition-results`} prefetch={false}>
            {t('查看比赛总榜', 'View overall results')}
          </AppLink>
        </div>
        {reviewActions && <details className="competition-rules">
          <MoreToggle as="summary">{t('成绩复核与录像', 'Result review and recordings')}</MoreToggle>
          {reviewActions}
        </details>}
      </div>
      {rows.length > 0 && <ArenaRankings rows={rows} id={id} project={project} number={5} finished={finished} allowReplay={false}
        final={final} overall publishedRanks={publishedStandings ? new Map(division.map(row => [row.id, row.rank])) : undefined} />}
      {error && <p className="competition-error" role="alert">{error}</p>}
    </div>
  </div>;
}

function OrdinaryAo5Attempt({ id, number, project, recording, supervised, refresh, evidence }: {
  id: string; number: number; project: string; recording: boolean; supervised: boolean; refresh(): void;
  evidence?: (number: number, onFilesChange: (files: CompetitionEvidence[]) => void) => ReactNode;
}) {
  const t = useT();
  const [pending, setPending] = useState<{ key: string; result: CompetitionSelfResult } | null>(null);
  const [error, setError] = useState(false);
  const [external, setExternal] = useState(false);
  const [seconds, setSeconds] = useState('');
  const [penalty, setPenalty] = useState<'none' | '+2' | 'DNF'>('none');
  const [files, setFiles] = useState<CompetitionEvidence[]>([]);
  const saving = useRef(false);
  const recorded = useRef(recording);
  recorded.current ||= recording;
  const clip = files.find(file => file.attemptNumber === number);
  const canSubmit = recorded.current || !!clip;
  const storageKey = `competition-arena-time:${id}:${number}`;
  const phaseWrite = useRef(Promise.resolve<unknown>(null));
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (value?.key && value?.result) setPending(value);
    } catch { /* The tab can still time a new attempt. */ }
  }, [storageKey]);
  async function save(submission: NonNullable<typeof pending>) {
    if (saving.current) return;
    saving.current = true;
    try {
      await phaseWrite.current.catch(() => {});
      await completeCompetitionSelfAttempt(id, number, submission.result, submission.key);
      try { localStorage.removeItem(storageKey); } catch { /* Already recorded. */ }
      setError(false);
      refresh();
    } catch { setError(true); }
    finally { saving.current = false; }
  }
  function record(result: CompetitionAttemptResult) {
    if (supervised || !canSubmit) return;
    const proof = clip ? { recordingEvidenceId: clip.id } : { recordedLocally: true as const };
    const submission = { key: crypto.randomUUID(), result: { ...result, ...proof } };
    setPending(submission);
    persistItem(storageKey, JSON.stringify(submission));
    void save(submission);
  }
  const valid = /^\d+(?:\.\d{1,2})?$/.test(seconds) && Number(seconds) > 0 && Number(seconds) < 120;
  return <div className="competition-arena-ordinary">
    {!pending && !supervised && <select className="platform-field-control" aria-label={t('计时方式', 'Timing mode')}
      value={external ? 'external' : 'built_in'} onChange={event => setExternal(event.target.value === 'external')}>
      <option value="built_in">{t('内置计时', 'Built-in timer')}</option>
      <option value="external">{t('外接计时器', 'External timer')}</option>
    </select>}
    {!external && !pending && <CompetitionSelfTimer project={project} disabled={!canSubmit && !supervised}
      onPhase={(phase, elapsed) => {
        phaseWrite.current = phaseWrite.current.catch(() => {}).then(() => setCompetitionArenaPhase(id, number, phase, crypto.randomUUID(), elapsed));
        void phaseWrite.current.catch(() => setError(true));
      }} onResult={record} />}
    {external && !pending && <div className="competition-score-form">
      <label>{t('用时（秒）', 'Time (seconds)')}<input className="platform-field-control" type="number" inputMode="decimal"
        min="0.01" max="119.99" step="0.01" value={seconds} disabled={penalty === 'DNF'} onChange={event => setSeconds(event.target.value)} /></label>
      <label>{t('罚时', 'Penalty')}<select className="platform-field-control" value={penalty}
        onChange={event => setPenalty(event.target.value as typeof penalty)}>
        <option value="none">{t('无', 'None')}</option><option value="+2">+2</option><option value="DNF">DNF</option>
      </select></label>
      <button type="button" className="competition-primary" disabled={!canSubmit || (!valid && penalty !== 'DNF')}
        onClick={() => record({ centiseconds: penalty === 'DNF' ? null : Math.round(Number(seconds) * 100), penalty })}>
        {t('提交成绩', 'Submit result')}
      </button>
    </div>}
    {!supervised && !pending && !recorded.current && evidence?.(number, setFiles)}
    {pending && <output aria-live="off">{formatWcaResult(attemptValue(pending.result), project, 'single')}</output>}
    {error && pending && <button className="competition-secondary" type="button" onClick={() => void save(pending)}>{t('重试提交', 'Retry submission')}</button>}
    {supervised && <small>{t('由监督员确认成绩', 'Supervisor confirms the result')}</small>}
  </div>;
}

export function CompetitionDuelArena({ id = '', competition, checkInEntry, matches, standings, reviewActions, onCheckedIn, onMatchSettled, onNextMatch }: {
  id?: string; competition: OnlineCompetition; checkInEntry?: CompetitionRegistration; onCheckedIn?: () => void;
  matches?: CompetitionBracketMatch[];
  standings?: CompetitionBracketStanding[];
  reviewActions?: (registrationId: string) => ReactNode;
  onMatchSettled?: () => void;
  onNextMatch: (id: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  const { snapshot, error, refresh } = useSnapshot(id || null, getCompetitionDuel);
  const [recordingMatch, setRecordingMatch] = useState<string | null>(null);
  const recording = recordingMatch === id;
  const setRecording = useCallback((active: boolean) => {
    setRecordingMatch(current => active ? id : current === id ? null : current);
  }, [id]);
  const [localTimer, setLocalTimer] = useState<{ key: string; value: Readout } | null>(null);
  const [camera, setCamera] = useState<CompetitionCameraState>('disconnected');
  const [dismissed, setDismissed] = useState('');
  const [replay, setReplay] = useState<{ own: Solve | null; opponent: Solve | null } | null>(null);
  const [replayError, setReplayError] = useState(false);
  const [ordinaryCheckIn, setOrdinaryCheckIn] = useState<'saving' | 'checked' | 'error' | null>(null);
  const duel = snapshot?.value;
  const offset = snapshot?.offset ?? 0;
  const smart = (duel?.device ?? checkInEntry?.device) === 'smart';
  const game = duel?.activeGame;
  const number = duel?.gameNumber ?? 1;
  const timerKey = `${id}:${number}`;
  const onTimerReadout = useCallback((value: Readout | null) => setLocalTimer(current =>
    value ? { key: timerKey, value } : current?.key === timerKey ? null : current), [timerKey]);
  const timerReadout = localTimer?.key === timerKey ? localTimer.value : null;
  const requiresLocal = !smart && (duel?.supervisionMode ?? competition.supervisionMode) === 'self_service';
  const recordingGate = requiresLocal && !recording && !game?.inspectAt && !game?.solveAt && !duel?.ownResult && !timerReadout;
  const opened = !recordingGate && duel?.startAt && duel.scramble ? duel.startAt : null;
  const done = duel?.status === 'completed' || duel?.status === 'bye';
  useEffect(() => {
    if (id && done) onMatchSettled?.();
  }, [id, done, onMatchSettled]);
  const countdownAt = !recordingGate && duel?.startAt && !duel.scramble ? Date.parse(duel.startAt) - offset : null;
  const lobbyAt = !done && !duel?.startAt && duel?.ownReady && duel.opponentReady && duel.sessionStartsAt
    && Date.parse(duel.sessionStartsAt) > Date.parse(duel.serverNow)
    ? Date.parse(duel.sessionStartsAt) - offset : null;
  useReveal(countdownAt ?? lobbyAt, refresh);
  const cube = useCompetitionCube({
    id: id || checkInEntry?.id || '', duel: true, smart, roomId: !done && duel?.eventId === competition.id ? id : null, credentials: duel?.credentials ?? null,
    roundNumber: number, round: opened && duel?.scramble ? { number, issued: opened, scramble: duel.scramble, inspectAt: game?.inspectAt ?? null } : null,
    settled: !!duel?.ownResult || !!done || duel?.eventId !== competition.id, offset, refresh,
  });
  const registrationId = duel?.eventId === competition.id ? duel.registrationId : checkInEntry?.id;
  const canCheckIn = !!(duel?.canPlay || checkInEntry?.canCheckIn);
  const checkIn = useSmartCubeCheckIn(smart && canCheckIn ? registrationId ?? null : null,
    ordinaryCheckIn === 'checked' || (duel?.checkedIn ?? !!checkInEntry?.checkedInAt), cube, () => {
      refresh();
      onCheckedIn?.();
    });
  async function checkInStandard() {
    if (!registrationId || ordinaryCheckIn === 'saving') return;
    setOrdinaryCheckIn('saving');
    try {
      await checkInCompetition(registrationId);
      setOrdinaryCheckIn('checked');
      refresh();
      onCheckedIn?.();
    } catch { setOrdinaryCheckIn('error'); }
  }
  const standardCheckIn = !smart && canCheckIn && !checkIn.confirmed && duel?.supervisionMode !== 'offline';
  const ready = (smart ? checkIn.confirmed && checkIn.deviceReady
    : (checkIn.confirmed || duel?.supervisionMode === 'offline') && (recording || duel?.supervisionMode !== 'self_service'))
    && (!duel?.requiresSupervision || camera === 'ready' || camera === 'waiting_for_supervisor');
  const readyError = useReady(!!duel && duel.eventId === competition.id && duel.canPlay && duel.status === 'ready' && !duel.ownReady && !duel.startAt && ready,
    key => readyCompetitionDuel(id, number, key), refresh);
  const own = localReadout(cube, duel?.ownResult || smart
    ? arenaPersonReadout(opened, game?.inspectAt, game?.solveAt, offset, duel?.ownResult, duel?.ownResult?.dnfReason, smart)
    : timerReadout ?? arenaPersonReadout(opened, game?.inspectAt, game?.solveAt, offset));
  const opponent = arenaPersonReadout(duel?.scramble ? duel.startAt : null, game?.opponentInspectAt, game?.opponentSolveAt, offset, game?.opponentResult, game?.opponentResult?.dnfReason, smart);
  const last = duel?.lastGame;
  const resting = !done && !opened && !!last;
  const displayNumber = resting ? last.gameNumber : number;
  const displayedResult = resting ? last.ownResult : duel?.ownResult;
  const allowReplay = done || resting || (opened !== null && own.stage === 'finished');
  const restored = useWaitingReplay(id, displayNumber, smart && allowReplay && !done && !cube.recap
    && (displayedResult?.penalty === 'none' || displayedResult?.penalty === '+2'), true);
  const selectedRecap = cube.recap ?? restored;
  const recap = allowReplay && !done && selectedRecap?.id !== dismissed && displayedResult?.penalty !== 'DNF' ? selectedRecap : null;
  const remote = duel?.opponentPlayerId ? cube.live.players[duel.opponentPlayerId] : undefined;
  const target = useMemo(() => duel?.scramble ? smartCubeTargetFacelets(duel.scramble) : null, [duel?.scramble]);
  const remoteAnchor = useRef<{ round: number; seq: number } | null>(null);
  const liveOpponent = smart && remote?.round === number && remote.connected && remote.smart && remote.facelets ? remote : undefined;
  if (liveOpponent) {
    const anchored = remoteAnchor.current?.round === number;
    if (target && liveOpponent.facelets === target && (opponent.stage === 'scrambling' || opponent.stage === 'confirming' || !anchored)) {
      remoteAnchor.current = { round: number, seq: liveOpponent.seq };
    } else if (opponent.stage === 'running' && !anchored) {
      remoteAnchor.current = { round: number, seq: Math.max(0, liveOpponent.seq - 1) };
    }
  }
  const opponentMoves = (opponent.stage === 'running' || opponent.stage === 'finished') && remoteAnchor.current?.round === number && liveOpponent
    ? Math.max(0, liveOpponent.seq - remoteAnchor.current.seq) : 0;

  useEffect(() => { if (!allowReplay) setReplay(null); }, [allowReplay]);
  useEffect(() => {
    setReplay(null);
    setReplayError(false);
    setDismissed('');
    remoteAnchor.current = null;
  }, [id]);
  async function openReplay(gameNumber: number) {
    setReplayError(false);
    try {
      const streams = await getCompetitionDuelReplay(id, gameNumber);
      const own = replaySolve(`${id}:${gameNumber}:own`, streams.own);
      const opponent = replaySolve(`${id}:${gameNumber}:opponent`, streams.opponent);
      if (!own && !opponent) setReplayError(true);
      else setReplay({ own, opponent });
    } catch { setReplayError(true); }
  }
  const waitingForMatch = !duel && !!checkInEntry;
  const showWaitingConnection = smart && (checkIn.pending || !cube.cube.status.connected);
  const standardCheckInPrompt = standardCheckIn && <div className="competition-arena-check-in">
    <button type="button" className="competition-primary" disabled={ordinaryCheckIn === 'saving'}
      onClick={() => { void checkInStandard(); }}>{t('检录', 'Check in')}</button>
    {ordinaryCheckIn === 'error' && <p role="alert">{t('检录未完成，请重试。', 'Check-in did not complete. Try again.')}</p>}
  </div>;
  const recordingPanel = requiresLocal && checkIn.confirmed && <div className="competition-duel-recording"
    data-gate={recordingGate && !done || undefined}>
    {recordingGate && !done && <h2>{t('开启本机录制后开始打乱', 'Start local recording to receive the scramble')}</h2>}
    <SelfRecording key={id} onRecordingChange={setRecording} primaryStart={!done} dock finished={done} />
  </div>;
  const frame = (header: ReactNode, content: ReactNode, overlays?: ReactNode) =>
    <div className="competition-arena competition-arena--duel" data-duel-stage={done ? 'report' : resting ? 'rest' : own.stage} data-no-timer>
      <div className="competition-arena-shell">{header}{content}</div>
      {overlays}
    </div>;
  if (waitingForMatch) return frame(
    <ArenaTop competition={competition} project={checkInEntry.project} round="" cube={smart ? cube : undefined} showConnectionPrompt={showWaitingConnection}
      status={<span className="competition-arena-status">{checkIn.confirmed ? t('已检录，等待对阵', 'Checked in · Waiting for a match') : t('等待检录', 'Waiting for check-in')}</span>} />,
    <>
      <div className="competition-arena-stage">
        {showWaitingConnection && <SmartCubeCheckInPrompt cube={cube} checkIn={checkIn} />}
        {standardCheckInPrompt}

      </div>
      {error && <p role="alert">{error}</p>}
    </>,
  );
  if (!duel || duel.eventId !== competition.id) return frame(
    <ArenaTop competition={competition} project={competition.projects[0]?.project ?? '333'} round="" status={null} />,
    error || duel ? <p role="alert">{error || t('对战席不可用', 'Match seat unavailable')}</p>
      : <LoadingIndicator>{t('正在打开对战席…', 'Opening match…')}</LoadingIndicator>,
  );

  const bestOf = duel.bestOf ?? 3;
  const match = matches?.find(item => item.id === id);
  const code = duel.bracketSide ? competitionMatchCode(match ?? { side: duel.bracketSide, round: duel.bracketRound ?? 1, number: duel.bracketNumber ?? 1 }) : '';
  const title = `${code ? `${code} · ` : ''}G${done ? duel.lastGame?.gameNumber ?? number : displayNumber}`;
  const next = duel.nextStep;
  const nextMatch = matches?.find(item => item.id === next?.nextMatchId);
  const nextCode = nextMatch && competitionMatchCode(nextMatch);
  const nextRound = next?.nextMatchSide && next.nextMatchRound ? competitionBracketRound(next.nextMatchSide, next.nextMatchRound, t) : '';
  const nextPlayable = next?.nextMatchStatus === 'ready' || next?.nextMatchStatus === 'in_progress';
  const feeder = nextMatch && duel.registrationId ? competitionMatchFeeder(matches ?? [], nextMatch.id, duel.registrationId) : null;
  const competitionFinished = next?.outcome === 'champion' || next?.outcome === 'runner_up' || next?.outcome === 'eliminated';
  const won = duel.ownScore > duel.opponentScore || ['champion', 'advanced'].includes(next?.outcome ?? '') || (!!match?.winner && match.winner === duel.registrationId);
  const champion = next?.outcome === 'champion';
  const finished = Number(own.stage === 'finished') + Number(opponent.stage === 'finished');
  const beforeSolve = !opened || own.stage === 'scrambling';
  const opensAt = Date.parse(duel.sessionStartsAt ?? competition.startsAt) - COMPETITION_CHECK_IN_LEAD_MS;
  const showEarlyCheckIn = !duel.canPlay && !done && Date.parse(duel.serverNow) < opensAt;
  const preparing = !done && (!duel.startAt || (beforeSolve && camera !== 'ready'));
  const showCheckIn = !done && duel.canPlay && smart && (checkIn.pending || (beforeSolve && !cube.cube.status.connected));
  const history = duel.history ?? (last ? [last] : []);
  const draws = history.filter(game => game.winner === 'draw').length;
  const ownIdentity = duel.ownIdentity ?? { name: duel.ownName, wcaId: null, countryCode: null };
  const opponentIdentity = duel.opponentIdentity ?? { name: duel.opponentName, wcaId: null, countryCode: null };
  const showScramble = opened && (own.stage === 'scrambling' || (smart && own.stage === 'confirming'));
  const showTimer = opened && !smart && !duel.ownResult;
  const showRecordingGate = recordingGate && checkIn.confirmed && !done;
  const ownStanding = standings?.find(row => row.id === duel.registrationId);
  const certificate = !!competition.finalizedAt && competitionFinished;
  const opponentProgress = { idle: 0, scrambling: 1, confirming: 2, inspecting: 2, running: 3, finished: 4 }[opponent.stage];
  const points = (score: number) => <span className="competition-arena-points" aria-hidden="true">
    {Array.from({ length: Math.floor(bestOf / 2) + 1 }, (_, index) => <i key={index} data-scored={index < score || undefined} />)}
  </span>;
  const games = (rows: CompetitionDuelGame[]) => <table className="competition-duel-games">
    <thead><tr><th scope="col">{t('局次', 'Game')}</th>
      <th scope="col">{displayCuberName(ownIdentity.name, lang === 'zh')}</th>
      <th scope="col">{t('胜负差', 'Margin')}</th>
      <th scope="col">{displayCuberName(opponentIdentity.name, lang === 'zh')}</th>
    </tr></thead>
    <tbody>{rows.map(game => <GameRow key={game.gameNumber} game={game} project={duel.project}
      replay={(game.ownReplay || game.opponentReplay) ? <button className="competition-secondary competition-replay-button" type="button"
        onClick={() => void openReplay(game.gameNumber)} aria-label={t('查看本局复盘', 'Replay this game')}><Play size={14} /></button> : undefined} />)}</tbody>
  </table>;
  const score = <div className="competition-arena-score">
    <div data-leading={duel.ownScore > duel.opponentScore || undefined}><ArenaIdentity person={ownIdentity} />{points(duel.ownScore)}</div>
    <strong>{duel.ownScore} : {duel.opponentScore}</strong>
    <div data-leading={duel.opponentScore > duel.ownScore || undefined}><ArenaIdentity person={opponentIdentity} />{points(duel.opponentScore)}</div>
  </div>;
  const matchStatus = next?.outcome === 'dropped_to_losers' ? t('落入败者组', 'Dropped to the losers bracket')
    : next?.outcome === 'eliminated' ? t('已淘汰', 'Eliminated')
      : next?.outcome === 'runner_up' ? t('总决赛亚军', 'Grand final runner-up')
        : won ? t('晋级', 'Advanced') : t('本场落败', 'Match lost');
  return frame(
    <ArenaTop competition={competition} project={duel.project} round={title} cube={smart && duel.canPlay && !done ? cube : undefined} showConnectionPrompt={showCheckIn}
      status={resting ? <span className="competition-arena-status">{t('局间休息', 'Intermission')}</span>
        : showRecordingGate ? <span className="competition-arena-status">{t('待开录', 'Recording required')}</span>
          : <ArenaStatus readout={own} countdownAt={countdownAt} finished={finished} total={2} showSolveLimit={false}
            completed={done} matchOnly={!competitionFinished} ready={ready} correction={cube.guidance.correctionActive} cube={smart ? cube : undefined} />} />,
    <div className="competition-duel-layout" data-smart={smart || undefined} data-report={done || undefined}>
    {done ? <div className="competition-duel-report">
      <section className="competition-duel-result" data-outcome={champion ? 'champion' : won ? 'won' : 'lost'}>
        <div>{champion ? <Trophy size={29} aria-hidden /> : won ? <CircleCheck size={26} aria-hidden /> : <CircleMinus size={26} aria-hidden />}
          <h1>{champion ? t('总决赛夺冠', 'Grand final champion') : won ? t('本场获胜', 'Match won') : t('本场落败', 'Match lost')}</h1>
        </div>
        <p className="competition-muted"><span className="competition-code">{code} · BO{bestOf}</span>{draws > 0 && ` · ${t(`含 ${draws} 局平局加赛`, `Includes ${draws} tied replay games`)}`}</p>
        {score}
      </section>
      {history.length > 0 && games(history)}
      <CompetitionMatchPassport title={next?.nextMatchId ? t('下一场赛程', 'Next match passport') : t('最终结果', 'Final result')}
        code={nextCode ? `${nextCode} · ${nextRound}` : undefined}
        status={champion ? t('冠军', 'Champion') : nextPlayable ? t('下一场对手已就位', 'Next opponent seated') : matchStatus}
        tone={competitionFinished ? won ? 'done' : 'lost' : nextPlayable ? 'ready' : 'waiting'}
        action={next?.nextMatchId && nextPlayable ? <CompetitionMatchEnter onEnter={() => onNextMatch(next.nextMatchId!)} /> : undefined}>
        {feeder ? <CompetitionMatchFeeder feeder={feeder} /> : next?.nextMatchStatus === 'pending' && <p>{t(`等待${nextRound}对手产生`, `Waiting for a ${nextRound} opponent`)}</p>}
        {next?.nextOpponentName && <p>{displayCuberName(next.nextOpponentName, lang === 'zh')}</p>}
        {duel.forfeitReason && <p>{duel.forfeitReason === 'double_no_show' ? t('双方弃权', 'Double walkover') : t('本场以弃权判定', 'Match decided by walkover')}</p>}
      </CompetitionMatchPassport>
      <div className="competition-duel-report-dock">
        <AppLink className="competition-secondary" href={`${competitionHref(competition.slug || competition.id)}#competition-bracket`}>
          {t('返回对阵图', 'Back to bracket')}
        </AppLink>
        <CompetitionReportShare label={certificate ? t('下载完赛证书', 'Download finisher certificate') : undefined} data={{
          competition: t(competition.titleZh || competition.titleEn, competition.titleEn || competition.titleZh),
          organizer: competition.organizationName, division: `${code} · BO${bestOf}`, name: displayCuberName(ownIdentity.name, lang === 'zh'),
          matchOnly: !certificate, final: certificate,
          rank: ownStanding?.rank, date: competitionDateTime(ownStanding?.recordedAt ?? competition.finalizedAt ?? duel.serverNow).slice(0, 10),
          metrics: [{ label: t('局分', 'Score'), value: `${duel.ownScore} : ${duel.opponentScore}` }],
        }} />
        {competitionFinished && !competition.finalizedAt && <span className="competition-muted">{t('成绩定稿后可下载完赛证书', 'Certificate available after results are finalized')}</span>}
        {duel.registrationId && !competition.finalizedAt && reviewActions?.(duel.registrationId)}
      </div>
    </div> : <>
      {score}
      {!smart && <div className="competition-opponent-strip">
        <span>{t('对手状态', 'Opponent status')}</span>
        <progress value={resting ? 4 : opponentProgress} max={4} aria-label={t('对手本局进度', 'Opponent game progress')} />
        <div>{resting ? <small>{t('本局已完成', 'Game complete')}</small>
          : opponent.stage === 'idle' && duel.opponentReady ? <small>{t('已就绪', 'Ready')}</small> : <SeatStatus value={opponent} />}
          {!resting && ['running', 'finished'].includes(opponent.stage) && <ArenaReadout value={opponent} project={duel.project} automatic={false} plain spectator />}
        </div>
      </div>}
      <main className="competition-duel-stage">
        {standardCheckInPrompt}
        {showCheckIn && <SmartCubeCheckInPrompt cube={cube} checkIn={checkIn} />}
        {showScramble && <div className="competition-duel-sequence">
          <SmartScramble round={number} scramble={duel.scramble ?? ''} cube={cube} readout={own} smart={smart} />
          {!smart && <ArenaLocalCube project={duel.project} scramble={duel.scramble ?? ''} />}
        </div>}
        {smart && (opened || remote?.connected && remote.smart && remote.facelets) && <div className="competition-arena-duel-grid">
          <section className="competition-arena-seat competition-arena-seat--own" data-stage={own.stage}>
            <header><SeatStatus value={own} /></header>
            <ArenaLocalCube cube={cube} project={duel.project} scramble={duel.scramble ?? ''} />
            {own.stage !== 'scrambling' && <ArenaReadout value={own} project={duel.project} moves={cube.moves} plain />}
          </section>
          <section className="competition-arena-seat competition-arena-seat--opponent" data-stage={opponent.stage}>
            <header><SeatStatus value={opponent} /></header>
            <ArenaRemoteCube project={duel.project} scramble={duel.scramble ?? ''} smart remote={remote} playerId={duel.opponentPlayerId} stage={opponent.stage} />
            {['running', 'inspecting', 'confirming', 'finished'].includes(opponent.stage) && <ArenaReadout value={opponent} project={duel.project} moves={opponentMoves} plain spectator />}
          </section>
        </div>}
        {opened && !smart && duel.ownResult && <ArenaReadout value={own} project={duel.project} automatic={false} plain />}
        {!opened && !showRecordingGate && <div className="competition-duel-wait">
          {showEarlyCheckIn && <p role="status">{t('开赛前 5 分钟开放检录', 'Check-in opens 5 minutes before start')}</p>}
          {lobbyAt !== null && <ArenaLobby at={lobbyAt} duel />}
          {lobbyAt === null && !duel.startAt && duel.ownReady && duel.opponentReady && duel.requiresSupervision &&
            <p role="status">{t('双方已就绪 · 等待本桌视频监督', 'Both ready · waiting for table supervision')}</p>}
          {!duel.startAt && duel.canPlay && duel.noShowDeadlineAt && !(duel.ownReady && duel.opponentReady) &&
            <ArenaReadinessDeadline at={Date.parse(duel.noShowDeadlineAt) - offset} />}
          {resting && last && games([last])}
          {countdownAt !== null && <ArenaCountdown key={number} at={countdownAt} number={number} duel />}
          {!duel.startAt && duel.ownReady && !duel.opponentReady && <p role="status">{t('已就绪，等待对手', 'Ready · waiting for opponent')}</p>}
        </div>}
      </main>
      {showTimer && <DuelTimer key={timerKey} duel={duel} clockOffset={offset} onSaved={refresh} onReadout={onTimerReadout} />}
      {duel.canPlay && (duel.requiresSupervision || error || readyError || cube.syncError) &&
        <ArenaReadiness preparing={preparing} videoId={duel.requiresSupervision && checkIn.confirmed ? duel.id : null}
          supervisorIdentity={duel.supervisorVideoIdentity} camera={camera} onCameraState={setCamera} localRecording={false}
          recording={recording} onRecordingChange={setRecording} error={error || readyError || (cube.syncError ? t('等待同步…', 'Syncing…') : '')} duel />}
    </>}
    {recordingPanel}
    </div>,
    <>
      {recap && <CompetitionRecap key={recap.id} solve={recap} onDismiss={() => setDismissed(recap.id)} onFull={() => setReplay({ own: recap, opponent: null })} />}
      {replayError && allowReplay && <p role="alert">{t('复盘加载失败', 'Replay unavailable')}</p>}
      {replay && allowReplay && <CompetitionReplayDialog own={replay.own} opponent={replay.opponent} onClose={() => setReplay(null)} />}
    </>,
  );
}

function SeatStatus({ value }: { value: Readout }) {
  const t = useT();
  const labels = { idle: t('等待', 'Waiting'), scrambling: t('打乱中', 'Scrambling'),
    confirming: t('准备观察', 'Ready to inspect'), inspecting: t('观察中', 'Inspecting'), running: t('还原中', 'Solving'), finished: t('已完成', 'Finished') };
  return <small data-dnf={value.result?.penalty === 'DNF' || !!value.reason || undefined}>
    {value.result?.penalty === 'DNF' || value.reason ? 'DNF' : labels[value.stage]}
  </small>;
}

function GameRow({ game, project, replay }: { game: CompetitionDuelGame; project: string; replay?: ReactNode }) {
  const t = useT();
  const own = game.ownResult ? attemptValue(game.ownResult) : -1;
  const opponent = game.opponentResult ? attemptValue(game.opponentResult) : -1;
  const difference = own > 0 && opponent > 0 && own !== opponent ? formatWcaResult(Math.abs(own - opponent), project, 'single') : '';
  return <tr data-winner={game.winner}>
    <th scope="row" className="competition-code">G{game.gameNumber} {replay}</th>
    <td data-winner={game.winner === 'own' || undefined}>{attemptText(game.ownResult, project)}</td>
    <td>{game.winner === 'draw' ? t('平局加赛', 'Tie · replay') : difference ? `${game.winner === 'own' ? '−' : '+'}${difference}`
      : game.winner === 'own' ? t('胜', 'Won') : t('负', 'Lost')}</td>
    <td data-winner={game.winner === 'opponent' || undefined}>{attemptText(game.opponentResult, project)}</td>
  </tr>;
}
