import type { TimerHttpFetch } from '@cuberoot/shared/timer/http';
import { defaultLocalBattlePreferences } from '@cuberoot/shared/timer/local-battle-settings';
import {
  blendClockOffset, canManuallyStartNetAttempt, createNetAdmissionGate, createNetBattleClient,
  createNetBattleSessionStore, formatNetHistoryResult, isNetAdmin, isNetBattleEventId, isNetBattleRoomCode,
  isNetOnline, isNetRoundParticipant, isRoundComplete, myScramble, netErrorMessage,
  normalizeNetBattleRoomCode, pendingCount, playerEventOf, roundWinners, sortedNetPlayers, syncGate,
  type NetBattleAdmission, type NetBattleClient, type NetBattleCredentials,
  type NetBattleEventId, type NetBattleSessionStore, type NetIdentity, type NetPenalty, type NetPhase,
  type NetResult, type NetRoomState,
} from '@cuberoot/shared/timer/net-battle';
import {
  NetRoomController, netRoomGoneReason, restoreNetRoomSession, startNetRoomPolling, startNetRoomRestore,
} from '@cuberoot/shared/timer/net-room-controller';
import { NetBattleAttemptRecorder, netAttemptSolveId, type NetRecordedAttempt } from '@cuberoot/shared/timer/net-attempt';
import { initialTimerMachineState, transitionTimer, type TimerMachineAction } from '@cuberoot/shared/timer/machine';
import { formatTimerTimingDisplay } from '@cuberoot/shared/timer/timing-display';
import { formatMs } from '@cuberoot/shared/timer/stats';
import { ApiError, getStoredSession, requestJson } from './auth';
import { tr } from './i18n';
import { miniProgramApi } from './platform';

export function createNativeNetBattleClient(fetcher?: TimerHttpFetch): NetBattleClient {
  return createNetBattleClient({
    apiUrl(path) {
      if (!/^\/v1\/battle\/rooms(?:[/?]|$)/.test(path)) throw new Error('Invalid battle service path');
      return path.slice(3); // requestJson already owns the /v1 API prefix.
    },
    fetcher: fetcher ?? (async (path, init) => {
      try {
        const data = await requestJson(path, {
          method: init?.method, headers: init?.headers, signal: init?.signal,
          body: init?.body ? JSON.parse(init.body) : undefined, token: getStoredSession()?.token,
        });
        return { ok: true, status: 200, json: async () => data };
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        return { ok: false, status: error.status, json: async () => ({ error: error.message }) };
      }
    }),
  });
}

function nativeRoomSessions(): NetBattleSessionStore {
  return createNetBattleSessionStore({
    getItem(key) {
      const api = miniProgramApi();
      const keys = api.getStorageInfoSync?.().keys;
      if (keys && !keys.includes(key)) return null;
      const value = api.getStorageSync(key);
      return typeof value === 'string' ? value : null;
    },
    setItem: (key, value) => miniProgramApi().setStorageSync(key, value),
    removeItem: key => miniProgramApi().removeStorageSync(key),
  });
}

interface NativeNetRoomSettings {
  holdMs: number;
  inspectionSec: number;
  precision: 0 | 1 | 2 | 3;
  runningPrecision?: 0 | 1 | 2 | 3;
  hideTime: boolean;
}
export interface NativeTimerNetRoomOptions {
  client?: NetBattleClient;
  sessions?: NetBattleSessionStore;
  settings?(): Partial<NativeNetRoomSettings>;
  onChange?(): void;
  now?(): number;
  wallNow?(): number;
  sessionId?(): string;
  onRecordSolve?(record: NetRecordedAttempt): void | Promise<void>;
  restoreOnMount?: boolean;
}

interface PendingResult { round: number; value: NetResult }

