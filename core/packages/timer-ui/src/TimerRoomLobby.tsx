import { timerEventPickerName } from '@cuberoot/shared/timer';
import { TIMER_ROOM_LOBBY_COPY, type NetRecentRoom } from '@cuberoot/shared/timer/net-battle';
import type { ReactNode } from 'react';
import { RoomCodeInput } from './RoomCodeInput';

export interface TimerRoomLobbyProps {
  language: 'en' | 'zh';
  identity: ReactNode;
  event: ReactNode;
  code: string;
  busy: boolean;
  error?: string | null;
  inviteCode?: string | null;
  recentRooms?: readonly NetRecentRoom[];
  onCodeChange(code: string): void;
  onJoin(code: string): void;
  onCreate(): void;
  onCancelInvite?(): void;
  onExit?(): void;
}


export function TimerRoomLobby({ language, identity, event, code, busy, error, inviteCode, recentRooms, onCodeChange, onJoin, onCreate, onCancelInvite, onExit }: TimerRoomLobbyProps) {
  const copy = TIMER_ROOM_LOBBY_COPY[language];
  return <section className="timer-room-lobby" data-no-timer aria-label={copy.title}>
    <h2>{copy.title}{inviteCode && ` · ${inviteCode}`}</h2>
    {!inviteCode && <>
      {identity}
      <div className="timer-room-lobby-options">
        <div className="timer-room-lobby-actions timer-room-lobby-create">
          {event}
          <button type="button" disabled={busy} onClick={onCreate}>{copy.create}</button>
        </div>
        <div className="timer-room-lobby-actions timer-room-lobby-join" role="group" aria-label={copy.join}>
          <span aria-hidden="true">{copy.join}</span>
          <RoomCodeInput label={copy.code} value={code} disabled={busy} onValueChange={onCodeChange} onComplete={onJoin} />
          {!!recentRooms?.length && <div className="timer-room-recent" role="group" aria-label={copy.recent}>
            <span aria-hidden="true">{copy.recent}</span>
            {recentRooms.map(room => <button key={room.code} type="button" disabled={busy} onClick={() => onJoin(room.code)}>
              <strong>{room.code}</strong> <small>{timerEventPickerName(room.event, language)}</small>
            </button>)}
          </div>}
        </div>
      </div>
    </>}
    {error && <p role="alert">{error}</p>}
    {inviteCode && error && <div className="timer-room-lobby-actions">
      <button type="button" disabled={busy} onClick={() => onJoin(inviteCode)}>{copy.retry}</button>
      {onCancelInvite && <button type="button" disabled={busy} onClick={onCancelInvite}>{copy.own}</button>}
      {onExit && <button type="button" onClick={onExit}>{copy.exit}</button>}
    </div>}
    {(busy || (inviteCode && !error)) && <p role="status">{copy.joining}</p>}
  </section>;
}
