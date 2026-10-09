'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { LiveSmartCubeAnchor, type LiveSmartCubeAnchorSnapshot } from '@cuberoot/shared/smart-cube/anchor';
import { SmartCubeStateTracker } from '@cuberoot/shared/smart-cube/cubie';
import {
  NET_BATTLE_LIVE_PATH,
  NET_BATTLE_LIVE_PROTOCOL_VERSION,
  parseNetBattleLiveServerPayload,
  type NetBattleCredentials,
  type NetBattleLiveClientPayload,
  type NetBattleLivePresencePlayer,
} from '@cuberoot/shared/timer';
import { websocketApiUrl } from '@/lib/api-base';

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
}

interface RemoteRuntime {
  round: number;
  tracker: SmartCubeStateTracker;
  anchor: LiveSmartCubeAnchor;
}

interface UseNetBattleLiveCubeOptions {
  code: string | null;
  credentials: NetBattleCredentials | null;
  round: number;
  localConnected: boolean;
  localFacelets: string | null;
}

const RECONNECT_MAX_MS = 5_000;

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
}: UseNetBattleLiveCubeOptions): {
  players: Record<string, NetBattleLiveCubePlayer>;
  ready: boolean;
  publishMove(move: string): void;
} {
  const [players, setPlayersState] = useState<Record<string, NetBattleLiveCubePlayer>>({});
  const [ready, setReady] = useState(false);
  const playersRef = useRef(players);
  const runtimesRef = useRef(new Map<string, RemoteRuntime>());
  const socketRef = useRef<WebSocket | null>(null);
  const socketReadyRef = useRef(false);
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
    setPlayersState((current) => {
      const next = update(current);
      playersRef.current = next;
      return next;
    });
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
      anchor: new LiveSmartCubeAnchor({
        solve: async (state) => {
          const { solve333 } = await import('./scramble/kociemba/random_state');
          return solve333(state);
        },
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
  }, [code, patchPlayer]);

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
    })) lastPublishedRef.current = key;
  }, [send]);

  useEffect(() => {
    const roundChanged = localRoundRef.current !== round;
    if (roundChanged) {
      localRoundRef.current = round;
      localSeqRef.current = 0;
      localSeededRef.current = false;
      lastPublishedRef.current = '';
    }
    if (!localConnected || !localFacelets) {
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
  }, [round, localConnected, localFacelets, publishCurrent]);

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
      const socket = new WebSocket(websocketApiUrl(NET_BATTLE_LIVE_PATH));
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        if (!active || socketRef.current !== socket) return;
        socket.send(JSON.stringify({
          type: 'hello',
          version: NET_BATTLE_LIVE_PROTOCOL_VERSION,
          code,
          playerId: credentialPlayerId,
          playerToken: credentialPlayerToken,
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
    code,
    credentialPlayerId,
    credentialPlayerToken,
    applyPresence,
    ensureRuntime,
    patchPlayer,
    publishCurrent,
    setPlayers,
  ]);

  return { players, ready, publishMove };
}
