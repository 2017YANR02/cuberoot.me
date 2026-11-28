'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { COMPETITION_INSPECTION_MS, COMPETITION_OBSERVATION_WINDOW_MS, COMPETITION_SCRAMBLE_CONFIRM_MS, COMPETITION_INTERMISSION_MS, COMPETITION_STAGE_LIMIT_MS, COMPETITION_START_BUFFER_MS, timerEventIdFromSelector } from '@cuberoot/shared/timer';
import { BatteryLevelIcon, SegmentTime, TimerCubePreview, type NetBattleLiveCubePlayer } from '@cuberoot/timer-ui';
import { Flag } from '@cuberoot/timer-ui/country-flag';
import { SOLVED_SMART_CUBE_FACELETS } from '@cuberoot/shared/smart-cube/cubie';
import { mirrorForBrand, sensorBasisForBrand } from '@cuberoot/shared/smart-cube/orientation';
import { competitionHref } from '@/lib/competition-links';
import AppLink from '@/components/AppLink';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import PersonLink from '@/components/PersonLink';
import { Tooltip } from '@/components/Tooltip';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import MoreToggle from '@/components/MoreToggle';
import { displayCuberName } from '@/lib/cuber-name-display';
import { formatWcaResult } from '@/lib/wca-format-result';
import type { CompetitionArenaIdentity, CompetitionAttemptResult, OnlineCompetition } from '@/lib/online-competition-api';
import type { CompetitionDnfReason } from '@cuberoot/shared/timer';
import { CompetitionTestBadge } from './CompetitionTestActions';
import { attemptValue } from './competition-results';
import type { useCompetitionCube } from './useCompetitionCube';

const BluetoothModal = dynamic(() => import('@/components/BluetoothModal'), { ssr: false });
const LiveCubeState = dynamic(() => import('@cuberoot/timer-ui/LiveCubeState'), { ssr: false });
const NO_MOVES: readonly string[] = [];

export type ArenaCube = ReturnType<typeof useCompetitionCube>;
export type Readout = { stage: 'scrambling' | 'confirming' | 'inspecting' | 'running' | 'finished' | 'idle'; at?: number; duration?: number; result?: CompetitionAttemptResult | null; reason?: CompetitionDnfReason | null; inspectionMs?: number };

export function ArenaIdentity({ person }: { person: CompetitionArenaIdentity }) {
  const lang = useLang();
  return <PersonLink wcaId={person.wcaId ?? ''} name={person.name} isZh={lang === 'zh'} className="competition-arena-name"
    flag={person.countryCode ? <Flag iso2={person.countryCode} spanClassName="country-flag" imgClassName="country-flag-ct" /> : undefined} />;
}

export function arenaPersonReadout(entered: string | null, inspect: string | null | undefined, solve: string | null | undefined,
  offset: number, result?: CompetitionAttemptResult | null, reason?: CompetitionDnfReason | null, smart = false): Readout {
  if (result) return { stage: 'finished', result, reason };
  if (!entered) return { stage: 'idle' };
  const issued = Date.parse(entered) - offset;
  if (!inspect) return { stage: 'scrambling', at: issued };
  const at = Date.parse(inspect) - offset;
  if (solve) return { stage: 'running', at: Date.parse(solve) - offset };
  return { stage: smart ? 'confirming' : 'inspecting', at };
}

function effectiveStage(readout: Readout, now: number, automatic = true) {
  if (!automatic || (readout.stage !== 'confirming' && readout.stage !== 'inspecting') || readout.at === undefined) return readout;
  const at = readout.stage === 'confirming' ? readout.at + COMPETITION_SCRAMBLE_CONFIRM_MS : readout.at;
  if (now < at) return readout;
  if (now >= at + COMPETITION_INSPECTION_MS) {
    return { stage: 'running' as const, at: at + COMPETITION_INSPECTION_MS, inspectionMs: COMPETITION_OBSERVATION_WINDOW_MS };
  }
  return { stage: 'inspecting' as const, at };
}

