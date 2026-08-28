import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import {
  MAX_TIMER_BACKUP_BYTES,
  activeTimerSolves,
  formatInspectionDisplay,
  formatMs,
  formatSolveResult,
  scramble333,
  summarize,
  type Penalty,
  type Solve,
  type SolveResult,
  type TimerStoreData,
  type TimerStoreSettings,
} from '@cuberoot/shared/timer';
import {
  SegmentTime,
  TimerDeviceActions,
  TimerStatRail,
  TimerTopbar,
  TimingSurface,
} from '@cuberoot/timer-ui';
import { renderFromSimpleQuery } from '@cuberoot/visualcube';
import { ChevronDown, Grid3X3, MoreHorizontal, Settings as SettingsIcon } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import { COPY, preferredLanguage, type SupportedLanguage } from './copy';
import {
  CorruptTimerStoreError,
  IndexedDbTimerStoreDriver,
  TimerRepository,
} from './data/timer-repository';
import {
  fetchRealScrambles,
  readRealScrambleCache,
  writeRealScrambleCache,
  type RealScramble,
} from './data/real-scramble-pool';
import { useTimerController } from './hooks/use-timer-controller';
import packageInfo from '../package.json';

const SITE_ORIGIN = 'https://cuberoot.me';
const repository = new TimerRepository(new IndexedDbTimerStoreDriver());

type AppView = 'timer' | 'history' | 'settings';
type ConnectionState = 'checking' | 'offline' | 'online';
type ScrambleSource = 'real' | 'random';

function siteUrl(language: SupportedLanguage): string {
  return language === 'zh' ? `${SITE_ORIGIN}/zh` : `${SITE_ORIGIN}/`;
}

function privacyUrl(language: SupportedLanguage): string {
  return language === 'zh' ? `${SITE_ORIGIN}/zh/privacy` : `${SITE_ORIGIN}/privacy`;
}

