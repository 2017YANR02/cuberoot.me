'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, LayoutGrid, RotateCcw, Box } from 'lucide-react';
import { COMPETITION_INSPECTION_MS, COMPETITION_STAGE_LIMIT_MS, competitionSolveStart, timerEventIdFromSelector } from '@cuberoot/shared/timer';
import { BatteryLevelIcon, SegmentTime, TimerCubePreview, TimerSmartCubeDeviceModal, type NetBattleLiveCubePlayer } from '@cuberoot/timer-ui';
import { Flag } from '@cuberoot/timer-ui/country-flag';
import { mirrorForBrand, sensorBasisForBrand } from '@cuberoot/shared/smart-cube/orientation';
import AppLink from '@/components/AppLink';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import PersonLink from '@/components/PersonLink';
import { Tooltip } from '@/components/Tooltip';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import MoreToggle from '@/components/MoreToggle';
import { formatWcaResult } from '@/lib/wca-format-result';
import type { CompetitionArenaIdentity, CompetitionAttemptResult, OnlineCompetition } from '@/lib/online-competition-api';
import type { CompetitionDnfReason } from '@cuberoot/shared/timer';
import { attemptValue } from './competition-results';
import type { useCompetitionCube } from './useCompetitionCube';

const LiveCubeState = dynamic(() => import('@cuberoot/timer-ui/LiveCubeState'), { ssr: false });
const TimerRemoteLiveCube = dynamic(() => import('@cuberoot/timer-ui').then(module => module.TimerRemoteLiveCube), { ssr: false });

export type ArenaCube = ReturnType<typeof useCompetitionCube>;
export type Readout = { stage: 'scrambling' | 'inspecting' | 'running' | 'finished' | 'idle'; at?: number; duration?: number; result?: CompetitionAttemptResult | null; reason?: CompetitionDnfReason | null; inspectionMs?: number };

export function ArenaIdentity({ person }: { person: CompetitionArenaIdentity }) {
  const lang = useLang();
  return <PersonLink wcaId={person.wcaId ?? ''} name={person.name} isZh={lang === 'zh'} className="competition-arena-name"
    flag={person.wcaId && person.countryCode ? <Flag iso2={person.countryCode} spanClassName="country-flag" imgClassName="country-flag-ct" /> : undefined} />;
}

export function arenaPersonReadout(entered: string | null, inspect: string | null | undefined, solve: string | null | undefined,
  offset: number, result?: CompetitionAttemptResult | null, reason?: CompetitionDnfReason | null): Readout {
  if (result) return { stage: 'finished', result, reason };
  if (!entered) return { stage: 'idle' };
  const issued = Date.parse(entered) - offset;
  if (!inspect) return { stage: 'scrambling', at: issued };
  const at = Date.parse(inspect) - offset;
  if (solve) return { stage: 'running', at: Date.parse(solve) - offset };
  return { stage: 'inspecting', at };
}

