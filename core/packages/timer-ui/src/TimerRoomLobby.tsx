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
  onCodeChange(code: string): void;
  onJoin(code: string): void;
  onCreate(): void;
  onCancelInvite?(): void;
  onExit?(): void;
}
const COPY = {
  en: { title: 'Online battle', create: 'Create room', code: 'Room code', or: 'or enter', joining: 'Joining room…', retry: 'Retry', own: 'Create my own room', exit: 'Exit online mode' },
  zh: { title: '联机对战', create: '创建房间', code: '房间码', or: '或输入', joining: '正在进入房间…', retry: '重试', own: '创建自己的房间', exit: '退出联机' },
};

export function TimerRoomLobby({ language, identity, event, code, busy, error, inviteCode, onCodeChange, onJoin, onCreate, onCancelInvite, onExit }: TimerRoomLobbyProps) {
  const copy = COPY[language];
  return <section className="timer-room-lobby" data-no-timer aria-label={copy.title}>
    <h2>{copy.title}{inviteCode && ` · ${inviteCode}`}</h2>
    {!inviteCode && <>
      <div className="timer-room-lobby-fields">{event}{identity}</div>
      <div className="timer-room-lobby-actions">
        <button type="button" disabled={busy} onClick={onCreate}>{copy.create}</button>
        <span>{copy.or}</span>
        <RoomCodeInput label={copy.code} value={code} disabled={busy} onValueChange={onCodeChange} onComplete={onJoin} />
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
