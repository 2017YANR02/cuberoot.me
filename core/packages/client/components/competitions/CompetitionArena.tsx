'use client';

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Play } from 'lucide-react';
import { TimerScrambleStrip } from '@cuberoot/timer-ui';
import type { Solve } from '@cuberoot/shared/timer';
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
  type CompetitionArenaAttempt, type CompetitionAttemptResult,
  type CompetitionDuelGame, type CompetitionRegistration, type OnlineCompetition,
} from '@/lib/online-competition-api';
import { persistItem } from '@/lib/safe-storage';
import { useCompetitionCube } from './useCompetitionCube';
import { ArenaBoardToggle, ArenaIdentity, ArenaLocalCube, ArenaRemoteCube, ArenaReadout, ArenaStatus, ArenaTop, arenaPersonReadout, type ArenaCube, type Readout } from './CompetitionArenaParts';
import { CompetitionRecap, CompetitionReplayButton, CompetitionReplayDialog, replaySolve } from './CompetitionReconstruction';
import { CompetitionRank, CompetitionReport } from './CompetitionReport';
import { attemptValue, competitionAo5, rankArena, validResult } from './competition-results';
import { CompetitionSelfTimer } from './CompetitionSelfTimer';
import { DuelTimer } from './DuelTimer';
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
  const [error, setError] = useState(false);
  const action = useEffectEvent(ready);
  useEffect(() => {
    if (!enabled) return;
    const key = crypto.randomUUID();
    let active = true;
    let sending = false;
    const submit = async () => {
      if (!active || sending) return;
      sending = true;
      try { await action(key); if (active) { setError(false); refresh(); } }
      catch { if (active) setError(true); }
      finally { sending = false; }
    };
    void submit();
    const retry = setInterval(() => void submit(), 2500);
    return () => { active = false; clearInterval(retry); };
  }, [enabled, refresh]);
  return enabled && error;
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
    activate: () => connected ? submit() : cube.connect(),
  };
}