function useAnimationClock(active: boolean, interval: number) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = -Infinity;
    const tick = (time: number) => {
      if (time >= last + interval) { last = time; setNow(time); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, interval]);
  return now;
}

export function ArenaReadout({ value, project, moves = 0, automatic = true, best = false, spectator = false, plain = false }: {
  value: Readout; project: string; moves?: number; automatic?: boolean; best?: boolean; spectator?: boolean; plain?: boolean;
}) {
  const t = useT();
  const now = useAnimationClock(value.stage === 'running' || value.stage === 'inspecting' || value.stage === 'confirming', 28);
  const readout = effectiveStage(value, now, automatic);
  const elapsed = Math.max(0, Math.min(COMPETITION_STAGE_LIMIT_MS, now - (readout.at ?? now)));
  const duration = readout.duration ?? (readout.result?.centiseconds == null ? 0 : readout.result.centiseconds * 10);
  const inspecting = readout.stage === 'inspecting';
  const confirming = readout.stage === 'confirming';
  const remaining = Math.max(0, COMPETITION_INSPECTION_MS - elapsed);
  const seconds = Math.ceil(remaining / 1000);
  const note = confirming ? t('打乱完成 · 准备观察', 'Scramble complete · Get ready to inspect')
    : automatic && inspecting ? seconds <= 3 ? t('即将自动起表', 'Timer starts automatically soon')
      : spectator ? t('观察中', 'Inspecting') : t('观察中 · 转动魔方开始计时', 'Inspecting · Turn the cube to start')
      : '';
  const time = readout.stage === 'finished' ? readout.result ? formatWcaResult(attemptValue(readout.result), project, 'single')
    : readout.reason ? 'DNF' : formatWcaResult(Math.max(1, Math.floor(duration / 10)), project, 'single')
    : inspecting ? automatic ? String(seconds) : (Math.ceil(remaining / 100) / 10).toFixed(1)
      : elapsed < 10 || readout.stage !== 'running' ? '0.00' : formatWcaResult(Math.floor(elapsed / 10), project, 'single');
  const metricTime = readout.stage === 'finished' ? duration : elapsed;
  const color = time === 'DNF' ? 'dnf'
    : inspecting && remaining <= (automatic ? 3000 : 4000) ? 'warn12'
      : inspecting && remaining <= (automatic ? 7000 : 8000) ? 'warn8' : undefined;
  return <div className="competition-arena-reading" data-stage={readout.stage} data-smart={automatic || undefined}>
    <div className="competition-arena-clock">
      {!confirming && <output aria-label={inspecting && automatic ? t('剩余观察秒数', 'Inspection seconds remaining') : t('计时', 'Timer')}
        className="competition-arena-time" data-color={color} aria-live="off">
        {plain || (automatic && inspecting) ? time : <SegmentTime text={time} />}
      </output>}
      {note && <span className="competition-arena-phase-note" role="status">{note}</span>}
    </div>
    <div className="competition-arena-metrics">{best && <span className="competition-arena-best">{t('本场最佳', 'Session best')}</span>}{moves > 0 && metricTime > 0 && time !== 'DNF' &&
      <span>STM {moves} · {(moves * 1000 / metricTime).toFixed(2)} TPS</span>}
      {readout.reason && <span>{readout.reason === 'disconnected' ? t('蓝牙连接中断', 'Bluetooth disconnected')
        : readout.reason === 'scramble_timeout' ? t('打乱超时', 'Scramble timed out') : t('复原超时', 'Solve timed out')}</span>}
    </div>
  </div>;
}

const remainingText = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

