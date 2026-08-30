import { Bluetooth, Mic } from 'lucide-react';
import type { ReactNode } from 'react';

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
  emptyLabel: string;
  items: TimerStatItem[];
  onClick?: () => void;
  title?: string;
}

export function TimerStatRail({
  ariaExpanded,
  className,
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
  microphoneAriaLabel: string;
  onConnect: () => void;
  onMicrophone: () => void;
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
      <button
        aria-label={microphoneAriaLabel}
        className={`shell-stackmat-connect${microphoneActive ? ' is-active' : ''}`}
        onClick={onMicrophone}
        title={microphoneAriaLabel}
        type="button"
      >
        <Mic aria-hidden="true" size={15} />
      </button>
    </div>
  );
}