function applyPreferences(settings: TimerStoreSettings): void {
  if (settings.theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = settings.theme;
  document.documentElement.lang = settings.language === 'zh' ? 'zh-Hans' : 'en';
}

function downloadBackup(text: string): void {
  const blobUrl = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = `cuberoot-timer-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

function ScrambleCube({ alt, scramble }: { alt: string; scramble: string }) {
  const svg = useMemo(() => renderFromSimpleQuery({ setup: scramble, size: 132, view: 'iso' }), [scramble]);
  return (
    <span
      aria-label={alt}
      className="mobile-cube-preview"
      dangerouslySetInnerHTML={{ __html: svg }}
      role="img"
    />
  );
}

async function shareOrDownloadBackup(text: string): Promise<void> {
  const filename = `cuberoot-timer-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([text], filename, { type: 'application/json' });
  const shareData: ShareData = { files: [file], title: 'CubeRoot timer backup' };
  if (navigator.share && navigator.canShare?.(shareData)) {
    await navigator.share(shareData);
    return;
  }
  downloadBackup(text);
}

function HistoryRow({
  copy,
  index,
  language,
  onDelete,
  onUpdate,
  solve,
}: {
  copy: (typeof COPY)[SupportedLanguage];
  index: number;
  language: SupportedLanguage;
  onDelete(solve: Solve): void;
  onUpdate(solve: Solve, changes: Pick<Solve, 'penalty' | 'comment'>): void;
  solve: Solve;
}) {
  const [comment, setComment] = useState(solve.comment ?? '');

  useEffect(() => setComment(solve.comment ?? ''), [solve.comment]);

  const date = useMemo(() => new Intl.DateTimeFormat(
    language === 'zh' ? 'zh-CN' : 'en',
    { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  ).format(solve.ts), [language, solve.ts]);

  return (
    <details className="history-row">
      <summary>
        <span className="history-index">#{index}</span>
        <strong>{formatSolveResult(solve)}</strong>
        <time dateTime={new Date(solve.ts).toISOString()}>{date}</time>
      </summary>
      <p className="history-scramble">{solve.scramble}</p>
      <div className="penalty-actions" aria-label={copy.penalty}>
        {(['ok', '+2', 'DNF'] as Penalty[]).map((penalty) => (
          <button
            aria-pressed={solve.penalty === penalty}
            className="choice-button"
            key={penalty}
            onClick={() => onUpdate(solve, { penalty, comment: solve.comment })}
            type="button"
          >
            {penalty === 'ok' ? 'OK' : penalty}
          </button>
        ))}
      </div>
      <label className="comment-field">
        <span>{copy.comment}</span>
        <input
          maxLength={500}
          onChange={(event) => setComment(event.target.value)}
          type="text"
          value={comment}
        />
      </label>
      <div className="history-actions">
        <button
          className="text-action"
          onClick={() => onUpdate(solve, { penalty: solve.penalty, comment: comment.trim() || undefined })}
          type="button"
        >
          {copy.save}
        </button>
        <button className="text-action text-action--danger" onClick={() => onDelete(solve)} type="button">
          {copy.delete}
        </button>
      </div>
    </details>
  );
}

export function App() {
  const [store, setStore] = useState<TimerStoreData | null>(null);
  const [lastResult, setLastResult] = useState<SolveResult | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [view, setView] = useState<AppView>('timer');
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const initialRealPool = useMemo(() => readRealScrambleCache(), []);
  const realPoolRef = useRef<RealScramble[]>(initialRealPool.slice(1));
  const currentRealRef = useRef<RealScramble | null>(initialRealPool[0] ?? null);
  const realRequestRef = useRef<Promise<void> | null>(null);
  const [scrambleSource, setScrambleSource] = useState<ScrambleSource>('real');
  const [currentReal, setCurrentReal] = useState<RealScramble | null>(initialRealPool[0] ?? null);
  const [realLoading, setRealLoading] = useState(initialRealPool.length === 0);
  const [scramble, setScramble] = useState(() => initialRealPool[0]?.scramble ?? scramble333(Math.random));
  const [toast, setToast] = useState('');
  const [canUndoImport, setCanUndoImport] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const fallbackLanguage = preferredLanguage();
  const language = store?.settings.language ?? fallbackLanguage;
  const copy = COPY[language];
  const solves = store ? activeTimerSolves(store, '333') : [];
  const stats = useMemo(() => summarize(solves, '333'), [solves]);

  const refillRealPool = useCallback((activateCurrent = false) => {
    if (realRequestRef.current) return realRequestRef.current;
    setRealLoading(true);
    const request = fetchRealScrambles().then((incoming) => {
      const existing = currentRealRef.current
        ? [currentRealRef.current, ...realPoolRef.current]
        : realPoolRef.current;
      const merged = [...new Map([...existing, ...incoming].map((item) => [item.scramble, item])).values()];
      if (activateCurrent && !currentRealRef.current && merged.length > 0) {
        const [first, ...rest] = merged;
        currentRealRef.current = first;
        realPoolRef.current = rest;
        setCurrentReal(first);
        setScramble(first.scramble);
      } else {
        realPoolRef.current = currentRealRef.current ? merged.slice(1) : merged;
      }
      writeRealScrambleCache(currentRealRef.current
        ? [currentRealRef.current, ...realPoolRef.current]
        : realPoolRef.current);
    }).catch(() => {
      // Cached real scrambles remain available; a cold offline launch uses the local generator.
    }).finally(() => {
      realRequestRef.current = null;
      setRealLoading(false);
    });
    realRequestRef.current = request;
    return request;
  }, []);

  const nextScramble = useCallback((source = scrambleSource) => {
    if (source === 'real') {
      const next = realPoolRef.current.shift();
      if (next) {
        currentRealRef.current = next;
        setCurrentReal(next);
        setScramble(next.scramble);
        writeRealScrambleCache([next, ...realPoolRef.current]);
        if (realPoolRef.current.length <= 8) void refillRealPool();
        return;
      }
      currentRealRef.current = null;
      setCurrentReal(null);
      setScramble(scramble333(Math.random));
      void refillRealPool(true);
      return;
    }
    currentRealRef.current = null;
    setCurrentReal(null);
    setScramble(scramble333(Math.random));
  }, [refillRealPool, scrambleSource]);

  useEffect(() => {
    if (realPoolRef.current.length <= 8) void refillRealPool(initialRealPool.length === 0);
  }, [initialRealPool.length, refillRealPool]);

  const announce = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? '' : current), 3000);
  }, []);

  useEffect(() => {
    let active = true;
    void repository.load().then((data) => {
      if (!active) return;
      setStore(data);
      applyPreferences(data.settings);
      void repository.hasImportRecovery().then((available) => {
        if (active) setCanUndoImport(available);
      });
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error : new Error('load failed'));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    let removeListener: (() => Promise<void>) | undefined;
    void Network.getStatus().then(({ connected }) => {
      if (active) setConnection(connected ? 'online' : 'offline');
    }).catch(() => {
      if (active) setConnection(navigator.onLine ? 'online' : 'offline');
    });
    void Network.addListener('networkStatusChange', ({ connected }) => {
      if (active) setConnection(connected ? 'online' : 'offline');
    }).then((handle) => {
      if (active) removeListener = handle.remove;
      else void handle.remove();
    });
    return () => {
      active = false;
      void removeListener?.();
    };
  }, []);

  const completeSolve = useCallback((result: SolveResult) => {
    setLastResult(result);
    const completedScramble = scramble;
    nextScramble();
    void repository.addSolve({
      event: '333',
      inspectionMs: result.inspectionMs || undefined,
      penalty: result.autoPenalty,
      scramble: completedScramble,
      timeMs: result.timeMs,
    }).then(setStore).catch(() => announce(copy.actionFailed));
  }, [announce, copy.actionFailed, nextScramble, scramble]);

  const timer = useTimerController({
    holdMs: store?.settings.holdMs ?? 300,
    inspectionSec: store?.settings.inspectionSec ?? 0,
    onComplete: completeSolve,
  });

  const displayMs = timer.machine.phase === 'running'
    ? Math.max(0, timer.nowMs - (timer.machine.startedAtMs ?? timer.nowMs))
    : timer.machine.lastMs ?? 0;
  let timerText = formatMs(displayMs);
  if (timer.machine.phase === 'stopped' && lastResult) {
    timerText = lastResult.autoPenalty === 'DNF'
      ? 'DNF'
      : `${formatMs(lastResult.timeMs + (lastResult.autoPenalty === '+2' ? 2000 : 0))}${lastResult.autoPenalty === '+2' ? '+' : ''}`;
  }
  let timerInstruction: string = copy.holdToArm;
  if (timer.machine.phase === 'running') timerInstruction = copy.tapToStop;
  if (timer.machine.phase === 'holding') timerInstruction = copy.keepHolding;
  if (timer.machine.phase === 'ready') timerInstruction = copy.releaseToStart;
  if (timer.machine.phase === 'inspecting') {
    const elapsed = Math.max(0, timer.nowMs - (timer.machine.inspectionStartedAtMs ?? timer.nowMs));
    timerText = formatInspectionDisplay(elapsed, timer.machine.inspectionSec ?? 0);
    timerInstruction = copy.holdToArm;
  }
  const timerColorClass = timer.machine.phase === 'stopped' && lastResult?.autoPenalty === 'DNF'
    ? 'dnf'
    : timer.machine.phase;

  const updateSettings = useCallback((changes: Partial<TimerStoreSettings>) => {
    void repository.updateSettings(changes).then((data) => {
      setStore(data);
      applyPreferences(data.settings);
    }).catch(() => announce(copy.actionFailed));
  }, [announce, copy.actionFailed]);

  const updateSolve = useCallback((solve: Solve, changes: Pick<Solve, 'penalty' | 'comment'>) => {
    void repository.updateSolve('333', solve.id, changes)
      .then(setStore)
      .catch(() => announce(copy.actionFailed));
  }, [announce, copy.actionFailed]);

  const deleteSolve = useCallback((solve: Solve) => {
    if (!window.confirm(copy.deleteConfirm)) return;
    void repository.deleteSolve('333', solve.id)
      .then(setStore)
      .catch(() => announce(copy.actionFailed));
  }, [announce, copy.actionFailed, copy.deleteConfirm]);

  const exportData = useCallback(() => {
    void repository.exportJson()
      .then(shareOrDownloadBackup)
      .then(() => announce(copy.exportSuccess))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        announce(copy.actionFailed);
      });
  }, [announce, copy.actionFailed, copy.exportSuccess]);

  const importData = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_TIMER_BACKUP_BYTES) {
      announce(copy.importTooLarge);
      return;
    }
    void (async () => {
      const text = await file.text();
      const preview = await repository.previewImport(text);
      if (!window.confirm(copy.importConfirm(preview.incoming.solveCount, preview.current.solveCount))) return;
      const data = await repository.importJson(text);
      setStore(data);
      setLoadError(null);
      setCanUndoImport(await repository.hasImportRecovery());
      applyPreferences(data.settings);
      announce(COPY[data.settings.language].importSuccess);
    })().catch(() => announce(copy.actionFailed));
  }, [announce, copy.actionFailed, copy.importConfirm, copy.importTooLarge]);

  const undoImport = useCallback(() => {
    if (!window.confirm(copy.undoImportConfirm)) return;
    void repository.restoreImportRecovery().then((data) => {
      setStore(data);
      setCanUndoImport(false);
      applyPreferences(data.settings);
      announce(COPY[data.settings.language].undoImportSuccess);
    }).catch(() => announce(copy.actionFailed));
  }, [announce, copy.actionFailed, copy.undoImportConfirm]);

  const openExternal = useCallback((event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (!Capacitor.isNativePlatform()) return;
    event.preventDefault();
    void Browser.open({ url: event.currentTarget.href }).catch(() => announce(copy.actionFailed));
  }, [announce, copy.actionFailed]);

  if (!store && !loadError) {
    return <main className="loading-screen"><strong>{copy.title}</strong></main>;
  }

  if (!store && loadError) {
    return (
      <main className="recovery-screen">
        <h1>{copy.corruptTitle}</h1>
        <p>{loadError instanceof CorruptTimerStoreError ? copy.corruptDetail : copy.actionFailed}</p>
        <label className="primary-action">
          {copy.importData}
          <input accept="application/json,.json" hidden onChange={importData} type="file" />
        </label>
        <p aria-live="polite" className="toast">{toast}</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-titlebar">
        <strong>{copy.timer}</strong>
        <span
          aria-label={connection === 'checking' ? copy.checking : connection === 'online' ? copy.online : copy.offline}
          className={`network network--${connection}`}
          role="status"
        />
      </header>

      <div className="view-container">
        {view === 'timer' && (
          <section className="timer-view" aria-labelledby="timer-title">
            <h1 className="sr-only" id="timer-title">{copy.timer}</h1>
            <TimerTopbar
              actions={(
                <>
                  <button
                    aria-label={copy.more}
                    className="timer-toolbar-icon"
                    data-no-timer
                    onClick={() => setView('history')}
                    type="button"
                  ><MoreHorizontal aria-hidden="true" size={18} /></button>
                  <button
                    aria-label={copy.settings}
                    className="timer-toolbar-icon"
                    data-no-timer
                    onClick={() => setView('settings')}
                    type="button"
                  ><SettingsIcon aria-hidden="true" size={17} /></button>
                </>
              )}
              controls={(
                <>
                  <span className="timer-toolbar-control">{copy.onePlayer}<ChevronDown aria-hidden="true" size={13} /></span>
                  <span className="timer-toolbar-control timer-toolbar-event"><Grid3X3 aria-hidden="true" size={19} />3×3<ChevronDown aria-hidden="true" size={13} /></span>
                  <label className="timer-source-select">
                    <span className="sr-only">{copy.scrambleSource}</span>
                    <select
                      data-no-timer
                      onChange={(event) => {
                        const source = event.target.value as ScrambleSource;
                        setScrambleSource(source);
                        nextScramble(source);
                      }}
                      value={scrambleSource}
                    >
                      <option value="real">{copy.real}</option>
                      <option value="random">{copy.random}</option>
                    </select>
                    <ChevronDown aria-hidden="true" size={13} />
                  </label>
                  <span className="timer-toolbar-muted">{copy.difficulty}</span>
                </>
              )}
            />
            <div className="timer-solution-row">{copy.solution}</div>
            <div className="timer-source-bar" data-no-timer>
              <span className="timer-source-kind">{copy.competition}<ChevronDown aria-hidden="true" size={14} /></span>
              <span className="timer-source-name">
                {currentReal?.competitionName
                  ?? (realLoading && scrambleSource === 'real' ? copy.loadingReal : copy.localRandom)}
              </span>
            </div>
            <div className="mobile-timer-stage">
              <TimingSurface
                ariaLabel={copy.timer}
                colorClass={timerColorClass}
                digits={<SegmentTime text={timerText} />}
                fontSize="clamp(4.8rem, 24vw, 8.5rem)"
                interactive
                onContextMenu={(event) => event.preventDefault()}
                onPointerCancel={timer.pointerCancel}
                onPointerDown={timer.pointerDown}
                onPointerUp={timer.pointerUp}
                phase={timer.machine.phase}
                scrambleSlot={(
                  <div className="mobile-scramble-stack">
                    <div className="mobile-scramble">
                      <p>{scramble}</p>
                      <button
                        aria-label={copy.newScramble}
                        data-no-timer
                        disabled={timer.machine.phase !== 'idle' && timer.machine.phase !== 'stopped'}
                        onClick={() => nextScramble()}
                        type="button"
                      >↻</button>
                    </div>
                    {currentReal && scrambleSource === 'real' && (
                      <p className="mobile-scramble-source">
                        <strong>{currentReal.competitionName}</strong>
                        <span>3×3 · {currentReal.roundTypeId}/{currentReal.groupId} · #{currentReal.scrambleNumber}</span>
                      </p>
                    )}
                    <ScrambleCube alt={copy.cubeState} scramble={scramble} />
                  </div>
                )}
                surfaceRef={surfaceRef}
              >
                <span className="timer-instruction">{timerInstruction}</span>
              </TimingSurface>
              <TimerStatRail
                emptyLabel={copy.times}
                items={stats.count > 0 ? [
                  { label: copy.solved, value: `${stats.solved}/${stats.count}` },
                  { label: 'mean', value: stats.mean },
                  { label: copy.best, value: stats.best },
                  { label: 'mo3', value: stats.mo3 },
                  { label: 'ao5', value: stats.ao5 },
                  { label: 'ao12', value: stats.ao12 },
                ] : []}
                onClick={() => setView('history')}
                title={copy.openTimes}
              />
              <TimerDeviceActions
                connectAriaLabel={copy.connectBluetooth}
                connectLabel={copy.connect}
                microphoneAriaLabel={copy.connectMicrophone}
                onConnect={() => announce(copy.deviceComingSoon)}
                onMicrophone={() => announce(copy.deviceComingSoon)}
              />
            </div>
          </section>
        )}

        {view === 'history' && (
          <section className="history-view" aria-labelledby="history-title">
            <header className="section-heading">
              <h1 id="history-title">{copy.history}</h1>
              <span>{solves.length}</span>
            </header>
            {solves.length === 0 ? <p className="empty-state">{copy.emptyHistory}</p> : (
              <div className="history-list">
                {[...solves].reverse().map((solve, reverseIndex) => (
                  <HistoryRow
                    copy={copy}
                    index={solves.length - reverseIndex}
                    key={solve.id}
                    language={language}
                    onDelete={deleteSolve}
                    onUpdate={updateSolve}
                    solve={solve}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'settings' && (
          <section className="settings-view" aria-labelledby="settings-title">
            <h1 id="settings-title">{copy.settings}</h1>
            <div className="settings-group">
              <label className="setting-row">
                <span>{copy.language}</span>
                <select
                  onChange={(event) => updateSettings({ language: event.target.value as SupportedLanguage })}
                  value={store!.settings.language}
                >
                  <option value="en">English</option>
                  <option value="zh">简体中文</option>
                </select>
              </label>
              <label className="setting-row">
                <span>{copy.theme}</span>
                <select
                  onChange={(event) => updateSettings({ theme: event.target.value as TimerStoreSettings['theme'] })}
                  value={store!.settings.theme}
                >
                  <option value="system">{copy.system}</option>
                  <option value="light">{copy.light}</option>
                  <option value="dark">{copy.dark}</option>
                </select>
              </label>
              <label className="setting-row">
                <span>{copy.inspection}</span>
                <select
                  onChange={(event) => updateSettings({ inspectionSec: Number(event.target.value) })}
                  value={store!.settings.inspectionSec}
                >
                  <option value="0">{copy.noInspection}</option>
                  <option value="15">{copy.seconds15}</option>
                </select>
              </label>
              <label className="setting-row">
                <span>{copy.holdTime}</span>
                <select
                  onChange={(event) => updateSettings({ holdMs: Number(event.target.value) })}
                  value={store!.settings.holdMs}
                >
                  <option value="0">0 ms</option>
                  <option value="300">300 ms</option>
                  <option value="500">500 ms</option>
                  <option value="700">700 ms</option>
                </select>
              </label>
            </div>

            <div className="settings-section">
              <h2>{copy.data}</h2>
              <p>{solves.length} {copy.dataCount}</p>
              <div className="action-row">
                <button className="secondary-action" onClick={exportData} type="button">{copy.exportData}</button>
                <label className="secondary-action">
                  {copy.importData}
                  <input accept="application/json,.json" hidden onChange={importData} type="file" />
                </label>
                {canUndoImport && (
                  <button className="secondary-action" onClick={undoImport} type="button">{copy.undoImport}</button>
                )}
              </div>
            </div>

            <div className="settings-section">
              <h2>{copy.fullSite}</h2>
              <p>{copy.fullSiteDetail}</p>
              <a className="site-link" href={siteUrl(language)} onClick={openExternal} rel="noreferrer" target="_blank">
                {copy.openFullSite}<span aria-hidden="true">↗</span>
              </a>
            </div>

            <div className="settings-section settings-meta">
              <a className="site-link" href={privacyUrl(language)} onClick={openExternal} rel="noreferrer" target="_blank">
                {copy.privacy}<span aria-hidden="true">↗</span>
              </a>
              <a className="site-link" href="mailto:yrmfxc@gmail.com">{copy.support}</a>
              <span>{copy.version} {packageInfo.version}</span>
            </div>
          </section>
        )}
      </div>

      <nav className="bottom-nav" aria-label={copy.title}>
        {([
          ['timer', copy.timer],
          ['history', copy.history],
          ['settings', copy.settings],
        ] as Array<[AppView, string]>).map(([id, label]) => (
          <button aria-current={view === id ? 'page' : undefined} key={id} onClick={() => setView(id)} type="button">
            {label}
          </button>
        ))}
      </nav>
      <p aria-live="polite" className="toast">{toast}</p>
    </main>
  );
}
