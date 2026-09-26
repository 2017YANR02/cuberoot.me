import { Bluetooth, Mic, Timer } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

import type { TimerDeviceKind } from '@cuberoot/shared/timer/device-contract';
import { usePopoverDismiss } from './usePopoverDismiss';

export interface TimerDeviceCenterItem {
  active?: boolean;
  detail?: string;
  disabled?: boolean;
  id: string;
  icon?: ReactNode;
  kind: TimerDeviceKind;
  label: string;
  onSelect(): void;
}

export interface TimerDeviceCenterProps {
  ariaLabel: string;
  className?: string;
  items: readonly TimerDeviceCenterItem[];
  menuLabel: string;
  triggerLabel: string;
}

/**
 * Capability-driven device chooser for the timer chrome.
 *
 * Hosts provide only real adapter-backed items and their actions. The center
 * owns the compact trigger, focus return, dismissal and the shared list shape;
 * it does not know about BLE, microphones or platform permissions.
 */
export function TimerDeviceCenter({
  ariaLabel,
  className,
  items,
  menuLabel,
}: TimerDeviceCenterProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePopoverDismiss(open, () => setOpen(false), panelRef, triggerRef);

  if (items.length === 0) return null;

  const active = items.some((item) => item.active);
  return (
    <div className={`shell-device-center${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`} data-no-timer>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        className="shell-device-center-trigger"
        onClick={() => setOpen((value) => !value)}
        ref={triggerRef}
        title={ariaLabel}
        type="button"
      >
        <Bluetooth aria-hidden="true" size={16} />
      </button>
      {open && (
        <div
          aria-label={menuLabel}
          className="shell-device-center-menu"
          ref={panelRef}
          role="menu"
        >
          {items.map((item) => (
            <button
              aria-disabled={item.disabled || undefined}
              className={`shell-device-center-item${item.active ? ' is-active' : ''}`}
              disabled={item.disabled}
              key={item.id}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              role="menuitem"
              type="button"
            >
              <span className="shell-device-center-item-icon">
                {item.icon ?? iconForKind(item.kind)}
              </span>
              <span className="shell-device-center-item-copy">
                <strong>{item.label}</strong>
                {item.detail && <small>{item.detail}</small>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function iconForKind(kind: TimerDeviceKind): ReactNode {
  if (kind === 'stackmat') return <Mic aria-hidden="true" size={15} />;
  if (kind === 'smart-timer') return <Timer aria-hidden="true" size={15} />;
  return <Bluetooth aria-hidden="true" size={15} />;
}
