import { Bluetooth, Mic } from 'lucide-react';
import type { ReactNode } from 'react';

export type TimerPlayersValue = 1 | 2 | 3 | 4 | 'net';

export interface TimerPlayersSelectProps {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  onlineLabel: string;
  onChange?: (value: TimerPlayersValue) => void;
  playerLabel: (count: 1 | 2 | 3 | 4) => string;
  readOnly?: boolean;
  value: TimerPlayersValue;
}

export function TimerPlayersSelect({
  ariaLabel,
  className,
  disabled = false,
  onlineLabel,
  onChange,
  playerLabel,
  readOnly = false,
  value,
}: TimerPlayersSelectProps) {
  if (readOnly) {
    return (
      <span
        aria-label={ariaLabel}
        className={`shell-players-select shell-players-select--readonly${className ? ` ${className}` : ''}`}
        data-no-timer
        title={ariaLabel}
      >
        {value === 'net' ? onlineLabel : playerLabel(value)}
      </span>
    );
  }

  return (
    <select
      aria-label={ariaLabel}
      className={`shell-players-select${className ? ` ${className}` : ''}`}
      data-no-timer
      disabled={disabled}
      onChange={(event) => {
        const next = event.target.value;
        onChange?.(next === 'net' ? 'net' : Number(next) as 1 | 2 | 3 | 4);
      }}
      title={ariaLabel}
      value={value}
    >
      {([1, 2, 3, 4] as const).map((count) => (
        <option key={count} value={count}>{playerLabel(count)}</option>
      ))}
      <option value="net">{onlineLabel}</option>
    </select>
  );
}

export interface TimerTopbarProps {
  brand?: ReactNode;
  controls: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function TimerTopbar({ brand, controls, actions, className }: TimerTopbarProps) {
  return (
    <header className={`shell-topbar surface-chrome${className ? ` ${className}` : ''}`}>
      {brand}
      <div className="shell-topbar-left">{controls}</div>
      <div className="shell-topbar-right">{actions}</div>
    </header>
  );
}

export interface TimerStatItem {
  label?: string;
  value: string;
}

export interface TimerStatRailProps {
  ariaExpanded?: boolean;
  className?: string;
  disabled?: boolean;
  emptyLabel: string;
  items: TimerStatItem[];
  onClick?: () => void;
  title?: string;
}

export function TimerStatRail({
  ariaExpanded,
  className,
  disabled = false,
  emptyLabel,
  items,
  onClick,
  title,
}: TimerStatRailProps) {
  return (
    <button
      aria-expanded={ariaExpanded}
      className={`shell-stat-rail surface-chrome${className ? ` ${className}` : ''}`}
      data-no-timer
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {items.length > 0 ? items.map(({ label, value }, index) => (
        <span className="shell-stat" key={`${label ?? 'value'}-${index}`}>
          {label && <span className="shell-stat-lbl">{label}</span>}
          <span className="shell-stat-val">{value}</span>
        </span>
      )) : (
        <span className="shell-stat"><span className="shell-stat-val">{emptyLabel}</span></span>
      )}
    </button>
  );
}

export interface TimerDeviceActionsProps {
  active?: boolean;
  className?: string;
  connectAriaLabel: string;
  connectLabel: string;
  microphoneActive?: boolean;
  microphoneAriaLabel?: string;
  onConnect: () => void;
  onMicrophone?: () => void;
}

export function TimerDeviceActions({
  active = false,
  className,
  connectAriaLabel,
  connectLabel,
  microphoneActive = false,
  microphoneAriaLabel,
  onConnect,
  onMicrophone,
}: TimerDeviceActionsProps) {
  return (
    <div
      className={`shell-device-actions surface-chrome${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      data-no-timer
    >
      <button
        aria-label={connectAriaLabel}
        className="shell-device-connect"
        onClick={onConnect}
        title={connectAriaLabel}
        type="button"
      >
        <Bluetooth aria-hidden="true" size={16} />
        <span>{connectLabel}</span>
      </button>
      {microphoneAriaLabel && onMicrophone && (
        <button
          aria-label={microphoneAriaLabel}
          className={`shell-stackmat-connect${microphoneActive ? ' is-active' : ''}`}
          onClick={onMicrophone}
          title={microphoneAriaLabel}
          type="button"
        >
          <Mic aria-hidden="true" size={15} />
        </button>
      )}
    </div>
  );
}
