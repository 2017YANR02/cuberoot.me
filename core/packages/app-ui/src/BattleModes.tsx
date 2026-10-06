import { createBattleVideoClient } from '@cuberoot/shared/video';
import VideoStrip, { VideoToggle, useTimerBattleVideo } from '@cuberoot/timer-ui/video/TimerBattleVideo';
import { mobileApiUrl } from './data/wca-source-adapter';
const battleVideoClient = createBattleVideoClient({ apiUrl: mobileApiUrl, fetcher: (...args) => fetch(...args) });
import { defaultLocalBattlePreferences, readLocalBattlePreferences, saveLocalBattlePreferences, LOCAL_BATTLE_INSPECTIONS, LOCAL_BATTLE_PRECISIONS, type LocalBattlePreferences } from '@cuberoot/shared/timer';
import { TimerBattleAppearanceSettings } from '@cuberoot/timer-ui';
import { requestLocalBattleScramble, LOCAL_BATTLE_SCRAMBLE_COPY, type LocalBattleScramble } from '@cuberoot/shared/timer';
import { NetRoomController, startNetRoomPolling, startNetRoomRestore } from '@cuberoot/shared/timer';
import { NetBattleAttemptRecorder, netAttemptSolveId, type NetRecordedAttempt, type NetRecordingOutbox } from '@cuberoot/shared/timer';
import type { Quat } from '@cuberoot/shared/smart-cube/orientation';
import {
  BATTLE_EVENT_IDS,
  DEFAULT_TIMER_TYPOGRAPHY,
  type TimerTypographySettings,
  LOCAL_BATTLE_DEFAULT_PLAYER_KEYS,
  NET_EVENTS,
  assignLocalBattlePlayerKey,
  blendClockOffset,
  canManuallyStartNetAttempt,
  createLocalBattleKeyStore,
  createLocalBattleRound,
  createLocalBattleRoundStore,
  createNetAdmissionGate,
  effectiveNetMs,
  formatMs,
  formatTimerTimingDisplay,
  generateTimerScramble,
  initialLocalBattleState,
  isNetAdmin,
  isLocalBattleScrambleHidden,
  isNetBattleRoomCode,
  isNetRoundParticipant,
  localBattlePlayerForKey,
  myScramble,
  netErrorMessage,
  nextLocalBattleCubeHolder,
  normalizeNetBattleRoomCode,
  playerEventOf,
  selectorIdToNetEvent,
  summarizeLocalBattleRounds,
  syncGate,
  timerEventIdFromSelector,
  timerSupportsLocalBattleSmartCube,
  timerSupportsNetBattleSmartCube,
  transitionLocalBattle,
  type EventId,
  type LocalBattleAction,
  type LocalBattleEffect,
  type LocalBattlePlayerState,
  type LocalBattleRound,
  type LocalBattleState,
  type NetBattleCredentials,
  type NetBattleEventId,
  type NetIdentity,
  type NetBattleSession,
  type NetPenalty,
  type NetRoomState,
  type Penalty,
  type SolveResult,
  type TimerScramblePreviewSettings,
  type TimerStoreSettings,
} from '@cuberoot/shared/timer';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { hintSmartCubeScramble } from '@cuberoot/shared/smart-cube/scramble-hint';
import {
  SegmentTime,
  RoomQrModal,
  TimerPlayersSelect,
  TimerCubePreview,
  TimerPuzzlePicker,
  TimerScrambleStrip,
  TimerTopbar,
  TimerRoomRoundStatus,
  TimerRoomLobby,
  TimerRoomIdentity,
  TimerRoomDialog,
  TimerRoomAdmin,
  TimerRoomHistory,
  TimerRoomToolbar,
  TimerRoomLayout,
  TimerRoomPlayers,
  TimerBattleLayout,
  TimerBattlePlayer,
  TimerBattleHistory,
  TimerBattleToolbar,
  TimerStageLayout,
  TimerBattleSettings,
  TimerBattleCubeControls,
  useTimerBattleOrientation,
  TimingSurface,
  TimerPenaltyActions,
  shouldIgnoreTimerTarget,
  type TimerPlayersValue,
  type TimerPuzzlePickerGroup,
} from '@cuberoot/timer-ui';
import {
  type ReactNode,
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import type { COPY, SupportedLanguage } from './copy';


import {
  getWcaPerson,
  type WcaPersonLite,
} from '@cuberoot/shared/wca-person';
import { useTimerController } from './hooks/use-timer-controller';
import type { InstalledAppNetBattle, InstalledAppSmartCube } from './platform';

type BattleCopy = (typeof COPY)[SupportedLanguage];

interface BattleModeBaseProps {
  onOverlayCloseChange?(close: (() => void) | null): void;
  copy: BattleCopy;
  deviceControls?: ReactNode;
  inputBlocked?: boolean;
  eventGroups: readonly TimerPuzzlePickerGroup[];
  hideTime: boolean;
  holdMs: number;
  inspectionSec: number;
  language: SupportedLanguage;
  onActivityChange(active: boolean): void;
  onModeChange(mode: TimerPlayersValue): void;
  precision: 2 | 3;
  runningPrecision: 0 | 1 | 2 | 3;
}

function battleGroups(
  groups: readonly TimerPuzzlePickerGroup[],
  events: ReadonlySet<EventId>,
): readonly TimerPuzzlePickerGroup[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const event = timerEventIdFromSelector(item.id);
      return event !== null && events.has(event);
    }),
  })).filter((group) => group.items.length > 0);
}

function timerPenalty(player: LocalBattlePlayerState): Penalty | null {
  if (!player.result) return null;
  if (player.penalty === 'dnf') return 'DNF';
  return player.penalty;
}

function playerDisplay(
  player: LocalBattlePlayerState,
  nowMs: number,
  settings: { hideTime: boolean; inspectionSec: number; precision: 0 | 1 | 2 | 3; runningPrecision: 0 | 1 | 2 | 3 },
): string {
  const displayMs = player.timer.phase === 'running'
    ? Math.max(0, nowMs - (player.timer.startedAtMs ?? nowMs))
    : player.timer.lastMs ?? 0;
  return formatTimerTimingDisplay({
    displayMs,
    hideTime: settings.hideTime,
    inspectionDisplayMs: player.timer.phase === 'inspecting'
      ? Math.max(0, nowMs - (player.timer.inspectionStartedAtMs ?? nowMs))
      : 0,
    inspectionLimitSec: player.timer.inspectionSec ?? settings.inspectionSec,
    lastPenalty: timerPenalty(player),
    phase: player.timer.phase,
    precision: settings.precision,
    runningPrecision: settings.runningPrecision,
    timingEnabled: true,
  });
}

function localPlayerColor(player: LocalBattlePlayerState): string {
  return player.timer.phase === 'stopped' && player.penalty === 'dnf'
    ? 'dnf'
    : player.timer.phase;
}

function scrambleLabels(copy: BattleCopy) {
  return {
    copiedCorrection: copy.scrambleCorrectionCopied,
    correction: copy.scrambleCorrection,
    correctionTitle: copy.scrambleCorrectionTitle,
    mismatch: copy.scrambleMismatch,
    ready: copy.scrambleReady,
  };
}

let localBattleRoundSequence = 0;

function nextLocalBattleRoundId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `local-${Date.now()}-${++localBattleRoundSequence}`;
}

export interface LocalBattleModeProps extends BattleModeBaseProps {
  scrambleProvider?(event: EventId, signal: AbortSignal): Promise<LocalBattleScramble>;
  sourceSettings?(event: EventId): ReactNode;
  renderSource?(value: LocalBattleScramble): ReactNode;
  onExportRounds?(rounds: readonly LocalBattleRound[]): Promise<void>;
  onSettingsChange?(patch: Partial<TimerStoreSettings>): void;
  typographySettings?: TimerTypographySettings;
  scramblePreviewSettings?: TimerScramblePreviewSettings;
  onSmartCubeHandlersChange?(handlers: BattleSmartCubeHandlers | null): void;
  playerCount: 2 | 3 | 4;
  smartCube?: InstalledAppSmartCube;
}