export function ArenaCountdown({ at, number, duel = false }: { at: number; number: number; duel?: boolean }) {
  const t = useT();
  const now = useAnimationClock(true, 80);
  const duration = number === 1 ? COMPETITION_START_BUFFER_MS : COMPETITION_INTERMISSION_MS;
  const remaining = now ? Math.min(duration, Math.max(0, at - now)) : duration;
  const label = number === 1
    ? duel ? t('准备开始第 1 局', 'Get ready for game 1') : t('准备开始第 1 把', 'Get ready for attempt 1')
    : duel ? t(`本局完成 · 第 ${number} 局即将开始打乱`, `Game complete · Game ${number} scramble up next`)
      : t(`本把完成 · 第 ${number} 把即将开始打乱`, `Attempt complete · Attempt ${number} scramble up next`);
  return <div className="competition-arena-countdown">
    <span role="status">{label}</span>
    <strong aria-label={t('剩余秒数', 'Seconds remaining')}>{remaining > 0 ? Math.ceil(remaining / 1000) : '…'}</strong>
    <progress value={remaining} max={duration} aria-label={t('距离打乱揭晓', 'Time until scramble reveal')} />
  </div>;
}

export function ArenaStatus({ readout, countdownAt, finished, total, correction, completed, ready, cube, matchOnly = false, showSolveLimit = true }: {
  readout: Readout; countdownAt: number | null; finished: number; total: number;
  correction: boolean; completed: boolean; ready: boolean; cube?: ArenaCube; matchOnly?: boolean; showSolveLimit?: boolean;
}) {
  const t = useT();
  const now = useAnimationClock(countdownAt === null && ['scrambling', 'confirming', 'inspecting', 'running'].includes(readout.stage), 100);
  const remaining = COMPETITION_STAGE_LIMIT_MS - (now - (readout.at ?? now));
  if (countdownAt !== null) return null;
  const current = effectiveStage(readout, now, !!cube);
  let label: string;
  let clock: string | null = null;
  if (completed) {
    label = matchOnly ? t('本场结束', 'Match complete') : t('比赛结束', 'Competition complete');
  } else if (current.stage === 'finished') {
    label = current.reason === 'disconnected' && cube && !cube.cube.status.connected
      ? t('连接中断 · DNF', 'Disconnected · DNF')
      : t(`等待本轮完赛 ${finished}/${total}`, `Waiting for results ${finished}/${total}`);
  } else if (current.stage === 'confirming') {
    label = t('准备观察', 'Ready to inspect');
  } else if (current.stage === 'inspecting') {
    label = t('观察中', 'Inspecting');
  } else if (current.stage === 'running') {
    label = current.inspectionMs === COMPETITION_OBSERVATION_WINDOW_MS && now - (current.at ?? now) < 2500
      ? t('已自动起表', 'Timer started automatically') : t('还原中', 'Solving');
    if (showSolveLimit) clock = remainingText(COMPETITION_STAGE_LIMIT_MS - (now - (current.at ?? now)));
  } else if (current.stage === 'scrambling') {
    label = correction ? t('按高亮步纠错', 'Follow the highlighted correction') : t('打乱中', 'Scrambling');
    clock = remainingText(remaining);
  } else {
    label = ready ? t('等待开赛', 'Waiting to start') : t('等待就绪', 'Waiting for readiness');
  }
  return <div className="competition-arena-status">
    <span data-dnf={current.reason === 'disconnected' && !completed || undefined}>{label}</span>{clock && <strong>{clock}</strong>}
    {current.stage === 'finished' && !completed && total > 0 &&
      <progress value={finished} max={total} aria-label={t('本轮完赛进度', 'Round completion')} />}
  </div>;
}

