import {
  BATTLE_EVENT_IDS,
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
  isLocalBattleAssignableKey,
  isNetBattleRoomCode,
  isNetOnline,
  isNetRoundParticipant,
  localBattlePlayerForKey,
  myScramble,
  netErrorMessage,
  nextLocalBattleCubeHolder,
  normalizeNetBattleRoomCode,
  pendingCount,
  playerEventOf,
  playerStats,
  playerTimeline,
  preferLatestNetRoomState,
  roundViews,
  selectorIdToNetEvent,
  sortedNetPlayers,
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
} from '@cuberoot/shared/timer';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { hintSmartCubeScramble } from '@cuberoot/shared/smart-cube/scramble-hint';
import {
  SegmentTime,
  Flag,
  RoomQrModal,
  TimerDeviceActions,
  TimerPlayersSelect,
  TimerCubePreview,
  TimerPuzzlePicker,
  TimerScrambleStrip,
  TimerTopbar,
  TimingSurface,
  shouldIgnoreTimerTarget,
  type TimerPlayersValue,
  type TimerPuzzlePickerGroup,
} from '@cuberoot/timer-ui';
import {
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { COPY, SupportedLanguage } from './copy';
import { displayCuberName } from '@cuberoot/shared/cuber-name-display';
import {
  getWcaPerson,
  searchWcaPersons,
  type WcaPersonLite,
} from '@cuberoot/shared/wca-person';
import { useTimerController } from './hooks/use-timer-controller';
import type { InstalledAppNetBattle, InstalledAppSmartCube } from './platform';

type BattleCopy = (typeof COPY)[SupportedLanguage];

interface BattleModeBaseProps {
  copy: BattleCopy;
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
  settings: Pick<BattleModeBaseProps, 'hideTime' | 'inspectionSec' | 'precision' | 'runningPrecision'>,
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
  onSmartCubeHandlersChange?(handlers: BattleSmartCubeHandlers | null): void;
  playerCount: 2 | 3 | 4;
  smartCube?: InstalledAppSmartCube;
}

export interface BattleSmartCubeHandlers {
  onMove(move: string, timestamp: number, facelets: string): void;
  onSolved(timestamp: number): void;
}

/**
 * Installed-client controller for the shared local-battle transition.
 * Timing/business state stays in @cuberoot/shared; this file owns only React,
 * pointer/keyboard timers and scramble-provider effects.
 */
export function LocalBattleMode({
  copy,
  eventGroups,
  hideTime,
  holdMs,
  inspectionSec,
  language,
  onActivityChange,
  onModeChange,
  onSmartCubeHandlersChange,
  playerCount,
  precision,
  runningPrecision,
  smartCube,
}: LocalBattleModeProps) {
  const [state, setState] = useState<LocalBattleState>(() => initialLocalBattleState(playerCount));
  const [nowMs, setNowMs] = useState(() => performance.now());
  const [winners, setWinners] = useState<number[]>([]);
  const [rounds, setRounds] = useState<LocalBattleRound[]>([]);
  const [playerKeys, setPlayerKeys] = useState<string[]>(() => [...LOCAL_BATTLE_DEFAULT_PLAYER_KEYS]);
  const [recordingPlayer, setRecordingPlayer] = useState<number | null>(null);
  const [storageError, setStorageError] = useState('');
  const [failedScrambleEvents, setFailedScrambleEvents] = useState<Set<EventId>>(() => new Set());
  const [cubeHolder, setCubeHolder] = useState(0);
  const stateRef = useRef(state);
  const roundsRef = useRef(rounds);
  const playerKeysRef = useRef(playerKeys);
  const recordingPlayerRef = useRef(recordingPlayer);
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
  recordingPlayerRef.current = recordingPlayer;
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
    const transition = transitionLocalBattle(stateRef.current, action, { inspectionSec });
    if (!transition.accepted) return false;
    stateRef.current = transition.state;
    setState(transition.state);
    setNowMs(performance.now());
    processEffectsRef.current(transition.effects);
    return true;
  }, [inspectionSec]);

  processEffectsRef.current = (effects) => {
    for (const effect of effects) {
      if (effect.type === 'request-scramble') {
        setFailedScrambleEvents((current) => {
          if (!current.has(effect.event)) return current;
          const next = new Set(current);
          next.delete(effect.event);
          return next;
        });
        void generateTimerScramble({ event: effect.event }).then((result) => {
          if (!result.ok || result.kind !== 'generated') {
            if (dispatch({
              type: 'scramble-failed',
              event: effect.event,
              revision: effect.revision,
            })) setFailedScrambleEvents((current) => new Set(current).add(effect.event));
            return;
          }
          if (dispatch({
            type: 'scramble-ready',
            event: effect.event,
            revision: effect.revision,
            scramble: result.scramble,
          })) setFailedScrambleEvents((current) => {
            if (!current.has(effect.event)) return current;
            const next = new Set(current);
            next.delete(effect.event);
            return next;
          });
        }).catch(() => {
          if (dispatch({
            type: 'scramble-failed',
            event: effect.event,
            revision: effect.revision,
          })) setFailedScrambleEvents((current) => new Set(current).add(effect.event));
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
          void roundStoreRef.current?.save(nextRounds).catch(() => setStorageError(copy.actionFailed));
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
    dispatch({ type: 'request-next-scramble', event: '333' });
  // The reducer revision gate owns async freshness; initialize once per mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    dispatch({ type: 'set-player-count', playerCount });
    if (cubeHolderRef.current >= playerCount) setCubeHolder(0);
  }, [dispatch, playerCount]);

  useEffect(() => {
    if (!onSmartCubeHandlersChange) return undefined;
    const handlers: BattleSmartCubeHandlers = {
      onMove(_move, timestamp, facelets) {
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
            action: { type: 'press-down', nowMs: performance.now() },
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
    const down = new Set<string>();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || down.has(event.key)) return;
      const recording = recordingPlayerRef.current;
      if (recording !== null) {
        event.preventDefault();
        if (event.key === 'Escape') {
          setRecordingPlayer(null);
          return;
        }
        if (!isLocalBattleAssignableKey(event.key)) return;
        const nextKeys = assignLocalBattlePlayerKey(playerKeysRef.current, recording, event.key);
        playerKeysRef.current = nextKeys;
        setPlayerKeys(nextKeys);
        setRecordingPlayer(null);
        void keyStoreRef.current?.save(nextKeys).catch(() => setStorageError(copy.actionFailed));
        return;
      }
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
    if (typeof mode === 'number' && mode >= 2) {
      dispatch({ type: 'set-player-count', playerCount: mode });
    }
    onModeChange(mode);
  };

  const startAll = () => {
    setWinners([]);
    dispatch({ type: 'start-all', nowMs: performance.now() });
  };

  const nextRound = () => {
    setWinners([]);
    if (dispatch({ type: 'next-round' })) {
      roundIdRef.current = nextLocalBattleRoundId();
      roundTimestampRef.current = Date.now();
    }
  };

  const summaries = summarizeLocalBattleRounds(rounds, state.playerCount);

  return (
    <section className="battle-mode battle-mode--local" aria-label={copy.battleLocalTitle}>
      <TimerTopbar
        controls={(
          <TimerPlayersSelect
            ariaLabel={copy.onePlayer}
            disabled={active}
            onlineLabel={copy.online}
            onChange={changeMode}
            playerLabel={copy.players}
            value={state.playerCount as 2 | 3 | 4}
          />
        )}
        actions={(
          <div className="battle-top-actions" data-no-timer>
            <button disabled={active || visiblePlayers.some((player) => !player.scramble)} onClick={startAll} type="button">
              {copy.battleStartTogether}
            </button>
            <button disabled={active} onClick={nextRound} type="button">{copy.battleNextRound}</button>
          </div>
        )}
      />
      <div className={`battle-grid battle-grid--${state.playerCount}`}>
        {visiblePlayers.map((player) => {
          const result = player.result;
          const scrambleFailed = failedScrambleEvents.has(player.event);
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
            <article className={`battle-player${isWinner ? ' is-winner' : ''}`} key={player.id}>
              <header className="battle-player-header" data-no-timer>
                <strong>{copy.battlePlayer(player.id + 1)}</strong>
                {isWinner && <span className="battle-winner">{copy.battleWinner}</span>}
                <TimerPuzzlePicker
                  dataNoTimer
                  disabled={active}
                  groups={pickerGroups}
                  onSelect={(selectorId) => {
                    const event = timerEventIdFromSelector(selectorId);
                    if (!event) return;
                    setWinners([]);
                    dispatch({ type: 'set-player-event', playerId: player.id, event });
                  }}
                  puzzleLabel={copy.puzzle}
                  selectedEvent={player.event}
                />
              </header>
              <TimingSurface
                ariaLabel={copy.battlePlayer(player.id + 1)}
                className="battle-player-timer"
                colorClass={localPlayerColor(player)}
                digits={<SegmentTime text={playerDisplay(player, nowMs, {
                  hideTime,
                  inspectionSec,
                  precision,
                  runningPrecision,
                })} />}
                fontSize="clamp(2.4rem, 11vw, 5.5rem)"
                interactive={player.scramble.length > 0}
                onContextMenu={(event) => event.preventDefault()}
                onPointerCancel={() => dispatch({
                  type: 'player-timer', playerId: player.id, action: { type: 'cancel-press' },
                })}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
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
                scrambleSlot={!scrambleHidden ? (
                  <TimerScrambleStrip
                    compact
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
                      ? () => dispatch({ type: 'request-next-scramble', event: player.event })
                      : undefined}
                    scramble={player.scramble}
                    title={scrambleFailed ? copy.retry : undefined}
                    verificationLabels={scrambleLabels(copy)}
                  />
                ) : undefined}
                surfaceRef={surfaceRefs[player.id]}
              />
              {result && (
                <div className="battle-penalties" data-no-timer>
                  {(['ok', '+2', 'dnf'] as const).map((penalty) => (
                    <button
                      aria-pressed={player.penalty === penalty}
                      key={penalty}
                      onClick={() => dispatch({ type: 'set-penalty', playerId: player.id, penalty })}
                      type="button"
                    >{penalty === 'dnf' ? copy.dnf : penalty.toUpperCase()}</button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {visiblePlayers.every((player) => player.result !== null) && (
        <p aria-live="polite" className="battle-round-status">{copy.battleAllFinished}</p>
      )}
      <div className="battle-local-tools" data-no-timer>
        {smartCube && (
          <details>
            <summary>{copy.battleSmartCube}</summary>
            <p>{copy.battleSharedCubeDetail}</p>
            <TimerDeviceActions
              active={smartCube.phase === 'connected'}
              connectAriaLabel={smartCube.phase === 'connected'
                ? copy.disconnectBluetooth
                : copy.connectBluetooth}
              connectLabel={smartCube.phase === 'connected'
                ? `${smartCube.deviceName}${smartCube.lastMove ? ` · ${smartCube.lastMove}` : ''}`
                : smartCube.phase === 'requesting' || smartCube.phase === 'connecting'
                  ? copy.connectingBluetooth
                  : copy.connect}
              onConnect={() => {
                if (smartCube.phase === 'connected') {
                  void smartCube.disconnect().catch(() => setStorageError(copy.smartCubeError));
                } else {
                  void smartCube.connect().catch(() => setStorageError(copy.smartCubeError));
                }
              }}
            />
            <div className="battle-cube-holders">
              {visiblePlayers.map((player) => (
                <button
                  aria-pressed={cubeHolder === player.id}
                  disabled={active || !timerSupportsLocalBattleSmartCube(player.event) || player.result !== null}
                  key={player.id}
                  onClick={() => setCubeHolder(player.id)}
                  type="button"
                >{copy.battleCubeHolder(player.id + 1)}</button>
              ))}
            </div>
            {visiblePlayers.some((player) => !timerSupportsLocalBattleSmartCube(player.event)) && (
              <small>{copy.battleSmartCubeOnly333}</small>
            )}
          </details>
        )}
        <details>
          <summary>{copy.battleKeyBindings}</summary>
          <div className="battle-key-grid">
            {visiblePlayers.map((player) => (
              <button
                aria-pressed={recordingPlayer === player.id}
                disabled={active}
                key={player.id}
                onClick={() => setRecordingPlayer((current) => current === player.id ? null : player.id)}
                type="button"
              >
                <span>{copy.battlePlayer(player.id + 1)}</span>
                <kbd>{recordingPlayer === player.id
                  ? copy.battlePressKey
                  : copy.battleKeyName(playerKeys[player.id] ?? '')}</kbd>
              </button>
            ))}
          </div>
        </details>
        <details>
          <summary>{copy.battleHistory}</summary>
          {rounds.length === 0 ? <p>{copy.battleNoHistory}</p> : (
            <>
              <div className="battle-summary-grid">
                {summaries.map((summary) => (
                  <div key={summary.playerId}>
                    <strong>{copy.battlePlayer(summary.playerId + 1)}</strong>
                    <span>{copy.battleAttempts(summary.attempts)}</span>
                    <span>{copy.battleWins(summary.wins)}</span>
                    <span>{copy.battleBest(summary.bestMs === null ? '—' : formatMs(summary.bestMs, precision))}</span>
                  </div>
                ))}
              </div>
              <ol className="battle-local-history">
                {[...rounds].reverse().slice(0, 20).map((round, index) => (
                  <li key={round.id}>
                    <span>{copy.battleRoundLabel(rounds.length - index)}</span>
                    <time dateTime={new Date(round.ts).toISOString()}>
                      {new Date(round.ts).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}
                    </time>
                    <span>{round.attempts.map(({ playerId, solve }) => (
                      `${copy.battlePlayer(playerId + 1)} ${solve.penalty === 'DNF'
                        ? copy.dnf
                        : solve.penalty === '+2'
                          ? `${formatMs(solve.timeMs + 2_000, precision)}+`
                          : formatMs(solve.timeMs, precision)}`
                    )).join(' · ')}</span>
                  </li>
                ))}
              </ol>
              <button
                className="battle-secondary-action"
                onClick={() => {
                  if (!window.confirm(copy.battleClearHistoryConfirm)) return;
                  roundsRef.current = [];
                  setRounds([]);
                  void roundStoreRef.current?.clear().catch(() => setStorageError(copy.actionFailed));
                }}
                type="button"
              >{copy.battleClearHistory}</button>
            </>
          )}
        </details>
      </div>
      {storageError && <p aria-live="assertive" className="battle-error">{storageError}</p>}
    </section>
  );
}

export interface NetBattleModeProps extends BattleModeBaseProps {
  accountIdentity?: NetIdentity;
  capability?: InstalledAppNetBattle;
  onSmartCubeHandlersChange?(handlers: BattleSmartCubeHandlers | null): void;
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

function netStatText(value: number | null, precision: 2 | 3): string {
  if (value === null) return '—';
  return Number.isFinite(value) ? formatMs(value, precision) : 'DNF';
}

/** Shared-contract online room host; no room DTO, scoring or transport is reimplemented here. */
export function NetBattleMode({
  accountIdentity,
  capability,
  copy,
  eventGroups,
  hideTime,
  holdMs,
  inspectionSec,
  language,
  onActivityChange,
  onModeChange,
  onSmartCubeHandlersChange,
  precision,
  runningPrecision,
  scramblePreviewSettings,
  smartCube,
  writeClipboardText,
}: NetBattleModeProps) {
  const [room, setRoom] = useState<NetRoomState | null>(null);
  const [credentials, setCredentials] = useState<NetBattleCredentials | null>(null);
  const [name, setName] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<WcaPersonLite | null>(null);
  const [accountPerson, setAccountPerson] = useState<WcaPersonLite | null>(null);
  const [personResults, setPersonResults] = useState<WcaPersonLite[]>([]);
  const [personSearching, setPersonSearching] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [roomActionTarget, setRoomActionTarget] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [lobbyEvent, setLobbyEvent] = useState<NetBattleEventId>('333');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [countdownMs, setCountdownMs] = useState<number | null>(null);
  const roomRef = useRef(room);
  const credentialsRef = useRef(credentials);
  const activeCodeRef = useRef<string | null>(null);
  const offsetRef = useRef<number | null>(null);
  const admissionGateRef = useRef(createNetAdmissionGate());
  const autoStartedRef = useRef<number | null>(null);
  const advanceBusyRef = useRef(false);
  const solvingRoundRef = useRef(0);
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

  useEffect(() => {
    if (accountIdentity || selectedPerson || name.trim().length < 2) {
      setPersonResults([]);
      setPersonSearching(false);
      return;
    }
    let cancelled = false;
    setPersonSearching(true);
    const timeout = window.setTimeout(() => {
      void searchWcaPersons(name, 6).then((people) => {
        if (!cancelled) setPersonResults(people);
      }).finally(() => {
        if (!cancelled) setPersonSearching(false);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [accountIdentity, name, selectedPerson]);

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
  const myResult = room && credentials
    ? room.results[String(room.round)]?.[credentials.playerId]
    : undefined;
  const event = room && credentials ? playerEventOf(room, credentials.playerId) : lobbyEvent;
  const scramble = room && credentials ? myScramble(room, credentials.playerId) ?? '' : '';

  const applyRoom = useCallback((incoming: NetRoomState) => {
    if (activeCodeRef.current !== incoming.code) return;
    offsetRef.current = blendClockOffset(offsetRef.current, incoming.now, Date.now());
    setRoom((current) => preferLatestNetRoomState(current, incoming));
  }, []);

  const fail = useCallback((reason: unknown) => {
    setError(netErrorMessage(reason)[language]);
  }, [language]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (copiedResetRef.current !== null) window.clearTimeout(copiedResetRef.current);
    };
  }, []);

  const onComplete = useCallback((result: SolveResult) => {
    const currentRoom = roomRef.current;
    const auth = credentialsRef.current;
    if (!capability || !currentRoom || !auth) return;
    const penalty: NetPenalty = result.autoPenalty === 'DNF'
      ? 'dnf'
      : result.autoPenalty === '+2' ? '+2' : 'ok';
    const round = solvingRoundRef.current || currentRoom.round;
    void capability.client.postNetResult(currentRoom.code, auth, round, result.timeMs, penalty)
      .then(applyRoom)
      .catch(() => capability.client.postNetResult(
        currentRoom.code,
        auth,
        round,
        result.timeMs,
        penalty,
      ).then(applyRoom).catch(fail));
  }, [applyRoom, capability, fail]);

  const timer = useTimerController({
    canStart: Boolean(room && credentials && scramble && !myResult),
    holdMs,
    inspectionSec,
    onComplete,
    onStart: () => {
      solvingRoundRef.current = roomRef.current?.round ?? 0;
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
      onMove(_move, timestamp, facelets) {
        if (!netSmartCubeSupported
          || gate.gated
          || countdownMs !== null
          || myResult
          || !inRoundRoster
          || !canManuallyStart) return;
        if (timer.startFromCube(timestamp)) {
          netTimerPhaseRef.current = 'running';
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
    let cancelled = false;
    const intent = admissionGateRef.current.beginBackground();
    if (intent === null) return;
    void capability.sessions.load().then(async (session) => {
      if (!session || cancelled || !admissionGateRef.current.isCurrent(intent)) return;
      const auth = { playerId: session.playerId, playerToken: session.playerToken };
      const restored = await capability.client.getNetRoom(session.code, auth);
      if (cancelled || !admissionGateRef.current.isCurrent(intent) || !restored.players[session.playerId]) return;
      activeCodeRef.current = restored.code;
      setName(session.name);
      setCredentials(auth);
      applyRoom(restored);
    }).catch(async () => {
      if (!cancelled) await capability.sessions.clear().catch(() => undefined);
    });
    return () => { cancelled = true; };
  }, [applyRoom, capability]);

  useEffect(() => {
    if (!capability || !room || !credentials) return;
    let stopped = false;
    let running = false;
    const tick = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        const next = await capability.client.getNetRoom(room.code, credentials);
        if (stopped) return;
        if (!next.players[credentials.playerId]) {
          activeCodeRef.current = null;
          setRoom(null);
          setCredentials(null);
          await capability.sessions.clear();
          return;
        }
        applyRoom(next);
      } catch (reason) {
        if (!stopped) fail(reason);
      } finally {
        running = false;
      }
    };
    const interval = window.setInterval(() => { void tick(); }, 1_000);
    const onVisible = () => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [applyRoom, capability, credentials, fail, room?.code]);

  useEffect(() => {
    if (!capability || !room || !credentials || scramble) return;
    void capability.client.ensureNetScramble(room.code, credentials, event)
      .then(applyRoom)
      .catch(fail);
  }, [applyRoom, capability, credentials, event, fail, room, scramble]);

  useEffect(() => {
    if (!capability || !room || !credentials) return;
    if (timerPhase === 'inspecting') {
      void capability.client.postNetStatus(room.code, credentials, 'inspecting').then(applyRoom).catch(() => undefined);
    } else if (timerPhase === 'running') {
      void capability.client.postNetStatus(room.code, credentials, 'solving').then(applyRoom).catch(() => undefined);
    }
  }, [applyRoom, capability, credentials, room?.code, timerPhase]);

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
      solvingRoundRef.current = room?.round ?? 0;
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
    const currentRoom = roomRef.current;
    const auth = credentialsRef.current;
    if (!capability || !currentRoom || !auth || advanceBusyRef.current) return;
    advanceBusyRef.current = true;
    void capability.client.nextNetRound(currentRoom.code, auth, currentRoom.round, force)
      .then(applyRoom)
      .catch(fail)
      .finally(() => { advanceBusyRef.current = false; });
  }, [applyRoom, capability, fail]);

  useEffect(() => {
    if (!room || !myResult || pendingCount(room) > 0) return;
    advanceRound(false);
  }, [advanceRound, myResult, room]);

  const adopt = useCallback(async (
    admission: { state: NetRoomState; credentials: NetBattleCredentials },
    identityName: string,
  ) => {
    if (!capability) return;
    activeCodeRef.current = admission.state.code;
    setCredentials(admission.credentials);
    applyRoom(admission.state);
    await capability.sessions.save({
      code: admission.state.code,
      name: identityName,
      ...admission.credentials,
    } satisfies NetBattleSession);
  }, [applyRoom, capability]);

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
      .catch(fail)
      .finally(() => {
        admissionGateRef.current.finish(intent);
        setBusy(false);
      });
  };

  const joinRoom = () => {
    if (!capability) return;
    const code = normalizeNetBattleRoomCode(joinCode);
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
    activeCodeRef.current = null;
    admissionGateRef.current.cancel();
    setRoom(null);
    setCredentials(null);
    setError('');
    setCountdownMs(null);
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
        <div className="battle-lobby" data-no-timer>
          <h2>{copy.battleOnlineTitle}</h2>
          <div className="battle-identity-field">
            <span>{copy.battleIdentity}</span>
            {accountIdentity ? (
              <div className="battle-person-choice">
                {identity.iso2 && <Flag className="battle-person-flag" iso2={identity.iso2} />}
                <strong>{displayCuberName(identity.name, language === 'zh')}</strong>
                {identity.wcaId && <small>{identity.wcaId}</small>}
              </div>
            ) : selectedPerson ? (
              <button
                className="battle-person-choice"
                disabled={busy}
                onClick={() => { setSelectedPerson(null); setName(''); }}
                type="button"
              >
                {selectedPerson.country_iso2 && <Flag className="battle-person-flag" iso2={selectedPerson.country_iso2} />}
                <strong>{displayCuberName(selectedPerson.name, language === 'zh')}</strong>
                <small>{selectedPerson.id} · {copy.clear}</small>
              </button>
            ) : (
              <>
                <input
                  autoComplete="nickname"
                  disabled={busy}
                  maxLength={40}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={copy.battleSearchIdentity}
                  value={name}
                />
                {personSearching && <small>{copy.battleSearchingIdentity}</small>}
                {personResults.length > 0 && (
                  <ul className="battle-person-results">
                    {personResults.map((person) => (
                      <li key={person.id}>
                        <button
                          onClick={() => {
                            setSelectedPerson(person);
                            setPersonResults([]);
                            setName('');
                          }}
                          type="button"
                        >
                          {person.country_iso2 && <Flag className="battle-person-flag" iso2={person.country_iso2} />}
                          <span>{displayCuberName(person.name, language === 'zh')}</span>
                          <small>{person.id}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <TimerPuzzlePicker
            dataNoTimer
            disabled={busy}
            groups={eventPickerGroups}
            onSelect={(selectorId) => {
              const next = selectorIdToNetEvent(selectorId);
              if (next) setLobbyEvent(next);
            }}
            puzzleLabel={copy.puzzle}
            selectedEvent={lobbyEvent}
          />
          <button className="battle-primary-action" disabled={busy} onClick={createRoom} type="button">
            {copy.battleCreateRoom}
          </button>
          <div className="battle-join-row">
            <label>
              <span>{copy.battleRoomCode}</span>
              <input
                disabled={busy}
                inputMode="numeric"
                maxLength={4}
                onChange={(event) => setJoinCode(normalizeNetBattleRoomCode(event.target.value))}
                placeholder={copy.battleRoomCodePlaceholder}
                value={joinCode}
              />
            </label>
            <button disabled={busy || !isNetBattleRoomCode(joinCode)} onClick={joinRoom} type="button">
              {copy.battleJoinRoom}
            </button>
          </div>
          {busy && <p aria-live="polite">{copy.battleLoadingRoom}</p>}
          {error && <p aria-live="assertive" className="battle-error">{error}</p>}
        </div>
      </section>
    );
  }

  const players = sortedNetPlayers(room.players);
  const currentResult = room.results[String(room.round)]?.[credentials.playerId];
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
  const historyRounds = roundViews(room);

  return (
    <section className="battle-mode battle-mode--net" aria-label={copy.battleOnlineTitle}>
      <TimerTopbar
        controls={(
          <TimerPlayersSelect
            ariaLabel={copy.onePlayer}
            disabled={active}
            onlineLabel={copy.online}
            onChange={changeMode}
            playerLabel={copy.players}
            value="net"
          />
        )}
        actions={(
          <button className="battle-leave" disabled={active} onClick={() => void leaveRoom()} type="button">
            {copy.battleLeaveRoom}
          </button>
        )}
      />
      <header className="battle-room-header" data-no-timer>
        <div>
          <span>{copy.battleCurrentRound(room.round)}</span>
          <button
            aria-label={copy.battleCopyCode}
            onClick={() => {
              void writeClipboardText(room.code).then(() => {
                if (!mountedRef.current) return;
                setCopied(true);
                if (copiedResetRef.current !== null) window.clearTimeout(copiedResetRef.current);
                copiedResetRef.current = window.setTimeout(() => setCopied(false), 1_500);
              }).catch((reason: unknown) => {
                if (mountedRef.current) fail(reason);
              });
            }}
            type="button"
          >{copy.battleRoomCode}: <strong>{room.code}</strong></button>
          {copied && <span aria-live="polite">{copy.battleInviteCopied}</span>}
          <button aria-label={copy.battleShowQr} onClick={() => setQrOpen(true)} type="button">
            {copy.battleShowQr}
          </button>
        </div>
        {isNetAdmin(room, credentials.playerId) && (
          <button
            aria-pressed={room.syncStart}
            disabled={active}
            onClick={() => {
              void capability.client.postNetSyncStart(
                room.code,
                credentials,
                !room.syncStart,
              ).then(applyRoom).catch(fail);
            }}
            type="button"
          >{copy.battleSyncStart}</button>
        )}
        {amAdmin && (
          <button
            aria-expanded={showAdmin}
            disabled={active}
            onClick={() => {
              setShowAdmin((current) => !current);
              setShowHistory(false);
            }}
            type="button"
          >{copy.battleAdmin}</button>
        )}
        <button
          aria-expanded={showHistory}
          onClick={() => {
            setShowHistory((current) => !current);
            setShowAdmin(false);
          }}
          type="button"
        >{copy.battleHistory}</button>
        {gate.gated && (
          <button
            aria-pressed={gate.ready}
            onClick={() => {
              const phase = gate.ready ? 'idle' : 'ready';
              void capability.client.postNetStatus(room.code, credentials, phase)
                .then(applyRoom)
                .catch(fail);
            }}
            type="button"
          >{copy.battleReady}{gate.waiting > 0 ? ` · ${gate.waiting}` : ''}</button>
        )}
      </header>
      {showAdmin && amAdmin && (
        <section className="battle-room-panel" data-no-timer>
          <h3>{copy.battleAdmin}</h3>
          <ul className="battle-admin-list">
            {players.filter((player) => player.id !== credentials.playerId).map((player) => {
              const displayName = displayCuberName(player.name, language === 'zh');
              return (
                <li key={player.id}>
                  <span>
                    {player.iso2 && <Flag className="battle-person-flag" iso2={player.iso2} />}
                    <strong>{displayName}</strong>
                    {player.wcaId && <small>{player.wcaId}</small>}
                  </span>
                  <span>
                    <button
                      disabled={roomActionTarget !== null}
                      onClick={() => {
                        if (!window.confirm(copy.battleTransferAdminConfirm(displayName))) return;
                        setRoomActionTarget(player.id);
                        void capability.client.postNetAdmin(room.code, credentials, player.id)
                          .then((nextRoom) => {
                            applyRoom(nextRoom);
                            setShowAdmin(false);
                          })
                          .catch(fail)
                          .finally(() => setRoomActionTarget(null));
                      }}
                      type="button"
                    >{copy.battleTransferAdmin}</button>
                    <button
                      disabled={roomActionTarget !== null}
                      onClick={() => {
                        if (!window.confirm(copy.battleKickConfirm(displayName))) return;
                        setRoomActionTarget(player.id);
                        void capability.client.postNetKick(room.code, credentials, player.id)
                          .then(applyRoom)
                          .catch(fail)
                          .finally(() => setRoomActionTarget(null));
                      }}
                      type="button"
                    >{copy.battleKick}</button>
                  </span>
                </li>
              );
            })}
          </ul>
          {players.length <= 1 && <p>{copy.battleNoOtherPlayers}</p>}
        </section>
      )}
      {showHistory && (
        <section className="battle-room-panel battle-history-panel" data-no-timer>
          <h3>{copy.battleHistory}</h3>
          <div className="battle-summary-grid">
            {players.map((player) => {
              const stats = playerStats(playerTimeline(room, player.id));
              return (
                <div key={player.id}>
                  <strong>
                    {player.iso2 && <Flag className="battle-person-flag" iso2={player.iso2} />}
                    {displayCuberName(player.name, language === 'zh')}
                  </strong>
                  <span>{copy.battleScore(room.scores[player.id] ?? 0)}</span>
                  <span>{copy.count}: {stats.count}</span>
                  <span>{copy.best}: {netStatText(stats.single, precision)}</span>
                  <span>{copy.mean}: {netStatText(stats.mean, precision)}</span>
                  <span>{copy.ao5}: {netStatText(stats.ao5, precision)}</span>
                </div>
              );
            })}
          </div>
          <ol className="battle-net-history">
            {historyRounds.map((round) => (
              <li key={`${round.round}-${round.live ? 'live' : 'past'}`}>
                <h4>
                  {copy.battleRoundLabel(round.round)}
                  {round.live && <small>{copy.battleLiveRound}</small>}
                </h4>
                <div className="battle-round-scrambles">
                  {Object.entries(round.scrambles).map(([roundEvent, roundScramble]) => (
                    <span key={roundEvent}><strong>{roundEvent}</strong> <code>{roundScramble}</code></span>
                  ))}
                </div>
                <ul>
                  {Object.entries(round.results).map(([playerId, result]) => {
                    const player = room.players[playerId];
                    return (
                      <li key={playerId}>
                        <span>{player
                          ? displayCuberName(player.name, language === 'zh')
                          : playerId}</span>
                        <strong>{netResultText(result.t, result.p, precision)}</strong>
                        {round.winners.includes(playerId) && <small>{copy.battleWinner}</small>}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}
      <div className="battle-net-layout">
        <div className="battle-net-timer">
          <TimerPuzzlePicker
            dataNoTimer
            disabled={active || Boolean(currentResult)}
            groups={eventPickerGroups}
            onSelect={(selectorId) => {
              const next = selectorIdToNetEvent(selectorId);
              if (!next || next === event) return;
              void capability.client.postNetEvent(room.code, credentials, next)
                .then((nextRoom) => {
                  timer.reset();
                  applyRoom(nextRoom);
                })
                .catch(fail);
            }}
            puzzleLabel={copy.puzzle}
            selectedEvent={event}
          />
          <TimingSurface
            ariaLabel={copy.timer}
            colorClass={colorClass}
            cornerSlot={scramblePreviewSettings.showCubePreview && scramble ? (
              <div className="mobile-cube-preview" data-no-timer>
                <TimerCubePreview
                  ariaLabel={copy.cubeState}
                  event={event}
                  fill
                  scramble={scramble}
                  visualization={scramblePreviewSettings.prefer3D ? '3D' : '2D'}
                />
              </div>
            ) : undefined}
            digits={<SegmentTime text={timerText} />}
            fontSize="clamp(4rem, 20vw, 8rem)"
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
                void capability.client.postNetStatus(room.code, credentials, phase)
                  .then(applyRoom)
                  .catch(fail);
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
              <TimerScrambleStrip
                compact
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
          />
          {smartCube && (
            <TimerDeviceActions
              active={smartCube.phase === 'connected'}
              connectAriaLabel={smartCube.phase === 'connected'
                ? copy.disconnectBluetooth
                : copy.connectBluetooth}
              connectLabel={smartCube.phase === 'connected'
                ? `${smartCube.deviceName}${smartCube.lastMove ? ` · ${smartCube.lastMove}` : ''}`
                : smartCube.phase === 'requesting' || smartCube.phase === 'connecting'
                  ? copy.connectingBluetooth
                  : copy.connect}
              onConnect={() => {
                if (smartCube.phase === 'connected') {
                  void smartCube.disconnect().catch(() => setError(copy.smartCubeError));
                } else {
                  void smartCube.connect().catch(() => setError(copy.smartCubeError));
                }
              }}
            />
          )}
          {currentResult && pendingCount(room) > 0 && (
            <div className="battle-penalties" data-no-timer>
              {(['ok', '+2', 'dnf'] as const).map((penalty) => (
                <button
                  aria-pressed={currentResult.p === penalty}
                  key={penalty}
                  onClick={() => {
                    void capability.client.postNetResult(
                      room.code,
                      credentials,
                      room.round,
                      currentResult.t,
                      penalty,
                    ).then(applyRoom).catch(fail);
                  }}
                  type="button"
                >{penalty === 'dnf' ? copy.dnf : penalty.toUpperCase()}</button>
              ))}
            </div>
          )}
          {currentResult && (
            <button
              className="battle-primary-action"
              onClick={() => advanceRound(true)}
              type="button"
            >{copy.battleSkipWaiting}</button>
          )}
        </div>
        <ol className="battle-player-list" data-no-timer>
          {players.map((player) => {
            const result = room.results[String(room.round)]?.[player.id];
            return (
              <li className={player.id === credentials.playerId ? 'is-me' : ''} key={player.id}>
                <span>
                  {player.iso2 && <Flag className="battle-person-flag" iso2={player.iso2} />}
                  <strong>{displayCuberName(player.name, language === 'zh')}</strong>
                  {player.id === credentials.playerId && <small>{copy.battleYou}</small>}
                </span>
                <span>{copy.battleScore(room.scores[player.id] ?? 0)}</span>
                <span>{isNetOnline(player, room.now) ? copy.battlePhase(player.ph) : copy.offline}</span>
                <strong>{result
                  ? netResultText(result.t, result.p, precision)
                  : player.ph === 'solving'
                    ? formatMs(Math.max(0, Date.now() + (offsetRef.current ?? 0) - player.at), 2)
                    : '—'}</strong>
              </li>
            );
          })}
        </ol>
      </div>
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
    </section>
  );
}
