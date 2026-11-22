import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, History, Play, RefreshCw, Trash2 } from '@app-foundation/icons/lucide';
import SettingsDialog from '@/components/SettingsDialog';
import { formatTimerTimingDisplay } from '@cuberoot/shared/timer';
import { TimerScramblePreview, TimerScrambleStrip, TimingSurface } from '@cuberoot/timer-ui';
import '@cuberoot/timer-ui/timing-surface.css';
import '@cuberoot/timer-ui/scramble-strip.css';
import TimerReadout from '../timer/_components/TimerReadout';
import { useSettings } from '../timer/_lib/settings';
import { useTimer } from '../timer/_shared/useTimer';
import { useT } from '@/hooks/useT';
import { persistItem } from '@/lib/safe-storage';
import {
  compactTimerReconstruction, formatTimer, readTimerSolves, solveTime,
  timerAverage, timerReconstructionStatus, timerSessionRows, type Penalty, type TimerReconstructionResult, type TimerSolve,
} from '@/lib/video-recon/engine/cube-timer';
import type { VideoWorkspace } from '@/lib/video-recon/workspace';
import { TimerReplay, type ReplaySeek } from './TimerReplay';
import { TpsGraph } from './TpsGraph';

type View = ReturnType<VideoWorkspace['getSnapshot']>;
const STORAGE_KEY = 'live-recognition.timer.v1';