function SmartCubeCheckInPrompt({ cube, checkIn }: { cube: ArenaCube; checkIn: ReturnType<typeof useSmartCubeCheckIn> }) {
  const t = useT();
  const connected = cube.cube.status.connected;
  return <div className="competition-arena-support">
    <button type="button" className="competition-primary"
      disabled={cube.connecting || checkIn.busy || (connected && !checkIn.deviceReady)}
      onClick={() => void checkIn.activate()}>
      {checkIn.busy ? t('检录中…', 'Checking in…')
        : !connected ? t('连接魔方并检录', 'Connect cube and check in')
          : checkIn.deviceReady ? t('检录', 'Check in') : t('正在读取魔方状态…', 'Reading cube state…')}
    </button>
    {cube.bluetoothUnavailable && <span role="alert">{t('当前环境不支持蓝牙连接智能魔方', 'Bluetooth smart cube connection is not available in this environment')}</span>}
    {cube.connectionError && <span role="alert">{t('连接失败，请重新配对', 'Connection failed. Pair again.')}</span>}
    {checkIn.error && <span role="alert">{t('检录失败，请重试', 'Check-in failed. Try again.')}</span>}
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

function SmartScramble({ scramble, cube, readout, round }: { scramble: string; cube: ArenaCube; readout: Readout; round: number }) {
  const t = useT();
  return <div className="competition-arena-scramble" data-stage={readout.stage}>
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

function ArenaRankings({ rows, id, project, number, finished, allowReplay }: {
  rows: ReturnType<typeof rankArena>; id: string; project: string; number: number; finished: number; allowReplay: boolean;
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
      <strong>{t('实时排名', 'Live standings')} · {number}/5</strong><span>{finished}/{rows.length}</span>
      <progress value={finished} max={rows.length || 1} aria-label={t('本轮完赛进度', 'Round completion')} />
    </header>
    <table><colgroup><col className="competition-arena-rank-column" /><col /><col className="competition-arena-result-column" /></colgroup>
      <thead><tr><th scope="col">{t('名次', 'Rank')}</th><th scope="col">{t('选手', 'Competitor')}</th><th scope="col">{t('成绩', 'Result')}</th></tr></thead>
      <tbody ref={table}>{rows.map(({ player, metrics, count, current }, index) => {
        const value = current?.penalty ? attemptText(current, project) : current?.solveAt ? t('复原中', 'Solving')
          : current?.inspectAt ? t('观察中', 'Inspecting') : t('打乱中', 'Scrambling');
        return <tr key={player.id} data-player={player.id} data-own={player.id === id || undefined}>
          <td><CompetitionRank rank={index + 1} final={number === 5 && finished === rows.length} /></td>
          <th scope="row"><ArenaIdentity person={player} /></th>
          <td><strong data-dnf={current?.penalty === 'DNF' || undefined}>
            {current?.replay && allowReplay ? <CompetitionReplayButton registrationId={player.id} number={number}>{value}</CompetitionReplayButton> : value}
          </strong>
            {count > 0 && <small>{count === 5 ? `Ao5 ${formatWcaResult(metrics.average, project, 'average')}`
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
        const label = attemptText(attempt ?? null, project);
        return <li key={n} data-current={number === n || undefined} data-recorded={!!attempt?.penalty || undefined}
          aria-current={number === n ? 'step' : undefined}>
          <span>#{n}</span><strong data-dnf={attempt?.penalty === 'DNF' || undefined}>
            {attempt?.replay && allowReplay ? <CompetitionReplayButton registrationId={id} number={n}>{label}</CompetitionReplayButton> : label}
          </strong>
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

export function CompetitionAo5Arena({ competition, registration, archive, evidence, onCheckedIn }: {
  competition: OnlineCompetition; registration: CompetitionRegistration; archive: ReactNode; onCheckedIn?: () => void;
  evidence?: (number: number, onFilesChange: (files: CompetitionEvidence[]) => void) => ReactNode;
}) {
  const t = useT();
  const id = registration.id;
  const smart = registration.device === 'smart';
  const { snapshot, error, refresh } = useSnapshot(id, getCompetitionArena);
  const [recording, setRecording] = useState(false);
  const [replay, setReplay] = useState<Solve | null>(null);
  const [dismissed, setDismissed] = useState('');
  const value = snapshot?.value;
  const offset = snapshot?.offset ?? 0;
  const number = value?.roundNumber ?? 1;
  const own = value?.players.find(player => player.id === id);
  const attempt = own?.attempts.find(item => item.attemptNumber === number);
  const result = validResult(attempt);
  const opened = value?.startsAt && value.scramble ? value.startsAt : null;
  const countdownAt = value?.startsAt && !value.scramble && value.seated ? Date.parse(value.startsAt) - offset : null;
  useReveal(countdownAt, refresh);
  const cube = useCompetitionCube({
    id, duel: false, smart, roomId: value?.completed ? null : value?.roomId ?? null, credentials: value?.credentials ?? null, roundNumber: number,
    round: opened && value?.scramble ? { number, issued: opened, scramble: value.scramble, inspectAt: value.inspectAt } : null,
    settled: !!result || !value?.seated, offset, refresh,
  });
  const checkedIn = value?.checkedIn ?? !!registration.checkedInAt;
  const checkIn = useSmartCubeCheckIn(smart && value && registration.canCheckIn ? id : null, checkedIn, cube, () => {
    refresh();
    onCheckedIn?.();
  });
  const ready = smart ? checkIn.deviceReady : recording || registration.sessionKind === 'supervised';
  const needsSeat = value?.legacy ? smart && registration.sessionKind === 'self_service' && !value.scramble : !value?.seated;
  const readyError = useReady(!!value && needsSeat && !value.completed && !registration.resultRecordedAt && checkedIn && ready,
    key => value?.legacy ? nextCompetitionSelfAttempt(id) : readyCompetitionArena(id, key), refresh);
  const done = !!value?.completed;
  const readout = localReadout(cube, arenaPersonReadout(opened, value?.inspectAt, value?.solveAt, offset, result, attempt?.dnfReason));
  const rows = useMemo(() => rankArena(value?.players ?? [], number, registration.project), [value?.players, number, registration.project]);
  const finished = rows.filter(row => row.current?.penalty).length;
  const allowReplay = done || (opened !== null && readout.stage === 'finished' && countdownAt === null);
  const restored = useWaitingReplay(id, number, !!attempt?.replay && allowReplay && !done && !cube.recap, false);
  const selectedRecap = cube.recap ?? restored;
  const recap = allowReplay && !done && selectedRecap?.id !== dismissed && result?.penalty !== 'DNF' ? selectedRecap : null;
  const priorBest = rows.find(row => row.player.id === id)?.player.attempts
    .filter(item => item.attemptNumber < number && attemptValue(item) > 0).reduce((best, item) => Math.min(best, attemptValue(item)), Infinity);
  const best = !!result && attemptValue(result) > 0 && attemptValue(result) < (priorBest ?? Infinity);
  useEffect(() => { if (!allowReplay) setReplay(null); }, [allowReplay]);
  const rankProps = { rows, id, project: registration.project, number, finished, allowReplay };
  const leaderboard = <ArenaRankings {...rankProps} />;
  const ownRank = rows.findIndex(row => row.player.id === id);
  const supervised = registration.sessionKind === 'supervised';

  if ((value?.legacy && !smart) || (!value?.roomId && registration.resultRecordedAt)) {
    return <div className="competition-arena" data-no-timer>
      <ArenaTop competition={competition} project={registration.project} round="Ao5" status={null} />
      {archive}
    </div>;
  }

  return <div className="competition-arena competition-arena--ao5" data-running={readout.stage === 'running' || undefined} data-no-timer>
    <div className="competition-arena-shell">
      <ArenaTop competition={competition} project={registration.project} round={`R${number} / 5`} cube={smart ? cube : undefined}
        status={<ArenaStatus readout={readout} countdownAt={countdownAt} next={number} finished={finished} total={rows.length}
          completed={done} ready={ready} correction={cube.guidance.correctionActive} cube={smart ? cube : undefined} />} />
      <div className="competition-arena-grid">
        <div className="competition-arena-desktop-board">{leaderboard}</div>
        {rows.length > 0 && <ArenaBoardToggle stage={readout.stage} summary={<>
          {ownRank >= 0 && <strong>{t(`第 ${ownRank + 1} / ${rows.length} 名`, `Rank ${ownRank + 1} / ${rows.length}`)}</strong>}
          <span>{t('榜首', 'Leader')} {attemptText(rows[0].current ?? null, registration.project)}</span>
          <span>{t('完赛', 'Finished')} {finished}/{rows.length}</span>
        </>}>{leaderboard}</ArenaBoardToggle>}
        <section className="competition-arena-stage" data-stage={readout.stage}>
          <SmartScramble round={number} scramble={value?.scramble ?? ''} cube={cube} readout={readout} />
          <ArenaLocalCube cube={smart ? cube : undefined} project={registration.project} scramble={value?.scramble ?? ''} />
          {!snapshot && !error ? <LoadingIndicator>{t('正在打开赛场…', 'Opening arena…')}</LoadingIndicator>
            : smart ? <ArenaReadout value={readout} project={registration.project} moves={cube.moves} best={best} />
              : opened && !result && value?.seated ? <OrdinaryAo5Attempt key={number} id={id} number={number}
                project={registration.project} recording={recording} supervised={supervised} refresh={refresh} evidence={evidence} />
                : <ArenaReadout value={readout} project={registration.project} automatic={false} />}
          <AttemptsDock id={id} project={registration.project} number={number} allowReplay={allowReplay} attempts={own?.attempts ?? []} />
        </section>
      </div>
      {checkIn.pending && <SmartCubeCheckInPrompt cube={cube} checkIn={checkIn} />}
      {!done && <div className="competition-arena-support">
        {supervised && checkIn.confirmed && <details><MoreToggle as="summary">{t('监督视频', 'Supervision video')}</MoreToggle><VideoRoom registrationId={id} /></details>}
        {!smart && !supervised && <SelfRecording onRecordingChange={setRecording} />}
        {(error || readyError || cube.syncError) && <span role="status">{error || t('等待同步…', 'Syncing…')}</span>}
      </div>}
    </div>
    {done && value && !value.seated && <p role="status">{t('本场轮次已结束', 'All rounds have ended')}</p>}
    {done && registration.resultRecordedAt && archive}
    {recap && <CompetitionRecap key={recap.id} solve={recap} onDismiss={() => setDismissed(recap.id)} onFull={() => setReplay(recap)} />}
    {allowReplay && replay && <CompetitionReplayDialog own={replay} onClose={() => setReplay(null)} />}
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

export function CompetitionDuelArena({ id = '', competition, checkInEntry, onCheckedIn }: {
  id?: string; competition: OnlineCompetition; checkInEntry?: CompetitionRegistration; onCheckedIn?: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const { snapshot, error, refresh } = useSnapshot(id || null, getCompetitionDuel);
  const [recording, setRecording] = useState(false);
  const [dismissed, setDismissed] = useState('');
  const [replay, setReplay] = useState<{ own: Solve | null; opponent: Solve | null } | null>(null);
  const [replayError, setReplayError] = useState(false);
  const duel = snapshot?.value;
  const offset = snapshot?.offset ?? 0;
  const smart = (duel?.device ?? checkInEntry?.device) === 'smart';
  const game = duel?.activeGame;
  const number = duel?.gameNumber ?? 1;
  const opened = duel?.startAt && duel.scramble ? duel.startAt : null;
  const done = duel?.status === 'completed' || duel?.status === 'bye';
  const countdownAt = duel?.startAt && !duel.scramble ? Date.parse(duel.startAt) - offset : null;
  useReveal(countdownAt, refresh);
  const cube = useCompetitionCube({
    id: id || checkInEntry?.id || '', duel: true, smart, roomId: !done && duel?.eventId === competition.id ? id : null, credentials: duel?.credentials ?? null,
    roundNumber: number, round: opened && duel?.scramble ? { number, issued: opened, scramble: duel.scramble, inspectAt: game?.inspectAt ?? null } : null,
    settled: !!duel?.ownResult || !!done || duel?.eventId !== competition.id, offset, refresh,
  });
  const registrationId = duel?.eventId === competition.id ? duel.registrationId : checkInEntry?.id;
  const canCheckIn = !!(duel?.canPlay || checkInEntry?.canCheckIn);
  const checkIn = useSmartCubeCheckIn(smart && canCheckIn ? registrationId ?? null : null,
    duel?.checkedIn ?? !!checkInEntry?.checkedInAt, cube, () => {
      refresh();
      onCheckedIn?.();
    });
  const ready = smart ? checkIn.confirmed && checkIn.deviceReady : recording || duel?.supervisionMode !== 'self_service';
  const readyError = useReady(!!duel && duel.eventId === competition.id && duel.canPlay && !duel.ownReady && !duel.startAt && ready && !done,
    key => readyCompetitionDuel(id, number, key), refresh);
  const own = localReadout(cube, arenaPersonReadout(opened, game?.inspectAt, game?.solveAt, offset, duel?.ownResult, duel?.ownResult?.dnfReason));
  const opponent = arenaPersonReadout(opened, game?.opponentInspectAt, game?.opponentSolveAt, offset, game?.opponentResult, game?.opponentResult?.dnfReason);
  const allowReplay = done || (opened !== null && own.stage === 'finished' && countdownAt === null);
  const restored = useWaitingReplay(id, number, smart && allowReplay && !done && !cube.recap && duel?.ownResult?.penalty === 'none', true);
  const selectedRecap = cube.recap ?? restored;
  const recap = allowReplay && !done && selectedRecap?.id !== dismissed && duel?.ownResult?.penalty !== 'DNF' ? selectedRecap : null;
  const remote = duel?.opponentPlayerId ? cube.live.players[duel.opponentPlayerId] : undefined;
  const target = useMemo(() => duel?.scramble ? smartCubeTargetFacelets(duel.scramble) : null, [duel?.scramble]);
  const remoteAnchor = useRef<{ round: number; seq: number } | null>(null);
  const liveOpponent = smart && remote?.round === number && remote.connected && remote.smart && remote.facelets ? remote : undefined;
  if (liveOpponent) {
    const anchored = remoteAnchor.current?.round === number;
    if (target && liveOpponent.facelets === target && (opponent.stage === 'scrambling' || opponent.stage === 'inspecting' || !anchored)) {
      remoteAnchor.current = { round: number, seq: liveOpponent.seq };
    } else if (opponent.stage === 'running' && !anchored) {
      remoteAnchor.current = { round: number, seq: Math.max(0, liveOpponent.seq - 1) };
    }
  }
  const opponentMoves = (opponent.stage === 'running' || opponent.stage === 'finished') && remoteAnchor.current?.round === number && liveOpponent
    ? Math.max(0, liveOpponent.seq - remoteAnchor.current.seq) : 0;

  useEffect(() => { if (!allowReplay) setReplay(null); }, [allowReplay]);
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
  if (!duel && checkInEntry) return <div className="competition-arena" data-no-timer>
    <ArenaTop competition={competition} project={checkInEntry.project} round="" cube={cube}
      status={<span className="competition-arena-status">{checkIn.confirmed ? t('已检录，等待对阵', 'Checked in · Waiting for a match') : t('等待检录', 'Waiting for check-in')}</span>} />
    <div className="competition-arena-stage"><ArenaLocalCube cube={cube} project={checkInEntry.project} scramble="" /></div>
    {checkIn.pending && <SmartCubeCheckInPrompt cube={cube} checkIn={checkIn} />}
    {error && <p role="alert">{error}</p>}
  </div>;
  if (!duel || duel.eventId !== competition.id) return <div className="competition-arena" data-no-timer>
    <ArenaTop competition={competition} project={competition.projects[0]?.project ?? '333'} round="" status={null} />
    {error || duel ? <p role="alert">{error || t('对战席不可用', 'Match seat unavailable')}</p> : <LoadingIndicator>{t('正在打开对战席…', 'Opening match…')}</LoadingIndicator>}
  </div>;

  const labels = { winners: t('胜者组', 'Winners'), losers: t('败者组', 'Losers'), grand_final: t('总决赛', 'Final') };
  const bestOf = duel.bestOf ?? 3;
  const title = `${duel.bracketSide ? labels[duel.bracketSide] : ''} BO${bestOf} · G${done ? duel.lastGame?.gameNumber ?? number : number}`;
  const last = duel.lastGame;
  const finished = Number(own.stage === 'finished') + Number(opponent.stage === 'finished');
  const history = duel.history ?? (last ? [last] : []);
  const ownIdentity = duel.ownIdentity ?? { name: duel.ownName, wcaId: null, countryCode: null };
  const opponentIdentity = duel.opponentIdentity ?? { name: duel.opponentName, wcaId: null, countryCode: null };
  const points = (score: number) => <span className="competition-arena-points" aria-hidden="true">
    {Array.from({ length: Math.floor(bestOf / 2) + 1 }, (_, index) => <i key={index} data-scored={index < score || undefined} />)}
  </span>;
  return <div className="competition-arena competition-arena--duel" data-running={own.stage === 'running' || undefined} data-no-timer>
    <div className="competition-arena-shell">
      <ArenaTop competition={competition} project={duel.project} round={title} cube={smart ? cube : undefined}
        status={<ArenaStatus readout={own} countdownAt={countdownAt} next={number} finished={finished} total={2}
          completed={done} ready={ready} correction={cube.guidance.correctionActive} cube={smart ? cube : undefined} />} />
      <div className="competition-arena-score">
        <div><ArenaIdentity person={ownIdentity} />{points(duel.ownScore)}</div>
        <strong>{duel.ownScore} : {duel.opponentScore}</strong>
        <div>{points(duel.opponentScore)}<ArenaIdentity person={opponentIdentity} /></div>
      </div>
      {!done && <>
        <div className="competition-arena-duel-grid">
          <SmartScramble round={number} scramble={duel.scramble ?? ''} cube={cube} readout={own} />
          <section className="competition-arena-seat competition-arena-seat--own" data-stage={own.stage}>
            <header><strong>{t('我', 'You')}</strong><SeatStatus value={own} /></header>
            <ArenaLocalCube cube={smart ? cube : undefined} project={duel.project} scramble={duel.scramble ?? ''} />
            {smart || !duel.scramble || duel.ownResult ? <ArenaReadout value={own} project={duel.project} moves={cube.moves} automatic={smart} />
              : <DuelTimer key={number} duel={duel} clockOffset={offset} onSaved={refresh} />}
          </section>
          <section className="competition-arena-seat competition-arena-seat--opponent" data-stage={opponent.stage}>
            <header><ArenaIdentity person={opponentIdentity} /><SeatStatus value={opponent} /></header>
            <ArenaRemoteCube project={duel.project} scramble={duel.scramble ?? ''} remote={liveOpponent} />
            <ArenaReadout value={opponent} project={duel.project} moves={opponentMoves} automatic={smart} />
          </section>
        </div>
        {(countdownAt !== null || (!duel.scramble && !duel.startAt)) && last && <GameRow game={last} project={duel.project} />}
      </>}
      {done && <CompetitionReport share data={{
        competition: t(competition.titleZh || competition.titleEn, competition.titleEn || competition.titleZh),
        organizer: competition.organizationName, division: title, name: displayCuberName(ownIdentity.name, lang === 'zh'),
        final: true, date: competitionDateTime(competition.endsAt).slice(0, 10),
        metrics: [{ label: t('局分', 'Score'), value: `${duel.ownScore} : ${duel.opponentScore}` }],
      }} />}
      {history.length > 0 && (done || allowReplay) && <ol className="competition-arena-history" data-site-surface="panel">
        {history.map(game => <li key={game.gameNumber}>
          <GameRow game={game} project={duel.project} />
          {(game.ownReplay || game.opponentReplay) && <button className="competition-secondary competition-replay-button" type="button"
            onClick={() => void openReplay(game.gameNumber)} aria-label={t('查看本局复盘', 'Replay this game')}><Play size={14} /></button>}
        </li>)}
      </ol>}
      {!done && <div className="competition-arena-support">
        {duel.requiresSupervision && duel.checkedIn && duel.registrationId && <details>
          <MoreToggle as="summary">{t('监督视频', 'Supervision video')}</MoreToggle><VideoRoom registrationId={duel.registrationId} />
        </details>}
        {!smart && duel.supervisionMode === 'self_service' && <SelfRecording onRecordingChange={setRecording} />}
        {checkIn.pending && <SmartCubeCheckInPrompt cube={cube} checkIn={checkIn} />}
        {(error || readyError || cube.syncError) && <span role="status">{error || t('等待同步…', 'Syncing…')}</span>}
      </div>}
    </div>
    {recap && <CompetitionRecap key={recap.id} solve={recap} onDismiss={() => setDismissed(recap.id)} onFull={() => setReplay({ own: recap, opponent: null })} />}
    {replayError && allowReplay && <p role="alert">{t('复盘加载失败', 'Replay unavailable')}</p>}
    {replay && allowReplay && <CompetitionReplayDialog own={replay.own} opponent={replay.opponent} onClose={() => setReplay(null)} />}
  </div>;
}

function SeatStatus({ value }: { value: Readout }) {
  const t = useT();
  const labels = { idle: t('等待', 'Waiting'), scrambling: t('打乱中', 'Scrambling'),
    inspecting: t('观察中', 'Inspecting'), running: t('复原中', 'Solving'), finished: t('已完成', 'Finished') };
  return <small data-dnf={value.result?.penalty === 'DNF' || !!value.reason || undefined}>
    {value.result?.penalty === 'DNF' || value.reason ? 'DNF' : labels[value.stage]}
  </small>;
}

function GameRow({ game, project }: { game: CompetitionDuelGame; project: string }) {
  const t = useT();
  const own = game.ownResult ? attemptValue(game.ownResult) : -1;
  const opponent = game.opponentResult ? attemptValue(game.opponentResult) : -1;
  const difference = own > 0 && opponent > 0 && own !== opponent ? formatWcaResult(Math.abs(own - opponent), project, 'single') : '';
  return <div className="competition-arena-game" data-winner={game.winner}>
    <span>G{game.gameNumber}</span><strong data-winner={game.winner === 'own' || undefined}>{attemptText(game.ownResult, project)}</strong>
    <span>{game.winner === 'draw' ? t('平局', 'Draw') : difference ? `${game.winner === 'own' ? '−' : '+'}${difference}`
      : game.winner === 'own' ? t('胜', 'Won') : t('负', 'Lost')}</span><strong data-winner={game.winner === 'opponent' || undefined}>{attemptText(game.opponentResult, project)}</strong>
  </div>;
}
