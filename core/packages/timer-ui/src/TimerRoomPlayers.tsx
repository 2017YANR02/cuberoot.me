import { EventIcon } from '@cuberoot/event-icon/event';
import { netEventToSelectorId } from '@cuberoot/shared/timer';
import type { ReactNode } from 'react';
import { Eye, ShieldCheck, Trophy } from 'lucide-react';
import { displayCuberName } from '@cuberoot/shared/cuber-name-display';
import { effectiveNetMs, formatMs, isNetOnline, pendingCount, roundWinners, sortedNetPlayers, type NetRoomState, type NetBattleEventId } from '@cuberoot/shared/timer';
import { Flag } from './CountryFlag';

export interface TimerRoomPlayersProps {
  room: NetRoomState;
  currentPlayerId?: string | null;
  language: 'en' | 'zh';
  precision: 2 | 3;
  nowMs: number;
  viewedPlayerId?: string | null;
  canViewPlayer?(id: string): boolean;
  onViewPlayer?(id: string): void;
  onRename?(name: string): void;
  eventIcon?(event: NetBattleEventId): ReactNode;
  runningTime?(id: string, elapsedMs: number): ReactNode;
}
const COPY = {
  en: { players: 'Players', me: '(me)', host: 'Host', score: 'Score', view: 'View cube', rename: 'Change name', offline: 'Offline', ready: 'Ready', inspecting: 'Inspecting', waiting: 'Waiting to start' },
  zh: { players: '玩家', me: '（我）', host: '房主', score: '得分', view: '查看魔方', rename: '改名', offline: '离线', ready: '已准备', inspecting: '观察中', waiting: '待开始' },
};

export function timerRoomPlayerName(player: { name: string; wcaId?: string }, language: 'en' | 'zh'): string {
  if (!player.wcaId) return player.name;
  const base = player.name.replace(/ \(\d+\)$/, '');
  return displayCuberName(base, language === 'zh') + player.name.slice(base.length);
}

export function TimerRoomPlayers({ room, currentPlayerId, language, precision, nowMs, viewedPlayerId, canViewPlayer, onViewPlayer, onRename, eventIcon, runningTime }: TimerRoomPlayersProps) {
  const copy = COPY[language];
  const players = sortedNetPlayers(room.players);
  const results = room.results[String(room.round)];
  const winners = pendingCount(room) === 0 ? roundWinners(results, room.players) : [];
  const mixed = new Set(players.map((player) => player.event || room.event)).size > 1;
  return <ul className="timer-room-players surface-chrome" aria-label={copy.players} data-no-timer>
    {players.map((player) => {
      const mine = player.id === currentPlayerId;
      const online = isNetOnline(player, room.now);
      const result = results?.[player.id];
      const name = timerRoomPlayerName(player, language);
      const elapsed = Math.max(0, nowMs - player.at);
      const status = result
        ? result.p === 'dnf' ? 'DNF' : formatMs(effectiveNetMs(result), precision) + (result.p === '+2' ? '+' : '')
        : !online ? copy.offline
          : player.ph === 'solving' ? runningTime?.(player.id, elapsed) ?? formatMs(elapsed, 2)
            : player.ph === 'inspecting' ? copy.inspecting : player.ph === 'ready' ? copy.ready : copy.waiting;
      return <li key={player.id} className={`timer-room-player${mine ? ' is-me' : ''}${online ? '' : ' is-offline'}${viewedPlayerId === player.id ? ' is-active' : ''}`}>
        {mixed && <span className="timer-room-player-icon">{eventIcon?.(player.event || room.event) ?? <EventIcon event={netEventToSelectorId(player.event || room.event)} />}</span>}
        {player.id === room.admin && <ShieldCheck size={14} aria-label={copy.host} />}
        {player.iso2 && <Flag iso2={player.iso2} className="timer-room-player-flag" />}
        {mine && onRename ? <button className="timer-room-player-name" type="button" title={copy.rename} onClick={() => onRename(player.name)}>{name} {copy.me}</button>
          : <span className="timer-room-player-name" title={player.wcaId ? `${name} · ${player.wcaId}` : name}>{name}{mine && ` ${copy.me}`}</span>}
        <span className="timer-room-player-score" aria-label={copy.score}>{winners.includes(player.id) && <Trophy size={12} />}{room.scores[player.id] ?? 0}</span>
        <span className="timer-room-player-status">{status}</span>
        {canViewPlayer?.(player.id) && onViewPlayer && <button type="button" className="timer-room-player-view" aria-label={`${copy.view}: ${name}`} aria-pressed={viewedPlayerId === player.id} onClick={() => onViewPlayer(player.id)}><Eye size={16} /></button>}
      </li>;
    })}
  </ul>;
}