/** Native touch and transport host for the shared online room lifecycle. */
export function createNativeTimerNetRoom(options: NativeTimerNetRoomOptions = {}) {
  const client = options.client ?? createNativeNetBattleClient();
  const sessions = options.sessions ?? nativeRoomSessions();
  const roomController = new NetRoomController();
  const admission = createNetAdmissionGate();
  const attempt = new NetBattleAttemptRecorder();
  const defaults = defaultLocalBattlePreferences();
  const settings = () => ({ ...defaults, ...options.settings?.() });
  const now = options.now ?? Date.now;
  const wallNow = options.wallNow ?? now;
  let room: NetRoomState | null = null;
  let credentials: NetBattleCredentials | null = null;
  let timer = initialTimerMachineState();
  let visible = true, disposed = false, busy = false, restoring = false, submitting = false;
  let error = '';
  let offset: number | null = null, startedAt: number | null = null, countdownMs: number | null = null;
  let hold: ReturnType<typeof setTimeout> | undefined, countdown: ReturnType<typeof setInterval> | undefined;
  let touch: number | undefined;
  let pending: PendingResult | null = null;
  let stopRestore = () => {}, stopPolling = () => {}, wakePolling = () => {};
  let statusQueue: Promise<boolean> = Promise.resolve(false);

  const notify = () => { if (!disposed) options.onChange?.(); };
  const fail = (reason: unknown) => { error = tr(netErrorMessage(reason)); notify(); };
  const id = () => credentials?.playerId ?? null;
  const result = () => room && id() ? pending?.round === room.round ? pending.value : room.results[String(room.round)]?.[id()!] : undefined;
  const currentScramble = () => room && id() ? myScramble(room, id()!) ?? '' : '';
  const isTiming = () => timer.phase === 'running';
  const active = () => Boolean(countdownMs !== null || isTiming() || timer.phase === 'inspecting' || timer.phase === 'holding' || timer.phase === 'ready');
  const manual = () => !!(visible && room && !result() && currentScramble() && canManuallyStartNetAttempt(room, id()));
  const gate = () => room ? syncGate(room, id()) : { gated: false, ready: false, waiting: 0 };

  function clearHold() { clearTimeout(hold); hold = undefined; }
  function clearCountdown() { clearInterval(countdown); countdown = undefined; countdownMs = null; }
  function resetTiming() {
    clearHold(); clearCountdown();
    timer = initialTimerMachineState();
    touch = undefined;
    startedAt = null;
    pending = null;
    submitting = false;
    attempt.reset();
  }

  function postStatus(phase: Exclude<NetPhase, 'done'>, quiet = false): Promise<boolean> {
    const owner = credentials;
    const operation = statusQueue.then(() => owner && owner === credentials
      ? roomController.execute(({ code, auth }) => client.postNetStatus(code, auth, phase), { quiet }) : false);
    statusQueue = operation.catch(() => false);
    return statusQueue;
  }

  async function submit(next: PendingResult): Promise<boolean> {
    if (!credentials || !room || submitting || next.round !== room.round) return false;
    const owner = credentials;
    pending = next;
    submitting = true;
    error = '';
    notify();
    await statusQueue;
    if (credentials !== owner || pending !== next) return false;
    const accepted = await roomController.submitResult(next.round, ({ code, auth }) =>
      client.postNetResult(code, auth, next.round, next.value.t, next.value.p), next.value);
    if (credentials === owner && pending === next) {
      submitting = false;
      if (accepted) pending = null;
      notify();
    }
    return accepted;
  }

  function persist(record: NetRecordedAttempt | null) {
    if (record && options.onRecordSolve) {
      void Promise.resolve().then(() => options.onRecordSolve!(record)).catch(fail);
    }
  }

  function dispatch(action: TimerMachineAction): boolean {
    if (!room || !credentials || disposed) return false;
    const before = timer;
    const changed = transitionTimer(before, action, settings());
    if (changed.accepted === false || changed.state === before) return false;
    timer = changed.state;
    if (changed.effects.includes('hold-cancelled') || changed.effects.includes('run-started')) clearHold();
    if (changed.effects.includes('hold-started')) {
      clearHold();
      hold = setTimeout(() => { hold = undefined; dispatch({ type: 'hold-ready' }); }, settings().holdMs);
    }
    if (timer.phase === 'inspecting' && before.phase !== 'inspecting') void postStatus('inspecting', true);
    if (changed.effects.includes('run-started')) {
      const identity = { code: room.code, playerId: credentials.playerId, round: room.round };
      attempt.begin({ ...identity, sessionId: options.sessionId?.() ?? '', id: netAttemptSolveId(identity), ts: wallNow(),
        event: playerEventOf(room, credentials.playerId), scramble: currentScramble() }, timer.startedAtMs ?? now());
      void postStatus('solving', true);
    }
    if (changed.solve) {
      const finished = attempt.finish(changed.solve);
      if (finished) {
        persist(finished.record);
        void submit({ round: finished.context.round, value: {
          t: changed.solve.timeMs, p: changed.solve.autoPenalty === 'DNF' ? 'dnf' : changed.solve.autoPenalty,
        } });
      }
    }
    notify();
    return true;
  }

  function tickCountdown() {
    const at = room?.startAt ?? null;
    if (!visible || !room || at === null || startedAt === at || result()
      || !isNetRoundParticipant(room, id()) || !currentScramble()) {
      clearCountdown();
      return;
    }
    const left = at - (wallNow() + (offset ?? 0));
    if (left > 0) {
      countdownMs = left;
      countdown ??= setInterval(() => { tickCountdown(); notify(); }, 50);
      return;
    }
    clearCountdown();
    startedAt = at;
    if (!isTiming()) dispatch({ type: 'start-now', nowMs: now(), elapsedMs: Math.max(0, -left) });
  }

  roomController.callbacks = {
    onState(next) {
      const previous = room;
      room = next;
      offset = blendClockOffset(offset, next.now, wallNow());
      if (previous && next.round > previous.round && (timer.phase === 'idle' || timer.phase === 'stopped')) resetTiming();
      if (credentials && !currentScramble()) {
        const event = playerEventOf(next, credentials.playerId);
        void roomController.ensure(event, ({ code, auth }) => client.ensureNetScramble(code, auth, event));
      }
      tickCountdown();
      notify();
    },
    onError: fail,
    onGone(reason) {
      detach();
      void sessions.clear().catch(() => undefined);
      fail(new Error(reason));
    },
    isTiming,
  };

  function detach() {
    admission.cancel(); stopRestore(); stopPolling(); roomController.deactivate();
    resetTiming();
    room = null; credentials = null; offset = null;
    busy = false; restoring = false;
    statusQueue = Promise.resolve(false);
  }

  function adopt(value: NetBattleAdmission) {
    error = ''; restoring = false; credentials = value.credentials;
    roomController.activate(value.state, value.credentials);
    if (!credentials || !room) return;
    stopPolling();
    stopPolling = startNetRoomPolling(roomController, client.getNetRoom, {
      visible: () => visible,
      subscribeWake(wake) { wakePolling = wake; return () => { wakePolling = () => {}; }; },
    });
  }

  function restore() {
    if (disposed || room) return;
    stopRestore();
    const intent = admission.beginBackground();
    if (intent === null) return;
    restoring = true;
    notify();
    stopRestore = startNetRoomRestore({
      current: () => !disposed && admission.isCurrent(intent),
      load: sessions.load, clear: sessions.clear, getRoom: client.getNetRoom,
      restored(session, state) { adopt({ credentials: { playerId: session.playerId, playerToken: session.playerToken }, state }); },
      missing() { restoring = false; notify(); },
      error(reason) { restoring = false; fail(reason); },
    });
  }

  function identity(partial?: Partial<NetIdentity>): NetIdentity {
    let user: ReturnType<typeof getStoredSession> = null;
    try { user = getStoredSession(); } catch { /* A guest can still join with a display name. */ }
    return { name: partial?.name?.trim() || user?.user.name || tr({ zh: '玩家', en: 'Player' }),
      wcaId: partial?.wcaId ?? user?.user.wcaId ?? undefined, iso2: partial?.iso2 };
  }

  async function admit(request: () => Promise<NetBattleAdmission>, name: string, rejoinCode?: string) {
    if (disposed || room) return false;
    const intent = admission.beginExclusive();
    if (intent === null) return false;
    stopRestore(); restoring = false; busy = true; error = ''; notify();
    try {
      if (rejoinCode) {
        const saved = await sessions.load();
        if (!admission.isCurrent(intent)) return false;
        if (saved?.code === rejoinCode) {
          try {
            const state = await restoreNetRoomSession(saved, client.getNetRoom);
            if (!admission.isCurrent(intent)) return false;
            adopt({ state, credentials: { playerId: saved.playerId, playerToken: saved.playerToken } });
            return true;
          } catch (reason) {
            if (!admission.isCurrent(intent)) return false;
            if (!netRoomGoneReason(reason)) throw reason;
            await sessions.clear();
          }
        }
      }
      if (!admission.isCurrent(intent)) return false;
      const value = await request();
      if (!admission.isCurrent(intent)) {
        await client.leaveNetRoom(value.state.code, value.credentials).catch(() => undefined);
        return false;
      }
      adopt(value);
      if (room) await sessions.save({ code: value.state.code, name, ...value.credentials });
      return !!room;
    } catch (reason) {
      if (admission.isCurrent(intent)) fail(reason);
      return false;
    } finally {
      if (admission.finish(intent)) { busy = false; notify(); }
    }
  }

  function toggleReady() {
    const own = gate();
    if (!visible || !own.gated || !currentScramble() || isTiming()) return Promise.resolve(false);
    return postStatus(own.ready ? 'idle' : 'ready');
  }

  function releaseTouch(touchId: number, cancel: boolean) {
    if (touch !== touchId) return false;
    touch = undefined;
    if (cancel || !visible) return dispatch({ type: 'cancel-press' });
    return (manual() || isTiming()) && dispatch({ type: 'press-up', nowMs: now() });
  }

  function snapshot() {
    const clock = now(), display = settings(), own = id(), currentResult = result();
    const serverNow = wallNow() + (offset ?? 0);
    const results = room?.results[String(room.round)];
    const formatted = (entry: NetResult) => formatNetHistoryResult(entry, display.precision);
    const text = countdownMs !== null ? String(Math.max(1, Math.ceil(countdownMs / 1000)))
      : currentResult ? formatted(currentResult)
        : formatTimerTimingDisplay({ ...display, timingEnabled: true, phase: timer.phase, lastPenalty: null,
            runningPrecision: display.runningPrecision ?? display.precision,
            displayMs: timer.startedAtMs === null ? timer.lastMs ?? 0 : Math.max(0, clock - timer.startedAtMs),
            inspectionDisplayMs: timer.inspectionStartedAtMs === null ? 0 : Math.max(0, clock - timer.inspectionStartedAtMs),
            inspectionLimitSec: timer.inspectionSec ?? display.inspectionSec });
    const players = room ? sortedNetPlayers(room.players).map(player => ({
      ...player, me: player.id === own, admin: isNetAdmin(room!, player.id),
      online: isNetOnline(player, serverNow), result: results?.[player.id] ?? null,
      display: results?.[player.id] ? formatted(results[player.id])
        : player.ph === 'solving' ? formatMs(Math.max(0, serverNow - player.at), display.runningPrecision ?? display.precision) : '',
    })) : [];
    return { room, playerId: own, players, event: room ? playerEventOf(room, own ?? '') : null,
      scramble: currentScramble(), display: text, phase: timer.phase, gate: gate(), active: active(), countdownMs,
      result: currentResult ?? null, resultPending: !!pending, submitting, busy, restoring, error,
      admin: !!room && isNetAdmin(room, own), roundComplete: !!room && isRoundComplete(room),
      pendingPlayers: room ? pendingCount(room) : 0, winners: room ? roundWinners(results, room.players) : [],
      canStart: manual(), advancing: roomController.isAdvancing };
  }

  if (options.restoreOnMount !== false) void Promise.resolve().then(restore);
  return {
    snapshot, restore, toggleReady,
    create(event: NetBattleEventId, person?: Partial<NetIdentity>) {
      if (!isNetBattleEventId(event)) return Promise.resolve(false);
      const own = identity(person);
      return admit(() => client.createNetRoom(event, own), own.name);
    },
    join(rawCode: string, person?: Partial<NetIdentity>) {
      const code = normalizeNetBattleRoomCode(rawCode);
      if (!isNetBattleRoomCode(code)) { fail(new Error('invalid battle room code')); return Promise.resolve(false); }
      const own = identity(person);
      return admit(() => client.joinNetRoom(code, own), own.name, code);
    },
    async leave() {
      const previous = room, owner = credentials;
      detach(); error = ''; notify();
      await sessions.clear().catch(fail);
      if (previous && owner) await client.leaveNetRoom(previous.code, owner).catch(() => undefined);
    },
    setVisible(next: boolean) {
      visible = next;
      if (!next && touch !== undefined) releaseTouch(touch, true);
      if (next) wakePolling();
      tickCountdown();
      notify();
    },
    poll: () => roomController.poll(client.getNetRoom),
    down(touchId = 0) {
      if (!visible || !room || result() || touch !== undefined) return false;
      if (gate().gated && !isTiming()) { void toggleReady(); return true; }
      if (!manual() && !isTiming()) return false;
      touch = touchId;
      const accepted = dispatch({ type: 'press-down', nowMs: now() });
      if (!accepted) touch = undefined;
      return accepted;
    },
    up: (touchId = 0) => releaseTouch(touchId, false),
    cancel: (touchId = 0) => releaseTouch(touchId, true),
    setEvent(event: NetBattleEventId) {
      if (active() || result() || !isNetBattleEventId(event)) return Promise.resolve(false);
      return roomController.execute(({ code, auth }) => client.postNetEvent(code, auth, event), { onSuccess: resetTiming });
    },
    setSyncStart: (on: boolean) => roomController.execute(({ code, auth }) => client.postNetSyncStart(code, auth, on)),
    setPenalty(penalty: NetPenalty) {
      const entry = result();
      if (!room || !credentials || !entry || submitting) return Promise.resolve(false);
      const identity = { code: room.code, playerId: credentials.playerId, round: room.round };
      const context = { ...identity, id: netAttemptSolveId(identity), ts: wallNow(), sessionId: options.sessionId?.() ?? '',
        event: playerEventOf(room, credentials.playerId), scramble: currentScramble() };
      persist(attempt.penalty(identity, penalty) ?? {
        context, solve: { id: context.id, ts: context.ts, event: context.event, scramble: context.scramble,
          timeMs: entry.t, penalty: penalty === 'dnf' ? 'DNF' : penalty },
      });
      return submit({ round: room.round, value: { t: entry.t, p: penalty } });
    },
    retryResult: () => pending ? submit(pending) : Promise.resolve(false),
    async next(force = false) {
      if (active() || submitting || pending) return;
      await roomController.advance(client.nextNetRound, force);
      notify();
    },
    rename(person: Partial<NetIdentity>) {
      const own = identity(person);
      return roomController.execute(({ code, auth }) => client.renameNetPlayer(code, auth, own));
    },
    kick: (playerId: string) => roomController.execute(({ code, auth }) => client.postNetKick(code, auth, playerId)),
    transferAdmin: (playerId: string) => roomController.execute(({ code, auth }) => client.postNetAdmin(code, auth, playerId)),
    dispose() { detach(); disposed = true; },
  };
}

export type NativeTimerNetRoom = ReturnType<typeof createNativeTimerNetRoom>;
