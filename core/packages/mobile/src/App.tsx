import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import {
  MAX_TIMER_BACKUP_BYTES,
  activeTimerSolves,
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
  useCallback,
  useEffect,
  useMemo,
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
import { useTimerController } from './hooks/use-timer-controller';
import packageInfo from '../package.json';

const SITE_ORIGIN = 'https://cuberoot.me';
const repository = new TimerRepository(new IndexedDbTimerStoreDriver());

type AppView = 'timer' | 'history' | 'settings';
type ConnectionState = 'checking' | 'offline' | 'online';

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
  const [scramble, setScramble] = useState(() => scramble333(Math.random));
  const [toast, setToast] = useState('');
  const [canUndoImport, setCanUndoImport] = useState(false);
  const fallbackLanguage = preferredLanguage();
  const language = store?.settings.language ?? fallbackLanguage;
  const copy = COPY[language];
  const solves = store ? activeTimerSolves(store, '333') : [];
  const stats = useMemo(() => summarize(solves, '333'), [solves]);

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
    setScramble(scramble333(Math.random));
    void repository.addSolve({
      event: '333',
      inspectionMs: result.inspectionMs || undefined,
      penalty: result.autoPenalty,
      scramble: completedScramble,
      timeMs: result.timeMs,
    }).then(setStore).catch(() => announce(copy.actionFailed));
  }, [announce, copy.actionFailed, scramble]);

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
    const remaining = (store?.settings.inspectionSec ?? 0) * 1000 - elapsed;
    timerText = remaining >= 0 ? String(Math.ceil(remaining / 1000)) : remaining >= -2000 ? '+2' : 'DNF';
    timerInstruction = copy.holdToArm;
  }

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
      setCanUndoImport(true);
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
      <header className="topbar">
        <strong>{copy.title}</strong>
        <span className={`network network--${connection}`}>
          {connection === 'checking' ? copy.checking : connection === 'online' ? copy.online : copy.offline}
        </span>
      </header>

      <div className="view-container">
        {view === 'timer' && (
          <section className="timer-view" aria-labelledby="timer-title">
            <h1 className="sr-only" id="timer-title">{copy.timer}</h1>
            <div className="scramble-bar">
              <p>{scramble}</p>
              <button
                aria-label={copy.newScramble}
                disabled={timer.machine.phase !== 'idle' && timer.machine.phase !== 'stopped'}
                onClick={() => setScramble(scramble333(Math.random))}
                type="button"
              >↻</button>
            </div>
            <button
              className={`timer-pad timer-pad--${timer.machine.phase}`}
              data-timer-pad
              onContextMenu={(event) => event.preventDefault()}
              onPointerCancel={timer.pointerCancel}
              onPointerDown={timer.pointerDown}
              onPointerUp={timer.pointerUp}
              type="button"
            >
              <span className="timer-value">{timerText}</span>
              <span className="timer-instruction">{timerInstruction}</span>
            </button>
            <p className="timer-hint">{copy.timerHint}</p>
            <dl className="quick-stats">
              <div><dt>{copy.solves}</dt><dd>{stats.count}</dd></div>
              <div><dt>{copy.best}</dt><dd>{stats.best}</dd></div>
              <div><dt>{copy.ao5}</dt><dd>{stats.ao5}</dd></div>
              <div><dt>{copy.ao12}</dt><dd>{stats.ao12}</dd></div>
            </dl>
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
