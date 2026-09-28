import type { ReactNode } from 'react';
import { Check, Copy, History, LogOut, QrCode, ShieldCheck } from 'lucide-react';

export interface TimerRoomToolbarProps {
  language: 'en' | 'zh';
  code: string;
  round: number;
  syncStart: boolean;
  copied: boolean;
  copyKind: 'code' | 'invite';
  disabled?: boolean;
  historyOpen?: boolean;
  adminOpen?: boolean;
  onCopy(): void;
  onQr(): void;
  onHistory(): void;
  onAdmin?(): void;
  onLeave(): void;
  children?: ReactNode;
}
const COPY = {
  en: { round: 'Round', room: 'Room', sync: 'Synchronized start', code: 'Copy room code', invite: 'Copy invite link', copiedCode: 'Room code copied', copiedInvite: 'Invite link copied', qr: 'Room QR code', history: 'Scramble history and results', admin: 'Room settings', leave: 'Leave room' },
  zh: { round: '轮次', room: '房间', sync: '同时开始计时', code: '复制房间码', invite: '复制邀请链接', copiedCode: '已复制房间码', copiedInvite: '已复制邀请链接', qr: '房间二维码', history: '历史打乱与战绩', admin: '房间管理', leave: '离开房间' },
};

/** Shared room actions; clipboard and room lifecycle remain host capabilities. */
export function TimerRoomToolbar({ language, code, round, syncStart, copied, copyKind, disabled, historyOpen, adminOpen, onCopy, onQr, onHistory, onAdmin, onLeave, children }: TimerRoomToolbarProps) {
  const copy = COPY[language];
  return <div className="timer-room-toolbar surface-chrome" data-no-timer>
    <span>{copy.round} {round}</span>
    {syncStart && <span>{copy.sync}</span>}
    <div className="timer-room-actions">
      <button type="button" title={copy[copyKind]} aria-label={copy[copyKind]} onClick={onCopy}>
        <span>{copy.room}: <strong>{code}</strong></span>{copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <span className="timer-room-copy-status" role="status">{copied ? copy[copyKind === 'code' ? 'copiedCode' : 'copiedInvite'] : ''}</span>
      <button type="button" title={copy.qr} aria-label={copy.qr} onClick={onQr}><QrCode size={16} /></button>
      <button type="button" title={copy.history} aria-label={copy.history} aria-expanded={historyOpen} disabled={disabled} onClick={onHistory}><History size={16} /></button>
      {onAdmin && <button type="button" title={copy.admin} aria-label={copy.admin} aria-expanded={adminOpen} disabled={disabled} onClick={onAdmin}><ShieldCheck size={16} /></button>}
      {children}
      <button type="button" title={copy.leave} aria-label={copy.leave} disabled={disabled} onClick={onLeave}><LogOut size={16} /></button>
    </div>
  </div>;
}
