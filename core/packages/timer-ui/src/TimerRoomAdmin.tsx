import { TIMER_ROOM_ADMIN_COPY } from '@cuberoot/shared/timer/net-battle';
import { useState } from 'react';
import { sortedNetPlayers, type NetRoomState } from '@cuberoot/shared/timer';
import { Flag } from './CountryFlag';
import BoolToggle from './BoolToggle';
import { TimerRoomDialog } from './TimerRoomDialog';
import { timerRoomPlayerName } from './TimerRoomPlayers';

export interface TimerRoomAdminProps {
  room: NetRoomState;
  currentPlayerId: string | null;
  language: 'en' | 'zh';
  busy?: boolean;
  onSyncStart(value: boolean): void;
  onTransfer(id: string): void;
  onKick(id: string): void;
  onClose(): void;
}


export function TimerRoomAdmin({ room, currentPlayerId, language, busy, onSyncStart, onTransfer, onKick, onClose }: TimerRoomAdminProps) {
  const copy = TIMER_ROOM_ADMIN_COPY[language];
  const [confirm, setConfirm] = useState<string | null>(null);
  return <TimerRoomDialog title={copy.title} language={language} onClose={onClose}>
    <BoolToggle label={copy.sync} value={room.syncStart} disabled={busy} onChange={onSyncStart} />
    <ul className="timer-room-admin-list">
      {sortedNetPlayers(room.players).map((player) => <li key={player.id}>
        {player.iso2 && <Flag className="timer-room-player-flag" iso2={player.iso2} />}
        <span className="timer-room-admin-name">{timerRoomPlayerName(player, language)}{player.id === currentPlayerId && ` ${copy.me}`}{player.wcaId && <small>{player.wcaId}</small>}</span>
        {player.id === room.admin && <span>{copy.host}</span>}
        {player.id !== currentPlayerId && <div className="timer-room-actions">
          {(['transfer', 'kick'] as const).map((action) => {
            const key = `${action}:${player.id}`;
            return <button key={action} type="button" disabled={busy} onBlur={() => setConfirm((value) => value === key ? null : value)} onClick={() => {
              if (confirm !== key) { setConfirm(key); return; }
              setConfirm(null);
              (action === 'transfer' ? onTransfer : onKick)(player.id);
            }}>{confirm === key ? copy[action === 'transfer' ? 'confirmTransfer' : 'confirm'] : copy[action]}</button>;
          })}
        </div>}
      </li>)}
    </ul>
  </TimerRoomDialog>;
}
