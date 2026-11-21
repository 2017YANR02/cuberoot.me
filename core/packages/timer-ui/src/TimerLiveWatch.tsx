'use client';
import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SOLO_LAYOUT, DEFAULT_TIMER_TYPOGRAPHY, TIMER_EVENT_PICKER_GROUPS, timerPracticeContents,
  formatTimerTimingDisplay, summarize, type Solve } from '@cuberoot/shared/timer';
import type { TimerLiveCredential, TimerLiveState } from '@cuberoot/shared/timer/live-share';
import { useTimerLiveConnection, type TimerLiveTransport } from './timer-live-share';
import { TimerSoloPage } from './TimerSoloPage';
import { TimerWorkspace, useTimerWideLayout } from './TimerWorkspace';
import { TimerStatRail } from './TimerChrome';
import { TimerScrambleStrip } from './TimerScrambleStrip';
import { TimerCubePreview, timerCubePreviewAspect } from './TimerCubePreview';
import LiveCubeState from './LiveCubeState';
import { SegmentTime } from './SegmentTime';
import { TimerHistoryRow } from './TimerHistoryRow';
import { TimerPuzzlePicker } from './TimerPuzzlePicker';
import { TimerPracticeContentPicker } from './TimerPracticeContentPicker';
import { TimerScrambleSourceSelect } from './TimerScrambleSourceSelect';
import type { ReconstructHost } from './reconstruct/ReconstructHost';
import './timer-live-share.css';
import './timer-chrome.css';
import './timer-stage-layout.css';
import './timing-surface.css';
import './scramble-strip.css';
const ReconstructReport = memo(lazy(() => import('./reconstruct/ReconstructReport')));
const SharedHistoryRow = memo(TimerHistoryRow);
const LiveDigits = memo(function LiveDigits({ state, online, clockOffset }: { state: TimerLiveState | undefined; online: boolean; clockOffset: number }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    if (!online) return;
    const id = setInterval(() => setNow(Date.now()), 30);
    return () => clearInterval(id);
  }, [online, state?.sampledAt]);
  const elapsed = online && state ? Math.max(0, Math.min(8000, now + clockOffset - state.sampledAt)) : 0;
  const digits = state ? formatTimerTimingDisplay({ phase: state.phase, displayMs: state.elapsedMs + (state.phase === 'running' ? elapsed : 0),
    inspectionDisplayMs: state.inspectionMs + (state.phase === 'inspecting' ? elapsed : 0),
    inspectionLimitSec: state.inspectionSec, timingEnabled: state.timingEnabled, hideTime: state.hideTime, precision: state.precision, runningPrecision: state.runningPrecision,
    lastPenalty: state.lastPenalty, trainingObservation: state.trainingObservation }) : '—';
  return <SegmentTime text={digits} />;
});