export function CameraTimer({ active, view, workspace }: { active: boolean; view: View; workspace: VideoWorkspace }) {
  const t = useT();
  const settings = useSettings();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [scramble, setScramble] = useState('');
  const [loading, setLoading] = useState(false);
  const scramblePending = useRef(false);
  const [scrambleError, setScrambleError] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [history, setHistory] = useState<TimerSolve[]>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [replayPosition, setReplayPosition] = useState<number>();
  const [replaySeek, setReplaySeek] = useState<ReplaySeek>();
  const [confirmClear, setConfirmClear] = useState(false);
  const lastSaved = useRef('');
  const rows = useMemo(() => timerSessionRows(history ?? []), [history]);
  const best = useMemo(() => history?.length ? Math.min(...history.map(solveTime)) : undefined, [history]);
  const activeAttempt = useRef<{ id: string; scramble: string; startedAt: string; startClockMs: number }>(undefined);
  const dialogOpen = historyOpen || !!selectedId || confirmClear;
  const canStart = active && view.timerReady && !!scramble && !loading && !dialogOpen;
  const selected = rows.find(row => row.solve.id === selectedId);
  const last = history?.at(-1);
  const resultFor = (solve?: TimerSolve) => solve && (view.timerReconstructions[solve.id] ?? solve.reconstruction);
  const lastResult = resultFor(last);
  const selectedResult = resultFor(selected?.solve);
  const selectedReplay = selectedId ? view.timerReplays[selectedId] : undefined;
  const selectedPlayback = selectedResult?.result ? selectedResult : selectedReplay?.reconstruction ?? selectedResult;

  const nextScramble = useCallback(async () => {
    if (scramblePending.current) return;
    scramblePending.current = true;
    setLoading(true);
    setScrambleError(false);
    try {
      const { randomScrambleForEvent } = await import('cubing/scramble');
      setScramble((await randomScrambleForEvent('333')).toString());
    } catch { setScrambleError(true); }
    finally { setLoading(false); scramblePending.current = false; }
  }, []);

  useEffect(() => {
    try {
      const stored = readTimerSolves(localStorage.getItem(STORAGE_KEY));
      setHistory(stored.map(solve => solve.reconstruction && !['solved', 'failed'].includes(solve.reconstruction.status)
        ? { ...solve, reconstruction: { ...solve.reconstruction, status: 'failed', message: 'Page reloaded before reconstruction finished' } }
        : solve));
    } catch { setHistory([]); setStorageError(true); }
  }, []);

  const firstScrambleRequested = useRef(false);
  useEffect(() => {
    if (active && !firstScrambleRequested.current) {
      firstScrambleRequested.current = true;
      void nextScramble();
    }
  }, [active, nextScramble]);

  useEffect(() => {
    if (!history) return;
    const saved = JSON.stringify(history.map(solve => ({
      ...solve,
      reconstruction: compactTimerReconstruction(view.timerReconstructions[solve.id] ?? solve.reconstruction),
    })));
    if (saved === lastSaved.current) return;
    const persisted = persistItem(STORAGE_KEY, saved);
    if (persisted) lastSaved.current = saved;
    setStorageError(!persisted);
  }, [history, view.timerReconstructions]);

  useEffect(() => {
    workspace.selectTimerReplay(active ? selectedId : undefined);
    return () => workspace.selectTimerReplay();
  }, [active, selectedId, workspace]);

  const timer = useTimer(({ timeMs, autoPenalty }) => {
    const attempt = activeAttempt.current;
    if (!attempt) return;
    activeAttempt.current = undefined;
    const { startClockMs, ...solve } = attempt;
    workspace.stopTimerSolve(solve.id, startClockMs + timeMs);
    setHistory(solves => [...(solves ?? []), { ...solve, elapsedMs: timeMs, penalty: autoPenalty === 'ok' ? 'none' : autoPenalty }]);
    void nextScramble();
  }, startedAtMs => {
    const id = crypto.randomUUID();
    const startClockMs = performance.timeOrigin + startedAtMs;
    activeAttempt.current = { id, scramble, startedAt: new Date(startClockMs).toISOString(), startClockMs };
    workspace.startTimerSolve(id, scramble, startClockMs);
  });
  const { phase, cancelArm, abortRun, onPressDown, onPressUp, cancelPress } = timer;
  const locked = phase !== 'idle' && phase !== 'stopped';

  useEffect(() => {
    if (!locked || canStart) return;
    if (phase === 'running') abortRun();
    else cancelArm();
  }, [locked, canStart, phase, abortRun, cancelArm]);

  useEffect(() => {
    if (active) workspace.setTimerBusy(locked);
    return () => { if (active && locked) workspace.setTimerBusy(false); };
  }, [active, locked, workspace]);

  useEffect(() => {
    if (!active) return;
    const down = (event: KeyboardEvent) => {
      if (dialogOpen || event.defaultPrevented || event.repeat || event.altKey || event.metaKey || event.ctrlKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const onSurface = target === surfaceRef.current;
      const editable = target?.closest('input, textarea, select, button, a, [contenteditable="true"], [role="application"], [role="slider"], .video-recon-replay');
      if (phase !== 'running' && (!canStart || editable || !(event.code === 'Space' || onSurface && event.code === 'Enter'))) return;
      event.preventDefault();
      onPressDown();
    };
    const up = (event: KeyboardEvent) => {
      if ((event.code === 'Space' || event.code === 'Enter' && event.target === surfaceRef.current) &&
        (phase === 'holding' || phase === 'ready') && !event.defaultPrevented) {
        event.preventDefault();
        onPressUp();
      }
    };
    const blur = () => { if (locked && phase !== 'running') cancelArm(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [active, canStart, locked, phase, dialogOpen, onPressDown, onPressUp, cancelArm]);

  function select(id?: string) {
    setReplayPosition(undefined);
    setReplaySeek(undefined);
    setSelectedId(id);
  }

  function seek(timestamp: number) {
    setReplaySeek(value => ({ timestamp, revision: (value?.revision ?? 0) + 1 }));
  }

  function downloadSession() {
    const solves = (history ?? []).map(solve => ({ ...solve, reconstruction: resultFor(solve) }));
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, event: '333', generator: 'cubing.js', solves }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cube-timer-session.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const statusLabel = (value?: TimerReconstructionResult) => ({
    idle: t('待计时', 'Ready'),
    searching: t('正在复盘', 'Reconstructing'),
    solved: t('完整复盘', 'Full reconstruction'),
    failed: t('复盘未完成', 'Reconstruction incomplete'),
    'time-limit': t('复盘超时', 'Reconstruction timed out'),
  })[timerReconstructionStatus(value).kind];
  const timerHint = phase === 'running' ? t('点按数字或按任意键停表', 'Tap the digits or press any key to stop')
    : phase === 'ready' ? t('松手开始', 'Release to start')
    : phase === 'holding' ? t('继续按住', 'Keep holding')
    : canStart && settings.inspectionSec > 0 && phase !== 'inspecting'
      ? t('点按数字或空格开始观察', 'Tap the digits or press Space to start inspection')
      : canStart ? t('按住数字或空格，松手开始', 'Hold the digits or Space, then release to start') : undefined;
  const digits = formatTimerTimingDisplay({
    phase, displayMs: timer.displayMs, inspectionDisplayMs: timer.inspectionDisplayMs,
    inspectionLimitSec: settings.inspectionSec, lastPenalty: last?.penalty === 'none' ? 'ok' : last?.penalty ?? null,
    precision: settings.precision, runningPrecision: settings.runningPrecision, hideTime: settings.hideTime, timingEnabled: true,
  });
  const historyLabel = t('本次记录', 'Session history');
  const selectedStart = selectedPlayback?.config?.requested_start_seconds ?? selectedReplay?.start ?? 0;

  return <div className="video-recon-timer" hidden={!active}>
    <section className="video-recon-panel video-recon-timer-panel" data-site-surface="panel">
      <div className="video-recon-section-heading">
        <h2>{t('打乱', 'Scramble')}</h2>
        <button type="button" className="btn-secondary" disabled={locked || loading} onClick={() => void nextScramble()}>
          <RefreshCw size={16} aria-hidden />{t('换打乱', 'New scramble')}
        </button>
      </div>
      <div className="video-recon-scramble">
        <TimerScrambleStrip scramble={scramble} font={settings.scrambleFont} fontScale={settings.scrambleFontScale}
          fallback={loading ? t('正在生成打乱…', 'Generating scramble…') : '—'} timingEnabled={false}
          copiedLabel={t('已复制', 'Copied')} verificationLabels={{ copiedCorrection: t('已复制修正步骤', 'Correction copied') }} />
        {scramble && <TimerScramblePreview event="333" scramble={scramble} height={78} ariaLabel={t('打乱展开图', 'Scramble net')} />}
      </div>
      {scrambleError && <p role="alert">{t('打乱生成失败，请重试。', 'Could not generate a scramble. Try again.')}</p>}
      <TimingSurface phase={phase} colorClass={`${phase} tf-${settings.timerFont}`} surfaceRef={surfaceRef}
        digits={<TimerReadout text={digits} />} fontScale={settings.timerFontScale} interactive={canStart || phase === 'running'}
        ariaLabel={timerHint ?? t('还原用时', 'Solve time')}
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0 || !canStart && phase !== 'running') return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          onPressDown();
        }}
        onPointerUp={event => { if (event.isPrimary && event.button === 0 && canStart) onPressUp(); }}
        onPointerCancel={cancelPress}>
        {timerHint && <span className="video-recon-muted">{timerHint}</span>}
      </TimingSurface>
      <div className="video-recon-timer-session">
        <dl className="video-recon-stats">
          <div><dt>{t('最佳', 'Best')}</dt><dd>{formatTimer(best)}</dd></div>
          <div><dt>ao5</dt><dd>{formatTimer(history && timerAverage(history, 5))}</dd></div>
          <div><dt>ao12</dt><dd>{formatTimer(history && timerAverage(history, 12))}</dd></div>
        </dl>
        <div className="video-recon-actions">
          <button type="button" className="btn-secondary" aria-haspopup="dialog" disabled={!last || locked} onClick={() => select(last?.id)}>
            <Play size={16} aria-hidden />{t('最近回放', 'Latest replay')}
          </button>
          <button type="button" className="btn-secondary" aria-haspopup="dialog" disabled={locked} onClick={() => setHistoryOpen(true)}>
            <History size={16} aria-hidden />{historyLabel} ({rows.length})
          </button>
        </div>
        {lastResult && !locked && <span className="video-recon-muted" role="status">{statusLabel(lastResult)}</span>}
      </div>
    </section>

    {active && historyOpen && !selected && !confirmClear && <SettingsDialog label={historyLabel} heading
      panelClassName="video-recon-history-modal" onClose={() => setHistoryOpen(false)}>
      <div className="video-recon-modal-body">
        <div className="video-recon-history">
          <table className="sticky-thead" aria-label={t('计时记录', 'Solve history')}>
            <thead><tr><th scope="col">#</th><th scope="col">{t('用时', 'Time')}</th><th scope="col">ao5</th><th scope="col">ao12</th><th scope="col">{t('复盘', 'Recon')}</th></tr></thead>
            <tbody>
              {[...rows].reverse().map(row => <tr key={row.solve.id}>
                <td>{row.number}</td>
                <td><button type="button" className="btn-secondary" disabled={locked} onClick={() => select(row.solve.id)}>
                  {formatTimer(solveTime(row.solve))}{row.solve.penalty === '+2' ? '+' : ''}
                </button></td>
                <td>{formatTimer(row.ao5)}</td>
                <td>{formatTimer(row.ao12)}</td>
                <td>{statusLabel(resultFor(row.solve))}</td>
              </tr>)}
              {!rows.length && <tr><td colSpan={5}>{t('暂无计时记录', 'No solves yet')}</td></tr>}
            </tbody>
          </table>
        </div>
        {storageError && <p role="status">{t('浏览器存储不可用，请下载记录留存。', 'Browser storage is unavailable. Download the session to keep it.')}</p>}
        <div className="video-recon-actions">
          <button type="button" className="btn-secondary" disabled={!rows.length || locked} onClick={downloadSession}>
            <Download size={16} aria-hidden />{t('下载本次记录', 'Download session')}
          </button>
          <button type="button" className="btn-secondary" disabled={!rows.length || locked} onClick={() => setConfirmClear(true)}>
            <Trash2 size={16} aria-hidden />{t('清空记录', 'Clear session')}
          </button>
        </div>
      </div>
    </SettingsDialog>}

    {active && confirmClear && <SettingsDialog label={t('清空计时记录', 'Clear solve history')} heading onClose={() => setConfirmClear(false)}>
      <p>{t('清空本次记录以及对应的本地回放。', 'Clear this session and its local replays.')}</p>
      <button type="button" className="btn-primary" onClick={() => {
        workspace.clearTimerSession((history ?? []).map(solve => solve.id));
        setHistory([]);
        timer.reset();
        setConfirmClear(false);
      }}>{t('清空记录', 'Clear session')}</button>
    </SettingsDialog>}

    {active && selected && <SettingsDialog label={t(`第 ${selected.number} 次还原`, `Solve #${selected.number}`)}
      heading panelClassName="video-recon-replay-modal" onClose={() => select()}>
      <div className="video-recon-modal-body">
        <div className="video-recon-scramble"><div>
          <h3>{formatTimer(solveTime(selected.solve))} · {statusLabel(selectedResult)}</h3>
          <p>ao5 {formatTimer(selected.ao5)} · ao12 {formatTimer(selected.ao12)}</p>
          <p>{selected.solve.scramble}</p>
        </div><TimerScramblePreview event="333" scramble={selected.solve.scramble} height={78} ariaLabel={t('打乱展开图', 'Scramble net')} /></div>
        {selectedResult?.moves?.length && !selectedReplay ? <p className="video-recon-moves">{selectedResult.moves.join(' ')}</p> : null}
        {selectedReplay && selectedPlayback
          ? <TimerReplay key={selectedReplay.id} clip={selectedReplay} reconstruction={selectedPlayback} disabled={view.timerBusy}
            seekRequest={replaySeek} onPosition={setReplayPosition} />
          : <p className="video-recon-muted">{view.replayLoading ? t('正在读取回放…', 'Loading replay…') : t('该次还原没有可用的回放。', 'This solve has no available replay.')}</p>}
        <TpsGraph steps={selectedPlayback?.result?.steps} turns={selectedPlayback?.turnEvents} moves={selectedPlayback?.moves}
          fps={selectedPlayback?.config?.fps ?? 1000} start={selectedStart} end={selectedStart + selected.solve.elapsedMs / 1000}
          solveSeconds={selected.solve.elapsedMs / 1000} complete={selectedPlayback?.status === 'solved'} cursor={replayPosition} onSeek={seek} />
        {view.replayStorageError && <p role="status">{t('无法读取本地回放。', 'Could not read the local replay.')}</p>}
        <div className="video-recon-actions">
          <label className="video-recon-inline-label">{t('罚时', 'Penalty')}
            <select value={selected.solve.penalty} onChange={event => {
              const penalty = event.currentTarget.value as Penalty;
              setHistory(solves => solves?.map(solve => solve.id === selected.solve.id ? { ...solve, penalty } : solve));
            }}>
              <option value="none">{t('无', 'None')}</option><option value="+2">+2</option><option value="DNF">DNF</option>
            </select>
          </label>
          {view.timerReconstructions[selected.solve.id]?.diagnosticRunId && <button type="button" className="btn-secondary"
            onClick={() => void workspace.downloadTimerDiagnostics(selected.solve.id)}><Download size={16} aria-hidden />{t('下载诊断数据', 'Download diagnostics')}</button>}
          <button type="button" className="btn-secondary" onClick={() => {
            workspace.deleteTimerSolve(selected.solve.id);
            setHistory(solves => solves?.filter(solve => solve.id !== selected.solve.id));
            select();
          }}><Trash2 size={16} aria-hidden />{t('删除这条记录', 'Delete solve')}</button>
        </div>
      </div>
    </SettingsDialog>}
  </div>;
}