export function ArenaTop({ competition, project, round, status, cube, showConnectionPrompt = false }: {
  competition: OnlineCompetition; project: string; round: string; status: ReactNode; cube?: ArenaCube; showConnectionPrompt?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const anchor = useRef<HTMLButtonElement>(null);
  const device = cube?.cube.status;
  return <header className="competition-arena-hud">
    <div className="competition-arena-brand">
      <AppLink href={competitionHref(competition.slug || competition.id)} aria-label={t('返回赛事详情', 'Back to competition')}><ArrowLeft size={19} /></AppLink>
      <EventIcon event={project} />
      <strong>{t(competition.titleZh || competition.titleEn, competition.titleEn || competition.titleZh)}</strong>
      {competition.isTest && <CompetitionTestBadge />}
      {round && <span className="competition-state">{round}</span>}
    </div>
    {status}
    {cube && device && <div className="competition-arena-hardware">
      {(!showConnectionPrompt || device.connected) && <button ref={anchor} type="button" onClick={() => cube.openDevice()}
        className={`competition-arena-device ${device.connected ? 'competition-secondary' : 'competition-primary'}`}>
        {device.connected && <i className="competition-arena-connected" aria-hidden="true" />}<span>{device.connected ? device.deviceName : t('连接魔方', 'Connect cube')}</span>
        {device.connected && device.battery !== null && <><BatteryLevelIcon level={device.battery} /><span>{device.battery}%</span></>}
      </button>}
      {(cube.deviceOpen || cube.macPrompt) && <BluetoothModal isZh={lang === 'zh'} anchorRef={showConnectionPrompt && !device.connected ? undefined : anchor} cube={cube.cube}
        allowDeviceCalibration={false} connectAttempt={cube.connectAttempt} onClose={cube.closeDevice} onConnect={cube.connectDevice}
        macPrompt={cube.macPrompt} onSubmitMac={cube.resolveMac} onCancelMac={() => cube.resolveMac(null)} />}
    </div>}
  </header>;
}

function ArenaPreview({ project, scramble }: { project: string; scramble: string }) {
  const t = useT();
  return <TimerCubePreview event={timerEventIdFromSelector(project) ?? '333'} scramble={scramble}
    visualization="2D" fill ariaLabel={t('魔方展开图', 'Cube net')} />;
}

function ArenaSmartCube({ disconnected, syncing, children, tools }: {
  disconnected: boolean; syncing: boolean; children: ReactNode; tools?: ReactNode;
}) {
  const t = useT();
  return <div className="competition-arena-cube" data-disconnected={disconnected || undefined}>
    <div className="competition-arena-cube-model">{children}</div>
    {disconnected && <span className="competition-arena-cube-status">
      {syncing ? t('同步中', 'Syncing') : t('未连接', 'Disconnected')}
    </span>}
    {tools}
  </div>;
}

export function ArenaLocalCube({ cube, project, scramble }: { cube?: ArenaCube; project: string; scramble: string }) {
  const t = useT();
  const language = useLang();
  if (!cube) return <div className="competition-arena-cube"><ArenaPreview project={project} scramble={scramble} /></div>;
  const device = cube.cube.status;
  const ready = device.connected && !!cube.cube.facelets && cube.anchor.algAnchored;
  return <ArenaSmartCube disconnected={!ready} syncing={device.connected} tools={ready && cube.hasGyro &&
    <div className="competition-arena-cube-tools">
      <Tooltip content={t('视角回正', 'Reset orientation')}>{tip =>
        <button {...tip} className="competition-icon-button" type="button" aria-label={t('视角回正', 'Reset orientation')} onClick={cube.resetView}><RotateCcw size={16} /></button>}
      </Tooltip>
    </div>}>
    <LiveCubeState facelets={ready ? cube.cube.facelets : SOLVED_SMART_CUBE_FACELETS}
      moves={ready ? cube.anchor.moves : NO_MOVES} algAnchored={true} liveSource={ready ? cube.anchor.anchor : undefined}
      mode="3d" language={language} quatRef={cube.quatRef}
      useGyro={ready && cube.hasGyro} calibrateToken={cube.calibration} mirror={mirrorForBrand(device.brand)}
      sensorBasis={sensorBasisForBrand(device.brand)} />
  </ArenaSmartCube>;
}

export function ArenaRemoteCube({ project, scramble, smart, remote, playerId, stage = 'idle', hasPenalty }: {
  project: string; scramble: string; smart?: boolean; remote?: NetBattleLiveCubePlayer;
  playerId?: string | null; stage?: Readout['stage']; hasPenalty?: boolean;
}) {
  const t = useT();
  const language = useLang();
  if (!smart) {
    const showScramble = stage === 'scrambling' || stage === 'confirming' || stage === 'inspecting';
    const status = stage === 'running' ? t('对手复原中', 'Solving') : stage === 'finished' && hasPenalty ? 'DNF' : null;
    return <div className="competition-arena-cube">
      <div className="competition-arena-cube-model"><ArenaPreview project={project} scramble={showScramble ? scramble : ''} /></div>
      {status && <span className="competition-arena-cube-status" role="status">{status}</span>}
    </div>;
  }
  const live = remote?.connected && remote.smart && !!remote.facelets ? remote : null;
  return <ArenaSmartCube disconnected={!live} syncing={!!remote?.connected}>
    <LiveCubeState key={`${playerId ?? remote?.playerId ?? 'opponent'}:${live?.round ?? 0}`}
      facelets={live?.facelets ?? SOLVED_SMART_CUBE_FACELETS}
      moves={live?.moves ?? NO_MOVES} algAnchored={live?.algAnchored ?? true} liveSource={live?.liveSource} mode="3d" language={language}
      useGyro={!!live?.quatRef?.current} quatRef={live?.quatRef}
      sensorBasis="identity" mirror={false} orientationTauMs={20} />
  </ArenaSmartCube>;
}

export function ArenaReadinessDeadline({ at }: { at: number }) {
  const t = useT();
  const now = useAnimationClock(true, 250) || performance.now();
  const seconds = Math.max(0, Math.ceil((at - now) / 1000));
  return <p className="competition-arena-readiness-message">
    {t('报到截止倒计时', 'Ready by')} <time>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</time>
  </p>;
}

export function ArenaLobby({ at, total = 0, ready = 0, players, duel }: {
  at: number; total?: number; ready?: number; duel?: boolean;
  players?: Array<{ id: string; name: string; checkedIn: boolean; ready: boolean }>;
}) {
  const t = useT();
  const language = useLang();
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((at - performance.now()) / 1000)));
  useEffect(() => {
    const update = () => setSeconds(Math.max(0, Math.ceil((at - performance.now()) / 1000)));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [at]);
  const remaining = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const status = duel ? t('双方已就绪 · 等待全员检录或开赛时间', 'Both ready · Waiting for division check-in or start time')
    : total === 1 ? ready === 1 ? t('已检录就绪', 'Checked in and ready') : t('等待就绪', 'Waiting for readiness')
      : t(`已检录就绪 ${ready} / ${total} · 全员到齐或到点自动发打乱`, `${ready} / ${total} ready · Scrambles after everyone is ready or at start time`);
  return <section className="competition-arena-lobby" aria-label={t('赛前候场', 'Pre-start lobby')}>
    <p role="status">{status}</p>
    <div>{t('距离开赛', 'Starts in')} <strong>{remaining}</strong></div>
    {players && players.length > 1 && <ul>{players.map(player => <li key={player.id}>
      <span>{displayCuberName(player.name, language === 'zh')}</span>
      <small>{player.ready ? t('已就绪', 'Ready') : player.checkedIn ? t('已检录，准备中', 'Checked in · Preparing') : t('待检录', 'Awaiting check-in')}</small>
    </li>)}</ul>}
  </section>;
}

export function ArenaBoardToggle({ children, summary, stage }: { children: ReactNode; summary: ReactNode; stage: Readout['stage'] }) {
  const drawer = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const element = drawer.current;
    if (!element) return;
    if (stage === 'confirming' || stage === 'inspecting' || stage === 'running') element.open = false;

    function dismiss(event: PointerEvent) {
      if (element?.open && event.target instanceof Node && !element.contains(event.target)) element.open = false;
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [stage]);

  return <details ref={drawer} className="competition-arena-board-toggle">
    <MoreToggle as="summary" animate={false}>{summary}</MoreToggle>
    <div className="competition-arena-board-drawer" data-site-surface="popover">{children}</div>
  </details>;
}
