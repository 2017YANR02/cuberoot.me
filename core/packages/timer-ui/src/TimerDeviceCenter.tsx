import { Bluetooth, Mic, Timer } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

import type { TimerDeviceKind } from '@cuberoot/shared/timer/device-contract';
import { usePopoverDismiss } from './usePopoverDismiss';
import { usePanelClamp } from './usePanelClamp';

/** Canonical Web copy for every installed device-center consumer. */
export const TIMER_DEVICE_CENTER_LABELS = {
  title: { zh: '计时设备', en: 'Timer devices' },
  menu: { zh: '可用计时设备', en: 'Available timer devices' },
  trigger: { zh: '设备', en: 'Devices' },
  connected: { zh: '已连接', en: 'Connected' },
  listening: { zh: '监听中', en: 'Listening' },
  'smart-cube': { zh: '智能魔方', en: 'Smart cube' },
  'smart-timer': { zh: '智能计时器', en: 'Smart timer' },
  stackmat: { zh: 'Stackmat 麦克风', en: 'Stackmat microphone' },
} as const;

export interface TimerDeviceCenterItem {
  active?: boolean;
  detail?: string;
  disabled?: boolean;
  id: string;
  icon?: ReactNode;
  /** Omit for host-owned utility actions, such as development tools. */
  kind?: TimerDeviceKind;
  label: string;
  onSelect(): void;
}

export interface TimerDeviceCenterProps {
  ariaLabel: string;
  className?: string;
  /** Host-owned panels anchored to the same device trigger. */
  children?: ReactNode;
  /** Invoke the sole action in the click event, preserving browser user activation. */
  directSingleItem?: boolean;
  items: readonly TimerDeviceCenterItem[];
  menuLabel: string;
  triggerLabel: string;
}

/**
 * Capability-driven device chooser for the timer chrome.
 *
 * Hosts provide adapter-backed devices and optional utility actions. The center
 * owns the compact trigger, focus return, dismissal and the shared list shape;
 * a connected smart cube opens its host action directly when no utility needs
 * to remain reachable through the menu.
 * it does not know about BLE, microphones or platform permissions.
 */
export function TimerDeviceCenter({
  ariaLabel,
  className,
  children,
  directSingleItem = false,
  items,
  menuLabel,
}: TimerDeviceCenterProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  usePopoverDismiss(open, () => setOpen(false), panelRef, triggerRef);
  usePanelClamp(open, panelRef);

  if (items.length === 0) return null;

  const active = items.some((item) => item.active);
  // Host utilities must remain reachable even with a cube connected.
  const connectedCube = items.some((item) => !item.kind) ? undefined
    : items.find((item) => item.kind === 'smart-cube' && item.active && !item.disabled);
  const directItem = directSingleItem && items.length === 1 ? items[0] : connectedCube;
  return (
    <div className={`shell-device-center${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`} data-no-timer>
      <button
        aria-expanded={directItem ? undefined : open}
        aria-haspopup={directItem ? 'dialog' : 'menu'}
        aria-label={directItem?.label ?? ariaLabel}
        className="shell-device-center-trigger"
        disabled={directItem?.disabled}
        onClick={() => {
          if (directItem) {
            setOpen(false);
            directItem.onSelect();
          } else {
            setOpen((value) => !value);
          }
        }}
        ref={triggerRef}
        title={directItem?.label ?? ariaLabel}
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
                {item.icon ?? iconForKind(item.kind ?? 'smart-cube')}
              </span>
              <span className="shell-device-center-item-copy">
                <strong>{item.label}</strong>
                {item.detail && <small>{item.detail}</small>}
              </span>
            </button>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

function iconForKind(kind: TimerDeviceKind): ReactNode {
  if (kind === 'stackmat') return <Mic aria-hidden="true" size={15} />;
  if (kind === 'smart-timer') return <Timer aria-hidden="true" size={15} />;
  return <Bluetooth aria-hidden="true" size={15} />;
}
