import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, Trash2 } from '@app-foundation/icons/lucide';
import SettingsDialog from '@/components/SettingsDialog';
import { VisualCube } from '@/components/VisualCube';
import { useT } from '@/hooks/useT';
import {
  CubeTimerClock, TIMER_HOLD_MS, compactTimerReconstruction, formatTimer, readTimerSolves, solveTime,
  timerAverage, timerReconstructionStatus, timerSessionRows, type Penalty, type TimerReconstructionResult, type TimerSolve,
} from '@/lib/video-recon/engine/cube-timer';
import type { VideoWorkspace } from '@/lib/video-recon/workspace';
import { TimerReplay, type ReplaySeek } from './TimerReplay';
import { TpsGraph } from './TpsGraph';

type View = ReturnType<VideoWorkspace['getSnapshot']>;
const STORAGE_KEY = 'live-recognition.timer.v1';

export function CameraTimer({ active, view, workspace }: { active: boolean; view: View; workspace: VideoWorkspace }) {
  const t = useT();
  const [clock] = useState(() => new CubeTimerClock());
  const [phase, setPhase] = useState<CubeTimerClock['phase']>('idle');
  const [now, setNow] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [scramble, setScramble] = useState('');
  const [loading, setLoading] = useState(false);
  const scramblePending = useRef(false);
  const [scrambleError, setScrambleError] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [history, setHistory] = useState<TimerSolve[]>();
  const [selectedId, setSelectedId] = useState<string>();
  const [replayPosition, setReplayPosition] = useState<number>();
  const [replaySeek, setReplaySeek] = useState<ReplaySeek>();
  const [attempt, setAttempt] = useState<Pick<TimerSolve, 'id' | 'scramble' | 'startedAt'>>();
  const [confirmClear, setConfirmClear] = useState(false);
  const lastSaved = useRef('');
  const rows = useMemo(() => timerSessionRows(history ?? []), [history]);
  const best = useMemo(() => history?.length ? Math.min(...history.map(solveTime)) : undefined, [history]);
  const activeAttempt = useRef<typeof attempt>(undefined);
  const locked = phase !== 'idle';
  const ready = phase === 'holding' && now - clock.heldAt >= TIMER_HOLD_MS;
  const canStart = active && view.timerReady && !!scramble && !loading && !selectedId && !confirmClear;
  const selected = rows.find(row => row.solve.id === selectedId);
  const last = history?.at(-1);
  const resultFor = (solve?: TimerSolve) => solve && (view.timerReconstructions[solve.id] ?? solve.reconstruction);
  const lastResult = resultFor(last);
  const selectedResult = resultFor(selected?.solve);
  const selectedReplay = selectedId ? view.timerReplays[selectedId] : undefined;
  const selectedPlayback = selectedResult?.result ? selectedResult : selectedReplay?.reconstruction ?? selectedResult;

  const nextScramble = useCallback(async () => {
    if (scramblePending.current || clock.phase !== 'idle') return;
    scramblePending.current = true;
    setLoading(true);
    setScrambleError(false);
    try {
      const { randomScrambleForEvent } = await import('cubing/scramble');
      setScramble((await randomScrambleForEvent('333')).toString());
    } catch { setScrambleError(true); }
    finally { setLoading(false); scramblePending.current = false; }
  }, [clock]);

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
    try { localStorage.setItem(STORAGE_KEY, saved); lastSaved.current = saved; setStorageError(false); }
    catch { setStorageError(true); }
  }, [history, view.timerReconstructions]);

  useEffect(() => {
    workspace.selectTimerReplay(active ? selectedId : undefined);
    return () => workspace.selectTimerReplay();
  }, [active, selectedId, workspace]);

  const finish = useCallback((penalty: Penalty = 'none') => {
    const started = activeAttempt.current;
    if (!started) return;
    activeAttempt.current = undefined;
    workspace.stopTimerSolve(started.id, performance.timeOrigin + clock.startedAt + clock.elapsedMs);
    workspace.setTimerBusy(false);
    setAttempt(undefined);
    setHistory(solves => [...(solves ?? []), { ...started, elapsedMs: clock.elapsedMs, penalty }]);
    setElapsed(clock.elapsedMs);
    void nextScramble();
  }, [clock, nextScramble, workspace]);

  const cancelHold = useCallback(() => {
    if (clock.phase !== 'holding') return;
    clock.cancelHold();
    workspace.setTimerBusy(false);
    setPhase('idle');
  }, [clock, workspace]);

  useEffect(() => {
    if (canStart) return;
    cancelHold();
    if (!view.timerReady && clock.phase === 'running') {
      clock.press('CameraInterrupted', performance.now());
      setPhase(clock.phase);
      finish('DNF');
    }
  }, [canStart, cancelHold, clock, finish, view.timerReady]);

  useEffect(() => {
    if (phase === 'idle') return;
    let animation = requestAnimationFrame(function tick(time) {
      setNow(time);
      if (clock.phase === 'running') setElapsed(Math.max(0, time - clock.startedAt));
      animation = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(animation);
  }, [phase, clock]);

  const press = useCallback((code: string, editable = false, repeat = false) => {
    if (!canStart && clock.phase !== 'running') return;
    const time = performance.now();
    const stopped = clock.press(code, time, editable, repeat);
    setNow(time);
    setPhase(clock.phase);
    workspace.setTimerBusy(clock.phase !== 'idle');
    if (stopped) finish();
  }, [canStart, clock, finish, workspace]);

  const release = useCallback(() => {
    if (!canStart) { cancelHold(); return; }
    const time = performance.now();
    if (clock.release('Space', time)) {
      const started = { id: crypto.randomUUID(), scramble, startedAt: new Date().toISOString() };
      activeAttempt.current = started;
      setAttempt(started);
      setElapsed(0);
      workspace.startTimerSolve(started.id, started.scramble, performance.timeOrigin + time);
    }
    setPhase(clock.phase);
    setNow(time);
    workspace.setTimerBusy(clock.phase !== 'idle');
  }, [canStart, cancelHold, clock, scramble, workspace]);

  useEffect(() => {
    if (!active) return;
    const down = (event: KeyboardEvent) => {
      if (selectedId || confirmClear || event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
      const editable = event.target instanceof Element && !!event.target.closest(
        'input, textarea, select, button, a, [contenteditable="true"], [role="application"], [role="slider"], .video-recon-replay',
      );
      if (clock.phase === 'running' || event.code === 'Space' && !editable && canStart) event.preventDefault();
      press(event.code, editable, event.repeat);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space' && clock.phase === 'holding' && !event.defaultPrevented) release();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', cancelHold);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', cancelHold);
    };
  }, [active, canStart, cancelHold, clock, confirmClear, selectedId, press, release]);

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
  const timerHint = phase === 'running' ? t('按任意键停止', 'Press any key to stop')
    : ready ? t('松手开始', 'Release to start')
    : phase === 'holding' ? t('继续按住', 'Keep holding')
    : view.timerReady ? t('按住空格，松手开始', 'Hold Space, then release to start')
    : t('连接摄像头后开始计时', 'Connect a camera to start the timer');
  const lastStart = lastResult?.config?.requested_start_seconds ?? 0;
  const selectedStart = selectedPlayback?.config?.requested_start_seconds ?? selectedReplay?.start ?? 0;

  return <div className="video-recon-timer" hidden={!active}>
    <section className="video-recon-panel" data-site-surface="panel">
      <div className="video-recon-section-heading">
        <h2>{t('摄像头计时', 'Camera timer')}</h2>
        <span className="video-recon-muted" role="status">{statusLabel(attempt ? view.timerReconstructions[attempt.id] : lastResult)}</span>
      </div>
      <div className="video-recon-scramble">
        <div>
          <h3>{t('打乱', 'Scramble')}</h3>
          <p>{scramble || (loading ? t('正在生成打乱…', 'Generating scramble…') : '—')}</p>
        </div>
        {scramble && <VisualCube setup={scramble} view="trans" size={76} local alt={t('打乱状态', 'Scrambled state')} />}
      </div>
      <button type="button" className="btn-secondary" disabled={locked || loading} onClick={() => void nextScramble()}>
        <RefreshCw size={16} aria-hidden />{t('换打乱', 'New scramble')}
      </button>
      {scrambleError && <p role="alert">{t('打乱生成失败，请重试。', 'Could not generate a scramble. Try again.')}</p>}
      <div className="video-recon-clock" data-ready={ready}>
        <output aria-label={t('还原用时', 'Solve time')}>{formatTimer(elapsed)}</output>
        <p>{timerHint}</p>
        <button type="button" className="btn-secondary" disabled={!canStart && phase !== 'running'}
          onPointerDown={event => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            press('Space');
          }}
          onPointerUp={event => { event.preventDefault(); release(); }} onPointerCancel={cancelHold}
          onKeyDown={event => {
            if (event.code !== 'Space' && event.code !== 'Enter') return;
            event.preventDefault();
            press('Space', false, event.repeat);
          }}
          onKeyUp={event => {
            if (event.code !== 'Space' && event.code !== 'Enter') return;
            event.preventDefault();
            release();
          }}>{phase === 'running' ? t('停止', 'Stop') : ready ? t('松手开始', 'Release to start') : t('按住开始', 'Hold to start')}</button>
      </div>
    </section>

    <section className="video-recon-panel" data-site-surface="panel">
      <div className="video-recon-section-heading">
        <h2>{t('本次记录', 'Session')}</h2>
        <span className="video-recon-muted">{t(`${rows.length} 次`, `${rows.length} solves`)}</span>
      </div>
      <dl className="video-recon-stats">
        <div><dt>{t('最佳', 'Best')}</dt><dd>{formatTimer(best)}</dd></div>
        <div><dt>ao5</dt><dd>{formatTimer(history && timerAverage(history, 5))}</dd></div>
        <div><dt>ao12</dt><dd>{formatTimer(history && timerAverage(history, 12))}</dd></div>
      </dl>
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
    </section>
    {last && <TpsGraph steps={lastResult?.result?.steps} turns={lastResult?.turnEvents} moves={lastResult?.moves}
      fps={lastResult?.config?.fps ?? 1000} start={lastStart} end={lastStart + last.elapsedMs / 1000} solveSeconds={last.elapsedMs / 1000}
      complete={lastResult?.status === 'solved'} cursor={view.latestReplayPosition}
      onSeek={time => { if (!workspace.seekLatestTimerReplay(last.id, time)) { select(last.id); seek(time); } }} />}

    {active && confirmClear && <SettingsDialog label={t('清空计时记录', 'Clear solve history')} heading onClose={() => setConfirmClear(false)}>
      <p>{t('清空本次记录以及对应的本地回放。', 'Clear this session and its local replays.')}</p>
      <button type="button" className="btn-primary" onClick={() => {
        workspace.clearTimerSession((history ?? []).map(solve => solve.id));
        setHistory([]);
        setElapsed(0);
        setConfirmClear(false);
      }}>{t('清空记录', 'Clear session')}</button>
    </SettingsDialog>}

    {active && selected && <SettingsDialog label={t(`第 ${selected.number} 次还原`, `Solve #${selected.number}`)}
      heading panelClassName="video-recon-modal" onClose={() => select()}>
      <div className="video-recon-modal-body">
        <div className="video-recon-scramble"><div>
          <h3>{formatTimer(solveTime(selected.solve))} · {statusLabel(selectedResult)}</h3>
          <p>ao5 {formatTimer(selected.ao5)} · ao12 {formatTimer(selected.ao12)}</p>
          <p>{selected.solve.scramble}</p>
        </div><VisualCube setup={selected.solve.scramble} view="trans" size={76} local alt={t('打乱状态', 'Scrambled state')} /></div>
        {selectedResult?.moves?.length && !selectedReplay ? <p className="video-recon-moves">{selectedResult.moves.join(' ')}</p> : null}
        <TpsGraph steps={selectedPlayback?.result?.steps} turns={selectedPlayback?.turnEvents} moves={selectedPlayback?.moves}
          fps={selectedPlayback?.config?.fps ?? 1000} start={selectedStart} end={selectedStart + selected.solve.elapsedMs / 1000}
          solveSeconds={selected.solve.elapsedMs / 1000} complete={selectedPlayback?.status === 'solved'} cursor={replayPosition} onSeek={seek} />
        {selectedReplay && selectedPlayback
          ? <TimerReplay key={selectedReplay.id} clip={selectedReplay} reconstruction={selectedPlayback} seekRequest={replaySeek} onPosition={setReplayPosition} />
          : <p className="video-recon-muted">{view.replayLoading ? t('正在读取回放…', 'Loading replay…') : t('该次还原没有可用的回放。', 'This solve has no available replay.')}</p>}
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
