'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { LiveSmartCubeAnchor, type Solve333, type LiveSmartCubeAnchorSnapshot } from '@cuberoot/shared/smart-cube/anchor';
import { SmartCubeStateTracker } from '@cuberoot/shared/smart-cube/cubie';
import { applyOrientation, type Quat, type OrientationOptions } from '@cuberoot/shared/smart-cube/orientation';
import {
  NET_BATTLE_LIVE_PROTOCOL_VERSION,
  parseNetBattleLiveServerPayload,
  type NetBattleCredentials,
  type NetBattleLiveClientPayload,
  type NetBattleLivePresencePlayer,
} from '@cuberoot/shared/timer';

export interface NetBattleLiveCubePlayer {
  playerId: string;
  connected: boolean;
  smart: boolean;
  syncing: boolean;
  round: number | null;
  seq: number;
  facelets: string | null;
  moves: readonly string[];
  algAnchored: boolean;
  updatedAt: number;
  /** Updated directly by the socket, read by the renderer's frame loop. */
  quatRef?: { current: Quat | null };
}

interface RemoteRuntime {
  round: number;
  tracker: SmartCubeStateTracker;
  anchor: LiveSmartCubeAnchor;
  quatRef: { current: Quat | null };
}

export interface UseNetBattleLiveCubeOptions {
  websocketUrl: string;
  solve: Solve333;
  code: string | null;
  credentials: NetBattleCredentials | null;
  round: number;
  localConnected: boolean;
  localFacelets: string | null;
}

const RECONNECT_MAX_MS = 5_000;
const GYRO_INTERVAL_MS = 20;

function emptyPlayer(playerId: string): NetBattleLiveCubePlayer {
  return {
    playerId,
    connected: false,
    smart: false,
    syncing: false,
    round: null,
    seq: 0,
    facelets: null,
    moves: [],
    algAnchored: false,
    updatedAt: 0,
  };
}