function effectiveStage(readout: Readout, now: number, automatic = true) {
  if (readout.stage !== 'inspecting' || !automatic || now < (readout.at ?? now) + COMPETITION_INSPECTION_MS) return readout;
  return { ...readout, stage: 'running' as const, at: competitionSolveStart(readout.at!) };
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

export function ArenaReadout({ value, project, moves = 0, automatic = true, best = false }: {
  value: Readout; project: string; moves?: number; automatic?: boolean; best?: boolean;
}) {
  const t = useT();
  const now = useAnimationClock(value.stage === 'running' || value.stage === 'inspecting', 28);
  const readout = effectiveStage(value, now, automatic);
  const elapsed = Math.max(0, Math.min(COMPETITION_STAGE_LIMIT_MS, now - (readout.at ?? now)));
  const duration = readout.duration ?? (readout.result?.centiseconds == null ? 0 : readout.result.centiseconds * 10);
  const inspecting = readout.stage === 'inspecting';
  const remaining = Math.max(0, (automatic ? COMPETITION_INSPECTION_MS : 15_000) - elapsed);
  const time = readout.stage === 'finished' ? readout.result ? formatWcaResult(attemptValue(readout.result), project, 'single')
    : readout.reason ? 'DNF' : formatWcaResult(Math.max(1, Math.floor(duration / 10)), project, 'single')
    : inspecting ? (Math.ceil(remaining / 100) / 10).toFixed(1)
      : elapsed < 10 || readout.stage !== 'running' ? '0.00' : formatWcaResult(Math.floor(elapsed / 10), project, 'single');
  const metricTime = readout.stage === 'finished' ? duration : elapsed;
  const color = time === 'DNF' ? 'dnf' : inspecting && remaining <= 4000 ? 'warn12' : inspecting && remaining <= 8000 ? 'warn8' : undefined;
  return <div className="competition-arena-reading" data-stage={readout.stage}>
    <output aria-label={t('计时', 'Timer')} className="competition-arena-time" data-color={color} aria-live="off"><SegmentTime text={time} /></output>
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

export function ArenaStatus({ readout, countdownAt, finished, total, next, correction, completed, ready, cube }: {
  readout: Readout; countdownAt: number | null; finished: number; total: number; next: number;
  correction: boolean; completed: boolean; ready: boolean; cube?: ArenaCube;
}) {
  const t = useT();
  const now = useAnimationClock(countdownAt !== null || ['scrambling', 'inspecting', 'running'].includes(readout.stage), 100);
  const remaining = COMPETITION_STAGE_LIMIT_MS - (now - (readout.at ?? now));
  const seconds = countdownAt === null ? 0 : Math.max(0, Math.ceil((countdownAt - now) / 1000));
  const current = effectiveStage(readout, now, !!cube);
  let label: string;
  let clock: string | null = null;
  if (completed) {
    label = t('比赛结束', 'Finished');
  } else if (countdownAt !== null) {
    label = t(`第 ${next} 把即将开始`, `Round ${next} starting`);
    clock = seconds > 0 ? String(seconds) : '…';
  } else if (current.stage === 'finished') {
    label = current.reason === 'disconnected' && cube && !cube.cube.status.connected
      ? t('连接中断 · DNF', 'Disconnected · DNF')
      : t(`等待本轮完赛 ${finished}/${total}`, `Waiting for results ${finished}/${total}`);
  } else if (current.stage === 'inspecting') {
    label = t('观察中', 'Inspecting');
  } else if (current.stage === 'running') {
    label = current.inspectionMs === COMPETITION_INSPECTION_MS && now - (current.at ?? now) < 2500
      ? t('已自动起表', 'Timer started automatically') : t('复原中', 'Solving');
    clock = remainingText(COMPETITION_STAGE_LIMIT_MS - (now - (current.at ?? now)));
  } else if (current.stage === 'scrambling') {
    label = correction ? t('按高亮步纠错', 'Follow the highlighted correction') : t('打乱中', 'Scrambling');
    clock = remainingText(remaining);
  } else {
    label = ready ? t('等待开赛', 'Waiting to start') : t('等待就绪', 'Waiting for readiness');
  }
  return <div className="competition-arena-status">
    <span data-dnf={current.reason === 'disconnected' && !completed && countdownAt === null || undefined}>{label}</span>{clock && <strong>{clock}</strong>}
    {current.stage === 'finished' && !completed && countdownAt === null && total > 0 &&
      <progress value={finished} max={total} aria-label={t('本轮完赛进度', 'Round completion')} />}
    {current.reason === 'disconnected' && cube && !cube.cube.status.connected && countdownAt === null &&
      <button className="competition-secondary" type="button" onClick={() => void cube.connect()}>{t('重连', 'Reconnect')}</button>}
  </div>;
}

export function ArenaTop({ competition, project, round, status, cube }: {
  competition: OnlineCompetition; project: string; round: string; status: ReactNode; cube?: ArenaCube;
}) {
  const t = useT();
  const lang = useLang();
  const [deviceOpen, setDeviceOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const device = cube?.cube.status;
  return <header className="competition-arena-hud">
    <div className="competition-arena-brand">
      <AppLink href={`/competitions/${encodeURIComponent(competition.slug || competition.id)}`} aria-label={t('返回赛事详情', 'Back to competition')}><ArrowLeft size={19} /></AppLink>
      <EventIcon event={project} />
      <strong>{t(competition.titleZh || competition.titleEn, competition.titleEn || competition.titleZh)}</strong>
      {round && <span className="competition-state">{round}</span>}
    </div>
    {status}
    {cube && device && <div className="competition-arena-hardware">
      <button ref={anchor} type="button" onClick={() => setDeviceOpen(true)} className={device.connected ? 'competition-secondary' : 'competition-primary'}>
        {device.connected && <i className="competition-arena-connected" aria-hidden="true" />}<span>{device.connected ? device.deviceName : t('连接魔方', 'Connect cube')}</span>
        {device.connected && device.battery !== null && <><BatteryLevelIcon level={device.battery} /><span>{device.battery}%</span></>}
      </button>
      {(deviceOpen || cube.macPrompt) && <TimerSmartCubeDeviceModal language={lang} anchorRef={anchor}
        snapshot={{ phase: device.connected ? 'connected' : cube.connecting ? 'connecting' : 'idle', deviceName: device.deviceName, battery: device.battery }}
        onClose={() => { setDeviceOpen(false); cube.resolveMac(null); }}
        onConnect={cube.connect} onDisconnect={cube.cube.disconnect} onResetGyro={cube.hasGyro ? cube.resetView : undefined}
        connectionFailure={cube.bluetoothUnavailable ? t('当前环境不支持蓝牙连接智能魔方', 'Bluetooth smart cube connection is not available in this environment')
          : cube.connectionError ? t('连接失败，请重新配对', 'Connection failed. Pair again.') : undefined}
        macPrompt={cube.macPrompt ? { deviceName: cube.macPrompt, onSubmit: cube.resolveMac, onCancel: () => cube.resolveMac(null) } : undefined}
      />}
    </div>}
  </header>;
}

function ArenaPreview({ project, scramble }: { project: string; scramble: string }) {
  const t = useT();
  return <TimerCubePreview event={timerEventIdFromSelector(project) ?? '333'} scramble={scramble}
    visualization="2D" fill ariaLabel={t('魔方展开图', 'Cube net')} />;
}

export function ArenaLocalCube({ cube, project, scramble }: { cube?: ArenaCube; project: string; scramble: string }) {
  const t = useT();
  const lang = useLang();
  const [mode, setMode] = useState<'3d' | 'net'>('3d');
  const device = cube?.cube.status;
  return <div className="competition-arena-cube">
    {cube && device?.connected ? <>
      <LiveCubeState facelets={cube.cube.facelets} moves={cube.anchor.moves} algAnchored={cube.anchor.algAnchored}
        liveSource={cube.anchor.anchor} mode={mode} language={lang} quatRef={cube.quatRef}
        useGyro={cube.hasGyro} calibrateToken={cube.calibration} mirror={mirrorForBrand(device.brand)}
        sensorBasis={sensorBasisForBrand(device.brand)} />
      <div className="competition-arena-cube-tools">
        <Tooltip content={mode === '3d' ? t('展开图', 'Cube net') : t('三维视图', '3D view')}>{tip =>
          <button {...tip} className="competition-icon-button" type="button" aria-label={mode === '3d' ? t('展开图', 'Cube net') : t('三维视图', '3D view')}
            onClick={() => setMode(mode === '3d' ? 'net' : '3d')}>{mode === '3d' ? <LayoutGrid size={16} /> : <Box size={16} />}</button>}
        </Tooltip>
        {mode === '3d' && cube.hasGyro && <Tooltip content={t('视角回正', 'Reset orientation')}>{tip =>
          <button {...tip} className="competition-icon-button" type="button" aria-label={t('视角回正', 'Reset orientation')} onClick={cube.resetView}><RotateCcw size={16} /></button>}
        </Tooltip>}
      </div>
    </> : <ArenaPreview project={project} scramble={scramble} />}
  </div>;
}

export function ArenaRemoteCube({ project, scramble, remote }: {
  project: string; scramble: string; remote?: NetBattleLiveCubePlayer;
}) {
  const language = useLang();
  return <div className="competition-arena-cube">
    {remote?.connected && remote.smart && remote.facelets
      ? <TimerRemoteLiveCube playerId={remote.playerId} live={remote} mode="3d" language={language} />
      : <ArenaPreview project={project} scramble={scramble} />}
  </div>;
}

export function ArenaBoardToggle({ children, summary, stage }: { children: ReactNode; summary: ReactNode; stage: Readout['stage'] }) {
  const drawer = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const element = drawer.current;
    if (!element) return;
    if (stage === 'inspecting' || stage === 'running') element.open = false;

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
