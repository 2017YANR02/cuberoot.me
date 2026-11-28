import { isNetOnline, TIMER_ROOM_TOOLBAR_COPY, type NetRoomState } from '@cuberoot/shared/timer/net-battle';
import { useEffect, useState, type ReactNode } from 'react';
import { CopySuccessIcon } from './CopySuccessIcon';
import { Copy, History, LogOut, QrCode, Settings, ShieldCheck } from 'lucide-react';

export interface TimerRoomToolbarProps {
  language: 'en' | 'zh';
  room: NetRoomState;
  copied: boolean;
  copyKind: 'code' | 'invite';
  disabled?: boolean;
  historyOpen?: boolean;
  adminOpen?: boolean;
  timerSettingsOpen?: boolean;
  timerSettingsDisabled?: boolean;
  onCopy(): void;
  onQr(): void;
  onHistory(): void;
  onAdmin?(): void;
  onTimerSettings?(): void;
  onLeave(): void;
  children?: ReactNode;
}

/** Inline confirmation is scoped by the caller's room or round key. */
export function TimerRoomConfirmAction({ label, confirmLabel, children, disabled, required, warning, onClick }: {
  label: string;
  confirmLabel: string;
  children?: ReactNode;
  disabled?: boolean;
  required: boolean;
  warning?: boolean;
  onClick(): void;
}) {
  const [confirm, setConfirm] = useState(false);
  const armed = confirm && required && !disabled;
  useEffect(() => {
    if (!armed) { setConfirm(false); return; }
    const timeout = setTimeout(() => setConfirm(false), 4_000);
    return () => clearTimeout(timeout);
  }, [armed]);

  return <button type="button" disabled={disabled} aria-label={armed ? confirmLabel : label}
    title={children && !armed ? label : undefined}
    className={armed || warning ? 'timer-room-warning-action' : undefined}
    onBlur={() => setConfirm(false)}
    onKeyDown={event => { if (event.key === 'Enter' && event.repeat) event.preventDefault(); }}
    onClick={() => {
      if (required && !armed) { setConfirm(true); return; }
      setConfirm(false);
      onClick();
    }}>
    {armed ? confirmLabel : children ?? label}
  </button>;
}

/** Shared room actions; clipboard and room lifecycle remain host capabilities. */
export function TimerRoomToolbar({ language, room, copied, copyKind, disabled, historyOpen, adminOpen, timerSettingsOpen, timerSettingsDisabled, onCopy, onQr, onHistory, onAdmin, onTimerSettings, onLeave, children }: TimerRoomToolbarProps) {
  const copy = TIMER_ROOM_TOOLBAR_COPY[language];
  const { code, round, syncStart } = room;
  const confirmLeave = round > 1 || room.history.length > 0
    || Object.values(room.results).some(results => Object.keys(results).length > 0)
    || Object.values(room.scores).some(score => score > 0)
    || Object.values(room.players).filter(player => isNetOnline(player, room.now)).length >= 2;
  return <div className="timer-room-toolbar surface-chrome" data-no-timer>
    <span>{copy.round} {round}</span>
    {syncStart && <span>{copy.sync}</span>}
    <div className="timer-room-actions">
      <button type="button" title={copy[copyKind]} aria-label={copy[copyKind]} onClick={onCopy}>
        <span>{copy.room}: <strong>{code}</strong></span>{copied ? <CopySuccessIcon size={16} /> : <Copy size={16} />}
      </button>
      <span className="timer-room-copy-status" role="status">{copied ? copy[copyKind === 'code' ? 'copiedCode' : 'copiedInvite'] : ''}</span>
      <button type="button" title={copy.qr} aria-label={copy.qr} onClick={onQr}><QrCode size={16} /></button>
      <button type="button" title={copy.history} aria-label={copy.history} aria-expanded={historyOpen} disabled={disabled} onClick={onHistory}><History size={16} /></button>
      {onAdmin && <button type="button" title={copy.admin} aria-label={copy.admin} aria-expanded={adminOpen} disabled={disabled} onClick={onAdmin}><ShieldCheck size={16} /></button>}
      {onTimerSettings && <button type="button" title={copy.timerSettings} aria-label={copy.timerSettings}
        aria-expanded={timerSettingsOpen} disabled={disabled || timerSettingsDisabled} onClick={onTimerSettings}><Settings size={16} /></button>}
      {children}
      <TimerRoomConfirmAction key={code} label={copy.leave} confirmLabel={copy.confirmLeave}
        disabled={disabled} required={confirmLeave} onClick={onLeave}><LogOut size={16} /></TimerRoomConfirmAction>
    </div>
  </div>;
}