/** No timer controller, device connection, or persistence is mounted by this view. */
export function TimerLiveWatch({ transport, credential, language, host, className = '' }: {
  transport: TimerLiveTransport; credential: TimerLiveCredential | null; language: 'en' | 'zh'; host: ReconstructHost;
  className?: string;
}) {
  const live = useTimerLiveConnection(transport, credential, 'viewer');
  const tr = <T,>(v: { en: T; zh: T }) => v[language];
  const surface = useRef<HTMLDivElement>(null);
  const quatRef = useRef<import('@cuberoot/shared/smart-cube/orientation').Quat | null>(null);
  quatRef.current = live.snapshot?.cube.quaternion ?? null;
  const [historyOpen, setHistoryOpen] = useState(false);
  const wide = useTimerWideLayout();
  const [selected, setSelected] = useState<{ identity: string; context: string; requestId: string; solve: Solve } | null>(null);
  const [detailTimedOut, setDetailTimedOut] = useState(false);
  const [liveStageTarget, setLiveStageTarget] = useState<HTMLDivElement | null>(null);
  const snapshot = live.snapshot;
  const state = snapshot?.state;
  const appearance = state?.appearance ?? DEFAULT_TIMER_TYPOGRAPHY;
  const soloLayout = state?.appearance?.soloLayout ?? DEFAULT_SOLO_LAYOUT;
  const contents = useMemo(() => timerPracticeContents(state?.event ?? '333', { pllChain: true }), [state?.event]);
  const content = contents.find(item => item.id === state?.controls?.contentId);
  const online = live.online && live.connection === 'connected';
  const identity = `${credential?.id}:${state?.context}:${state?.event}`;
  useEffect(() => { setSelected(null); }, [identity]);
  useEffect(() => {
    setDetailTimedOut(false);
    if (!selected) return;
    const id = setTimeout(() => setDetailTimedOut(true), 6000);
    return () => clearTimeout(id);
  }, [selected]);
  const history = useMemo(() => snapshot?.history.filter(s => s.event === state?.event) ?? [], [snapshot?.history, state?.event]);
  const stats = useMemo(() => summarize(history, state?.event), [history, state?.event]);
  const activeSelected = selected?.identity === identity ? selected : null;
  const detail = activeSelected && live.detail?.requestId === activeSelected.requestId && live.detail.context === activeSelected.context
    ? live.detail.solve : null;
  const reportSolve = activeSelected ? detail : snapshot?.attempt?.solve;
  const status = !credential ? tr({ en: 'Invalid share link', zh: '分享链接无效' })
    : live.connection === 'ended' ? tr({ en: 'Sharing has ended or expired', zh: '分享已结束或过期' })
      : live.connection === 'error' ? tr({ en: 'Unable to watch this share', zh: '无法观看此分享' })
        : online ? tr({ en: 'Live', zh: '实时观看' })
          : live.connection === 'connected' ? tr({ en: 'Waiting for the sharer to reconnect', zh: '等待分享者重新连接' })
            : tr({ en: 'Connecting…', zh: '正在连接…' });
  const openDetail = (solve: Solve) => {
    if (!state) return;
    const requestId = crypto.randomUUID();
    setHistoryOpen(false);
    setSelected({ identity, context: state.context, solve, requestId });
    live.requestDetail(solve.id, state.context, requestId);
  };
  const report = <div className="timer-live-watch-report timer-workspace-panel-body" data-no-timer>
    {activeSelected && <>
      <button type="button" className="hint-btn" onClick={() => setSelected(null)}>{tr({ en: 'Return to live', zh: '返回实况' })}</button>
      <p>{activeSelected.solve.scramble}</p>
      {!detail && <p role="status">{detailTimedOut || !online
        ? tr({ en: 'Detail unavailable. Retry when the sharer is online.', zh: '详情暂不可用，请在分享者在线时重试。' })
        : tr({ en: 'Loading reconstruction…', zh: '正在加载复盘…' })}</p>}
      {!detail && <button type="button" className="hint-btn" disabled={!online} onClick={() => openDetail(activeSelected.solve)}>{tr({ en: 'Retry', zh: '重试' })}</button>}
    </>}
    {reportSolve?.moves?.length ? <Suspense fallback={<p>{tr({ en: 'Loading…', zh: '正在加载…' })}</p>}>
      <ReconstructReport key={reportSolve.id} host={host} solve={reportSolve} isZh={language === 'zh'} history={history}
        hideActions hideDate live={!activeSelected && state?.phase === 'running'} liveGyroSamples={!activeSelected && state?.phase === 'running' ? snapshot?.attempt?.gyro : undefined}
        liveStageTarget={!activeSelected ? liveStageTarget : undefined} />
    </Suspense> : detail ? <p>{tr({ en: 'No smart-cube recording for this solve', zh: '这条成绩没有智能魔方记录' })}</p> : null}
  </div>;
  const historyContent = <div className="timer-live-watch-history timer-workspace-panel-body" data-no-timer>
        <button type="button" className="hint-btn" onClick={() => setHistoryOpen(false)}>{tr({ en: 'Close history', zh: '关闭成绩' })}</button>
        <p>{tr({ en: 'Current session · up to 200 recent solves', zh: '当前分组 · 最近最多 200 条成绩' })}</p>
        <div>{history.slice().reverse().map((solve, i) => <SharedHistoryRow key={solve.id} solve={solve} index={history.length - i - 1} onActivate={openDetail} />)}</div>
      </div>;
  return <TimerWorkspace className={`timer-live-watch ${className}`} soloLayout={soloLayout}
    panelOpen={historyOpen} recap={!historyOpen && (reportSolve || activeSelected) ? report : undefined}>
    <TimerSoloPage title={tr({ en: 'Live timer', zh: '计时器实况' })}
      topbar={{ controls: <>
        <TimerPuzzlePicker readOnly selectedEvent={state?.event ?? ''} puzzleLabel={tr({ zh: '项目', en: 'Puzzle' })}
          groups={TIMER_EVENT_PICKER_GROUPS.map(group => ({ id: group.id, label: tr({ zh: group.nameZh, en: group.nameEn }),
            items: group.items.map(item => ({ id: item.id, label: tr({ zh: item.nameZh, en: item.nameEn }), iconClass: item.iconClass, textLabel: item.textLabel })) }))}
          onSelect={() => {}} />
        <TimerPracticeContentPicker readOnly entries={contents} selectedId={content?.id} label={content ? tr(content.title) : '—'}
          language={language} onSelect={() => {}} />
        <span className="timer-practice-control"><TimerScrambleSourceSelect readOnly value={state?.controls?.source ?? 'wca'} realValue="wca"
          triggerClassName="shell-players-select" labels={{ ariaLabel: tr({ zh: '出题来源', en: 'Question source' }),
            real: state?.controls ? tr({ zh: '真题', en: 'Real' }) : '—', realOption: tr({ zh: 'WCA 真题', en: 'WCA real' }),
            random: tr({ zh: '随机', en: 'Random' }), randomOption: tr({ zh: '随机', en: 'Random' }),
            manual: tr({ zh: '手动', en: 'Manual' }), manualOption: tr({ zh: '手动输入', en: 'Manual input' }) }} onChange={() => {}} /></span>
      </>,
        liveStatus: status }}
      stage={{ statistics: <TimerStatRail language={language} summary={stats} ariaExpanded={historyOpen} onClick={() => setHistoryOpen(v => !v)} /> }}
      timing={{ surfaceRef: surface, phase: state?.phase ?? 'idle', colorClass: `tf-${appearance.timerFont}`, fontScale: appearance.timerFontScale,
        digits: <LiveDigits state={state} online={online} clockOffset={live.clockOffset} />, interactive: false,
        ariaLabel: tr({ en: 'Shared timer', zh: '共享计时器' }),
        scrambleSlot: <TimerScrambleStrip scramble={state?.scramble ?? ''} font={appearance.scrambleFont} fontScale={appearance.scrambleFontScale}
          hint={state?.guidance?.hint} correctionActive={state?.guidance?.correctionActive} match={state?.guidance?.match}
          copiedLabel={tr({ en: 'Copied', zh: '已复制' })} verificationLabels={{ copiedCorrection: '' }} />,
        cornerAspect: !snapshot?.cube.facelets && state ? timerCubePreviewAspect(state.event, state.scramble) : undefined,
        cornerSlot: snapshot?.cube.facelets ? <div className="timer-live-cube"><LiveCubeState facelets={snapshot.cube.facelets}
          language={language} mode={snapshot.cube.algAnchored ? '3d' : 'net'} resetViewOnRelease useGyro={!!snapshot.cube.quaternion} quatRef={quatRef}
          moves={[...snapshot.cube.moves]} algAnchored={snapshot.cube.algAnchored}
          sensorBasis="identity" mirror={false} /></div>
          : state && state.scramble ? <TimerCubePreview event={state.event} scramble={state.scramble} fill /> : undefined,
        cubeFooter: snapshot?.attempt && <div ref={setLiveStageTarget} className="timer-live-stage" data-no-timer />,
      }}
      narrowRecap={!historyOpen && (reportSolve || activeSelected) ? report : undefined}
      afterTiming={!wide && historyOpen ? historyContent : undefined}
      history={wide && historyOpen ? <aside className="timer-workspace-panel shell-panel--rail" data-site-surface="panel" data-no-timer>{historyContent}</aside> : undefined} />
  </TimerWorkspace>;
}
