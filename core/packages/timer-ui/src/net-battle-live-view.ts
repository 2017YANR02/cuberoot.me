import { useEffect, useMemo, useState } from 'react';
import { sortedNetPlayers, isNetOnline, isNetRoundParticipant, type NetRoomState } from '@cuberoot/shared/timer';
import type { NetBattleLiveCubePlayer } from './net-battle-live';
import { timerRoomPlayerName } from './TimerRoomPlayers';
export interface NetPkLock { code: string; round: number; opponentId: string; opponentName: string; }
export function useNetBattleLiveView({ room, pid, cubeConnected, localFacelets, liveCubePlayers, liveRoomReady, language }: {
  room: NetRoomState | null; pid: string | null; cubeConnected: boolean; localFacelets: string | null;
  liveCubePlayers: Record<string, NetBattleLiveCubePlayer>; liveRoomReady: boolean; language: 'en' | 'zh';
}) {
  const roomPlayers = useMemo(() => room ? sortedNetPlayers(room.players) : [], [room]);
  const [viewedCubePlayerId, setViewedCubePlayerId] = useState<string | null>(null);
  useEffect(() => { setViewedCubePlayerId(pid); }, [pid, room?.code]);
  useEffect(() => {
    if (!viewedCubePlayerId || viewedCubePlayerId === pid) return;
    const live = liveCubePlayers[viewedCubePlayerId];
    if (!room
      || !live?.connected
      || !live.smart
      || live.round !== room.round
      || !live.facelets) {
      setViewedCubePlayerId(pid);
    }
  }, [liveCubePlayers, pid, room, viewedCubePlayerId]);

  const [pkLock, setPkLock] = useState<NetPkLock | null>(null);
  useEffect(() => {
    setPkLock((current) => {
      if (!room || !pid) return null;
      if (current?.code === room.code && current.round === room.round) return current;
      const contenders = roomPlayers.filter((player) => (
        isNetOnline(player, room.now) && isNetRoundParticipant(room, player.id)
      ));
      if (contenders.length !== 2 || !contenders.some((player) => player.id === pid)) return null;
      const hasCurrentSnapshot = (playerId: string): boolean => {
        const live = liveCubePlayers[playerId];
        if (playerId === pid) {
          return liveRoomReady
            && cubeConnected
            && !!localFacelets
            && !!live?.connected
            && live.smart
            && live.round === room.round;
        }
        return !!live?.connected
          && live.smart
          && live.round === room.round
          && !!live.facelets;
      };
      if (!contenders.every((player) => hasCurrentSnapshot(player.id))) return null;
      const opponent = contenders.find((player) => player.id !== pid);
      return opponent ? {
        code: room.code,
        round: room.round,
        opponentId: opponent.id,
        opponentName: timerRoomPlayerName(opponent, language),
      } : null;
    });
  }, [
    localFacelets,
    cubeConnected,
    language,
    liveCubePlayers,
    liveRoomReady,
    pid,
    room,
    roomPlayers,
  ]);
  const activePkLock = room && pkLock?.code === room.code && pkLock.round === room.round ? pkLock : null;

  return { activePkLock, viewedCubePlayerId, setViewedCubePlayerId };
}