export function useNetBattleLiveCube({
  code,
  credentials,
  round,
  localConnected,
  localFacelets,
  websocketUrl, solve,
}: UseNetBattleLiveCubeOptions): {
  players: Record<string, NetBattleLiveCubePlayer>;
  ready: boolean;
  publishMove(move: string): void;
  publishGyro(quaternion: Quat | null, options?: OrientationOptions & { reference?: Quat | null }): void;
} {
  const [players, setPlayersState] = useState<Record<string, NetBattleLiveCubePlayer>>({});
  const [ready, setReady] = useState(false);
  const playersRef = useRef(players);
  const runtimesRef = useRef(new Map<string, RemoteRuntime>());
  const socketRef = useRef<WebSocket | null>(null);
  const socketReadyRef = useRef(false);
  const gyroReadyRef = useRef(false);
  const latestGyroRef = useRef<Quat | null>(null);
  const pendingGyroRef = useRef(false);
  const gyroTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGyroSentRef = useRef(-Infinity);
  const localTrackerRef = useRef(new SmartCubeStateTracker());
  const localSeededRef = useRef(false);
  const localRoundRef = useRef(round);
  const localSeqRef = useRef(0);
  const localConnectedRef = useRef(localConnected);
  const lastPublishedRef = useRef('');
  const credentialPlayerId = credentials?.playerId ?? null;
  const credentialPlayerToken = credentials?.playerToken ?? null;

  localConnectedRef.current = localConnected;

  const setPlayers = useCallback((update: (
    current: Record<string, NetBattleLiveCubePlayer>,
  ) => Record<string, NetBattleLiveCubePlayer>) => {
    // Socket packets may arrive in one React batch. Advance the wire state
    // synchronously so a following move/pose sees the preceding snapshot.
    const next = update(playersRef.current);
    playersRef.current = next;
    setPlayersState(next);
  }, []);

  const patchPlayer = useCallback((
    playerId: string,
    update: (current: NetBattleLiveCubePlayer) => NetBattleLiveCubePlayer,
  ) => {
    setPlayers((current) => ({
      ...current,
      [playerId]: update(current[playerId] ?? emptyPlayer(playerId)),
    }));
  }, [setPlayers]);

  const ensureRuntime = useCallback((playerId: string, playerRound: number): RemoteRuntime => {
    const current = runtimesRef.current.get(playerId);
    if (current && current.round === playerRound) return current;
    current?.anchor.setConnection(null);
    const runtime: RemoteRuntime = {
      round: playerRound,
      tracker: new SmartCubeStateTracker(),
      quatRef: { current: null },
      anchor: new LiveSmartCubeAnchor({
        solve,
        onChange: (snapshot: LiveSmartCubeAnchorSnapshot) => {
          patchPlayer(playerId, (player) => ({
            ...player,
            moves: [...snapshot.moves],
            algAnchored: snapshot.algAnchored,
          }));
        },
      }),
    };
    runtime.anchor.setConnection(`${code ?? 'room'}:${playerId}:${playerRound}`);
    runtimesRef.current.set(playerId, runtime);
    return runtime;
  }, [code, patchPlayer, solve]);

  const send = useCallback((payload: NetBattleLiveClientPayload): boolean => {
    const socket = socketRef.current;
    if (!socketReadyRef.current || !socket || socket.readyState !== WebSocket.OPEN) return false;
    try {
      socket.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }, []);

  const cancelGyro = useCallback(() => {
    if (gyroTimerRef.current !== null) clearTimeout(gyroTimerRef.current);
    gyroTimerRef.current = null;
    pendingGyroRef.current = false;
    lastGyroSentRef.current = -Infinity;
  }, []);

  const flushGyro = useCallback(function flush(): void {
    gyroTimerRef.current = null;
    if (!pendingGyroRef.current || !gyroReadyRef.current || !localConnectedRef.current || !localSeededRef.current) return;
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const remaining = GYRO_INTERVAL_MS - (performance.now() - lastGyroSentRef.current);
    if (remaining > 0 || socket.bufferedAmount > 0) {
      gyroTimerRef.current = setTimeout(flush, Math.max(1, remaining, socket.bufferedAmount > 0 ? GYRO_INTERVAL_MS : 0));
      return;
    }
    if (send({ type: 'gyro', round: localRoundRef.current, quaternion: latestGyroRef.current })) {
      pendingGyroRef.current = false;
      lastGyroSentRef.current = performance.now();
    }
  }, [send]);

  const publishGyro = useCallback((raw: Quat | null, options: OrientationOptions & { reference?: Quat | null } = {}) => {
    if (raw && (![raw.w, raw.x, raw.y, raw.z].every(Number.isFinite)
      || Math.hypot(raw.w, raw.x, raw.y, raw.z) < 1e-6)) return;
    // Normalize once at the sender. Remote renderers use identity basis and
    // never apply their own cube brand's sensor transform a second time.
    const q = raw ? applyOrientation(raw, options.reference ?? null, options) : null;
    latestGyroRef.current = q ? {
      w: +q.w.toFixed(5), x: +q.x.toFixed(5), y: +q.y.toFixed(5), z: +q.z.toFixed(5),
    } : null;
    pendingGyroRef.current = true;
    if (gyroTimerRef.current === null) flushGyro();
  }, [flushGyro]);

  const publishCurrent = useCallback((force = false): void => {
    const playerRound = localRoundRef.current;
    if (!localConnectedRef.current || !localSeededRef.current) {
      const key = `unavailable:${playerRound}`;
      if (force || lastPublishedRef.current !== key) {
        if (send({ type: 'unavailable', round: playerRound })) lastPublishedRef.current = key;
      }
      return;
    }
    const facelets = localTrackerRef.current.getFacelets();
    const key = `snapshot:${playerRound}:${localSeqRef.current}:${facelets}`;
    if (!force && lastPublishedRef.current === key) return;
    if (send({
      type: 'snapshot',
      round: playerRound,
      seq: localSeqRef.current,
      facelets,
    })) {
      lastPublishedRef.current = key;
      pendingGyroRef.current = true;
      if (gyroTimerRef.current === null) flushGyro();
    }
  }, [send, flushGyro]);

  useEffect(() => {
    const roundChanged = localRoundRef.current !== round;
    if (roundChanged) {
      cancelGyro();
      localRoundRef.current = round;
      localSeqRef.current = 0;
      localSeededRef.current = false;
      lastPublishedRef.current = '';
    }
    if (!localConnected || !localFacelets) {
      cancelGyro();
      latestGyroRef.current = null;
      localSeededRef.current = false;
      publishCurrent();
      return;
    }
    const tracker = localTrackerRef.current;
    if (!localSeededRef.current || tracker.getFacelets() !== localFacelets) {
      localSeededRef.current = tracker.adoptFacelets(localFacelets);
      if (!localSeededRef.current) return;
      publishCurrent();
    } else if (roundChanged) {
      publishCurrent();
    }
  }, [round, localConnected, localFacelets, publishCurrent, cancelGyro]);

  const publishMove = useCallback((move: string): void => {
    if (!localConnectedRef.current || !localSeededRef.current) return;
    localTrackerRef.current.applyMove(move);
    const seq = ++localSeqRef.current;
    const payload: NetBattleLiveClientPayload = {
      type: 'move',
      round: localRoundRef.current,
      seq,
      move,
    };
    if (send(payload)) {
      lastPublishedRef.current = `move:${localRoundRef.current}:${seq}`;
    }
  }, [send]);

  const applyPresence = useCallback((presence: NetBattleLivePresencePlayer[]): void => {
    const byId = new Map(presence.map((player) => [player.playerId, player]));
    setPlayers((current) => {
      const next = { ...current };
      for (const [playerId, state] of Object.entries(next)) {
        const status = byId.get(playerId);
        if (!status?.connected || !status.smart || status.round !== state.round) {
          if (state.quatRef) state.quatRef.current = null;
        }
        next[playerId] = status
          ? {
              ...state,
              connected: status.connected,
              smart: status.smart,
              syncing: status.smart && state.round !== status.round,
              round: status.round ?? state.round,
            }
          : { ...state, connected: false, smart: false };
      }
      for (const status of presence) {
        if (next[status.playerId]) continue;
        next[status.playerId] = {
          ...emptyPlayer(status.playerId),
          connected: status.connected,
          smart: status.smart,
          round: status.round,
          syncing: status.smart,
        };
      }
      return next;
    });
  }, [setPlayers]);

  useEffect(() => {
    if (!code || !credentialPlayerId || !credentialPlayerToken) return;
    let active = true;
    let reconnectAttempt = 0;
    let reconnectTimer: number | null = null;

    const markDisconnected = () => {
      gyroReadyRef.current = false;
      cancelGyro();
      for (const runtime of runtimesRef.current.values()) runtime.quatRef.current = null;
      socketReadyRef.current = false;
      setReady(false);
      setPlayers((current) => Object.fromEntries(
        Object.entries(current).map(([playerId, state]) => [
          playerId,
          { ...state, connected: false, smart: false },
        ]),
      ));
    };

    const connect = (): void => {
      if (!active) return;
      const socket = new WebSocket(websocketUrl);
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        if (!active || socketRef.current !== socket) return;
        socket.send(JSON.stringify({
          type: 'hello',
          version: NET_BATTLE_LIVE_PROTOCOL_VERSION,
          code,
          playerId: credentialPlayerId,
          playerToken: credentialPlayerToken,
          gyro: true,
        }));
      });

      socket.addEventListener('message', (event) => {
        if (!active || socketRef.current !== socket || typeof event.data !== 'string') return;
        let raw: unknown;
        try {
          raw = JSON.parse(event.data) as unknown;
        } catch {
          return;
        }
        const message = parseNetBattleLiveServerPayload(raw);
        if (!message) return;
        if (message.type === 'ready') {
          reconnectAttempt = 0;
          socketReadyRef.current = true;
          gyroReadyRef.current = message.gyro === true;
          setReady(true);
          publishCurrent(true);
          return;
        }
        if (message.type === 'presence') {
          applyPresence(message.players);
          return;
        }
        if (message.type === 'resync') {
          if (message.round === localRoundRef.current) publishCurrent(true);
          return;
        }
        if (message.playerId === credentialPlayerId) return;
        if (message.type === 'gyro') {
          const runtime = runtimesRef.current.get(message.playerId);
          if (runtime?.round === message.round) {
            const availabilityChanged = Boolean(runtime.quatRef.current) !== Boolean(message.quaternion);
            runtime.quatRef.current = message.quaternion;
            // Only mount/unmount orientation mode; samples never render React.
            if (availabilityChanged) patchPlayer(message.playerId, player => ({ ...player, quatRef: runtime.quatRef }));
          }
          return;
        }
        if (message.type === 'snapshot') {
          const runtime = ensureRuntime(message.playerId, message.round);
          if (!runtime.tracker.adoptFacelets(message.facelets)) return;
          patchPlayer(message.playerId, (player) => ({
            ...player,
            connected: true,
            round: message.round,
            seq: message.seq,
            facelets: message.facelets,
            smart: player.smart,
            syncing: false,
            updatedAt: message.updatedAt,
            quatRef: runtime.quatRef,
          }));
          runtime.anchor.observeFacelets(message.facelets);
          return;
        }
        const current = playersRef.current[message.playerId];
        const runtime = runtimesRef.current.get(message.playerId);
        if (!current
          || !runtime
          || runtime.round !== message.round
          || current.round !== message.round
          || message.seq !== current.seq + 1) {
          socket.close(1012, 'live state gap');
          return;
        }
        runtime.tracker.applyMove(message.move);
        runtime.anchor.move(message.move);
        patchPlayer(message.playerId, (player) => ({
          ...player,
          seq: message.seq,
          facelets: runtime.tracker.getFacelets(),
          syncing: false,
          updatedAt: message.updatedAt,
        }));
      });

      socket.addEventListener('close', (event) => {
        if (socketRef.current === socket) socketRef.current = null;
        if (!active) return;
        markDisconnected();
        if (event.code === 1008 || event.code === 4000 || event.code === 4001) return;
        const delay = Math.min(RECONNECT_MAX_MS, 500 * 2 ** reconnectAttempt++);
        reconnectTimer = window.setTimeout(connect, delay);
      });

      socket.addEventListener('error', () => {
        if (socket.readyState === WebSocket.OPEN) socket.close(1011, 'live transport error');
      });
    };

    connect();
    return () => {
      active = false;
      gyroReadyRef.current = false;
      cancelGyro();
      latestGyroRef.current = null;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      socketReadyRef.current = false;
      setReady(false);
      if (socketRef.current) {
        socketRef.current.close(1000, 'room changed');
        socketRef.current = null;
      }
      for (const runtime of runtimesRef.current.values()) runtime.anchor.setConnection(null);
      runtimesRef.current.clear();
      playersRef.current = {};
      setPlayersState({});
    };
  }, [
    websocketUrl,
    code,
    credentialPlayerId,
    credentialPlayerToken,
    applyPresence,
    ensureRuntime,
    patchPlayer,
    publishCurrent,
    setPlayers,
    cancelGyro,
  ]);

  return { players, ready, publishMove, publishGyro };
}