export interface BattleSmartCubeHandlers {
  onGyro?(quaternion: Quat, timestamp: number): void;
  onMove(move: string, timestamp: number, facelets: string): void;
  onSolved(timestamp: number): void;
}

/**
 * Installed-client controller for the shared local-battle transition.
 * Timing/business state stays in @cuberoot/shared; this file owns only React,
 * pointer/keyboard timers and scramble-provider effects.
 */
export function LocalBattleMode({
  scrambleProvider, sourceSettings, renderSource, onExportRounds,
  scramblePreviewSettings, onSettingsChange,
  copy,
  deviceControls,
  inputBlocked = false,
  eventGroups,
  language,
  onActivityChange,
  onModeChange,
  onOverlayCloseChange,
  onSmartCubeHandlersChange,
  playerCount,
  typographySettings = DEFAULT_TIMER_TYPOGRAPHY,
  smartCube,
}: LocalBattleModeProps) {
  const [preferences, setPreferences] = useState(defaultLocalBattlePreferences);
  const preferencesRef = useRef(preferences); preferencesRef.current = preferences;
  const { hideTime, holdMs, inspectionSec, precision, layout, flipTopRow, syncStart } = preferences;
  const runningPrecision = precision;
  const showPreview = scramblePreviewSettings?.showCubePreview ?? preferences.showImage;
  const updatePreferences = (patch: Partial<LocalBattlePreferences>) => {
    const next = { ...preferencesRef.current, ...patch };
    try { saveLocalBattlePreferences(window.localStorage, next); preferencesRef.current = next; setPreferences(next); setStorageError(''); }
    catch { setStorageError(copy.actionFailed); }
  };
  const setLayout = useCallback((layout: 'side' | 'versus') => setPreferences(current => ({ ...current, layout })), []);
  useEffect(() => { try { setPreferences(readLocalBattlePreferences(window.localStorage)); } catch { setStorageError(copy.actionFailed); } }, []);

  const [state, setState] = useState<LocalBattleState>(() => initialLocalBattleState(playerCount));
  const [nowMs, setNowMs] = useState(0);
  const [scrambleRows, setScrambleRows] = useState<Partial<Record<EventId, LocalBattleScramble>>>({});
  const requestsRef = useRef(new Map<EventId, AbortController>());
  const sourceInitializedRef = useRef(false);
  const providerRef = useRef(scrambleProvider); providerRef.current = scrambleProvider;
  const historyWritesRef = useRef(Promise.resolve());
  const [winners, setWinners] = useState<number[]>([]);
  const [rounds, setRounds] = useState<LocalBattleRound[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    if (!settingsOpen) return;
    onOverlayCloseChange?.(() => setSettingsOpen(false));
    return () => onOverlayCloseChange?.(null);
  }, [settingsOpen, onOverlayCloseChange]);
  const [playerKeys, setPlayerKeys] = useState<string[]>(() => [...LOCAL_BATTLE_DEFAULT_PLAYER_KEYS]);
  const [storageError, setStorageError] = useState('');
  const [failedScrambleEvents, setFailedScrambleEvents] = useState<Set<EventId>>(() => new Set());
  const [cubeHolder, setCubeHolder] = useState(0);
  useTimerBattleOrientation(state.playerCount, setLayout);

  const inputBlockedRef = useRef(inputBlocked);
  inputBlockedRef.current = inputBlocked || historyOpen || settingsOpen;
  const stateRef = useRef(state);
  const roundsRef = useRef(rounds);
  const playerKeysRef = useRef(playerKeys);
  const cubeHolderRef = useRef(cubeHolder);
  const roundIdRef = useRef(nextLocalBattleRoundId());
  const roundTimestampRef = useRef(Date.now());
  const roundStoreRef = useRef<ReturnType<typeof createLocalBattleRoundStore> | null>(null);
  const keyStoreRef = useRef<ReturnType<typeof createLocalBattleKeyStore> | null>(null);
  const holdTimersRef = useRef(new Map<number, number>());
  const surfaceRefs = useMemo(
    () => Array.from({ length: 4 }, () => createRef<HTMLDivElement>()),
    [],
  );
  stateRef.current = state;
  roundsRef.current = rounds;
  playerKeysRef.current = playerKeys;
  cubeHolderRef.current = cubeHolder;
  const visiblePlayers = state.players.slice(0, state.playerCount);
  const active = visiblePlayers.some((player) => (
    player.timer.phase === 'inspecting'
      || player.timer.phase === 'holding'
      || player.timer.phase === 'ready'
      || player.timer.phase === 'running'
  ));
  const pickerGroups = useMemo(
    () => battleGroups(eventGroups, new Set(BATTLE_EVENT_IDS)),
    [eventGroups],
  );

  const processEffectsRef = useRef<(effects: readonly LocalBattleEffect[]) => void>(() => undefined);
  const dispatch = useCallback((action: LocalBattleAction): boolean => {
    const transition = transitionLocalBattle(stateRef.current, action, { inspectionSec, syncStart });
    if (!transition.accepted) return false;
    if (action.type === 'set-player-event' || action.type === 'set-player-count' || action.type === 'next-round' || action.type === 'request-next-scramble' && !action.preserveResults) {
      roundIdRef.current = nextLocalBattleRoundId(); roundTimestampRef.current = Date.now(); setWinners([]);
    }
    stateRef.current = transition.state;
    setState(transition.state);
    setNowMs(performance.now());
    processEffectsRef.current(transition.effects);
    return true;
  }, [inspectionSec, syncStart]);

  processEffectsRef.current = (effects) => {
    for (const effect of effects) {
      if (effect.type === 'round-reset') {
        roundIdRef.current = nextLocalBattleRoundId(); roundTimestampRef.current = Date.now(); setWinners([]);
        continue;
      }
      if (effect.type === 'request-scramble') {
        setFailedScrambleEvents((current) => {
          if (!current.has(effect.event)) return current;
          const next = new Set(current);
          next.delete(effect.event);
          return next;
        });
        requestsRef.current.get(effect.event)?.abort();
        const controller = new AbortController(); requestsRef.current.set(effect.event, controller);
        setScrambleRows(rows => ({ ...rows, [effect.event]: undefined }));
        void requestLocalBattleScramble(effect.event, providerRef.current ?? (async event => {
          const value = await generateTimerScramble({ event });
          if (!value.ok || value.kind !== 'generated') throw new Error('Scramble unavailable');
          return { scramble: value.scramble };
        }), controller.signal).then(row => {
          if (controller.signal.aborted) return;
          if (dispatch({ type: 'scramble-ready', event: effect.event, revision: effect.revision, scramble: row.scramble, source: row.source })) {
            setScrambleRows(rows => ({ ...rows, [effect.event]: row }));
          }
        }).catch(() => {
          if (controller.signal.aborted) return;
          if (dispatch({ type: 'scramble-failed', event: effect.event, revision: effect.revision })) {
            setFailedScrambleEvents(current => new Set(current).add(effect.event));
          }
        });
        continue;
      }
      if (effect.type === 'round-complete') {
        setWinners(effect.winners);
        const completed = createLocalBattleRound(
          stateRef.current,
          roundIdRef.current,
          roundTimestampRef.current,
        );
        if (completed) {
          const existing = roundsRef.current.findIndex((round) => round.id === completed.id);
          const nextRounds = existing === -1
            ? [...roundsRef.current, completed]
            : roundsRef.current.map((round, index) => index === existing ? completed : round);
          roundsRef.current = nextRounds;
          setRounds(nextRounds);
          historyWritesRef.current = historyWritesRef.current.then(() => roundStoreRef.current?.save(nextRounds)).then(() => setStorageError('')).catch(() => setStorageError(copy.actionFailed));
          if (existing === -1) for (const event of new Set(stateRef.current.players.slice(0, stateRef.current.playerCount).map(player => player.event))) {
            dispatch({ type: 'request-next-scramble', event, preserveResults: true });
          }
        }
        continue;
      }
      if (effect.effect === 'hold-started') {
        const existing = holdTimersRef.current.get(effect.playerId);
        if (existing !== undefined) window.clearTimeout(existing);
        holdTimersRef.current.set(effect.playerId, window.setTimeout(() => {
          holdTimersRef.current.delete(effect.playerId);
          dispatch({
            type: 'player-timer',
            playerId: effect.playerId,
            action: { type: 'hold-ready' },
          });
        }, holdMs));
      }
      if (effect.effect === 'hold-cancelled' || effect.effect === 'run-started') {
        const existing = holdTimersRef.current.get(effect.playerId);
        if (existing !== undefined) window.clearTimeout(existing);
        holdTimersRef.current.delete(effect.playerId);
      }
    }
  };

  useEffect(() => {
    if (!sourceInitializedRef.current) {
      sourceInitializedRef.current = true;
      let event: EventId = '333';
      try { const stored = window.localStorage.getItem('battle_puzzle') as EventId; if (BATTLE_EVENT_IDS.includes(stored)) event = stored; } catch { setStorageError(copy.actionFailed); }
      dispatch({ type: 'set-event', event });
    } else for (const event of new Set(stateRef.current.players.slice(0, stateRef.current.playerCount).map(player => player.event))) dispatch({ type: 'request-next-scramble', event });
    return () => { for (const request of requestsRef.current.values()) request.abort(); };
  // Provider identity changes only with the actual source configuration.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrambleProvider]);

  useEffect(() => {
    roundStoreRef.current = createLocalBattleRoundStore(window.localStorage);
    keyStoreRef.current = createLocalBattleKeyStore(window.localStorage);
    let cancelled = false;
    void Promise.all([
      roundStoreRef.current.load(),
      keyStoreRef.current.load(),
    ]).then(([storedRounds, storedKeys]) => {
      if (cancelled) return;
      roundsRef.current = storedRounds;
      playerKeysRef.current = storedKeys;
      setRounds(storedRounds);
      setPlayerKeys(storedKeys);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (dispatch({ type: 'set-player-count', playerCount })) {
      for (const event of new Set(stateRef.current.players.slice(0, playerCount).map(player => player.event))) dispatch({ type: 'request-next-scramble', event });
    }
    if (cubeHolderRef.current >= playerCount) setCubeHolder(0);
  }, [dispatch, playerCount]);

  useEffect(() => {
    if (!onSmartCubeHandlersChange) return undefined;
    const handlers: BattleSmartCubeHandlers = {
      onMove(_move, timestamp, facelets) {
        if (inputBlockedRef.current) return;
        const holder = cubeHolderRef.current;
        const player = stateRef.current.players[holder];
        if (!player || player.id >= stateRef.current.playerCount
          || !timerSupportsLocalBattleSmartCube(player.event)) return;
        dispatch({
          type: 'player-timer',
          playerId: holder,
          action: { type: 'start-from-cube', nowMs: performance.now(), atMs: timestamp },
        });
        if (facelets === smartCubeTargetFacelets(player.scramble)) {
          dispatch({
            type: 'player-timer',
            playerId: holder,
            action: { type: 'arm-from-cube', nowMs: performance.now() },
          });
        }
      },
      onSolved(timestamp) {
        const holder = cubeHolderRef.current;
        const player = stateRef.current.players[holder];
        if (!player || !timerSupportsLocalBattleSmartCube(player.event)) return;
        const stopped = dispatch({
          type: 'player-timer',
          playerId: holder,
          action: { type: 'stop-from-cube', nowMs: performance.now(), atMs: timestamp },
        });
        if (!stopped) return;
        const next = nextLocalBattleCubeHolder(stateRef.current, holder);
        if (next !== null) setCubeHolder(next);
      },
    };
    onSmartCubeHandlersChange(handlers);
    return () => onSmartCubeHandlersChange(null);
  }, [dispatch, onSmartCubeHandlersChange]);

  useEffect(() => {
    onActivityChange(active);
  }, [active, onActivityChange]);

  useEffect(() => {
    if (!visiblePlayers.some((player) => (
      player.timer.phase === 'running' || player.timer.phase === 'inspecting'
    ))) return undefined;
    let frame = 0;
    const tick = () => {
      setNowMs(performance.now());
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [visiblePlayers]);

  useEffect(() => {
    if (!inputBlocked && !historyOpen && !settingsOpen) return;
    for (let playerId = 0; playerId < stateRef.current.playerCount; playerId += 1) {
      dispatch({ type: 'player-timer', playerId, action: { type: 'cancel-press' } });
    }
  }, [dispatch, inputBlocked, historyOpen, settingsOpen]);

  useEffect(() => {
    const down = new Set<string>();
    const onKeyDown = (event: KeyboardEvent) => {
      if (inputBlockedRef.current || event.repeat || down.has(event.key)) return;
      const playerId = localBattlePlayerForKey(playerKeysRef.current, event.key);
      if (playerId === undefined || playerId >= stateRef.current.playerCount) return;
      if (event.target instanceof HTMLElement && (
        event.target.matches('input,textarea,select,button') || event.target.isContentEditable
      )) return;
      event.preventDefault();
      down.add(event.key);
      dispatch({
        type: 'player-timer',
        playerId,
        action: { type: 'press-down', nowMs: performance.now() },
      });
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!down.delete(event.key)) return;
      if (inputBlockedRef.current) return;
      const playerId = localBattlePlayerForKey(playerKeysRef.current, event.key);
      if (playerId === undefined || playerId >= stateRef.current.playerCount) return;
      event.preventDefault();
      dispatch({
        type: 'player-timer',
        playerId,
        action: { type: 'press-up', nowMs: performance.now() },
      });
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [copy.actionFailed, dispatch]);

  useEffect(() => () => {
    for (const timer of holdTimersRef.current.values()) window.clearTimeout(timer);
    holdTimersRef.current.clear();
    onActivityChange(false);
  }, [onActivityChange]);

  const changeMode = (mode: TimerPlayersValue) => {
    if (active) return;
    onModeChange(mode);
  };

  const nextRound = () => {
    setWinners([]);
    if (dispatch({ type: 'next-round' })) {
      roundIdRef.current = nextLocalBattleRoundId();
      roundTimestampRef.current = Date.now();
    }
  };

  const renderPlayerScramble = (player: LocalBattlePlayerState) => {
    const scrambleFailed = failedScrambleEvents.has(player.event);
    const sameEventPlayerIds = visiblePlayers
      .filter((candidate) => candidate.event === player.event)
      .map((candidate) => candidate.id);
    const scrambleHidden = isLocalBattleScrambleHidden(
      visiblePlayers.map((candidate) => ({
        hasFinished: candidate.result !== null,
        isTiming: candidate.timer.phase === 'running',
      })),
      sameEventPlayerIds,
    );
    return !scrambleHidden ? (
      <TimerScrambleStrip font={typographySettings.scrambleFont} fontScale={preferences.scrambleScale}
        copiedLabel={copy.copied}
        fallback={scrambleFailed ? copy.retry : copy.battleNoScramble}
        fallbackKind="custom"
        hint={player.id === cubeHolder
          && player.timer.phase !== 'running'
          && smartCube?.phase === 'connected'
          && timerSupportsLocalBattleSmartCube(player.event)
          ? hintSmartCubeScramble(player.scramble, smartCube.facelets)
          : null}
        match={player.id === cubeHolder
          && player.timer.phase !== 'running'
          && smartCube?.phase === 'connected'
          && smartCube.facelets
          && timerSupportsLocalBattleSmartCube(player.event)
          ? smartCube.facelets === smartCubeTargetFacelets(player.scramble)
          : null}
        onActivate={scrambleFailed
          ? () => dispatch({ type: 'request-next-scramble', event: player.event, preserveResults: visiblePlayers.every(item => item.result !== null) })
          : undefined}
        scramble={player.scramble}
        status={scrambleFailed ? { kind: 'error', message: LOCAL_BATTLE_SCRAMBLE_COPY.failed[language] } : !player.scramble ? { kind: 'loading', message: LOCAL_BATTLE_SCRAMBLE_COPY.loading[language] } : undefined}
        title={scrambleFailed ? copy.retry : undefined}
        verificationLabels={scrambleLabels(copy)}
      >{scrambleRows[player.event] && renderSource?.(scrambleRows[player.event]!)}</TimerScrambleStrip>
          ) : undefined;
  };
  const sharedScramble = (ids: number[]) => {
    const player = visiblePlayers[ids[0]];
    if (!ids.every((id) => visiblePlayers[id]?.event === player.event)) return undefined;
    const holder = visiblePlayers.find((candidate) => candidate.id === cubeHolder && candidate.event === player.event);
    const strip = renderPlayerScramble(holder ?? player);
    return <>
      {strip}
      {strip && showPreview && player.scramble && <TimerCubePreview
        event={player.event} scramble={player.scramble} height="var(--timer-cube-h)"
        ariaLabel={copy.cubeState} visualization={scramblePreviewSettings?.prefer3D ? '3D' : '2D'} />}
    </>;
  };
  const summaries = summarizeLocalBattleRounds(rounds, state.playerCount);

  return (
    <section className="battle-mode battle-mode--local" aria-label={copy.battleLocalTitle}>
      <TimerStageLayout devices={smartCube && deviceControls}>
      <TimerBattleLayout middle={<TimerBattleToolbar language={language} disabled={active} onHistory={() => setHistoryOpen(true)}
        onSettings={() => setSettingsOpen(true)} onNext={nextRound}
        eventControl={<TimerPuzzlePicker dataNoTimer disabled={active} groups={pickerGroups} puzzleLabel={copy.puzzle}
          selectedEvent={visiblePlayers[0].event} onSelect={selectorId => {
            const event = timerEventIdFromSelector(selectorId);
            if (!event || !dispatch({ type: 'set-event', event })) return;
            try { window.localStorage.setItem('battle_puzzle', event); } catch { setStorageError(copy.actionFailed); }
          }} />}
        startDisabled={visiblePlayers.some((player) => !player.scramble)}
        controls={<TimerPlayersSelect ariaLabel={copy.onePlayer} disabled={active} onlineLabel={copy.online}
          onChange={changeMode} playerLabel={copy.players} value={state.playerCount as 2 | 3 | 4} />}
      />} playerCount={state.playerCount as 2 | 3 | 4} layout={layout} flipTopRow={flipTopRow}
        bottomScramble={sharedScramble([0, 1])}
        topScramble={state.playerCount === 4 ? sharedScramble([2, 3]) : undefined}
        renderPlayer={(playerId, cell) => {
          const player = visiblePlayers[playerId];
          const result = player.result;

          const isWinner = result !== null && winners.includes(player.id);
          const sameEventPlayerIds = visiblePlayers
            .filter((candidate) => candidate.event === player.event)
            .map((candidate) => candidate.id);
          const scrambleHidden = isLocalBattleScrambleHidden(
            visiblePlayers.map((candidate) => ({
              hasFinished: candidate.result !== null,
              isTiming: candidate.timer.phase === 'running',
            })),
            sameEventPlayerIds,
          );
          return (
            <TimerBattlePlayer className="battle-player" playerNumber={player.id + 1}
              language={language} background={{ color: preferences.bgColors[player.id], image: preferences.bgImages[player.id], opacity: preferences.bgOpacity }} score={summaries.find((summary) => summary.playerId === player.id)?.wins ?? 0}
              winner={isWinner}

              actions={result ? <TimerPenaltyActions language={language} value={player.penalty}
                onChange={(penalty) => dispatch({ type: 'set-penalty', playerId: player.id, penalty })} /> : undefined}
            >
              <TimingSurface
                layout="local"
                ariaLabel={copy.battlePlayer(player.id + 1)}
                className="battle-player-timer"
                cornerSlot={!cell.hideScramble && !scrambleHidden && showPreview && player.scramble ? (
                  <TimerCubePreview
                    ariaLabel={copy.cubeState}
                    event={player.event}
                    fill
                    scramble={player.scramble}
                    visualization={scramblePreviewSettings?.prefer3D ? '3D' : '2D'}
                  />
                ) : undefined}
                colorClass={`${localPlayerColor(player)} tf-${typographySettings.timerFont}`} fontScale={typographySettings.timerFontScale}
                digits={<SegmentTime text={playerDisplay(player, nowMs, {
                  hideTime,
                  inspectionSec,
                  precision,
                  runningPrecision,
                })} />}
                interactive={player.scramble.length > 0}
                onContextMenu={(event) => event.preventDefault()}
                onPointerCancel={() => dispatch({
                  type: 'player-timer', playerId: player.id, action: { type: 'cancel-press' },
                })}
                onPointerDown={(event) => {
                  if (inputBlockedRef.current || event.button !== 0 || shouldIgnoreTimerTarget(event.target)) return;
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setWinners([]);
                  dispatch({
                    type: 'player-timer',
                    playerId: player.id,
                    action: { type: 'press-down', nowMs: performance.now() },
                  });
                }}
                onPointerUp={(event) => {
                  if (shouldIgnoreTimerTarget(event.target)) return;
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  dispatch({
                    type: 'player-timer',
                    playerId: player.id,
                    action: { type: 'press-up', nowMs: performance.now() },
                  });
                }}
                phase={player.timer.phase}
                scrambleSlot={!cell.hideScramble ? renderPlayerScramble(player) : undefined}
                surfaceRef={surfaceRefs[player.id]}
              />
            </TimerBattlePlayer>
          );
        }}
      />
      </TimerStageLayout>
      {visiblePlayers.every((player) => player.result !== null) && (
        <p aria-live="polite" className="battle-round-status">{copy.battleAllFinished}</p>
      )}
      <div className="battle-local-tools" data-no-timer>
        {settingsOpen && <TimerBattleSettings layout={{
          playerCount: state.playerCount as 2 | 3 | 4, layout, flipTopRow,
          onLayoutChange: layout => updatePreferences({ layout }), onFlipChange: flipTopRow => updatePreferences({ flipTopRow }),
        }} language={language} onClose={() => setSettingsOpen(false)}
          onReset={async () => {
            await historyWritesRef.current;
            try {
              await roundStoreRef.current!.clear(); roundsRef.current = []; setRounds([]); setStorageError('');
              dispatch({ type: 'reset-round' });
              for (const event of new Set(stateRef.current.players.slice(0, stateRef.current.playerCount).map(player => player.event))) dispatch({ type: 'request-next-scramble', event });
            } catch (error) { setStorageError(copy.actionFailed); throw error; }
          }}
          source={sourceSettings?.(visiblePlayers[0].event)}
          syncStart={{ value: syncStart, onChange: value => {
            updatePreferences({ syncStart: value });
          } }}
          keys={playerKeys.slice(0, state.playerCount)}
          onKeyChange={(playerId, key) => {
            const next = assignLocalBattlePlayerKey(playerKeysRef.current, playerId, key);
            playerKeysRef.current = next; setPlayerKeys(next);
            void keyStoreRef.current?.save(next).catch(() => setStorageError(copy.actionFailed));
          }}
          precision={{ value: precision, options: LOCAL_BATTLE_PRECISIONS, onChange: value => updatePreferences({ precision: value as LocalBattlePreferences['precision'] }) }}
          inspection={{ value: inspectionSec, options: LOCAL_BATTLE_INSPECTIONS, onChange: inspectionSec => updatePreferences({ inspectionSec }) }}
          hold={{ value: holdMs, onChange: holdMs => updatePreferences({ holdMs }) }}
          preview={{ value: showPreview, onChange: showImage => { updatePreferences({ showImage }); onSettingsChange?.({ showCubePreview: showImage }); } }}
          hideTime={{ value: hideTime, onChange: hideTime => updatePreferences({ hideTime }) }}
          devices={smartCube && <TimerBattleCubeControls language={language} mode="shared" holder={cubeHolder}
            onHolderChange={setCubeHolder} deviceControl={() => deviceControls}
            players={visiblePlayers.map((player) => ({ id: player.id, disabled: active || !timerSupportsLocalBattleSmartCube(player.event) || player.result !== null }))} />}
        ><TimerBattleAppearanceSettings language={language} playerCount={state.playerCount} value={preferences} onChange={updatePreferences} />
        </TimerBattleSettings>}
        {historyOpen && <TimerBattleHistory rounds={rounds} playerCount={state.playerCount} language={language} precision={precision}
          onClose={() => setHistoryOpen(false)} onBackChange={onOverlayCloseChange}
          warning={storageError && <p role="alert">{storageError}</p>}
          onExport={onExportRounds ? () => { void onExportRounds(roundsRef.current).catch(() => setStorageError(copy.actionFailed)); } : undefined}
          onDelete={async (id) => {
            await historyWritesRef.current;
            const next = roundsRef.current.filter(round => round.id !== id);
            try {
              await roundStoreRef.current!.save(next);
              roundsRef.current = next; setRounds(next); setStorageError('');
              if (id === roundIdRef.current) dispatch({ type: 'reset-round' });
            } catch (error) { setStorageError(copy.actionFailed); throw error; }
          }}
          onClear={async () => {
            await historyWritesRef.current;
            try {
              await roundStoreRef.current!.clear();
              roundsRef.current = []; setRounds([]); setStorageError('');
              dispatch({ type: 'reset-round' });
            } catch (error) { setStorageError(copy.actionFailed); throw error; }
          }} />}
      </div>
      {storageError && <p aria-live="assertive" className="battle-error">{storageError}</p>}
    </section>
  );
}

const emptySubscribe = () => () => {};
const emptySnapshot = () => null;

export interface NetBattleModeProps extends BattleModeBaseProps {
  sessionId?: string;
  recordGyro?: boolean;
  recordingOutbox?: NetRecordingOutbox;
  onRecordSolve?(record: NetRecordedAttempt): Promise<void>;
  renderRecordedSolve?(record: NetRecordedAttempt): ReactNode;
  onOverlayCloseChange?(close: (() => void) | null): void;
  accountIdentity?: NetIdentity;
  capability?: InstalledAppNetBattle;
  onSmartCubeHandlersChange?(handlers: BattleSmartCubeHandlers | null): void;
  typographySettings?: TimerTypographySettings;
  scramblePreviewSettings: TimerScramblePreviewSettings;
  smartCube?: InstalledAppSmartCube;
  writeClipboardText(text: string): Promise<void>;
}

function netResultText(timeMs: number, penalty: NetPenalty, precision: 2 | 3): string {
  if (penalty === 'dnf') return 'DNF';
  return penalty === '+2'
    ? `${formatMs(timeMs + 2_000, precision)}+`
    : formatMs(timeMs, precision);
}


/** Shared-contract online room host; no room DTO, scoring or transport is reimplemented here. */
export function NetBattleMode({
  sessionId, recordGyro, onRecordSolve, recordingOutbox, renderRecordedSolve,
  accountIdentity,
  capability,
  copy,
  deviceControls,
  inputBlocked = false,
  eventGroups,
  hideTime,
  holdMs,
  inspectionSec,
  language,
  onActivityChange,
  onModeChange,
  onOverlayCloseChange,
  onSmartCubeHandlersChange,
  precision,
  runningPrecision,
  scramblePreviewSettings,
  typographySettings = DEFAULT_TIMER_TYPOGRAPHY,
  smartCube,
  writeClipboardText,
}: NetBattleModeProps) {
  const [room, setRoom] = useState<NetRoomState | null>(null);
  const [credentials, setCredentials] = useState<NetBattleCredentials | null>(null);
  const video = useTimerBattleVideo(battleVideoClient, room?.code ?? null, credentials?.playerId ?? null, credentials?.playerToken ?? null, room?.videoGeneration ?? null, language);
  const [name, setName] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<WcaPersonLite | null>(null);
  const [accountPerson, setAccountPerson] = useState<WcaPersonLite | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [roomActionTarget, setRoomActionTarget] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  useEffect(() => {
    onOverlayCloseChange?.(qrOpen ? () => setQrOpen(false)
      : renameOpen ? () => setRenameOpen(false)
      : showAdmin ? () => setShowAdmin(false)
        : showHistory ? () => setShowHistory(false) : null);
    return () => onOverlayCloseChange?.(null);
  }, [onOverlayCloseChange, qrOpen, renameOpen, showAdmin, showHistory]);
  const [joinCode, setJoinCode] = useState('');
  const [lobbyEvent, setLobbyEvent] = useState<NetBattleEventId>('333');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [countdownMs, setCountdownMs] = useState<number | null>(null);
  const roomRef = useRef(room);
  const credentialsRef = useRef(credentials);
  const roomControllerRef = useRef(new NetRoomController());
  const roomController = roomControllerRef.current;
  const offsetRef = useRef<number | null>(null);
  const admissionGateRef = useRef(createNetAdmissionGate());
  const autoStartedRef = useRef<number | null>(null);
  const netAttemptRef = useRef(new NetBattleAttemptRecorder());
  const attemptAuthRef = useRef<NetBattleCredentials | null>(null);
  const [recordedSolve, setRecordedSolve] = useState<NetRecordedAttempt | null>(null);
  const copiedResetRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const surfaceRef = useRef<HTMLDivElement>(null);
  roomRef.current = room;
  credentialsRef.current = credentials;

  useEffect(() => {
    const wcaId = accountIdentity?.wcaId;
    if (!wcaId) {
      setAccountPerson(null);
      return;
    }
    let cancelled = false;
    void getWcaPerson(wcaId).then((person) => {
      if (!cancelled) setAccountPerson(person);
    });
    return () => { cancelled = true; };
  }, [accountIdentity?.wcaId]);

  const identity: NetIdentity = accountIdentity ? {
    ...accountIdentity,
    name: accountPerson?.name || accountIdentity.name,
    iso2: accountPerson?.country_iso2 || accountIdentity.iso2,
  } : selectedPerson ? {
    name: selectedPerson.name,
    wcaId: selectedPerson.id,
    iso2: selectedPerson.country_iso2 || undefined,
  } : { name: name.trim() || copy.battleNamePlaceholder };

  const eventPickerGroups = useMemo(
    () => battleGroups(eventGroups, new Set<EventId>(NET_EVENTS)),
    [eventGroups],
  );
  useSyncExternalStore(recordingOutbox?.subscribe ?? emptySubscribe, recordingOutbox?.getSnapshot ?? emptySnapshot, recordingOutbox?.getSnapshot ?? emptySnapshot);
  const myResult = room && credentials
    ? recordingOutbox?.result({ code: room.code, playerId: credentials.playerId, round: room.round })
      ?? room.results[String(room.round)]?.[credentials.playerId]
    : undefined;
  const event = room && credentials ? playerEventOf(room, credentials.playerId) : lobbyEvent;
  const scramble = room && credentials ? myScramble(room, credentials.playerId) ?? '' : '';

  const fail = useCallback((reason: unknown) => {
    setError(netErrorMessage(reason)[language]);
  }, [language]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      admissionGateRef.current.cancel();
      roomController.deactivate();
      if (copiedResetRef.current !== null) window.clearTimeout(copiedResetRef.current);
    };
  }, []);

  const persistRecording = useCallback((record: NetRecordedAttempt) => {
    setRecordedSolve(record);
    void onRecordSolve?.(record).then(() => {
      if (capability) void roomController.poll(capability.client.getNetRoom);
    }).catch(() => setError(copy.actionFailed));
  }, [onRecordSolve, copy.actionFailed, capability, roomController]);
  const onComplete = useCallback((result: SolveResult) => {
    const completed = netAttemptRef.current.finish(result);
    const auth = attemptAuthRef.current;
    if (!completed) return;
    if (completed.record) persistRecording(completed.record);
    if (onRecordSolve || !capability || !auth) return;
    const penalty: NetPenalty = result.autoPenalty === 'DNF' ? 'dnf' : result.autoPenalty;
    const { code, round } = completed.context;
    void roomController.submitResult(round, () => capability.client.postNetResult(code, auth, round, result.timeMs, penalty), { t: result.timeMs, p: penalty });
  }, [roomController, capability, fail, persistRecording]);

  const timer = useTimerController({
    canStart: !inputBlocked && !showAdmin && !showHistory && !qrOpen && !renameOpen && Boolean(room && credentials && scramble && !myResult),
    holdMs,
    inspectionSec,
    onComplete,
    onStart: (startedAtMs) => {
      const current = roomRef.current, auth = credentialsRef.current;
      if (!current || !auth) return;
      attemptAuthRef.current = { ...auth };
      netTimerPhaseRef.current = 'running';
      setRecordedSolve(null);
      netAttemptRef.current.begin({ code: current.code, playerId: auth.playerId, round: current.round,
        sessionId: sessionId ?? '', id: netAttemptSolveId({ code: current.code, playerId: auth.playerId, round: current.round }), ts: Date.now(),
        event: playerEventOf(current, auth.playerId), scramble: myScramble(current, auth.playerId) ?? '' }, startedAtMs,
        smartCube?.phase === 'connected' ? { model: smartCube.model ?? '', name: smartCube.deviceName } : undefined);
    },
  });
  const timerPhase = timer.machine.phase;
  const inRoundRoster = room && credentials
    ? isNetRoundParticipant(room, credentials.playerId)
    : false;
  const gate = room && credentials
    ? syncGate(room, credentials.playerId)
    : { gated: false, ready: false, waiting: 0 };
  const canManuallyStart = room && credentials
    ? canManuallyStartNetAttempt(room, credentials.playerId)
    : false;
  const active = timerPhase === 'running'
    || timerPhase === 'inspecting'
    || timerPhase === 'holding'
    || timerPhase === 'ready'
    || countdownMs !== null;
  const netSmartCubeSupported = timerSupportsNetBattleSmartCube(event);
  const netSmartCubeTarget = useMemo(() => (
    timerSupportsNetBattleSmartCube(event) && scramble
      ? smartCubeTargetFacelets(scramble)
      : null
  ), [event, scramble]);
  const [netSmartCubeHint, setNetSmartCubeHint] = useState<ReturnType<typeof hintSmartCubeScramble>>(null);
  const netTimerPhaseRef = useRef(timerPhase);
  netTimerPhaseRef.current = timerPhase;
  const netSmartCubeMatch = timerPhase !== 'running'
    && !myResult
    && smartCube?.phase === 'connected'
    && smartCube.facelets
    && netSmartCubeTarget
    ? smartCube.facelets === netSmartCubeTarget
    : null;

  useEffect(() => {
    if (!onSmartCubeHandlersChange) return undefined;
    const handlers: BattleSmartCubeHandlers = {
      onGyro(quaternion, timestamp) {
        if (recordGyro && netTimerPhaseRef.current === 'running') netAttemptRef.current.recordGyro(quaternion, timestamp);
      },
      onMove(move, timestamp, facelets) {
        if (netTimerPhaseRef.current === 'running') {
          netAttemptRef.current.recordMove(move, timestamp);
          return;
        }
        if (!netSmartCubeSupported
          || gate.gated
          || countdownMs !== null
          || myResult
          || !inRoundRoster
          || !canManuallyStart) return;
        if (timer.startFromCube(timestamp)) {
          netTimerPhaseRef.current = 'running';
          netAttemptRef.current.recordMove(move, timestamp);
          setNetSmartCubeHint(null);
          return;
        }
        if (facelets === netSmartCubeTarget) timer.armFromCube();
      },
      onSolved(timestamp) {
        if (!netSmartCubeSupported
          || netTimerPhaseRef.current !== 'running'
          || !timer.stopFromCube(timestamp)) return;
        netTimerPhaseRef.current = 'stopped';
      },
    };
    onSmartCubeHandlersChange(handlers);
    return () => onSmartCubeHandlersChange(null);
  }, [
    canManuallyStart,
    recordGyro,
    countdownMs,
    event,
    gate.gated,
    inRoundRoster,
    myResult,
    netSmartCubeTarget,
    netSmartCubeSupported,
    onSmartCubeHandlersChange,
    timer.startFromCube,
    timer.armFromCube,
    timer.stopFromCube,
  ]);

  useEffect(() => {
    if (timerPhase === 'running'
      || myResult
      || smartCube?.phase !== 'connected'
      || !smartCube.facelets
      || !netSmartCubeTarget
      || !scramble) {
      setNetSmartCubeHint(null);
      return;
    }
    setNetSmartCubeHint(hintSmartCubeScramble(scramble, smartCube.facelets));
  }, [
    myResult,
    netSmartCubeTarget,
    scramble,
    smartCube?.facelets,
    smartCube?.phase,
    timerPhase,
  ]);

  useEffect(() => onActivityChange(active), [active, onActivityChange]);
  useEffect(() => () => onActivityChange(false), [onActivityChange]);

  useEffect(() => {
    if (!capability) return;
    const intent = admissionGateRef.current.beginBackground();
    if (intent === null) return;
    return startNetRoomRestore({
      current: () => admissionGateRef.current.isCurrent(intent),
      load: () => capability.sessions.load(),
      getRoom: capability.client.getNetRoom,
      clear: () => capability.sessions.clear(),
      restored: (session, state) => {
        const auth = { playerId: session.playerId, playerToken: session.playerToken };
        credentialsRef.current = auth;
        setName(session.name); setCredentials(auth); setError('');
        roomController.activate(state, auth);
      },
      missing: () => undefined,
      error: error => roomController.callbacks.onError(error),
    });
  }, [roomController, capability]);

  roomController.callbacks = {
    onState: state => {
      roomRef.current = state;
      offsetRef.current = blendClockOffset(offsetRef.current, state.now, Date.now());
      setRoom(state);
    },
    onError: fail,
    onGone: reason => {
      admissionGateRef.current.cancel();
      credentialsRef.current = null;
      roomRef.current = null;
      setBusy(false); setRoom(null); setCredentials(null); setCountdownMs(null);
      setRecordedSolve(null); setShowAdmin(false); setShowHistory(false); setRenameOpen(false); setQrOpen(false); setRoomActionTarget(null);
      autoStartedRef.current = null; offsetRef.current = null;
      netAttemptRef.current.reset(); timer.reset();
      fail(new Error(reason));
      void capability?.sessions.clear().catch(() => undefined);
    },
    isTiming: () => netTimerPhaseRef.current === 'running',
  };
  useEffect(() => {
    if (!capability || !room || !credentials) return;
    return startNetRoomPolling(roomController, capability.client.getNetRoom, {
      visible: () => !document.hidden,
      subscribeWake: wake => {
        document.addEventListener('visibilitychange', wake);
        window.addEventListener('online', wake);
        return () => { document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake); };
      },
    });
  }, [capability, credentials, room?.code, roomController]);

  useEffect(() => {
    if (!capability || !room || !credentials || scramble) return;
    void roomController.ensure(event, () => capability.client.ensureNetScramble(room.code, credentials, event));
  }, [roomController, capability, credentials, event, fail, room, scramble]);

  useEffect(() => {
    if (!capability || !room || !credentials) return;
    if (timerPhase === 'inspecting') {
      void roomController.execute(() => capability.client.postNetStatus(room.code, credentials, 'inspecting'), { quiet: true });
    } else if (timerPhase === 'running') {
      void roomController.execute(() => capability.client.postNetStatus(room.code, credentials, 'solving'), { quiet: true });
    }
  }, [roomController, capability, credentials, room?.code, timerPhase]);

  useEffect(() => {
    const startAt = room?.startAt ?? null;
    if (startAt === null || !inRoundRoster || myResult || autoStartedRef.current === startAt) {
      setCountdownMs(null);
      return;
    }
    let interval = 0;
    const tick = () => {
      const left = startAt - (Date.now() + (offsetRef.current ?? 0));
      if (left > 0) {
        setCountdownMs(left);
        return;
      }
      window.clearInterval(interval);
      setCountdownMs(null);
      if (autoStartedRef.current === startAt) return;
      autoStartedRef.current = startAt;
      if (netTimerPhaseRef.current === 'running') return;
      timer.startNow(Math.max(0, -left));
    };
    tick();
    interval = window.setInterval(tick, 50);
    return () => window.clearInterval(interval);
  }, [inRoundRoster, myResult, room?.round, room?.startAt, timer.startNow]);

  const previousRoundRef = useRef<number | null>(null);
  useEffect(() => {
    if (!room) {
      previousRoundRef.current = null;
      return;
    }
    if (previousRoundRef.current !== null && room.round > previousRoundRef.current
      && (timer.machine.phase === 'idle' || timer.machine.phase === 'stopped')) {
      timer.reset();
    }
    previousRoundRef.current = room.round;
  }, [room?.round, timer.machine.phase, timer.reset]);

  const advanceRound = useCallback((force: boolean) => {
    if (capability) void roomController.advance(capability.client.nextNetRound, force);
  }, [capability, roomController]);

  const adopt = useCallback(async (
    admission: { state: NetRoomState; credentials: NetBattleCredentials },
    identityName: string,
  ) => {
    if (!capability) return;
    credentialsRef.current = admission.credentials;
    setCredentials(admission.credentials);
    roomController.activate(admission.state, admission.credentials);
    await capability.sessions.save({
      code: admission.state.code,
      name: identityName,
      ...admission.credentials,
    } satisfies NetBattleSession);
  }, [roomController, capability]);

  const createRoom = () => {
    if (!capability) return;
    const intent = admissionGateRef.current.beginExclusive();
    if (intent === null) return;
    const identityName = identity.name;
    setBusy(true);
    setError('');
    void capability.client.createNetRoom(lobbyEvent, identity)
      .then(async (admission) => {
        if (!admissionGateRef.current.isCurrent(intent)) {
          await capability.client.leaveNetRoom(admission.state.code, admission.credentials).catch(() => undefined);
          return;
        }
        await adopt(admission, identityName);
      })
      .catch(error => { if (admissionGateRef.current.isCurrent(intent)) fail(error); })
      .finally(() => { if (admissionGateRef.current.finish(intent)) setBusy(false); });
  };

  const joinRoom = (rawCode: string) => {
    if (!capability) return;
    const code = normalizeNetBattleRoomCode(rawCode);
    if (!isNetBattleRoomCode(code)) {
      fail(new Error('invalid battle room code'));
      return;
    }
    const intent = admissionGateRef.current.beginExclusive();
    if (intent === null) return;
    const identityName = identity.name;
    setBusy(true);
    setError('');
    void capability.client.joinNetRoom(code, identity)
      .then(async (admission) => {
        if (!admissionGateRef.current.isCurrent(intent)) {
          await capability.client.leaveNetRoom(admission.state.code, admission.credentials).catch(() => undefined);
          return;
        }
        await adopt(admission, identityName);
      })
      .catch(fail)
      .finally(() => {
        admissionGateRef.current.finish(intent);
        setBusy(false);
      });
  };

  const leaveRoom = useCallback(async () => {
    const currentRoom = roomRef.current;
    const auth = credentialsRef.current;
    roomController.deactivate();
    credentialsRef.current = null; roomRef.current = null;
    netAttemptRef.current.reset();
    setBusy(false);
    admissionGateRef.current.cancel();
    setRoom(null);
    setCredentials(null);
    setError('');
    setCountdownMs(null);
    setRecordedSolve(null); setShowAdmin(false); setShowHistory(false); setRenameOpen(false); setQrOpen(false); setRoomActionTarget(null);
    autoStartedRef.current = null; offsetRef.current = null;
    timer.reset();
    await capability?.sessions.clear().catch(() => undefined);
    if (capability && currentRoom && auth) {
      await capability.client.leaveNetRoom(currentRoom.code, auth).catch(() => undefined);
    }
  }, [capability, timer.reset]);

  const changeMode = (mode: TimerPlayersValue) => {
    if (active) return;
    if (mode !== 'net') void leaveRoom();
    onModeChange(mode);
  };

  if (!capability) {
    return (
      <section className="battle-mode battle-mode--net" aria-label={copy.battleOnlineTitle}>
        <TimerTopbar controls={(
          <TimerPlayersSelect
            ariaLabel={copy.onePlayer}
            onlineLabel={copy.online}
            onChange={changeMode}
            playerLabel={copy.players}
            value="net"
          />
        )} />
        <p className="battle-empty">{copy.battleOnlineUnavailable}</p>
      </section>
    );
  }

  if (!room || !credentials) {
    return (
      <section className="battle-mode battle-mode--net" aria-label={copy.battleOnlineTitle}>
        <TimerTopbar controls={(
          <TimerPlayersSelect
            ariaLabel={copy.onePlayer}
            disabled={busy}
            onlineLabel={copy.online}
            onChange={changeMode}
            playerLabel={copy.players}
            value="net"
          />
        )} />
        <TimerRoomLobby language={language} code={joinCode} busy={busy} error={error}
          onCodeChange={setJoinCode} onJoin={joinRoom} onCreate={createRoom}
          identity={<TimerRoomIdentity language={language} account={accountIdentity ? identity : null}
            value={selectedPerson} defaultQuery={name} disabled={busy} onQueryChange={setName}
            onChange={(person) => { setSelectedPerson(person); setName(''); }} />}
          event={<TimerPuzzlePicker dataNoTimer disabled={busy} groups={eventPickerGroups}
            onSelect={(selectorId) => { const next = selectorIdToNetEvent(selectorId); if (next) setLobbyEvent(next); }}
            puzzleLabel={copy.puzzle} selectedEvent={lobbyEvent} />}
        />
      </section>
    );
  }

  const currentResult = myResult;
  const displayMs = timer.machine.phase === 'running'
    ? Math.max(0, timer.nowMs - (timer.machine.startedAtMs ?? timer.nowMs))
    : timer.machine.lastMs ?? currentResult?.t ?? 0;
  const timerText = countdownMs !== null
    ? String(Math.max(1, Math.ceil(countdownMs / 1_000)))
    : currentResult
      ? netResultText(currentResult.t, currentResult.p, precision)
      : formatTimerTimingDisplay({
          displayMs,
          hideTime,
          inspectionDisplayMs: timer.machine.phase === 'inspecting'
            ? Math.max(0, timer.nowMs - (timer.machine.inspectionStartedAtMs ?? timer.nowMs))
            : 0,
          inspectionLimitSec: timer.machine.inspectionSec ?? inspectionSec,
          lastPenalty: null,
          phase: timer.machine.phase,
          precision,
          runningPrecision,
          timingEnabled: true,
        });
  const colorClass = currentResult?.p === 'dnf' ? 'dnf' : timer.machine.phase;
  const amAdmin = isNetAdmin(room, credentials.playerId);

  return (
    <section className="battle-mode battle-mode--net" aria-label={copy.battleOnlineTitle}>
      <TimerTopbar
        controls={(
          <>
          <TimerPuzzlePicker
            dataNoTimer
            disabled={active || Boolean(currentResult)}
            groups={eventPickerGroups}
            onSelect={(selectorId) => {
              const next = selectorIdToNetEvent(selectorId);
              if (!next || next === event) return;
              void roomController.execute(() => capability.client.postNetEvent(room.code, credentials, next), { onSuccess: () => timer.reset() });
            }}
            puzzleLabel={copy.puzzle}
            selectedEvent={event}
          />
          <TimerPlayersSelect
            ariaLabel={copy.onePlayer}
            disabled={active}
            onlineLabel={copy.online}
            onChange={changeMode}
            playerLabel={copy.players}
            value="net"
          />
          </>
        )}
      />
      {showAdmin && amAdmin && <TimerRoomAdmin room={room} currentPlayerId={credentials.playerId}
        language={language} busy={roomActionTarget !== null} onClose={() => setShowAdmin(false)}
        onSyncStart={(value) => {
          setRoomActionTarget('sync');
          void roomController.execute(() => capability.client.postNetSyncStart(room.code, credentials, value), { onSettled: () => setRoomActionTarget(null) });
        }}
        onTransfer={(id) => {
          setRoomActionTarget(id);
          void roomController.execute(() => capability.client.postNetAdmin(room.code, credentials, id), { onSuccess: () => setShowAdmin(false), onSettled: () => setRoomActionTarget(null) });
        }}
        onKick={(id) => {
          setRoomActionTarget(id);
          void roomController.execute(() => capability.client.postNetKick(room.code, credentials, id), { onSettled: () => setRoomActionTarget(null) });
        }} />}
      {showHistory && <TimerRoomHistory room={room} currentPlayerId={credentials.playerId}
        language={language} precision={precision} onClose={() => setShowHistory(false)} />}
      {renameOpen && <TimerRoomDialog language={language} title={{ en: 'Change name', zh: '改名' }[language]} onClose={() => setRenameOpen(false)}>
        <TimerRoomIdentity language={language} value={selectedPerson} defaultQuery={name} disabled={busy}
          onQueryChange={setName} onChange={(person) => { setSelectedPerson(person); setName(''); }} />
        <div className="timer-room-actions"><button type="button" disabled={busy} onClick={() => {
          setBusy(true);
          void roomController.execute(() => capability.client.renameNetPlayer(room.code, credentials, identity), { onSuccess: () => setRenameOpen(false), onSettled: () => setBusy(false) });
        }}>{copy.save}</button></div>
      </TimerRoomDialog>}
      <TimerRoomLayout devices={smartCube && deviceControls} toolbar={<TimerRoomToolbar language={language} code={room.code} round={room.round}
        syncStart={room.syncStart} copied={copied} copyKind="code" disabled={active}
        historyOpen={showHistory} adminOpen={showAdmin}
        onCopy={() => {
          void writeClipboardText(room.code).then(() => {
            if (!mountedRef.current) return;
            setCopied(true);
            if (copiedResetRef.current !== null) window.clearTimeout(copiedResetRef.current);
            copiedResetRef.current = window.setTimeout(() => setCopied(false), 1_500);
          }).catch((reason: unknown) => { if (mountedRef.current) fail(reason); });
        }}
        onQr={() => setQrOpen(true)}
        onHistory={() => { setShowHistory(true); setShowAdmin(false); }}
        onAdmin={amAdmin ? () => { setShowAdmin(true); setShowHistory(false); } : undefined}
        onLeave={() => void leaveRoom()}
      ><VideoToggle video={video} /></TimerRoomToolbar>}
        media={<VideoStrip video={video} />}
        players={<TimerRoomPlayers room={room} currentPlayerId={credentials.playerId}
        language={language} precision={precision} nowMs={Date.now() + (offsetRef.current ?? 0)}
        onRename={!accountIdentity ? (name) => {
          const player = room.players[credentials.playerId];
          setName(name);
          setSelectedPerson(player?.wcaId ? { id: player.wcaId, name: player.name, country_iso2: player.iso2 ?? '' } : null);
          setRenameOpen(true);
        } : undefined} />}
      >
        <>
          <TimingSurface
            layout="net"
            ariaLabel={copy.timer}
            colorClass={`${colorClass} tf-${typographySettings.timerFont}`} fontScale={typographySettings.timerFontScale}
            cornerSlot={scramblePreviewSettings.showCubePreview && scramble ? (
              <TimerCubePreview
                ariaLabel={copy.cubeState}
                event={event}
                fill
                scramble={scramble}
                visualization={scramblePreviewSettings.prefer3D ? '3D' : '2D'}
              />
            ) : undefined}
            digits={<SegmentTime text={timerText} />}
            interactive={Boolean(scramble && !currentResult && inRoundRoster && (
              gate.gated || canManuallyStart || timerPhase === 'running'
            ))}
            onContextMenu={(event) => event.preventDefault()}
            onPointerCancel={(pointer) => {
              if (shouldIgnoreTimerTarget(pointer.target)
                || !pointer.currentTarget.hasPointerCapture(pointer.pointerId)) return;
              timer.cancelPress();
            }}
            onPointerDown={(pointer) => {
              if (shouldIgnoreTimerTarget(pointer.target)
                || pointer.button !== 0
                || currentResult
                || !inRoundRoster) return;
              pointer.preventDefault();
              if (gate.gated) {
                const phase = gate.ready ? 'idle' : 'ready';
                void roomController.execute(() => capability.client.postNetStatus(room.code, credentials, phase));
                return;
              }
              if (!canManuallyStart && timerPhase !== 'running') return;
              pointer.currentTarget.setPointerCapture(pointer.pointerId);
              timer.pressDown();
            }}
            onPointerUp={(pointer) => {
              if (shouldIgnoreTimerTarget(pointer.target)
                || !pointer.currentTarget.hasPointerCapture(pointer.pointerId)) return;
              pointer.currentTarget.releasePointerCapture(pointer.pointerId);
              if (!gate.gated && (canManuallyStart || timerPhase === 'running')) timer.pressUp();
            }}
            phase={timer.machine.phase}
            scrambleSlot={(
              <TimerScrambleStrip font={typographySettings.scrambleFont} fontScale={typographySettings.scrambleFontScale}
                copiedLabel={copy.copied}
                fallback={copy.battleNoScramble}
                fallbackKind="custom"
                hint={netSmartCubeHint}
                match={netSmartCubeMatch}
                scramble={scramble}
                verificationLabels={scrambleLabels(copy)}
              />
            )}
            surfaceRef={surfaceRef}
          >
            <TimerRoomRoundStatus room={room} currentPlayerId={credentials.playerId} language={language}
              idle={timerPhase === 'idle' || timerPhase === 'stopped'} countdown={countdownMs !== null}
              cubeAutoReadySuspended={smartCube?.phase === 'connected'}
              onReady={() => { void roomController.execute(() => capability.client.postNetStatus(room.code, credentials, gate.ready ? 'idle' : 'ready')); }}
              onPenalty={(penalty) => {
                if (!currentResult) return;
                const record = netAttemptRef.current.penalty({ code: room.code, playerId: credentials.playerId, round: room.round }, penalty);
                if (onRecordSolve) {
                  const identity = { code: room.code, playerId: credentials.playerId, round: room.round };
                  const context = { ...identity, id: netAttemptSolveId(identity), ts: Date.now(), sessionId: sessionId ?? '', event, scramble };
                  persistRecording(record ?? { context, solve: { id: context.id, ts: context.ts, event, scramble,
                    timeMs: currentResult.t, penalty: penalty === 'dnf' ? 'DNF' : penalty } });
                  return;
                }
                void roomController.submitResult(room.round, () => capability.client.postNetResult(room.code, credentials, room.round, currentResult.t, penalty), { t: currentResult.t, p: penalty });
              }}
              onNext={advanceRound} />
          </TimingSurface>
        </>
      </TimerRoomLayout>
      {error && <p aria-live="assertive" className="battle-error">{error}</p>}
      {qrOpen && (
        <RoomQrModal
          code={room.code}
          labels={{
            close: copy.close,
            copied: copy.copied,
            copyFailed: copy.actionFailed,
            copyInvite: copy.battleCopyInvite,
            scanToJoin: copy.battleScanToJoin,
          }}
          onClose={() => setQrOpen(false)}
          url={`https://cuberoot.me${language === 'zh' ? '/zh' : ''}/timer?players=net&room=${room.code}`}
          writeClipboardText={writeClipboardText}
        />
      )}
      {recordedSolve && timerPhase !== 'running' && renderRecordedSolve?.(recordedSolve)}
    </section>
  );
}
